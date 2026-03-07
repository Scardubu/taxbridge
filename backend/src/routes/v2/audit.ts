/**
 * TaxBridge — V12 APEX: Audit Route
 * GET  /api/v2/admin/audit          — cursor-paginated audit log (ADMIN+)
 * GET  /api/v2/admin/audit/export   — NDJSON stream for full compliance export (ADMIN+)
 *
 * Cursor pagination via encodeCursor/decodeCursor from @taxbridge/contracts.
 * Export writes AUDIT:EXPORT event. C-01: (prisma as any) throughout.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { encodeCursor, decodeCursor, type PaginatedResponse } from '@taxbridge/contracts';
import { successResponse, errorResponse } from '../../lib/api-envelope';
import { getPrismaClient } from '../../lib/prisma';
import { writeAuditEvent } from '../../services/audit';
import { requireRole } from '../../middleware/requireRole';
import { createLogger } from '../../lib/logger';

const log = createLogger('v2-audit');
const prisma = getPrismaClient();

/** Fields returned in list view (no PII) */
interface AuditEventRow {
  id: string;
  orgId: string | null;
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
  cursor: string;
}

export default async function v2AuditRoute(fastify: FastifyInstance) {

  // ── GET /api/v2/admin/audit ───────────────────────────────────────────────
  fastify.get(
    '/api/v2/admin/audit',
    { preHandler: [requireRole('admin')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = req.query as Record<string, string>;
        const { after, limit = '50', orgId, action, userId } = query;
        const pageSize = Math.min(parseInt(limit, 10) || 50, 200);

        const cursor = after ? decodeCursor(after) : null;

        // Build where clause — C-01: typed as any
        const where: any = {};
        if (orgId)   where.orgId  = orgId;
        if (action)  where.action = action;
        if (userId)  where.userId = userId;
        if (cursor) {
          where.OR = [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ];
        }

        const raw: any[] = await (prisma as any).auditEvent.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: pageSize + 1,
          select: {
            id:         true,
            orgId:      true,
            userId:     true,
            action:     true,
            resource:   true,
            resourceId: true,
            metadata:   true,
            ipAddress:  true,
            createdAt:  true,
          },
        });

        const hasMore = raw.length > pageSize;
        const items: AuditEventRow[] = raw.slice(0, pageSize).map((e) => ({
          id:         e.id,
          orgId:      e.orgId,
          userId:     e.userId,
          action:     e.action,
          resource:   e.resource,
          resourceId: e.resourceId,
          metadata:   e.metadata,
          ipAddress:  e.ipAddress ? '[REDACTED]' : null,   // PII scrub in list
          createdAt:  (e.createdAt as Date).toISOString(),
          cursor:     encodeCursor(e.id, e.createdAt as Date),
        }));

        const nextCursor = hasMore ? items[items.length - 1].cursor : null;

        const response: PaginatedResponse<AuditEventRow> = {
          data: items,
          meta: {
            nextCursor,
            prevCursor:      null,
            hasNextPage:     hasMore,
            hasPreviousPage: !!after,
            total:           null,
            pageSize,
          },
        };

        return reply.send(successResponse(response));
      } catch (err) {
        log.error('audit:list error', { err });
        return reply.status(500).send(errorResponse('Failed to fetch audit log'));
      }
    },
  );

  // ── GET /api/v2/admin/audit/export — NDJSON stream ────────────────────────
  fastify.get(
    '/api/v2/admin/audit/export',
    { preHandler: [requireRole('admin')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const actor = (req as any).user;
      const query = req.query as Record<string, string>;
      const { orgId, action, startDate, endDate } = query;

      // Write export audit event first (immutable trail)
      await writeAuditEvent(
        {
          actorId:   actor?.id ?? 'system',
          orgId:     actor?.businessId,
          action:    'AUDIT_EXPORT',
          resource:  'AuditEvent',
          details:   { orgId, action, startDate, endDate },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
        prisma,
      );

      const where: any = {};
      if (orgId)    where.orgId    = orgId;
      if (action)   where.action   = action;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate)   where.createdAt.lte = new Date(endDate);
      }

      // Stream NDJSON — chunked by 500 rows
      reply
        .header('Content-Type', 'application/x-ndjson')
        .header('Content-Disposition', 'attachment; filename="audit-export.ndjson"');

      const BATCH = 500;
      let cursor: any = undefined;
      let first = true;

      try {
        while (true) {
          const rows: any[] = await (prisma as any).auditEvent.findMany({
            where,
            orderBy:  { createdAt: 'asc' },
            take:     BATCH,
            skip:     cursor ? 1 : 0,
            cursor:   cursor ? { id: cursor } : undefined,
            select: {
              id:         true,
              orgId:      true,
              userId:     true,
              action:     true,
              resource:   true,
              resourceId: true,
              metadata:   true,
              createdAt:  true,
            },
          });

          if (rows.length === 0) break;
          cursor = rows[rows.length - 1].id;

          const chunk = rows
            .map((r) =>
              JSON.stringify({
                id:         r.id,
                orgId:      r.orgId,
                userId:     r.userId,
                action:     r.action,
                resource:   r.resource,
                resourceId: r.resourceId,
                metadata:   r.metadata,
                createdAt:  (r.createdAt as Date).toISOString(),
              }),
            )
            .join('\n') + '\n';

          if (first) {
            reply.raw.write(chunk);
            first = false;
          } else {
            reply.raw.write(chunk);
          }

          if (rows.length < BATCH) break;
        }

        reply.raw.end();
      } catch (err) {
        log.error('audit:export stream error', { err });
        if (!reply.raw.headersSent) {
          reply.status(500).send(errorResponse('Export failed'));
        } else {
          reply.raw.end();
        }
      }
    },
  );
}
