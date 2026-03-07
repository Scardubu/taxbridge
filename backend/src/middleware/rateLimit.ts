/**
 * TaxBridge — Rate Limiting Middleware (Fastify)
 *
 * Per-route rate limiting using Redis sliding windows.
 * Falls back to in-memory Map when Redis is unavailable (dev/test).
 *
 * Usage:
 *   app.post('/api/v1/auth/login', {
 *     preHandler: [rateLimit({ max: 10, windowMs: 60_000 })],
 *   }, handler);
 *
 * C-07: Returns 429 with Retry-After header, never 500.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRedisConnection } from '../queue/client';
import { createLogger } from '../lib/logger';

const log = createLogger('rate-limit');

// In-memory fallback for when Redis is unavailable
const memoryStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  /** Maximum requests per window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Key prefix (defaults to route path) */
  keyPrefix?: string;
  /** Custom key generator (defaults to IP-based) */
  keyGenerator?: (request: FastifyRequest) => string;
  /** GAP-09: always true — X-RateLimit-* headers on every response */
  standardHeaders: true;
  /** Legacy X-RateLimit headers disabled */
  legacyHeaders: false;
}

/**
 * Factory: returns a Fastify preHandler that rate-limits requests.
 *
 * Sets standard rate limit headers:
 *   X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
export function rateLimit(opts: RateLimitOptions) {
  const { max, windowMs, keyPrefix, keyGenerator } = opts;

  return async function rateLimitHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const key = keyGenerator
      ? keyGenerator(request)
      : `${keyPrefix || request.routeOptions?.url || request.url}:${request.ip}`;

    const redisKey = `rl:${key}`;
    const redis = getRedisConnection();

    let count: number;
    let resetAt: number;

    if (redis) {
      try {
        const windowSec = Math.ceil(windowMs / 1000);
        const current = await redis.incr(redisKey);

        if (current === 1) {
          await redis.expire(redisKey, windowSec);
        }

        const ttl = await redis.ttl(redisKey);
        count = current;
        resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
      } catch (err) {
        log.warn('Redis rate limit error, falling back to memory', { error: err });
        ({ count, resetAt } = memoryIncrement(redisKey, windowMs));
      }
    } else {
      ({ count, resetAt } = memoryIncrement(redisKey, windowMs));
    }

    const remaining = Math.max(0, max - count);
    const resetSec = Math.ceil((resetAt - Date.now()) / 1000);

    // standardHeaders: true — always set X-RateLimit-* on every response (GAP-09)
    reply.header('X-RateLimit-Limit', String(max));
    reply.header('X-RateLimit-Remaining', String(remaining));
    reply.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      reply.header('Retry-After', String(resetSec));
      log.warn('Rate limit exceeded', { key, count, max });
      return reply.code(429).send({
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: resetSec,
      });
    }
  };
}

function memoryIncrement(key: string, windowMs: number): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { count: 1, resetAt };
  }

  entry.count++;
  return { count: entry.count, resetAt: entry.resetAt };
}

// Periodic cleanup of stale memory entries (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 60_000).unref();

/**
 * C-30: Dedicated auth rate limiter — 10 requests per 15-minute window per IP.
 * Applied to POST /login and other sensitive auth endpoints.
 */
export const authRateLimit = rateLimit({
  max: 10,
  windowMs: 15 * 60_000,
  keyPrefix: 'auth:login',
  standardHeaders: true,
  legacyHeaders: false,
});
