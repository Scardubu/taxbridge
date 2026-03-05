/**
 * TaxBridge — V12 Analytics Routes (COMP-03)
 * GET /api/v2/analytics/revenue-at-risk    — past-due unfiled returns by taxType
 * GET /api/v2/analytics/compliance-rate    — 6-month filed_on_time ratio
 * GET /api/v2/analytics/risk-distribution  — SMERiskRecord count by band
 * GET /api/v2/analytics/nrs-health         — circuit state last 24h
 * GET /api/v2/analytics/dlq-trend          — DLQ depth last 7 days
 *
 * All routes: authenticate + requireRole('ADMIN')
 * C-07: Always 200 — returns empty arrays on data errors.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPrismaClient } from '../../lib/prisma';
import { requireRole } from '../../middleware/requireRole';
import { successResponse, errorResponse } from '../../lib/api-envelope';
import { createLogger } from '../../lib/logger';
import { getRedisConnection } from '../../queue/client';

const log = createLogger('v2-analytics');
const prisma = getPrismaClient();

export default async function v2AnalyticsRoute(fastify: FastifyInstance) {

  // ── Revenue At Risk ────────────────────────────────────────────────────────
  // 'Revenue at Risk' = past-due unfiled returns (penalty exposure), NOT
  // unpaid-but-filed returns. Architecture §13.
  fastify.get(
    '/api/v2/analytics/revenue-at-risk',
    { preHandler: [requireRole('ADMIN')] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const rows = await (prisma as any).taxReturn.groupBy({
          by: ['taxType'],
          where: {
            status: 'draft',
            dueDate: { lt: new Date() },
          },
          _count: { id: true },
          _sum: { amount: true },
        });

        const data = rows.map((r: any) => ({
          taxType: r.taxType,
          count: r._count.id,
          estimatedExposure: r._sum.amount ?? 0,
        }));

        return reply.send(successResponse(data));
      } catch (err) {
        log.error('revenue-at-risk query failed', { err });
        return reply.send(successResponse([])); // C-07: never 500
      }
    },
  );

  // ── Compliance Rate ────────────────────────────────────────────────────────
  // 6-month rolling window: filed_on_time / total_due per month
  fastify.get(
    '/api/v2/analytics/compliance-rate',
    { preHandler: [requireRole('ADMIN')] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const returns = await (prisma as any).taxReturn.findMany({
          where: { createdAt: { gte: sixMonthsAgo } },
          select: {
            status: true,
            dueDate: true,
            submittedAt: true,
            createdAt: true,
          },
        });

        // Group by year-month
        const byMonth: Record<string, { total: number; onTime: number }> = {};
        for (const r of returns as any[]) {
          const key = r.createdAt
            ? `${new Date(r.createdAt).getFullYear()}-${String(new Date(r.createdAt).getMonth() + 1).padStart(2, '0')}`
            : 'unknown';
          if (!byMonth[key]) byMonth[key] = { total: 0, onTime: 0 };
          byMonth[key].total++;
          if (r.status === 'filed' && r.submittedAt && r.dueDate) {
            if (new Date(r.submittedAt) <= new Date(r.dueDate)) {
              byMonth[key].onTime++;
            }
          }
        }

        const data = Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, { total, onTime }]) => ({
            month,
            total,
            onTime,
            rate: total > 0 ? Math.round((onTime / total) * 100) : 0,
          }));

        return reply.send(successResponse(data));
      } catch (err) {
        log.error('compliance-rate query failed', { err });
        return reply.send(successResponse([]));
      }
    },
  );

  // ── Risk Distribution ──────────────────────────────────────────────────────
  fastify.get(
    '/api/v2/analytics/risk-distribution',
    { preHandler: [requireRole('ADMIN')] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const rows = await (prisma as any).sMERiskRecord.groupBy({
          by: ['band'],
          _count: { id: true },
        });

        const ORDER = ['critical', 'high', 'medium', 'low', 'healthy'];
        const data = ORDER.map((band) => ({
          band,
          count: rows.find((r: any) => r.band === band)?._count?.id ?? 0,
        }));

        return reply.send(successResponse(data));
      } catch (err) {
        log.error('risk-distribution query failed', { err });
        return reply.send(successResponse([]));
      }
    },
  );

  // ── NRS Health Timeline ────────────────────────────────────────────────────
  // Circuit state timeline from audit events, last 24h
  fastify.get(
    '/api/v2/analytics/nrs-health',
    { preHandler: [requireRole('ADMIN')] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const events = await (prisma as any).auditEvent.findMany({
          where: {
            action: 'NRS_STAMP',
            createdAt: { gte: since },
          },
          select: { createdAt: true, metadata: true },
          orderBy: { createdAt: 'asc' },
          take: 200,
        });

        const data = events.map((e: any) => ({
          ts: e.createdAt,
          state: (e.metadata as any)?.circuitState ?? 'unknown',
        }));

        return reply.send(successResponse(data));
      } catch (err) {
        log.error('nrs-health query failed', { err });
        return reply.send(successResponse([]));
      }
    },
  );

  // ── DLQ Depth Trend ────────────────────────────────────────────────────────
  // Last 7 days depth samples from Redis metrics key
  fastify.get(
    '/api/v2/analytics/dlq-trend',
    { preHandler: [requireRole('ADMIN')] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const redis = getRedisConnection();
        if (!redis) {
          return reply.send(successResponse([]));
        }

        // DLQ depth samples stored by metrics cron as sorted-set members
        const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const raw = await redis.zrangebyscore(
          'metrics:dlq:depth',
          since,
          '+inf',
          'WITHSCORES',
        );

        const data: Array<{ ts: number; depth: number }> = [];
        for (let i = 0; i < raw.length; i += 2) {
          data.push({
            depth: parseInt(raw[i], 10),
            ts: parseInt(raw[i + 1], 10),
          });
        }

        return reply.send(successResponse(data));
      } catch (err) {
        log.error('dlq-trend query failed', { err });
        return reply.send(successResponse([]));
      }
    },
  );
}
