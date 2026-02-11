/**
 * Reconciliation API Client (Phase 6)
 *
 * Mobile client for invoice-payment reconciliation.
 */

import { api } from './api';

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
// API Functions
// =============================================================================

export async function runReconciliation(
  businessId: string,
  options?: { fromDate?: string; toDate?: string; fuzzyThreshold?: number }
): Promise<ReconciliationReport> {
  const res = await api.post('/reconciliation/run', {
    businessId,
    ...options,
  });
  return res.data.report;
}
