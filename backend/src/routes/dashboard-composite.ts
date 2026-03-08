/**
 * TaxBridge — Composite Dashboard Route
 * GET /api/v1/dashboard
 *
 * Single endpoint replacing 3 separate calls (stats + forecast + nrsHealth)
 * Eliminates cascading skeleton flashes on 2G Nigerian connections (CF-03 / C-14)
 *
 * Constraints:
 *   C-01  Prisma `any` types — no Prisma.XxxWhereInput
 *   C-07  Graceful degradation — partial failure returns partial data, never 500
 *   C-08  No Math.random() — all data from real DB queries
 *   C-14  THIS is the endpoint; mobile must not call /stats + /forecast + /nrs/health separately
 *
 * Cache strategy:
 *   Redis key:  dashboard:composite:{userId}
 *   TTL:        120 seconds (2 min) — fast enough for real-time feel, low enough for freshness
 *   Invalidate: on any invoice create/update, expense create/update, NRS status change
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../plugins/requireRole';
import { buildDashboardCompositeResponse } from './v1/dashboard';

// ─── Response types ───────────────────────────────────────────────────────────

export interface DashboardComposite {
  stats: {
    totalInvoices:   number;
    totalRevenue:    number;
    pendingNrs:      number;
    vatLiability:    number;
    taxHealthScore:  number;
    recentAnomalies: number;
    nextDeadline?:   string | { type: string; date: string; daysRemaining: number } | null;
  };
  forecast: {
    forecastedLiability:         number;
    breakdown:                   { pit: number; vat: number; devLevy: number };
    vatReclaimable:              number;
    confidenceScore:             number;
    recommendedMonthlyProvision: number;
  } | null;
  nrsHealth: {
    circuitBreakerOpen: boolean;
    pendingSubmissions: number;
    deadLetterCount:    number;
    status:             'healthy' | 'degraded';
  };
  topAnomalies: Array<{
    expenseId:             string;
    amount:                number;
    category:              string;
    anomalyReason:         string;
    anomalyReason_pidgin?: string;
    severity:              'low' | 'medium' | 'high';
    suggestedAction:       string;
  }>;
  upcomingDeadlines: Array<{
    id:             string;
    type:           string;
    dueDate:        string;
    daysRemaining:  number;
    penaltyIfLate?: string;
    status:         'upcoming' | 'overdue' | 'filed';
  }>;
  /** F1 — HealthRing pillar arcs */
  pillars: Array<{
    key:    string;
    score:  number;
    trend?: string;
  }>;
  /** F4 — DonutChart tax breakdown slices */
  taxBreakdown: Array<{
    key:   string;
    label: string;
    value: number;
  }>;
  /** F2 — SparklineBarChart monthly revenue */
  sparkData: Array<{
    value:   number;
    flagged: boolean;
    label:   string;
  }>;
  cachedAt: string; // ISO timestamp — lets mobile show "data from X ago"
}

// ─── Route registration ───────────────────────────────────────────────────────

export default async function dashboardCompositeRoute(fastify: FastifyInstance) {

  // ── GET /api/v1/dashboard ──────────────────────────────────────────────────

  fastify.get('/api/v1/dashboard', {
    preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('VIEWER')],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success:   { type: 'boolean' },
            data:      { type: 'object' },
            fromCache: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const { userId } = request.user;
    const { response, meta } = await buildDashboardCompositeResponse(orgId, userId);

    reply.header('X-Cache', meta.cached ? 'HIT' : 'MISS');
    reply.header('Cache-Control', 'private, max-age=120');
    return reply.send({ success: true, data: response, fromCache: meta.cached });
  });
}

// ─── Exported cache invalidation helper ──────────────────────────────────────

/**
 * Call after any mutation that affects dashboard data.
 * Usage in invoiceRoutes, expenseRoutes, nrsRoutes:
 *
 *   import { invalidateDashboardCache } from './dashboard-composite';
 *   // After successful create/update/delete:
 *   await invalidateDashboardCache(fastify.redis, userId);
 */
export async function invalidateDashboardCache(
  redis:  import('ioredis').Redis | null,
  userId: string,
): Promise<void> {
  if (!redis) return;
  try {
    await Promise.all([
      redis.del(`dashboard:composite:${userId}`),
      redis.del(`dashboard:composite:v1:${userId}`),
    ]);
  } catch {
    // Non-fatal — stale cache will expire naturally in 120s
  }
}
