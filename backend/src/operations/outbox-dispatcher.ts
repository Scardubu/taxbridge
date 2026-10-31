import { Queue } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const QUEUE_NAME = 'taxbridge-operations';
const queue = new Queue(QUEUE_NAME, { connection: redis });

/**
 * Dispatch durable PostgreSQL work to BullMQ. Rows remain undispatched until a
 * worker atomically claims the corresponding operation. This allows polling
 * to recreate a lost Redis job without racing the persisted retry timestamp.
 */
export async function dispatchOutboxBatch(batchSize = 100): Promise<number> {
  const now = new Date();
  const rows = await prisma.operationOutbox.findMany({
    where: { dispatchedAt: null },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  let dispatched = 0;
  for (const row of rows) {
    const payload = row.payload as { operationId?: unknown };
    if (typeof payload.operationId !== 'string' || payload.operationId !== row.operationId) {
      throw new Error('Malformed operation outbox payload: ' + row.id);
    }

    const operation = await prisma.syncOperation.findUnique({
      where: { operationId: row.operationId },
      select: {
        operationId: true,
        status: true,
        nextAttemptAt: true,
        processingLeaseUntil: true,
      },
    });
    if (!operation) throw new Error('Outbox operation not found: ' + row.operationId);

    if (
      operation.status === 'acknowledged' ||
      operation.status === 'dead_letter' ||
      operation.status === 'resolved'
    ) {
      await prisma.operationOutbox.updateMany({
        where: { id: row.id, dispatchedAt: null },
        data: { dispatchedAt: now },
      });
      continue;
    }

    // A processing operation is recovered by the lease-expiry scan below.
    // Never create a second job while a worker still owns a live lease.
    if (operation.status === 'processing') continue;
    if (operation.status !== 'pending' && operation.status !== 'retry_scheduled') continue;

    const dueAt = operation.nextAttemptAt ?? now;
    const delay = Math.max(0, dueAt.getTime() - now.getTime());

    await queue.add(
      'execute-operation',
      { operationId: operation.operationId, outboxId: row.id },
      {
        jobId: 'operation-outbox-' + row.id,
        delay,
        // Failed delivery is retried from the still-undispatched DB row.
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    dispatched += 1;
  }

  // A process may crash after claiming an operation (and marking its original
  // outbox row) but before acknowledging it. Re-enqueue only after the durable
  // PostgreSQL lease expires. The lease timestamp makes the job ID stable for
  // repeated polls and changes when a subsequent worker claims the operation.
  const expiredLeases = await prisma.syncOperation.findMany({
    where: {
      status: 'processing',
      OR: [
        { processingLeaseUntil: null },
        { processingLeaseUntil: { lte: now } },
      ],
    },
    select: { operationId: true, processingLeaseUntil: true },
    take: batchSize,
  });

  for (const operation of expiredLeases) {
    const leaseKey = operation.processingLeaseUntil
      ? String(operation.processingLeaseUntil.getTime())
      : 'unleased';
    await queue.add(
      'execute-operation',
      { operationId: operation.operationId },
      {
        jobId: 'operation-recovery-' + operation.operationId + '-' + leaseKey,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    dispatched += 1;
  }

  return dispatched;
}

export async function closeOutboxDispatcher(): Promise<void> {
  await queue.close();
}
