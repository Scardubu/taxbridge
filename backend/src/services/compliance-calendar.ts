/**
 * TaxBridge — Compliance Calendar Service
 * getUpcomingDeadlines(): computes upcoming Nigerian tax deadlines from user's filing history
 *
 * Constraints:
 *   C-01  Prisma `any` types only
 *   C-09  Deadline dates computed from NTA 2025 schedule — not hardcoded
 *
 * Nigerian tax deadline schedule (NTA 2025):
 *   VAT:  21st of the month following the return period
 *   PAYE: 10th of the month following payroll period
 *   WHT:  21st of the month following the deduction period
 *   PIT:  31 March (annual) or as extended by SIRS notice
 *   CIT:  6 months after company year-end
 */

import type { PrismaClient } from '@prisma/client';

export interface ComplianceEvent {
  id:            string;
  type:          'VAT' | 'PAYE' | 'WHT' | 'PIT' | 'CIT';
  dueDate:       string;     // ISO date 'YYYY-MM-DD'
  daysRemaining: number;     // negative = overdue
  penaltyIfLate: string;     // e.g. "₦10,000 + 5% of tax due"
  status:        'upcoming' | 'overdue' | 'filed';
  periodLabel:   string;     // e.g. "February 2026"
}

// NTA 2025 penalty schedule
const PENALTIES: Record<string, string> = {
  VAT:  '₦10,000 + 5% of tax due (§44)',
  PAYE: '₦10,000 + 10% per month (§81)',
  WHT:  '₦10,000 + 10% per month (§82)',
  PIT:  '₦50,000 first month + ₦25,000 subsequent (§94)',
  CIT:  '₦25,000 first month + ₦5,000 subsequent (CITA §55)',
};

export async function getUpcomingDeadlines(
  userId:  string,
  prisma:  PrismaClient,
  days:    number = 30,
): Promise<ComplianceEvent[]> {
  const today     = new Date();
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + days);

  // Pull user's business type and filed periods
  const user = await (prisma as any).user.findUnique({
    where:  { id: userId },
    select: {
      businessType: true,
      createdAt:    true,
      filings:      {
        select:  { type: true, periodStart: true, periodEnd: true, status: true },
        where:   { createdAt: { gte: new Date(today.getFullYear(), 0, 1) } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) return [];

  const deadlines: ComplianceEvent[] = [];
  const filedPeriods = new Set<string>(
    (user.filings ?? [])
      .filter((f: any) => f.status === 'ACCEPTED' || f.status === 'SUBMITTED')
      .map((f: any) => `${f.type}:${f.periodStart?.toISOString().slice(0, 7)}`)
  );

  // ── VAT deadlines (monthly — 21st of following month) ─────────────────────
  {
    const periods = getMonthlyPeriods(today, days);
    for (const period of periods) {
      const dueDate = new Date(period.year, period.month + 1, 21); // 21st of next month
      const key = `VAT:${period.year}-${String(period.month + 1).padStart(2, '0')}`;
      if (!filedPeriods.has(key)) {
        const daysRemaining = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
        if (daysRemaining <= days) {
          deadlines.push({
            id:            `vat-${period.year}-${period.month}`,
            type:          'VAT',
            dueDate:       dueDate.toISOString().split('T')[0],
            daysRemaining,
            penaltyIfLate: PENALTIES.VAT,
            status:        daysRemaining < 0 ? 'overdue' : 'upcoming',
            periodLabel:   `${MONTH_NAMES[period.month]} ${period.year}`,
          });
        }
      }
    }
  }

  // ── PAYE deadlines (monthly — 10th of following month) ────────────────────
  // Only for businesses with payroll (check for any payroll expense category)
  const hasPayroll = await (prisma as any).expense.count({
    where: { userId, category: 'PAYROLL' },
    take:  1,
  });

  if (hasPayroll > 0) {
    const periods = getMonthlyPeriods(today, days);
    for (const period of periods) {
      const dueDate = new Date(period.year, period.month + 1, 10);
      const key = `PAYE:${period.year}-${String(period.month + 1).padStart(2, '0')}`;
      if (!filedPeriods.has(key)) {
        const daysRemaining = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
        if (daysRemaining <= days) {
          deadlines.push({
            id:            `paye-${period.year}-${period.month}`,
            type:          'PAYE',
            dueDate:       dueDate.toISOString().split('T')[0],
            daysRemaining,
            penaltyIfLate: PENALTIES.PAYE,
            status:        daysRemaining < 0 ? 'overdue' : 'upcoming',
            periodLabel:   `${MONTH_NAMES[period.month]} ${period.year}`,
          });
        }
      }
    }
  }

  // ── Annual PIT deadline (31 March) ────────────────────────────────────────
  {
    const pitDue = new Date(today.getFullYear(), 2, 31); // March 31
    const pitKey = `PIT:${today.getFullYear()}-01`;
    const daysRemaining = Math.round((pitDue.getTime() - today.getTime()) / 86_400_000);
    if (!filedPeriods.has(pitKey) && daysRemaining <= days) {
      deadlines.push({
        id:            `pit-${today.getFullYear()}`,
        type:          'PIT',
        dueDate:       pitDue.toISOString().split('T')[0],
        daysRemaining,
        penaltyIfLate: PENALTIES.PIT,
        status:        daysRemaining < 0 ? 'overdue' : 'upcoming',
        periodLabel:   `Annual ${today.getFullYear()}`,
      });
    }
  }

  // Sort: overdue first (most negative daysRemaining), then soonest upcoming
  deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return deadlines;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthlyPeriods(
  today:         Date,
  lookAheadDays: number,
): Array<{ year: number; month: number }> {
  const periods: Array<{ year: number; month: number }> = [];
  // Include current month and the one before (in case deadline already passed this month)
  for (let offset = -1; offset <= Math.ceil(lookAheadDays / 30); offset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    periods.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return periods;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
