/**
 * idempotency preHandler — TaxBridge V13 Sovereign
 *
 * Redis NX key: idem:${X-Idempotency-Key} with 24h TTL.
 * On cache hit: replay cached response (409 for filing duplicates is handled at route level).
 *
 * C-35: idempotency preHandler on nil, vat, wht, cit filings, payroll/run, payments/initiate
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { redis }                        from '../lib/redis';

const IDEMPOTENCY_TTL = 86_400; // 24 hours

export async function idempotency(
  request: FastifyRequest,
  reply:   FastifyReply,
): Promise<void> {
  const key = request.headers['x-idempotency-key'] as string | undefined;
  if (!key) return; // No header — skip (not required for all routes)

  const redisKey = `idem:${key}`;

  // Try to get cached response
  const cached = await redis.get(redisKey).catch(() => null);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      reply.code(parsed.statusCode ?? 200).send(parsed.body);
      return;
    } catch {
      // Malformed cache — fall through
    }
  }

  // Cache the response after the route handler runs
  // Store the key in request so the route can cache after sending
  (request as any).__idempotencyKey = redisKey;
}

/**
 * Helper: called by route handlers after building the response to cache it.
 * Usage: await cacheIdempotencyResponse(request, 201, responseBody)
 */
export async function cacheIdempotencyResponse(
  request:    FastifyRequest,
  statusCode: number,
  body:       unknown,
): Promise<void> {
  const redisKey = (request as any).__idempotencyKey;
  if (!redisKey) return;
  try {
    await redis.setex(redisKey, IDEMPOTENCY_TTL, JSON.stringify({ statusCode, body }));
  } catch {
    // Cache write errors are non-fatal (C-07)
  }
}
