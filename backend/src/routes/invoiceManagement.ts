/**
 * Invoice Management Routes (Phase 4)
 *
 * Enhanced invoice CRUD with NRS compliance, PDF generation,
 * sharing, and business context support.
 *
 * POST   /api/v1/invoice-mgmt                    — Create invoice
 * GET    /api/v1/invoice-mgmt                    — List invoices (with filters)
 * GET    /api/v1/invoice-mgmt/:id                — Get invoice detail
 * PUT    /api/v1/invoice-mgmt/:id                — Update invoice
 * POST   /api/v1/invoice-mgmt/:id/cancel         — Cancel invoice
 * POST   /api/v1/invoice-mgmt/:id/send           — Mark as sent
 * POST   /api/v1/invoice-mgmt/:id/submit-nrs     — Submit for NRS stamping
 * POST   /api/v1/invoice-mgmt/:id/pdf            — Generate PDF
 * GET    /api/v1/invoice-mgmt/stats               — Invoice statistics
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

import { InvoiceService } from '../services/invoice';
import { generateInvoicePDF, InvoicePDFData } from '../services/pdf-generator';
import { getInvoiceSyncQueue } from '../queue/client';
import { ValidationError, NotFoundError } from '../lib/errors';
import { VAT_RATE } from '../lib/constants';
import { createLogger } from '../lib/logger';
import { redis } from '../lib/redis';
import { requireRole } from '../plugins/requireRole';
import { invalidateDashboardCache } from './dashboard-composite';

const log = createLogger('invoice-mgmt-routes');

export default async function invoiceManagementRoutes(
  app: FastifyInstance,
  opts: { prisma: PrismaClient }
) {
  const prisma = opts.prisma;
  const invoiceService = new InvoiceService(prisma);

  // =========================================================================
  // Schemas
  // =========================================================================

  const CustomerSchema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    tin: z.string().optional(),
    address: z.string().optional(),
    endpointId: z.string().optional(),
  });

  const InvoiceItemSchema = z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    vatApplicable: z.boolean().optional().default(true),
  });

  const CreateInvoiceSchema = z.object({
    businessId: z.string().uuid().optional(),
    customer: CustomerSchema,
    items: z.array(InvoiceItemSchema).min(1).max(1000),
    dueDate: z.string().optional(),
    template: z.enum(['professional', 'retail', 'service', 'wholesale']).optional(),
    nrsCompliant: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
    asDraft: z.boolean().optional(),
  });

  const UpdateInvoiceSchema = z.object({
    customer: CustomerSchema.partial().optional(),
    items: z.array(InvoiceItemSchema).min(1).max(1000).optional(),
    dueDate: z.string().optional(),
    template: z.enum(['professional', 'retail', 'service', 'wholesale']).optional(),
    nrsCompliant: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
  });

  const ListQuerySchema = z.object({
    status: z.string().optional(),
    businessId: z.string().uuid().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    customerName: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    cursor: z.string().optional(),
  });

  const PDFRequestSchema = z.object({
    template: z.enum(['professional', 'retail', 'service', 'wholesale']).optional(),
    includeQR: z.boolean().optional().default(true),
    includeNRSBadge: z.boolean().optional().default(true),
  });

  const IdParamSchema = z.object({ id: z.string().min(1) });

  // =========================================================================
  // POST /api/v1/invoice-mgmt — Create Invoice
  // =========================================================================

  app.post('/api/v1/invoice-mgmt', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT')],
  }, async (req, reply) => {
    const { orgId } = req.orgContext;
    const { userId } = req.user;

    const parsed = CreateInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await invoiceService.createInvoice({
        userId,
        ...parsed.data,
        businessId: parsed.data.businessId ?? orgId,
      });

      // If not a draft, queue for NRS stamping
      if (!parsed.data.asDraft) {
        try {
          const queue = getInvoiceSyncQueue();
          if (queue) {
            const maxAttempts = Number.parseInt(
              process.env.INVOICE_SYNC_MAX_ATTEMPTS || '5',
              10
            );
            const backoffMs = Number.parseInt(
              process.env.INVOICE_SYNC_BACKOFF_MS || '1000',
              10
            );

            await queue.add(
              'sync',
              { invoiceId: result.id },
              {
                attempts:
                  Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 5,
                backoff: {
                  type: 'exponential',
                  delay:
                    Number.isFinite(backoffMs) && backoffMs > 0 ? backoffMs : 1000,
                },
                removeOnComplete: true,
                removeOnFail: false,
              }
            );
          }
        } catch (queueErr) {
          log.error('Failed to queue invoice for NRS sync', {
            invoiceId: result.id,
            err: queueErr,
          });
        }
      }

      await invalidateDashboardCache(redis, userId);

      return reply.status(201).send({
        success: true,
        data: { invoice: result },
      });
    } catch (err: any) {
      log.error('Failed to create invoice', { err });
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to create invoice',
      });
    }
  });

  // =========================================================================
  // GET /api/v1/invoice-mgmt — List Invoices
  // =========================================================================

  app.get('/api/v1/invoice-mgmt', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const { orgId } = req.orgContext;
    const { userId } = req.user;

    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid query parameters',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await invoiceService.listInvoices({
        userId,
        ...parsed.data,
        businessId: parsed.data.businessId ?? orgId,
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      log.error('Failed to list invoices', { err });
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to list invoices',
      });
    }
  });

  // =========================================================================
  // GET /api/v1/invoice-mgmt/stats — Invoice Statistics
  // =========================================================================

  app.get('/api/v1/invoice-mgmt/stats', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const { orgId } = req.orgContext;
    const { userId } = req.user;
    const businessId = (req.query as Record<string, string>)?.businessId ?? orgId;

    try {
      const stats = await invoiceService.getInvoiceStats(userId, businessId);
      return reply.send({ success: true, data: stats });
    } catch (err: any) {
      log.error('Failed to get invoice stats', { err });
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to get invoice stats',
      });
    }
  });

  // =========================================================================
  // GET /api/v1/invoice-mgmt/:id — Get Invoice Detail
  // =========================================================================

  app.get('/api/v1/invoice-mgmt/:id', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const { userId } = req.user;
    const { id } = req.params as z.infer<typeof IdParamSchema>;

    try {
      const invoice = await invoiceService.getInvoice(id, userId);
      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: `Invoice not found: ${id}`,
        });
      }

      return reply.send({ success: true, data: { invoice } });
    } catch (err: any) {
      log.error('Failed to get invoice', { err, invoiceId: id });
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to get invoice',
      });
    }
  });

  // =========================================================================
  // PUT /api/v1/invoice-mgmt/:id — Update Invoice
  // =========================================================================

  app.put('/api/v1/invoice-mgmt/:id', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT')],
  }, async (req, reply) => {
    const { userId } = req.user;
    const { id } = req.params as z.infer<typeof IdParamSchema>;

    const parsed = UpdateInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await invoiceService.updateInvoice(id, userId, parsed.data);
      await invalidateDashboardCache(redis, userId);
      return reply.send({ success: true, data: { invoice: result } });
    } catch (err: any) {
      const status = err.message?.includes('not found') ? 404 : err.message?.includes('Cannot edit') ? 409 : 500;
      return reply.status(status).send({
        success: false,
        error: err.message || 'Failed to update invoice',
      });
    }
  });

  // =========================================================================
  // POST /api/v1/invoice-mgmt/:id/cancel — Cancel Invoice
  // =========================================================================

  app.post('/api/v1/invoice-mgmt/:id/cancel', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT')],
  }, async (req, reply) => {
    const { userId } = req.user;
    const { id } = req.params as z.infer<typeof IdParamSchema>;

    try {
      const result = await invoiceService.cancelInvoice(id, userId);
      await invalidateDashboardCache(redis, userId);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      const status = err.message?.includes('not found') ? 404 : err.message?.includes('Cannot cancel') ? 409 : 500;
      return reply.status(status).send({
        success: false,
        error: err.message || 'Failed to cancel invoice',
      });
    }
  });

  // =========================================================================
  // POST /api/v1/invoice-mgmt/:id/send — Mark as Sent
  // =========================================================================

  app.post('/api/v1/invoice-mgmt/:id/send', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT')],
  }, async (req, reply) => {
    const { userId } = req.user;
    const { id } = req.params as z.infer<typeof IdParamSchema>;

    try {
      const result = await invoiceService.markAsSent(id, userId);
      await invalidateDashboardCache(redis, userId);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      const status = err.message?.includes('not found') ? 404 : err.message?.includes('Cannot mark') ? 409 : 500;
      return reply.status(status).send({
        success: false,
        error: err.message || 'Failed to mark invoice as sent',
      });
    }
  });

  // =========================================================================

  app.post('/api/v1/invoice-mgmt/:id/submit-nrs', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT')],
  }, async (req, reply) => {
    const { userId } = req.user;
    const { id } = req.params as z.infer<typeof IdParamSchema>;

    try {
      const result = await invoiceService.submitForStamping(id, userId);

      // Queue for NRS sync
      const queue = getInvoiceSyncQueue();
      if (queue) {
        await queue.add(
          'sync',
          { invoiceId: id },
          {
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: false,
          }
        );
      }

      await invalidateDashboardCache(redis, userId);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      const status = err.message?.includes('not found') ? 404 : err.message?.includes('Only draft') ? 409 : 500;
      return reply.status(status).send({
        success: false,
        error: err.message || 'Failed to submit for NRS stamping',
      });
    }
  });

  // =========================================================================
  // POST /api/v1/invoice-mgmt/:id/pdf — Generate PDF
  // =========================================================================

  app.post('/api/v1/invoice-mgmt/:id/pdf', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const { userId } = req.user;
    const { id } = req.params as z.infer<typeof IdParamSchema>;

    const parsed = PDFRequestSchema.safeParse(req.body || {});
    const options = parsed.success ? parsed.data : { includeQR: true, includeNRSBadge: true };

    try {
      const invoice = await invoiceService.getInvoice(id, userId);
      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: `Invoice not found: ${id}`,
        });
      }

      // Get supplier info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, tin: true, email: true, phone: true },
      });

      let supplierAddress = '';
      if (invoice.business) {
        const biz = await prisma.business.findUnique({
          where: { id: invoice.business.id },
          select: { addressStreet: true, addressCity: true, addressState: true },
        });
        if (biz) {
          supplierAddress = [biz.addressStreet, biz.addressCity, biz.addressState]
            .filter(Boolean)
            .join(', ');
        }
      }

      // Generate QR code if needed
      let qrCode = invoice.qrCode || null;
      if (options.includeQR && !qrCode) {
        qrCode = await invoiceService.generateQRCode({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total,
          nrsIRN: invoice.nrsIRN,
          nrsReference: invoice.nrsReference,
        });
      }

      // Prepare items with VAT breakdown
      const rawItems = invoice.items as Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        vatApplicable?: boolean;
      }>;

      const pdfItems = rawItems.map((item) => {
        const lineTotal = item.quantity * item.unitPrice;
        const vatApplicable = item.vatApplicable !== false;
        const vatAmount = vatApplicable ? +(lineTotal * VAT_RATE).toFixed(2) : 0;
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatApplicable,
          total: lineTotal,
          vatAmount,
        };
      });

      const pdfData: InvoicePDFData = {
        invoiceNumber: invoice.invoiceNumber || invoice.id,
        issueDate: invoice.createdAt,
        dueDate: invoice.dueDate,
        template: (options.template || invoice.template) as string,
        supplierName: invoice.business?.name || user?.name || 'TaxBridge User',
        supplierTIN: invoice.business?.tin || user?.tin || undefined,
        supplierEmail: invoice.business?.email || user?.email || undefined,
        supplierPhone: invoice.business?.phone || user?.phone || undefined,
        supplierAddress: supplierAddress || undefined,
        customerName: invoice.customer.name || 'Customer',
        customerEmail: invoice.customer.email,
        customerPhone: invoice.customer.phone,
        customerTIN: invoice.customer.tin,
        customerAddress: invoice.customer.address,
        items: pdfItems,
        subtotal: invoice.subtotal,
        vatAmount: invoice.vatAmount,
        total: invoice.total,
        nrsCompliant: options.includeNRSBadge ? invoice.nrsCompliant : false,
        nrsIRN: invoice.nrsIRN,
        nrsCSID: invoice.nrsCSID,
        nrsReference: invoice.nrsReference,
        qrCode: options.includeQR ? qrCode : null,
        notes: invoice.notes,
      };

      const result = generateInvoicePDF(pdfData);

      return reply.send({
        success: true,
        data: {
          html: result.html,
          fileName: result.fileName,
          invoiceNumber: invoice.invoiceNumber,
        },
      });
    } catch (err: any) {
      log.error('Failed to generate PDF', { err, invoiceId: id });
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to generate PDF',
      });
    }
  });
}
