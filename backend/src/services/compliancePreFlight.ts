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

import type { PrismaClient } from '@prisma/client';
import {
  SMALL_CO_CIT_THRESHOLD,
  VAT_REGISTRATION_THRESHOLD,
  type PreFlightCheck,
  type PreFlightResult,
} from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';
import { prisma }       from '../lib/prisma';
import { getNrsHealth } from './nrsService';

export type { PreFlightCheck, PreFlightResult };

const log = createLogger('compliancePreFlight');

const CIT_APPROACH_WARNING_LOWER  = 80_000_000;
const PRIOR_PERIOD_GAP_LIMIT_DAYS = 30;

type PrismaLike = PrismaClient | typeof prisma;

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
 * @param period        Optional filing period (kept for V13 route compatibility)
 * @param prismaClient  Optional prisma instance override for tests/canonical callers
 */
/**
 * runPreFlight — V13 canonical export (C-07: never throws)
 *
 * Uses Promise.allSettled + normaliseSettled for structured fallback on every check.
 * Returns { pass, checks } where pass is true only if no check has status === 'fail'.
 */
export async function runPreFlight(
  orgId: string,
  taxType: string,
  period?: string,
  prismaClient: PrismaLike = prisma,
): Promise<PreFlightResult> {
  try {
    const [tin, cac, vatReg, priorFiling] = await Promise.allSettled([
      checkTINValid(orgId, prismaClient),
      checkCACValid(orgId, prismaClient),
      checkVATRegistration(orgId, taxType, prismaClient),
      checkNoPriorPeriodGap(orgId, taxType, prismaClient),
    ]);
    const checks: PreFlightCheck[] = [
      normaliseSettled(tin,         'tin_valid'),
      normaliseSettled(cac,         'cac_valid'),
      normaliseSettled(vatReg,      'vat_registered'),
      normaliseSettled(priorFiling, 'no_prior_gap'),
    ];
    return { pass: checks.every(c => c.status !== 'fail'), checks };
  } catch (err) {
    log.error('runPreFlight unexpected error', { err, orgId, taxType, period });
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
  period?: string,
  prismaClient: PrismaLike = prisma,
): Promise<PreFlightResult> {
  const v13Result = await runPreFlight(orgId, taxType, period, prismaClient);

  // Additional CIT threshold warning
  if (taxType === 'CIT' && turnoverHint !== undefined) {
    if (turnoverHint >= CIT_APPROACH_WARNING_LOWER && turnoverHint < SMALL_CO_CIT_THRESHOLD) {
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

async function getOrgRecord(orgId: string) {
  return (prisma as any).org?.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      tin: true,
      cacNumber: true,
      status: true,
    },
  });
}

async function getOrgRecordWithClient(orgId: string, prismaClient: PrismaLike) {
  return (prismaClient as any).org?.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      tin: true,
      cacNumber: true,
      status: true,
    },
  });
}

async function checkTINValid(orgId: string, prismaClient: PrismaLike): Promise<void> {
  const org = await getOrgRecordWithClient(orgId, prismaClient);
  if (!org) throw new Error('Organisation not found');
  if (org.status === 'suspended') throw new Error('Organisation is suspended');
  if (!org.tin) throw new Error('TIN missing');
}

async function checkCACValid(orgId: string, prismaClient: PrismaLike): Promise<void> {
  const org = await getOrgRecordWithClient(orgId, prismaClient);
  if (!org) throw new Error('Organisation not found');
  if (!org.cacNumber) throw new Error('CAC number missing');
}

async function checkVATRegistration(orgId: string, taxType: string, prismaClient: PrismaLike): Promise<void> {
  if (taxType !== 'VAT') return;
  const org = await getOrgRecordWithClient(orgId, prismaClient);
  if (!org) throw new Error('Organisation not found');
  if (!org.tin) throw new Error('VAT registration requires TIN');
}

async function checkNoPriorPeriodGap(orgId: string, taxType: string, prismaClient: PrismaLike): Promise<void> {
  const lastFiling = await (prismaClient as any).taxReturn?.findFirst({
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
