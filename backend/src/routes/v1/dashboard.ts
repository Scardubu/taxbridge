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
import {
  buildIntelligenceInput,
  FALLBACK_STATS,
  FALLBACK_ANOMALIES,
  FALLBACK_DEADLINES,
  FALLBACK_NRS_HEALTH,
} from '../../services/dashboardService';
import { computeAnomalies }   from '../../services/anomalyEngine';
import { computeRiskScore }   from '../../services/riskScoring';

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

    const cacheKey = `dashboard:composite:v1:${orgId}:${userId}`;

    // Cache hit
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        const parsed    = JSON.parse(cached);
        const cacheAge  = Date.now() - (parsed._cachedAt ?? 0);
        return reply.send({ ...parsed, meta: { cached: true, cacheAge } });
      } catch {
        // Malformed cache — fall through
      }
    }

    // Build composite in parallel with per-call FALLBACK on every .catch()
    const [intelligenceInput, nrsHealth] = await Promise.all([
      buildIntelligenceInput(orgId, userId).catch(() => null),
      fetchNrsHealth().catch(() => FALLBACK_NRS_HEALTH),
    ]);

    const input = intelligenceInput ?? { orgId, userId, invoices: [], payments: [], filingHistory: [] };

    const [topAnomalies, riskScore, deadlines] = await Promise.all([
      Promise.resolve(computeAnomalies(input)).catch(() => FALLBACK_ANOMALIES),
      Promise.resolve(computeRiskScore(input)).catch(() => 50),
      fetchDeadlines(orgId).catch(() => FALLBACK_DEADLINES),
    ]);

    const stats = {
      ...FALLBACK_STATS,
      riskScore,
    };

    const response = {
      stats,
      topAnomalies,
      deadlines,
      nrsHealth,
      _cachedAt: Date.now(),
    };

    // Fire-and-forget cache write — never await
    redis.setex(cacheKey, 120, JSON.stringify(response)).catch(() => {});

    return reply.send({ ...response, meta: { cached: false } });
  });
};


async function fetchNrsHealth() {
  // In production, call nrsService health check
  return FALLBACK_NRS_HEALTH;
}

async function fetchDeadlines(_orgId: string) {
  return FALLBACK_DEADLINES;
}

export default dashboardRoutes;
