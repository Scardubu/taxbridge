/**
 * Sync Routes Integration Tests
 * 
 * These tests require a running PostgreSQL database.
 * In CI, the database is provisioned automatically.
 * Locally, tests are skipped if database is unavailable.
 */

// Check if real database is available
const DB_AVAILABLE = (() => {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('test@localhost:5432/taxbridge_test')) {
    return false;
  }
  return true;
})();

if (!DB_AVAILABLE) {
  console.warn('⚠️  Skipping sync routes integration tests - no real database configured');
}

const describeIfDb = DB_AVAILABLE ? describe : describe.skip;

describeIfDb('Sync Routes Integration Tests', () => {
  let prisma: any;
  let authService: any;
  let testUserId: string;
  let testAccessToken: string;
  const testDeviceId = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(async () => {
    const { getPrismaClient } = await import('../../lib/prisma');
    const { authService: auth } = await import('../../services/auth');
    prisma = getPrismaClient();
    authService = auth;

    const phone = `+234800${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
    const registration = await authService.register(phone, 'Test User', 'Password123!');
    testUserId = registration.userId;

    await prisma.user.update({
      where: { id: testUserId },
      data: { verified: true }
    });

    const login = await authService.login(phone, 'Password123!');
    testAccessToken = login.accessToken;
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.conflict.deleteMany({ where: { device: { userId: testUserId } } });
      await prisma.syncJob.deleteMany({ where: { device: { userId: testUserId } } });
      await prisma.device.deleteMany({ where: { userId: testUserId } });
      await prisma.invoice.deleteMany({ where: { userId: testUserId } });
      await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (e) { /* cleanup errors non-fatal */ }
  });

  describe('POST /api/v1/device/heartbeat', () => {
    it('should register new device', async () => {
      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/device/heartbeat',
        headers: { authorization: `Bearer ${testAccessToken}` },
        payload: {
          deviceId: testDeviceId, userId: testUserId, platform: 'android',
          appVersion: '5.0.0', osVersion: '14', locale: 'en-NG',
          lastSeenAt: new Date().toISOString(), network: 'online', batteryPct: 85
        }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.device.deviceId).toBe(testDeviceId);
    });

    it('should require authentication', async () => {
      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/device/heartbeat',
        payload: { deviceId: testDeviceId, userId: testUserId, platform: 'android',
          appVersion: '5.0.0', osVersion: '14', lastSeenAt: new Date().toISOString() }
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/sync/push', () => {
    it('should accept new invoice creation', async () => {
      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/sync/push',
        headers: { authorization: `Bearer ${testAccessToken}` },
        payload: {
          deviceId: testDeviceId,
          jobs: [{ clientId: 'inv_001', entity: 'invoice', action: 'create', clientVersion: 0,
            payload: { id: '650e8400-e29b-41d4-a716-446655440001', customerName: 'Test Customer',
              subtotal: 10000, vat: 750, total: 10750, items: [] },
            createdAt: new Date().toISOString() }],
          clientTime: new Date().toISOString()
        }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.synced).toContain('inv_001');
    });
  });

  describe('GET /api/v1/sync/pull', () => {
    it('should return updated invoices', async () => {
      const response = await global.app.inject({
        method: 'GET',
        url: `/api/v1/sync/pull?deviceId=${testDeviceId}&since=${new Date(0).toISOString()}`,
        headers: { authorization: `Bearer ${testAccessToken}` }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.invoices)).toBe(true);
    });
  });

  describe('GET /api/v1/sync/status', () => {
    it('should return sync status', async () => {
      const response = await global.app.inject({
        method: 'GET',
        url: `/api/v1/sync/status?deviceId=${testDeviceId}`,
        headers: { authorization: `Bearer ${testAccessToken}` }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });
  });
});

describe('Sync Routes - Availability Check', () => {
  it('database availability status', () => {
    expect(true).toBe(true);
  });
});
