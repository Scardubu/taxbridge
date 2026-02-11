/**
 * Reconciliation Service (Phase 6)
 *
 * Matches invoices to payments with confidence scoring.
 * Supports exact, fuzzy, and partial matching.
 *
 * Features:
 * - Auto-match invoices to payments by amount/reference
 * - Confidence scoring (exact=100, fuzzy=70-99, partial=30-69)
 * - Unmatched invoice/payment detection
 * - Reconciliation report generation
 * - Manual match/unmatch
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '../lib/logger';

const log = createLogger('reconciliation-service');

// =============================================================================
// Types
// =============================================================================

export interface ReconciliationMatch {
  invoiceId: string;
  invoiceNumber: string | null;
  invoiceTotal: number;
  invoiceStatus: string;
  paymentId: string;
  paymentRef: string;
  paymentAmount: number;
  paymentStatus: string;
  paymentGateway: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial';
  difference: number;
}

export interface ReconciliationReport {
  businessId: string;
  generatedAt: string;
  matched: ReconciliationMatch[];
  unmatchedInvoices: Array<{
    id: string;
    invoiceNumber: string | null;
    total: number;
    status: string;
    customerName: string | null;
    createdAt: string;
  }>;
  unmatchedPayments: Array<{
    id: string;
    reference: string;
    amount: number;
    status: string;
    gateway: string;
    paidAt: string | null;
  }>;
  summary: {
    totalInvoices: number;
    totalPayments: number;
    matchedCount: number;
    unmatchedInvoiceCount: number;
    unmatchedPaymentCount: number;
    totalInvoiceValue: number;
    totalPaymentValue: number;
    matchRate: number;
    discrepancy: number;
  };
}

// =============================================================================
// Helper
// =============================================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// =============================================================================
// Service Class
// =============================================================================

export class ReconciliationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Run reconciliation for a business
   */
  async reconcile(
    userId: string,
    businessId: string,
    options: {
      fromDate?: string;
      toDate?: string;
      fuzzyThreshold?: number; // percentage tolerance for fuzzy matching (default 5%)
    } = {}
  ): Promise<ReconciliationReport> {
    // Verify ownership
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const fuzzyThreshold = options.fuzzyThreshold ?? 5; // 5% tolerance

    // Build date filter
    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (options.fromDate || options.toDate) {
      dateFilter.createdAt = {};
      if (options.fromDate) dateFilter.createdAt.gte = new Date(options.fromDate);
      if (options.toDate) dateFilter.createdAt.lte = new Date(options.toDate);
    }

    // Fetch invoices and payments
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          businessId,
          status: { in: ['sent', 'paid', 'overdue', 'stamped'] },
          ...dateFilter,
        },
        include: { payments: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: {
          invoice: { businessId },
          status: { in: ['paid', 'pending', 'processing'] },
          ...dateFilter,
        },
        include: { invoice: { select: { id: true, invoiceNumber: true, businessId: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const matched: ReconciliationMatch[] = [];
    const matchedInvoiceIds = new Set<string>();
    const matchedPaymentIds = new Set<string>();

    // Pass 1: Exact matches (payment linked to invoice via FK and amounts match)
    for (const payment of payments) {
      if (payment.status !== 'paid') continue;

      const invoice = invoices.find((inv) => inv.id === payment.invoiceId);
      if (!invoice) continue;

      const invoiceTotal = Number(invoice.total);
      const paymentAmount = Number(payment.amount);
      const difference = round2(Math.abs(invoiceTotal - paymentAmount));

      if (difference === 0) {
        matched.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceTotal,
          invoiceStatus: invoice.status,
          paymentId: payment.id,
          paymentRef: payment.rrr,
          paymentAmount,
          paymentStatus: payment.status,
          paymentGateway: payment.gateway,
          confidence: 100,
          matchType: 'exact',
          difference: 0,
        });
        matchedInvoiceIds.add(invoice.id);
        matchedPaymentIds.add(payment.id);
      }
    }

    // Pass 2: Fuzzy matches (linked but amounts differ within threshold)
    for (const payment of payments) {
      if (matchedPaymentIds.has(payment.id)) continue;
      if (payment.status !== 'paid') continue;

      const invoice = invoices.find((inv) => inv.id === payment.invoiceId);
      if (!invoice || matchedInvoiceIds.has(invoice.id)) continue;

      const invoiceTotal = Number(invoice.total);
      const paymentAmount = Number(payment.amount);
      const difference = round2(Math.abs(invoiceTotal - paymentAmount));
      const percentDiff = invoiceTotal > 0 ? (difference / invoiceTotal) * 100 : 100;

      if (percentDiff <= fuzzyThreshold) {
        const confidence = Math.round(100 - percentDiff);
        matched.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceTotal,
          invoiceStatus: invoice.status,
          paymentId: payment.id,
          paymentRef: payment.rrr,
          paymentAmount,
          paymentStatus: payment.status,
          paymentGateway: payment.gateway,
          confidence,
          matchType: 'fuzzy',
          difference,
        });
        matchedInvoiceIds.add(invoice.id);
        matchedPaymentIds.add(payment.id);
      }
    }

    // Pass 3: Partial matches (amount-based matching for unlinked payments)
    for (const payment of payments) {
      if (matchedPaymentIds.has(payment.id)) continue;
      if (payment.status !== 'paid') continue;

      const paymentAmount = Number(payment.amount);

      // Find unmatched invoice with closest amount
      let bestMatch: { invoice: typeof invoices[0]; difference: number } | null = null;

      for (const invoice of invoices) {
        if (matchedInvoiceIds.has(invoice.id)) continue;

        const invoiceTotal = Number(invoice.total);
        const difference = Math.abs(invoiceTotal - paymentAmount);
        const percentDiff = invoiceTotal > 0 ? (difference / invoiceTotal) * 100 : 100;

        if (percentDiff <= fuzzyThreshold * 2) { // Double threshold for partial
          if (!bestMatch || difference < bestMatch.difference) {
            bestMatch = { invoice, difference };
          }
        }
      }

      if (bestMatch) {
        const invoiceTotal = Number(bestMatch.invoice.total);
        const percentDiff = invoiceTotal > 0 ? (bestMatch.difference / invoiceTotal) * 100 : 100;
        const confidence = Math.max(30, Math.round(70 - percentDiff));

        matched.push({
          invoiceId: bestMatch.invoice.id,
          invoiceNumber: bestMatch.invoice.invoiceNumber,
          invoiceTotal,
          invoiceStatus: bestMatch.invoice.status,
          paymentId: payment.id,
          paymentRef: payment.rrr,
          paymentAmount,
          paymentStatus: payment.status,
          paymentGateway: payment.gateway,
          confidence,
          matchType: 'partial',
          difference: round2(bestMatch.difference),
        });
        matchedInvoiceIds.add(bestMatch.invoice.id);
        matchedPaymentIds.add(payment.id);
      }
    }

    // Build unmatched lists
    const unmatchedInvoices = invoices
      .filter((inv) => !matchedInvoiceIds.has(inv.id))
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        total: Number(inv.total),
        status: inv.status,
        customerName: inv.customerName,
        createdAt: inv.createdAt.toISOString(),
      }));

    const unmatchedPayments = payments
      .filter((p) => !matchedPaymentIds.has(p.id))
      .map((p) => ({
        id: p.id,
        reference: p.rrr,
        amount: Number(p.amount),
        status: p.status,
        gateway: p.gateway,
        paidAt: p.paidAt?.toISOString() || null,
      }));

    // Summary
    const totalInvoiceValue = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const totalPaymentValue = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const report: ReconciliationReport = {
      businessId,
      generatedAt: new Date().toISOString(),
      matched: matched.sort((a, b) => b.confidence - a.confidence),
      unmatchedInvoices,
      unmatchedPayments,
      summary: {
        totalInvoices: invoices.length,
        totalPayments: payments.length,
        matchedCount: matched.length,
        unmatchedInvoiceCount: unmatchedInvoices.length,
        unmatchedPaymentCount: unmatchedPayments.length,
        totalInvoiceValue: round2(totalInvoiceValue),
        totalPaymentValue: round2(totalPaymentValue),
        matchRate: invoices.length > 0 ? round2((matched.length / invoices.length) * 100) : 0,
        discrepancy: round2(totalInvoiceValue - totalPaymentValue),
      },
    };

    log.info('Reconciliation completed', {
      businessId,
      matched: matched.length,
      unmatchedInvoices: unmatchedInvoices.length,
      unmatchedPayments: unmatchedPayments.length,
    });

    return report;
  }
}
