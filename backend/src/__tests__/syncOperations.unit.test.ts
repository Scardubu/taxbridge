import Fastify from 'fastify';

const mockPrisma = {
  $transaction: jest.fn(),
  syncOperation: { findUnique: jest.fn(), create: jest.fn() },
  operationOutbox: { create: jest.fn() },
};

jest.mock('../lib/prisma', () => ({ prisma: mockPrisma }));

import syncOperationRoutes from '../routes/syncOperations';

describe('POST /api/v1/sync/operations fail-closed handler gate', () => {
  const previousPipelineFlag = process.env.OPERATION_PIPELINE_ENABLED;
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.OPERATION_PIPELINE_ENABLED = 'true';
    app = Fastify();
    app.decorate('authenticate', async (request: any) => {
      request.user = {
        userId: '4fb24ad5-2dc9-45f7-baa0-1e0038d96b55',
        orgId: 'd48c8d8e-106a-4f70-9501-1cfadd4e2185',
        role: 'OWNER',
        roleVersion: 0,
      };
    });
    app.decorate('resolveOrgContext', async (request: any) => {
      request.orgContext = {
        orgId: 'd48c8d8e-106a-4f70-9501-1cfadd4e2185',
        role: 'OWNER',
        memberId: '8ff8f4f8-8a65-44f4-a9cb-11d1f0cb2bb0',
      };
    });
    await app.register(syncOperationRoutes);
  });

  afterEach(async () => {
    await app.close();
    if (previousPipelineFlag === undefined) {
      delete process.env.OPERATION_PIPELINE_ENABLED;
    } else {
      process.env.OPERATION_PIPELINE_ENABLED = previousPipelineFlag;
    }
  });

  it('does not persist an operation when its worker handler is not registered', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/operations',
      payload: {
        operationId: '4fb24ad5-2dc9-45f7-baa0-1e0038d96b55',
        idempotencyKey: 'mobile-installation-operation-0001',
        operationType: 'sync',
        schemaVersion: 1,
        payload: { clientOperationType: 'INVOICE_SUBMIT', data: { localId: 'draft-1' } },
        createdAt: '2026-11-06T04:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(501);
    expect(response.json()).toMatchObject({
      code: 'OPERATION_HANDLER_NOT_REGISTERED',
      retryable: false,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps the pipeline disabled when the environment flag is false', async () => {
    process.env.OPERATION_PIPELINE_ENABLED = 'false';

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/operations',
      payload: {},
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: 'OPERATION_PIPELINE_DISABLED',
      retryable: true,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
