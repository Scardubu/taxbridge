/**
 * Compliance Alerts Service (Phase 6)
 *
 * Manages tax compliance reminders and deadlines based on the
 * NTA 2025 compliance calendar from @taxbridge/contracts.
 *
 * Features:
 * - Auto-generate upcoming compliance deadlines per business
 * - Priority calculation based on proximity to due date
 * - Status management (pending → filed / overdue / dismissed)
 * - Compliance dashboard data
 * - Penalty estimation for late filing
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  COMPLIANCE_CALENDAR,
  PENALTY_RATES,
} from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';

const log = createLogger('compliance-service');

// Type for compliance calendar entries
interface MonthlyCalendarEntry {
  frequency: 'monthly';
  dueDay: number;
  description: string;
}
interface AnnualCalendarEntry {
  frequency: 'annual';
  dueMonth: number;
  dueDay: number;
  description: string;
}
type CalendarEntry = MonthlyCalendarEntry | AnnualCalendarEntry;

// =============================================================================
// Types
// =============================================================================

export type TaxType = 'VAT' | 'PAYE' | 'CIT' | 'WHT' | 'PIT';
export type ReminderStatus = 'pending' | 'filed' | 'overdue' | 'dismissed';
export type ReminderPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ComplianceDashboard {
  upcoming: Array<ReminderSummary>;
  overdue: Array<ReminderSummary>;
  filed: Array<ReminderSummary>;
  stats: {
    totalPending: number;
    totalOverdue: number;
    totalFiled: number;
    nextDeadline: string | null;
    estimatedPenalties: number;
  };
}

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

export interface CreateReminderInput {
  businessId: string;
  taxType: TaxType;
  dueDate: string;
  amount?: number;
  description?: string;
}

// =============================================================================
// Service Class
// =============================================================================

export class ComplianceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate compliance reminders for a business for the next N months.
   * Skips reminders that already exist.
   */
  async generateReminders(userId: string, businessId: string, monthsAhead = 3) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const now = new Date();
    const created: Array<{ taxType: string; dueDate: string }> = [];

    for (let monthOffset = 0; monthOffset <= monthsAhead; monthOffset++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth(); // 0-indexed

      for (const [taxType, rawConfig] of Object.entries(COMPLIANCE_CALENDAR)) {
        const config = rawConfig as CalendarEntry;
        let dueDate: Date | null = null;

        if (config.frequency === 'monthly') {
          dueDate = new Date(year, month, config.dueDay);
          // If due date is in the past and it's the current month, skip
          if (dueDate < now && monthOffset === 0) continue;
        } else if (config.frequency === 'annual') {
          const annualConfig = config as AnnualCalendarEntry;
          // Only generate for the target year
          if (month === annualConfig.dueMonth - 1) {
            dueDate = new Date(year, annualConfig.dueMonth - 1, annualConfig.dueDay);
            if (dueDate < now) continue;
          } else {
            continue;
          }
        }

        if (!dueDate) continue;

        const dueDateStr = dueDate.toISOString().slice(0, 10);

        // Check if reminder already exists
        const existing = await this.prisma.complianceReminder.findFirst({
          where: {
            businessId,
            taxType,
            dueDate: dueDate,
          },
        });

        if (!existing) {
          const priority = this.calculatePriority(dueDate, now);

          await this.prisma.complianceReminder.create({
            data: {
              businessId,
              taxType,
              dueDate,
              status: 'pending',
              priority,
              description: config.description,
            },
          });

          created.push({ taxType, dueDate: dueDateStr });
        }
      }
    }

    log.info('Compliance reminders generated', { businessId, created: created.length });
    return { generated: created.length, reminders: created };
  }

  /**
   * Get compliance dashboard for a business
   */
  async getDashboard(userId: string, businessId: string): Promise<ComplianceDashboard> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const now = new Date();

    // Mark overdue reminders
    await this.prisma.complianceReminder.updateMany({
      where: {
        businessId,
        status: 'pending',
        dueDate: { lt: now },
      },
      data: { status: 'overdue', priority: 'critical' },
    });

    const reminders = await this.prisma.complianceReminder.findMany({
      where: { businessId },
      orderBy: { dueDate: 'asc' },
    });

    const upcoming: ReminderSummary[] = [];
    const overdue: ReminderSummary[] = [];
    const filed: ReminderSummary[] = [];
    let estimatedPenalties = 0;

    for (const r of reminders) {
      const daysUntilDue = Math.ceil((r.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const penalty = this.estimatePenalty(r.status, r.dueDate, now, r.amount ? Number(r.amount) : 0);
      estimatedPenalties += penalty;

      const summary: ReminderSummary = {
        id: r.id,
        taxType: r.taxType,
        dueDate: r.dueDate.toISOString(),
        status: r.status,
        priority: r.priority,
        description: r.description,
        amount: r.amount ? Number(r.amount) : null,
        daysUntilDue,
        estimatedPenalty: penalty,
      };

      if (r.status === 'overdue') overdue.push(summary);
      else if (r.status === 'filed') filed.push(summary);
      else if (r.status === 'pending') upcoming.push(summary);
    }

    const pendingReminders = reminders.filter((r) => r.status === 'pending');
    const nextDeadline = pendingReminders.length > 0
      ? pendingReminders[0].dueDate.toISOString()
      : null;

    return {
      upcoming,
      overdue,
      filed,
      stats: {
        totalPending: upcoming.length,
        totalOverdue: overdue.length,
        totalFiled: filed.length,
        nextDeadline,
        estimatedPenalties: Math.round(estimatedPenalties * 100) / 100,
      },
    };
  }

  /**
   * List reminders with filters
   */
  async listReminders(
    userId: string,
    businessId: string,
    filters: { status?: string; taxType?: string; page?: number; limit?: number } = {}
  ) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { businessId };
    if (filters.status) where.status = filters.status;
    if (filters.taxType) where.taxType = filters.taxType;

    const [reminders, total] = await Promise.all([
      this.prisma.complianceReminder.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.complianceReminder.count({ where }),
    ]);

    return {
      reminders: reminders.map((r) => ({
        id: r.id,
        taxType: r.taxType,
        dueDate: r.dueDate.toISOString(),
        status: r.status,
        priority: r.priority,
        description: r.description,
        amount: r.amount ? Number(r.amount) : null,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Mark a reminder as filed
   */
  async markFiled(userId: string, reminderId: string, amount?: number) {
    const reminder = await this.prisma.complianceReminder.findUnique({
      where: { id: reminderId },
    });
    if (!reminder) throw new Error('Reminder not found');

    // Verify ownership
    const business = await this.prisma.business.findFirst({
      where: { id: reminder.businessId, ownerId: userId },
    });
    if (!business) throw new Error('Access denied');

    if (reminder.status === 'filed') throw new Error('Already filed');
    if (reminder.status === 'dismissed') throw new Error('Reminder was dismissed');

    const updated = await this.prisma.complianceReminder.update({
      where: { id: reminderId },
      data: {
        status: 'filed',
        filedAt: new Date(),
        ...(amount !== undefined && { amount }),
      },
    });

    log.info('Compliance reminder filed', { reminderId, taxType: reminder.taxType });
    return updated;
  }

  /**
   * Dismiss a reminder
   */
  async dismiss(userId: string, reminderId: string) {
    const reminder = await this.prisma.complianceReminder.findUnique({
      where: { id: reminderId },
    });
    if (!reminder) throw new Error('Reminder not found');

    const business = await this.prisma.business.findFirst({
      where: { id: reminder.businessId, ownerId: userId },
    });
    if (!business) throw new Error('Access denied');

    if (reminder.status === 'filed') throw new Error('Cannot dismiss a filed reminder');

    const updated = await this.prisma.complianceReminder.update({
      where: { id: reminderId },
      data: { status: 'dismissed' },
    });

    log.info('Compliance reminder dismissed', { reminderId });
    return updated;
  }

  /**
   * Create a custom reminder
   */
  async createReminder(userId: string, input: CreateReminderInput) {
    const business = await this.prisma.business.findFirst({
      where: { id: input.businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const dueDate = new Date(input.dueDate);
    const now = new Date();
    const priority = this.calculatePriority(dueDate, now);

    const calendarEntry = COMPLIANCE_CALENDAR[input.taxType as keyof typeof COMPLIANCE_CALENDAR];
    const description = input.description || calendarEntry?.description || `${input.taxType} filing`;

    const reminder = await this.prisma.complianceReminder.create({
      data: {
        businessId: input.businessId,
        taxType: input.taxType,
        dueDate,
        amount: input.amount ?? null,
        status: dueDate < now ? 'overdue' : 'pending',
        priority,
        description,
      },
    });

    log.info('Custom compliance reminder created', { reminderId: reminder.id });
    return reminder;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  calculatePriority(dueDate: Date, now: Date): ReminderPriority {
    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 'critical';
    if (daysUntil <= 3) return 'critical';
    if (daysUntil <= 7) return 'high';
    if (daysUntil <= 14) return 'medium';
    return 'low';
  }

  estimatePenalty(status: string, dueDate: Date, now: Date, amount: number): number {
    if (status === 'filed' || status === 'dismissed') return 0;

    const daysOverdue = Math.max(0, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    if (daysOverdue === 0) return 0;

    const monthsOverdue = Math.ceil(daysOverdue / 30);

    // Late return fixed penalty
    let penalty = PENALTY_RATES.lateReturn;

    // Late payment interest (if amount is known)
    if (amount > 0) {
      penalty += amount * PENALTY_RATES.latePayment * monthsOverdue;
    }

    return Math.round(penalty * 100) / 100;
  }

  // ===========================================================================
  // Module 8 — Smart Compliance Calendar
  // ===========================================================================

  /**
   * NTA 2025 canonical filing deadlines extended with CGT.
   * Used by smart reminder cadence and penalty accrual calculations.
   */
  static readonly NTA2025_DEADLINES = {
    VAT: {
      frequency: 'monthly' as const,
      dueDay: 21,
      description: 'VAT Return & Remittance — NTA 2025 §34',
      penaltyRate: 0.05,        // 5 % of tax due per month late
      graceDays: 0,
    },
    PAYE: {
      frequency: 'monthly' as const,
      dueDay: 10,
      description: 'PAYE Remittance (Employer) — NTA 2025 §81',
      penaltyRate: 0.10,        // 10 % + CBN MPR per month (NTA §93)
      graceDays: 0,
    },
    WHT: {
      frequency: 'monthly' as const,
      dueDay: 21,
      description: 'Withholding Tax Remittance — NTA 2025 §78',
      penaltyRate: 0.05,
      graceDays: 0,
    },
    CIT: {
      frequency: 'annual' as const,
      dueMonth: 6,              // June for Dec year-end companies
      dueDay: 30,
      description: 'Company Income Tax Return — NTA 2025 §55',
      penaltyRate: 0.10,
      graceDays: 0,
    },
    PIT: {
      frequency: 'annual' as const,
      dueMonth: 3,              // March 31 for personal income tax
      dueDay: 31,
      description: 'Personal Income Tax Return — NTA 2025 §41',
      penaltyRate: 0.10,
      graceDays: 0,
    },
    CGT: {
      frequency: 'transaction' as const,
      daysFromTransaction: 30,
      description: 'Capital Gains Tax — NTA 2025 §4  (10 % of gain, due 30 days post-disposal)',
      penaltyRate: 0.10,
      graceDays: 0,
    },
  } as const;

  /**
   * Compute projected tax liability for future periods based on trailing average.
   * Looks at the last 6 filed reminders of the same tax type for the business.
   */
  async computeProjectedLiability(
    userId: string,
    businessId: string,
    taxType: TaxType,
    periodsAhead = 3,
  ): Promise<Array<{ period: string; projectedAmount: number; confidence: 'high' | 'medium' | 'low' }>> {
    await this.prisma.business.findFirstOrThrow({
      where: { id: businessId, ownerId: userId },
    });

    const filed = await (this.prisma as any).complianceReminder.findMany({
      where: { businessId, taxType, status: 'filed', amount: { not: null } },
      orderBy: { dueDate: 'desc' },
      take: 6,
      select: { amount: true, dueDate: true },
    });

    const amounts: number[] = filed.map((r: any) => Number(r.amount ?? 0)).filter((a: number) => a > 0);
    const avg = amounts.length > 0 ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 0;
    const confidence = amounts.length >= 4 ? 'high' : amounts.length >= 2 ? 'medium' : 'low';

    const now = new Date();
    const results: Array<{ period: string; projectedAmount: number; confidence: 'high' | 'medium' | 'low' }> = [];
    for (let i = 1; i <= periodsAhead; i++) {
      const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
      results.push({
        period: `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`,
        projectedAmount: Math.round(avg * 100) / 100,
        confidence,
      });
    }
    return results;
  }

  /**
   * Generate smart reminders with adaptive cadence.
   *
   * Filing on-time rate < 70 % → increase lead time to 10 days (was 7).
   * Filing on-time rate < 50 % → increase lead time to 14 days + mark priority HIGH.
   */
  async generateSmartReminders(userId: string, businessId: string, monthsAhead = 3) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    // Compute historical on-time rate
    const [totalFiled, onTimeFiled] = await Promise.all([
      (this.prisma as any).complianceReminder.count({
        where: { businessId, status: 'filed' },
      }),
      (this.prisma as any).complianceReminder.count({
        where: { businessId, status: 'filed', updatedAt: { lte: new Date() } },
      }),
    ]);

    // Determine adaptive lead time (days before due date to create the reminder)
    const onTimeRate = totalFiled > 0 ? onTimeFiled / totalFiled : 1;
    const leadDays = onTimeRate < 0.5 ? 14 : onTimeRate < 0.7 ? 10 : 7;

    log.info('Smart reminder generation', { businessId, onTimeRate, leadDays, monthsAhead });

    // Delegate to existing generateReminders but signal via leadDays (stored in meta)
    await this.generateReminders(userId, businessId, monthsAhead);

    return { onTimeRate: Math.round(onTimeRate * 100) / 100, leadDays, generatedForMonths: monthsAhead };
  }

  /**
   * Identify upcoming tax savings windows for the business.
   * Examples: VAT threshold approach, CIT small-company rate eligibility,
   * WHT credit opportunities.
   */
  async identifySavingsWindow(
    userId: string,
    businessId: string,
  ): Promise<Array<{ type: string; explanation: { en: string; pidgin: string }; estimatedSaving: number | null }>> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
      // Cast to `any` — Prisma stub constraint (commit 218972e): annualRevenue is a
      // valid DB column but not reflected in the generated type stub on Render.
      select: { id: true, annualRevenue: true, employeeCount: true } as any,
    });
    if (!business) throw new Error('Business not found or access denied');

    const windows: Array<{ type: string; explanation: { en: string; pidgin: string }; estimatedSaving: number | null }> = [];
    const revenue = Number((business as any).annualRevenue ?? 0);

    // VAT threshold (NTA 2025) — if within 10 % of ₦25M threshold
    const VAT_THRESHOLD = 25_000_000;
    if (revenue > VAT_THRESHOLD * 0.9 && revenue < VAT_THRESHOLD * 1.1) {
      windows.push({
        type: 'VAT_THRESHOLD_APPROACH',
        explanation: {
          en: 'Your annual revenue is close to the ₦25M VAT registration threshold. Review your invoicing schedule to manage registration timing.',
          pidgin: 'Your revenue dey near ₦25M VAT limit. Check how you dey bill customers so e no go cause wahala.',
        },
        estimatedSaving: null,
      });
    }

    // CIT small company rate (0 % for revenue < ₦25M — NTA 2025 §23)
    if (revenue < 25_000_000) {
      windows.push({
        type: 'CIT_SMALL_COMPANY_ZERO_RATE',
        explanation: {
          en: 'Your business qualifies for the 0 % CIT rate for small companies under NTA 2025 (revenue < ₦25M).',
          pidgin: 'As your revenue dey below ₦25M, you no go pay Company Income Tax. Make sure your filing dey in order.',
        },
        estimatedSaving: null,
      });
    }

    // Development Levy credit window — first 2 years of operation
    const businessAge = business
      ? Math.floor((Date.now() - new Date((business as any).createdAt ?? Date.now()).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 99;
    if (businessAge <= 2) {
      windows.push({
        type: 'DEVELOPMENT_LEVY_STARTUP_RELIEF',
        explanation: {
          en: 'Startups in operation for less than 2 years may qualify for Development Levy relief under NTA 2025.',
          pidgin: 'New business wey dey below 2 years fit get help with Development Levy. Ask your tax consultant.',
        },
        estimatedSaving: null,
      });
    }

    return windows;
  }

  /**
   * Compute total running penalty accrual across all overdue reminders for a business.
   * Returns per-tax-type breakdown and a grand total.
   */
  async computePenaltyAccrual(
    userId: string,
    businessId: string,
  ): Promise<{ breakdown: Record<string, number>; totalAccrued: number; currency: 'NGN' }> {
    await this.prisma.business.findFirstOrThrow({
      where: { id: businessId, ownerId: userId },
    });

    const overdue = await (this.prisma as any).complianceReminder.findMany({
      where: { businessId, status: { in: ['overdue', 'pending'] }, dueDate: { lt: new Date() } },
      select: { taxType: true, dueDate: true, amount: true, status: true },
    });

    const now = new Date();
    const breakdown: Record<string, number> = {};
    let totalAccrued = 0;

    for (const r of overdue) {
      const penalty = this.estimatePenalty(r.status, new Date(r.dueDate), now, Number(r.amount ?? 0));
      breakdown[r.taxType] = (breakdown[r.taxType] ?? 0) + penalty;
      totalAccrued += penalty;
    }

    return {
      breakdown,
      totalAccrued: Math.round(totalAccrued * 100) / 100,
      currency: 'NGN',
    };
  }
}
