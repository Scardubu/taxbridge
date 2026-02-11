/**
 * Expense Management API Client (Phase 5)
 *
 * Mobile client for the expense tracking endpoints.
 * Supports offline-first architecture via SyncContext integration.
 */

import { api } from './api';

// =============================================================================
// Types
// =============================================================================

export type ExpenseCategory =
  | 'office-supplies'
  | 'travel'
  | 'meals'
  | 'utilities'
  | 'rent'
  | 'fuel'
  | 'maintenance'
  | 'professional-services'
  | 'telecommunications'
  | 'insurance'
  | 'marketing'
  | 'equipment'
  | 'other';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'office-supplies', label: 'Office Supplies' },
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent & Lease' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'maintenance', label: 'Maintenance & Repairs' },
  { value: 'professional-services', label: 'Professional Services' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

export interface CreateExpenseInput {
  businessId: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  date: string;
  vatAmount?: number;
  vatEligible?: boolean;
  receiptImage?: string;
}

export interface UpdateExpenseInput {
  amount?: number;
  category?: ExpenseCategory;
  description?: string;
  date?: string;
  vatAmount?: number;
  vatEligible?: boolean;
  receiptImage?: string;
}

export interface ScanReceiptInput {
  businessId: string;
  image: string; // base64
  mimeType?: string;
}

export interface ExpenseSummary {
  id: string;
  businessId: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  vatAmount: number;
  vatEligible: boolean;
  receiptImage: string | null;
  ocrData: Record<string, unknown> | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  expenses: ExpenseSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ExpenseStats {
  totalExpenses: number;
  totalAmount: number;
  totalVatRecoverable: number;
  byCategory: Array<{ category: string; count: number; total: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byMonth: Array<{ month: string; count: number; total: number }>;
}

export interface OCRScanResult {
  ocrResult: {
    amount?: number;
    date?: string;
    items?: Array<{ description: string; quantity: number; unitPrice: number }>;
    confidence: number;
  };
  expense: ExpenseSummary | null;
  message?: string;
}

export interface ExpenseListFilters {
  businessId: string;
  category?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Create a new expense
 */
export async function createExpense(
  input: CreateExpenseInput
): Promise<{ expense: ExpenseSummary }> {
  const response = await api.post('/expenses', input);
  return response.data;
}

/**
 * Create expense from receipt scan (OCR)
 */
export async function scanReceipt(
  input: ScanReceiptInput
): Promise<OCRScanResult> {
  const response = await api.post('/expenses/scan', {
    businessId: input.businessId,
    image: input.image,
    mimeType: input.mimeType || 'image/jpeg',
  });
  return response.data;
}

/**
 * List expenses with filters and pagination
 */
export async function listExpenses(
  filters: ExpenseListFilters
): Promise<ExpenseListResponse> {
  const params = new URLSearchParams();
  params.set('businessId', filters.businessId);
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.minAmount !== undefined) params.set('minAmount', String(filters.minAmount));
  if (filters.maxAmount !== undefined) params.set('maxAmount', String(filters.maxAmount));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const response = await api.get(`/expenses?${params.toString()}`);
  return response.data;
}

/**
 * Get expense detail by ID
 */
export async function getExpense(expenseId: string): Promise<{ expense: ExpenseSummary }> {
  const response = await api.get(`/expenses/${expenseId}`);
  return response.data;
}

/**
 * Update an existing expense (pending only)
 */
export async function updateExpense(
  expenseId: string,
  input: UpdateExpenseInput
): Promise<{ expense: ExpenseSummary }> {
  const response = await api.put(`/expenses/${expenseId}`, input);
  return response.data;
}

/**
 * Delete an expense (pending only)
 */
export async function deleteExpense(expenseId: string): Promise<{ deleted: boolean }> {
  const response = await api.delete(`/expenses/${expenseId}`);
  return response.data;
}

/**
 * Approve an expense
 */
export async function approveExpense(expenseId: string): Promise<{ expense: ExpenseSummary }> {
  const response = await api.post(`/expenses/${expenseId}/approve`);
  return response.data;
}

/**
 * Reject an expense
 */
export async function rejectExpense(expenseId: string): Promise<{ expense: ExpenseSummary }> {
  const response = await api.post(`/expenses/${expenseId}/reject`);
  return response.data;
}

/**
 * Get expense statistics for a business
 */
export async function getExpenseStats(businessId: string): Promise<ExpenseStats> {
  const response = await api.get(`/expenses/stats?businessId=${businessId}`);
  return response.data;
}
