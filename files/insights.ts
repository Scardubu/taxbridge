import type { FastifyInstance } from 'fastify';
import { AIInsightsService } from '../services/ai-insights.js';

export default async function insightsRoutes(fastify: FastifyInstance) {
  // Lazy instantiate — prisma is available after plugin registration
  const getService = () => new AIInsightsService((fastify as any).prisma);

  /**
   * GET /api/v1/insights/anomalies
   * Returns expense anomalies for the authenticated user's business
   */
  fastify.get(
    '/api/v1/insights/anomalies',
    { preHandler: [(fastify as any).authenticate] },
    async (req, reply) => {
      const { businessId } = (req as any).user;
      if (!businessId) {
        return reply.code(400).send({ error: 'businessId required' });
      }
      const anomalies = await getService().detectExpenseAnomalies(businessId);
      return reply.send({ anomalies, count: anomalies.length });
    }
  );

  /**
   * GET /api/v1/insights/tax-prediction
   * Returns quarterly tax liability prediction for the business
   */
  fastify.get(
    '/api/v1/insights/tax-prediction',
    { preHandler: [(fastify as any).authenticate] },
    async (req, reply) => {
      const { businessId } = (req as any).user;
      if (!businessId) {
        return reply.code(400).send({ error: 'businessId required' });
      }
      const prediction = await getService().predictTaxLiabilities(businessId);
      return reply.send(prediction);
    }
  );

  /**
   * GET /api/v1/insights/cashflow-risk
   * Returns 0–100 risk score and contributing factors
   */
  fastify.get(
    '/api/v1/insights/cashflow-risk',
    { preHandler: [(fastify as any).authenticate] },
    async (req, reply) => {
      const { businessId } = (req as any).user;
      if (!businessId) {
        return reply.code(400).send({ error: 'businessId required' });
      }
      const risk = await getService().getCashFlowRiskScore(businessId);
      return reply.send(risk);
    }
  );

  /**
   * GET /api/v1/admin/aggregate-anomalies
   * Admin-only: platform-wide anomaly summary across top 50 businesses
   */
  fastify.get(
    '/api/v1/admin/aggregate-anomalies',
    { preHandler: [(fastify as any).authenticateAdmin] },
    async (_req, reply) => {
      const summary = await getService().getAggregateAnomalies();
      return reply.send(summary);
    }
  );
}
