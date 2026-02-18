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
}
