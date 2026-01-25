import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { getPrismaClient } from '../lib/prisma';
import { HeartbeatSchema, PushSyncSchema } from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';
import { enqueueInvoiceSync } from '../queue/client';

const log = createLogger('sync-routes');
const prisma = getPrismaClient();

// Feature flag check
function isDeviceSyncEnabled(): boolean {
  return String(process.env.FEATURE_DEVICE_SYNC || 'false').toLowerCase() === 'true';
}

// Manual JWT authentication helper (matches pattern from invoices route)
async function authenticate(request: FastifyRequest): Promise<string> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  const secrets = [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS].filter(Boolean) as string[];

  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret) as { userId?: string };
      if (!decoded.userId) {
        throw new Error('Invalid token payload');
      }
      return decoded.userId;
    } catch (err) {
      if (secret === secrets[secrets.length - 1]) {
        throw new Error('Invalid or expired token');
      }
    }
  }

  throw new Error('Invalid or expired token');
}

// Conflict resolution schema
const ConflictResolutionSchema = z.object({
  conflictId: z.string().uuid(),
  resolution: z.enum(['local_wins', 'server_wins', 'merged']),
  mergedData: z.record(z.string(), z.any()).optional()
});

export default async function syncRoutes(app: FastifyInstance) {
  // POST /api/v1/device/heartbeat - Register/update device presence
  app.post('/api/v1/device/heartbeat', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = await authenticate(request);
      const body = HeartbeatSchema.parse(request.body);

      // Upsert device record
      const now = new Date();
      const device = await prisma.device.upsert({
        where: { deviceId: body.deviceId },
        update: {
          platform: body.platform,
          osVersion: body.osVersion || null,
          appVersion: body.appVersion,
          lastSeenAt: now,
          lastHeartbeat: now,
          active: true
        },
        create: {
          userId,
          deviceId: body.deviceId,
          platform: body.platform,
          osVersion: body.osVersion || null,
          appVersion: body.appVersion,
          lastSeenAt: now,
          lastHeartbeat: now,
          active: true
        }
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          action: 'DEVICE_HEARTBEAT',
          userId,
          metadata: {
            deviceId: body.deviceId,
            platform: body.platform,
            appVersion: body.appVersion,
            network: body.network,
            batteryPct: body.batteryPct
          }
        }
      });

      // Count pending jobs for this device
      const pendingJobs = await prisma.syncJob.count({
        where: {
          deviceId: device.id,
          status: 'pending'
        }
      });

      log.info('Device heartbeat received', { userId, deviceId: body.deviceId, pendingJobs });

      return reply.send({
        success: true,
        device: {
          id: device.id,
          deviceId: device.deviceId,
          platform: device.platform,
          lastHeartbeat: device.lastHeartbeat
        },
        pendingJobs
      });
    } catch (error: any) {
      log.error('Heartbeat error', { error: error.message });
      
      if (error.message.includes('authorization') || error.message.includes('token')) {
        return reply.status(403).send({ error: error.message });
      }
      
      return reply.status(400).send({ error: error.message });
    }
  });

  // POST /api/v1/sync/push - Upload local changes with conflict detection
  app.post('/api/v1/sync/push', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = await authenticate(request);
      const body = PushSyncSchema.parse(request.body);

      // Verify device ownership
      const device = await prisma.device.findUnique({
        where: { deviceId: body.deviceId }
      });

      if (!device || device.userId !== userId) {
        return reply.status(403).send({ error: 'Device not found or unauthorized' });
      }

      const results = {
        synced: [] as string[],
        conflicts: [] as string[],
        failed: [] as string[]
      };

      // Process each sync job
      for (const job of body.jobs) {
        try {
          // Create SyncJob audit record
          const syncJob = await prisma.syncJob.create({
            data: {
              deviceId: device.id,
              userId,
              invoiceId: job.entity === 'invoice' ? (job.payload.id as string) : null,
              clientId: job.clientId,
              entity: job.entity,
              action: job.action,
              operation: 'push',
              clientVersion: job.clientVersion,
              payload: job.payload,
              status: 'pending',
              startedAt: new Date()
            }
          });

          // Handle invoice entity
          if (job.entity === 'invoice') {
            const invoiceId = job.payload.id as string;

            if (job.action === 'create') {
              // Check if invoice already exists
              const existing = await prisma.invoice.findUnique({
                where: { id: invoiceId }
              });

              if (existing) {
                // Conflict: invoice already exists
                await prisma.conflict.create({
                  data: {
                    invoiceId,
                    userId,
                    deviceId: device.id,
                    localVersion: job.clientVersion,
                    serverVersion: existing.version,
                    localData: job.payload,
                    serverData: existing as any
                  }
                });

                await prisma.syncJob.update({
                  where: { id: syncJob.id },
                  data: { status: 'conflict' }
                });

                results.conflicts.push(job.clientId);
                continue;
              }

              // Enqueue for worker processing
              await enqueueInvoiceSync(syncJob.id);
              
              await prisma.syncJob.update({
                where: { id: syncJob.id },
                data: { status: 'processing' }
              });

              results.synced.push(job.clientId);
            } else if (job.action === 'update') {
              const existing = await prisma.invoice.findUnique({
                where: { id: invoiceId }
              });

              if (!existing) {
                results.failed.push(job.clientId);
                await prisma.syncJob.update({
                  where: { id: syncJob.id },
                  data: { 
                    status: 'failed',
                    result: { error: 'Invoice not found' }
                  }
                });
                continue;
              }

              // Version conflict detection
              if (existing.version > job.clientVersion) {
                await prisma.conflict.create({
                  data: {
                    invoiceId,
                    userId,
                    deviceId: device.id,
                    localVersion: job.clientVersion,
                    serverVersion: existing.version,
                    localData: job.payload,
                    serverData: existing as any
                  }
                });

                await prisma.syncJob.update({
                  where: { id: syncJob.id },
                  data: { status: 'conflict' }
                });

                results.conflicts.push(job.clientId);
                continue;
              }

              // Enqueue for worker processing
              await enqueueInvoiceSync(syncJob.id);
              
              await prisma.syncJob.update({
                where: { id: syncJob.id },
                data: { status: 'processing' }
              });

              results.synced.push(job.clientId);
            } else if (job.action === 'delete') {
              // Soft delete - mark as deleted
              await enqueueInvoiceSync(syncJob.id);
              
              await prisma.syncJob.update({
                where: { id: syncJob.id },
                data: { status: 'processing' }
              });

              results.synced.push(job.clientId);
            }
          } else {
            // Other entities - mark for future implementation
            await prisma.syncJob.update({
              where: { id: syncJob.id },
              data: { 
                status: 'failed',
                result: { error: `Entity ${job.entity} not yet supported` }
              }
            });
            results.failed.push(job.clientId);
          }
        } catch (jobError: any) {
          log.error('Sync job processing error', { 
            clientId: job.clientId, 
            error: jobError.message 
          });
          results.failed.push(job.clientId);
        }
      }

      log.info('Sync push completed', { 
        userId, 
        deviceId: body.deviceId, 
        jobCount: body.jobs.length,
        results 
      });

      return reply.send({
        success: true,
        ...results
      });
    } catch (error: any) {
      log.error('Sync push error', { error: error.message });
      
      if (error.message.includes('authorization') || error.message.includes('token')) {
        return reply.status(403).send({ error: error.message });
      }
      
      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/v1/sync/pull - Download server changes since last sync
  app.get('/api/v1/sync/pull', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = await authenticate(request);
      const { deviceId, since } = request.query as { deviceId?: string; since?: string };

      if (!deviceId) {
        return reply.status(400).send({ error: 'deviceId query parameter required' });
      }

      // Verify device ownership
      const device = await prisma.device.findUnique({
        where: { deviceId }
      });

      if (!device || device.userId !== userId) {
        return reply.status(403).send({ error: 'Device not found or unauthorized' });
      }

      const sinceDate = since ? new Date(since) : new Date(0);

      // Pull invoices updated since timestamp
      const invoices = await prisma.invoice.findMany({
        where: {
          userId,
          updatedAt: { gt: sinceDate }
        },
        orderBy: { updatedAt: 'asc' },
        take: 100 // Limit to prevent huge payloads
      });

      log.info('Sync pull completed', { 
        userId, 
        deviceId, 
        since: sinceDate,
        invoiceCount: invoices.length 
      });

      return reply.send({
        success: true,
        invoices,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Sync pull error', { error: error.message });
      
      if (error.message.includes('authorization') || error.message.includes('token')) {
        return reply.status(403).send({ error: error.message });
      }
      
      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/v1/sync/conflicts - List unresolved conflicts for device
  app.get('/api/v1/sync/conflicts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = await authenticate(request);
      const { deviceId } = request.query as { deviceId?: string };

      if (!deviceId) {
        return reply.status(400).send({ error: 'deviceId query parameter required' });
      }

      // Verify device ownership
      const device = await prisma.device.findUnique({
        where: { deviceId }
      });

      if (!device || device.userId !== userId) {
        return reply.status(403).send({ error: 'Device not found or unauthorized' });
      }

      const conflicts = await prisma.conflict.findMany({
        where: {
          deviceId: device.id,
          resolution: null
        },
        include: {
          invoice: {
            select: {
              id: true,
              customerName: true,
              total: true,
              status: true,
              updatedAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({
        success: true,
        conflicts
      });
    } catch (error: any) {
      log.error('Get conflicts error', { error: error.message });
      
      if (error.message.includes('authorization') || error.message.includes('token')) {
        return reply.status(403).send({ error: error.message });
      }
      
      return reply.status(400).send({ error: error.message });
    }
  });

  // POST /api/v1/sync/conflicts/resolve - Resolve conflict with strategy
  app.post('/api/v1/sync/conflicts/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = await authenticate(request);
      const body = ConflictResolutionSchema.parse(request.body);

      // Find conflict and verify ownership
      const conflict = await prisma.conflict.findUnique({
        where: { id: body.conflictId },
        include: {
          device: true,
          invoice: true
        }
      });

      if (!conflict) {
        return reply.status(404).send({ error: 'Conflict not found' });
      }

      if (conflict.device.userId !== userId) {
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      if (conflict.resolution) {
        return reply.status(400).send({ error: 'Conflict already resolved' });
      }

      let finalData: any;

      if (body.resolution === 'local_wins') {
        finalData = conflict.localData;
      } else if (body.resolution === 'server_wins') {
        finalData = conflict.serverData;
      } else if (body.resolution === 'merged' && body.mergedData) {
        finalData = body.mergedData;
      } else {
        return reply.status(400).send({ error: 'Invalid resolution or missing mergedData' });
      }

      // Update invoice with resolved data
      await prisma.invoice.update({
        where: { id: conflict.invoiceId },
        data: {
          ...finalData,
          version: { increment: 1 }
        }
      });

      // Mark conflict as resolved
      await prisma.conflict.update({
        where: { id: body.conflictId },
        data: {
          resolution: body.resolution,
          resolvedAt: new Date()
        }
      });

      log.info('Conflict resolved', { 
        conflictId: body.conflictId, 
        resolution: body.resolution,
        userId 
      });

      return reply.send({
        success: true,
        message: 'Conflict resolved successfully'
      });
    } catch (error: any) {
      log.error('Resolve conflict error', { error: error.message });
      
      if (error.message.includes('authorization') || error.message.includes('token')) {
        return reply.status(403).send({ error: error.message });
      }
      
      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/v1/sync/status - Get sync status for device
  app.get('/api/v1/sync/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = await authenticate(request);
      const { deviceId } = request.query as { deviceId?: string };

      if (!deviceId) {
        return reply.status(400).send({ error: 'deviceId query parameter required' });
      }

      // Verify device ownership
      const device = await prisma.device.findUnique({
        where: { deviceId }
      });

      if (!device || device.userId !== userId) {
        return reply.status(403).send({ error: 'Device not found or unauthorized' });
      }

      const pendingJobs = await prisma.syncJob.count({
        where: {
          deviceId: device.id,
          status: 'pending'
        }
      });

      return reply.send({
        success: true,
        pendingJobs,
        lastHeartbeat: device.lastHeartbeat
      });
    } catch (error: any) {
      log.error('Get sync status error', { error: error.message });
      
      if (error.message.includes('authorization') || error.message.includes('token')) {
        return reply.status(403).send({ error: error.message });
      }
      
      return reply.status(400).send({ error: error.message });
    }
  });
}
