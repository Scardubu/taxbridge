// PIT Tax Calculator Service - Nigeria Tax Act 2025
// Implements full progressive tax bands with reliefs and deductions
// Now using canonical rules from @taxbridge/contracts

import {
  PIT_BRACKETS,
  RENT_RELIEF_CAP,
  RENT_RELIEF_RATE,
  PENSION_RATE,
  NHF_RATE,
  CRA_FIXED,
  CRA_PERCENTAGE,
  MINIMUM_WAGE_ANNUAL,
} from '@taxbridge/contracts';

export interface PITInputs {
  annualGrossIncome: number;
  annualRent: number;
  pensionContributions: number;
  nhfContributions: number;
  nhisContributions: number;
  lifeInsurance: number;
  housingLoanInterest: number;
}

export interface TaxBand {
  limit: number;
  rate: number;
  bandName: string;
}

export interface BandBreakdown {
  band: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface PITResult {
  // Inputs
  grossIncome: number;
  
  // Deductions & Reliefs
  rentRelief: number;
  pensionDeduction: number;
  nhfDeduction: number;
  nhisDeduction: number;
  lifeInsuranceRelief: number;
  housingLoanRelief: number;
  totalDeductions: number;
  
  // Calculation
  chargeableIncome: number;
  estimatedTax: number;
  isExempt: boolean;
  effectiveRate: number;
  
  // Band breakdown
  bandBreakdown: BandBreakdown[];
  
  // Display
  disclaimer: string;
}

// Full Progressive PIT Rate Bands (Fourth Schedule – Section 58)
// Convert canonical PIT_BRACKETS to mobile TaxBand format
export const PIT_BANDS: TaxBand[] = PIT_BRACKETS.map(bracket => ({
  limit: bracket.limit === Infinity ? Infinity : bracket.limit,
  rate: bracket.rate,
  bandName: bracket.label,
}));

/**
 * Calculate Rent Relief per Section 30(2)
 * Lower of ₦500,000 or 20% of annual rent paid
 */
export function calculateRentRelief(annualRent: number): number {
  return Math.min(RENT_RELIEF_CAP, annualRent * RENT_RELIEF_RATE);
}

/**
 * Calculate National Housing Fund (NHF) Deduction
 * 2.5% of gross income
 */
export function calculateNHFDeduction(grossIncome: number): number {
  return grossIncome * NHF_RATE;
}

/**
 * Calculate full PIT with progressive bands
 */
export function calculatePIT(inputs: PITInputs): PITResult {
  const {
    annualGrossIncome,
    annualRent,
    pensionContributions,
    nhfContributions,
    nhisContributions,
    lifeInsurance,
    housingLoanInterest,
  } = inputs;

  // Calculate deductions and reliefs
  const rentRelief = calculateRentRelief(annualRent);
  const nhfDeduction = nhfContributions || calculateNHFDeduction(annualGrossIncome);
  const pensionDeduction = pensionContributions || 0;
  const nhisDeduction = nhisContributions || 0;
  const lifeInsuranceRelief = lifeInsurance || 0;
  const housingLoanRelief = housingLoanInterest || 0;

  const totalDeductions =
    rentRelief +
    nhfDeduction +
    pensionDeduction +
    nhisDeduction +
    lifeInsuranceRelief +
    housingLoanRelief;

  // Calculate chargeable income
  const chargeableIncome = Math.max(0, annualGrossIncome - totalDeductions);

  // Apply progressive tax bands
  let remainingIncome = chargeableIncome;
  let totalTax = 0;
  const bandBreakdown: BandBreakdown[] = [];
  let previousLimit = 0;

  for (const band of PIT_BANDS) {
    if (remainingIncome <= 0) break;

    const bandWidth = band.limit - previousLimit;
    const taxableInBand = Math.min(remainingIncome, bandWidth);
    const taxForBand = taxableInBand * band.rate;

    if (taxableInBand > 0) {
      bandBreakdown.push({
        band: band.bandName,
        rate: band.rate,
        taxableAmount: taxableInBand,
        taxAmount: taxForBand,
      });

      totalTax += taxForBand;
      remainingIncome -= taxableInBand;
    }

    previousLimit = band.limit;
  }

  const isExempt = chargeableIncome <= 800_000;
  const effectiveRate = annualGrossIncome > 0 ? (totalTax / annualGrossIncome) * 100 : 0;

  return {
    grossIncome: annualGrossIncome,
    rentRelief,
    pensionDeduction,
    nhfDeduction,
    nhisDeduction,
    lifeInsuranceRelief,
    housingLoanRelief,
    totalDeductions,
    chargeableIncome,
    estimatedTax: totalTax,
    isExempt,
    effectiveRate,
    bandBreakdown,
    disclaimer: 'Educational estimate only. Consult FIRS for official verification.',
  };
}

/**
 * VAT Threshold Check per Section 80
 */
export interface VATCheckResult {
  turnover: number;
  threshold: number;
  status: 'exempt' | 'approaching' | 'mandatory';
  message: string;
  disclaimer: string;
}

export function checkVATThreshold(turnover: number): VATCheckResult {
  const threshold = 100_000_000; // ₦100M
  const approachingThreshold = threshold * 0.8; // 80% = ₦80M

  let status: VATCheckResult['status'];
  let message: string;

  if (turnover < approachingThreshold) {
    status = 'exempt';
    message = 'You are exempt from VAT registration';
  } else if (turnover < threshold) {
    status = 'approaching';
    const remaining = threshold - turnover;
    message = `Approaching threshold (₦${remaining.toLocaleString()} remaining)`;
  } else {
    status = 'mandatory';
    message = 'VAT registration mandatory per Section 80';
  }

  return {
    turnover,
    threshold,
    status,
    message,
    disclaimer: 'Monitor actuals. Consult FIRS for official guidance.',
  };
}

/**
 * CIT Rate Determination per Section 90
 */
export interface CITCheckResult {
  turnover: number;
  rate: number;
  category: 'small' | 'medium' | 'large';
  message: string;
  disclaimer: string;
}

export function determineCITRate(turnover: number): CITCheckResult {
  let rate: number;
  let category: CITCheckResult['category'];
  let message: string;

  if (turnover <= 25_000_000) {
    rate = 0;
    category = 'small';
    message = 'Small company relief: 0% CIT (≤₦25M)';
  } else if (turnover <= 100_000_000) {
    rate = 0.2;
    category = 'medium';
    message = 'Medium company rate: 20% CIT (≤₦100M)';
  } else {
    rate = 0.3;
    category = 'large';
    message = 'Standard rate: 30% CIT on profits (>₦100M)';
  }

  return {
    turnover,
    rate,
    category,
    message,
    disclaimer: 'CIT applies to incorporated entities only. TaxBridge V1 focuses on PIT for sole proprietors.',
  };
}

/**
 * Format currency for Nigerian Naira
 */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Validate inputs
 */
export function validatePITInputs(inputs: Partial<PITInputs>): string[] {
  const errors: string[] = [];

  if (!inputs.annualGrossIncome || inputs.annualGrossIncome < 0) {
    errors.push('Annual gross income must be a positive number');
  }

  if (inputs.annualGrossIncome && inputs.annualGrossIncome > 100_000_000) {
    errors.push('Please enter realistic income (max ₦100M for sanity check)');
  }

  if (inputs.annualRent && inputs.annualRent < 0) {
    errors.push('Annual rent cannot be negative');
  }

  return errors;
}
