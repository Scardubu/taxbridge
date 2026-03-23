import { computeObligations, type BusinessProfile } from './nrsCompliance';
import { generateTaxCalendar } from './taxCalendar';

export type NudgePriority = 'critical' | 'warning' | 'opportunity';

export interface ComplianceNudge {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  priority: NudgePriority;
  actionLabel: string;
  route: '/(tabs)/invoices' | '/(tabs)/tax-calendar' | '/(tabs)/compliance' | '/(tabs)/settings';
}

const PRIORITY_ORDER: Record<NudgePriority, number> = { critical: 0, warning: 1, opportunity: 2 };

/**
 * Blueprint v6 nudge generator.
 * Accepts pre-computed obligations so callers can reuse existing computation.
 * Priority order: critical → warning → opportunity (max 3 returned).
 */
export function generateNudges(
  profile: BusinessProfile,
  obligations: ReturnType<typeof computeObligations>,
): ComplianceNudge[] {
  const nudges: ComplianceNudge[] = [];
  const year = new Date().getFullYear();
  const calendar = generateTaxCalendar(profile, year);
  const urgentDeadline = calendar.find((d) => d.daysAway > 0 && d.daysAway <= 7);

  if (!profile.hasValidTIN) {
    nudges.push({
      id: 'missing-tin',
      title: 'Verify your TIN',
      body: 'No TIN → 10% WHT deducted from ALL payments you receive.',
      severity: 'critical',
      priority: 'critical',
      actionLabel: 'Verify TIN now',
      route: '/(tabs)/compliance',
    });
  }

  if (urgentDeadline) {
    nudges.push({
      id: `deadline-${urgentDeadline.id}`,
      title: urgentDeadline.title,
      body: `${urgentDeadline.description} Due in ${urgentDeadline.daysAway} day${urgentDeadline.daysAway === 1 ? '' : 's'}.`,
      severity: urgentDeadline.daysAway <= 3 ? 'critical' : 'warning',
      priority: urgentDeadline.daysAway <= 3 ? 'critical' : 'warning',
      actionLabel: 'Open calendar',
      route: '/(tabs)/tax-calendar',
    });
  }

  if (obligations.vatRegistrationRequired && !profile.isVatRegistered) {
    nudges.push({
      id: 'vat-required',
      title: 'VAT setup needed',
      body: 'Turnover exceeds ₦25M threshold — register for VAT and start charging on invoices.',
      severity: 'warning',
      priority: 'warning',
      actionLabel: 'Review VAT',
      route: '/(tabs)/compliance',
    });
  }

  if (obligations.citRate === 0) {
    nudges.push({
      id: 'cit-zero',
      title: 'You qualify for 0% Company Tax',
      body: 'Small company relief applies — your CIT rate is 0% this year.',
      severity: 'info',
      priority: 'opportunity',
      actionLabel: 'View details',
      route: '/(tabs)/compliance',
    });
  }

  if (obligations.vatFilingExempt) {
    nudges.push({
      id: 'vat-filing-exempt',
      title: 'VAT return filing exemption',
      body: 'Your turnover is under ₦100M — you are exempt from filing monthly VAT returns.',
      severity: 'info',
      priority: 'opportunity',
      actionLabel: 'Learn more',
      route: '/(tabs)/compliance',
    });
  }

  if (!obligations.eInvoicingMandatory) {
    nudges.push({
      id: 'einvoice-readiness',
      title: 'Prepare for e-invoicing',
      body: 'Banks offer faster invoice financing to e-invoice-ready businesses.',
      severity: 'info',
      priority: 'opportunity',
      actionLabel: 'View readiness',
      route: '/(tabs)/invoices',
    });
  }

  return nudges
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, 3);
}

/** Backward-compatible wrapper — computes obligations internally. */
export function buildComplianceNudges(profile: BusinessProfile): ComplianceNudge[] {
  return generateNudges(profile, computeObligations(profile));
}
