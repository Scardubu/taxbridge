/**
 * NRS E-Invoicing Status Observability Routes
 * 
 * Provides endpoints for monitoring NRS submission status,
 * tracking IRN lifecycle, and ensuring idempotency.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('nrs-status');
const prisma = getPrismaClient();

const NRSStatusSchema = z.object({
  invoiceId: z.string().uuid(),
});

export default async function nrsStatusRoutes(app: FastifyInstance) {
  
  /**
   * GET /api/v1/nrs/status/:invoiceId
   * Get NRS submission status for a specific invoice
   */
  app.get<{
    Params: { invoiceId: string };
  }>('/api/v1/nrs/status/:invoiceId', async (req, reply) => {
    try {
      const { invoiceId } = req.params;
      
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          nrsCompliant: true,
          nrsReference: true,
          firsCSID: true,
          firsIRN: true,
          ublXml: true,
          qrCode: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: 'Invoice not found',
        });
      }

      // Determine NRS submission status
      let nrsStatus: 'not_submitted' | 'pending' | 'submitted' | 'stamped' | 'failed' = 'not_submitted';
      let statusDetails: Record<string, any> = {};

      if (invoice.status === 'stamped' && invoice.firsIRN) {
        nrsStatus = 'stamped';
        statusDetails = {
          irn: invoice.firsIRN,
          csid: invoice.firsCSID,
          nrsReference: invoice.nrsReference,
          hasQRCode: !!invoice.qrCode,
          hasUBL: !!invoice.ublXml,
        };
      } else if (invoice.nrsReference) {
        nrsStatus = 'submitted';
        statusDetails = {
          nrsReference: invoice.nrsReference,
          pendingStamp: true,
        };
      } else if (invoice.nrsCompliant && invoice.ublXml) {
        nrsStatus = 'pending';
        statusDetails = {
          hasUBL: true,
          readyForSubmission: true,
        };
      }

      return reply.send({
        success: true,
        data: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          nrsStatus,
          nrsCompliant: invoice.nrsCompliant,
          details: statusDetails,
          timestamps: {
            created: invoice.createdAt,
            lastUpdated: invoice.updatedAt,
          },
        },
      });
    } catch (error: any) {
      log.error('Error fetching NRS status', { error, invoiceId: req.params.invoiceId });
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch NRS status',
      });
    }
  });

  /**
   * GET /api/v1/nrs/status
   * Get NRS status summary for all invoices (with filtering)
   */
  app.get<{
    Querystring: {
      status?: string;
      nrsStatus?: string;
      fromDate?: string;
      toDate?: string;
      limit?: string;
    };
  }>('/api/v1/nrs/status', async (req, reply) => {
    try {
      const { status, nrsStatus, fromDate, toDate, limit } = req.query;
      
      const where: any = {};
      
      if (status) {
        where.status = status;
      }
      
      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) where.createdAt.lte = new Date(toDate);
      }

      // Filter by NRS status
      if (nrsStatus === 'stamped') {
        where.status = 'stamped';
        where.firsIRN = { not: null };
      } else if (nrsStatus === 'submitted') {
        where.nrsReference = { not: null };
        where.status = { not: 'stamped' };
      } else if (nrsStatus === 'pending') {
        where.nrsCompliant = true;
        where.ublXml = { not: null };
        where.nrsReference = null;
      } else if (nrsStatus === 'not_submitted') {
        where.nrsReference = null;
      }

      const invoices = await prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          nrsCompliant: true,
          nrsReference: true,
          firsCSID: true,
          firsIRN: true,
          total: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit) : 50,
      });

      // Aggregate statistics
      const stats = await prisma.invoice.groupBy({
        by: ['status'],
        _count: true,
        where: fromDate || toDate ? { createdAt: where.createdAt } : undefined,
      });

      const nrsStats = {
        total: invoices.length,
        stamped: invoices.filter(i => i.status === 'stamped' && i.firsIRN).length,
        submitted: invoices.filter(i => i.nrsReference && i.status !== 'stamped').length,
        pending: invoices.filter(i => i.nrsCompliant && i.nrsReference === null).length,
        notSubmitted: invoices.filter(i => !i.nrsReference).length,
      };

      return reply.send({
        success: true,
        data: {
          invoices: invoices.map(invoice => ({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            nrsStatus: invoice.status === 'stamped' && invoice.firsIRN
              ? 'stamped'
              : invoice.nrsReference
              ? 'submitted'
              : invoice.nrsCompliant
              ? 'pending'
              : 'not_submitted',
            total: invoice.total,
            irn: invoice.firsIRN,
            createdAt: invoice.createdAt,
          })),
          statistics: {
            byStatus: stats,
            byNRSStatus: nrsStats,
          },
        },
      });
    } catch (error: any) {
      log.error('Error fetching NRS status summary', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch NRS status summary',
      });
    }
  });

  /**
   * GET /api/v1/nrs/health
   * Check NRS submission health and recent failure rate
   */
  app.get('/api/v1/nrs/health', async (req, reply) => {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent NRS submissions
      const recentInvoices = await prisma.invoice.findMany({
        where: {
          nrsCompliant: true,
          createdAt: { gte: last24Hours },
        },
        select: {
          status: true,
          nrsReference: true,
          firsIRN: true,
        },
      });

      const total = recentInvoices.length;
      const stamped = recentInvoices.filter(i => i.status === 'stamped' && i.firsIRN).length;
      const submitted = recentInvoices.filter(i => i.nrsReference).length;
      const failed = recentInvoices.filter(i => !i.nrsReference).length;

      const successRate = total > 0 ? (stamped / total) * 100 : 100;
      const submissionRate = total > 0 ? (submitted / total) * 100 : 100;

      let healthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (successRate < 50 || submissionRate < 70) {
        healthStatus = 'critical';
      } else if (successRate < 80 || submissionRate < 90) {
        healthStatus = 'degraded';
      }

      return reply.send({
        success: true,
        data: {
          status: healthStatus,
          period: '24h',
          metrics: {
            total,
            stamped,
            submitted,
            failed,
            successRate: Math.round(successRate * 100) / 100,
            submissionRate: Math.round(submissionRate * 100) / 100,
          },
          timestamp: now.toISOString(),
        },
      });
    } catch (error: any) {
      log.error('Error checking NRS health', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to check NRS health',
      });
    }
  });
}
