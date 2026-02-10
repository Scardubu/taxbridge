/**
 * Payroll Management API Client (Phase 6)
 *
 * Mobile client for employee management and payroll processing endpoints.
 */

import { api } from './api';

// =============================================================================
// Types
// =============================================================================

export interface Employee {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  phone: string | null;
  grossSalary: number;
  allowances: {
    housing: number;
    transport: number;
    meal: number;
    others: number;
  };
  startDate: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

export interface CreateEmployeeInput {
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  grossSalary: number;
  allowances?: {
    housing?: number;
    transport?: number;
    meal?: number;
    others?: number;
  };
  startDate: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  email?: string;
  phone?: string;
  grossSalary?: number;
  allowances?: {
    housing?: number;
    transport?: number;
    meal?: number;
    others?: number;
  };
  status?: 'active' | 'inactive' | 'suspended';
}

export interface PayrollSummary {
  id: string;
  period: string;
  status: string;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  totalPension: number;
  totalNHF: number;
  processedAt: string | null;
}

export interface PayrollItem {
  employeeId: string;
  employeeName: string;
  grossSalary: number;
  totalAllowances: number;
  grossIncome: number;
  pensionContribution: number;
  nhfContribution: number;
  taxableIncome: number;
  payeTax: number;
  netPay: number;
  breakdown: Array<{ description: string; amount: number }>;
}

export interface PayrollDetail extends PayrollSummary {
  items: PayrollItem[];
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

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const res = await api.post('/payroll/employees', input);
  return res.data.employee;
}

export async function listEmployees(
  businessId: string,
  params?: { status?: string; page?: number; limit?: number }
): Promise<{ employees: Employee[]; pagination: Pagination }> {
  const query = new URLSearchParams({ businessId });
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const res = await api.get(`/payroll/employees?${query}`);
  return res.data;
}

export async function getEmployee(id: string): Promise<Employee> {
  const res = await api.get(`/payroll/employees/${id}`);
  return res.data.employee;
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  const res = await api.put(`/payroll/employees/${id}`, input);
  return res.data.employee;
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/payroll/employees/${id}`);
}

export async function processPayroll(
  businessId: string,
  period: string
): Promise<{ payroll: PayrollSummary; items: PayrollItem[] }> {
  const res = await api.post('/payroll/process', { businessId, period });
  return res.data;
}

export async function listPayrolls(
  businessId: string,
  params?: { page?: number; limit?: number }
): Promise<{ payrolls: PayrollSummary[]; pagination: Pagination }> {
  const query = new URLSearchParams({ businessId });
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const res = await api.get(`/payroll?${query}`);
  return res.data;
}

export async function getPayrollDetail(id: string): Promise<PayrollDetail> {
  const res = await api.get(`/payroll/${id}`);
  return res.data.payroll;
}

export async function getPayslip(payrollId: string, employeeId: string): Promise<PayrollItem> {
  const res = await api.get(`/payroll/${payrollId}/payslip/${employeeId}`);
  return res.data.payslip;
}
