// PIT Tax Calculator Service - Nigeria Tax Act 2025
// Implements full progressive tax bands with reliefs and deductions
// Now using canonical rules from @taxbridge/contracts

import {
  PIT_BRACKETS,
  RENT_RELIEF_CAP,
  RENT_RELIEF_RATE,
  PENSION_RATE,
  NHF_RATE,
  MINIMUM_WAGE_ANNUAL,
  CIT_TIERS,
  VAT_REGISTRATION_THRESHOLD,
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

  const rentBasedRelief = calculateRentRelief(annualRent);

  const totalDeductions =
    rentBasedRelief +
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
    rentRelief: rentBasedRelief,
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
    disclaimer: 'Educational estimate only. Consult NRS for official verification.',
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
  const threshold = VAT_REGISTRATION_THRESHOLD;
  const approachingThreshold = threshold * 0.8; // 80%

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
    disclaimer: 'Monitor actuals. Consult NRS for official guidance.',
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
  // Use canonical CIT_TIERS from @taxbridge/contracts
  const [small, medium, large] = CIT_TIERS;
  let rate: number;
  let category: CITCheckResult['category'];
  let message: string;

  if (turnover <= small.maxRevenue) {
    rate = small.rate;
    category = 'small';
    message = `Small company relief: ${small.rate * 100}% CIT (≤₦${(small.maxRevenue / 1_000_000).toFixed(0)}M)`;
  } else if (turnover <= medium.maxRevenue) {
    rate = medium.rate;
    category = 'medium';
    message = `Medium company rate: ${medium.rate * 100}% CIT (≤₦${(medium.maxRevenue / 1_000_000).toFixed(0)}M)`;
  } else {
    rate = large.rate;
    category = 'large';
    message = `Standard rate: ${large.rate * 100}% CIT on profits (>₦${(medium.maxRevenue / 1_000_000).toFixed(0)}M)`;
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
