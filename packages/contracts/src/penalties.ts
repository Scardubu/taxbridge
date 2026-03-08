/**
 * Penalty Engine — TaxBridge V13 Sovereign
 * NTA 2025 §§153–180
 *
 * C-09: Tax calculations only in packages/contracts/
 * C-27: CBN_MPR NEVER hardcoded — always parseFloat(process.env.CBN_MPR ?? '0.2725')
 *
 * Penalty schedule:
 *   Individual: first month ₦50k, subsequent ₦25k/month
 *   Company:    first month ₦250k, subsequent ₦125k/month
 *   VAT (Co):   ₦50k/month (separate schedule)
 *
 * Disclosure phase waiver:
 *   before_audit:    100% waiver
 *   during_audit:     50% waiver
 *   after_assessment:  0% waiver
 *
 * Interest = taxAmountDue × (CBN_MPR + 10%) × (daysLate / 365)
 */

import {
  PENALTY_IND_FIRST_MONTH,
  PENALTY_IND_SUBSEQUENT,
  PENALTY_CO_FIRST_MONTH,
  PENALTY_CO_SUBSEQUENT,
  PENALTY_VAT_CO_MONTH,
} from './constants';

export type EntityType        = 'individual' | 'company';
export type DisclosurePhase   = 'before_audit' | 'during_audit' | 'after_assessment';
export type TaxTypeForPenalty = 'VAT' | 'PIT' | 'CIT' | 'WHT' | 'PAYE';

export interface PenaltyInput {
  entityType:      EntityType;
  daysLate:        number;
  taxAmountDue:    number;
  disclosurePhase: DisclosurePhase;
  taxType?:        TaxTypeForPenalty;
}

export interface PenaltyResult {
  monthsLate:     number;
  lateFiling:     number;
  interest:       number;
  grossPenalty:   number;
  waiverRate:     number;
  waiverAmount:   number;
  netPenalty:     number;
  cbnMpr:         number;
}

const WAIVER_RATES: Record<DisclosurePhase, number> = {
  before_audit:      1.00,  // 100% waiver
  during_audit:      0.50,  //  50% waiver
  after_assessment:  0.00,  //   0% waiver
};

/**
 * calculatePenalty — NTA 2025 §§153–180
 *
 * Accuracy gate:
 *   calculatePenalty({ entityType:'company', daysLate:32, taxAmountDue:0, disclosurePhase:'after_assessment' })
 *   → { netPenalty: 375_000 }
 *   monthsLate=2; lateFiling=250k+(1×125k)=375k; interest=0; waiver=0% → 375,000
 */
export function calculatePenalty(input: PenaltyInput): PenaltyResult {
  const { entityType, daysLate, taxAmountDue, disclosurePhase, taxType } = input;

  // CBN_MPR: NEVER hardcoded — always from env
  const cbnMpr = parseFloat(process.env.CBN_MPR ?? '0.2725');

  const monthsLate = Math.ceil(daysLate / 30);

  // Late filing penalty
  let lateFiling: number;
  if (taxType === 'VAT' && entityType === 'company') {
    lateFiling = PENALTY_VAT_CO_MONTH * monthsLate;
  } else if (entityType === 'company') {
    const additional  = Math.max(0, monthsLate - 1);
    lateFiling        = PENALTY_CO_FIRST_MONTH + additional * PENALTY_CO_SUBSEQUENT;
  } else {
    const additional  = Math.max(0, monthsLate - 1);
    lateFiling        = PENALTY_IND_FIRST_MONTH + additional * PENALTY_IND_SUBSEQUENT;
  }

  // Interest: taxAmountDue × (CBN_MPR + 10%) × (daysLate / 365)
  const interestRate = cbnMpr + 0.10;
  const interest     = Math.round(taxAmountDue * interestRate * (daysLate / 365));

  const grossPenalty  = lateFiling + interest;
  const waiverRate    = WAIVER_RATES[disclosurePhase];
  const waiverAmount  = Math.round(grossPenalty * waiverRate);
  const netPenalty    = grossPenalty - waiverAmount;

  return {
    monthsLate,
    lateFiling,
    interest,
    grossPenalty,
    waiverRate,
    waiverAmount,
    netPenalty,
    cbnMpr,
  };
}
