/**
 * @taxbridge/contracts — V13 Sovereign barrel
 *
 * All tax math, RBAC types, and shared interfaces.
 * Import from here — never from individual files.
 *
 * C-04: This is the sole tax-math package.
 * C-09: All calculations live here; never duplicated in backend/mobile/admin.
 */

// ─── V13 Canonical files ──────────────────────────────────────────────────────
export * from './constants';
export * from './pit';
export * from './vat';
export * from './wht';
export * from './cit';
export * from './penalties';
export * from './rbac';
export * from './types';

// ─── NTA 2025 constants object + helpers ─────────────────────────────────────
export {
  NTA_2025,
  calculateRRA,
  calculatePIT as calculatePITSimple,
  calculateCIT as calculateCITSimple,
  calculateVAT as calculateVATSimple,
  type PitBand,
  type VatCategory,
  type WhtPaymentType,
  type CompanyTier,
} from './nta2025';

// ─── tax-rules.ts re-exports (backward compat) ───────────────────────────────
// Only re-export names NOT already defined in constants.ts to avoid conflicts.
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

// ─── sync exports ─────────────────────────────────────────────────────────────
export * from './sync';
