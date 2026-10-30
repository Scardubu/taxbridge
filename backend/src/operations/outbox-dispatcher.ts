import { Queue } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const QUEUE_NAME = 'taxbridge-operations';
const queue = new Queue(QUEUE_NAME, { connection: redis });

/**
 * At-least-once dispatcher. Deterministic BullMQ job IDs make a repeated
 * dispatch idempotent while retained in Redis. PostgreSQL remains the source
 * of truth; a periodic poll recovers undispatched rows after process crashes.
 */
export async function dispatchOutboxBatch(batchSize = 100): Promise<number> {
  const rows = await prisma.operationOutbox.findMany({
    where: { dispatchedAt: null },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  let dispatched = 0;
  for (const row of rows) {
    const payload = row.payload as { operationId?: string };
    if (!payload.operationId) {
      // Do not mark malformed outbox rows as dispatched. Alerting/repair can
      // inspect the durable row; silently dropping it is forbidden.
      throw new Error(`Malformed outbox payload: ${row.id}`);
    }

    await queue.add('execute-operation', { operationId: payload.operationId }, {
      jobId: `operation-${payload.operationId}-${row.topic.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      removeOnComplete: 500,
      removeOnFail: false,
    });

    await prisma.operationOutbox.updateMany({
      where: { id: row.id, dispatchedAt: null },
      data: { dispatchedAt: new Date() },
    });
    dispatched += 1;
  }
  return dispatched;
}

export async function closeOutboxDispatcher(): Promise<void> {
  await queue.close();
}
