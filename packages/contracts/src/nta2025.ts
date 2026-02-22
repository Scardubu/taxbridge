/**
 * TaxBridge — NTA 2025 Unified Constants
 * Single-object representation of all Nigeria Tax Act 2025 rules.
 * Used by tax-intelligence service and integration tests.
 *
 * References:
 *   NTA 2025  = Nigeria Tax Act 2025 (effective 1 January 2025)
 *   NRS 2026  = Nigeria Revenue Service (Establishment) Act 2024
 */

// ─── NTA 2025 Master Object ────────────────────────────────────────────────────

export const NTA_2025 = {
  /**
   * Personal Income Tax bands — NTA 2025 §1–40
   * Applied to taxable income AFTER Consolidated Relief Allowance
   */
  PIT: {
    bands: [
      { limit: 300_000,   rate: 0.07, label: 'First ₦300k' },
      { limit: 600_000,   rate: 0.11, label: '₦300k–₦600k' },
      { limit: 1_100_000, rate: 0.15, label: '₦600k–₦1.1M' },
      { limit: 1_600_000, rate: 0.19, label: '₦1.1M–₦1.6M' },
      { limit: 3_200_000, rate: 0.21, label: '₦1.6M–₦3.2M' },
      { limit: Infinity,  rate: 0.24, label: 'Above ₦3.2M' },
    ] as const,

    /** Consolidated Relief Allowance — NTA 2025 §33 */
    cra: {
      /** Floor: ₦200,000 or 1% of gross income, whichever is higher */
      floor:         200_000,
      percentFloor:  0.01,
      /** Plus 20% of gross income */
      percentGross:  0.20,
    },

    /** Minimum ETR — NTA 2025 §19 */
    minimumEtr: 0.15,

    /** Pension deduction — Pension Reform Act 2014 §11 */
    pensionRate: 0.08,

    /** NHF contribution — NHF Act §4 */
    nhfRate: 0.025,
  },

  /**
   * Value Added Tax — NTA 2025 §11
   */
  VAT: {
    standardRate: 0.075,
    exemptRate:   0.00,

    /**
     * Registration threshold: businesses with annual turnover ≥ ₦25M
     * must register for VAT — NTA 2025 §12
     */
    registrationThreshold: 25_000_000,

    /**
     * VAT-exempt categories (NTA 2025 §13):
     * Basic food items, medical supplies, educational materials, exported goods
     */
    exemptCategories: [
      'basic_food',
      'medical_supplies',
      'educational_materials',
      'exported_goods',
      'agricultural_produce',
    ] as const,

    /**
     * VAT-eligible business expense categories
     */
    eligibleExpenseCategories: [
      'Office Supplies',
      'Professional Services',
      'Equipment & Machinery',
      'Raw Materials',
      'Marketing & Advertising',
    ] as const,
  },

  /**
   * Company Income Tax — NTA 2025 §55
   */
  CIT: {
    /** Small company: turnover < ₦25M → 0% CIT */
    small:  { threshold: 25_000_000,  rate: 0.00 },
    /** Medium company: ₦25M–₦100M → 20% CIT */
    medium: { threshold: 100_000_000, rate: 0.20 },
    /** Large company: turnover ≥ ₦100M → 30% CIT */
    large:  { threshold: Infinity,    rate: 0.30 },
  },

  /**
   * Development Levy — NTA 2025 §60A
   * 4% on qualifying profits (additional to CIT)
   */
  DEV_LEVY: {
    rate: 0.04,
    /** Exemption: small companies are also exempt from dev levy */
    smallCompanyExempt: true,
  },

  /**
   * Electronic Data Tax (Digital Services) — NTA 2025 §30
   */
  EDT: {
    rate:             0.02,
    revenueThreshold: 25_000_000,
    applicableTo:     ['digital_services', 'e_commerce', 'streaming', 'apps'] as const,
  },

  /**
   * Capital Gains Tax — NTA 2025 Sch. 5
   * Includes cryptocurrency gains
   */
  CGT: {
    rate:            0.10,
    includesCrypto:  true,
  },

  /**
   * Withholding Tax — NTA 2025 §78
   */
  WHT: {
    rates: {
      dividends:   0.10,
      interest:    0.10,
      rent:        0.10,
      royalties:   0.10,
      contracts:   0.05,
      consultancy: 0.10,
      commission:  0.10,
      management:  0.10,
    } as const,
    remittanceDayOfMonth: 21,
  },

  /**
   * PAYE — NTA 2025 §82
   */
  PAYE: {
    remittanceDayOfMonth: 10,
    minimumWageThreshold: 70_000,
  },

  /**
   * NRS E-Invoicing thresholds — NRS 2026 §3
   */
  EINVOICE: {
    mandatoryThreshold: 200_000,
    phase2Threshold:    0,
    phase2Date:         '2026-06-01',
  },

  /**
   * Filing deadlines
   */
  DEADLINES: {
    vatMonthly:       { dayOfMonth: 21, monthOffset: 1 },
    payeMonthly:      { dayOfMonth: 10, monthOffset: 1 },
    whtMonthly:       { dayOfMonth: 21, monthOffset: 1 },
    pitAnnual:        { month: 2,  day: 31 },
    citAnnual:        { month: 5,  day: 30 },
    citProvisional:   { dayOfMonth: 31, quarterMonths: [3, 6, 9, 12] },
  },
} as const;

// ─── Helper: Calculate PIT ─────────────────────────────────────────────────────

export function calculatePIT(grossIncome: number): {
  cra:           number;
  taxableIncome: number;
  totalTax:      number;
  effectiveRate: number;
  monthlyTax:    number;
  bandBreakdown: Array<{ label: string; rate: number; income: number; tax: number }>;
} {
  if (grossIncome <= 0) {
    return { cra: 0, taxableIncome: 0, totalTax: 0, effectiveRate: 0, monthlyTax: 0, bandBreakdown: [] };
  }

  const { floor, percentFloor, percentGross } = NTA_2025.PIT.cra;
  const cra           = Math.max(floor, grossIncome * percentFloor) + grossIncome * percentGross;
  const taxableIncome = Math.max(0, grossIncome - cra);

  let remaining = taxableIncome;
  let totalTax  = 0;
  let prevLimit = 0;
  const bandBreakdown: ReturnType<typeof calculatePIT>['bandBreakdown'] = [];

  for (const band of NTA_2025.PIT.bands) {
    const width = band.limit === Infinity
      ? remaining
      : Math.min(remaining, band.limit - prevLimit);

    if (width <= 0) break;

    const taxOnBand = width * band.rate;
    totalTax       += taxOnBand;
    bandBreakdown.push({ label: band.label, rate: band.rate, income: width, tax: taxOnBand });
    remaining  -= width;
    prevLimit   = band.limit;
    if (remaining <= 0) break;
  }

  return {
    cra,
    taxableIncome,
    totalTax:      Math.round(totalTax),
    effectiveRate: grossIncome > 0 ? totalTax / grossIncome : 0,
    monthlyTax:    Math.round(totalTax / 12),
    bandBreakdown,
  };
}

// ─── Helper: Calculate CIT ─────────────────────────────────────────────────────

export function calculateCIT(annualTurnover: number, taxableProfit: number): {
  tier:      'small' | 'medium' | 'large';
  citRate:   number;
  citAmount: number;
  devLevy:   number;
  total:     number;
  exempt:    boolean;
} {
  const tier = annualTurnover < NTA_2025.CIT.small.threshold   ? 'small'
             : annualTurnover < NTA_2025.CIT.medium.threshold  ? 'medium'
             : 'large';

  const citRate   = NTA_2025.CIT[tier].rate;
  const exempt    = tier === 'small';
  const citAmount = exempt ? 0 : taxableProfit * citRate;
  const devLevy   = exempt ? 0 : taxableProfit * NTA_2025.DEV_LEVY.rate;

  return {
    tier, citRate, citAmount, devLevy,
    total:  Math.round(citAmount + devLevy),
    exempt,
  };
}

// ─── Helper: Calculate VAT ─────────────────────────────────────────────────────

export function calculateVAT(amount: number, inclusive = false): {
  net:       number;
  vatAmount: number;
  total:     number;
} {
  if (inclusive) {
    const net       = amount / (1 + NTA_2025.VAT.standardRate);
    const vatAmount = amount - net;
    return { net: Math.round(net), vatAmount: Math.round(vatAmount), total: amount };
  }
  const vatAmount = amount * NTA_2025.VAT.standardRate;
  return { net: amount, vatAmount: Math.round(vatAmount), total: Math.round(amount + vatAmount) };
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PitBand       = typeof NTA_2025.PIT.bands[number];
export type VatCategory   = typeof NTA_2025.VAT.eligibleExpenseCategories[number];
export type WhtPaymentType = keyof typeof NTA_2025.WHT.rates;
export type CompanyTier   = 'small' | 'medium' | 'large';
