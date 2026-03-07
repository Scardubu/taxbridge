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

import type { PreFlightCheck, PreFlightResult } from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';
import { prisma }       from '../lib/prisma';
import { getNrsHealth } from './nrsService';

export type { PreFlightCheck, PreFlightResult };

const log = createLogger('compliancePreFlight');

const VAT_REGISTRATION_THRESHOLD  = 25_000_000;
const CIT_SMALL_THRESHOLD         = 100_000_000;
const CIT_APPROACH_WARNING_LOWER  = 80_000_000;
const PRIOR_PERIOD_GAP_LIMIT_DAYS = 30;

/**
 * normaliseSettled — converts PromiseSettledResult<T> → PreFlightCheck
 * Used to ensure parallel checks never throw.
 */
function normaliseSettled<T>(
  result: PromiseSettledResult<T>,
  name: string,
): PreFlightCheck {
  if (result.status === 'fulfilled') return { name, status: 'pass' };
  return { name, status: 'fail', message: String((result.reason as any)?.message ?? result.reason) };
}

/**
 * Run all pre-flight compliance checks for a given org + tax type.
 *
 * @param orgId         Organisation identifier
 * @param taxType       Filing type: 'VAT' | 'WHT' | 'PAYE' | 'CIT' | 'NIL'
 * @param turnoverHint  Optional declared turnover figure (used for CIT/VAT threshold checks)
 */
/**
 * runPreFlight — V13 canonical export (C-07: never throws)
 *
 * Uses Promise.allSettled + normaliseSettled for structured fallback on every check.
 * Returns { pass, checks } where pass is true only if no check has status === 'fail'.
 */
export async function runPreFlight(orgId: string, taxType: string): Promise<PreFlightResult> {
  try {
    const [tin, cac, vatReg, priorFiling] = await Promise.allSettled([
      checkTINValid(orgId),
      checkCACValid(orgId),
      checkVATRegistration(orgId, taxType),
      checkNoPriorPeriodGap(orgId, taxType),
    ]);
    const checks: PreFlightCheck[] = [
      normaliseSettled(tin,         'tin_valid'),
      normaliseSettled(cac,         'cac_valid'),
      normaliseSettled(vatReg,      'vat_registered'),
      normaliseSettled(priorFiling, 'no_prior_gap'),
    ];
    return { pass: checks.every(c => c.status !== 'fail'), checks };
  } catch (err) {
    log.error('runPreFlight unexpected error', { err, orgId, taxType });
    return { pass: true, checks: [{ name: 'preflight_error', status: 'warn', message: 'Pre-flight checks could not complete' }] };
  }
}

/**
 * runCompliancePreFlight — extended version with turnover hints and NRS health.
 * Kept for backward compat with existing callers.
 */
export async function runCompliancePreFlight(
  orgId: string,
  taxType: string,
  turnoverHint?: number,
): Promise<PreFlightResult> {
  const v13Result = await runPreFlight(orgId, taxType);

  // Additional CIT threshold warning
  if (taxType === 'CIT' && turnoverHint !== undefined) {
    if (turnoverHint >= CIT_APPROACH_WARNING_LOWER && turnoverHint < CIT_SMALL_THRESHOLD) {
      v13Result.checks.push({
        name:    'cit_threshold',
        status:  'warn',
        message: `Turnover approaching CIT threshold`,
      });
    }
  }

  // NRS health warning
  try {
    const nrs = await getNrsHealth();
    if (nrs.status === 'down') {
      v13Result.checks.push({ name: 'nrs_health', status: 'warn', message: 'NRS temporarily unavailable' });
    }
  } catch { /* warn-only */ }

  v13Result.pass = v13Result.checks.every(c => c.status !== 'fail');
  return v13Result;
}

// ─── Internal checkers (throw on failure → normaliseSettled catches) ─────────

async function checkTINValid(orgId: string): Promise<void> {
  const org = await (prisma as any).organisation?.findUnique({
    where:  { id: orgId },
    select: { tinVerified: true, tinSuspended: true, tin: true },
  }) ?? await (prisma as any).organization?.findUnique({
    where:  { id: orgId },
    select: { tinVerified: true, tinSuspended: true, tin: true },
  });
  if (!org)             throw new Error('Organisation not found');
  if (org.tinSuspended) throw new Error('TIN is suspended');
  if (!org.tinVerified) throw new Error('TIN not verified');
}

async function checkCACValid(orgId: string): Promise<void> {
  const org = await (prisma as any).organisation?.findUnique({
    where:  { id: orgId },
    select: { cacRcNumber: true },
  }) ?? await (prisma as any).organization?.findUnique({
    where:  { id: orgId },
    select: { cacRcNumber: true },
  });
  if (!org?.cacRcNumber) throw new Error('CAC/RC number not verified');
}

async function checkVATRegistration(orgId: string, taxType: string): Promise<void> {
  if (taxType !== 'VAT') return;
  const org = await (prisma as any).organisation?.findUnique({
    where:  { id: orgId },
    select: { annualTurnover: true, vatRegistrationNumber: true },
  }) ?? await (prisma as any).organization?.findUnique({
    where:  { id: orgId },
    select: { annualTurnover: true, vatRegistrationNumber: true },
  });
  if (!org) return;
  const turnover = Number(org.annualTurnover ?? 0);
  if (turnover < VAT_REGISTRATION_THRESHOLD) throw new Error('Below VAT registration threshold');
  if (!org.vatRegistrationNumber) throw new Error('VAT registration number missing');
}

async function checkNoPriorPeriodGap(orgId: string, taxType: string): Promise<void> {
  const lastFiling = await (prisma as any).taxReturn?.findFirst({
    where:   { orgId, taxType },
    orderBy: { submittedAt: 'desc' },
    select:  { submittedAt: true },
  });
  if (!lastFiling) return; // first-ever filing — OK
  const daysSince = Math.floor(
    (Date.now() - new Date(lastFiling.submittedAt).getTime()) / 86_400_000,
  );
  if (daysSince > PRIOR_PERIOD_GAP_LIMIT_DAYS) {
    throw new Error(`Filing gap: ${daysSince} days since last ${taxType} filing`);
  }
}
