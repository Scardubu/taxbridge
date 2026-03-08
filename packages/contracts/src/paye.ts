/**
 * Pay As You Earn (PAYE) — TaxBridge V13 Sovereign
 * NTA 2025 §80–95
 *
 * C-09: Tax calculations only in packages/contracts/
 * PAYE applies PIT brackets to employment income after statutory deductions.
 */

import { PIT_BANDS } from './constants';

/** Employee pension contribution rate (8% of gross) */
export const PAYE_PENSION_RATE = 0.08;

/** NHF contribution rate (2.5% of gross) */
export const PAYE_NHF_RATE = 0.025;

export interface PAYEInput {
  /** Monthly gross salary */
  grossSalary: number;
  /** Legacy nested allowances shape retained for backward compatibility */
  allowances?: {
    housing?: number;
    transport?: number;
    meal?: number;
    others?: number;
  };
  /** Monthly housing allowance */
  housingAllowance?: number;
  /** Monthly transport allowance */
  transportAllowance?: number;
  /** Monthly meal allowance */
  mealAllowance?: number;
  /** Monthly other allowances */
  otherAllowances?: number;
  /** Custom pension rate (default: 8%) */
  pensionRate?: number;
  /** Custom NHF rate (default: 2.5%) */
  nhfRate?: number;
}

export interface PAYEResult {
  grossSalary: number;
  totalAllowances: number;
  grossIncome: number;
  pensionContribution: number;
  nhfContribution: number;
  totalDeductions: number;
  taxableIncome: number;
  taxDue: number;
  netPay: number;
  effectiveRate: number;
  annualizedTax: number;
  breakdown: Array<{
    band?: number;
    rate?: number;
    amount: number;
    tax?: number;
    description: string;
  }>;
}

/**
 * calculatePAYE — Full PAYE computation per NTA 2025 §80–95
 *
 * Accuracy gate:
 *   calculatePAYE({ grossSalary: 500_000 })
 *   → taxDue ≈ 73_125 (monthly)
 *   (Gross = 500k | Pension = 40k | NHF = 12.5k | Taxable = 447.5k | Annualized = 5.37M)
 */
export function calculatePAYE(input: PAYEInput): PAYEResult {
  const {
    grossSalary,
    allowances,
    housingAllowance = 0,
    transportAllowance = 0,
    mealAllowance = 0,
    otherAllowances = 0,
    pensionRate = PAYE_PENSION_RATE,
    nhfRate = PAYE_NHF_RATE,
  } = input;

  const resolvedHousingAllowance = housingAllowance || allowances?.housing || 0;
  const resolvedTransportAllowance = transportAllowance || allowances?.transport || 0;
  const resolvedMealAllowance = mealAllowance || allowances?.meal || 0;
  const resolvedOtherAllowances = otherAllowances || allowances?.others || 0;

  const totalAllowances =
    resolvedHousingAllowance +
    resolvedTransportAllowance +
    resolvedMealAllowance +
    resolvedOtherAllowances;
  const grossIncome = grossSalary + totalAllowances;

  // Statutory deductions
  const pensionContribution = Math.round(grossIncome * pensionRate);
  const nhfContribution = Math.round(grossIncome * nhfRate);
  const totalDeductions = pensionContribution + nhfContribution;

  // Taxable income (monthly)
  const taxableIncome = Math.max(0, grossIncome - totalDeductions);

  // Annualize for bracket calculation
  const annualTaxable = taxableIncome * 12;

  // Apply PIT bands to annualized income
  // PIT_BANDS uses `limit` as the WIDTH of each band (not cumulative ceiling)
  let remaining = annualTaxable;
  let annualTax = 0;
  const breakdown: Array<{
    band?: number;
    rate?: number;
    amount: number;
    tax?: number;
    description: string;
  }> = [
    { description: 'Gross Salary', amount: grossSalary },
  ];

  if (resolvedHousingAllowance > 0) {
    breakdown.push({ description: 'Housing Allowance', amount: resolvedHousingAllowance });
  }
  if (resolvedTransportAllowance > 0) {
    breakdown.push({ description: 'Transport Allowance', amount: resolvedTransportAllowance });
  }
  if (resolvedMealAllowance > 0) {
    breakdown.push({ description: 'Meal Allowance', amount: resolvedMealAllowance });
  }
  if (resolvedOtherAllowances > 0) {
    breakdown.push({ description: 'Other Allowances', amount: resolvedOtherAllowances });
  }

  breakdown.push({ description: 'Gross Income', amount: grossIncome });

  for (let i = 0; i < PIT_BANDS.length; i++) {
    if (remaining <= 0) break;

    const band = PIT_BANDS[i];
    const bandWidth = band.limit;
    const taxableInBand = Math.min(remaining, bandWidth);
    const taxInBand = Math.round(taxableInBand * band.rate);

    if (taxableInBand > 0) {
      breakdown.push({
        band: i + 1,
        rate: band.rate,
        amount: taxableInBand,
        tax: taxInBand,
        description: `Tax Band ${i + 1}`,
      });
    }

    annualTax += taxInBand;
    remaining -= taxableInBand;
  }

  // Monthly tax
  const taxDue = Math.round(annualTax / 12);
  const netPay = grossIncome - totalDeductions - taxDue;
  const effectiveRate = grossIncome > 0 ? taxDue / grossIncome : 0;

  breakdown.push({ description: 'Pension Contribution', amount: -pensionContribution });
  breakdown.push({ description: 'NHF Contribution', amount: -nhfContribution });
  breakdown.push({ description: 'PAYE Tax', amount: -taxDue });
  breakdown.push({ description: 'Net Pay', amount: netPay });

  return {
    grossSalary,
    totalAllowances,
    grossIncome,
    pensionContribution,
    nhfContribution,
    totalDeductions,
    taxableIncome,
    taxDue,
    netPay,
    effectiveRate,
    annualizedTax: annualTax,
    breakdown,
  };
}
