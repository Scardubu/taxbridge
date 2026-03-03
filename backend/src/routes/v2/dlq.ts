/**
 * TaxBridge — V12 APEX: DLQ Management Route
 * GET  /api/v2/admin/dlq        — list failed jobs (ADMIN+)
 * POST /api/v2/admin/dlq/:id/retry   — retry a specific job (require2FA if depth > 10)
 * POST /api/v2/admin/dlq/:id/resolve — mark a job as resolved / discarded
 *
 * All mutations write an OVERRIDE audit event.
 * Cursor-paginated via encodeCursor/decodeCursor from @taxbridge/contracts.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { encodeCursor, decodeCursor, type PaginatedResponse } from '@taxbridge/contracts';
import { successResponse, errorResponse } from '../../lib/api-envelope';
import { getPrismaClient } from '../../lib/prisma';
import { getInvoiceSyncQueue, getPaymentQueue } from '../../queue/client';
import { writeAuditEvent } from '../../services/audit';
import { requireRole } from '../../middleware/requireRole';
import { require2FA } from '../../middleware/require2FA';
import { createLogger } from '../../lib/logger';

const log = createLogger('v2-dlq');
const prisma = getPrismaClient();

/** All queues that feed the DLQ view */
const getQueues = () =>
  [getInvoiceSyncQueue(), getPaymentQueue()].filter(Boolean);

interface DlqJobSummary {
  id: string;
  queueName: string;
  depth: number;
  failedReason: string | null;
  attemptsMade: number;
  timestamp: number;
  cursor: string;
}

export default async function v2DlqRoute(fastify: FastifyInstance) {

  // ── GET /api/v2/admin/dlq ─────────────────────────────────────────────────
  fastify.get(
    '/api/v2/admin/dlq',
    { preHandler: [requireRole('admin')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { after, limit = '25' } = (req.query as Record<string, string>);
        const pageSize = Math.min(parseInt(limit, 10) || 25, 100);
        const cursor = after ? decodeCursor(after) : null;

        const jobs: DlqJobSummary[] = [];

        for (const queue of getQueues()) {
          if (!queue) continue;
          const failedJobs = await (queue as any).getFailed(0, 200);
          for (const job of failedJobs) {
            const createdAt = new Date(job.timestamp ?? Date.now());
            // Apply cursor filter
            if (cursor && createdAt <= new Date(cursor.t)) continue;

            jobs.push({
              id: String(job.id),
              queueName: (queue as any).name ?? 'unknown',
              depth: job.attemptsMade ?? 0,
              failedReason: job.failedReason ?? null,
              attemptsMade: job.attemptsMade ?? 0,
              timestamp: job.timestamp ?? 0,
              cursor: encodeCursor(String(job.id), createdAt),
            });
          }
        }

        // Sort descending by timestamp, take page
        jobs.sort((a, b) => b.timestamp - a.timestamp);
        const page = jobs.slice(0, pageSize);
        const nextCursor = page.length === pageSize ? page[page.length - 1].cursor : null;

        const response: PaginatedResponse<DlqJobSummary> = {
          data: page,
          nextCursor,
          hasMore: nextCursor !== null,
        };

        return reply.send(successResponse(response));
      } catch (err) {
        log.error('dlq:list error', { err });
        return reply.status(500).send(errorResponse('Failed to fetch DLQ jobs'));
      }
    },
  );

  // ── POST /api/v2/admin/dlq/:id/retry ──────────────────────────────────────
  fastify.post(
    '/api/v2/admin/dlq/:id/retry',
    {
      preHandler: [
        requireRole('admin'),
        // C-38: require2FA for high-depth re-queue (depth > 10),
        // evaluated dynamically via the route handler; hooked at preHandler
        // for all retries to keep audit trail tight.
        require2FA,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const actor = (req as any).user;

      try {
        let retried = false;

        for (const queue of getQueues()) {
          if (!queue) continue;
          const job = await (queue as any).getJob(id);
          if (!job) continue;

          // Depth guard — block retry of > 10 attempts (write audit and reject)
          if (job.attemptsMade > 10) {
            await writeAuditEvent(
              {
                actorId:    actor?.id ?? 'system',
                orgId:      actor?.businessId,
                action:     'DLQ_RETRY_BLOCKED_DEPTH',
                resource:   'Job',
                resourceId: id,
                details:    { depth: job.attemptsMade, queue: (queue as any).name },
                ipAddress:  req.ip,
                userAgent:  req.headers['user-agent'],
              },
              prisma,
            );
            return reply.status(422).send(
              errorResponse('Job exceeded max retry depth (10). Resolve instead.'),
            );
          }

          await job.retry();
          retried = true;

          await writeAuditEvent(
            {
              actorId:    actor?.id ?? 'system',
              orgId:      actor?.businessId,
              action:     'OVERRIDE',
              resource:   'Job',
              resourceId: id,
              details:    { op: 'retry', queue: (queue as any).name, depth: job.attemptsMade },
              ipAddress:  req.ip,
              userAgent:  req.headers['user-agent'],
            },
            prisma,
          );
          break;
        }

        if (!retried) {
          return reply.status(404).send(errorResponse('Job not found in DLQ'));
        }

        return reply.send(successResponse({ id, status: 'retried' }));
      } catch (err) {
        log.error('dlq:retry error', { err, id });
        return reply.status(500).send(errorResponse('Retry failed'));
      }
    },
  );

  // ── POST /api/v2/admin/dlq/:id/resolve ────────────────────────────────────
  fastify.post(
    '/api/v2/admin/dlq/:id/resolve',
    { preHandler: [requireRole('admin'), require2FA] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const actor = (req as any).user;

      try {
        let resolved = false;

        for (const queue of getQueues()) {
          if (!queue) continue;
          const job = await (queue as any).getJob(id);
          if (!job) continue;

          // Discard — remove from failed set
          await job.discard?.();
          await job.remove?.();
          resolved = true;

          await writeAuditEvent(
            {
              actorId:    actor?.id ?? 'system',
              orgId:      actor?.businessId,
              action:     'OVERRIDE',
              resource:   'Job',
              resourceId: id,
              details:    { op: 'resolve', queue: (queue as any).name },
              ipAddress:  req.ip,
              userAgent:  req.headers['user-agent'],
            },
            prisma,
          );
          break;
        }

        if (!resolved) {
          return reply.status(404).send(errorResponse('Job not found in DLQ'));
        }

        return reply.send(successResponse({ id, status: 'resolved' }));
      } catch (err) {
        log.error('dlq:resolve error', { err, id });
        return reply.status(500).send(errorResponse('Resolve failed'));
      }
    },
  );
}
