import Fastify, { type FastifyInstance } from 'fastify';

const mockAuditCreate = jest.fn();
const mockIdempotencyCreate = jest.fn();
const mockPrisma = {
  business: { findFirst: jest.fn() },
  auditEvent: { create: mockAuditCreate },
  idempotencyCache: {
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    create: mockIdempotencyCreate,
  },
  $transaction: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import complianceEventRoutes from '../compliance-events';

describe('tenant-scoped compliance event endpoint', () => {
  let app: FastifyInstance;
  const businessId = '33333333-3333-4333-8333-333333333333';
  const eventId = '44444444-4444-4444-8444-444444444444';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.business.findFirst.mockResolvedValue({ id: businessId });
    mockPrisma.idempotencyCache.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyCache.deleteMany.mockResolvedValue({ count: 0 });
    mockAuditCreate.mockResolvedValue({
      id: eventId,
      createdAt: new Date('2026-10-30T12:00:00.000Z'),
    });
    mockIdempotencyCreate.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback({
      auditEvent: { create: mockAuditCreate },
      idempotencyCache: { create: mockIdempotencyCreate },
    }));

    app = Fastify({ logger: false });
    (app as any).decorate('authenticate', async (request: any, reply: any) => {
      if (request.headers.authorization !== 'Bearer user-a') {
        return reply.code(401).send({ error: 'UNAUTHORIZED' });
      }
      request.user = { userId: '11111111-1111-4111-8111-111111111111', role: 'OWNER' };
    });
    (app as any).decorate('resolveOrgContext', async (request: any) => {
      request.orgContext = { orgId: '22222222-2222-4222-8222-222222222222', role: 'OWNER' };
    });
    await app.register(complianceEventRoutes as any);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const requestPayload = {
    event_type: 'tin_verified',
    business_id: businessId,
    metadata: {
      eventType: 'spoofed',
      businessId: 'attacker-controlled',
      source: 'admin',
      description: 'TIN verification completed',
    },
    client_timestamp: '2026-10-30T11:59:00.000Z',
    idempotency_key: 'local-event-000001',
    source: 'mobile',
  };

  it('requires an authenticated principal', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance-events',
      payload: requestPayload,
    });
    expect(response.statusCode).toBe(401);
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('stores the event under the authenticated tenant and protects server-owned metadata', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance-events',
      headers: { authorization: 'Bearer user-a' },
      payload: requestPayload,
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({
      id: eventId,
      logged_at: '2026-10-30T12:00:00.000Z',
    });
    expect(mockPrisma.business.findFirst).toHaveBeenCalledWith({
      where: { id: businessId, organizationId: '22222222-2222-4222-8222-222222222222' },
      select: { id: true },
    });
    const auditCall = mockAuditCreate.mock.calls[0][0];
    expect(auditCall.data).toEqual(expect.objectContaining({
      orgId: '22222222-2222-4222-8222-222222222222',
      userId: '11111111-1111-4111-8111-111111111111',
      action: 'MOBILE_COMPLIANCE_EVENT',
      resource: 'ComplianceEvent',
      metadata: expect.objectContaining({
        eventType: 'tin_verified',
        businessId,
        source: 'mobile',
      }),
    }));
    expect(auditCall.data.metadata.eventType).not.toBe('spoofed');
    expect(auditCall.data.metadata.businessId).not.toBe('attacker-controlled');
  });

  it('rejects business identifiers outside the authenticated organization', async () => {
    mockPrisma.business.findFirst.mockResolvedValue(null);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance-events',
      headers: { authorization: 'Bearer user-a' },
      payload: requestPayload,
    });
    expect(response.statusCode).toBe(404);
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    mockPrisma.idempotencyCache.findUnique.mockResolvedValue({
      createdAt: new Date(),
      requestHash: 'different-hash',
      responseBody: { id: 'old-event', logged_at: '2026-10-30T00:00:00.000Z' },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance-events',
      headers: { authorization: 'Bearer user-a' },
      payload: requestPayload,
    });
    expect(response.statusCode).toBe(409);
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('returns the cached result for an identical retry without a second audit insert', async () => {
    const cachedBody = { id: eventId, logged_at: '2026-10-30T12:00:00.000Z' };
    mockPrisma.idempotencyCache.findUnique.mockResolvedValue({
      createdAt: new Date(),
      requestHash: 'placeholder',
      responseBody: cachedBody,
    });
    // The exact hash is derived from request contents in the handler.
    const { computeRequestHash } = require('../../lib/idempotency');
    mockPrisma.idempotencyCache.findUnique.mockImplementation(async () => ({
      createdAt: new Date(),
      requestHash: computeRequestHash({
        method: 'POST',
        path: '/api/v1/compliance-events',
        body: {
          userId: '11111111-1111-4111-8111-111111111111',
          orgId: '22222222-2222-4222-8222-222222222222',
          event_type: 'tin_verified',
          business_id: businessId,
          metadata: requestPayload.metadata,
          client_timestamp: requestPayload.client_timestamp,
        },
      }),
      responseBody: cachedBody,
    }));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance-events',
      headers: { authorization: 'Bearer user-a' },
      payload: requestPayload,
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(cachedBody);
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});
