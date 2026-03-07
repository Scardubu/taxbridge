/**
 * Company Income Tax — TaxBridge V13 Sovereign
 * NTA 2025 §55
 *
 * C-09: Tax calculations only in packages/contracts/
 * C-41: calculateCIT() is the ONLY approved CIT computation path — no inline math.
 *
 * Two tiers only (V13 canonical):
 *   turnover < ₦100M  → 0% CIT  (small)
 *   turnover ≥ ₦100M  → 30% CIT (large)
 */

import {
  SMALL_CO_CIT_THRESHOLD,
  CIT_LARGE_RATE,
  CIT_SMALL_RATE,
} from './constants';

export interface CITInput {
  turnover:              number;
  taxableProfit:         number;
  /** Prior-year tax losses to offset (₦). Optional. */
  taxLossCarryforward?:  number;
  /** Whether Development Levy applies (4% additional). Default: false. */
  devLevyApplies?:       boolean;
}

export interface CITResult {
  citLiability:   number;
  band:           'small' | 'large';
  rate:           number;
  taxableProfit:  number;
  devLevy:        number;
  total:          number;
  exempt:         boolean;
}

/**
 * calculateCIT — V13 canonical CIT computation (C-41)
 *
 * Accuracy gates:
 *   calculateCIT({ turnover: 150_000_000, taxableProfit: 15_000_000 })
 *   → { citLiability: 4_500_000, band: 'large' }
 *
 *   calculateCIT({ turnover: 80_000_000, taxableProfit: 5_000_000 })
 *   → { citLiability: 0, band: 'small' }
 */
export function calculateCIT(input: CITInput): CITResult {
  const {
    turnover,
    taxableProfit,
    taxLossCarryforward = 0,
    devLevyApplies      = false,
  } = input;

  // V13 canonical: only 2 bands — no medium band
  const band:   'small' | 'large' = turnover < SMALL_CO_CIT_THRESHOLD ? 'small' : 'large';
  const exempt: boolean            = band === 'small';
  const rate:   number             = exempt ? CIT_SMALL_RATE : CIT_LARGE_RATE;

  if (exempt) {
    return { citLiability: 0, band: 'small', rate: 0, taxableProfit: 0, devLevy: 0, total: 0, exempt: true };
  }

  const adjustedProfit  = Math.max(0, taxableProfit - Math.max(0, taxLossCarryforward));
  const citLiability    = Math.round(adjustedProfit * rate);
  const devLevy         = devLevyApplies ? Math.round(adjustedProfit * 0.04) : 0;
  const total           = citLiability + devLevy;

  return { citLiability, band: 'large', rate, taxableProfit: adjustedProfit, devLevy, total, exempt: false };
}

/**
 * Legacy compat — callers that previously used calculateCITv2
 */
export { calculateCIT as calculateCITv2 };
