import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Invoice } from '@prisma/client';
import { z } from 'zod';
import { getPrismaClient } from '../lib/prisma';
import { HeartbeatSchema, PushSyncSchema, type HeartbeatPayload } from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';
import { enqueueDeviceSync } from '../queue/client';
import { buildConflictInvoiceUpdate } from '../services/conflictInvoiceData';

const log = createLogger('sync-routes');
const prisma = getPrismaClient();

// Feature flag check
function isDeviceSyncEnabled(): boolean {
  return String(process.env.FEATURE_DEVICE_SYNC || 'false').toLowerCase() === 'true';
}

// Conflict resolution schema
const ConflictResolutionSchema = z.object({
  conflictId: z.string().uuid(),
  resolution: z.enum(['local_wins', 'server_wins', 'merged']),
  mergedData: z.record(z.string(), z.any()).optional()
});

export default async function syncRoutes(app: FastifyInstance) {
  // POST /api/v1/device/heartbeat - Register/update device presence
  app.post('/api/v1/device/heartbeat', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = request.user.userId;
      const body: HeartbeatPayload = HeartbeatSchema.parse(request.body);

      // Check if device already exists and verify ownership
      const existingDevice = await prisma.device.findUnique({
        where: { deviceId: body.deviceId }
      });

      if (existingDevice && existingDevice.userId !== userId) {
        return reply.status(403).send({ 
          error: 'Device belongs to another user. Cannot update device registration.' 
        });
      }

      // Upsert device record (now safe after ownership check)
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
      const bodyWithOptionals = body as any; // Type assertion for optional fields
      await prisma.auditLog.create({
        data: {
          action: 'DEVICE_HEARTBEAT',
          userId,
          metadata: {
            deviceId: body.deviceId,
            platform: body.platform,
            appVersion: body.appVersion,
            network: bodyWithOptionals.network,
            batteryPct: bodyWithOptionals.batteryPct
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
  app.post('/api/v1/sync/push', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = request.user.userId;
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
          // ── Idempotency guard ──────────────────────────────────
          // If this clientId was already submitted by this device and
          // is not in a terminal-failed state, return the prior outcome
          // instead of creating a duplicate SyncJob.
          const existingJob = await prisma.syncJob.findFirst({
            where: {
              deviceId: device.id,
              clientId: job.clientId,
              status: { notIn: ['failed'] }
            },
            orderBy: { createdAt: 'desc' }
          });

          if (existingJob) {
            if (existingJob.status === 'conflict') {
              results.conflicts.push(job.clientId);
            } else {
              // pending, processing, or completed — treat as synced
              results.synced.push(job.clientId);
            }
            log.info('Idempotent push: skipping duplicate', {
              clientId: job.clientId,
              existingStatus: existingJob.status
            });
            continue;
          }

          // Validate the client invoice ID and ownership before creating any
          // SyncJob/Conflict row that references it. A device must never be able
          // to create a conflict against another user's invoice UUID.
          let invoiceId: string | null = null;
          let existingInvoice: Invoice | null = null;
          if (job.entity === 'invoice') {
            const parsedInvoiceId = z.string().uuid().safeParse(job.payload.id);
            if (!parsedInvoiceId.success) {
              results.failed.push(job.clientId);
              continue;
            }

            invoiceId = parsedInvoiceId.data;
            existingInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

            if (existingInvoice && existingInvoice.userId !== userId) {
              log.warn('Rejected cross-tenant invoice sync reference', {
                userId,
                deviceId: device.id,
                clientId: job.clientId,
              });
              results.failed.push(job.clientId);
              continue;
            }

            if (job.action !== 'create' && !existingInvoice) {
              results.failed.push(job.clientId);
              continue;
            }
          }

          // Create SyncJob audit record
          const syncJob = await prisma.syncJob.create({
            data: {
              deviceId: device.id,
              userId,
              invoiceId,
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
            const resolvedInvoiceId = invoiceId!;
            if (job.action === 'create') {
              const existing = existingInvoice;

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
              await enqueueDeviceSync(syncJob.id);

              await prisma.syncJob.update({
                where: { id: syncJob.id },
                data: { status: 'processing' }
              });

              results.synced.push(job.clientId);
            } else if (job.action === 'update') {
              const existing = existingInvoice!;
              // Ownership was verified before the SyncJob row was created.

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
              await enqueueDeviceSync(syncJob.id);

              await prisma.syncJob.update({
                where: { id: syncJob.id },
                data: { status: 'processing' }
              });

              results.synced.push(job.clientId);
            } else if (job.action === 'delete') {
              // Ownership and existence were verified before SyncJob creation.
              await enqueueDeviceSync(syncJob.id);

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
            error: jobError.message,
            stack: jobError.stack
          });
          
          // Try to update sync job if it was created
          try {
            const existingSyncJob = await prisma.syncJob.findFirst({
              where: { 
                userId,
                deviceId: device.id,
                clientId: job.clientId
              }
            });
            
            if (existingSyncJob) {
              await prisma.syncJob.update({
                where: { id: existingSyncJob.id },
                data: { 
                  status: 'failed',
                  result: { error: jobError.message, stack: jobError.stack }
                }
              });
            }
          } catch (updateError) {
            // Ignore update errors
          }
          
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
  app.get('/api/v1/sync/pull', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = request.user.userId;
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

      // Validate and parse since parameter (format: timestamp or timestamp:id)
      let sinceDate: Date;
      let sinceId: string | undefined;
      if (since) {
        const parts = since.split(':');
        sinceDate = new Date(parts[0]);
        if (isNaN(sinceDate.getTime())) {
          return reply.status(400).send({ 
            error: 'Invalid since parameter. Must be a valid ISO 8601 date string or timestamp:id format.' 
          });
        }
        sinceId = parts[1]; // Optional ID for deterministic cursor
      } else {
        sinceDate = new Date(0);
      }

      // Pull invoices updated since timestamp with pagination
      const BATCH_SIZE = 100;
      const invoices = await prisma.invoice.findMany({
        where: {
          userId,
          OR: [
            { updatedAt: { gt: sinceDate } },
            ...(sinceId ? [{ updatedAt: sinceDate, id: { gt: sinceId } }] : [])
          ]
        },
        orderBy: [
          { updatedAt: 'asc' },
          { id: 'asc' } // Deterministic secondary sort
        ],
        take: BATCH_SIZE + 1 // Fetch one extra to check if there are more
      });

      // Check if there are more results
      const hasMore = invoices.length > BATCH_SIZE;
      const returnedInvoices = hasMore ? invoices.slice(0, BATCH_SIZE) : invoices;
      
      // Calculate nextSince for pagination (composite cursor: timestamp:id)
      const nextSince = hasMore && returnedInvoices.length > 0
        ? `${returnedInvoices[returnedInvoices.length - 1].updatedAt.toISOString()}:${returnedInvoices[returnedInvoices.length - 1].id}`
        : undefined;

      log.info('Sync pull completed', { 
        userId, 
        deviceId, 
        since: sinceDate,
        invoiceCount: returnedInvoices.length,
        hasMore 
      });

      return reply.send({
        success: true,
        invoices: returnedInvoices,
        hasMore,
        nextSince,
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
  app.get('/api/v1/sync/conflicts', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = request.user.userId;
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
  app.post('/api/v1/sync/conflicts/resolve', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = request.user.userId;
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

      const resolutionSource = body.resolution === 'local_wins'
        ? conflict.localData
        : body.resolution === 'server_wins'
          ? conflict.serverData
          : body.mergedData;
      if (body.resolution === 'merged' && !body.mergedData) {
        return reply.status(400).send({ error: 'MERGED_DATA_REQUIRED' });
      }

      const resolutionData = buildConflictInvoiceUpdate(
        resolutionSource,
        body.resolution === 'merged' ? 'manual_merge' : 'trusted_snapshot',
      );
      if (!resolutionData.success) {
        return reply.status(400).send({ error: resolutionData.error });
      }
      const finalData = resolutionData.data;

      const status =
        body.resolution === 'local_wins'
          ? 'RESOLVED_CLIENT'
          : body.resolution === 'server_wins'
            ? 'RESOLVED_SERVER'
            : 'RESOLVED_MANUAL';

      // Update and resolve atomically. The shared resolver rejects protected
      // attributes and derives financial totals from the canonical tax utility.
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: conflict.invoiceId },
          data: {
            ...finalData,
            version: { increment: 1 },
          },
        });

        const claimedConflict = await tx.conflict.updateMany({
          where: { id: body.conflictId, resolution: null },
          data: {
            resolution: body.resolution,
            status,
            resolvedBy: userId,
            resolvedAt: new Date(),
          },
        });
        if (claimedConflict.count !== 1) {
          throw new Error('CONFLICT_ALREADY_RESOLVED');
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

      if (error.message === 'CONFLICT_ALREADY_RESOLVED') {
        return reply.status(409).send({ error: 'CONFLICT_ALREADY_RESOLVED' });
      }

      if (error.message.includes('authorization') || error.message.includes('token')) {
        return reply.status(403).send({ error: error.message });
      }

      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/v1/sync/status - Get sync status for device
  app.get('/api/v1/sync/status', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isDeviceSyncEnabled()) {
      return reply.status(404).send({ error: 'Device sync feature is disabled' });
    }

    try {
      const userId = request.user.userId;
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
