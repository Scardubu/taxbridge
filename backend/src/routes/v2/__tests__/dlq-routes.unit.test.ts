const mockCount = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  prisma: { dLQJob: { count: mockCount, update: mockUpdate } },
}));
jest.mock('../../../plugins/requireRole', () => ({
  requireRole: jest.fn(() => async () => undefined),
}));
jest.mock('../../../plugins/require2FA', () => ({
  require2FA: jest.fn(async (_request: unknown, reply: any) => {
    reply.code(403).send({ error: '2FA_REQUIRED' });
  }),
}));
jest.mock('../../../services/audit', () => ({
  writeAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

import Fastify, { FastifyInstance } from 'fastify';
import dlqRoutes from '../dlq';
import { require2FA } from '../../../plugins/require2FA';

describe('DLQ retry step-up policy', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCount.mockResolvedValue(0);
    mockUpdate.mockResolvedValue({ id: 'job-1' });
    app = Fastify();
    (app as any).decorate('authenticate', async (request: any) => {
      request.user = { userId: 'admin-1', role: 'ADMIN', jti: 'session-1' };
    });
    await app.register(dlqRoutes, { prefix: '/api/v2' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('fails closed when the DLQ depth lookup errors', async () => {
    mockCount.mockRejectedValue(new Error('database unavailable'));

    const response = await app.inject({ method: 'POST', url: '/api/v2/dlq/job-1/retry' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'DLQ_STATE_UNAVAILABLE' });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(require2FA).not.toHaveBeenCalled();
  });

  it('fails closed when the DLQ model or count result is unavailable', async () => {
    mockCount.mockResolvedValue(undefined);

    const response = await app.inject({ method: 'POST', url: '/api/v2/dlq/job-1/retry' });

    expect(response.statusCode).toBe(503);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('requires session-bound step-up when more than ten jobs are failed', async () => {
    mockCount.mockResolvedValue(11);

    const response = await app.inject({ method: 'POST', url: '/api/v2/dlq/job-1/retry' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: '2FA_REQUIRED' });
    expect(require2FA).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('allows a single retry below the threshold without invoking step-up', async () => {
    mockCount.mockResolvedValue(10);

    const response = await app.inject({ method: 'POST', url: '/api/v2/dlq/job-1/retry' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'queued' });
    expect(require2FA).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'RETRYING', retryAt: expect.any(Date) },
    });
  });

  it('returns a dependency error if the retry transition fails', async () => {
    mockCount.mockResolvedValue(1);
    mockUpdate.mockRejectedValue(new Error('database write failed'));

    const response = await app.inject({ method: 'POST', url: '/api/v2/dlq/job-1/retry' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'DLQ_STATE_UNAVAILABLE' });
  });
});
