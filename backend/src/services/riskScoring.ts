/**
 * riskScoring — TaxBridge V12
 *
 * Computes a 0–100 composite risk score for an SME from 5 sub-components.
 * Higher score = higher risk.
 *
 * Architecture §3.2 — V12 spec.
 *
 * Sub-scores:
 *   1. filing_latency   — Days overdue on most-recent filing
 *   2. payment_gap      — Ratio of outstanding to total payment obligations
 *   3. vat_compliance   — VAT filings missing in rolling 12-period window
 *   4. nrs_stamp_rate   — Proportion of invoices that are unstamped
 *   5. nil_overuse      — Consecutive NIL return penalty
 *
 * Constraints:
 *   C-07: Never throws — returns neutral score (50) on any error.
 *   C-09: No inline tax math — this file scores operational risk only.
 */

import * as Sentry from '@sentry/node';
import type { IntelligenceInput } from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';

const log = createLogger('risk-scoring');

// ─── Output types ─────────────────────────────────────────────────────────────

export type RiskBand = 'low' | 'medium' | 'high' | 'critical';

export interface RiskScoreResult {
  score:    number;        // 0–100 (100 = highest risk)
  band:     RiskBand;
  subScores: {
    filingLatency:  number;
    paymentGap:     number;
    vatCompliance:  number;
    nrsStampRate:   number;
    nilOveruse:     number;
  };
  computedAt: string;
}

// ─── Weight configuration ─────────────────────────────────────────────────────
// Weights must sum to 1.0
const WEIGHTS = {
  filingLatency: 0.30,
  paymentGap:    0.25,
  vatCompliance: 0.20,
  nrsStampRate:  0.15,
  nilOveruse:    0.10,
} as const;

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Compute composite risk score. Always returns a valid result.
 * On error, returns score=50 (neutral) with Sentry capture.
 */
export function computeRiskScore(input: IntelligenceInput): RiskScoreResult {
  try {
    return _compute(input);
  } catch (err) {
    Sentry.captureException(err, { extra: { orgId: input.orgId } });
    log.error('riskScoring failed — returning neutral score', { err, orgId: input.orgId });
    return _neutral();
  }
}

function _compute(input: IntelligenceInput): RiskScoreResult {
  const now = new Date();

  // ── 1. Filing latency (0–100) ──────────────────────────────────────────────
  // Find max overdue days across all filings
  const overdueDays = input.filingHistory
    .filter((f) => f.status === 'DRAFT' && new Date(f.deadline) < now)
    .map((f) => (now.getTime() - new Date(f.deadline).getTime()) / 86_400_000)
    ;
  const maxOverdue = overdueDays.length > 0 ? Math.max(...overdueDays) : 0;
  // Cap at 90 days → 100 risk
  const filingLatency = _clamp(maxOverdue / 90 * 100, 0, 100);

  // ── 2. Payment gap (0–100) ────────────────────────────────────────────────
  const unpaid = input.payments.filter((p) => !p.paidAt && new Date(p.dueDate) < now);
  const paymentGap = input.payments.length > 0
    ? _clamp((unpaid.length / input.payments.length) * 100, 0, 100)
    : 0;

  // ── 3. VAT compliance (0–100) ─────────────────────────────────────────────
  // How many of the last 12 filing periods have a completed VAT return?
  const vatFilings = input.filingHistory.filter((f) => f.taxType === 'VAT');
  const completedVat = vatFilings.filter((f) => f.status === 'SUBMITTED' || f.status === 'ACCEPTED');
  // We expect at least 4 per year (quarterly) or 12 (monthly)
  const vatExpected = 4; // minimum expected per rolling year
  const vatCompliance = completedVat.length >= vatExpected
    ? 0
    : _clamp(((vatExpected - completedVat.length) / vatExpected) * 100, 0, 100);

  // ── 4. NRS stamp rate (0–100) ─────────────────────────────────────────────
  const totalInvoices = input.invoices.length;
  const unstamped = input.invoices.filter((inv) => inv.status === 'UNSTAMPED').length;
  const nrsStampRate = totalInvoices > 0
    ? _clamp((unstamped / totalInvoices) * 100, 0, 100)
    : 0;

  // ── 5. NIL overuse (0–100) ────────────────────────────────────────────────
  const nilCount = input.filingHistory
    .filter((f) => f.status === 'NIL')
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 6) // rolling 6 periods
    .length;
  // ≥4 consecutive NIL filings is maximum risk for this sub-score
  const nilOveruse = _clamp((nilCount / 4) * 100, 0, 100);

  // ── Composite score ───────────────────────────────────────────────────────
  const score = _clamp(
    Math.round(
      filingLatency  * WEIGHTS.filingLatency +
      paymentGap     * WEIGHTS.paymentGap +
      vatCompliance  * WEIGHTS.vatCompliance +
      nrsStampRate   * WEIGHTS.nrsStampRate +
      nilOveruse     * WEIGHTS.nilOveruse,
    ),
    0,
    100,
  );

  return {
    score,
    band:       _band(score),
    subScores: {
      filingLatency:  Math.round(filingLatency),
      paymentGap:     Math.round(paymentGap),
      vatCompliance:  Math.round(vatCompliance),
      nrsStampRate:   Math.round(nrsStampRate),
      nilOveruse:     Math.round(nilOveruse),
    },
    computedAt: new Date().toISOString(),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function _band(score: number): RiskBand {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function _neutral(): RiskScoreResult {
  return {
    score:     50,
    band:      'medium',
    subScores: { filingLatency: 50, paymentGap: 50, vatCompliance: 50, nrsStampRate: 50, nilOveruse: 50 },
    computedAt: new Date().toISOString(),
  };
}
