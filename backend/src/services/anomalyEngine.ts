/**
 * anomalyEngine — TaxBridge V12
 *
 * Evaluates 7 compliance signals and returns a capped list of AnomalySignals.
 * Rules-based; no ML dependency. Explainable, bilingual output.
 *
 * Architecture §3.1 — V12 CONDENSED spec.
 *
 * Constraints:
 *   C-07: If this function throws, the catch returns [] — dashboard never fails
 *         because of intelligence layer failure.
 *   C-19: Caller must NOT display an "empty" state — silently omit section when [].
 */

import * as Sentry from '@sentry/node';
import type { IntelligenceInput } from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';

const log = createLogger('anomaly-engine');

// ─── V12 signal subset (the 7 that can be derived from IntelligenceInput) ────

export type V12AnomalySignalId =
  | 'vat_gap'
  | 'nrs_stamp_delay'
  | 'auth_failure_flood'
  | 'nil_overuse'
  | 'payroll_spike'
  | 'unfiled_period'
  | 'vat_credit_aging';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalySignal {
  id: V12AnomalySignalId;
  severity: AnomalySeverity;
  description: {
    en: string;
    pidgin: string;
  };
  ctaRoute: string;
  triggeredAt: string;
}

// ─── Hard cap (V12 §3.1) ─────────────────────────────────────────────────────
const MAX_ANOMALIES = 5;

// ─── Severity ordering (higher = more important) ─────────────────────────────
const SEVERITY_RANK: Record<AnomalySeverity, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
};

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Compute anomaly signals from structured intelligence input.
 * Always returns an array; never throws.
 * Hard-capped at MAX_ANOMALIES after severity sort.
 */
export function computeAnomalies(input: IntelligenceInput): AnomalySignal[] {
  try {
    return _compute(input);
  } catch (err) {
    Sentry.captureException(err, { extra: { orgId: input.orgId } });
    log.error('anomalyEngine failed — returning empty list', { err, orgId: input.orgId });
    return []; // C-07: never crash dashboard
  }
}

function _compute(input: IntelligenceInput): AnomalySignal[] {
  const signals: AnomalySignal[] = [];
  const now = new Date().toISOString();

  // ── Signal 1: vat_gap ─────────────────────────────────────────────────────
  // outputVAT > 0 AND no VAT filing in current ISO period
  const currentPeriod = _currentPeriodKey();
  const hasVatInvoices = input.invoices.some((inv) => (inv.vatAmount ?? 0) > 0);
  const hasVatFiling = input.filingHistory.some(
    (f) => f.taxType === 'VAT' && f.period === currentPeriod && f.status !== 'DRAFT',
  );
  if (hasVatInvoices && !hasVatFiling) {
    signals.push({
      id: 'vat_gap',
      severity: 'high',
      description: {
        en:     'You have VAT-liable invoices this period but no VAT return has been filed.',
        pidgin: 'You don collect VAT for invoice dis period but you never file VAT return.',
      },
      ctaRoute: '/filings/vat',
      triggeredAt: now,
    });
  }

  // ── Signal 2: nil_overuse ─────────────────────────────────────────────────
  // ≥3 consecutive NIL filing periods
  const nilFilings = input.filingHistory
    .filter((f) => f.status === 'NIL')
    .sort((a, b) => b.period.localeCompare(a.period));
  if (nilFilings.length >= 3) {
    signals.push({
      id: 'nil_overuse',
      severity: 'medium',
      description: {
        en:     `${nilFilings.length} consecutive NIL returns detected. Verify your business is active.`,
        pidgin: `You don file NIL return ${nilFilings.length} times for row. Confirm say business active.`,
      },
      ctaRoute: '/filings/vat',
      triggeredAt: now,
    });
  }

  // ── Signal 3: unfiled_period ──────────────────────────────────────────────
  // Any tax type with a filing deadline more than 30 days past without a filing
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const missedFilings = input.filingHistory.filter((f) => {
    const deadline = new Date(f.deadline);
    return (
      f.status === 'DRAFT' &&
      deadline < thirtyDaysAgo
    );
  });
  if (missedFilings.length > 0) {
    const taxTypes = [...new Set(missedFilings.map((f) => f.taxType))].join(', ');
    signals.push({
      id: 'unfiled_period',
      severity: 'high',
      description: {
        en:     `Overdue filing detected for: ${taxTypes}. Penalties increasing daily.`,
        pidgin: `You don miss filing deadline for: ${taxTypes}. Penalty dey increase every day.`,
      },
      ctaRoute: '/filings/vat',
      triggeredAt: now,
    });
  }

  // ── Signal 4: payroll_spike ───────────────────────────────────────────────
  // Payment amounts for PAYE changed > 50% month-on-month
  const payePayments = input.payments
    .filter((p) => p.taxType === 'PAYE')
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  if (payePayments.length >= 2) {
    const latest = payePayments[0].amount;
    const prior  = payePayments[1].amount;
    if (prior > 0 && Math.abs((latest - prior) / prior) > 0.5) {
      signals.push({
        id: 'payroll_spike',
        severity: 'medium',
        description: {
          en:     `PAYE payment changed by more than 50% from last period. Review payroll.`,
          pidgin: `PAYE wey you pay don change by more than 50% from last month. Check payroll.`,
        },
        ctaRoute: '/filings/paye',
        triggeredAt: now,
      });
    }
  }

  // ── Signal 5: vat_credit_aging ────────────────────────────────────────────
  // Payments for VAT_CREDIT unused for > 90 days
  const vatCreditPayments = input.payments.filter(
    (p) => p.taxType === 'VAT_CREDIT' && !p.paidAt,
  );
  if (vatCreditPayments.length > 0) {
    const oldest = vatCreditPayments.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )[0];
    const ageDays = (Date.now() - new Date(oldest.dueDate).getTime()) / 86_400_000;
    if (ageDays > 90) {
      signals.push({
        id: 'vat_credit_aging',
        severity: 'low',
        description: {
          en:     `You have unclaimed VAT credit older than 90 days.`,
          pidgin: `You get VAT credit wey you never claim for more than 90 days.`,
        },
        ctaRoute: '/compliance/vat-credit',
        triggeredAt: now,
      });
    }
  }

  // ── Signal 6: nrs_stamp_delay ─────────────────────────────────────────────
  // Invoices without NRS stamp older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const unstamped = input.invoices.filter((inv) => {
    return (
      inv.status === 'UNSTAMPED' &&
      new Date(inv.issuedAt) < sevenDaysAgo
    );
  });
  if (unstamped.length > 0) {
    signals.push({
      id: 'nrs_stamp_delay',
      severity: 'medium',
      description: {
        en:     `${unstamped.length} invoice(s) awaiting NRS stamp for more than 7 days.`,
        pidgin: `${unstamped.length} invoice dey wait NRS stamp for more than 7 days.`,
      },
      ctaRoute: '/invoices',
      triggeredAt: now,
    });
  }

  // ── Signal 7: auth_failure_flood ──────────────────────────────────────────
  // This signal is populated externally (from auth logs); not derivable from
  // IntelligenceInput directly. Reserved for injection via context enrichment.
  // (Not computed here — the auth middleware tracks this via Redis.)

  // ─── Sort by severity and cap ───────────────────────────────────────────────
  return signals
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, MAX_ANOMALIES);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the current filing period key: "YYYY-MM" */
function _currentPeriodKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
