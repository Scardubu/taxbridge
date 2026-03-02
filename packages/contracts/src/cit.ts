/**
 * TaxBridge — V12 CIT Calculator
 *
 * Enhanced Company Income Tax calculation with:
 * - Development Levy (NTA 2025 §60A)
 * - Education Tax (2% on assessable profits for large companies)
 * - Tax Loss Carry-Forward deduction
 *
 * C-41: Education tax included in CIT computation.
 * C-09: Tax calculations only in packages/contracts.
 */

import { NTA_2025, type CompanyTier } from './nta2025';
import type { CITInput, CITResult } from './types';

/**
 * Education Tax rate — 2% on assessable profits.
 * Applies to companies with turnover ≥ ₦100M (large tier).
 * NTA 2025 §55(3).
 */
const EDUCATION_TAX_RATE = 0.02;
const EDUCATION_TAX_THRESHOLD = 100_000_000;

/**
 * Calculate Company Income Tax with full V12 compliance.
 *
 * @param input.turnover           Annual turnover (₦)
 * @param input.profit             Taxable profit before deductions (₦)
 * @param input.devLevyApplies     Whether development levy applies
 * @param input.taxLossCarryforward Prior-year tax losses to offset (₦)
 * @returns Complete CIT breakdown
 */
export function calculateCITv2(input: CITInput): CITResult {
  const { turnover, profit, devLevyApplies, taxLossCarryforward } = input;

  // Determine company tier
  const tier: CompanyTier = turnover < NTA_2025.CIT.small.threshold
    ? 'small'
    : turnover < NTA_2025.CIT.medium.threshold
      ? 'medium'
      : 'large';

  const citRate = NTA_2025.CIT[tier].rate;
  const exempt = tier === 'small';

  if (exempt) {
    return {
      tier,
      citRate: 0,
      citAmount: 0,
      devLevy: 0,
      educationTax: 0,
      taxLossApplied: 0,
      total: 0,
      exempt: true,
    };
  }

  // Apply tax loss carry-forward
  const lossDeduction = Math.min(
    Math.max(taxLossCarryforward, 0),
    Math.max(profit, 0),
  );
  const adjustedProfit = Math.max(profit - lossDeduction, 0);

  // CIT on adjusted profit
  const citAmount = Math.round(adjustedProfit * citRate);

  // Development Levy — 4% on qualifying profits
  const devLevy = devLevyApplies
    ? Math.round(adjustedProfit * NTA_2025.DEV_LEVY.rate)
    : 0;

  // Education Tax — 2% for large companies only
  const educationTax = turnover >= EDUCATION_TAX_THRESHOLD
    ? Math.round(adjustedProfit * EDUCATION_TAX_RATE)
    : 0;

  const total = citAmount + devLevy + educationTax;

  return {
    tier,
    citRate,
    citAmount,
    devLevy,
    educationTax,
    taxLossApplied: lossDeduction,
    total,
    exempt: false,
  };
}
