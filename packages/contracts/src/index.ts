export * from './sync';

// tax-rules: explicit named export to avoid TS2308 ambiguity with constants.ts.
// CGT_RATE, VAT_REGISTRATION_THRESHOLD, WHT_RATES are canonical in constants.ts — excluded here.
export {
  type PITBracket,
  PIT_BRACKETS,
  MINIMUM_WAGE_MONTHLY,
  MINIMUM_WAGE_ANNUAL,
  CRA_FIXED,
  CRA_PERCENTAGE,
  CRA_MIN_PERCENTAGE,
  RENT_RELIEF_CAP,
  RENT_RELIEF_RATE,
  PENSION_RATE,
  NHF_RATE,
  LIFE_INSURANCE_RELIEF_RATE,
  LIFE_INSURANCE_MAX_RATE,
  VAT_RATE,
  VAT_EXEMPT_CATEGORIES,
  type VATExemptCategory,
  VAT_ZERO_RATED,
  type CITTier,
  CIT_TIERS,
  EDT_RATE,
  EDT_EMPLOYEE_THRESHOLD,
  DEVELOPMENT_LEVY_RATE,
  MINIMUM_ETR,
  MINIMUM_ETR_THRESHOLD,
  DIGITAL_TAX_THRESHOLD,
  CGT_ASSET_TYPES,
  type CGTAssetType,
  type WHTType,
  PAYE_BRACKETS,
  EMPLOYER_PENSION_RATE,
  EMPLOYEE_PENSION_RATE,
  PENALTY_RATES,
  COMPLIANCE_CALENDAR,
  NTA_2025_RULES,
} from './tax-rules';

// Re-export nta2025 explicitly to avoid collision with cit.ts calculateCIT (V12 C-41 canonical)
export {
  NTA_2025,
  calculateRRA,
  calculatePIT,
  calculateVAT,
  type PitBand,
  type VatCategory,
  type WhtPaymentType,
  type CompanyTier,
} from './nta2025';

export * from './rbac';
export * from './cit';
export * from './types';
// constants.ts is canonical for: WHT_RATES, VAT_REGISTRATION_THRESHOLD, CGT_RATE (C-04/C-10)
export * from './constants';
