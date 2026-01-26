import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Fastify from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import adminSyncRoutes from '../adminSync';
import { getPrismaClient, disconnectPrisma } from '../../lib/prisma';

// Set feature flag
process.env.FEATURE_DEVICE_SYNC = 'true';
process.env.ADMIN_API_KEYS = 'test-admin-key-12345';
process.env.ADMIN_API_ENABLED = 'true';

const prisma = getPrismaClient();

// Test data
let testUserId: string;
let testDeviceId: string;
let testInvoiceId: string;
let testConflictId: string;

describe('Admin Sync Routes - Integration Tests', () => {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  beforeAll(async () => {
    // Register routes
    await app.register(adminSyncRoutes);

    // Create test data
    const user = await prisma.user.create({
      data: {
        name: 'Test Admin User',
        email: 'admin@test.com',
        phone: '+2341234567890',
        password: 'hashedpassword',
        emailVerified: true,
        phoneVerified: true
      }
    });
    testUserId = user.id;

    const device = await prisma.device.create({
      data: {
        deviceId: `test-device-${Date.now()}`,
        platform: 'android',
        userId: testUserId,
        lastHeartbeat: new Date(),
        active: true
      }
    });
    testDeviceId = device.id;

    const invoice = await prisma.invoice.create({
      data: {
        userId: testUserId,
        customerName: 'Test Customer',
        total: 10000,
        taxAmount: 750,
        currency: 'NGN',
        status: 'draft',
        version: 1,
        items: [],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    testInvoiceId = invoice.id;

    const conflict = await prisma.conflict.create({
      data: {
        userId: testUserId,
        deviceId: testDeviceId,
        invoiceId: testInvoiceId,
        entity: 'invoice',
        localData: { version: 1, total: 10000 },
        serverData: { version: 2, total: 12000 },
        clientVersion: 1,
        serverVersion: 2
      }
    });
    testConflictId = conflict.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.conflict.deleteMany({ where: { userId: testUserId } });
    await prisma.invoice.deleteMany({ where: { userId: testUserId } });
    await prisma.syncJob.deleteMany({ where: { userId: testUserId } });
    await prisma.device.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });

    await disconnectPrisma();
    await app.close();
  });

  describe('GET /api/admin/devices', () => {
    it('should reject requests without admin API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/devices'
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should list devices with valid admin API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/devices',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.devices).toBeInstanceOf(Array);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter devices by platform', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/devices?platform=android',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      body.devices.forEach((device: any) => {
        expect(device.platform).toBe('android');
      });
    });

    it('should filter devices by active status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/devices?active=true',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      body.devices.forEach((device: any) => {
        expect(device.active).toBe(true);
      });
    });
  });

  describe('GET /api/admin/sync/pending', () => {
    let testSyncJobId: string;

    beforeAll(async () => {
      const syncJob = await prisma.syncJob.create({
        data: {
          deviceId: testDeviceId,
          userId: testUserId,
          clientId: `test-client-${Date.now()}`,
          entity: 'invoice',
          action: 'create',
          operation: 'push',
          clientVersion: 0,
          payload: { invoiceId: testInvoiceId },
          status: 'pending'
        }
      });
      testSyncJobId = syncJob.id;
    });

    it('should list pending sync jobs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/sync/pending',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.jobs).toBeInstanceOf(Array);
      expect(body.count).toBeGreaterThanOrEqual(1);

      const foundJob = body.jobs.find((j: any) => j.id === testSyncJobId);
      expect(foundJob).toBeDefined();
      expect(foundJob.status).toBe('pending');
    });
  });

  describe('POST /api/admin/device/force-sync', () => {
    it('should reject invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/device/force-sync',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        },
        payload: { deviceId: 'invalid-uuid' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent device', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/device/force-sync',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        },
        payload: {
          deviceId: '00000000-0000-0000-0000-000000000000'
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should initiate force sync for valid device', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/device/force-sync',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        },
        payload: {
          deviceId: testDeviceId,
          reason: 'Testing force sync'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Force sync initiated');
      expect(body.syncJobId).toBeDefined();

      // Verify sync job was created
      const syncJob = await prisma.syncJob.findUnique({
        where: { id: body.syncJobId }
      });
      expect(syncJob).toBeDefined();
      expect(syncJob?.status).toBe('pending');
      expect(syncJob?.action).toBe('force_sync');
    });
  });

  describe('GET /api/admin/audit', () => {
    it('should list audit logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/audit',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.logs).toBeInstanceOf(Array);
      expect(body.pagination).toBeDefined();
    });

    it('should filter audit logs by action', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/audit?action=DEVICE_HEARTBEAT',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('GET /api/admin/conflicts', () => {
    it('should list conflicts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/conflicts',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.conflicts).toBeInstanceOf(Array);
      expect(body.conflicts.length).toBeGreaterThanOrEqual(1);
      
      const foundConflict = body.conflicts.find((c: any) => c.id === testConflictId);
      expect(foundConflict).toBeDefined();
      expect(foundConflict.invoice).toBeDefined();
      expect(foundConflict.device).toBeDefined();
    });

    it('should filter conflicts by resolution status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/conflicts?resolution=unresolved',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      body.conflicts.forEach((conflict: any) => {
        expect(conflict.resolution).toBeNull();
      });
    });
  });

  describe('GET /api/admin/sync/stats', () => {
    it('should return sync statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/sync/stats',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.stats).toBeDefined();
      expect(body.stats.devices).toBeDefined();
      expect(body.stats.syncJobs).toBeDefined();
      expect(body.stats.conflicts).toBeDefined();
      expect(body.stats.recentActivity).toBeDefined();
      
      // Verify structure
      expect(body.stats.devices.total).toBeGreaterThanOrEqual(1);
      expect(body.stats.conflicts.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Feature flag enforcement', () => {
    it('should return 404 when feature flag is disabled', async () => {
      // Temporarily disable feature
      const originalFlag = process.env.FEATURE_DEVICE_SYNC;
      process.env.FEATURE_DEVICE_SYNC = 'false';

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/devices',
        headers: {
          'X-Admin-API-Key': 'test-admin-key-12345'
        }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('disabled');

      // Restore flag
      process.env.FEATURE_DEVICE_SYNC = originalFlag;
    });
  });
});
