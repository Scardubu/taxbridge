/**
 * Redis Singleton — TaxBridge V13 Sovereign
 * C-46: No new IORedis anywhere else in backend/src (except services/eventBus.ts for BullMQ Workers).
 *
 * maxRetriesPerRequest: null  — REQUIRED by BullMQ 5
 * enableReadyCheck: false     — Prevents startup delay on cold container
 */
import IORedis from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var __taxbridge_redis: IORedis | undefined;
}

export const redis: IORedis = globalThis.__taxbridge_redis ?? new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,   // REQUIRED by BullMQ 5 — do not remove
  enableReadyCheck:     false,  // Prevents startup delay on cold container
  lazyConnect:          false,
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__taxbridge_redis = redis;
}

redis.on('error', (err) => {
  process.stderr.write(`[redis] connection error: ${err.message}\n`);
});

// createWorkerConnection() provides dedicated connections for BullMQ Workers
export function createWorkerConnection(): IORedis {
  return new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck:     false,
  });
}

/**
 * Legacy compat — callers that previously used getRedis() or getRedisConnection()
 */
export function getRedis(): IORedis {
  return redis;
}

process.once('SIGINT',  () => { redis.quit().catch(() => {}); });
process.once('SIGTERM', () => { redis.quit().catch(() => {}); });
