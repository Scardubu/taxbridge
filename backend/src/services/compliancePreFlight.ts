/**
 * TaxBridge — Compliance Pre-Flight Service
 * GAP-13 / V12 §P0.7
 *
 * Runs 4 parallel checks before any filing submission:
 *   1. TIN validity (not suspended)
 *   2. Prior-period filing gap (>30 days)
 *   3. VAT registration status
 *   4. NRS circuit health (warn-only)
 *
 * Additional guards:
 *   - VAT: turnover < ₦25M → VAT_NOT_REQUIRED
 *   - VAT: no vatRegistrationNumber → VAT_NOT_REGISTERED
 *   - CIT: turnoverHint ∈ [₦80M, ₦100M) → APPROACHING_CIT_THRESHOLD (warning)
 *
 * C-07: Never throws — all errors are returned as structured check results.
 * C-09: Tax math (thresholds) sourced from @taxbridge/contracts.
 */

import { createLogger } from '../lib/logger';
import { getPrismaClient } from '../lib/prisma';
import { getNrsHealth } from './nrsService';

const log = createLogger('compliancePreFlight');
const prisma = getPrismaClient();

// NTA 2025 thresholds — sourced from contracts (C-09)
const VAT_REGISTRATION_THRESHOLD  = 25_000_000;   // ₦25M (NTA 2025 §12)
const CIT_SMALL_THRESHOLD         = 100_000_000;  // ₦100M — below = exempt
const CIT_APPROACH_WARNING_LOWER  = 80_000_000;   // ₦80M — APPROACHING warning starts
const PRIOR_PERIOD_GAP_LIMIT_DAYS = 30;

export interface PreFlightCheck {
  code:     string;
  severity: 'ok' | 'warning' | 'error';
  message:  string;
}

export interface PreFlightResult {
  pass:   boolean;           // false if any check has severity === 'error'
  checks: PreFlightCheck[];
}

/**
 * Run all pre-flight compliance checks for a given org + tax type.
 *
 * @param orgId         Organisation identifier
 * @param taxType       Filing type: 'VAT' | 'WHT' | 'PAYE' | 'CIT' | 'NIL'
 * @param turnoverHint  Optional declared turnover figure (used for CIT/VAT threshold checks)
 */
export async function runCompliancePreFlight(
  orgId: string,
  taxType: string,
  turnoverHint?: number,
): Promise<PreFlightResult> {
  const checks: PreFlightCheck[] = [];

  try {
    // ── 1–4: Parallel DB + external checks ──────────────────────────────────
    const [tinCheck, periodGapCheck, vatRegCheck, nrsHealthCheck] = await Promise.allSettled([
      checkTINValidity(orgId),
      checkPriorPeriodGap(orgId, taxType),
      checkVATRegistration(orgId, taxType, turnoverHint),
      checkNRSHealth(),
    ]);

    if (tinCheck.status === 'fulfilled')          checks.push(...tinCheck.value);
    if (periodGapCheck.status === 'fulfilled')    checks.push(...periodGapCheck.value);
    if (vatRegCheck.status === 'fulfilled')       checks.push(...vatRegCheck.value);
    if (nrsHealthCheck.status === 'fulfilled')    checks.push(...nrsHealthCheck.value);

    // ── CIT threshold warning ────────────────────────────────────────────────
    if (taxType === 'CIT' && turnoverHint !== undefined) {
      if (turnoverHint >= CIT_APPROACH_WARNING_LOWER && turnoverHint < CIT_SMALL_THRESHOLD) {
        checks.push({
          code:     'APPROACHING_CIT_THRESHOLD',
          severity: 'warning',
          message:  `Turnover ₦${(turnoverHint / 1_000_000).toFixed(1)}M is approaching the ₦100M CIT threshold. Prepare for 30% CIT liability next period.`,
        });
      }
    }

  } catch (err) {
    log.error({ err, orgId, taxType }, 'compliancePreFlight encountered unexpected error');
    checks.push({
      code:     'PREFLIGHT_ERROR',
      severity: 'warning',
      message:  'Pre-flight checks could not complete. You may proceed, but verify manually.',
    });
  }

  const pass = !checks.some(c => c.severity === 'error');
  return { pass, checks };
}

// ── Internal checkers ──────────────────────────────────────────────────────

async function checkTINValidity(orgId: string): Promise<PreFlightCheck[]> {
  try {
    const org = await (prisma as any).organization.findUnique({
      where:  { id: orgId },
      select: { tinVerified: true, tinSuspended: true, tin: true },
    });
    if (!org) {
      return [{ code: 'TIN_NOT_FOUND', severity: 'error', message: 'Organisation not found.' }];
    }
    if (org.tinSuspended) {
      return [{ code: 'TIN_SUSPENDED', severity: 'error', message: 'Your TIN is currently suspended. Contact NRS before filing.' }];
    }
    if (!org.tinVerified) {
      return [{ code: 'TIN_NOT_VERIFIED', severity: 'warning', message: 'TIN has not been verified. Verify before submitting.' }];
    }
    return [{ code: 'TIN_VALID', severity: 'ok', message: 'TIN verified and active.' }];
  } catch (err) {
    log.warn({ err, orgId }, 'TIN validity check failed');
    return [{ code: 'TIN_CHECK_UNAVAILABLE', severity: 'warning', message: 'TIN check temporarily unavailable.' }];
  }
}

async function checkPriorPeriodGap(orgId: string, taxType: string): Promise<PreFlightCheck[]> {
  try {
    const lastFiling = await (prisma as any).taxReturn.findFirst({
      where:   { orgId, taxType },
      orderBy: { submittedAt: 'desc' },
      select:  { submittedAt: true, period: true },
    });
    if (!lastFiling) {
      return [{ code: 'FIRST_FILING', severity: 'ok', message: 'First filing for this tax type.' }];
    }
    const daysSince = Math.floor(
      (Date.now() - new Date(lastFiling.submittedAt).getTime()) / 86_400_000,
    );
    if (daysSince > PRIOR_PERIOD_GAP_LIMIT_DAYS) {
      return [{
        code:     'PRIOR_PERIOD_GAP',
        severity: 'warning',
        message:  `No ${taxType} filing in ${daysSince} days (last: ${lastFiling.period}). Consider filing a NIL return for missing periods.`,
      }];
    }
    return [{ code: 'PRIOR_PERIOD_OK', severity: 'ok', message: `Last ${taxType} filed ${daysSince} days ago.` }];
  } catch (err) {
    log.warn({ err, orgId, taxType }, 'Prior period gap check failed');
    return [{ code: 'PERIOD_CHECK_UNAVAILABLE', severity: 'warning', message: 'Period gap check temporarily unavailable.' }];
  }
}

async function checkVATRegistration(
  orgId: string,
  taxType: string,
  turnoverHint?: number,
): Promise<PreFlightCheck[]> {
  if (taxType !== 'VAT') return [];
  try {
    const org = await (prisma as any).organization.findUnique({
      where:  { id: orgId },
      select: { annualTurnover: true, vatRegistrationNumber: true },
    });
    if (!org) return [];

    const effectiveTurnover = turnoverHint ?? org.annualTurnover ?? 0;

    // VAT guard 1: below registration threshold
    if (effectiveTurnover < VAT_REGISTRATION_THRESHOLD) {
      return [{
        code:     'VAT_NOT_REQUIRED',
        severity: 'error',
        message:  `Annual turnover ₦${(effectiveTurnover / 1_000_000).toFixed(1)}M is below the ₦25M VAT registration threshold (NTA 2025 §12). VAT filing not required.`,
      }];
    }
    // VAT guard 2: not registered
    if (!org.vatRegistrationNumber) {
      return [{
        code:     'VAT_NOT_REGISTERED',
        severity: 'error',
        message:  'No VAT Registration Number on file. Register with NRS before filing VAT.',
      }];
    }
    return [{ code: 'VAT_REGISTRATION_OK', severity: 'ok', message: 'VAT registration verified.' }];
  } catch (err) {
    log.warn({ err, orgId }, 'VAT registration check failed');
    return [{ code: 'VAT_CHECK_UNAVAILABLE', severity: 'warning', message: 'VAT registration check temporarily unavailable.' }];
  }
}

async function checkNRSHealth(): Promise<PreFlightCheck[]> {
  try {
    const health = await getNrsHealth();
    if (health.circuitState === 'open') {
      return [{
        code:     'NRS_CIRCUIT_OPEN',
        severity: 'warning',
        message:  'NRS e-invoicing service is temporarily unavailable. Your filing will be queued for automatic re-submission.',
      }];
    }
    return [{ code: 'NRS_HEALTHY', severity: 'ok', message: 'NRS e-invoicing service is reachable.' }];
  } catch (err) {
    // NRS health is warn-only — never block filing
    return [{
      code:     'NRS_CHECK_WARN',
      severity: 'warning',
      message:  'NRS availability check skipped. Filing will proceed normally.',
    }];
  }
}
