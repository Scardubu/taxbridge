const mockQueueAdd = jest.fn();
const mockQueueClose = jest.fn();
const mockPrisma = {
  operationOutbox: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  syncOperation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
}));
jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../lib/redis', () => ({ redis: {} }));

describe('operation outbox dispatcher', () => {
  let dispatchOutboxBatch: typeof import('../outbox-dispatcher').dispatchOutboxBatch;

  beforeAll(() => {
    ({ dispatchOutboxBatch } = require('../outbox-dispatcher'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue({});
    mockPrisma.operationOutbox.findMany.mockResolvedValue([]);
    mockPrisma.operationOutbox.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.syncOperation.findMany.mockResolvedValue([]);
  });

  it('uses the persisted retry timestamp as the BullMQ delay', async () => {
    const now = Date.now();
    const row = {
      id: 'outbox-1',
      operationId: 'operation-1',
      topic: 'taxbridge.operation.retry.2',
      payload: { operationId: 'operation-1' },
      dispatchedAt: null,
    };
    mockPrisma.operationOutbox.findMany.mockResolvedValue([row]);
    mockPrisma.syncOperation.findUnique.mockResolvedValue({
      operationId: row.operationId,
      status: 'retry_scheduled',
      nextAttemptAt: new Date(now + 10_000),
      processingLeaseUntil: null,
    });

    expect(await dispatchOutboxBatch()).toBe(1);
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    const [, data, options] = mockQueueAdd.mock.calls[0];
    expect(data).toEqual({ operationId: row.operationId, outboxId: row.id });
    expect(options.jobId).toBe('operation-outbox-outbox-1');
    expect(options.delay).toBeGreaterThan(0);
    expect(options.delay).toBeLessThanOrEqual(10_000);
    expect(mockPrisma.operationOutbox.updateMany).not.toHaveBeenCalled();
  });

  it('does not enqueue a retry before its nextAttemptAt', async () => {
    const row = {
      id: 'outbox-2',
      operationId: 'operation-2',
      topic: 'taxbridge.operation.retry.1',
      payload: { operationId: 'operation-2' },
      dispatchedAt: null,
    };
    mockPrisma.operationOutbox.findMany.mockResolvedValue([row]);
    mockPrisma.syncOperation.findUnique.mockResolvedValue({
      operationId: row.operationId,
      status: 'retry_scheduled',
      nextAttemptAt: new Date(Date.now() + 60_000),
      processingLeaseUntil: null,
    });

    await dispatchOutboxBatch();
    const options = mockQueueAdd.mock.calls[0][2];
    expect(options.delay).toBeGreaterThan(0);
  });

  it('marks already terminal operations as consumed without replaying them', async () => {
    const row = {
      id: 'outbox-3',
      operationId: 'operation-3',
      topic: 'taxbridge.operation.crud',
      payload: { operationId: 'operation-3' },
      dispatchedAt: null,
    };
    mockPrisma.operationOutbox.findMany.mockResolvedValue([row]);
    mockPrisma.syncOperation.findUnique.mockResolvedValue({
      operationId: row.operationId,
      status: 'dead_letter',
      nextAttemptAt: null,
      processingLeaseUntil: null,
    });

    expect(await dispatchOutboxBatch()).toBe(0);
    expect(mockQueueAdd).not.toHaveBeenCalled();
    expect(mockPrisma.operationOutbox.updateMany).toHaveBeenCalledWith({
      where: { id: row.id, dispatchedAt: null },
      data: { dispatchedAt: expect.any(Date) },
    });
  });
});
