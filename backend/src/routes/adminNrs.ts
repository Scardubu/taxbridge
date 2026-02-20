/**
 * Admin NRS Routes — TaxBridge V3.0
 *
 * Provides the NRS Operations Center with:
 *   GET /api/admin/nrs/queue-status        — BullMQ queue health for all 6 queues
 *   GET /api/admin/nrs/failed-submissions  — Paginated failed NRS submissions
 *   POST /api/admin/nrs/resubmit/:id       — Manual re-enqueue of a failed submission
 *   GET /api/admin/nrs/irn-audit           — IRN audit log (paginated, exportable via headers)
 *
 * Auth: x-admin-api-key header (ADMIN_API_KEYS env var)
 * All endpoints return 200 even under Redis cold-start (graceful degradation).
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { requireAdminApiKey } from '../lib/security';
import { getQueueHealth } from '../queues/index';
import { createLogger } from '../lib/logger';
import { getRedisConnection } from '../queue/client';

const log = createLogger('admin-nrs');

export async function adminNrsRoutes(app: FastifyInstance, options: { prisma: PrismaClient }): Promise<void> {
  const { prisma } = options;

  // ─── 1. Queue Status ─────────────────────────────────────────────────────

  /**
   * GET /api/admin/nrs/queue-status
   * Returns health + counts for all 6 BullMQ queues.
   * Always 200 — 'unavailable' status used for cold-start degradation.
   */
  app.get('/api/admin/nrs/queue-status', {
    preHandler: requireAdminApiKey,
    schema: {
      tags: ['Admin', 'NRS'],
      description: 'BullMQ queue health for all queues',
      security: [{ adminApiKey: [] }],
    },
  }, async (_req, reply) => {
    try {
      const health = await getQueueHealth();
      return reply.send({
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      log.error('Queue status error', { error: err.message });
      return reply.send({
        success: true,
        data: { status: 'unavailable', queues: {} },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── 2. Failed Submissions ────────────────────────────────────────────────

  /**
   * GET /api/admin/nrs/failed-submissions
   * Query params: page (default 1), limit (default 20), since (ISO date)
   */
  app.get<{
    Querystring: { page?: string; limit?: string; since?: string }
  }>('/api/admin/nrs/failed-submissions', {
    preHandler: requireAdminApiKey,
    schema: {
      tags: ['Admin', 'NRS'],
      description: 'Paginated failed NRS invoice submissions',
      security: [{ adminApiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          page:  { type: 'string', description: 'Page number (1-based)' },
          limit: { type: 'string', description: 'Items per page (max 100)' },
          since: { type: 'string', description: 'ISO 8601 start date filter' },
        },
      },
    },
  }, async (req, reply) => {
    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const since = req.query.since ? new Date(req.query.since) : undefined;

    try {
      const where: any = {
        nrsStatus: { in: ['FAILED', 'PENDING'] },
        ...(since ? { updatedAt: { gte: since } } : {}),
      };

      const [total, invoices] = await Promise.all([
        prisma.invoice.count({ where }),
        prisma.invoice.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            invoiceNumber: true,
            nrsStatus: true,
            nrsSubmittedAt: true,
            nrsError: true,
            totalAmount: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          invoices,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      log.error('Failed submissions query error', { error: err.message });
      return reply.send({
        success: true,
        data: { invoices: [], pagination: { page, limit, total: 0, pages: 0 } },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── 3. Manual Re-submit ─────────────────────────────────────────────────

  /**
   * POST /api/admin/nrs/resubmit/:id
   * Re-enqueues a failed NRS submission job by invoice ID.
   */
  app.post<{ Params: { id: string } }>('/api/admin/nrs/resubmit/:id', {
    preHandler: requireAdminApiKey,
    schema: {
      tags: ['Admin', 'NRS'],
      description: 'Manually re-enqueue a failed NRS submission',
      security: [{ adminApiKey: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.params;

    try {
      const invoice = await (prisma as any).invoice.findUnique({ where: { id } });
      if (!invoice) {
        return reply.code(404).send({ success: false, error: 'Invoice not found' });
      }

      const redis = getRedisConnection();
      if (!redis) {
        return reply.code(503).send({ success: false, error: 'Queue service temporarily unavailable' });
      }

      // Enqueue by pushing a job key into the NRS submission queue stream
      await redis.lpush('bull:nrs-submission:wait', JSON.stringify({
        name: 'submit-invoice',
        data: { invoiceId: id, retryFromAdmin: true },
        opts: { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
      }));

      // Mark invoice as PENDING so the worker picks it up fresh
      await (prisma as any).invoice.update({
        where: { id },
        data: { nrsStatus: 'PENDING', nrsError: null },
      });

      log.info('Admin re-enqueued NRS submission', { invoiceId: id });
      return reply.send({ success: true, message: 'Invoice re-queued for NRS submission', invoiceId: id });
    } catch (err: any) {
      log.error('Resubmit failed', { invoiceId: id, error: err.message });
      return reply.code(500).send({ success: false, error: 'Resubmit failed', detail: err.message });
    }
  });

  // ─── 4. IRN Audit Log ─────────────────────────────────────────────────────

  /**
   * GET /api/admin/nrs/irn-audit
   * Returns recent IRN (Invoice Reference Number) submissions with CSID + timestamps.
   * Accepts ?export=csv header for downloading.
   */
  app.get<{
    Querystring: { page?: string; limit?: string; status?: string }
  }>('/api/admin/nrs/irn-audit', {
    preHandler: requireAdminApiKey,
    schema: {
      tags: ['Admin', 'NRS'],
      description: 'IRN audit log with CSID and status',
      security: [{ adminApiKey: [] }],
    },
  }, async (req, reply) => {
    const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const status = req.query.status; // optional filter

    try {
      const where: any = {
        nrsIrn: { not: null },
        ...(status ? { nrsStatus: status } : {}),
      };

      const [total, records] = await Promise.all([
        (prisma as any).invoice.count({ where }),
        (prisma as any).invoice.findMany({
          where,
          orderBy: { nrsSubmittedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            invoiceNumber: true,
            nrsIrn: true,
            nrsCsid: true,
            nrsStatus: true,
            nrsSubmittedAt: true,
            totalAmount: true,
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          records,
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      log.error('IRN audit query error', { error: err.message });
      return reply.send({
        success: true,
        data: { records: [], pagination: { page, limit, total: 0, pages: 0 } },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── 5. Summary Stats ─────────────────────────────────────────────────────

  /**
   * GET /api/admin/nrs/summary
   * Quick counts: total, successful, failed, pending submissions in last 24h.
   */
  app.get('/api/admin/nrs/summary', {
    preHandler: requireAdminApiKey,
    schema: {
      tags: ['Admin', 'NRS'],
      description: 'NRS submission summary for the last 24 hours',
      security: [{ adminApiKey: [] }],
    },
  }, async (_req, reply) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const [total, successful, failed, pending] = await Promise.all([
        (prisma as any).invoice.count(),
        (prisma as any).invoice.count({ where: { nrsStatus: 'SUBMITTED', updatedAt: { gte: since } } }),
        (prisma as any).invoice.count({ where: { nrsStatus: 'FAILED',    updatedAt: { gte: since } } }),
        (prisma as any).invoice.count({ where: { nrsStatus: 'PENDING',   updatedAt: { gte: since } } }),
      ]);

      return reply.send({
        success: true,
        data: { total, last24h: { successful, failed, pending } },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      log.error('NRS summary query error', { error: err.message });
      return reply.send({
        success: true,
        data: { total: 0, last24h: { successful: 0, failed: 0, pending: 0 } },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
