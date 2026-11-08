import { FastifyInstance } from 'fastify';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError, PrismaClientInitializationError } from '@prisma/client/runtime/library';
import { z } from 'zod';
import { duploClient } from '../integrations/duplo';
import { remitaClient } from '../integrations/remita';
import { requireAdminApiKey } from '../lib/security';

// Type definitions for chart data
interface TrendDataPoint {
  timestamp: string;
  successRate: number;
  latency: number;
  submissions: number;
}

interface TransactionDataPoint {
  date: string;
  successful: number;
  failed: number;
  pending: number;
  total: number;
}

interface VolumeDataPoint {
  date: string;
  volume: number;
  count: number;
}

interface ComplianceDataPoint {
  date: string;
  compliant: number;
  nonCompliant: number;
}

interface SubmissionDataPoint {
  date: string;
  successful: number;
  failed: number;
}

interface MonthlyDataPoint {
  month: string;
  wthAmount: number;
  invoiceCount: number;
}

// ─── C-12: Admin cold-start FALLBACK constants ──────────────────────────────
// Returns 200 + zeroed data when DB is unavailable (Render idle cold-start).
// C-08: No Math.random() — all values are deterministic zeroes.
const FALLBACK_ADMIN_STATS = {
  totalUsers:        0,
  totalInvoices:     0,
  totalPayments:     0,
  duploStatus:       'error' as const,
  duploLatency:      null,
  remitaStatus:      'error' as const,
  remitaLatency:     null,
  duploSuccessTrend: [] as TrendDataPoint[],
  remitaTransactions: [] as TransactionDataPoint[],
  _coldStart:        true,
  warnings:          ['Database unavailable — cold-start mode'],
};

const FALLBACK_LAUNCH_METRICS = {
  currentRevenue:    0,
  prevRevenue:       0,
  currentPayments:   0,
  previousPayments:  0,
  paidUsers:         0,
  paidUsersPrev:     0,
  nrr:               100,
  grr:               100,
  churnedUsers:      0,
  expansionRevenue:  0,
  contractionRevenue: 0,
  newRevenue:        0,
  anomalies:         [] as any[],
  _coldStart:        true,
  warnings:          ['Database unavailable — cold-start mode'],
};

const FALLBACK_ANALYTICS = {
  overview:          { totalUsers: 0, totalInvoices: 0, totalPayments: 0, complianceRate: 0, monthlyGrowth: 0 },
  duploMetrics:      { successTrend: [], errorBreakdown: [], dailySubmissions: [] },
  remitaMetrics:     { transactionTrend: [], paymentBreakdown: [], dailyVolume: [] },
  complianceMetrics: { exemptionUtilization: [], withholdingTaxTracking: [], nrsComplianceTrend: [] },
  _coldStart:        true,
  warnings:          ['Database unavailable — cold-start mode'],
};

export async function adminRoutes(app: FastifyInstance, options: { prisma: PrismaClient }) {
  const { prisma } = options;

  function monthWindow(date: Date) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0));
    return { start, end };
  }

  function asNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    if (typeof value?.toNumber === 'function') return value.toNumber();
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function isMissingPrismaResource(error: unknown): boolean {
    return (
      error instanceof PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    );
  }

  async function safePrisma<T>(
    task: () => Promise<T>,
    fallback: T,
    warningMessage: string,
    warnings: string[]
  ): Promise<T> {
    try {
      return await task();
    } catch (error: unknown) {
      if (isMissingPrismaResource(error)) {
        app.log.warn({ err: error }, warningMessage);
        warnings.push(warningMessage);
        return fallback;
      }
      throw error;
    }
  }

  async function safeExternal<T>(
    task: () => Promise<T>,
    fallback: T,
    warningMessage: string,
    warnings: string[]
  ): Promise<T> {
    try {
      return await task();
    } catch (error: unknown) {
      app.log.warn({ err: error }, warningMessage);
      warnings.push(warningMessage);
      return fallback;
    }
  }

  // Authentication middleware for admin routes
  app.addHook('preHandler', async (request, reply) => {
    await requireAdminApiKey(request, reply);

    if (reply.sent) {
      return reply;
    }
  });

  // Get dashboard statistics
  app.get('/stats', async (request, reply) => {
    try {
      const warnings: string[] = [];

      const [
        totalUsers,
        totalInvoices,
        totalPayments,
        duploHealth,
        remitaHealth
      ] = await Promise.all([
        safePrisma(() => prisma.user.count(), 0, 'Admin stats: users table unavailable', warnings),
        safePrisma(() => prisma.invoice.count(), 0, 'Admin stats: invoices table unavailable', warnings),
        safePrisma(() => prisma.payment.count(), 0, 'Admin stats: payments table unavailable', warnings),
        safeExternal(
          () => duploClient.checkHealth(),
          { status: 'error', latency: null },
          'Admin stats: Duplo health check failed',
          warnings
        ),
        safeExternal(
          () => remitaClient.checkHealth(),
          { status: 'error', latency: null },
          'Admin stats: Remita health check failed',
          warnings
        )
      ]);

      // Get Duplo success trend for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const duploSuccessTrend: Array<{ status: string; createdAt: Date; _count: { status: number } }> = await safePrisma(
        () => prisma.invoice.groupBy({
          by: ['status', 'createdAt'],
          where: {
            createdAt: { gte: sevenDaysAgo },
            status: { in: ['stamped', 'failed'] }
          },
          _count: { status: true }
        }) as any,
        [],
        'Admin stats: duplo trend data unavailable',
        warnings
      );

      // Format the trend data
      const trendData: TrendDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayData = duploSuccessTrend.filter(t => 
          t.createdAt.toISOString().split('T')[0] === dateStr
        );
        
        const successful = dayData.find(d => d.status === 'stamped')?._count.status || 0;
        const failed = dayData.find(d => d.status === 'failed')?._count.status || 0;
        const total = successful + failed;
        
        trendData.push({
          timestamp: date.toISOString(),
          successRate: total > 0 ? (successful / total) * 100 : 0,
          latency: 0, // Latency tracking not available at this tier — C-08: no Math.random()
          submissions: total
        });
      }

      // Get Remita transaction data for the last 7 days
      const remitaTransactions: Array<{ status: string; createdAt: Date; _count: { status: number }; _sum: { amount: any } }> = await safePrisma(
        () => prisma.payment.groupBy({
          by: ['status', 'createdAt'],
          where: {
            createdAt: { gte: sevenDaysAgo }
          },
          _count: { status: true },
          _sum: { amount: true }
        }) as any,
        [],
        'Admin stats: remita transaction data unavailable',
        warnings
      );

      // Format Remita transaction data
      const remitaData: TransactionDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayData = remitaTransactions.filter(t => 
          t.createdAt.toISOString().split('T')[0] === dateStr
        );
        
        const successful = dayData.find(d => d.status === 'paid')?._count.status || 0;
        const failed = dayData.find(d => d.status === 'failed')?._count.status || 0;
        const pending = dayData.find(d => d.status === 'pending')?._count.status || 0;
        
        remitaData.push({
          date: dateStr,
          successful,
          failed,
          pending,
          total: successful + failed + pending
        });
      }

      return {
        totalUsers,
        totalInvoices,
        totalPayments,
        duploStatus: duploHealth.status,
        duploLatency: duploHealth.latency,
        remitaStatus: remitaHealth.status,
        remitaLatency: remitaHealth.latency,
        duploSuccessTrend: trendData,
        remitaTransactions: remitaData,
        warnings: warnings.length ? warnings : undefined
      };
    } catch (error: unknown) {
      app.log.error({ err: error }, 'Error fetching admin stats');
      // C-12: cold-start — return 200 + FALLBACK_ADMIN_STATS so the admin
      // dashboard renders (zeroed but functional) after Render idle cold-start.
      if (
        error instanceof PrismaClientInitializationError ||
        error instanceof PrismaClientKnownRequestError
      ) {
        return reply.code(200).send({
          ...FALLBACK_ADMIN_STATS,
          warnings: [
            error instanceof PrismaClientInitializationError
              ? 'Database connection unavailable — cold-start mode'
              : `Database error ${(error as PrismaClientKnownRequestError).code} — cold-start mode`,
          ],
        });
      }
      return reply.code(200).send({ ...FALLBACK_ADMIN_STATS });
    }
  });

  // Launch metrics: NRR/GRR computed from successful payments month-over-month
  app.get('/launch-metrics', async (_request, reply) => {
    try {
      const warnings: string[] = [];
      const now = new Date();
      const currentWindow = monthWindow(now);
      const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
      const previousWindow = monthWindow(prevMonth);

      const [currentPayments, previousPayments, failedPayments24h] = await Promise.all([
        safePrisma(
          () => prisma.payment.findMany({
            where: {
              createdAt: { gte: currentWindow.start, lt: currentWindow.end },
              status: 'paid'
            },
            select: {
              amount: true,
              createdAt: true,
              invoice: { select: { userId: true } }
            }
          }) as any,
          [],
          'Launch metrics: current payments unavailable',
          warnings
        ),
        safePrisma(
          () => prisma.payment.findMany({
            where: {
              createdAt: { gte: previousWindow.start, lt: previousWindow.end },
              status: 'paid'
            },
            select: {
              amount: true,
              createdAt: true,
              invoice: { select: { userId: true } }
            }
          }) as any,
          [],
          'Launch metrics: previous payments unavailable',
          warnings
        ),
        safePrisma(
          () => prisma.payment.count({
            where: {
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              status: 'failed'
            }
          }),
          0,
          'Launch metrics: failed payment count unavailable',
          warnings
        )
      ]);

      let activeAlerts: Array<{ severity: string; title: string }> = [];
      try {
        activeAlerts = await prisma.alert.findMany({
          where: { resolved: false, severity: { in: ['high', 'critical'] } },
          orderBy: { timestamp: 'desc' },
          take: 5,
          select: { severity: true, title: true }
        });
      } catch (err: unknown) {
        // If migrations haven't created alerts table in an environment yet, don't 500 this endpoint.
        const isKnownPrismaError = err instanceof PrismaClientKnownRequestError;
        app.log.warn({ err, isKnownPrismaError }, 'Launch metrics: alerts unavailable; continuing without alerts');
      }

      const currentByUser = new Map<string, number>();
      const previousByUser = new Map<string, number>();

      for (const payment of currentPayments) {
        const userId = (payment as any).invoice?.userId;
        if (!userId) continue;
        currentByUser.set(userId, (currentByUser.get(userId) || 0) + asNumber((payment as any).amount));
      }

      for (const payment of previousPayments) {
        const userId = (payment as any).invoice?.userId;
        if (!userId) continue;
        previousByUser.set(userId, (previousByUser.get(userId) || 0) + asNumber((payment as any).amount));
      }

      const prevUsers = Array.from(previousByUser.keys());
      const prevRevenueTotal = prevUsers.reduce((acc, userId) => acc + (previousByUser.get(userId) || 0), 0);
      const nrrNumerator = prevUsers.reduce((acc, userId) => acc + (currentByUser.get(userId) || 0), 0);
      const grrNumerator = prevUsers.reduce(
        (acc, userId) => acc + Math.min(currentByUser.get(userId) || 0, previousByUser.get(userId) || 0),
        0
      );

      const nrr = prevRevenueTotal > 0 ? (nrrNumerator / prevRevenueTotal) * 100 : 0;
      const grr = prevRevenueTotal > 0 ? (grrNumerator / prevRevenueTotal) * 100 : 0;

      const mrr = Array.from(currentByUser.values()).reduce((acc, v) => acc + v, 0);
      const mrrPrev = Array.from(previousByUser.values()).reduce((acc, v) => acc + v, 0);

      const churnedUsers = prevUsers.filter((userId) => (currentByUser.get(userId) || 0) === 0).length;
      const expansionRevenue = prevUsers.reduce(
        (acc, userId) => acc + Math.max(0, (currentByUser.get(userId) || 0) - (previousByUser.get(userId) || 0)),
        0
      );
      const contractionRevenue = prevUsers.reduce(
        (acc, userId) => acc + Math.max(0, (previousByUser.get(userId) || 0) - (currentByUser.get(userId) || 0)),
        0
      );

      const newRevenue = Array.from(currentByUser.entries())
        .filter(([userId]) => !previousByUser.has(userId))
        .reduce((acc, [, v]) => acc + v, 0);

      const anomalies: string[] = [];
      if (failedPayments24h > 0) anomalies.push(`Failed payments last 24h: ${failedPayments24h}`);
      for (const alert of activeAlerts) anomalies.push(`${alert.severity.toUpperCase()}: ${alert.title}`);

      return reply.send({
        timestamp: new Date().toISOString(),
        window: {
          current: { start: currentWindow.start.toISOString(), end: currentWindow.end.toISOString() },
          previous: { start: previousWindow.start.toISOString(), end: previousWindow.end.toISOString() }
        },
        mrr,
        mrrPrev,
        paidUsers: currentByUser.size,
        paidUsersPrev: previousByUser.size,
        nrr,
        grr,
        churnedUsers,
        expansionRevenue,
        contractionRevenue,
        newRevenue,
        anomalies,
        warnings: warnings.length ? warnings : undefined
      });
    } catch (error: unknown) {
      app.log.error({ err: error }, 'Error fetching launch metrics');
      // C-12: Return 200 + FALLBACK on cold-start / DB errors so admin panel loads.
      if (
        error instanceof PrismaClientInitializationError ||
        error instanceof PrismaClientKnownRequestError
      ) {
        return reply.code(200).send({ ...FALLBACK_LAUNCH_METRICS });
      }
      return reply.code(200).send({ ...FALLBACK_LAUNCH_METRICS });
    }
  });

  // Get all invoices with pagination
  app.get('/invoices', {
    schema: {
      querystring: z.object({
        page: z.string().optional().default('1'),
        limit: z.string().optional().default('50'),
        status: z.string().optional()
      })
    }
  }, async (request, reply) => {
    try {
      const page = parseInt((request.query as any).page as string);
      const limit = parseInt((request.query as any).limit as string);
      const status = (request.query as any).status as string;

      const where = status ? { status } : {};

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            user: {
              select: {
                name: true,
                phone: true,
                tin: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.invoice.count({ where })
      ]);

      return {
        invoices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error: unknown) {
      app.log.error({ err: error }, 'Error fetching invoices');
      
      if (error instanceof PrismaClientKnownRequestError) {
        return reply.code(503).send({ 
          error: 'Database query failed', 
          code: 'DATABASE_ERROR',
          details: error.code 
        });
      }
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Invalid query parameters', 
          code: 'VALIDATION_ERROR',
          details: error.issues 
        });
      }
      
      return reply.code(500).send({ 
        error: 'Internal server error', 
        code: 'INTERNAL_ERROR' 
      });
    }
  });

  // Legacy Duplo OAuth/XML submission is intentionally disabled.
  // The approved NRS Gateway contract requires NRS JSON, per-business
  // sub-business identity, an approved gateway domain, and idempotency.
  app.post('/invoices/:id/resubmit-duplo', {
    schema: { params: z.object({ id: z.string().uuid() }) }
  }, async (_request, reply) => {
    return reply.code(409).send({
      error: 'NRS gateway integration is not provisioned',
      code: 'NRS_GATEWAY_MIGRATION_REQUIRED',
      retryable: false
    });
  });

  // Daily analytics are grouped by UTC calendar day; period totals are never
  // copied into each day and unsupported tax classifications remain unavailable.
  app.get('/analytics', {
    schema: {
      querystring: z.object({
        range: z.enum(['7d', '30d', '90d']).optional().default('30d')
      })
    }
  }, async (request, reply) => {
    try {
      const range = (request.query as { range: '7d' | '30d' | '90d' }).range;
      const days = Number.parseInt(range, 10);
      const now = new Date();
      const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const startDate = new Date(endDate.getTime() - days * 86400000);
      const previousStartDate = new Date(startDate.getTime() - days * 86400000);

      type DailyInvoiceAggregate = { day: string; status: string; count: number };
      type DailyPaymentAggregate = { day: string; status: string; count: number; amount: Prisma.Decimal | null };

      const [
        totalUsers, totalInvoices, totalPayments, recentUsers, previousUsers,
        stampedInvoices, invoicesByStatus, paymentsByStatus, dailyInvoices, dailyPayments
      ] = await Promise.all([
        prisma.user.count(),
        prisma.invoice.count(),
        prisma.payment.count(),
        prisma.user.count({ where: { createdAt: { gte: startDate, lt: endDate } } }),
        prisma.user.count({ where: { createdAt: { gte: previousStartDate, lt: startDate } } }),
        prisma.invoice.count({ where: { status: 'stamped' } }),
        prisma.invoice.groupBy({ by: ['status'], _count: { status: true } }),
        prisma.payment.groupBy({ by: ['status'], _count: { status: true }, _sum: { amount: true } }),
        prisma.$queryRaw<DailyInvoiceAggregate[]>\`
          SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
                 status, COUNT(*)::int AS count
          FROM invoices
          WHERE created_at >= \${startDate} AND created_at < \${endDate}
          GROUP BY DATE_TRUNC('day', created_at), status
        \`,
        prisma.$queryRaw<DailyPaymentAggregate[]>\`
          SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
                 status, COUNT(*)::int AS count, SUM(amount) AS amount
          FROM payments
          WHERE created_at >= \${startDate} AND created_at < \${endDate}
          GROUP BY DATE_TRUNC('day', created_at), status
        \`
      ]);

      const monthlyGrowth = previousUsers > 0
        ? ((recentUsers - previousUsers) / previousUsers) * 100
        : recentUsers > 0 ? 100 : 0;
      const complianceRate = totalInvoices > 0 ? (stampedInvoices / totalInvoices) * 100 : 0;
      const invoiceDays = new Map<string, Map<string, number>>();
      const paymentDays = new Map<string, Map<string, { count: number; amount: number }>>();

      for (const row of dailyInvoices) {
        const statuses = invoiceDays.get(row.day) || new Map<string, number>();
        statuses.set(row.status, row.count);
        invoiceDays.set(row.day, statuses);
      }
      for (const row of dailyPayments) {
        const statuses = paymentDays.get(row.day) || new Map<string, { count: number; amount: number }>();
        statuses.set(row.status, { count: row.count, amount: asNumber(row.amount) });
        paymentDays.set(row.day, statuses);
      }

      const successTrend: TrendDataPoint[] = [];
      const dailySubmissions: SubmissionDataPoint[] = [];
      const transactionTrend: TransactionDataPoint[] = [];
      const volumeData: VolumeDataPoint[] = [];
      const complianceTrend: ComplianceDataPoint[] = [];

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 86400000);
        const dateStr = date.toISOString().slice(0, 10);
        const invoiceStatuses = invoiceDays.get(dateStr) || new Map<string, number>();
        const paymentStatuses = paymentDays.get(dateStr) || new Map<string, { count: number; amount: number }>();
        const stamped = invoiceStatuses.get('stamped') || 0;
        const failed = invoiceStatuses.get('failed') || 0;
        const submissions = stamped + failed;
        const paid = paymentStatuses.get('paid')?.count || 0;
        const pending = paymentStatuses.get('pending')?.count || 0;
        const failedPayments = paymentStatuses.get('failed')?.count || 0;
        const dayVolume = Array.from(paymentStatuses.values()).reduce((sum, value) => sum + value.amount, 0);
        const dayPaymentCount = Array.from(paymentStatuses.values()).reduce((sum, value) => sum + value.count, 0);

        successTrend.push({
          timestamp: date.toISOString(),
          successRate: submissions > 0 ? (stamped / submissions) * 100 : 0,
          latency: 0,
          submissions
        });
        dailySubmissions.push({ date: dateStr, successful: stamped, failed });
        transactionTrend.push({
          date: dateStr, successful: paid, failed: failedPayments, pending, total: dayPaymentCount
        });
        volumeData.push({ date: dateStr, volume: dayVolume, count: dayPaymentCount });
        complianceTrend.push({ date: dateStr, compliant: stamped, nonCompliant: failed });
      }

      const paymentBreakdown = paymentsByStatus.map((payment) => ({
        status: payment.status === 'paid' ? 'successful' : payment.status,
        count: payment._count.status,
        amount: asNumber(payment._sum.amount)
      }));
      const errorBreakdown = invoicesByStatus
        .filter((status) => status.status === 'failed' || status.status === 'queued')
        .map((status) => ({
          error: status.status === 'failed' ? 'Submission Failed' : 'Pending Queue',
          count: status._count.status,
          percentage: totalInvoices > 0 ? Math.round((status._count.status / totalInvoices) * 100) : 0
        }));

      return {
        overview: {
          totalUsers, totalInvoices, totalPayments,
          complianceRate: Math.round(complianceRate),
          monthlyGrowth: Math.round(monthlyGrowth)
        },
        duploMetrics: { successTrend, errorBreakdown, dailySubmissions },
        remitaMetrics: { transactionTrend, paymentBreakdown, dailyVolume: volumeData },
        complianceMetrics: {
          exemptionUtilization: [],
          withholdingTaxTracking: [],
          nrsComplianceTrend: complianceTrend
        },
        dataWindow: { start: startDate.toISOString(), end: endDate.toISOString(), days }
      };
    } catch (error: unknown) {
      app.log.error({ err: error }, 'Error fetching analytics');
      return reply.code(503).send({
        error: 'Analytics data is temporarily unavailable',
        code: 'ANALYTICS_UNAVAILABLE',
        retryable: true
      });
    }
  });
}

// Helper functions to generate mock data
// C-08: deterministic fallback — no Math.random() allowed in admin chart data.
function generateMockTrendData(days: number, _type: string): TrendDataPoint[] {
  const data: TrendDataPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      timestamp:   date.toISOString(),
      successRate: 0,   // zeroed until real DB data available
      latency:     0,
      submissions: 0,
    });
  }
  return data;
}

// C-08: deterministic fallback — no Math.random() allowed in admin chart data.
function generateMockDailyData(
  days: number,
  type: string,
): Array<TransactionDataPoint | VolumeDataPoint | SubmissionDataPoint | ComplianceDataPoint> {
  const data: Array<TransactionDataPoint | VolumeDataPoint | SubmissionDataPoint | ComplianceDataPoint> = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    if (type === 'transactions') {
      data.push({ date: dateStr, successful: 0, failed: 0, pending: 0, total: 0 } as TransactionDataPoint);
    } else if (type === 'volume') {
      data.push({ date: dateStr, volume: 0, count: 0 } as VolumeDataPoint);
    } else if (type === 'submissions') {
      data.push({ date: dateStr, successful: 0, failed: 0 } as SubmissionDataPoint);
    } else if (type === 'compliance') {
      data.push({ date: dateStr, compliant: 0, nonCompliant: 0 } as ComplianceDataPoint);
    }
  }
  return data;
}

// C-08: deterministic fallback — no Math.random() allowed in admin chart data.
function generateMockMonthlyData(months: number): MonthlyDataPoint[] {
  const data: MonthlyDataPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    data.push({
      month:        date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      wthAmount:    0,   // zeroed until real WHT tracking schema is available
      invoiceCount: 0,
    });
  }
  return data;
}
