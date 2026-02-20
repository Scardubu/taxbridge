import type { FastifyInstance } from 'fastify';
import { AIInsightsService } from '../services/ai-insights';
import { AnomalyDetectionService } from '../services/anomaly-detection';
import { TaxHealthScoreService } from '../services/tax-health-score';

export default async function insightsRoutes(fastify: FastifyInstance) {
  const prismaOf = () => (fastify as any).prisma;
  const getLegacy    = () => new AIInsightsService(prismaOf());
  const getAnomalySvc = () => new AnomalyDetectionService(prismaOf());
  const getHealthSvc  = () => new TaxHealthScoreService(prismaOf());

  const auth = { preHandler: [(fastify as any).authenticate] };

  // ── Legacy endpoints (preserved for backward compatibility) ──────────────────

  fastify.get('/api/v1/insights/anomalies', auth, async (req, reply) => {
    const businessId = (req as any)?.user?.businessId as string | undefined;
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
    const businessId = (req as any)?.user?.businessId as string | undefined;
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });
    return reply.send(await getLegacy().predictTaxLiabilities(businessId));
  });

  fastify.get('/api/v1/insights/cashflow-risk', auth, async (req, reply) => {
    const businessId = (req as any)?.user?.businessId as string | undefined;
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });
    return reply.send(await getLegacy().getCashFlowRiskScore(businessId));
  });

  // ── Module 1: Enhanced anomaly endpoints ─────────────────────────────────────

  /**
   * POST /api/v1/insights/anomalies/scan
   * Trigger a fresh full anomaly scan (bypasses cache).
   */
  fastify.post('/api/v1/insights/anomalies/scan', auth, async (req, reply) => {
    const businessId = (req as any)?.user?.businessId as string | undefined;
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
    const businessId = (req as any)?.user?.businessId as string | undefined;
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });

    const ok = await getAnomalySvc().dismissAnomaly(id, businessId);
    return reply.send({ success: ok, dismissedId: id });
  });

  /**
   * GET /api/v1/insights/anomalies/summary
   * Severity counts for the dashboard widget.
   */
  fastify.get('/api/v1/insights/anomalies/summary', auth, async (req, reply) => {
    const businessId = (req as any)?.user?.businessId as string | undefined;
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
    const businessId = (req as any)?.user?.businessId as string | undefined;
    if (!businessId) return reply.code(400).send({ error: 'businessId required' });

    const result = await getHealthSvc().compute(businessId);
    return reply.send(result);
  });
}
