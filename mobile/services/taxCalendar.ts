import type { BusinessProfile } from './nrsCompliance';
import i18next from 'i18next';

export interface TaxDeadline {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  type: 'VAT' | 'CIT' | 'WHT';
  timeZone: 'Africa/Lagos';
  daysAway: number;
  route: '/(tabs)/tax-calendar' | '/(tabs)/compliance' | '/(tabs)/settings';
  severity: 'info' | 'warning' | 'critical';
}

/** WAT = UTC+1. We anchor day-boundaries to Lagos midnight. */
function lagosDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 23, 0, 0));
}

function daysUntil(target: Date, from: Date): number {
  return Math.ceil((target.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Generate the full tax deadline calendar for a given year, personalised
 * to the business profile (VAT filing exemption, CIT sole-trader bypass).
 */
export function generateTaxCalendar(profile: BusinessProfile, year: number): TaxDeadline[] {
  const now = new Date();
  const deadlines: TaxDeadline[] = [];
  const isSole = ['sole_trader', 'partnership'].includes(profile.businessType);
  const vatFilingRequired =
    profile.isVatRegistered || profile.annualTurnover > 100_000_000;
  const t = i18next.t.bind(i18next);

  if (vatFilingRequired) {
    for (let m = 0; m < 12; m++) {
      const due = lagosDate(year, m, 21);
      if (due >= now) {
        deadlines.push({
          id: `vat-${year}-${String(m + 1).padStart(2, '0')}`,
          title: t('calendar.deadlines.vatTitle'),
          description: t('calendar.deadlines.vatDescription', {
            month: due.toLocaleString('en-NG', { month: 'long' }),
            year,
          }),
          dueDate: due,
          type: 'VAT',
          timeZone: 'Africa/Lagos',
          daysAway: daysUntil(due, now),
          route: '/(tabs)/tax-calendar',
          severity: daysUntil(due, now) <= 7 ? 'critical' : daysUntil(due, now) <= 14 ? 'warning' : 'info',
        });
      }
    }
  }

  for (let m = 0; m < 12; m++) {
    const due = lagosDate(year, m, 21);
    if (due >= now) {
      deadlines.push({
        id: `wht-${year}-${String(m + 1).padStart(2, '0')}`,
        title: t('calendar.deadlines.whtTitle'),
        description: t('calendar.deadlines.whtDescription', {
          month: due.toLocaleString('en-NG', { month: 'long' }),
          year,
        }),
        dueDate: due,
        type: 'WHT',
        timeZone: 'Africa/Lagos',
        daysAway: daysUntil(due, now),
        route: '/(tabs)/tax-calendar',
        severity: daysUntil(due, now) <= 7 ? 'critical' : 'warning',
      });
    }
  }

  if (!isSole) {
    const citDue = lagosDate(year + 1, 5, 30);
    deadlines.push({
      id: `cit-${year}`,
      title: t('calendar.deadlines.citTitle'),
      description: t('calendar.deadlines.citDescription', {
        year,
        dueYear: year + 1,
      }),
      dueDate: citDue,
      type: 'CIT',
      timeZone: 'Africa/Lagos',
      daysAway: daysUntil(citDue, now),
      route: '/(tabs)/compliance',
      severity: daysUntil(citDue, now) <= 30 ? 'critical' : 'warning',
    });
  }

  return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/** Backward-compatible helper used by nudgeEngine and existing screens. */
export function getUpcomingDeadlines(referenceDate = new Date()): Array<TaxDeadline & { dueDate: Date; daysAway: number }> {
  const year = referenceDate.getFullYear();
  const stub: BusinessProfile = {
    annualTurnover: 200_000_000,
    totalFixedAssets: 0,
    sector: 'services',
    businessType: 'limited_company',
    isVatRegistered: true,
    hasValidTIN: true,
  };
  return generateTaxCalendar(stub, year);
}
