/**
 * Analytics Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v2'
 * 5 endpoints for admin panels (ADMIN+)
 * C-07: Always 200 — FALLBACK_* on every .catch()
 */
import { FastifyPluginAsync }  from 'fastify';
import { requireRole }         from '../../plugins/requireRole';
import { prisma }              from '../../lib/prisma';

const FALLBACK_EMPTY = { data: [], meta: { total: 0 } };

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  const adminMiddleware = [fastify.authenticate, requireRole('ADMIN')];

  // 1. Revenue trends
  fastify.get('/analytics/revenue-trends', {
    preHandler: adminMiddleware,
  }, async (_request, reply) => {
    const data = await (prisma as any).invoice.groupBy({
      by:      ['createdAt'],
      _sum:    { totalAmount: true, vatAmount: true },
      orderBy: { createdAt: 'desc' },
      take:    12,
    }).catch(() => []);

    return reply.send({ data });
  });

  // 2. Compliance rate
  fastify.get('/analytics/compliance-rate', {
    preHandler: adminMiddleware,
  }, async (_request, reply) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [total, onTime] = await Promise.all([
      (prisma as any).taxReturn.count({
        where: { submittedAt: { gte: sixMonthsAgo } },
      }).catch(() => 0),
      (prisma as any).taxReturn.count({
        where: { submittedAt: { gte: sixMonthsAgo }, onTime: true },
      }).catch(() => 0),
    ]);

    const rate = total > 0 ? onTime / total : 0;
    return reply.send({ rate, total, onTime, period: '6months' });
  });

  // 3. Risk distribution
  fastify.get('/analytics/risk-distribution', {
    preHandler: adminMiddleware,
  }, async (_request, reply) => {
    const data = await (prisma as any).sMERiskRecord?.groupBy({
      by:    ['riskBand'],
      _count: { _all: true },
    }).catch(() => []) ?? [];

    return reply.send({ data });
  });

  // 4. NRS stamp health
  fastify.get('/analytics/nrs-health', {
    preHandler: adminMiddleware,
  }, async (_request, reply) => {
    const data = await (prisma as any).nRSAuditLog?.findMany({
      where:   { createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      orderBy: { createdAt: 'desc' },
      take:    100,
    }).catch(() => []) ?? [];

    return reply.send({ data });
  });

  // 5. Platform growth
  fastify.get('/analytics/platform-growth', {
    preHandler: adminMiddleware,
  }, async (_request, reply) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const [newOrgs, newUsers] = await Promise.all([
      (prisma as any).organisation?.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }).catch(() => 0) ?? 0,
      (prisma as any).user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }).catch(() => 0),
    ]);

    return reply.send({ newOrgs, newUsers, period: '30days' });
  });
};

export default analyticsRoutes;
