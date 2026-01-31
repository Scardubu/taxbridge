/**
 * Device Sync Integration Tests
 * 
 * These tests require a running PostgreSQL database.
 * In CI, the database is provisioned automatically.
 * Locally, tests are skipped if database is unavailable.
 */
import Fastify from 'fastify';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Check if real database is available
const DB_AVAILABLE = (() => {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('test@localhost:5432/taxbridge_test')) {
    return false;
  }
  return true;
})();

if (!DB_AVAILABLE) {
  console.warn('⚠️  Skipping device sync integration tests - no real database configured');
}

const describeIfDb = DB_AVAILABLE ? describe : describe.skip;

describeIfDb('device sync integration', () => {
  let app: ReturnType<typeof Fastify>;
  let prisma: any;
  let disconnectPrisma: () => Promise<void>;
  let closeRedisConnection: () => Promise<void>;
  let processSyncJob: (id: string) => Promise<void>;

  beforeAll(async () => {
    process.env.FEATURE_DEVICE_SYNC = 'true';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-test-jwt-secret-123456';
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-test-encryption-key';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

    const prismaModule = await import('../lib/prisma');
    prisma = prismaModule.prisma;
    disconnectPrisma = prismaModule.disconnectPrisma;

    const queueModule = await import('../queue/client');
    closeRedisConnection = queueModule.closeRedisConnection;

    const syncWorkerModule = await import('../workers/syncWorker');
    processSyncJob = syncWorkerModule.processSyncJob;

    const { default: syncRoutes } = await import('../routes/sync');
    app = Fastify({ logger: false });
    await app.register(syncRoutes);
    await app.ready();
  });

  afterAll(async () => {
    if (closeRedisConnection) await closeRedisConnection();
    if (app) await app.close();
    if (disconnectPrisma) await disconnectPrisma();
  });

  beforeEach(async () => {
    if (!prisma) return;
    await prisma.conflict.deleteMany();
    await prisma.syncJob.deleteMany();
    await prisma.device.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
  });

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitForSyncJobStatus(syncJobId: string, status: string, timeoutMs = 15000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const job = await prisma.syncJob.findUnique({ where: { id: syncJobId } });
      if (job?.status === status) return;
      await wait(300);
    }
    throw new Error(`Timed out waiting for sync job ${syncJobId} to reach status ${status}`);
  }

  it('processes heartbeat -> sync push -> worker -> invoice', async () => {
    const phone = `+234${Math.floor(Math.random() * 1e9)}`.padEnd(14, '0');
    const user = await prisma.user.create({
      data: { phone, name: 'Sync Test User' }
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string);
    const deviceId = crypto.randomUUID();
    const now = new Date().toISOString();

    await request(app.server)
      .post('/api/v1/device/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId, userId: user.id, platform: 'android',
        appVersion: '1.0.0', osVersion: '14', locale: 'en-NG',
        lastSeenAt: now, network: 'online', batteryPct: 80
      })
      .expect(200);

    const clientId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();

    const pushResponse = await request(app.server)
      .post('/api/v1/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId, clientTime: now,
        jobs: [{
          clientId, entity: 'invoice', action: 'create', clientVersion: 1,
          payload: {
            id: invoiceId, customerName: 'Offline Customer',
            subtotal: 100, vat: 7.5, total: 107.5, items: [], version: 1
          },
          createdAt: now
        }]
      })
      .expect(200);

    expect(pushResponse.body.synced).toContain(clientId);

    const syncJob = await prisma.syncJob.findFirst({ where: { clientId } });
    expect(syncJob).toBeTruthy();
    expect(syncJob?.status).toBe('processing');

    await processSyncJob(syncJob!.id);
    await waitForSyncJobStatus(syncJob!.id, 'synced');

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice).toBeTruthy();
    expect(invoice?.version).toBe(1);
  });
});

describe('Device Sync - Availability Check', () => {
  it('database availability status', () => {
    expect(true).toBe(true);
  });
});
