import type { FastifyReply, FastifyRequest } from 'fastify';
import { redis } from '../../lib/redis';
import { computeRequestHash } from '../../lib/idempotency';
import { cacheIdempotencyResponse, idempotency } from '../idempotency';

jest.mock('../../lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    eval: jest.fn(),
  },
}));

function makeRequest(overrides: Record<string, unknown> = {}): FastifyRequest {
  return {
    method: 'POST',
    url: '/api/v1/filings/vat',
    body: { period: '2026-10', outputVAT: 100, inputVAT: 20 },
    headers: { 'x-idempotency-key': 'vat-period-2026-10' },
    user: { userId: 'user-1' },
    orgContext: { orgId: 'org-1' },
    log: { error: jest.fn(), warn: jest.fn() },
    ...overrides,
  } as unknown as FastifyRequest;
}

function makeReply() {
  const reply = {
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply & {
    code: jest.Mock;
    send: jest.Mock;
  };
}

describe('organization-scoped idempotency plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.set as jest.Mock).mockResolvedValue('OK');
    (redis.setex as jest.Mock).mockResolvedValue('OK');
    (redis.eval as jest.Mock).mockResolvedValue(1);
  });

  it('does not require a key for routes where idempotency is optional', async () => {
    const request = makeRequest({ headers: {} });
    const reply = makeReply();
    await idempotency(request, reply);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('rejects requests without an authenticated organization', async () => {
    const request = makeRequest({ orgContext: undefined });
    const reply = makeReply();
    await idempotency(request, reply);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('reserves a namespaced key with NX before allowing the route handler to execute', async () => {
    const request = makeRequest();
    const reply = makeReply();
    await idempotency(request, reply);

    expect(redis.get).toHaveBeenCalledWith('idem:org-1:user-1:vat-period-2026-10');
    expect(redis.set).toHaveBeenCalledWith(
      'idem:org-1:user-1:vat-period-2026-10:lock',
      expect.any(String),
      'EX',
      180,
      'NX',
    );
    expect((request as any).__idempotencyState).toEqual(expect.objectContaining({
      cacheKey: 'idem:org-1:user-1:vat-period-2026-10',
      lockKey: 'idem:org-1:user-1:vat-period-2026-10:lock',
      requestHash: computeRequestHash({
        method: 'POST',
        path: '/api/v1/filings/vat',
        body: { period: '2026-10', outputVAT: 100, inputVAT: 20 },
      }),
    }));
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('replays a cached response for the identical request', async () => {
    const request = makeRequest();
    const reply = makeReply();
    const requestHash = computeRequestHash({
      method: 'POST',
      path: request.url,
      body: request.body,
    });
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify({
      statusCode: 200,
      body: { filingReference: 'VAT-2026-10-123' },
      requestHash,
    }));

    await idempotency(request, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ filingReference: 'VAT-2026-10-123' });
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('rejects reuse of the same key with a different request body', async () => {
    const request = makeRequest({
      body: { period: '2026-10', outputVAT: 900, inputVAT: 20 },
    });
    const reply = makeReply();
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify({
      statusCode: 200,
      body: { filingReference: 'old-result' },
      requestHash: 'f'.repeat(64),
    }));

    await idempotency(request, reply);
    expect(reply.code).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: 'IDEMPOTENCY_KEY_REUSED',
    }));
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('rejects a concurrent request while the original idempotency reservation is active', async () => {
    (redis.set as jest.Mock).mockResolvedValue(null);
    const request = makeRequest();
    const reply = makeReply();

    await idempotency(request, reply);
    expect(redis.get).toHaveBeenCalledTimes(2);
    expect(reply.code).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: 'IDEMPOTENCY_IN_PROGRESS',
      retryable: true,
    }));
  });

  it('fails closed when Redis lookup is unavailable', async () => {
    (redis.get as jest.Mock).mockRejectedValue(new Error('Redis unavailable'));
    const request = makeRequest();
    const reply = makeReply();

    await idempotency(request, reply);
    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: 'IDEMPOTENCY_UNAVAILABLE',
    }));
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('fails closed when the atomic lock cannot be acquired due to a Redis error', async () => {
    (redis.set as jest.Mock).mockRejectedValue(new Error('Redis unavailable'));
    const request = makeRequest();
    const reply = makeReply();

    await idempotency(request, reply);
    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: 'IDEMPOTENCY_UNAVAILABLE',
    }));
  });

  it('stores the request fingerprint before releasing only its own lock', async () => {
    const request = makeRequest();
    const reply = makeReply();
    await idempotency(request, reply);
    const state = (request as any).__idempotencyState;

    await cacheIdempotencyResponse(request, 200, { filingReference: 'VAT-2026-10-123' });

    expect(redis.setex).toHaveBeenCalledWith(
      state.cacheKey,
      86_400,
      JSON.stringify({
        statusCode: 200,
        body: { filingReference: 'VAT-2026-10-123' },
        requestHash: state.requestHash,
      }),
    );
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('GET', KEYS[1])"),
      1,
      state.lockKey,
      state.lockToken,
    );
  });

  it('does not release the reservation if the response cache write fails', async () => {
    const request = makeRequest();
    const reply = makeReply();
    await idempotency(request, reply);
    (redis.setex as jest.Mock).mockRejectedValue(new Error('Redis write failed'));

    await expect(cacheIdempotencyResponse(request, 200, { ok: true })).rejects.toThrow('Redis write failed');
    expect(redis.eval).not.toHaveBeenCalled();
  });
});
