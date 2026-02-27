/**
 * Invoice Management API Client (Phase 4)
 *
 * Mobile client for the enhanced invoice management endpoints.
 * Supports offline-first architecture via SyncContext integration.
 */

import { api } from './api';

// =============================================================================
// Types
// =============================================================================

export interface InvoiceCustomer {
  name: string;
  email?: string;
  phone?: string;
  tin?: string;
  address?: string;
  endpointId?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatApplicable?: boolean;
}

export interface CreateInvoiceInput {
  businessId?: string;
  customer: InvoiceCustomer;
  items: InvoiceItem[];
  dueDate?: string;
  template?: 'professional' | 'retail' | 'service' | 'wholesale';
  nrsCompliant?: boolean;
  notes?: string;
  asDraft?: boolean;
}

export interface UpdateInvoiceInput {
  customer?: Partial<InvoiceCustomer>;
  items?: InvoiceItem[];
  dueDate?: string;
  template?: 'professional' | 'retail' | 'service' | 'wholesale';
  nrsCompliant?: boolean;
  notes?: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  total: string;
  status: string;
  dueDate: string | null;
  nrsCompliant: boolean;
  createdAt: string;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  userId: string;
  businessId: string | null;
  business: {
    id: string;
    name: string;
    tin: string;
    email: string;
    phone: string;
  } | null;
  customer: InvoiceCustomer & { name: string | null };
  items: InvoiceItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  dueDate: string | null;
  template: string;
  status: string;
  nrsCompliant: boolean;
  nrsCSID: string | null;
  nrsIRN: string | null;
  nrsReference: string | null;
  qrCode: string | null;
  pdfUrl: string | null;
  notes: string | null;
  ublXml: string | null;
  sentAt: string | null;
  payments: Array<{
    id: string;
    status: string;
    amount: number;
    gateway: string;
    paidAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceListResponse {
  invoices: InvoiceSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  nextCursor: string | null;
}

export interface InvoiceStats {
  counts: {
    total: number;
    draft: number;
    sent: number;
    paid: number;
    overdue: number;
    cancelled: number;
  };
  totalRevenue: number;
  outstandingAmount: number;
}

export interface InvoiceListFilters {
  status?: string;
  businessId?: string;
  fromDate?: string;
  toDate?: string;
  customerName?: string;
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PDFGenerationOptions {
  template?: 'professional' | 'retail' | 'service' | 'wholesale';
  includeQR?: boolean;
  includeNRSBadge?: boolean;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Create a new invoice
 */
export async function createInvoiceMgmt(
  input: CreateInvoiceInput,
  idempotencyKey?: string
): Promise<{ invoice: { id: string; invoiceNumber: string; status: string; total: number } }> {
  const response = await api.post('/invoice-mgmt', input, { idempotencyKey });
  return response.data;
}

/**
 * List invoices with filters and pagination
 */
export async function listInvoices(
  filters: InvoiceListFilters = {}
): Promise<InvoiceListResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.businessId) params.set('businessId', filters.businessId);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.customerName) params.set('customerName', filters.customerName);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.cursor) params.set('cursor', filters.cursor);

  const query = params.toString();
  const path = query ? `/invoice-mgmt?${query}` : '/invoice-mgmt';
  const response = await api.get(path);
  return response.data;
}

/**
 * Get invoice detail by ID
 */
export async function getInvoice(invoiceId: string): Promise<{ invoice: InvoiceDetail }> {
  const response = await api.get(`/invoice-mgmt/${invoiceId}`);
  return response.data;
}

/**
 * Update an existing invoice (draft/failed only)
 */
export async function updateInvoice(
  invoiceId: string,
  input: UpdateInvoiceInput
): Promise<{ invoice: { id: string; invoiceNumber: string; status: string } }> {
  const response = await api.put(`/invoice-mgmt/${invoiceId}`, input);
  return response.data;
}

/**
 * Cancel an invoice
 */
export async function cancelInvoice(
  invoiceId: string
): Promise<{ id: string; status: string }> {
  const response = await api.post(`/invoice-mgmt/${invoiceId}/cancel`);
  return response.data;
}

/**
 * Mark invoice as sent
 */
export async function markInvoiceAsSent(
  invoiceId: string
): Promise<{ id: string; status: string }> {
  const response = await api.post(`/invoice-mgmt/${invoiceId}/send`);
  return response.data;
}

/**
 * Submit invoice for NRS stamping
 */
export async function submitForNRSStamping(
  invoiceId: string
): Promise<{ id: string; status: string }> {
  const response = await api.post(`/invoice-mgmt/${invoiceId}/submit-nrs`);
  return response.data;
}

/**
 * Generate invoice PDF (returns HTML for rendering)
 */
export async function generateInvoicePDF(
  invoiceId: string,
  options: PDFGenerationOptions = {}
): Promise<{ html: string; fileName: string; invoiceNumber: string }> {
  const response = await api.post(`/invoice-mgmt/${invoiceId}/pdf`, options);
  return response.data;
}

/**
 * Get invoice statistics
 */
export async function getInvoiceStats(
  businessId?: string
): Promise<InvoiceStats> {
  const path = businessId
    ? `/invoice-mgmt/stats?businessId=${businessId}`
    : '/invoice-mgmt/stats';
  const response = await api.get(path);
  return response.data;
}
