/**
 * TaxBridge Tax Engine — Backend Service
 *
 * Consolidated tax calculation engine implementing all Nigerian tax types
 * per the Nigeria Tax Act 2025 (NTA 2025).
 *
 * Supported tax types: PIT, VAT, CIT, CGT, WHT, PAYE
 *
 * All constants are imported from @taxbridge/contracts (single source of truth).
 */

import {
  PIT_BRACKETS,
  PITBracket,
  MINIMUM_WAGE_ANNUAL,
  RENT_RELIEF_CAP,
  RENT_RELIEF_RATE,
  PENSION_RATE,
  NHF_RATE,
  VAT_RATE,
  VAT_REGISTRATION_THRESHOLD,
  VAT_EXEMPT_CATEGORIES,
  VATExemptCategory,
  CIT_TIERS,
  CITTier,
  EDT_RATE,
  DEVELOPMENT_LEVY_RATE,
  MINIMUM_ETR,
  MINIMUM_ETR_THRESHOLD,
  DIGITAL_TAX_THRESHOLD,
  CGT_RATE,
  CGTAssetType,
  WHT_RATES,
  WHTType,
  PAYE_BRACKETS,
  EMPLOYEE_PENSION_RATE,
  EMPLOYER_PENSION_RATE,
} from '@taxbridge/contracts';
import { calculateRRA } from '@taxbridge/contracts';

// =============================================================================
// Shared Helpers
// =============================================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function applyProgressiveBrackets(
  taxableIncome: number,
  brackets: readonly PITBracket[],
): { totalTax: number; breakdown: BracketBreakdown[] } {
  let remaining = taxableIncome;
  let totalTax = 0;
  let prevLimit = 0;
  const breakdown: BracketBreakdown[] = [];

  for (const bracket of brackets) {
    if (remaining <= 0) break;

    const bandWidth = bracket.limit === Infinity
      ? remaining
      : bracket.limit - prevLimit;
    const taxableInBand = Math.min(remaining, bandWidth);
    const taxForBand = round2(taxableInBand * bracket.rate);

    if (taxableInBand > 0) {
      breakdown.push({
        bracket: bracket.label,
        rate: bracket.rate,
        taxableAmount: round2(taxableInBand),
        taxAmount: taxForBand,
      });
      totalTax += taxForBand;
      remaining -= taxableInBand;
    }

    prevLimit = bracket.limit === Infinity ? prevLimit : bracket.limit;
  }

  return { totalTax: round2(totalTax), breakdown };
}

// =============================================================================
// Types
// =============================================================================

export interface BracketBreakdown {
  bracket: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

// --- PIT ---

export interface PITInput {
  grossIncome: number;
  reliefs?: {
    pension?: number;
    nhf?: number;
    lifeInsurance?: number;
    /** Annual rent paid — used to calculate RRA (NTA 2025 §30(2)) */
    annualRent?: number;
  };
}

export interface PITResult {
  grossIncome: number;
  reliefs: {
    /** Rent Relief Allowance — NTA 2025 §30(2). Replaces abolished CRA. */
    rra: number;
    pension: number;
    nhf: number;
    lifeInsurance: number;
    rentRelief: number;
  };
  totalReliefs: number;
  taxableIncome: number;
  taxAmount: number;
  effectiveRate: number;
  netIncome: number;
  breakdown: BracketBreakdown[];
  isMinimumWageExempt: boolean;
  /** Alias for taxAmount — used by simplified number-arg callers */
  totalTax: number;
  /** Alias for reliefs.rra — Rent Relief Allowance (NTA 2025 §30(2)) */
  rra: number;
  /** Alias for breakdown — used by simplified number-arg callers */
  bandBreakdown: BracketBreakdown[];
  /** Annual tax divided by 12 (rounded) */
  monthlyTax: number;
}

// --- VAT ---

export interface VATInput {
  amount: number;
  category?: string;
}

export interface VATResult {
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  category: string;
  isExempt: boolean;
  /** Net (pre-VAT) amount — equal to amount for exclusive, derived for inclusive */
  net: number;
  /** Total including VAT — alias for totalAmount */
  total: number;
}

// --- CIT ---

export interface CITInput {
  revenue: number;
  expenses: number;
  employeeCount?: number;
  digitalIncome?: number;
}

export interface CITResult {
  revenue: number;
  expenses: number;
  profit: number;
  taxRate: number;
  taxAmount: number;
  developmentLevy: number;
  edt: number;
  totalTax: number;
  effectiveRate: number;
  netProfit: number;
  category: string;
  breakdown: BracketBreakdown[];
  minimumETRApplied: boolean;
  digitalTaxApplicable: boolean;
  /** true when the company falls in the small-company 0% CIT tier */
  exempt: boolean;
  /** 'small' | 'medium' | 'large' based on revenue tier */
  tier: 'small' | 'medium' | 'large';
  /** Alias for taxAmount */
  citAmount: number;
  /** Alias for taxRate */
  citRate: number;
  /** Alias for developmentLevy (0 for small companies) */
  devLevy: number;
}

// --- CGT ---

export interface CGTInput {
  proceeds: number;
  costBasis: number;
  assetType: string;
  holdingPeriodMonths?: number;
}

export interface CGTResult {
  proceeds: number;
  costBasis: number;
  netGain: number;
  taxRate: number;
  taxAmount: number;
  assetType: string;
  isLoss: boolean;
}

// --- WHT ---

export interface WHTInput {
  amount: number;
  type: string;
}

export interface WHTResult {
  amount: number;
  type: string;
  rate: number;
  whtAmount: number;
  netAmount: number;
}

// --- PAYE ---

export interface PAYEInput {
  grossSalary: number;
  allowances?: {
    housing?: number;
    transport?: number;
    meal?: number;
    others?: number;
  };
}

export interface PAYEAllowanceBreakdown {
  description: string;
  amount: number;
}

export interface PAYEResult {
  grossIncome: number;
  totalAllowances: number;
  taxableIncome: number;
  totalReliefs: number;
  taxDue: number;
  pensionContribution: number;
  nhfContribution: number;
  netPay: number;
  effectiveRate: number;
  breakdown: PAYEAllowanceBreakdown[];
}

// =============================================================================
// PIT Calculator
// =============================================================================

export function calculatePIT(grossIncome: number): PITResult;
export function calculatePIT(input: PITInput): PITResult;
export function calculatePIT(input: number | PITInput): PITResult {
  // Normalise to object form; when called with a plain number, skip min-wage exemption
  const isSimpleCall = typeof input === 'number';
  const grossIncome = isSimpleCall ? (input as number) : (input as PITInput).grossIncome;
  const reliefs = isSimpleCall ? {} : ((input as PITInput).reliefs ?? {});

  if (grossIncome <= 0) {
    const empty: PITResult = {
      grossIncome: 0,
      reliefs: { rra: 0, pension: 0, nhf: 0, lifeInsurance: 0, rentRelief: 0 },
      totalReliefs: 0,
      taxableIncome: 0,
      taxAmount: 0,
      effectiveRate: 0,
      netIncome: 0,
      breakdown: [],
      isMinimumWageExempt: !isSimpleCall,
      totalTax: 0,
      rra: 0,
      bandBreakdown: [],
      monthlyTax: 0,
    };
    return empty;
  }

  // Minimum wage exemption only applies for the full PITInput call form
  const isMinimumWageExempt = !isSimpleCall && grossIncome <= MINIMUM_WAGE_ANNUAL;
  if (isMinimumWageExempt) {
    return {
      grossIncome,
      reliefs: { rra: 0, pension: 0, nhf: 0, lifeInsurance: 0, rentRelief: 0 },
      totalReliefs: 0,
      taxableIncome: 0,
      taxAmount: 0,
      effectiveRate: 0,
      netIncome: grossIncome,
      breakdown: [],
      isMinimumWageExempt: true,
      totalTax: 0,
      rra: 0,
      bandBreakdown: [],
      monthlyTax: 0,
    };
  }

  // RRA: Rent Relief Allowance — NTA 2025 §30(2). Replaces abolished CRA.
  const annualRent = (reliefs as PITInput['reliefs'])?.annualRent ?? 0;
  const rraAmount = calculateRRA(annualRent);

  // Pension
  const pension = (reliefs as PITInput['reliefs'])?.pension ?? 0;

  // NHF
  const nhf = (reliefs as PITInput['reliefs'])?.nhf ?? 0;

  // Life insurance
  const lifeInsurance = (reliefs as PITInput['reliefs'])?.lifeInsurance ?? 0;

  // Rent relief: same as RRA for backward-compat alias
  const rentRelief = rraAmount;

  const totalReliefs = round2(rraAmount + pension + nhf + lifeInsurance);
  const taxableIncome = Math.max(0, round2(grossIncome - totalReliefs));

  // Apply progressive brackets
  const { totalTax, breakdown } = applyProgressiveBrackets(taxableIncome, PIT_BRACKETS);

  const effectiveRate = grossIncome > 0 ? round2((totalTax / grossIncome) * 100) / 100 : 0;
  const monthlyTax = Math.round(totalTax / 12);

  return {
    grossIncome,
    reliefs: { rra: round2(rraAmount), pension, nhf, lifeInsurance, rentRelief: round2(rentRelief) },
    totalReliefs,
    taxableIncome,
    taxAmount: totalTax,
    effectiveRate,
    netIncome: round2(grossIncome - totalTax),
    breakdown,
    isMinimumWageExempt: false,
    // Alias fields for simplified callers
    totalTax,
    rra: round2(rraAmount),
    bandBreakdown: breakdown,
    monthlyTax,
  };
}

// =============================================================================
// VAT Calculator
// =============================================================================

export function calculateVAT(amount: number, inclusive?: boolean): VATResult;
export function calculateVAT(input: VATInput): VATResult;
export function calculateVAT(input: number | VATInput, inclusive?: boolean): VATResult {
  if (typeof input === 'number') {
    const rawAmount = input;
    const vatRate = VAT_RATE;

    if (inclusive) {
      // Extract VAT from an inclusive total: net = total / (1 + vatRate)
      const net = round2(rawAmount / (1 + vatRate));
      const vatAmount = round2(rawAmount - net);
      return {
        amount: net,
        vatRate,
        vatAmount,
        totalAmount: rawAmount,
        category: 'standard',
        isExempt: false,
        net,
        total: rawAmount,
      };
    } else {
      // Exclusive VAT
      const vatAmount = round2(rawAmount * vatRate);
      const totalAmount = round2(rawAmount + vatAmount);
      return {
        amount: rawAmount,
        vatRate,
        vatAmount,
        totalAmount,
        category: 'standard',
        isExempt: false,
        net: rawAmount,
        total: totalAmount,
      };
    }
  }

  const { amount, category = 'standard' } = input;
  const isExempt = (VAT_EXEMPT_CATEGORIES as readonly string[]).includes(category);
  const vatRate = isExempt ? 0 : VAT_RATE;
  const vatAmount = round2(amount * vatRate);
  const totalAmount = round2(amount + vatAmount);

  return {
    amount,
    vatRate,
    vatAmount,
    totalAmount,
    category,
    isExempt,
    net: amount,
    total: totalAmount,
  };
}

// =============================================================================
// CIT Calculator
// =============================================================================

export function calculateCIT(revenue: number, profit: number): CITResult;
export function calculateCIT(input: CITInput): CITResult;
export function calculateCIT(inputOrRevenue: number | CITInput, profitArg?: number): CITResult {
  let revenue: number;
  let expenses: number;
  let employeeCount = 0;
  let digitalIncome = 0;

  if (typeof inputOrRevenue === 'number') {
    // Simplified call: calculateCIT(revenue, profit)
    // Second arg is treated as pre-computed profit, so expenses = revenue - profit
    revenue = inputOrRevenue;
    const inputProfit = profitArg ?? 0;
    expenses = revenue - inputProfit;
  } else {
    ({ revenue, expenses, employeeCount = 0, digitalIncome = 0 } = inputOrRevenue);
  }

  const profit = Math.max(0, round2(revenue - expenses));

  // Determine tier based on revenue
  let matchedTier: CITTier = CIT_TIERS[CIT_TIERS.length - 1];
  for (const tier of CIT_TIERS) {
    if (revenue <= tier.maxRevenue) {
      matchedTier = tier;
      break;
    }
  }

  const taxRate = matchedTier.rate;
  const isSmall = taxRate === 0;
  let taxAmount = round2(profit * taxRate);

  // Development Levy (4% of assessable profits)
  // NTA 2025 §60A — applies to ALL companies regardless of size tier
  const developmentLevy = round2(profit * DEVELOPMENT_LEVY_RATE);

  // Educational Development Tax (2% if ≥10 employees)
  const edt = employeeCount >= 10 ? round2(profit * EDT_RATE) : 0;

  // Total tax before minimum ETR check
  let totalTax = round2(taxAmount + developmentLevy + edt);

  // Minimum ETR check (15% for companies with turnover > ₦1B)
  let minimumETRApplied = false;
  if (revenue > MINIMUM_ETR_THRESHOLD) {
    const minimumTax = round2(profit * MINIMUM_ETR);
    if (totalTax < minimumTax) {
      totalTax = minimumTax;
      minimumETRApplied = true;
    }
  }

  // Digital tax applicability check
  const digitalTaxApplicable = digitalIncome >= DIGITAL_TAX_THRESHOLD;

  const effectiveRate = revenue > 0 ? round2((totalTax / revenue) * 100) / 100 : 0;
  const netProfit = round2(profit - totalTax);

  const tierLabel: 'small' | 'medium' | 'large' =
    matchedTier.maxRevenue <= 25_000_000 ? 'small' :
    matchedTier.maxRevenue <= 100_000_000 ? 'medium' : 'large';

  const breakdown: BracketBreakdown[] = [
    {
      bracket: matchedTier.label,
      rate: taxRate,
      taxableAmount: profit,
      taxAmount,
    },
    {
      bracket: 'Development Levy (4%)',
      rate: DEVELOPMENT_LEVY_RATE,
      taxableAmount: profit,
      taxAmount: developmentLevy,
    },
  ];

  if (edt > 0) {
    breakdown.push({
      bracket: 'Educational Development Tax (2%)',
      rate: EDT_RATE,
      taxableAmount: profit,
      taxAmount: edt,
    });
  }

  if (minimumETRApplied) {
    breakdown.push({
      bracket: 'Minimum ETR Adjustment (15%)',
      rate: MINIMUM_ETR,
      taxableAmount: profit,
      taxAmount: round2(totalTax - taxAmount - developmentLevy - edt),
    });
  }

  return {
    revenue,
    expenses,
    profit,
    taxRate,
    taxAmount,
    developmentLevy,
    edt,
    totalTax,
    effectiveRate,
    netProfit,
    category: matchedTier.label,
    breakdown,
    minimumETRApplied,
    digitalTaxApplicable,
    // Alias + extended fields
    exempt: isSmall,
    tier: tierLabel,
    citAmount: taxAmount,
    citRate: taxRate,
    devLevy: developmentLevy,
  };
}

// =============================================================================
// CGT Calculator
// =============================================================================

export function calculateCGT(input: CGTInput): CGTResult {
  const { proceeds, costBasis, assetType, holdingPeriodMonths } = input;

  const netGain = round2(proceeds - costBasis);
  const isLoss = netGain <= 0;

  const taxAmount = isLoss ? 0 : round2(netGain * CGT_RATE);

  return {
    proceeds,
    costBasis,
    netGain,
    taxRate: CGT_RATE,
    taxAmount,
    assetType,
    isLoss,
  };
}

// =============================================================================
// WHT Calculator
// =============================================================================

export function calculateWHT(input: WHTInput): WHTResult {
  const { amount, type } = input;

  const rate = WHT_RATES[type as WHTType];
  if (rate === undefined) {
    throw new Error(`Unknown WHT type: ${type}. Valid types: ${Object.keys(WHT_RATES).join(', ')}`);
  }

  const whtAmount = round2(amount * rate);
  const netAmount = round2(amount - whtAmount);

  return {
    amount,
    type,
    rate,
    whtAmount,
    netAmount,
  };
}

// =============================================================================
// PAYE Calculator
// =============================================================================

export function calculatePAYE(input: PAYEInput): PAYEResult {
  const { grossSalary, allowances = {} } = input;

  const housing = allowances.housing ?? 0;
  const transport = allowances.transport ?? 0;
  const meal = allowances.meal ?? 0;
  const others = allowances.others ?? 0;
  const totalAllowances = round2(housing + transport + meal + others);

  const grossIncome = round2(grossSalary + totalAllowances);

  // Statutory deductions
  const pensionContribution = round2(grossSalary * EMPLOYEE_PENSION_RATE);
  const nhfContribution = round2(grossSalary * NHF_RATE);

  // PAYE reliefs: pension + NHF only (CRA abolished under NTA 2025; RRA not auto-applied in PAYE)
  const totalReliefs = round2(pensionContribution + nhfContribution);
  const taxableIncome = Math.max(0, round2(grossIncome - totalReliefs));

  // Apply PIT brackets to taxable income
  const { totalTax: taxDue } = applyProgressiveBrackets(taxableIncome, PAYE_BRACKETS);

  const netPay = round2(grossIncome - pensionContribution - nhfContribution - taxDue);
  const effectiveRate = grossIncome > 0 ? round2((taxDue / grossIncome) * 100) / 100 : 0;

  const breakdown: PAYEAllowanceBreakdown[] = [
    { description: 'Gross Salary', amount: grossSalary },
  ];

  if (housing > 0) breakdown.push({ description: 'Housing Allowance', amount: housing });
  if (transport > 0) breakdown.push({ description: 'Transport Allowance', amount: transport });
  if (meal > 0) breakdown.push({ description: 'Meal Allowance', amount: meal });
  if (others > 0) breakdown.push({ description: 'Other Allowances', amount: others });

  breakdown.push(
    { description: 'Gross Income', amount: grossIncome },
    { description: `Pension (${EMPLOYEE_PENSION_RATE * 100}%)`, amount: -pensionContribution },
    { description: `NHF (${NHF_RATE * 100}%)`, amount: -nhfContribution },
    { description: 'PAYE Tax', amount: -taxDue },
    { description: 'Net Pay', amount: netPay },
  );

  return {
    grossIncome,
    totalAllowances,
    taxableIncome,
    totalReliefs,
    taxDue,
    pensionContribution,
    nhfContribution,
    netPay,
    effectiveRate,
    breakdown,
  };
}
