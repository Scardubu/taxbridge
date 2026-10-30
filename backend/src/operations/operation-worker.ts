import { randomUUID } from 'node:crypto';
import { Job, Worker } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import {
  getOperationHandler,
  OperationFailure,
  OperationContext,
} from './registry';
import { recordOperationFailure } from './recovery';
import { registerBuiltinOperationHandlers } from './register-handlers';

const QUEUE_NAME = 'taxbridge-operations';
const PROCESSING_LEASE_MS = 120_000;
const LEASE_RENEW_INTERVAL_MS = 30_000;

interface OperationJobData {
  operationId: string;
  outboxId?: string;
}

interface ClaimedOperation {
  operation: NonNullable<Awaited<ReturnType<typeof prisma.syncOperation.findUnique>>>;
  leaseToken: string;
}

/**
 * PostgreSQL owns operation state and worker ownership. Redis/BullMQ is only
 * a delivery mechanism; duplicate jobs are expected and must be harmless.
 */
async function claimOperation(
  operationId: string,
  outboxId?: string,
): Promise<ClaimedOperation | null> {
  const now = new Date();
  const leaseToken = randomUUID();
  const processingLeaseUntil = new Date(now.getTime() + PROCESSING_LEASE_MS);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.syncOperation.updateMany({
      where: {
        operationId,
        deadlineAt: { gt: now },
        OR: [
          {
            status: { in: ['pending', 'retry_scheduled'] },
            OR: [
              { nextAttemptAt: null },
              { nextAttemptAt: { lte: now } },
            ],
          },
          {
            status: 'processing',
            OR: [
              { processingLeaseUntil: null },
              { processingLeaseUntil: { lte: now } },
            ],
          },
        ],
      },
      data: {
        status: 'processing',
        nextAttemptAt: null,
        processingLeaseToken: leaseToken,
        processingLeaseUntil,
      },
    });

    if (claimed.count !== 1) return null;

    const operation = await tx.syncOperation.findUnique({ where: { operationId } });
    if (!operation) throw new Error('Claimed operation disappeared');

    // The outbox row is acknowledged only after the durable operation claim
    // commits. If Redis loses an unclaimed job, the dispatcher can recreate it.
    if (outboxId) {
      await tx.operationOutbox.updateMany({
        where: { id: outboxId, operationId, dispatchedAt: null },
        data: { dispatchedAt: now },
      });
    }

    return { operation, leaseToken };
  });
}

function startLeaseHeartbeat(operationId: string, leaseToken: string): () => void {
  let renewing = false;
  const timer = setInterval(() => {
    if (renewing) return;
    renewing = true;
    void prisma.syncOperation.updateMany({
      where: {
        operationId,
        status: 'processing',
        processingLeaseToken: leaseToken,
      },
      data: { processingLeaseUntil: new Date(Date.now() + PROCESSING_LEASE_MS) },
    }).then((result) => {
      if (result.count !== 1) {
        process.stderr.write('[operation-worker] processing lease ownership was lost\n');
      }
    }).catch((error) => {
      process.stderr.write(
        '[operation-worker] processing lease renewal failed: ' +
        (error instanceof Error ? error.message : String(error)) + '\n',
      );
    }).finally(() => {
      renewing = false;
    });
  }, LEASE_RENEW_INTERVAL_MS);

  timer.unref?.();
  return () => clearInterval(timer);
}

async function processOperation(job: Job<OperationJobData>): Promise<void> {
  const operationId = job.data?.operationId;
  if (!operationId) throw new Error('Missing operationId');

  const snapshot = await prisma.syncOperation.findUnique({ where: { operationId } });
  if (!snapshot) throw new Error('Unknown operation: ' + operationId);
  if (snapshot.status === 'acknowledged' || snapshot.status === 'dead_letter') return;

  if (snapshot.deadlineAt.getTime() <= Date.now()) {
    await recordOperationFailure(
      operationId,
      new OperationFailure('Operation deadline expired', 'OPERATION_DEADLINE_EXPIRED', false),
    );
    return;
  }

  const claim = await claimOperation(operationId, job.data.outboxId);
  if (!claim) {
    // Close the small race in which the deadline expires after the snapshot
    // read but before the conditional claim.
    const latest = await prisma.syncOperation.findUnique({ where: { operationId } });
    if (latest && latest.deadlineAt.getTime() <= Date.now()) {
      await recordOperationFailure(
        operationId,
        new OperationFailure('Operation deadline expired', 'OPERATION_DEADLINE_EXPIRED', false),
      );
    }
    return;
  }

  const { operation, leaseToken } = claim;
  const stopHeartbeat = startLeaseHeartbeat(operationId, leaseToken);

  const context: OperationContext = {
    operationId: operation.operationId,
    organizationId: operation.organizationId,
    userId: operation.userId,
    operationType: operation.operationType,
    schemaVersion: operation.schemaVersion,
    idempotencyKey: operation.idempotencyKey,
    payloadFingerprint: operation.payloadFingerprint,
    payload: operation.payload,
    providerReference: operation.providerReference,
  };

  try {
    const handler = getOperationHandler(operation.operationType);
    if (!handler) {
      throw new OperationFailure(
        'No approved handler registered for ' + operation.operationType,
        'OPERATION_HANDLER_NOT_REGISTERED',
        false,
      );
    }

    const outcome = await handler(context);
    if (operation.deadlineAt.getTime() <= Date.now()) {
      throw new OperationFailure('Operation deadline expired', 'OPERATION_DEADLINE_EXPIRED', false);
    }

    await prisma.$transaction(async (tx) => {
      const acknowledged = await tx.syncOperation.updateMany({
        where: {
          operationId,
          status: 'processing',
          processingLeaseToken: leaseToken,
          deadlineAt: { gt: new Date() },
        },
        data: {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          result: outcome.result,
          providerReference: outcome.providerReference ?? operation.providerReference,
          lastErrorCode: null,
          lastErrorMessage: null,
          processingLeaseToken: null,
          processingLeaseUntil: null,
        },
      });

      if (acknowledged.count !== 1) return;

      await tx.operationOutbox.updateMany({
        where: {
          operationId,
          topic: { startsWith: 'taxbridge.operation.' },
          dispatchedAt: null,
        },
        data: { dispatchedAt: new Date() },
      });
    });
  } catch (error) {
    try {
      const recovery = await recordOperationFailure(operationId, error, { leaseToken });
      if (recovery === 'lease_lost') {
        process.stderr.write('[operation-worker] failure ignored after lease ownership changed\n');
      }
    } catch (recoveryError) {
      process.stderr.write(
        '[operation-worker] durable failure recording failed: ' +
        (recoveryError instanceof Error ? recoveryError.message : String(recoveryError)) + '\n',
      );
      throw recoveryError;
    }
  } finally {
    stopHeartbeat();
  }
}

export function startOperationWorker(): Worker {
  // Registration is performed here so every supported worker entrypoint
  // (combined queue process and standalone worker) has the same allow-list.
  registerBuiltinOperationHandlers();

  const configuredConcurrency = Number.parseInt(
    process.env.OPERATION_WORKER_CONCURRENCY ?? '5',
    10,
  );
  const concurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
    ? Math.min(configuredConcurrency, 50)
    : 5;

  const worker = new Worker(QUEUE_NAME, processOperation, {
    connection: redis,
    concurrency,
    // Keep BullMQ's delivery lock longer than the database lease. PostgreSQL
    // lease expiry remains the recovery authority after a process crash.
    lockDuration: 180_000,
    stalledInterval: 30_000,
    maxStalledCount: 2,
  });

  worker.on('failed', (job, error) => {
    process.stderr.write(
      '[operation-worker] job=' + (job?.id ?? 'unknown') + ' failed: ' + error.message + '\n',
    );
  });
  worker.on('stalled', (jobId) => {
    process.stderr.write('[operation-worker] stalled job=' + jobId + '\n');
  });

  return worker;
}
