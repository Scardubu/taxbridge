/**
 * Invoice Service
 *
 * Handles invoice CRUD, sequential numbering, status management,
 * NRS compliance submission, and PDF generation orchestration.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { createLogger } from '../lib/logger';
import { calculateInvoiceTotals, InvoiceLineItem } from '../utils/taxCalculator';

const log = createLogger('invoice-service');

// =============================================================================
// Types
// =============================================================================

export interface CreateInvoiceInput {
  userId: string;
  businessId?: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    tin?: string;
    address?: string;
    endpointId?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatApplicable?: boolean;
  }>;
  dueDate?: string;
  template?: 'professional' | 'retail' | 'service' | 'wholesale';
  nrsCompliant?: boolean;
  notes?: string;
  asDraft?: boolean;
}

export interface UpdateInvoiceInput {
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    tin?: string;
    address?: string;
    endpointId?: string;
  };
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatApplicable?: boolean;
  }>;
  dueDate?: string;
  template?: 'professional' | 'retail' | 'service' | 'wholesale';
  nrsCompliant?: boolean;
  notes?: string;
}

export interface InvoiceListFilters {
  userId: string;
  businessId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  customerName?: string;
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface InvoiceListResult {
  invoices: Array<{
    id: string;
    invoiceNumber: string | null;
    customerName: string | null;
    customerEmail: string | null;
    total: string;
    status: string;
    dueDate: string | null;
    nrsCompliant: boolean;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  nextCursor: string | null;
}

// =============================================================================
// Invoice Service Class
// =============================================================================

export class InvoiceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate sequential invoice number: INV/YYYY/NNNNN
   */
  async generateInvoiceNumber(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV/${year}/`;

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: { startsWith: prefix },
      },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let nextNumber = 1;
    if (lastInvoice?.invoiceNumber) {
      const parts = lastInvoice.invoiceNumber.split('/');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  /**
   * Create a new invoice
   */
  async createInvoice(input: CreateInvoiceInput) {
    const invoiceNumber = await this.generateInvoiceNumber(input.userId);

    const items: InvoiceLineItem[] = input.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    const totals = calculateInvoiceTotals(items);

    const status = input.asDraft ? 'draft' : 'queued';

    const invoice = await this.prisma.invoice.create({
      data: {
        userId: input.userId,
        businessId: input.businessId || null,
        invoiceNumber,
        customerName: input.customer.name,
        customerEmail: input.customer.email || null,
        customerPhone: input.customer.phone || null,
        customerTIN: input.customer.tin || null,
        customerAddress: input.customer.address || null,
        customerEndpointId: input.customer.endpointId || null,
        items: input.items,
        subtotal: totals.subtotal.toFixed(2),
        vat: totals.vat.toFixed(2),
        total: totals.total.toFixed(2),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        template: input.template || 'professional',
        nrsCompliant: input.nrsCompliant ?? true,
        notes: input.notes || null,
        status,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'invoice_created',
        userId: input.userId,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber,
          status,
          total: totals.total,
          nrsCompliant: input.nrsCompliant ?? true,
        },
      },
    });

    log.info('Invoice created', {
      invoiceId: invoice.id,
      invoiceNumber,
      status,
      total: totals.total,
    });

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      subtotal: Number(invoice.subtotal),
      vatAmount: Number(invoice.vat),
      total: Number(invoice.total),
      nrsCompliant: invoice.nrsCompliant,
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  /**
   * Update an existing invoice (only draft/failed invoices can be edited)
   */
  async updateInvoice(invoiceId: string, userId: string, input: UpdateInvoiceInput) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
    });

    if (!existing) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const editableStatuses = ['draft', 'failed', 'queued'];
    if (!editableStatuses.includes(existing.status)) {
      throw new Error(`Cannot edit invoice in status '${existing.status}'`);
    }

    const updateData: Prisma.InvoiceUpdateInput = {};

    if (input.customer) {
      if (input.customer.name !== undefined) updateData.customerName = input.customer.name;
      if (input.customer.email !== undefined) updateData.customerEmail = input.customer.email;
      if (input.customer.phone !== undefined) updateData.customerPhone = input.customer.phone;
      if (input.customer.tin !== undefined) updateData.customerTIN = input.customer.tin;
      if (input.customer.address !== undefined) updateData.customerAddress = input.customer.address;
      if (input.customer.endpointId !== undefined) updateData.customerEndpointId = input.customer.endpointId;
    }

    if (input.items) {
      const items: InvoiceLineItem[] = input.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));
      const totals = calculateInvoiceTotals(items);
      updateData.items = input.items;
      updateData.subtotal = totals.subtotal.toFixed(2);
      updateData.vat = totals.vat.toFixed(2);
      updateData.total = totals.total.toFixed(2);
    }

    if (input.dueDate !== undefined) {
      updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    if (input.template) updateData.template = input.template;
    if (input.nrsCompliant !== undefined) updateData.nrsCompliant = input.nrsCompliant;
    if (input.notes !== undefined) updateData.notes = input.notes;

    // Reset NRS fields on edit
    updateData.ublXml = null;
    updateData.nrsReference = null;
    updateData.firsCSID = null;
    updateData.firsIRN = null;
    updateData.qrCode = null;
    updateData.pdfUrl = null;

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    return {
      id: updated.id,
      invoiceNumber: updated.invoiceNumber,
      status: updated.status,
      subtotal: Number(updated.subtotal),
      vatAmount: Number(updated.vat),
      total: Number(updated.total),
    };
  }

  /**
   * Get invoice by ID with full details
   */
  async getInvoice(invoiceId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        business: {
          select: { id: true, name: true, tin: true, email: true, phone: true },
        },
        payments: {
          select: { id: true, status: true, amount: true, gateway: true, paidAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!invoice) return null;

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      userId: invoice.userId,
      businessId: invoice.businessId,
      business: invoice.business,
      customer: {
        name: invoice.customerName,
        email: invoice.customerEmail,
        phone: invoice.customerPhone,
        tin: invoice.customerTIN,
        address: invoice.customerAddress,
        endpointId: invoice.customerEndpointId,
      },
      items: invoice.items,
      subtotal: Number(invoice.subtotal),
      vatAmount: Number(invoice.vat),
      total: Number(invoice.total),
      dueDate: invoice.dueDate?.toISOString() || null,
      template: invoice.template,
      status: invoice.status,
      nrsCompliant: invoice.nrsCompliant,
      firsCSID: invoice.firsCSID,
      firsIRN: invoice.firsIRN,
      nrsReference: invoice.nrsReference,
      qrCode: invoice.qrCode,
      pdfUrl: invoice.pdfUrl,
      notes: invoice.notes,
      ublXml: invoice.ublXml,
      sentAt: invoice.sentAt?.toISOString() || null,
      payments: invoice.payments.map((p) => ({
        id: p.id,
        status: p.status,
        amount: Number(p.amount),
        gateway: p.gateway,
        paidAt: p.paidAt?.toISOString() || null,
      })),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }

  /**
   * List invoices with pagination and filters
   */
  async listInvoices(filters: InvoiceListFilters): Promise<InvoiceListResult> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      userId: filters.userId,
    };

    if (filters.businessId) where.businessId = filters.businessId;
    if (filters.status) where.status = filters.status;
    if (filters.customerName) {
      where.customerName = { contains: filters.customerName, mode: 'insensitive' };
    }

    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: filters.cursor ? undefined : skip,
        ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          customerEmail: true,
          total: true,
          status: true,
          dueDate: true,
          nrsCompliant: true,
          createdAt: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const nextCursor = invoices.length === limit ? invoices[invoices.length - 1].id : null;

    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        total: inv.total.toString(),
        status: inv.status,
        dueDate: inv.dueDate?.toISOString() || null,
        nrsCompliant: inv.nrsCompliant,
        createdAt: inv.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      nextCursor,
    };
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(invoiceId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
    });

    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

    const cancellableStatuses = ['draft', 'queued', 'failed', 'sent', 'stamped'];
    if (!cancellableStatuses.includes(invoice.status)) {
      throw new Error(`Cannot cancel invoice in status '${invoice.status}'`);
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'cancelled' },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'invoice_cancelled',
        userId,
        metadata: { invoiceId, previousStatus: invoice.status },
      },
    });

    return { id: invoiceId, status: 'cancelled' };
  }

  /**
   * Mark invoice as sent
   */
  async markAsSent(invoiceId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
    });

    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

    if (invoice.status !== 'stamped' && invoice.status !== 'draft') {
      throw new Error(`Cannot mark invoice as sent in status '${invoice.status}'`);
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'sent', sentAt: new Date() },
    });

    return { id: invoiceId, status: 'sent' };
  }

  /**
   * Submit invoice for NRS stamping (queue it)
   */
  async submitForStamping(invoiceId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
    });

    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

    if (invoice.status !== 'draft') {
      throw new Error(`Only draft invoices can be submitted for stamping`);
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'queued' },
    });

    return { id: invoiceId, status: 'queued' };
  }

  /**
   * Update NRS compliance data after successful DigiTax submission
   */
  async updateNRSData(
    invoiceId: string,
    data: {
      nrsReference: string;
      firsCSID?: string;
      firsIRN?: string;
      ublXml?: string;
      qrCode?: string;
    }
  ) {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'stamped',
        nrsReference: data.nrsReference,
        firsCSID: data.firsCSID || null,
        firsIRN: data.firsIRN || null,
        ublXml: data.ublXml || null,
        qrCode: data.qrCode || null,
        nrsCompliant: true,
      },
    });
  }

  /**
   * Generate QR code for an invoice containing NRS data
   */
  async generateQRCode(invoice: {
    id: string;
    invoiceNumber: string | null;
    total: number;
    firsIRN?: string | null;
    nrsReference?: string | null;
  }): Promise<string> {
    const qrData = JSON.stringify({
      inv: invoice.invoiceNumber || invoice.id,
      irn: invoice.firsIRN || invoice.nrsReference || '',
      amt: invoice.total,
      ts: new Date().toISOString(),
      src: 'TaxBridge',
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      width: 200,
      margin: 2,
    });

    return qrCodeDataUrl;
  }

  /**
   * Check for overdue invoices and update their status
   */
  async markOverdueInvoices(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.invoice.updateMany({
      where: {
        status: { in: ['sent', 'stamped'] },
        dueDate: { lt: now },
      },
      data: { status: 'overdue' },
    });

    if (result.count > 0) {
      log.info(`Marked ${result.count} invoices as overdue`);
    }

    return result.count;
  }

  /**
   * Get invoice statistics for a user/business
   */
  async getInvoiceStats(userId: string, businessId?: string) {
    const where: Prisma.InvoiceWhereInput = { userId };
    if (businessId) where.businessId = businessId;

    const [total, draft, sent, paid, overdue, cancelled] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.count({ where: { ...where, status: 'draft' } }),
      this.prisma.invoice.count({ where: { ...where, status: { in: ['sent', 'stamped'] } } }),
      this.prisma.invoice.count({ where: { ...where, status: 'paid' } }),
      this.prisma.invoice.count({ where: { ...where, status: 'overdue' } }),
      this.prisma.invoice.count({ where: { ...where, status: 'cancelled' } }),
    ]);

    const totalRevenue = await this.prisma.invoice.aggregate({
      where: { ...where, status: 'paid' },
      _sum: { total: true },
    });

    const outstandingAmount = await this.prisma.invoice.aggregate({
      where: { ...where, status: { in: ['sent', 'stamped', 'overdue'] } },
      _sum: { total: true },
    });

    return {
      counts: { total, draft, sent, paid, overdue, cancelled },
      totalRevenue: Number(totalRevenue._sum.total || 0),
      outstandingAmount: Number(outstandingAmount._sum.total || 0),
    };
  }
}
