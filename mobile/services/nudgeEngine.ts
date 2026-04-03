import { computeObligations, type BusinessProfile } from './nrsCompliance';
import { generateTaxCalendar } from './taxCalendar';
import i18next from 'i18next';

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
  const t = i18next.t.bind(i18next);

  if (!profile.hasValidTIN) {
    nudges.push({
      id: 'missing-tin',
      title: t('dashboard.nudgeCards.missingTin.title'),
      body: t('dashboard.nudgeCards.missingTin.body'),
      severity: 'critical',
      priority: 'critical',
      actionLabel: t('dashboard.nudgeCards.missingTin.action'),
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
      actionLabel: t('dashboard.nudgeCards.deadline.action'),
      route: '/(tabs)/tax-calendar',
    });
  }

  if (obligations.vatRegistrationRequired && !profile.isVatRegistered) {
    nudges.push({
      id: 'vat-required',
      title: t('dashboard.nudgeCards.vatRequired.title'),
      body: t('dashboard.nudgeCards.vatRequired.body'),
      severity: 'warning',
      priority: 'warning',
      actionLabel: t('dashboard.nudgeCards.vatRequired.action'),
      route: '/(tabs)/compliance',
    });
  }

  if (obligations.citRate === 0) {
    nudges.push({
      id: 'cit-zero',
      title: t('dashboard.nudgeCards.citZero.title'),
      body: t('dashboard.nudgeCards.citZero.body'),
      severity: 'info',
      priority: 'opportunity',
      actionLabel: t('dashboard.nudgeCards.citZero.action'),
      route: '/(tabs)/compliance',
    });
  }

  if (obligations.vatFilingExempt) {
    nudges.push({
      id: 'vat-filing-exempt',
      title: t('dashboard.nudgeCards.vatExempt.title'),
      body: t('dashboard.nudgeCards.vatExempt.body'),
      severity: 'info',
      priority: 'opportunity',
      actionLabel: t('dashboard.nudgeCards.vatExempt.action'),
      route: '/(tabs)/compliance',
    });
  }

  if (!obligations.eInvoicingMandatory) {
    nudges.push({
      id: 'einvoice-readiness',
      title: t('dashboard.nudgeCards.einvoiceReadiness.title'),
      body: t('dashboard.nudgeCards.einvoiceReadiness.body'),
      severity: 'info',
      priority: 'opportunity',
      actionLabel: t('dashboard.nudgeCards.einvoiceReadiness.action'),
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
