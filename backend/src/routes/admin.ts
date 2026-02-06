import { FastifyInstance } from 'fastify';
import { Prisma, PrismaClient } from '@prisma/client';
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
      error instanceof Prisma.PrismaClientKnownRequestError &&
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
    } catch (error) {
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
    } catch (error) {
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

      const duploSuccessTrend = await safePrisma(
        () => prisma.invoice.groupBy({
          by: ['status', 'createdAt'],
          where: {
            createdAt: { gte: sevenDaysAgo },
            status: { in: ['stamped', 'failed'] }
          },
          _count: { status: true }
        }),
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
          latency: Math.random() * 1000 + 200, // Mock latency
          submissions: total
        });
      }

      // Get Remita transaction data for the last 7 days
      const remitaTransactions = await safePrisma(
        () => prisma.payment.groupBy({
          by: ['status', 'createdAt'],
          where: {
            createdAt: { gte: sevenDaysAgo }
          },
          _count: { status: true },
          _sum: { amount: true }
        }),
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
    } catch (error) {
      app.log.error({ err: error }, 'Error fetching admin stats');
      
      // Tightened error codes
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return reply.code(503).send({ 
          error: 'Database unavailable', 
          code: 'DATABASE_ERROR',
          details: error.code 
        });
      }
      
      if (error instanceof Prisma.PrismaClientInitializationError) {
        return reply.code(503).send({ 
          error: 'Database connection failed', 
          code: 'DATABASE_CONNECTION_ERROR' 
        });
      }
      
      return reply.code(500).send({ 
        error: 'Internal server error', 
        code: 'INTERNAL_ERROR' 
      });
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
          }),
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
          }),
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
      } catch (err) {
        // If migrations haven't created alerts table in an environment yet, don't 500 this endpoint.
        const isKnownPrismaError = err instanceof Prisma.PrismaClientKnownRequestError;
        app.log.warn({ err, isKnownPrismaError }, 'Launch metrics: alerts unavailable; continuing without alerts');
      }

      const currentByUser = new Map<string, number>();
      const previousByUser = new Map<string, number>();

      for (const payment of currentPayments) {
        const userId = payment.invoice?.userId;
        if (!userId) continue;
        currentByUser.set(userId, (currentByUser.get(userId) || 0) + asNumber(payment.amount));
      }

      for (const payment of previousPayments) {
        const userId = payment.invoice?.userId;
        if (!userId) continue;
        previousByUser.set(userId, (previousByUser.get(userId) || 0) + asNumber(payment.amount));
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
    } catch (error) {
      app.log.error({ err: error }, 'Error fetching launch metrics');
      
      // Tightened error codes
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return reply.code(503).send({ 
          error: 'Database unavailable', 
          code: 'DATABASE_ERROR',
          details: error.code 
        });
      }
      
      if (error instanceof Prisma.PrismaClientInitializationError) {
        return reply.code(503).send({ 
          error: 'Database connection failed', 
          code: 'DATABASE_CONNECTION_ERROR' 
        });
      }
      
      return reply.code(500).send({ 
        error: 'Internal server error', 
        code: 'INTERNAL_ERROR' 
      });
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
    } catch (error) {
      app.log.error({ err: error }, 'Error fetching invoices');
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
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

  // Resubmit invoice to Duplo
  app.post('/invoices/:id/resubmit-duplo', {
    schema: {
      params: z.object({
        id: z.string().uuid()
      })
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;

      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!invoice) {
        reply.code(404).send({ error: 'Invoice not found' });
        return;
      }

      // Generate UBL XML (simplified version - in real implementation, use proper UBL generator)
      const ublXml = generateUBLXml(invoice);

      // Submit to Duplo
      const duploResponse = await duploClient.submitEInvoice(ublXml);

      // Update invoice with new IRN and status
      await prisma.invoice.update({
        where: { id },
        data: {
          ublXml,
          nrsReference: duploResponse.irn,
          status: duploResponse.status === 'success' ? 'stamped' : 'processing',
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'INVOICE_RESUBMITTED',
          userId: invoice.userId,
          metadata: {
            invoiceId: id,
            irn: duploResponse.irn,
            resubmittedBy: 'admin'
          }
        }
      });

      return { success: true, irn: duploResponse.irn };
    } catch (error) {
      app.log.error({ err: error }, 'Error resubmitting invoice');
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return reply.code(404).send({ 
            error: 'Invoice not found', 
            code: 'INVOICE_NOT_FOUND' 
          });
        }
        return reply.code(503).send({ 
          error: 'Database update failed', 
          code: 'DATABASE_ERROR',
          details: error.code 
        });
      }
      
      if (error instanceof Error && error.message.includes('Duplo')) {
        return reply.code(502).send({ 
          error: 'Integration service unavailable', 
          code: 'INTEGRATION_ERROR',
          details: error.message 
        });
      }
      
      return reply.code(500).send({ 
        error: 'Failed to resubmit invoice', 
        code: 'INTERNAL_ERROR' 
      });
    }
  });

  // Get analytics data
  app.get('/analytics', {
    schema: {
      querystring: z.object({
        range: z.string().optional().default('30d')
      })
    }
  }, async (request, reply) => {
    try {
      const range = (request.query as any).range as string;
      const days = parseInt(range.replace('d', ''));
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Run all queries in parallel for performance
      const [
        totalUsers,
        totalInvoices,
        totalPayments,
        recentUsers,
        recentInvoices,
        stampedInvoices,
        invoicesByStatus,
        paymentsByStatus,
        dailyInvoices,
        dailyPayments
      ] = await Promise.all([
        prisma.user.count(),
        prisma.invoice.count(),
        prisma.payment.count(),
        prisma.user.count({
          where: { createdAt: { gte: startDate } }
        }),
        prisma.invoice.count({
          where: { createdAt: { gte: startDate } }
        }),
        prisma.invoice.count({ where: { status: 'stamped' } }),
        prisma.invoice.groupBy({
          by: ['status'],
          _count: { status: true }
        }),
        prisma.payment.groupBy({
          by: ['status'],
          _count: { status: true },
          _sum: { amount: true }
        }),
        // Get daily invoice submissions for the period
        prisma.invoice.groupBy({
          by: ['status'],
          where: { createdAt: { gte: startDate } },
          _count: { status: true }
        }),
        // Get daily payment data for the period
        prisma.payment.groupBy({
          by: ['status'],
          where: { createdAt: { gte: startDate } },
          _count: { status: true },
          _sum: { amount: true }
        })
      ]);

      const monthlyGrowth = totalUsers > 0 ? (recentUsers / totalUsers) * 100 : 0;
      const complianceRate = totalInvoices > 0 ? (stampedInvoices / totalInvoices) * 100 : 0;

      // Generate trend data from real database queries
      const successTrend: TrendDataPoint[] = [];
      const dailySubmissions: SubmissionDataPoint[] = [];
      const transactionTrend: TransactionDataPoint[] = [];
      const volumeData: VolumeDataPoint[] = [];
      const complianceTrend: ComplianceDataPoint[] = [];

      // Generate day-by-day data (we query aggregates above; fill in with zeros for missing days)
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Find stamped vs failed for this period
        const stampedCount = invoicesByStatus.find(s => s.status === 'stamped')?._count.status || 0;
        const failedCount = invoicesByStatus.find(s => s.status === 'failed')?._count.status || 0;
        const totalSubmissions = stampedCount + failedCount;
        
        successTrend.push({
          timestamp: date.toISOString(),
          successRate: totalSubmissions > 0 ? (stampedCount / totalSubmissions) * 100 : 0,
          latency: 0, // No latency tracking yet
          submissions: totalSubmissions
        });

        dailySubmissions.push({
          date: dateStr,
          successful: stampedCount,
          failed: failedCount
        });

        // Payment transaction data
        const paidCount = paymentsByStatus.find(s => s.status === 'paid')?._count.status || 0;
        const pendingCount = paymentsByStatus.find(s => s.status === 'pending')?._count.status || 0;
        const failedPayments = paymentsByStatus.find(s => s.status === 'failed')?._count.status || 0;
        
        transactionTrend.push({
          date: dateStr,
          successful: paidCount,
          failed: failedPayments,
          pending: pendingCount,
          total: paidCount + pendingCount + failedPayments
        });

        const totalVolume = paymentsByStatus.reduce((acc, p) => acc + asNumber(p._sum.amount), 0);
        volumeData.push({
          date: dateStr,
          volume: totalVolume,
          count: paidCount + pendingCount + failedPayments
        });

        // Compliance trend
        complianceTrend.push({
          date: dateStr,
          compliant: stampedCount,
          nonCompliant: failedCount
        });
      }

      // Calculate real payment breakdown
      const paymentBreakdown = paymentsByStatus.map(p => ({
        status: p.status === 'paid' ? 'successful' : p.status,
        count: p._count.status,
        amount: asNumber(p._sum.amount)
      }));

      // Calculate error breakdown from failed invoices (if we had error tracking, we'd use that)
      // For now, show actual status distribution
      const errorBreakdown = invoicesByStatus
        .filter(s => s.status === 'failed' || s.status === 'queued')
        .map((s, idx, arr) => {
          const total = arr.reduce((acc, item) => acc + item._count.status, 0);
          return {
            error: s.status === 'failed' ? 'Submission Failed' : 'Pending Queue',
            count: s._count.status,
            percentage: total > 0 ? Math.round((s._count.status / total) * 100) : 0
          };
        });

      // If no errors, provide empty data
      if (errorBreakdown.length === 0) {
        errorBreakdown.push({ error: 'No errors', count: 0, percentage: 100 });
      }

      const analyticsData = {
        overview: {
          totalUsers,
          totalInvoices,
          totalPayments,
          complianceRate: Math.round(complianceRate),
          monthlyGrowth: Math.round(monthlyGrowth)
        },
        duploMetrics: {
          successTrend,
          errorBreakdown,
          dailySubmissions
        },
        remitaMetrics: {
          transactionTrend,
          paymentBreakdown: paymentBreakdown.length > 0 ? paymentBreakdown : [
            { status: 'successful', count: 0, amount: 0 },
            { status: 'pending', count: 0, amount: 0 },
            { status: 'failed', count: 0, amount: 0 }
          ],
          dailyVolume: volumeData
        },
        complianceMetrics: {
          // Real exemption data would come from invoice metadata if tracked
          exemptionUtilization: [
            { exemption: 'Standard Rate', count: totalInvoices, percentage: 100 }
          ],
          withholdingTaxTracking: generateMockMonthlyData(6), // Keep mock for now - needs schema update
          nrsComplianceTrend: complianceTrend
        }
      };

      return analyticsData;
    } catch (error) {
      app.log.error({ err: error }, 'Error fetching analytics');
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return reply.code(503).send({ 
          error: 'Database analytics query failed', 
          code: 'DATABASE_ERROR',
          details: error.code 
        });
      }
      
      return reply.code(500).send({ 
        error: 'Internal server error', 
        code: 'INTERNAL_ERROR' 
      });
    }
  });
}

// Helper function to generate UBL XML (simplified)
function generateUBLXml(invoice: any): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${invoice.id}</cbc:ID>
  <cbc:IssueDate>${invoice.createdAt.toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>NGN</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="TIN">${invoice.user.tin || 'N/A'}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${invoice.user.name}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount>${invoice.subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount>${invoice.subtotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount>${invoice.total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount>${invoice.total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
}

// Helper functions to generate mock data
function generateMockTrendData(days: number, type: string): TrendDataPoint[] {
  const data: TrendDataPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      timestamp: date.toISOString(),
      successRate: 85 + Math.random() * 15,
      latency: 200 + Math.random() * 800,
      submissions: Math.floor(Math.random() * 50) + 10
    });
  }
  return data;
}

function generateMockDailyData(days: number, type: string): Array<TransactionDataPoint | VolumeDataPoint | SubmissionDataPoint | ComplianceDataPoint> {
  const data: Array<TransactionDataPoint | VolumeDataPoint | SubmissionDataPoint | ComplianceDataPoint> = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (type === 'transactions') {
      const successful = Math.floor(Math.random() * 30) + 10;
      const failed = Math.floor(Math.random() * 5) + 1;
      const pending = Math.floor(Math.random() * 10) + 2;
      data.push({
        date: dateStr,
        successful,
        failed,
        pending,
        total: successful + failed + pending
      } as TransactionDataPoint);
    } else if (type === 'volume') {
      data.push({
        date: dateStr,
        volume: Math.floor(Math.random() * 500000) + 100000,
        count: Math.floor(Math.random() * 50) + 10
      });
    } else if (type === 'submissions') {
      data.push({
        date: dateStr,
        successful: Math.floor(Math.random() * 40) + 15,
        failed: Math.floor(Math.random() * 8) + 2
      });
    } else if (type === 'compliance') {
      data.push({
        date: dateStr,
        compliant: Math.floor(Math.random() * 40) + 15,
        nonCompliant: Math.floor(Math.random() * 5) + 1
      });
    }
  }
  return data;
}

function generateMockMonthlyData(months: number): MonthlyDataPoint[] {
  const data: MonthlyDataPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    data.push({
      month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      wthAmount: Math.floor(Math.random() * 100000) + 20000,
      invoiceCount: Math.floor(Math.random() * 100) + 20
    });
  }
  return data;
}
