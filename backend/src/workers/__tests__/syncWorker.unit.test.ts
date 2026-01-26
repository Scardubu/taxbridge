const mockPrisma = {
  syncJob: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  invoice: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  conflict: {
    create: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  }
};

jest.mock('../../lib/prisma', () => ({
  getPrismaClient: () => mockPrisma
}));

describe('processSyncJob', () => {
  let processSyncJob: typeof import('../syncWorker').processSyncJob;

  beforeAll(() => {
    processSyncJob = require('../syncWorker').processSyncJob;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FEATURE_DEVICE_SYNC = 'true';
  });

  it('creates an invoice when none exists', async () => {
    const syncJob = {
      id: 'job-1',
      entity: 'invoice',
      action: 'create',
      clientVersion: 1,
      payload: {
        id: 'inv-1',
        subtotal: 100,
        vat: 10,
        total: 110,
        items: []
      },
      userId: 'user-1',
      deviceId: 'device-1',
      invoiceId: 'inv-1',
      startedAt: null
    };

    mockPrisma.syncJob.findUnique.mockResolvedValue(syncJob);
    mockPrisma.invoice.findUnique.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' });
    mockPrisma.syncJob.update.mockResolvedValue({ id: 'job-1' });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await processSyncJob('job-1');

    expect(result.status).toBe('synced');
    expect(mockPrisma.invoice.create).toHaveBeenCalled();
    expect(mockPrisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'synced' })
      })
    );
  });

  it('creates a conflict when server version is newer', async () => {
    const syncJob = {
      id: 'job-2',
      entity: 'invoice',
      action: 'update',
      clientVersion: 1,
      payload: {
        id: 'inv-2',
        subtotal: 120,
        vat: 12,
        total: 132,
        items: []
      },
      userId: 'user-2',
      deviceId: 'device-2',
      invoiceId: 'inv-2',
      startedAt: null
    };

    mockPrisma.syncJob.findUnique.mockResolvedValue(syncJob);
    mockPrisma.invoice.findUnique.mockResolvedValue({ id: 'inv-2', version: 3 });
    mockPrisma.conflict.create.mockResolvedValue({ id: 'conflict-1' });
    mockPrisma.syncJob.update.mockResolvedValue({ id: 'job-2' });
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await processSyncJob('job-2');

    expect(result.status).toBe('conflict');
    expect(mockPrisma.conflict.create).toHaveBeenCalled();
    expect(mockPrisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-2' },
        data: expect.objectContaining({ status: 'conflict' })
      })
    );
  });
});
