/**
 * Payroll Service (Phase 6)
 *
 * Employee management, payroll processing, and PAYE calculation.
 * Uses the tax engine's calculatePAYE for accurate NTA 2025 compliance.
 *
 * Features:
 * - Employee CRUD with business ownership checks
 * - Payroll processing for a given period (month)
 * - Individual payslip data with full PAYE breakdown
 * - Payroll statistics and history
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { calculatePAYE, PAYEResult } from './tax-engine';
import { createLogger } from '../lib/logger';

const log = createLogger('payroll-service');

// =============================================================================
// Types
// =============================================================================

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
  startDate: string; // ISO date
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

export interface EmployeeFilters {
  businessId: string;
  status?: string;
  page?: number;
  limit?: number;
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

export interface PayslipData {
  employeeId: string;
  employeeName: string;
  period: string;
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

// =============================================================================
// Helper
// =============================================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// =============================================================================
// Service Class
// =============================================================================

export class PayrollService {
  constructor(private prisma: PrismaClient) {}

  // ===========================================================================
  // Employee CRUD
  // ===========================================================================

  async createEmployee(userId: string, input: CreateEmployeeInput) {
    const business = await this.prisma.business.findFirst({
      where: { id: input.businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const employee = await this.prisma.employee.create({
      data: {
        businessId: input.businessId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        grossSalary: input.grossSalary,
        housingAllowance: input.allowances?.housing ?? 0,
        transportAllowance: input.allowances?.transport ?? 0,
        mealAllowance: input.allowances?.meal ?? 0,
        otherAllowances: input.allowances?.others ?? 0,
        startDate: new Date(input.startDate),
        status: 'active',
      },
    });

    log.info('Employee created', { employeeId: employee.id, businessId: input.businessId });
    return employee;
  }

  async getEmployee(userId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { business: { select: { id: true, name: true, ownerId: true } } },
    });
    if (!employee) return null;
    if (employee.business.ownerId !== userId) return null;
    return employee;
  }

  async listEmployees(userId: string, filters: EmployeeFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const business = await this.prisma.business.findFirst({
      where: { id: filters.businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const where: Prisma.EmployeeWhereInput = { businessId: filters.businessId };
    if (filters.status) where.status = filters.status;

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      employees,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async updateEmployee(userId: string, employeeId: string, input: UpdateEmployeeInput) {
    const employee = await this.getEmployee(userId, employeeId);
    if (!employee) throw new Error('Employee not found or access denied');

    const data: Prisma.EmployeeUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.grossSalary !== undefined) data.grossSalary = input.grossSalary;
    if (input.status !== undefined) data.status = input.status;
    if (input.allowances) {
      if (input.allowances.housing !== undefined) data.housingAllowance = input.allowances.housing;
      if (input.allowances.transport !== undefined) data.transportAllowance = input.allowances.transport;
      if (input.allowances.meal !== undefined) data.mealAllowance = input.allowances.meal;
      if (input.allowances.others !== undefined) data.otherAllowances = input.allowances.others;
    }

    const updated = await this.prisma.employee.update({ where: { id: employeeId }, data });
    log.info('Employee updated', { employeeId });
    return updated;
  }

  async deleteEmployee(userId: string, employeeId: string) {
    const employee = await this.getEmployee(userId, employeeId);
    if (!employee) throw new Error('Employee not found or access denied');

    // Soft-delete by setting status to inactive
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { status: 'inactive' },
    });
    log.info('Employee deactivated', { employeeId });
    return { deleted: true };
  }

  // ===========================================================================
  // Payroll Processing
  // ===========================================================================

  async processPayroll(userId: string, businessId: string, period: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    // Validate period format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new Error('Invalid period format. Use YYYY-MM');
    }

    // Check for existing payroll for this period
    const existing = await this.prisma.payroll.findUnique({
      where: { businessId_period: { businessId, period } },
    });
    if (existing && existing.status === 'completed') {
      throw new Error(`Payroll for ${period} has already been processed`);
    }

    // Get all active employees
    const employees = await this.prisma.employee.findMany({
      where: { businessId, status: 'active' },
    });

    if (employees.length === 0) {
      throw new Error('No active employees found');
    }

    // Calculate PAYE for each employee
    const payrollItems: Array<{
      employeeId: string;
      employeeName: string;
      paye: PAYEResult;
      grossSalary: number;
      allowances: { housing: number; transport: number; meal: number; others: number };
    }> = [];

    let totalGross = 0;
    let totalNet = 0;
    let totalTax = 0;
    let totalPension = 0;
    let totalNHF = 0;

    for (const emp of employees) {
      const grossSalary = Number(emp.grossSalary);
      const allowances = {
        housing: Number(emp.housingAllowance),
        transport: Number(emp.transportAllowance),
        meal: Number(emp.mealAllowance),
        others: Number(emp.otherAllowances),
      };

      const paye = calculatePAYE({ grossSalary, allowances });

      totalGross += paye.grossIncome;
      totalNet += paye.netPay;
      totalTax += paye.taxDue;
      totalPension += paye.pensionContribution;
      totalNHF += paye.nhfContribution;

      payrollItems.push({
        employeeId: emp.id,
        employeeName: emp.name,
        paye,
        grossSalary,
        allowances,
      });
    }

    // Create or update payroll record with items in a transaction
    const payroll = await this.prisma.$transaction(async (tx) => {
      // Upsert payroll
      const payrollRecord = existing
        ? await tx.payroll.update({
            where: { id: existing.id },
            data: {
              status: 'completed',
              totalGross: round2(totalGross),
              totalNet: round2(totalNet),
              totalTax: round2(totalTax),
              totalPension: round2(totalPension),
              totalNHF: round2(totalNHF),
              employeeCount: employees.length,
              processedBy: userId,
              processedAt: new Date(),
            },
          })
        : await tx.payroll.create({
            data: {
              businessId,
              period,
              status: 'completed',
              totalGross: round2(totalGross),
              totalNet: round2(totalNet),
              totalTax: round2(totalTax),
              totalPension: round2(totalPension),
              totalNHF: round2(totalNHF),
              employeeCount: employees.length,
              processedBy: userId,
              processedAt: new Date(),
            },
          });

      // Delete old items if re-processing
      if (existing) {
        await tx.payrollItem.deleteMany({ where: { payrollId: payrollRecord.id } });
      }

      // Create payroll items
      for (const item of payrollItems) {
        await tx.payrollItem.create({
          data: {
            payrollId: payrollRecord.id,
            employeeId: item.employeeId,
            grossSalary: item.grossSalary,
            totalAllowances: item.paye.totalAllowances,
            grossIncome: item.paye.grossIncome,
            pensionContribution: item.paye.pensionContribution,
            nhfContribution: item.paye.nhfContribution,
            taxableIncome: item.paye.taxableIncome,
            payeTax: item.paye.taxDue,
            netPay: item.paye.netPay,
            breakdown: item.paye.breakdown as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return payrollRecord;
    });

    log.info('Payroll processed', {
      payrollId: payroll.id,
      period,
      employeeCount: employees.length,
      totalGross: round2(totalGross),
      totalTax: round2(totalTax),
    });

    return {
      payroll: {
        id: payroll.id,
        period: payroll.period,
        status: payroll.status,
        employeeCount: payroll.employeeCount,
        totalGross: Number(payroll.totalGross),
        totalNet: Number(payroll.totalNet),
        totalTax: Number(payroll.totalTax),
        totalPension: Number(payroll.totalPension),
        totalNHF: Number(payroll.totalNHF),
        processedAt: payroll.processedAt?.toISOString() || null,
      },
      items: payrollItems.map((item) => ({
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        grossSalary: item.grossSalary,
        totalAllowances: item.paye.totalAllowances,
        grossIncome: item.paye.grossIncome,
        pensionContribution: item.paye.pensionContribution,
        nhfContribution: item.paye.nhfContribution,
        taxableIncome: item.paye.taxableIncome,
        payeTax: item.paye.taxDue,
        netPay: item.paye.netPay,
        breakdown: item.paye.breakdown,
      })),
    };
  }

  // ===========================================================================
  // Payroll History & Payslips
  // ===========================================================================

  async listPayrolls(userId: string, businessId: string, page = 1, limit = 20) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));

    const [payrolls, total] = await Promise.all([
      this.prisma.payroll.findMany({
        where: { businessId },
        orderBy: { period: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payroll.count({ where: { businessId } }),
    ]);

    return {
      payrolls: payrolls.map((p) => ({
        id: p.id,
        period: p.period,
        status: p.status,
        employeeCount: p.employeeCount,
        totalGross: Number(p.totalGross),
        totalNet: Number(p.totalNet),
        totalTax: Number(p.totalTax),
        totalPension: Number(p.totalPension),
        totalNHF: Number(p.totalNHF),
        processedAt: p.processedAt?.toISOString() || null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getPayrollDetail(userId: string, payrollId: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        items: {
          include: {
            // We can't include employee directly since there's no relation defined
            // We'll fetch employees separately
          },
        },
      },
    });
    if (!payroll) return null;

    // Verify ownership
    const business = await this.prisma.business.findFirst({
      where: { id: payroll.businessId, ownerId: userId },
    });
    if (!business) return null;

    // Fetch employee names for items
    const employeeIds = payroll.items.map((i) => i.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, email: true },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    return {
      id: payroll.id,
      period: payroll.period,
      status: payroll.status,
      employeeCount: payroll.employeeCount,
      totalGross: Number(payroll.totalGross),
      totalNet: Number(payroll.totalNet),
      totalTax: Number(payroll.totalTax),
      totalPension: Number(payroll.totalPension),
      totalNHF: Number(payroll.totalNHF),
      processedAt: payroll.processedAt?.toISOString() || null,
      items: payroll.items.map((item) => {
        const emp = empMap.get(item.employeeId);
        return {
          employeeId: item.employeeId,
          employeeName: emp?.name || 'Unknown',
          employeeEmail: emp?.email || null,
          grossSalary: Number(item.grossSalary),
          totalAllowances: Number(item.totalAllowances),
          grossIncome: Number(item.grossIncome),
          pensionContribution: Number(item.pensionContribution),
          nhfContribution: Number(item.nhfContribution),
          taxableIncome: Number(item.taxableIncome),
          payeTax: Number(item.payeTax),
          netPay: Number(item.netPay),
          breakdown: item.breakdown,
        };
      }),
    };
  }

  async getPayslip(userId: string, payrollId: string, employeeId: string): Promise<PayslipData | null> {
    const detail = await this.getPayrollDetail(userId, payrollId);
    if (!detail) return null;

    const item = detail.items.find((i) => i.employeeId === employeeId);
    if (!item) return null;

    return {
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      period: detail.period,
      grossSalary: item.grossSalary,
      totalAllowances: item.totalAllowances,
      grossIncome: item.grossIncome,
      pensionContribution: item.pensionContribution,
      nhfContribution: item.nhfContribution,
      taxableIncome: item.taxableIncome,
      payeTax: item.payeTax,
      netPay: item.netPay,
      breakdown: item.breakdown as Array<{ description: string; amount: number }>,
    };
  }
}
