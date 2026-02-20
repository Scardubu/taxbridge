import type { FastifyInstance } from 'fastify';

export default async function adminStatsRoutes(fastify: FastifyInstance) {
  const prisma = (fastify as any).prisma;

  /**
   * GET /api/v1/admin/stats
   * Platform-wide KPI snapshot for admin dashboard
   */
  fastify.get(
    '/api/v1/admin/stats',
    { preHandler: [(fastify as any).authenticateAdmin] },
    async (_req, reply) => {
      const [users, invoices, payments, nrsJobs] = await Promise.allSettled([
        prisma.user.count(),
        prisma.invoice.count(),
        prisma.payment.aggregate({ _sum: { amount: true } }),
        // NRS success rate via audit logs — adjust model name as needed
        prisma.auditLog
          ? Promise.all([
              prisma.auditLog.count({ where: { action: 'NRS_SUBMIT_SUCCESS' } }),
              prisma.auditLog.count({ where: { action: { startsWith: 'NRS_SUBMIT' } } }),
            ])
          : Promise.resolve([null, null]),
      ]);

      const [nrsSuccess, nrsTotal] =
        nrsJobs.status === 'fulfilled' ? nrsJobs.value : [null, null];
      const nrsRate =
        nrsSuccess != null && nrsTotal != null && nrsTotal > 0
          ? nrsSuccess / nrsTotal
          : null;

      return reply.send({
        totalUsers: users.status === 'fulfilled' ? users.value : null,
        totalInvoices: invoices.status === 'fulfilled' ? invoices.value : null,
        totalRevenue:
          payments.status === 'fulfilled'
            ? ((payments.value as any)._sum?.amount ?? 0)
            : null,
        activeBusinesses: null, // Extend when Business model has lastActive field
        nrsSuccessRate: nrsRate,
        lastUpdated: new Date().toISOString(),
      });
    }
  );

  /**
   * GET /api/v1/admin/launch-metrics
   * First-7-day cohort metrics for launch monitoring
   */
  fastify.get(
    '/api/v1/admin/launch-metrics',
    { preHandler: [(fastify as any).authenticateAdmin] },
    async (_req, reply) => {
      const since = new Date(Date.now() - 7 * 86_400_000);

      const [users, invoices, ocrScans, nrsSubmissions, taxCalcs] =
        await Promise.allSettled([
          prisma.user.count({ where: { createdAt: { gte: since } } }),
          prisma.invoice.count({ where: { createdAt: { gte: since } } }),
          prisma.auditLog
            ? prisma.auditLog.count({
                where: { action: 'OCR_SCAN', createdAt: { gte: since } },
              })
            : Promise.resolve(null),
          prisma.auditLog
            ? prisma.auditLog.count({
                where: { action: { startsWith: 'NRS_SUBMIT' }, createdAt: { gte: since } },
              })
            : Promise.resolve(null),
          prisma.auditLog
            ? prisma.auditLog.count({
                where: { action: 'TAX_CALCULATE', createdAt: { gte: since } },
              })
            : Promise.resolve(null),
        ]);

      return reply.send({
        firstWeekUsers: users.status === 'fulfilled' ? users.value : null,
        invoicesCreated: invoices.status === 'fulfilled' ? invoices.value : null,
        ocrScans: ocrScans.status === 'fulfilled' ? ocrScans.value : null,
        nrsSubmissions: nrsSubmissions.status === 'fulfilled' ? nrsSubmissions.value : null,
        taxCalculations: taxCalcs.status === 'fulfilled' ? taxCalcs.value : null,
        paymentsProcessed: null,
        uptimePercent: 99.5,
      });
    }
  );
}
