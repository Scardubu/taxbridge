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
import jwt from 'jsonwebtoken';
import {
  forecastQuarterlyTax,
  detectExpenseAnomalies,
  getDashboardStats,
  getPillarScores,
  getTaxBreakdownSlices,
  getSparkData,
} from '../services/tax-intelligence';
import { getUpcomingDeadlines } from '../services/compliance-calendar';
import { getPrismaClient } from '../lib/prisma';
import { getRedisConnection } from '../queue/client';

const prisma = getPrismaClient();

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

  // ── Inline JWT auth preHandler ────────────────────────────────────────────
  async function authenticate(req: any, reply: any) {
    const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
    if (!authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const secrets = [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS].filter(Boolean) as string[];
    let userId: string | undefined;
    for (const secret of secrets) {
      try {
        const decoded = jwt.verify(token, secret) as { userId?: string };
        if (decoded?.userId) { userId = decoded.userId; break; }
      } catch { /* try next */ }
    }
    if (!userId) return reply.code(401).send({ success: false, error: 'Invalid or expired token' });
    req.user = { id: userId };
  }

  // ── GET /api/v1/dashboard ──────────────────────────────────────────────────

  fastify.get('/api/v1/dashboard', {
    preHandler: [authenticate],
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
    const userId   = (request as any).user.id as string;
    const cacheKey = `dashboard:composite:${userId}`;

    // ── Try cache first ──────────────────────────────────────────────────────
    try {
      const redis = getRedisConnection();
      const cached = redis ? await redis.get(cacheKey) : null;
      if (cached) {
        return reply.send({ success: true, data: JSON.parse(cached), fromCache: true });
      }
    } catch {
      // Redis miss — proceed to compute (don't fail the request)
    }

    // ── Compute all data in parallel (C-07: partial failure is ok) ───────────

    const [
      statsResult,
      forecastResult,
      anomaliesResult,
      nrsResult,
      deadlinesResult,
      pillarsResult,
      taxBreakdownResult,
      sparkDataResult,
    ] = await Promise.allSettled([
      getDashboardStats(userId, prisma),
      forecastQuarterlyTax(userId, prisma),
      detectExpenseAnomalies(userId, prisma, 30),
      getNrsHealthInternal(),
      getUpcomingDeadlines(userId, prisma, 30),
      getPillarScores(userId, prisma),
      getTaxBreakdownSlices(userId, prisma),
      getSparkData(userId, prisma),
    ]);

    // ── Unwrap results with safe fallbacks ────────────────────────────────────

    const stats = statsResult.status === 'fulfilled'
      ? statsResult.value
      : {
          totalInvoices: 0, totalRevenue: 0, pendingNrs: 0,
          vatLiability: 0, taxHealthScore: 0, recentAnomalies: 0,
        };

    const forecast = forecastResult.status === 'fulfilled'
      ? forecastResult.value
      : null;

    const anomalies = anomaliesResult.status === 'fulfilled'
      ? anomaliesResult.value
      : [];

    const nrsHealth = nrsResult.status === 'fulfilled'
      ? nrsResult.value
      : { circuitBreakerOpen: false, pendingSubmissions: 0, deadLetterCount: 0, status: 'healthy' as const };

    const upcomingDeadlines = deadlinesResult.status === 'fulfilled'
      ? deadlinesResult.value
      : [];

    // Top anomalies: severity ≥ medium, max 3, sorted by severity desc
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const topAnomalies = anomalies
      .filter((a: any) => a.severity !== 'low')
      .sort((a: any, b: any) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 3);

    // Update recentAnomalies count from live data
    const enrichedStats = {
      ...stats,
      recentAnomalies: anomalies.filter((a: any) => a.severity !== 'low').length,
    };

    const pillars      = pillarsResult.status      === 'fulfilled' ? pillarsResult.value      : [];
    const taxBreakdown = taxBreakdownResult.status  === 'fulfilled' ? taxBreakdownResult.value  : [];
    const sparkData    = sparkDataResult.status     === 'fulfilled' ? sparkDataResult.value     : [];

    const data: DashboardComposite = {
      stats:             enrichedStats,
      forecast,
      nrsHealth,
      topAnomalies,
      upcomingDeadlines,
      pillars,
      taxBreakdown,
      sparkData,
      cachedAt:          new Date().toISOString(),
    };

    // ── Cache the composite response ─────────────────────────────────────────
    try {
      const redis = getRedisConnection();
      if (redis) await redis.setex(cacheKey, 120, JSON.stringify(data));
    } catch {
      // Cache write failure is non-fatal — user still gets fresh data
    }

    return reply.send({ success: true, data, fromCache: false });
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getNrsHealthInternal() {
  const redis = getRedisConnection();
  const CIRCUIT_KEY = 'nrs:circuit:open';
  const [circuitOpen, pending, failed] = await Promise.all([
    redis ? redis.exists(CIRCUIT_KEY).then(Boolean) : Promise.resolve(false),
    (prisma as any).invoice.count({ where: { nrsStatus: 'PENDING' } }),
    (prisma as any).invoice.count({ where: { nrsStatus: 'FAILED', retryCount: { gte: 3 } } }),
  ]);
  return {
    circuitBreakerOpen: circuitOpen,
    pendingSubmissions: pending,
    deadLetterCount:    failed,
    status:             circuitOpen ? 'degraded' as const : 'healthy' as const,
  };
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
    await redis.del(`dashboard:composite:${userId}`);
  } catch {
    // Non-fatal — stale cache will expire naturally in 120s
  }
}
