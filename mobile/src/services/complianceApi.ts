/**
 * Compliance Alerts API Client (Phase 6)
 *
 * Mobile client for tax compliance reminder management.
 */

import { api } from './api';

// =============================================================================
// Types
// =============================================================================

export type TaxType = 'VAT' | 'PAYE' | 'CIT' | 'WHT' | 'PIT';
export type ReminderStatus = 'pending' | 'filed' | 'overdue' | 'dismissed';
export type ReminderPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ReminderSummary {
  id: string;
  taxType: string;
  dueDate: string;
  status: string;
  priority: string;
  description: string;
  amount: number | null;
  daysUntilDue: number;
  estimatedPenalty: number;
}

export interface ComplianceDashboard {
  upcoming: ReminderSummary[];
  overdue: ReminderSummary[];
  filed: ReminderSummary[];
  stats: {
    totalPending: number;
    totalOverdue: number;
    totalFiled: number;
    nextDeadline: string | null;
    estimatedPenalties: number;
  };
}

export interface Reminder {
  id: string;
  taxType: string;
  dueDate: string;
  status: string;
  priority: string;
  description: string;
  amount: number | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// =============================================================================
// API Functions
// =============================================================================

export async function generateReminders(
  businessId: string,
  monthsAhead?: number
): Promise<{ generated: number; reminders: Array<{ taxType: string; dueDate: string }> }> {
  const res = await api.post('/compliance/generate', { businessId, monthsAhead });
  return res.data;
}

export async function getDashboard(businessId: string): Promise<ComplianceDashboard> {
  const res = await api.get(`/compliance/dashboard?businessId=${businessId}`);
  return res.data;
}

export async function listReminders(
  businessId: string,
  params?: { status?: string; taxType?: string; page?: number; limit?: number }
): Promise<{ reminders: Reminder[]; pagination: Pagination }> {
  const query = new URLSearchParams({ businessId });
  if (params?.status) query.set('status', params.status);
  if (params?.taxType) query.set('taxType', params.taxType);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const res = await api.get(`/compliance/reminders?${query}`);
  return res.data;
}

export async function createReminder(input: {
  businessId: string;
  taxType: TaxType;
  dueDate: string;
  amount?: number;
  description?: string;
}): Promise<Reminder> {
  const res = await api.post('/compliance/reminders', input);
  return res.data.reminder;
}

export async function markFiled(reminderId: string, amount?: number): Promise<Reminder> {
  const res = await api.post(`/compliance/reminders/${reminderId}/file`, { amount });
  return res.data.reminder;
}

export async function dismissReminder(reminderId: string): Promise<Reminder> {
  const res = await api.post(`/compliance/reminders/${reminderId}/dismiss`);
  return res.data.reminder;
}
