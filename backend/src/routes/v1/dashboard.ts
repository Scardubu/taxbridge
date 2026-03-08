/**
 * Dashboard Route — TaxBridge V13 Sovereign
 *
 * GET /api/v1/dashboard
 * Single composite call — never fire multiple requests (C-14).
 * Redis cache TTL 120s. FALLBACK_* on every .catch()
 *
 * C-07: Never returns 500 — always falls back to FALLBACK_* constants.
 */
import { FastifyPluginAsync }  from 'fastify';
import { requireRole }         from '../../plugins/requireRole';
import { redis }               from '../../lib/redis';
import { prisma }              from '../../lib/prisma';
import {
  FALLBACK_ANOMALIES,
  FALLBACK_DEADLINES,
  FALLBACK_NRS_HEALTH,
  FALLBACK_STATS,
} from '../../services/dashboardService';
import {
  forecastQuarterlyTax,
  detectExpenseAnomalies,
  getDashboardStats,
  getPillarScores,
  getTaxBreakdownSlices,
  getSparkData,
} from '../../services/tax-intelligence';
import { getUpcomingDeadlines } from '../../services/compliance-calendar';

export async function buildDashboardCompositeResponse(orgId: string, userId: string) {
  const cacheKey = `dashboard:composite:v1:${orgId}:${userId}`;

  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) {
    try {
      const parsed   = JSON.parse(cached);
      const cachedAt = parsed.cachedAt ? new Date(parsed.cachedAt).getTime() : 0;
      const cacheAge = cachedAt > 0 ? Date.now() - cachedAt : 0;
      return {
        response: {
          stats: parsed.stats,
          forecast: parsed.forecast ?? null,
          topAnomalies: parsed.topAnomalies,
          upcomingDeadlines: parsed.upcomingDeadlines,
          nrsHealth: parsed.nrsHealth ?? FALLBACK_NRS_HEALTH,
          pillars: parsed.pillars ?? [],
          taxBreakdown: parsed.taxBreakdown ?? [],
          sparkData: parsed.sparkData ?? [],
          cachedAt: parsed.cachedAt ?? new Date(0).toISOString(),
        },
        meta: { cached: true, cacheAge },
      };
    } catch {
    }
  }

  const [stats, forecast, anomalies, upcomingDeadlines, pillars, taxBreakdown, sparkData, nrsHealth] = await Promise.all([
    getDashboardStats(userId, prisma).catch(() => FALLBACK_STATS),
    forecastQuarterlyTax(userId, prisma).catch(() => null),
    detectExpenseAnomalies(userId, prisma, 30).catch(() => FALLBACK_ANOMALIES),
    getUpcomingDeadlines(userId, prisma, 30).catch(() => FALLBACK_DEADLINES),
    getPillarScores(userId, prisma).catch(() => []),
    getTaxBreakdownSlices(userId, prisma).catch(() => []),
    getSparkData(userId, prisma).catch(() => []),
    fetchNrsHealth().catch(() => FALLBACK_NRS_HEALTH),
  ]);

  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const topAnomalies = anomalies
    .filter((anomaly: any) => anomaly.severity !== 'low')
    .sort((left: any, right: any) => severityOrder[left.severity] - severityOrder[right.severity])
    .slice(0, 3);

  const enrichedStats = {
    ...stats,
    recentAnomalies: anomalies.filter((anomaly: any) => anomaly.severity !== 'low').length,
  };

  const cachedAt = new Date().toISOString();

  const response = {
    stats: enrichedStats,
    forecast,
    topAnomalies,
    upcomingDeadlines,
    nrsHealth,
    pillars,
    taxBreakdown,
    sparkData,
    cachedAt,
  };

  redis.setex(cacheKey, 120, JSON.stringify(response)).catch(() => {});

  return {
    response,
    meta: { cached: false, cacheAge: 0 },
  };
}

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dashboard', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    preHandler: [
      fastify.authenticate,
      fastify.resolveOrgContext,
      requireRole('VIEWER'),
    ],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const { userId } = request.user;

    const { response, meta } = await buildDashboardCompositeResponse(orgId, userId);

    return reply.send({ ...response, meta });
  });
};

async function fetchNrsHealth() {
  // In production, call nrsService health check
  return FALLBACK_NRS_HEALTH;
}

export default dashboardRoutes;
