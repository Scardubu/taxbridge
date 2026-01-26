import { getPrismaClient } from '../../lib/prisma';
import { authService } from '../../services/auth';

const prisma = getPrismaClient();

describe('Sync Routes Integration Tests', () => {
  let testUserId: string;
  let testAccessToken: string;
  const testDeviceId = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(async () => {
    // Create test user
    const phone = `+234800${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
    const registration = await authService.register(phone, 'Test User', 'Password123!');
    testUserId = registration.userId;

    // Verify phone (skip OTP in test)
    await prisma.user.update({
      where: { id: testUserId },
      data: { verified: true }
    });

    // Get auth tokens
    const login = await authService.login(phone, 'Password123!');
    testAccessToken = login.accessToken;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.conflict.deleteMany({ where: { device: { userId: testUserId } } });
    await prisma.syncJob.deleteMany({ where: { device: { userId: testUserId } } });
    await prisma.device.deleteMany({ where: { userId: testUserId } });
    await prisma.invoice.deleteMany({ where: { userId: testUserId } });
    await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  describe('POST /api/v1/device/heartbeat', () => {
    it('should register new device', async () => {
      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/device/heartbeat',
        headers: {
          authorization: `Bearer ${testAccessToken}`
        },
        payload: {
          deviceId: testDeviceId,
          userId: testUserId,
          platform: 'android',
          appVersion: '5.0.0',
          osVersion: '14',
          locale: 'en-NG',
          lastSeenAt: new Date().toISOString(),
          network: 'online',
          batteryPct: 85
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.device.deviceId).toBe(testDeviceId);
      expect(body.pendingJobs).toBe(0);
    });

    it('should update existing device', async () => {
      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/device/heartbeat',
        headers: {
          authorization: `Bearer ${testAccessToken}`
        },
        payload: {
          deviceId: testDeviceId,
          userId: testUserId,
          platform: 'android',
          appVersion: '5.0.1',
          osVersion: '14',
          locale: 'en-NG',
          lastSeenAt: new Date().toISOString(),
          network: 'online',
          batteryPct: 75
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.device.platform).toBe('android');
    });

    it('should require authentication', async () => {
      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/device/heartbeat',
        payload: {
          deviceId: testDeviceId,
          userId: testUserId,
          platform: 'android',
          appVersion: '5.0.0',
          osVersion: '14',
          lastSeenAt: new Date().toISOString()
        }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/sync/push', () => {
    it('should accept new invoice creation', async () => {
      const invoiceId = '650e8400-e29b-41d4-a716-446655440001';
      
      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/sync/push',
        headers: {
          authorization: `Bearer ${testAccessToken}`
        },
        payload: {
          deviceId: testDeviceId,
          jobs: [
            {
              clientId: 'inv_001',
              entity: 'invoice',
              action: 'create',
              clientVersion: 0,
              payload: {
                id: invoiceId,
                customerName: 'Test Customer',
                subtotal: 10000,
                vat: 750,
                total: 10750,
                items: []
              },
              createdAt: new Date().toISOString()
            }
          ],
          clientTime: new Date().toISOString()
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.synced).toContain('inv_001');
      expect(body.conflicts).toHaveLength(0);
      expect(body.failed).toHaveLength(0);
    });

    it('should detect version conflicts on update', async () => {
      const invoiceId = '650e8400-e29b-41d4-a716-446655440002';

      // Create invoice directly
      await prisma.invoice.create({
        data: {
          id: invoiceId,
          userId: testUserId,
          customerName: 'Existing Customer',
          subtotal: 5000,
          vat: 375,
          total: 5375,
          items: [],
          version: 2
        }
      });

      // Try to update with older version
      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/sync/push',
        headers: {
          authorization: `Bearer ${testAccessToken}`
        },
        payload: {
          deviceId: testDeviceId,
          jobs: [
            {
              clientId: 'inv_002',
              entity: 'invoice',
              action: 'update',
              clientVersion: 1, // Older than server version
              payload: {
                id: invoiceId,
                customerName: 'Updated Customer',
                subtotal: 6000,
                vat: 450,
                total: 6450,
                items: []
              },
              createdAt: new Date().toISOString()
            }
          ],
          clientTime: new Date().toISOString()
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.conflicts).toContain('inv_002');
      expect(body.synced).toHaveLength(0);
    });

    it('should reject unauthorized device', async () => {
      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/sync/push',
        headers: {
          authorization: `Bearer ${testAccessToken}`
        },
        payload: {
          deviceId: 'unauthorized-device-id',
          jobs: [],
          clientTime: new Date().toISOString()
        }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/sync/pull', () => {
    it('should return updated invoices', async () => {
      const response = await global.app.inject({
        method: 'GET',
        url: `/api/v1/sync/pull?deviceId=${testDeviceId}&since=${new Date(0).toISOString()}`,
        headers: {
          authorization: `Bearer ${testAccessToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.invoices)).toBe(true);
      expect(body.timestamp).toBeDefined();
    });

    it('should require deviceId parameter', async () => {
      const response = await global.app.inject({
        method: 'GET',
        url: '/api/v1/sync/pull',
        headers: {
          authorization: `Bearer ${testAccessToken}`
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/sync/conflicts', () => {
    it('should return unresolved conflicts', async () => {
      const response = await global.app.inject({
        method: 'GET',
        url: `/api/v1/sync/conflicts?deviceId=${testDeviceId}`,
        headers: {
          authorization: `Bearer ${testAccessToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.conflicts)).toBe(true);
    });
  });

  describe('POST /api/v1/sync/conflicts/resolve', () => {
    it('should resolve conflict with server_wins strategy', async () => {
      const invoiceId = '650e8400-e29b-41d4-a716-446655440003';

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          id: invoiceId,
          userId: testUserId,
          customerName: 'Server Customer',
          subtotal: 8000,
          vat: 600,
          total: 8600,
          items: [],
          version: 2
        }
      });

      // Get device
      const device = await prisma.device.findUnique({
        where: { deviceId: testDeviceId }
      });

      // Create conflict
      const conflict = await prisma.conflict.create({
        data: {
          invoiceId,
          deviceId: device!.id,
          localVersion: 1,
          serverVersion: 2,
          localData: { customerName: 'Local Customer' },
          serverData: invoice
        }
      });

      const response = await global.app.inject({
        method: 'POST',
        url: '/api/v1/sync/conflicts/resolve',
        headers: {
          authorization: `Bearer ${testAccessToken}`
        },
        payload: {
          conflictId: conflict.id,
          resolution: 'server_wins'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);

      // Verify conflict is marked as resolved
      const resolvedConflict = await prisma.conflict.findUnique({
        where: { id: conflict.id }
      });
      expect(resolvedConflict?.resolution).toBe('server_wins');
      expect(resolvedConflict?.resolvedAt).toBeTruthy();
    });
  });

  describe('GET /api/v1/sync/status', () => {
    it('should return sync status', async () => {
      const response = await global.app.inject({
        method: 'GET',
        url: `/api/v1/sync/status?deviceId=${testDeviceId}`,
        headers: {
          authorization: `Bearer ${testAccessToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(typeof body.pendingJobs).toBe('number');
      expect(body.lastHeartbeat).toBeDefined();
    });
  });

  describe('Feature flag behavior', () => {
    it('should return 404 when feature is disabled', async () => {
      const originalValue = process.env.FEATURE_DEVICE_SYNC;
      process.env.FEATURE_DEVICE_SYNC = 'false';

      const response = await global.app.inject({
        method: 'GET',
        url: `/api/v1/sync/status?deviceId=${testDeviceId}`,
        headers: {
          authorization: `Bearer ${testAccessToken}`
        }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain('disabled');

      process.env.FEATURE_DEVICE_SYNC = originalValue;
    });
  });
});
