// Tax Calculator Utilities for TaxBridge
// Nigeria Tax Act 2025 - Personal Income Tax Bands

export interface PITBand {
  limit: number;
  rate: number;
}

export const PIT_BANDS: PITBand[] = [
  { limit: 800_000, rate: 0 },           // First ₦800k: 0%
  { limit: 3_000_000, rate: 0.15 },      // Next ₦2.2M: 15%
  { limit: 12_000_000, rate: 0.18 },     // Next ₦9M: 18%
  { limit: 25_000_000, rate: 0.21 },     // Next ₦13M: 21%
  { limit: 50_000_000, rate: 0.23 },     // Next ₦25M: 23%
  { limit: Infinity, rate: 0.25 },       // Above ₦50M: 25%
];

export interface BandBreakdown {
  band: number;
  rate: number;
  amount: number;
  tax: number;
}

export interface PITResult {
  estimatedTax: number;
  breakdown: BandBreakdown[];
  isExempt: boolean;
  effectiveRate: number;
  chargeableIncome: number;
}

/**
 * Calculate Personal Income Tax based on chargeable income
 * @param chargeableIncome Income after all eligible deductions
 * @returns PIT calculation result with band breakdown
 */
export function calculatePIT(chargeableIncome: number): PITResult {
  if (chargeableIncome <= 0) {
    return {
      estimatedTax: 0,
      breakdown: [],
      isExempt: true,
      effectiveRate: 0,
      chargeableIncome: 0,
    };
  }

  let remaining = chargeableIncome;
  let totalTax = 0;
  const breakdown: BandBreakdown[] = [];
  let previousLimit = 0;

  for (const band of PIT_BANDS) {
    if (remaining <= 0) break;

    const bandWidth = band.limit - previousLimit;
    const taxableInBand = Math.min(remaining, bandWidth);
    const taxForBand = taxableInBand * band.rate;

    if (taxableInBand > 0) {
      breakdown.push({
        band: band.limit,
        rate: band.rate,
        amount: taxableInBand,
        tax: taxForBand,
      });

      totalTax += taxForBand;
      remaining -= taxableInBand;
    }

    previousLimit = band.limit;
  }

  const effectiveRate = chargeableIncome > 0 ? totalTax / chargeableIncome : 0;

  return {
    estimatedTax: Math.round(totalTax),
    breakdown,
    isExempt: chargeableIncome <= 800_000,
    effectiveRate,
    chargeableIncome,
  };
}

export interface FullPITInput extends DeductionsInput {}

export interface FullPITResult extends PITResult {
  grossIncome: number;
  deductions: DeductionsResult;
}

export function calculateFullPIT(input: FullPITInput): FullPITResult {
  const deductions = calculateDeductions({
    grossIncome: input.grossIncome,
    annualRent: input.annualRent,
    pensionContribution: input.pensionContribution,
    nhisContribution: input.nhisContribution,
    lifeInsurance: input.lifeInsurance,
  });

  const pit = calculatePIT(deductions.chargeableIncome);

  return {
    ...pit,
    grossIncome: input.grossIncome,
    deductions,
  };
}

/**
 * Calculate Rent Relief (Section 30(2) of Nigeria Tax Act 2025)
 * Lower of ₦500,000 or 20% of annual rent paid
 */
export function calculateRentRelief(annualRent: number): number {
  if (annualRent <= 0) return 0;
  return Math.min(500_000, annualRent * 0.2);
}

/**
 * Calculate National Housing Fund contribution (2.5% of gross income)
 */
export function calculateNHF(grossIncome: number): number {
  return grossIncome * 0.025;
}

/**
 * Check VAT registration threshold
 * Mandatory at ₦100M annual turnover (Section 80)
 */
export interface VATThresholdResult {
  requiresRegistration: boolean;
  status: string;
  threshold: number;
  percentageOfThreshold: number;
  disclaimer: string;
  isAboveThreshold: boolean;
}

export function checkVATThreshold(annualTurnover: number): VATThresholdResult {
  const threshold = 100_000_000;
  const percentage = (annualTurnover / threshold) * 100;

  return {
    requiresRegistration: annualTurnover >= threshold,
    status: annualTurnover >= threshold 
      ? 'Registration mandatory' 
      : annualTurnover >= threshold * 0.8
      ? 'Approaching threshold'
      : 'Exempt from registration',
    threshold,
    percentageOfThreshold: Math.min(percentage, 100),
    disclaimer: annualTurnover >= threshold
      ? 'Consult FIRS for official guidance'
      : 'Educational estimate - monitor actuals',
    isAboveThreshold: annualTurnover >= threshold,
  };
}

/**
 * Determine CIT applicability and rate
 * (Corporate Income Tax - Section 90)
 */
export interface CITRateResult {
  rate: number;
  description: string;
  bracket: 'small' | 'medium' | 'large';
}

export function checkCITRate(annualTurnover: number): CITRateResult {
  if (annualTurnover <= 50_000_000) {
    return {
      rate: 0,
      description: 'Small company relief (₦0-50M turnover)',
      bracket: 'small',
    };
  }
  if (annualTurnover <= 100_000_000) {
    return {
      rate: 0.20,
      description: 'Medium company rate (₦50-100M turnover)',
      bracket: 'medium',
    };
  }
  return {
    rate: 0.30,
    description: 'Standard CIT rate (>₦100M turnover)',
    bracket: 'large',
  };
}

/**
 * Format currency for Nigerian Naira
 */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Calculate total deductions for PIT
 */
export interface DeductionsInput {
  grossIncome: number;
  annualRent?: number;
  pensionContribution?: number;
  nhisContribution?: number;
  lifeInsurance?: number;
}

export interface DeductionsResult {
  rentRelief: number;
  nhf: number;
  pension: number;
  nhis: number;
  lifeInsurance: number;
  totalDeductions: number;
  chargeableIncome: number;
}

export function calculateDeductions(input: DeductionsInput): DeductionsResult {
  const rentRelief = calculateRentRelief(input.annualRent || 0);
  const nhf = calculateNHF(input.grossIncome);
  const pension = input.pensionContribution || 0;
  const nhis = input.nhisContribution || 0;
  const lifeInsurance = input.lifeInsurance || 0;

  const totalDeductions = rentRelief + nhf + pension + nhis + lifeInsurance;
  const chargeableIncome = Math.max(0, input.grossIncome - totalDeductions);

  return {
    rentRelief,
    nhf,
    pension,
    nhis,
    lifeInsurance,
    totalDeductions,
    chargeableIncome,
  };
}
