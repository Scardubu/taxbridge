/**
 * TaxBridge — Canonical Rate Constants (V12)
 *
 * C-04 / C-10: All tax rate constants live here — never inline in handlers.
 * C-09: Tax calculations (using these constants) only in packages/contracts/.
 *
 * COMP-01: There is NO 4% WHT rate in Nigerian law. Any prior reference to
 * a 4% non-resident WHT rate was a regulatory error and is hereby eradicated.
 * nonResident WHT = 10% (same rate as resident — different NRS remittance channel).
 *
 * CIT_DEV_LEVY_RATE = 0.04 is the ITF Development Levy on CIT assessable profit.
 * It is NOT a WHT rate. Context: CIT only.
 */

// ─── WHT Rates — NTA 2025 §78 ─────────────────────────────────────────────────

export const WHT_RATES = {
  /** Professional / consultancy / management / technical services */
  professional:  0.10,
  consultancy:   0.10,
  management:    0.10,
  technical:     0.10,
  /** Dividends, interest, royalties */
  dividends:     0.10,
  interest:      0.10,
  royalties:     0.10,
  /** Rent */
  rent:          0.10,
  /** Construction / survey / contracts */
  construction:  0.05,
  survey:        0.05,
  contracts:     0.05,
  /**
   * Non-resident WHT — same 10% rate as resident.
   * nonResident:true routes to a separate NRS remittance channel / TCC path.
   * There is NO 4% non-resident WHT rate in Nigerian law (COMP-01).
   */
  nonResident:   0.10,
} as const;

/** Monthly WHT remittance deadline — 21st of the following month */
export const WHT_REMITTANCE_DAY = 21;

/** WHT exemption: BOTH TIN validated AND monthly total ≤ this threshold */
export const WHT_EXEMPTION_MONTHLY_THRESHOLD = 2_000_000;

// ─── CIT Rate Constants — NTA 2025 §55 ────────────────────────────────────────

/**
 * Turnover below this threshold → company is exempt from CIT (small company).
 * V12 canonical threshold: ₦100M (as confirmed by calculateCIT gate tests).
 */
export const SMALL_CO_CIT_THRESHOLD = 100_000_000;

/** Large company CIT rate: 30% on assessable profit */
export const CIT_LARGE_RATE         = 0.30;

/**
 * ITF Development Levy rate: 4% on CIT assessable profit.
 * THIS IS A CIT-CONTEXT LEVY — NOT a WHT rate (COMP-01).
 */
export const CIT_DEV_LEVY_RATE      = 0.04;

/** Education Tax: 2.5% on assessable profit (large companies) */
export const CIT_EDUCATION_TAX_RATE = 0.025;

// ─── VAT Constants — NTA 2025 §11-12 ─────────────────────────────────────────

export const VAT_STANDARD_RATE             = 0.075;
export const VAT_REGISTRATION_THRESHOLD    = 25_000_000;  // ₦25M — NTA 2025 §12

// ─── NRS E-Invoice Threshold — NRS 2026 §3 ────────────────────────────────────

export const NRS_EINVOICE_THRESHOLD        = 200_000;  // C-10: ₦200,000 per invoice

// ─── PIT Allowances — NTA 2025 §30 ────────────────────────────────────────────

export const PIT_RRA_RATE                  = 0.20;   // 20% of annual rent
export const PIT_RRA_CAP                   = 500_000; // capped at ₦500,000
export const PIT_PENSION_RATE              = 0.08;   // 8% — Pension Reform Act 2014
export const PIT_NHF_RATE                  = 0.025;  // 2.5% — NHF Act

// ─── CGT — NTA 2025 Sch. 5 ────────────────────────────────────────────────────

export const CGT_RATE                      = 0.10;
