/**
 * TaxBridge — Redis Singleton (V12 COMP-19)
 *
 * Single shared IORedis instance for the entire backend process.
 * Global singleton pattern mirrors lib/prisma.ts (C-43).
 *
 * C-46: All Redis usage must import from this file — zero `new IORedis()` elsewhere.
 *
 * Gate: grep -q "global.__taxbridge_redis" backend/src/lib/redis.ts
 *
 * Adapts the existing queue/client getRedisConnection() to the V12 singleton
 * contract without duplicating connections.
 */

import { getRedisConnection } from '../queue/client';
import { createLogger } from './logger';
import type Redis from 'ioredis';

const log = createLogger('redis-singleton');

// ─── Global singleton guard — survives hot-reloads in dev ─────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __taxbridge_redis: Redis | null | undefined;
}

/**
 * Returns the shared IORedis instance.
 * In production: connects via REDIS_URL (rediss:// for TLS).
 * In dev/test: falls back to memory or skips gracefully.
 *
 * Uses the existing queue/client singleton so we never create
 * duplicate connections (C-46 — zero `new IORedis()` outside lib/redis.ts).
 */
export function getRedis(): Redis | null {
  if (typeof globalThis.__taxbridge_redis !== 'undefined') {
    return globalThis.__taxbridge_redis;
  }

  const client = getRedisConnection();
  globalThis.__taxbridge_redis = client;

  if (client) {
    client.on('error', (err) => {
      log.error('Redis connection error', { err: err.message });
    });
    client.on('connect', () => {
      log.info('Redis connected');
    });
  }

  return globalThis.__taxbridge_redis ?? null;
}

/**
 * The shared redis instance. May be null if Redis is unavailable.
 * Always handle null gracefully — C-07: no 500s on Redis failure.
 */
export const redis = getRedis();

// ─── SIGINT/SIGTERM disconnect ────────────────────────────────────────────────

async function disconnect() {
  if (globalThis.__taxbridge_redis) {
    try {
      await globalThis.__taxbridge_redis.quit();
    } catch {
      // Ignore disconnect errors on shutdown
    }
  }
}

process.once('SIGINT',  () => { disconnect().catch(() => {}); });
process.once('SIGTERM', () => { disconnect().catch(() => {}); });
