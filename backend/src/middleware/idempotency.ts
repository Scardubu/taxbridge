/**
 * TaxBridge — Idempotency Middleware (Fastify)
 *
 * C-35: Accept X-Idempotency-Key header for POST/PATCH/PUT requests.
 * Uses Redis SET NX with 24h TTL to prevent duplicate processing.
 *
 * Usage:
 *   app.post('/api/v1/invoices', {
 *     preHandler: [authenticate, idempotency()],
 *   }, handler);
 *
 * Flow:
 *   1. Client sends X-Idempotency-Key: <uuid>
 *   2. Middleware checks Redis: SET NX idempotency:{key} → if exists, return cached response
 *   3. After handler completes, store response in Redis with 24h TTL
 *
 * C-01: Uses `any` for Prisma types.
 * C-07: If Redis is unavailable, proceed without idempotency (log warning).
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRedisConnection } from '../queue/client';
import { createLogger } from '../lib/logger';

const log = createLogger('idempotency');

const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours
const IDEMPOTENCY_HEADER = 'x-idempotency-key';

interface IdempotencyOptions {
  /** Whether the header is required (defaults to false — optional) */
  required?: boolean;
}

/**
 * Factory: returns a Fastify preHandler that enforces idempotency.
 */
export function idempotency(opts: IdempotencyOptions = {}) {
  const { required = false } = opts;

  return async function idempotencyHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Only applies to mutating methods
    const method = request.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return;
    }

    const key = request.headers[IDEMPOTENCY_HEADER] as string | undefined;

    if (!key) {
      if (required) {
        return reply.code(400).send({
          success: false,
          error: 'X-Idempotency-Key header is required for this operation',
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        });
      }
      // Not required — skip idempotency check
      return;
    }

    // Validate key format (should be UUID-like, max 128 chars)
    if (key.length > 128 || !/^[\w-]+$/.test(key)) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid X-Idempotency-Key format',
        code: 'IDEMPOTENCY_KEY_INVALID',
      });
    }

    const redis = getRedisConnection();
    if (!redis) {
      log.warn('Redis unavailable — skipping idempotency check');
      return;
    }

    const redisKey = `idempotency:${key}`;

    try {
      const cached = await redis.get(redisKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        log.info('Returning cached idempotent response', { key });
        reply.code(parsed.statusCode || 200);
        return reply.send(parsed.body);
      }

      // Mark as in-flight (lock with NX + short TTL to handle crashes)
      await redis.set(redisKey, JSON.stringify({ status: 'processing' }), 'EX', 300, 'NX');

      // Store the key on request for the response hook to cache the final result
      (request as any).__idempotencyKey = redisKey;
    } catch (err) {
      log.warn('Idempotency check failed — proceeding without', { error: err });
    }
  };
}

/**
 * Fastify onSend hook to cache the response for idempotent requests.
 *
 * Register once on the app instance:
 *   app.addHook('onSend', cacheIdempotentResponse);
 */
export async function cacheIdempotentResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: string,
): Promise<string> {
  const redisKey = (request as any).__idempotencyKey as string | undefined;
  if (!redisKey) return payload;

  const redis = getRedisConnection();
  if (!redis) return payload;

  try {
    const cached = {
      statusCode: reply.statusCode,
      body: JSON.parse(payload),
    };
    await redis.set(redisKey, JSON.stringify(cached), 'EX', IDEMPOTENCY_TTL_SECONDS);
  } catch (err) {
    log.warn('Failed to cache idempotent response', { error: err });
  }

  return payload;
}
