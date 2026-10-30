/**
 * Redis-backed idempotency guard for authenticated organization-scoped writes.
 *
 * A request fingerprint prevents a client from reusing a key for another
 * payload. A short-lived NX lock prevents concurrent requests from executing
 * the same side effect before the first response is durably cached.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../lib/redis';
import { computeRequestHash } from '../lib/idempotency';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const IDEMPOTENCY_LOCK_TTL_SECONDS = 180;

const RELEASE_LOCK_SCRIPT = \`
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
\`;

interface CachedResponse {
  statusCode: number;
  body: unknown;
  requestHash: string;
}

interface IdempotencyRequestState {
  cacheKey: string;
  lockKey: string;
  lockToken: string;
  requestHash: string;
}

function sendCachedOrConflict(
  reply: FastifyReply,
  cached: string,
  requestHash: string,
): void {
  let parsed: CachedResponse;
  try {
    parsed = JSON.parse(cached) as CachedResponse;
  } catch {
    reply.code(503).send({
      error: 'IDEMPOTENCY_CACHE_CORRUPT',
      retryable: true,
    });
    return;
  }

  if (
    typeof parsed.requestHash !== 'string' ||
    parsed.requestHash.length !== 64 ||
    parsed.requestHash !== requestHash
  ) {
    reply.code(409).send({
      error: 'IDEMPOTENCY_KEY_REUSED',
      message: 'This idempotency key was already used for a different request.',
      retryable: false,
    });
    return;
  }

  if (!Number.isInteger(parsed.statusCode) || parsed.statusCode < 200 || parsed.statusCode > 599) {
    reply.code(503).send({
      error: 'IDEMPOTENCY_CACHE_CORRUPT',
      retryable: true,
    });
    return;
  }

  reply.code(parsed.statusCode).send(parsed.body);
}

export async function idempotency(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers['x-idempotency-key'];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) return;

  if (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    reply.code(400).send({ error: 'INVALID_IDEMPOTENCY_KEY' });
    return;
  }

  const userId = request.user?.userId;
  const orgId = (request as FastifyRequest & { orgContext?: { orgId?: string } }).orgContext?.orgId;
  if (!userId || !orgId) {
    reply.code(401).send({ error: 'IDEMPOTENCY_REQUIRES_AUTHENTICATED_ORG' });
    return;
  }

  const cacheKey = 'idem:' + orgId + ':' + userId + ':' + key;
  const lockKey = cacheKey + ':lock';
  const requestHash = computeRequestHash({
    method: request.method,
    path: request.url,
    body: request.body,
  });

  let cached: string | null;
  try {
    cached = await redis.get(cacheKey);
  } catch (error) {
    request.log.error({ err: error }, 'Idempotency cache lookup failed');
    reply.code(503).send({ error: 'IDEMPOTENCY_UNAVAILABLE', retryable: true });
    return;
  }

  if (cached !== null) {
    sendCachedOrConflict(reply, cached, requestHash);
    return;
  }

  const lockToken = randomUUID();
  let lockResult: string | null;
  try {
    lockResult = await redis.set(
      lockKey,
      lockToken,
      'EX',
      IDEMPOTENCY_LOCK_TTL_SECONDS,
      'NX',
    );
  } catch (error) {
    request.log.error({ err: error }, 'Idempotency reservation failed');
    reply.code(503).send({ error: 'IDEMPOTENCY_UNAVAILABLE', retryable: true });
    return;
  }

  if (lockResult !== 'OK') {
    // The first request may have completed between our cache miss and lock
    // attempt. Re-read once so a completed request is replayed immediately.
    try {
      cached = await redis.get(cacheKey);
    } catch (error) {
      request.log.error({ err: error }, 'Idempotency cache recheck failed');
      reply.code(503).send({ error: 'IDEMPOTENCY_UNAVAILABLE', retryable: true });
      return;
    }

    if (cached !== null) {
      sendCachedOrConflict(reply, cached, requestHash);
      return;
    }

    reply.code(409).send({
      error: 'IDEMPOTENCY_IN_PROGRESS',
      message: 'An identical operation is already being processed.',
      retryable: true,
    });
    return;
  }

  (request as FastifyRequest & { __idempotencyState?: IdempotencyRequestState })
    .__idempotencyState = { cacheKey, lockKey, lockToken, requestHash };
}

/**
 * Called after the domain side effect commits. The cached response is written
 * before releasing the lock, so a retry can never pass between those steps.
 */
export async function cacheIdempotencyResponse(
  request: FastifyRequest,
  statusCode: number,
  body: unknown,
): Promise<void> {
  const state = (request as FastifyRequest & {
    __idempotencyState?: IdempotencyRequestState;
  }).__idempotencyState;
  if (!state) return;

  await redis.setex(
    state.cacheKey,
    IDEMPOTENCY_TTL_SECONDS,
    JSON.stringify({ statusCode, body, requestHash: state.requestHash }),
  );

  try {
    await redis.eval(RELEASE_LOCK_SCRIPT, 1, state.lockKey, state.lockToken);
  } catch (error) {
    // Leave the lock to expire naturally. This is safer than releasing a
    // reservation when the cache-write/lock-release outcome is uncertain.
    request.log.warn({ err: error }, 'Idempotency lock release deferred to TTL');
  }
}
