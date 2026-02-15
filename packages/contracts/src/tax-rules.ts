/**
 * Nigeria Tax Act 2025 (NTA 2025) — Authoritative Tax Rules
 *
 * Single source of truth for all tax brackets, rates, and constants.
 * Used by backend, mobile, and admin-dashboard.
 *
 * PIT brackets follow the updated Fourth Schedule – Section 58:
 *   0% up to ₦800k, then 15%, 18%, 21%, 23%, 25%.
 */

// =============================================================================
// PIT — Personal Income Tax (Fourth Schedule, Section 58)
// =============================================================================

export interface PITBracket {
  /** Cumulative upper limit of this band (₦). Use Infinity for the top band. */
  limit: number;
  /** Marginal tax rate for income within this band */
  rate: number;
  /** Human-readable label */
  label: string;
}

export const PIT_BRACKETS: readonly PITBracket[] = [
  { limit: 800_000,      rate: 0.00, label: 'Tax-Free (₦0 – ₦800,000)' },
  { limit: 3_000_000,    rate: 0.15, label: '15% (₦800,001 – ₦3,000,000)' },
  { limit: 12_000_000,   rate: 0.18, label: '18% (₦3,000,001 – ₦12,000,000)' },
  { limit: 25_000_000,   rate: 0.21, label: '21% (₦12,000,001 – ₦25,000,000)' },
  { limit: 50_000_000,   rate: 0.23, label: '23% (₦25,000,001 – ₦50,000,000)' },
  { limit: Infinity,     rate: 0.25, label: '25% (Above ₦50,000,000)' },
] as const;

/** Minimum wage (monthly) — determines minimum-tax exemption */
export const MINIMUM_WAGE_MONTHLY = 70_000;
export const MINIMUM_WAGE_ANNUAL = MINIMUM_WAGE_MONTHLY * 12; // ₦840,000

/** Consolidated Relief Allowance (CRA): higher of 1% of gross or ₦200,000 + 20% of gross */
export const CRA_FIXED = 200_000;
export const CRA_PERCENTAGE = 0.20;
export const CRA_MIN_PERCENTAGE = 0.01;

/** Rent Relief: lower of ₦500,000 or 20% of annual rent (Section 30(2)) */
export const RENT_RELIEF_CAP = 500_000;
export const RENT_RELIEF_RATE = 0.20;

/** Pension contribution rate (employee portion) */
export const PENSION_RATE = 0.08;

/** National Housing Fund rate */
export const NHF_RATE = 0.025;

/** Life insurance relief cap: 20% of gross, max 7% of income */
export const LIFE_INSURANCE_RELIEF_RATE = 0.20;
export const LIFE_INSURANCE_MAX_RATE = 0.07;

// =============================================================================
// VAT — Value Added Tax (Section 46 / Section 80)
// =============================================================================

/** Standard VAT rate */
export const VAT_RATE = 0.075;

/** VAT registration threshold (₦) — mandatory above this annual turnover */
export const VAT_REGISTRATION_THRESHOLD = 100_000_000;

/** VAT-exempt categories */
export const VAT_EXEMPT_CATEGORIES = [
  'medical-services',
  'pharmaceuticals',
  'basic-food-items',
  'books-newspapers',
  'educational-services',
  'agricultural-products',
  'exported-goods',
] as const;

export type VATExemptCategory = typeof VAT_EXEMPT_CATEGORIES[number];

/** VAT zero-rated categories */
export const VAT_ZERO_RATED = [
  'exports',
  'basic-food-items',
  'books',
  'medical-services',
] as const;

// =============================================================================
// CIT — Company Income Tax (Section 40 / Section 90)
// =============================================================================

export interface CITTier {
  /** Maximum revenue for this tier (₦). Use Infinity for the top tier. */
  maxRevenue: number;
  /** CIT rate */
  rate: number;
  /** Human-readable label */
  label: string;
}

export const CIT_TIERS: readonly CITTier[] = [
  { maxRevenue: 25_000_000,  rate: 0.00, label: 'Small Company (≤₦25M) — 0%' },
  { maxRevenue: 100_000_000, rate: 0.20, label: 'Medium Company (≤₦100M) — 20%' },
  { maxRevenue: Infinity,    rate: 0.30, label: 'Large Company (>₦100M) — 30%' },
] as const;

/** Educational Development Tax rate (companies with ≥10 employees) */
export const EDT_RATE = 0.02;
export const EDT_EMPLOYEE_THRESHOLD = 10;

/** Development Levy rate (4% of assessable profits for companies) */
export const DEVELOPMENT_LEVY_RATE = 0.04;

/** Minimum Effective Tax Rate (15% for large companies with turnover > ₦1B) */
export const MINIMUM_ETR = 0.15;
export const MINIMUM_ETR_THRESHOLD = 1_000_000_000; // ₦1B

/** Digital Tax threshold (₦25M annual digital income triggers digital tax obligations) */
export const DIGITAL_TAX_THRESHOLD = 25_000_000;

// =============================================================================
// CGT — Capital Gains Tax
// =============================================================================

/** CGT rate on net proceeds */
export const CGT_RATE = 0.10;

/** Asset types subject to CGT */
export const CGT_ASSET_TYPES = [
  'crypto',
  'nfts',
  'stocks',
  'bonds',
  'property',
  'land',
  'shares',
] as const;

export type CGTAssetType = typeof CGT_ASSET_TYPES[number];

// =============================================================================
// WHT — Withholding Tax
// =============================================================================

export const WHT_RATES = {
  dividend: 0.10,
  interest: 0.10,
  rent: 0.10,
  royalty: 0.10,
  consultancy: 0.10,
  construction: 0.05,
  contractServices: 0.05,
  professionalFees: 0.10,
} as const;

export type WHTType = keyof typeof WHT_RATES;

// =============================================================================
// PAYE — Pay As You Earn
// =============================================================================

/** PAYE uses the same PIT brackets applied to employment income */
export const PAYE_BRACKETS = PIT_BRACKETS;

/** Employer pension contribution rate */
export const EMPLOYER_PENSION_RATE = 0.10;

/** Employee pension contribution rate */
export const EMPLOYEE_PENSION_RATE = 0.08;

// =============================================================================
// Penalties
// =============================================================================

export const PENALTY_RATES = {
  /** Under-deduction: 10% base + 5% interest */
  underDeduction: { base: 0.10, interest: 0.05 },
  /** Late remittance: 10% monthly */
  lateRemittance: 0.10,
  /** Late return: ₦25,000 fixed */
  lateReturn: 25_000,
  /** Non-remittance: 10% of tax due */
  nonRemittance: 0.10,
  /** Late filing: 5% per month */
  lateFiling: 0.05,
  /** Late payment: 10% per month */
  latePayment: 0.10,
} as const;

// =============================================================================
// Compliance Calendar
// =============================================================================

export const COMPLIANCE_CALENDAR = {
  VAT: {
    frequency: 'monthly' as const,
    dueDay: 21,
    description: 'VAT Return and Payment',
  },
  PAYE: {
    frequency: 'monthly' as const,
    dueDay: 10,
    description: 'PAYE Remittance',
  },
  CIT: {
    frequency: 'annual' as const,
    dueMonth: 6,
    dueDay: 30,
    description: 'Company Income Tax Return',
  },
  WHT: {
    frequency: 'monthly' as const,
    dueDay: 21,
    description: 'Withholding Tax Remittance',
  },
  PIT: {
    frequency: 'annual' as const,
    dueMonth: 3,
    dueDay: 31,
    description: 'Personal Income Tax Annual Return',
  },
} as const;

// =============================================================================
// Aggregate export
// =============================================================================

export const NTA_2025_RULES = {
  pit: {
    brackets: PIT_BRACKETS,
    minimumWageAnnual: MINIMUM_WAGE_ANNUAL,
    cra: { fixed: CRA_FIXED, percentage: CRA_PERCENTAGE, minPercentage: CRA_MIN_PERCENTAGE },
    rentRelief: { cap: RENT_RELIEF_CAP, rate: RENT_RELIEF_RATE },
    pension: PENSION_RATE,
    nhf: NHF_RATE,
    lifeInsurance: { rate: LIFE_INSURANCE_RELIEF_RATE, maxRate: LIFE_INSURANCE_MAX_RATE },
  },
  vat: {
    rate: VAT_RATE,
    registrationThreshold: VAT_REGISTRATION_THRESHOLD,
    exempt: VAT_EXEMPT_CATEGORIES,
    zeroRated: VAT_ZERO_RATED,
  },
  cit: {
    tiers: CIT_TIERS,
    edt: { rate: EDT_RATE, employeeThreshold: EDT_EMPLOYEE_THRESHOLD },
    developmentLevy: DEVELOPMENT_LEVY_RATE,
    minimumETR: { rate: MINIMUM_ETR, threshold: MINIMUM_ETR_THRESHOLD },
    digitalTaxThreshold: DIGITAL_TAX_THRESHOLD,
  },
  cgt: {
    rate: CGT_RATE,
    assetTypes: CGT_ASSET_TYPES,
  },
  wht: WHT_RATES,
  paye: {
    brackets: PAYE_BRACKETS,
    employerPension: EMPLOYER_PENSION_RATE,
    employeePension: EMPLOYEE_PENSION_RATE,
    nhf: NHF_RATE,
  },
  penalties: PENALTY_RATES,
  compliance: COMPLIANCE_CALENDAR,
} as const;
