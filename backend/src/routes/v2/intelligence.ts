/**
 * TaxBridge — API v2 Intelligence Route
 * GET  /api/v2/intelligence/anomalies
 * GET  /api/v2/intelligence/forecast
 * GET  /api/v2/intelligence/health-score
 * GET  /api/v2/intelligence/trends
 *
 * AI-driven tax insights with risk prioritization (P5).
 * All data from real DB — no Math.random() (C-08).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, errorResponse } from '../../lib/api-envelope';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import {
  detectExpenseAnomalies,
  forecastQuarterlyTax,
  computeTaxHealthScore,
  getPillarScores,
} from '../../services/tax-intelligence';

// ─── Routes ──────────────────────────────────────────────────────────────────

export default async function v2IntelligenceRoute(fastify: FastifyInstance) {

  // ── Anomalies with AI explanations and risk prioritization ────────────────
  fastify.get('/api/v2/intelligence/anomalies', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const query = request.query as { days?: string; severity?: string };
    const lookbackDays = Math.min(Number(query.days) || 90, 365);
    const severityFilter = query.severity;

    try {
      let anomalies = await detectExpenseAnomalies(userId, prisma, lookbackDays);

      if (severityFilter && ['high', 'medium', 'low'].includes(severityFilter)) {
        anomalies = anomalies.filter((a) => a.severity === severityFilter);
      }

      // Risk prioritization: high severity + high amount = top priority
      const prioritized = anomalies.map((a, index) => ({
        ...a,
        riskScore: computeRiskScore(a.severity, a.amount),
        rank: index + 1,
      })).sort((a, b) => b.riskScore - a.riskScore);

      return reply.send(successResponse({
        anomalies: prioritized,
        total: prioritized.length,
        highCount: prioritized.filter(a => a.severity === 'high').length,
        mediumCount: prioritized.filter(a => a.severity === 'medium').length,
        lowCount: prioritized.filter(a => a.severity === 'low').length,
        lookbackDays,
      }, { requestId: request.id }));
    } catch (error) {
      request.log.error({ userId, error }, 'Failed to get anomalies');
      return reply.send(successResponse({
        anomalies: [],
        total: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        lookbackDays,
      }, { requestId: request.id }));
    }
  });

  // ── Quarterly forecast ─────────────────────────────────────────────────────
  fastify.get('/api/v2/intelligence/forecast', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;

    try {
      const forecast = await forecastQuarterlyTax(userId, prisma);

      // Deadline risk forecasting: how close to next deadline and estimated liability
      const deadlineRisk = computeDeadlineRisk(forecast.nextDeadline, forecast.forecastedLiability);

      return reply.send(successResponse({
        ...forecast,
        deadlineRisk,
      }, { requestId: request.id }));
    } catch (error) {
      request.log.error({ userId, error }, 'Failed to compute forecast');
      return reply.code(500).send(errorResponse('Forecast unavailable', 'FORECAST_FAILED'));
    }
  });

  // ── Health score with trends ───────────────────────────────────────────────
  fastify.get('/api/v2/intelligence/health-score', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;

    try {
      // P10: Redis cache for health score (60s TTL — lower than dashboard composite)
      const cacheKey = `intelligence:health:${userId}`;
      try {
        const cached = redis ? await redis.get(cacheKey) : null;
        if (cached) {
          reply.header('X-Cache', 'HIT');
          return reply.send(successResponse(JSON.parse(cached), { requestId: request.id }));
        }
      } catch { /* cache miss — compute fresh */ }

      const [health, pillars] = await Promise.all([
        computeTaxHealthScore(userId, prisma),
        getPillarScores(userId, prisma),
      ]);

      // Fetch historical snapshots for trend data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let trendData: Array<{ score: number; date: string }> = [];
      try {
        const snapshots = await (prisma as any).taxHealthSnapshot.findMany({
          where: { userId, computedAt: { gte: thirtyDaysAgo } },
          orderBy: { computedAt: 'asc' },
          select: { totalScore: true, computedAt: true },
        });
        trendData = snapshots.map((s: any) => ({
          score: s.totalScore,
          date: s.computedAt.toISOString().split('T')[0],
        }));
      } catch { /* trend data optional */ }

      // Compute trend direction
      const trend = trendData.length >= 2
        ? trendData[trendData.length - 1].score > trendData[0].score
          ? 'improving'
          : trendData[trendData.length - 1].score < trendData[0].score
            ? 'declining'
            : 'stable'
        : 'stable';

      const payload = {
        ...health,
        pillars,
        trend,
        trendData,
      };

      // P10: cache for 60s
      try {
        if (redis) await redis.setex(cacheKey, 60, JSON.stringify(payload));
      } catch { /* non-fatal */ }

      reply.header('X-Cache', 'MISS');
      return reply.send(successResponse(payload, { requestId: request.id }));
    } catch (error) {
      request.log.error({ userId, error }, 'Failed to compute health score');
      return reply.code(500).send(errorResponse('Health score unavailable', 'HEALTH_SCORE_FAILED'));
    }
  });

  // ── Trends endpoint (CF-05) ─────────────────────────────────────────────────
  fastify.get('/api/v2/intelligence/trends', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const query = request.query as { days?: string };
    const days = Math.min(Number(query.days) || 30, 90);

    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const snapshots = await (prisma as any).taxHealthSnapshot.findMany({
        where: { userId, computedAt: { gte: sinceDate } },
        orderBy: { computedAt: 'asc' },
        select: {
          totalScore: true,
          grade: true,
          filingTimeliness: true,
          dataCompleteness: true,
          complianceCalendar: true,
          nrsSubmissions: true,
          paymentHistory: true,
          trend: true,
          computedAt: true,
        },
      });

      return reply.send(successResponse({
        snapshots: snapshots.map((s: any) => ({
          score: s.totalScore,
          grade: s.grade,
          pillars: {
            filingTimeliness: s.filingTimeliness,
            dataCompleteness: s.dataCompleteness,
            complianceCalendar: s.complianceCalendar,
            nrsSubmissions: s.nrsSubmissions,
            paymentHistory: s.paymentHistory,
          },
          trend: s.trend,
          date: s.computedAt.toISOString().split('T')[0],
        })),
        period: { days, from: sinceDate.toISOString().split('T')[0] },
      }, { requestId: request.id }));
    } catch (error) {
      request.log.error({ userId, error }, 'Failed to get trend data');
      return reply.send(successResponse({
        snapshots: [],
        period: { days, from: new Date().toISOString().split('T')[0] },
      }, { requestId: request.id }));
    }
  });
}

// ─── Risk computation helpers ─────────────────────────────────────────────────

function computeRiskScore(severity: string, amount: number): number {
  const severityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sw = severityWeight[severity] ?? 1;

  // Amount bucket: ₦0-50k=1, ₦50k-200k=2, ₦200k-1M=3, ₦1M+=4
  const amountBucket = amount < 50_000 ? 1
    : amount < 200_000 ? 2
    : amount < 1_000_000 ? 3
    : 4;

  return sw * 25 + amountBucket * 10;
}

function computeDeadlineRisk(
  nextDeadline: string,
  forecastedLiability: number,
): { level: 'low' | 'medium' | 'high' | 'critical'; daysRemaining: number; message: string } {
  const daysRemaining = Math.ceil(
    (new Date(nextDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  if (daysRemaining <= 3) {
    return {
      level: 'critical',
      daysRemaining,
      message: `Filing deadline in ${daysRemaining} day(s). Estimated liability: ₦${forecastedLiability.toLocaleString('en-NG')}`,
    };
  }
  if (daysRemaining <= 7) {
    return {
      level: 'high',
      daysRemaining,
      message: `Filing deadline approaching in ${daysRemaining} days`,
    };
  }
  if (daysRemaining <= 14) {
    return {
      level: 'medium',
      daysRemaining,
      message: `${daysRemaining} days until next filing deadline`,
    };
  }
  return {
    level: 'low',
    daysRemaining,
    message: `Next deadline in ${daysRemaining} days — you're on track`,
  };
}
