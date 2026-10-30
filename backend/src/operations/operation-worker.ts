import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import {
  getOperationHandler,
  OperationFailure,
  OperationContext,
} from './registry';
import { recordOperationFailure } from './recovery';

const QUEUE_NAME = 'taxbridge-operations';

async function processOperation(job: Job<{ operationId: string }>): Promise<void> {
  const operationId = job.data?.operationId;
  if (!operationId) throw new Error('Missing operationId');

  const operation = await prisma.syncOperation.findUnique({ where: { operationId } });
  if (!operation) throw new Error(`Unknown operation: ${operationId}`);

  if (operation.status === 'acknowledged' || operation.status === 'dead_letter') return;
  if (operation.deadlineAt.getTime() <= Date.now()) {
    await recordOperationFailure(operationId,
      new OperationFailure('Operation deadline expired', 'OPERATION_DEADLINE_EXPIRED', false));
    return;
  }

  const handler = getOperationHandler(operation.operationType);
  if (!handler) {
    await recordOperationFailure(operationId,
      new OperationFailure(
        `No approved handler registered for ${operation.operationType}`,
        'OPERATION_HANDLER_NOT_REGISTERED',
        false,
      ));
    return;
  }

  await prisma.syncOperation.update({
    where: { operationId },
    data: { status: 'processing', nextAttemptAt: null },
  });

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
    const outcome = await handler(context);
    await prisma.$transaction(async (tx) => {
      await tx.syncOperation.update({
        where: { operationId },
        data: {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          result: outcome.result,
          providerReference: outcome.providerReference ?? operation.providerReference,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      await tx.operationOutbox.updateMany({
        where: { operationId, topic: { startsWith: 'taxbridge.operation.' } },
        data: { dispatchedAt: new Date() },
      });
    });
  } catch (error) {
    const result = await recordOperationFailure(operationId, error);
    if (result === 'retry_scheduled') {
      const latest = await prisma.syncOperation.findUnique({ where: { operationId } });
      if (latest?.nextAttemptAt) {
        // This retry is scheduled only for a non-terminal operation. Once a
        // terminal failure is recorded, no further automatic enqueue occurs.
        const { Queue } = await import('bullmq');
        const retryQueue = new Queue(QUEUE_NAME, { connection: redis });
        try {
          await retryQueue.add('execute-operation', { operationId }, {
            jobId: `operation-retry-${operationId}-${latest.attemptCount}`,
            delay: Math.max(0, latest.nextAttemptAt.getTime() - Date.now()),
            removeOnComplete: 500,
            removeOnFail: false,
          });
        } finally {
          await retryQueue.close();
        }
      }
    }
  }
}

export function startOperationWorker(): Worker {
  const worker = new Worker(QUEUE_NAME, processOperation, {
    connection: redis,
    concurrency: Number.parseInt(process.env.OPERATION_WORKER_CONCURRENCY ?? '5', 10),
    // Retry scheduling is owned by PostgreSQL + recovery.ts, not BullMQ.
    // BullMQ itself must not apply a second, competing retry policy.
  });
  worker.on('failed', (job, error) => {
    process.stderr.write(`[operation-worker] job=${job?.id ?? 'unknown'} failed: ${error.message}\n`);
  });
  return worker;
}
