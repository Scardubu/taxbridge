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

function getDeadlineSeverity(daysAway: number, criticalThreshold: number, warningThreshold: number): TaxDeadline['severity'] {
  if (daysAway <= criticalThreshold) {
    return 'critical';
  }

  if (daysAway <= warningThreshold) {
    return 'warning';
  }

  return 'info';
}

function createMonthlyDeadline({
  id,
  title,
  description,
  dueDate,
  type,
  route,
  severity,
  now,
}: {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  type: TaxDeadline['type'];
  route: TaxDeadline['route'];
  severity: TaxDeadline['severity'];
  now: Date;
}): TaxDeadline {
  return {
    id,
    title,
    description,
    dueDate,
    type,
    timeZone: 'Africa/Lagos',
    daysAway: daysUntil(dueDate, now),
    route,
    severity,
  };
}

function addVatDeadlines(deadlines: TaxDeadline[], year: number, now: Date, t: typeof i18next.t) {
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const dueDate = lagosDate(year, monthIndex, 21);
    if (dueDate < now) {
      continue;
    }

    const daysAway = daysUntil(dueDate, now);
    deadlines.push(
      createMonthlyDeadline({
        id: `vat-${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        title: t('calendar.deadlines.vatTitle'),
        description: t('calendar.deadlines.vatDescription', {
          month: dueDate.toLocaleString('en-NG', { month: 'long' }),
          year,
        }),
        dueDate,
        type: 'VAT',
        route: '/(tabs)/tax-calendar',
        severity: getDeadlineSeverity(daysAway, 7, 14),
        now,
      }),
    );
  }
}

function addWhtDeadlines(deadlines: TaxDeadline[], year: number, now: Date, t: typeof i18next.t) {
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const dueDate = lagosDate(year, monthIndex, 21);
    if (dueDate < now) {
      continue;
    }

    const daysAway = daysUntil(dueDate, now);
    deadlines.push(
      createMonthlyDeadline({
        id: `wht-${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        title: t('calendar.deadlines.whtTitle'),
        description: t('calendar.deadlines.whtDescription', {
          month: dueDate.toLocaleString('en-NG', { month: 'long' }),
          year,
        }),
        dueDate,
        type: 'WHT',
        route: '/(tabs)/tax-calendar',
        severity: getDeadlineSeverity(daysAway, 7, 7),
        now,
      }),
    );
  }
}

function addCitDeadline(deadlines: TaxDeadline[], year: number, now: Date, t: typeof i18next.t) {
  const dueDate = lagosDate(year + 1, 5, 30);
  const daysAway = daysUntil(dueDate, now);

  deadlines.push({
    id: `cit-${year}`,
    title: t('calendar.deadlines.citTitle'),
    description: t('calendar.deadlines.citDescription', {
      year,
      dueYear: year + 1,
    }),
    dueDate,
    type: 'CIT',
    timeZone: 'Africa/Lagos',
    daysAway,
    route: '/(tabs)/compliance',
    severity: getDeadlineSeverity(daysAway, 30, 30),
  });
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
    addVatDeadlines(deadlines, year, now, t);
  }

  addWhtDeadlines(deadlines, year, now, t);

  if (!isSole) {
    addCitDeadline(deadlines, year, now, t);
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
