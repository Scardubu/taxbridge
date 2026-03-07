/**
 * TaxBridge — Canonical Rate Constants (V13 Sovereign)
 *
 * C-04 / C-10: All tax rate constants live here — never inline in handlers.
 * C-09: Tax calculations (using these constants) only in packages/contracts/.
 * C-27: CBN_MPR NEVER hardcoded — always parseFloat(process.env.CBN_MPR ?? '0.2725')
 *
 * NTA 2025 §§: Citations preserved for audit defence.
 */

// ─── NRS E-Invoice Threshold ───────────────────────────────────────────────────
/** ₦200,000 per invoice — NRS 2026 §3 */
export const NRS_STAMP_THRESHOLD = 200_000;

// ─── VAT Constants — NTA 2025 §11–12 ─────────────────────────────────────────
export const VAT_RATE                   = 0.075;
export const VAT_REGISTRATION_THRESHOLD = 25_000_000;  // NTA 2025 §12 — NOT ₦100M
export const VAT_SMALL_CO_EXEMPTION     = 100_000_000;

// ─── WHT Rates — NTA 2025 §78 ─────────────────────────────────────────────────
/** 10% — Professional / consultancy / management / technical. ⚠️ Most common dev error (NOT 5%) */
export const WHT_PROFESSIONAL_RATE  = 0.10;
/** 5% — Construction / survey / contracts ONLY */
export const WHT_CONSTRUCTION_RATE  = 0.05;
/** 10% — dividends, interest, royalties, rent, agency commissions */
export const WHT_DIVIDEND_RATE      = 0.10;
/** non-resident ONLY; never a default. Routes to separate NRS channel. */
export const WHT_NONRESIDENT_RATE   = 0.04;
/** WHT exemption: BOTH valid TIN AND monthly total ≤ this threshold */
export const WHT_MONTHLY_EXEMPTION_CAP = 2_000_000;

// ─── CIT Constants — NTA 2025 §55 ────────────────────────────────────────────
/** Turnover below this threshold → company is exempt from CIT (0%) */
export const SMALL_CO_CIT_THRESHOLD     = 100_000_000;
export const SMALL_CO_FIXED_ASSETS_MAX  = 250_000_000;
/** Large company CIT rate: 30% on assessable profit */
export const CIT_LARGE_RATE             = 0.30;
/** Small company CIT rate: 0% — turnover < ₦100M */
export const CIT_SMALL_RATE             = 0.00;
/** ITF Development Levy: 4% on CIT assessable profit — CIT context ONLY */
export const DEV_LEVY_RATE              = 0.04;

// ─── Penalty Constants — NTA 2025 §§153–180 ──────────────────────────────────
export const PENALTY_IND_FIRST_MONTH   = 50_000;
export const PENALTY_IND_SUBSEQUENT    = 25_000;
export const PENALTY_CO_FIRST_MONTH    = 250_000;
export const PENALTY_CO_SUBSEQUENT     = 125_000;
export const PENALTY_VAT_CO_MONTH      = 50_000;

// ─── PIT Bands — NTA 2025 §1–40 Fourth Schedule ──────────────────────────────
/**
 * PIT_BANDS: each entry's `limit` is the WIDTH of that band (not cumulative).
 * Band 1:  ₦0–₦800k          @ 0%   width = 800,000
 * Band 2:  ₦800k–₦3M         @ 15%  width = 2,200,000
 * Band 3:  ₦3M–₦12M          @ 18%  width = 9,000,000
 * Band 4:  ₦12M–₦25M         @ 21%  width = 13,000,000
 * Band 5:  ₦25M–₦50M         @ 23%  width = 25,000,000
 * Band 6:  Above ₦50M         @ 25%  width = Infinity
 *
 * CRA is ABOLISHED. Use calculateRRA() for individual deductions.
 * No minimum ETR or 1%-gross minimum tax for individuals.
 */
export const PIT_BANDS: ReadonlyArray<{ limit: number; rate: number }> = [
  { limit:    800_000, rate: 0.00 },
  { limit:  2_200_000, rate: 0.15 },
  { limit:  9_000_000, rate: 0.18 },
  { limit: 13_000_000, rate: 0.21 },
  { limit: 25_000_000, rate: 0.23 },
  { limit:    Infinity, rate: 0.25 },
];

/**
 * Rent Relief Allowance — NTA 2025 §34
 * Replaces the abolished CRA. min(20% × annual rent paid, ₦500,000)
 */
export function calculateRRA(annualRentPaid: number): number {
  if (annualRentPaid <= 0) return 0;
  return Math.min(0.20 * annualRentPaid, 500_000);
}

// ─── WHT Rates map (for calculateWHT) ────────────────────────────────────────
export const WHT_RATES = {
  professional:  WHT_PROFESSIONAL_RATE,
  consultancy:   WHT_PROFESSIONAL_RATE,
  management:    WHT_PROFESSIONAL_RATE,
  technical:     WHT_PROFESSIONAL_RATE,
  dividends:     WHT_DIVIDEND_RATE,
  interest:      WHT_DIVIDEND_RATE,
  royalties:     WHT_DIVIDEND_RATE,
  rent:          WHT_DIVIDEND_RATE,
  commission:    WHT_DIVIDEND_RATE,
  construction:  WHT_CONSTRUCTION_RATE,
  survey:        WHT_CONSTRUCTION_RATE,
  contracts:     WHT_CONSTRUCTION_RATE,
  nonResident:   WHT_NONRESIDENT_RATE,
} as const;

export type WHTCategory = keyof typeof WHT_RATES;

/** Monthly WHT remittance deadline — 21st of the following month */
export const WHT_REMITTANCE_DAY = 21;

// Legacy compat
export const VAT_STANDARD_RATE          = VAT_RATE;
export const NRS_EINVOICE_THRESHOLD     = NRS_STAMP_THRESHOLD;
export const CGT_RATE                   = 0.10;
export const CIT_DEV_LEVY_RATE          = DEV_LEVY_RATE;
export const CIT_EDUCATION_TAX_RATE     = 0.025;
export const PIT_RRA_RATE               = 0.20;
export const PIT_RRA_CAP                = 500_000;
export const PIT_PENSION_RATE           = 0.08;
export const PIT_NHF_RATE               = 0.025;
export const WHT_EXEMPTION_MONTHLY_THRESHOLD = WHT_MONTHLY_EXEMPTION_CAP;
