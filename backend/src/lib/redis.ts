/**
 * Redis Singleton — TaxBridge V13 Sovereign
 * C-46: No new IORedis anywhere else in backend/src (except services/eventBus.ts for BullMQ Workers).
 *
 * maxRetriesPerRequest: null  — REQUIRED by BullMQ 5
 * enableReadyCheck: false     — Prevents startup delay on cold container
 */
import IORedis from 'ioredis';

const isDocsMode = process.env.TAXBRIDGE_DOCS_MODE === '1';
const shouldSkipRedisConnect = process.env.TAXBRIDGE_SKIP_REDIS_CONNECT === '1';

declare global {
  // eslint-disable-next-line no-var
  var __taxbridge_redis: IORedis | undefined;
}

/**
 * In docs mode, Redis remains lazily connected so importing the singleton never
 * triggers a network call during OpenAPI generation or offline validation.
 */
function createRedisInstance(): IORedis {
  const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: isDocsMode || shouldSkipRedisConnect,
  } as const;

  const instance = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', redisOptions);

  instance.on('error', (err) => {
    process.stderr.write(`[redis] connection error: ${err.message}\n`);
  });

  return instance;
}

// Use cached instance in development to avoid multiple connections during HMR
export const redis: IORedis = globalThis.__taxbridge_redis !== undefined
  ? globalThis.__taxbridge_redis
  : createRedisInstance();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__taxbridge_redis = redis;
}

/**
 * Legacy compat — callers that previously used getRedis() or getRedisConnection()
 */
export function getRedis(): IORedis {
  return redis;
}

process.once('SIGINT',  () => { redis.quit().catch(() => {}); });
process.once('SIGTERM', () => { redis.quit().catch(() => {}); });
