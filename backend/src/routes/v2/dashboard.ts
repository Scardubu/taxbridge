/**
 * TaxBridge — API v2 Dashboard Route
 * GET /api/v2/dashboard
 *
 * Wraps the existing composite logic in the v2 ApiResponse envelope.
 * Adds deprecation header on v1 when accessed through v2-aware clients.
 *
 * Preserves full backward compatibility with v1.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import {
  forecastQuarterlyTax,
  detectExpenseAnomalies,
  getDashboardStats,
  getPillarScores,
  getTaxBreakdownSlices,
  getSparkData,
} from '../../services/tax-intelligence';
import { getUpcomingDeadlines } from '../../services/compliance-calendar';
import { getPrismaClient } from '../../lib/prisma';
import { getRedisConnection } from '../../queue/client';
import { successResponse, errorResponse } from '../../lib/api-envelope';
import { createLogger } from '../../lib/logger';

const log = createLogger('v2-dashboard');
const prisma = getPrismaClient();

// ─── Shared auth preHandler ──────────────────────────────────────────────────

async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = typeof req.headers?.authorization === 'string'
    ? req.headers.authorization : '';
  if (!authHeader.startsWith('Bearer ')) {
    return reply.code(401).send(errorResponse('Unauthorized', 'AUTH_REQUIRED'));
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
  if (!userId) return reply.code(401).send(errorResponse('Invalid or expired token', 'AUTH_INVALID'));
  (req as any).user = { id: userId };
}

// ─── Route ───────────────────────────────────────────────────────────────────

export default async function v2DashboardRoute(fastify: FastifyInstance) {
  fastify.get('/api/v2/dashboard', {
    preHandler: [authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id as string;
    const cacheKey = `dashboard:composite:v2:${userId}`;

    // Cache check
    try {
      const redis = getRedisConnection();
      const cached = redis ? await redis.get(cacheKey) : null;
      if (cached) {
        return reply.send(successResponse(JSON.parse(cached), {
          fromCache: true,
          requestId: request.id,
        }));
      }
    } catch { /* proceed to compute */ }

    // Compute all data in parallel (C-07: partial failure is ok)
    const [
      statsResult,
      forecastResult,
      anomaliesResult,
      deadlinesResult,
      pillarsResult,
      taxBreakdownResult,
      sparkDataResult,
    ] = await Promise.allSettled([
      getDashboardStats(userId, prisma),
      forecastQuarterlyTax(userId, prisma),
      detectExpenseAnomalies(userId, prisma, 30),
      getUpcomingDeadlines(userId, prisma, 30),
      getPillarScores(userId, prisma),
      getTaxBreakdownSlices(userId, prisma),
      getSparkData(userId, prisma),
    ]);

    const stats     = statsResult.status     === 'fulfilled' ? statsResult.value : { totalInvoices: 0, totalRevenue: 0, pendingNrs: 0, vatLiability: 0, taxHealthScore: 0, recentAnomalies: 0 };
    const forecast  = forecastResult.status  === 'fulfilled' ? forecastResult.value : null;
    const anomalies = anomaliesResult.status === 'fulfilled' ? anomaliesResult.value : [];
    const deadlines = deadlinesResult.status === 'fulfilled' ? deadlinesResult.value : [];
    const pillars   = pillarsResult.status   === 'fulfilled' ? pillarsResult.value : [];
    const taxBreak  = taxBreakdownResult.status === 'fulfilled' ? taxBreakdownResult.value : [];
    const spark     = sparkDataResult.status === 'fulfilled' ? sparkDataResult.value : [];

    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const topAnomalies = anomalies
      .filter((a: any) => a.severity !== 'low')
      .sort((a: any, b: any) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 3);

    const data = {
      stats: { ...stats, recentAnomalies: anomalies.filter((a: any) => a.severity !== 'low').length },
      forecast,
      topAnomalies,
      upcomingDeadlines: deadlines,
      pillars,
      taxBreakdown: taxBreak,
      sparkData: spark,
      cachedAt: new Date().toISOString(),
    };

    // Cache
    try {
      const redis = getRedisConnection();
      if (redis) await redis.setex(cacheKey, 120, JSON.stringify(data));
    } catch { /* non-fatal */ }

    return reply.send(successResponse(data, { requestId: request.id }));
  });
}
