import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '../lib/prisma';
import { requireAdminApiKey } from '../lib/security';
import { createLogger } from '../lib/logger';
import { enqueueDeviceSync } from '../queue/client';

const log = createLogger('admin-sync-routes');
const prisma = getPrismaClient();

// Feature flag check
function isDeviceSyncEnabled(): boolean {
  return String(process.env.FEATURE_DEVICE_SYNC || 'false').toLowerCase() === 'true';
}

// Validation schemas
const ForceSyncSchema = z.object({
  deviceId: z.string().uuid(),
  reason: z.string().optional()
});

export default async function adminSyncRoutes(app: FastifyInstance) {
  // Admin authentication middleware
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAdminApiKey(request, reply);
    if (reply.sent) {
      return reply;
    }
  });

  // GET /api/admin/devices - List all devices with status
  app.get('/api/admin/devices', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const { page = '1', limit = '50', platform, active } = request.query as {
        page?: string;
        limit?: string;
        platform?: string;
        active?: string;
      };

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (platform) where.platform = platform;
      if (active !== undefined) where.active = active === 'true';

      const [devices, total] = await Promise.all([
        prisma.device.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            _count: {
              select: {
                syncJobs: true,
                conflicts: true
              }
            }
          },
          orderBy: { lastHeartbeat: 'desc' },
          skip,
          take: limitNum
        }),
        prisma.device.count({ where })
      ]);

      return reply.send({
        success: true,
        devices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error: any) {
      log.error('Admin devices list error', { error: error.message });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/admin/sync/pending - List pending sync jobs
  app.get('/api/admin/sync/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const { limit = '100', status } = request.query as {
        limit?: string;
        status?: string;
      };

      const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));

      const where: any = {};
      if (status) {
        where.status = status;
      } else {
        where.status = { in: ['pending', 'processing'] };
      }

      const jobs = await prisma.syncJob.findMany({
        where,
        include: {
          device: {
            select: {
              id: true,
              deviceId: true,
              platform: true,
              userId: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limitNum
      });

      return reply.send({
        success: true,
        jobs,
        count: jobs.length
      });
    } catch (error: any) {
      log.error('Admin pending sync jobs error', { error: error.message });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/admin/device/force-sync - Force sync for a device
  app.post('/api/admin/device/force-sync', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const body = ForceSyncSchema.parse(request.body);

      // Verify device exists
      const device = await prisma.device.findUnique({
        where: { id: body.deviceId },
        include: { user: true }
      });

      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Create admin action record
      await prisma.adminAction.create({
        data: {
          adminId: device.userId, // In production, use actual admin user ID
          action: 'force_sync',
          targetId: device.id,
          targetType: 'device',
          metadata: {
            deviceId: device.deviceId,
            platform: device.platform,
            reason: body.reason || 'Admin-initiated force sync'
          }
        }
      });

      // Create a sync job to trigger sync
      const syncJob = await prisma.syncJob.create({
        data: {
          deviceId: device.id,
          userId: device.userId,
          clientId: `admin-force-sync-${Date.now()}`,
          entity: 'system',
          action: 'force_sync',
          operation: 'push',
          clientVersion: 0,
          payload: {
            adminInitiated: true,
            reason: body.reason
          },
          status: 'pending'
        }
      });

      // Enqueue notification
      await enqueueDeviceSync(syncJob.id);

      log.info('Force sync initiated', { 
        deviceId: device.id,
        userId: device.userId,
        syncJobId: syncJob.id
      });

      return reply.send({
        success: true,
        message: 'Force sync initiated',
        syncJobId: syncJob.id
      });
    } catch (error: any) {
      log.error('Force sync error', { error: error.message });
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Invalid request data' });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/admin/audit - Get audit logs for sync operations
  app.get('/api/admin/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const { page = '1', limit = '100', action, userId } = request.query as {
        page?: string;
        limit?: string;
        action?: string;
        userId?: string;
      };

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        action: {
          in: [
            'DEVICE_HEARTBEAT',
            'device_sync_invoice_created',
            'device_sync_invoice_updated',
            'device_sync_notification_queued'
          ]
        }
      };

      if (action) where.action = action;
      if (userId) where.userId = userId;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum
        }),
        prisma.auditLog.count({ where })
      ]);

      return reply.send({
        success: true,
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error: any) {
      log.error('Admin audit logs error', { error: error.message });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/admin/conflicts - List all conflicts
  app.get('/api/admin/conflicts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const { page = '1', limit = '50', resolution, userId } = request.query as {
        page?: string;
        limit?: string;
        resolution?: string;
        userId?: string;
      };

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (resolution) {
        if (resolution === 'unresolved') {
          where.resolution = null;
        } else {
          where.resolution = resolution;
        }
      }
      if (userId) where.userId = userId;

      const [conflicts, total] = await Promise.all([
        prisma.conflict.findMany({
          where,
          include: {
            invoice: {
              select: {
                id: true,
                customerName: true,
                total: true,
                status: true,
                createdAt: true,
                updatedAt: true
              }
            },
            device: {
              select: {
                id: true,
                deviceId: true,
                platform: true,
                userId: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum
        }),
        prisma.conflict.count({ where })
      ]);

      return reply.send({
        success: true,
        conflicts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error: any) {
      log.error('Admin conflicts list error', { error: error.message });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/admin/conflicts/resolve - Admin-only conflict resolution
  app.post('/api/admin/conflicts/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const ResolutionSchema = z.object({
        conflictId: z.string().uuid(),
        resolution: z.enum(['local_wins', 'server_wins', 'merged']),
        mergedData: z.record(z.string(), z.unknown()).optional(),
        adminReason: z.string().min(10, 'Admin reason must be at least 10 characters'),
        adminUserId: z.string().min(1, 'Admin user ID required')
      });

      const body = ResolutionSchema.parse(request.body);

      // Find conflict with full context
      const conflict = await prisma.conflict.findUnique({
        where: { id: body.conflictId },
        include: {
          device: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          },
          invoice: true
        }
      });

      if (!conflict) {
        return reply.status(404).send({ error: 'Conflict not found' });
      }

      if (conflict.resolution) {
        return reply.status(400).send({ error: 'Conflict already resolved' });
      }

      // Determine final data based on resolution strategy
      let finalData: any;
      let resolutionStatus: string;

      if (body.resolution === 'local_wins') {
        finalData = conflict.localData;
        resolutionStatus = 'RESOLVED_CLIENT';
      } else if (body.resolution === 'server_wins') {
        finalData = conflict.serverData;
        resolutionStatus = 'RESOLVED_SERVER';
      } else if (body.resolution === 'merged' && body.mergedData) {
        // Validate merged data has required fields
        const requiredFields = ['subtotal', 'vat', 'total'];
        const missingFields = requiredFields.filter(f => !(f in body.mergedData!));
        
        if (missingFields.length > 0) {
          return reply.status(400).send({ 
            error: `Merged data missing required fields: ${missingFields.join(', ')}` 
          });
        }
        
        finalData = body.mergedData;
        resolutionStatus = 'RESOLVED_MANUAL';
      } else {
        return reply.status(400).send({ error: 'Invalid resolution or missing mergedData' });
      }

      // Transaction: Update invoice, mark conflict resolved, create admin action audit
      const result = await prisma.$transaction(async (tx) => {
        // Update invoice with resolved data
        const updatedInvoice = await tx.invoice.update({
          where: { id: conflict.invoiceId },
          data: {
            ...finalData,
            version: { increment: 1 }
          }
        });

        // Mark conflict as resolved
        const resolvedConflict = await tx.conflict.update({
          where: { id: body.conflictId },
          data: {
            resolution: body.resolution,
            status: resolutionStatus,
            resolvedAt: new Date()
          }
        });

        // Create admin action audit record
        const adminAction = await tx.adminAction.create({
          data: {
            action: 'CONFLICT_RESOLVE',
            targetType: 'conflict',
            targetId: body.conflictId,
            adminId: body.adminUserId,
            metadata: {
              reason: body.adminReason,
              conflictId: body.conflictId,
              invoiceId: conflict.invoiceId,
              deviceId: conflict.device.deviceId,
              userId: conflict.device.userId,
              userName: conflict.device.user.name,
              resolution: body.resolution,
              status: resolutionStatus,
              localVersion: conflict.localVersion,
              serverVersion: conflict.serverVersion,
              localData: conflict.localData,
              serverData: conflict.serverData,
              finalData: finalData
            }
          }
        });

        return { updatedInvoice, resolvedConflict, adminAction };
      });

      log.info('Admin conflict resolution', {
        conflictId: body.conflictId,
        resolution: body.resolution,
        adminUserId: body.adminUserId,
        deviceId: conflict.device.deviceId,
        userId: conflict.device.userId
      });

      return reply.send({
        success: true,
        message: 'Conflict resolved successfully',
        invoiceId: result.updatedInvoice.id,
        invoiceVersion: result.updatedInvoice.version,
        auditId: result.adminAction.id
      });
    } catch (error: any) {
      log.error('Admin conflict resolution error', { error: error.message, stack: error.stack });
      
      if (error.name === 'ZodError') {
        return reply.status(400).send({ 
          error: 'Validation failed', 
          details: error.errors 
        });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/admin/sync/stats - Get sync statistics
  app.get('/api/admin/sync/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const [
        totalDevices,
        activeDevices,
        totalSyncJobs,
        pendingSyncJobs,
        processingSyncJobs,
        syncedJobs,
        failedJobs,
        conflictJobs,
        totalConflicts,
        unresolvedConflicts
      ] = await Promise.all([
        prisma.device.count(),
        prisma.device.count({ where: { active: true } }),
        prisma.syncJob.count(),
        prisma.syncJob.count({ where: { status: 'pending' } }),
        prisma.syncJob.count({ where: { status: 'processing' } }),
        prisma.syncJob.count({ where: { status: 'synced' } }),
        prisma.syncJob.count({ where: { status: 'failed' } }),
        prisma.syncJob.count({ where: { status: 'conflict' } }),
        prisma.conflict.count(),
        prisma.conflict.count({ where: { resolution: null } })
      ]);

      // Platform breakdown
      const platformBreakdown = await prisma.device.groupBy({
        by: ['platform'],
        _count: { platform: true },
        where: { active: true }
      });

      // Recent sync activity (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentActivity = await prisma.syncJob.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { createdAt: { gte: oneDayAgo } }
      });

      return reply.send({
        success: true,
        stats: {
          devices: {
            total: totalDevices,
            active: activeDevices,
            byPlatform: platformBreakdown.map(p => ({
              platform: p.platform,
              count: p._count.platform
            }))
          },
          syncJobs: {
            total: totalSyncJobs,
            pending: pendingSyncJobs,
            processing: processingSyncJobs,
            synced: syncedJobs,
            failed: failedJobs,
            conflict: conflictJobs
          },
          conflicts: {
            total: totalConflicts,
            unresolved: unresolvedConflicts,
            resolved: totalConflicts - unresolvedConflicts
          },
          recentActivity: recentActivity.map(a => ({
            status: a.status,
            count: a._count.status
          }))
        }
      });
    } catch (error: any) {
      log.error('Admin sync stats error', { error: error.message });
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
