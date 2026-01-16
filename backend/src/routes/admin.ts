import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
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
      const [
        totalUsers,
        totalInvoices,
        totalPayments,
        duploHealth,
        remitaHealth
      ] = await Promise.all([
        prisma.user.count(),
        prisma.invoice.count(),
        prisma.payment.count(),
        duploClient.checkHealth(),
        remitaClient.checkHealth()
      ]);

      // Get Duplo success trend for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const duploSuccessTrend = await prisma.invoice.groupBy({
        by: ['status', 'createdAt'],
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: { in: ['stamped', 'failed'] }
        },
        _count: { status: true }
      });

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
      const remitaTransactions = await prisma.payment.groupBy({
        by: ['status', 'createdAt'],
        where: {
          createdAt: { gte: sevenDaysAgo }
        },
        _count: { status: true },
        _sum: { amount: true }
      });

      // Format Remita transaction data
      const remitaData: TransactionDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayData = remitaTransactions.filter(t => 
          t.createdAt.toISOString().split('T')[0] === dateStr
        );
        
        const successful = dayData.find(d => d.status === 'successful')?._count.status || 0;
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
        remitaTransactions: remitaData
      };
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Launch metrics: NRR/GRR computed from successful payments month-over-month
  app.get('/launch-metrics', async (_request, reply) => {
    try {
      const now = new Date();
      const currentWindow = monthWindow(now);
      const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
      const previousWindow = monthWindow(prevMonth);

      const [currentPayments, previousPayments, failedPayments24h, activeAlerts] = await Promise.all([
        prisma.payment.findMany({
          where: {
            createdAt: { gte: currentWindow.start, lt: currentWindow.end },
            status: 'successful'
          },
          select: {
            amount: true,
            createdAt: true,
            invoice: { select: { userId: true } }
          }
        }),
        prisma.payment.findMany({
          where: {
            createdAt: { gte: previousWindow.start, lt: previousWindow.end },
            status: 'successful'
          },
          select: {
            amount: true,
            createdAt: true,
            invoice: { select: { userId: true } }
          }
        }),
        prisma.payment.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            status: 'failed'
          }
        }),
        prisma.alert.findMany({
          where: { resolved: false, severity: { in: ['high', 'critical'] } },
          orderBy: { timestamp: 'desc' },
          take: 5,
          select: { severity: true, title: true }
        })
      ]);

      const currentByUser = new Map<string, number>();
      const previousByUser = new Map<string, number>();

      for (const payment of currentPayments) {
        const userId = payment.invoice.userId;
        currentByUser.set(userId, (currentByUser.get(userId) || 0) + asNumber(payment.amount));
      }

      for (const payment of previousPayments) {
        const userId = payment.invoice.userId;
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
        anomalies
      });
    } catch (error) {
      console.error('Error fetching launch metrics:', error);
      return reply.code(500).send({ error: 'Internal server error' });
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
      console.error('Error fetching invoices:', error);
      reply.code(500).send({ error: 'Internal server error' });
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
      console.error('Error resubmitting invoice:', error);
      reply.code(500).send({ error: 'Failed to resubmit invoice' });
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

      const [
        totalUsers,
        totalInvoices,
        totalPayments,
        recentUsers,
        recentInvoices
      ] = await Promise.all([
        prisma.user.count(),
        prisma.invoice.count(),
        prisma.payment.count(),
        prisma.user.count({
          where: { createdAt: { gte: startDate } }
        }),
        prisma.invoice.count({
          where: { createdAt: { gte: startDate } }
        })
      ]);

      const monthlyGrowth = totalUsers > 0 ? (recentUsers / totalUsers) * 100 : 0;
      const complianceRate = totalInvoices > 0 ? 
        ((await prisma.invoice.count({ where: { status: 'stamped' } })) / totalInvoices) * 100 : 0;

      // Mock analytics data (in real implementation, calculate from actual data)
      const analyticsData = {
        overview: {
          totalUsers,
          totalInvoices,
          totalPayments,
          complianceRate: Math.round(complianceRate),
          monthlyGrowth: Math.round(monthlyGrowth)
        },
        duploMetrics: {
          successTrend: generateMockTrendData(days, 'duplo'),
          errorBreakdown: [
            { error: 'Invalid XML', count: 5, percentage: 25 },
            { error: 'Authentication Failed', count: 3, percentage: 15 },
            { error: 'Network Timeout', count: 8, percentage: 40 },
            { error: 'Other', count: 4, percentage: 20 }
          ],
          dailySubmissions: generateMockDailyData(days, 'submissions')
        },
        remitaMetrics: {
          transactionTrend: generateMockDailyData(days, 'transactions'),
          paymentBreakdown: [
            { status: 'successful', count: 150, amount: 2500000 },
            { status: 'pending', count: 30, amount: 450000 },
            { status: 'failed', count: 20, amount: 300000 }
          ],
          dailyVolume: generateMockDailyData(days, 'volume')
        },
        complianceMetrics: {
          exemptionUtilization: [
            { exemption: 'Small Business (<₦25M)', count: 120, percentage: 60 },
            { exemption: 'Agricultural Sector', count: 50, percentage: 25 },
            { exemption: 'Educational Services', count: 30, percentage: 15 }
          ],
          withholdingTaxTracking: generateMockMonthlyData(6),
          nrsComplianceTrend: generateMockDailyData(days, 'compliance')
        }
      };

      return analyticsData;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      reply.code(500).send({ error: 'Internal server error' });
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
