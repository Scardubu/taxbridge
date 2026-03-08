import type { FastifyInstance } from 'fastify';
import { AIInsightsService } from '../services/ai-insights';
import { AnomalyDetectionService } from '../services/anomaly-detection';
import { TaxHealthScoreService } from '../services/tax-health-score';
import {
  forecastQuarterlyTax,
  detectExpenseAnomalies,
  getDashboardStats,
  computeTaxHealthScore,
} from '../services/tax-intelligence';

export default async function insightsRoutes(fastify: FastifyInstance) {
  const prismaOf = () => (fastify as any).prisma;
  const redisOf = () => (fastify as any).redis;
  const getLegacy    = () => new AIInsightsService(prismaOf());
  const getAnomalySvc = () => new AnomalyDetectionService(prismaOf());
  const getHealthSvc  = () => new TaxHealthScoreService(prismaOf());

  const auth = {
    preHandler: [fastify.authenticate, fastify.resolveOrgContext],
  };

  const getUserId = (req: any): string | undefined => {
    const candidate = req?.user?.userId;
    return typeof candidate === 'string' ? candidate : undefined;
  };

  const getBusinessId = (req: any): string | undefined => {
    const orgId = req?.orgContext?.orgId;
    if (typeof orgId === 'string' && orgId) return orgId;
    const candidate = req?.user?.businessId;
    return typeof candidate === 'string' ? candidate : undefined;
  };

  fastify.get('/api/v1/dashboard/stats', {
    ...auth,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = getUserId(req as any);
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const cacheKey = `dashboard:stats:${userId}`;
    const redis = redisOf();

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return reply.send({ success: true, data: JSON.parse(cached) });
      }
    }

    const [stats, anomalies] = await Promise.all([
      getDashboardStats(userId, prismaOf()),
      detectExpenseAnomalies(userId, prismaOf(), 30),
    ]);

    const data = {
      ...stats,
      recentAnomalies: anomalies.filter((a) => a.severity !== 'low').length,
    };

    if (redis) {
      await redis.setex(cacheKey, 120, JSON.stringify(data));
    }

    return reply.send({ success: true, data });
  });

  fastify.get('/api/v1/insights/forecast', {
    ...auth,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = getUserId(req as any);
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const cacheKey = `insights:forecast:${userId}`;
    const redis = redisOf();

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return reply.send({ success: true, data: JSON.parse(cached) });
      }
    }

    const forecast = await forecastQuarterlyTax(userId, prismaOf());

    if (redis) {
      await redis.setex(cacheKey, 600, JSON.stringify(forecast));
    }

    return reply.send({ success: true, data: forecast });
  });

  fastify.get('/api/v1/insights/health', auth, async (req, reply) => {
    const userId = getUserId(req as any);
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const health = await computeTaxHealthScore(userId, prismaOf());
    return reply.send({ success: true, data: health });
  });

  // NOTE: GET /api/v1/nrs/health is registered by nrs-status.ts — do not duplicate here

  // ── Legacy endpoints (preserved for backward compatibility) ──────────────────

  fastify.get('/api/v1/insights/anomalies', auth, async (req, reply) => {
    const businessId = getBusinessId(req as any);
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });

    // Prefer enhanced 9-signal engine; fall back to legacy on error
    try {
      const anomalies = await getAnomalySvc().scanAll(businessId);
      return reply.send({ anomalies, count: anomalies.length });
    } catch {
      const anomalies = await getLegacy().detectExpenseAnomalies(businessId);
      return reply.send({ anomalies, count: anomalies.length });
    }
  });

  fastify.get('/api/v1/insights/tax-prediction', auth, async (req, reply) => {
    const businessId = getBusinessId(req as any);
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });
    return reply.send(await getLegacy().predictTaxLiabilities(businessId));
  });

  fastify.get('/api/v1/insights/cashflow-risk', auth, async (req, reply) => {
    const businessId = getBusinessId(req as any);
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });
    return reply.send(await getLegacy().getCashFlowRiskScore(businessId));
  });

  // ── Module 1: Enhanced anomaly endpoints ─────────────────────────────────────

  /**
   * POST /api/v1/insights/anomalies/scan
   * Trigger a fresh full anomaly scan (bypasses cache).
   */
  fastify.post('/api/v1/insights/anomalies/scan', auth, async (req, reply) => {
    const businessId = getBusinessId(req as any);
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });

    // Kick off scan — returns immediately with results
    const anomalies = await getAnomalySvc().scanAll(businessId);
    return reply.send({ anomalies, count: anomalies.length, scannedAt: new Date().toISOString() });
  });

  /**
   * POST /api/v1/insights/anomalies/:id/dismiss
   * Mark an anomaly as a false positive.
   */
  fastify.post('/api/v1/insights/anomalies/:id/dismiss', auth, async (req, reply) => {
    const { id }     = req.params as { id: string };
    const businessId = getBusinessId(req as any);
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });

    const ok = await getAnomalySvc().dismissAnomaly(id, businessId);
    return reply.send({ success: ok, dismissedId: id });
  });

  /**
   * GET /api/v1/insights/anomalies/summary
   * Severity counts for the dashboard widget.
   */
  fastify.get('/api/v1/insights/anomalies/summary', auth, async (req, reply) => {
    const businessId = getBusinessId(req as any);
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });

    const summary = await getAnomalySvc().getSummary(businessId);
    return reply.send({ summary, computedAt: new Date().toISOString() });
  });

  // ── Module 3: Tax Health Score ────────────────────────────────────────────────

  /**
   * GET /api/v1/insights/tax-health-score
   * Returns the 0–100 health score with component breakdown, grade, and trend.
   */
  fastify.get('/api/v1/insights/tax-health-score', auth, async (req, reply) => {
    const businessId = getBusinessId(req as any);
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });

    const result = await getHealthSvc().compute(businessId);
    return reply.send(result);
  });

  // ── ER-04: Tax Health Trend ────────────────────────────────────────────────

  /**
   * GET /api/v1/insights/trends?days=7
   * Returns the last N daily tax health scores as a trend array.
   * C-01: uses (prisma as any) — never Prisma.XxxWhereInput
   */
  fastify.get('/api/v1/insights/trends', {
    ...auth,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId     = getUserId(req as any);
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const rawDays = (req.query as any)?.days;
    const days    = Math.min(Math.max(Number(rawDays) || 7, 1), 90);

    const cacheKey = `insights:trends:${userId}:${days}`;
    const redis    = redisOf();

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return reply.send(JSON.parse(cached));
      }
    }

    const since = new Date(Date.now() - days * 86_400_000);

    // C-01: raw prisma via `as any`
    const snapshots: Array<{ totalScore: number; computedAt: Date }> =
      await (prismaOf() as any).taxHealthSnapshot.findMany({
        where:   { userId, computedAt: { gte: since } },
        select:  { totalScore: true, computedAt: true },
        orderBy: { computedAt: 'asc' },
        take:    days,
      });

    const trend: number[] = snapshots.map((s) => Math.round(s.totalScore));
    const body = { trend, days, computedAt: new Date().toISOString() };

    if (redis) {
      await redis.set(cacheKey, JSON.stringify(body), 'EX', 300); // 5-min TTL
    }

    return reply.send(body);
  });
}
