/**
 * Intelligent Tax Engine
 * 
 * Nigeria-specific tax calculations with:
 * - PIT (Personal Income Tax) with progressive bands
 * - VAT (7.5%) calculation
 * - CIT (Company Income Tax) for incorporated entities
 * - Tax optimization suggestions
 * - Compliance checking
 * 
 * Complies with Nigeria Tax Act 2025 & NRS regulations
 */

import {
  PIT_BRACKETS,
  VAT_RATE,
  CIT_TIERS,
  MINIMUM_WAGE_ANNUAL,
  CRA_FIXED,
  CRA_PERCENTAGE,
  CRA_MIN_PERCENTAGE,
  DEVELOPMENT_LEVY_RATE,
  MINIMUM_ETR,
  MINIMUM_ETR_THRESHOLD,
  DIGITAL_TAX_THRESHOLD,
  EDT_RATE,
} from '@taxbridge/contracts';

// ============================================================================
// Types
// ============================================================================

export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
  label: string;
}

export interface PITCalculation {
  income: number;
  taxableIncome: number;
  cra: number; // Consolidated Relief Allowance
  breakdown: {
    bracket: string;
    amount: number;
    rate: number;
    tax: number;
  }[];
  totalTax: number;
  effectiveRate: number;
  takeHome: number;
}

export interface VATCalculation {
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalWithVAT: number;
}

export interface CITCalculation {
  revenue: number;
  allowableDeductions: number;
  taxableProfit: number;
  citRate: number;
  taxAmount: number;
  effectiveRate: number;
  netProfit: number;
  category: string;
}

export interface TaxOptimization {
  currentTax: number;
  potentialSavings: number;
  recommendations: {
    title: string;
    description: string;
    savingsEstimate: number;
    priority: 'high' | 'medium' | 'low';
    category: 'allowance' | 'relief' | 'deduction' | 'structure';
  }[];
}

// ============================================================================
// Constants - Nigeria Tax Act 2025
// ============================================================================

// Convert canonical PIT_BRACKETS to mobile TaxBracket format
export const MOBILE_PIT_BRACKETS: TaxBracket[] = PIT_BRACKETS.map((bracket, index, arr) => ({
  min: index === 0 ? 0 : arr[index - 1].limit + 1,
  max: bracket.limit === Infinity ? null : bracket.limit,
  rate: bracket.rate,
  label: bracket.label,
}));

export const MINIMUM_WAGE = MINIMUM_WAGE_ANNUAL;

// Re-export CIT tier rates for consumers that need individual constants
export const CIT_RATE_SMALL = CIT_TIERS[0].rate;  // 0%
export const CIT_RATE_MEDIUM = CIT_TIERS[1].rate; // 20%
export const CIT_RATE_LARGE = CIT_TIERS[2].rate;  // 30%

// Re-export canonical tax constants so rule modules can import directly from this file
export { PIT_BRACKETS, VAT_RATE };

// ============================================================================
// VAT Calculation Engine
// ============================================================================

/**
 * Calculates VAT for a given base amount
 *
 * @param amount - Base amount in ₦ (excluding VAT)
 * @returns VAT breakdown including rate, vatAmount, and total
 */
export function calculateVAT(amount: number): VATCalculation {
  const vatAmount = amount * VAT_RATE;
  return {
    amount,
    vatRate: VAT_RATE,
    vatAmount,
    totalWithVAT: amount + vatAmount,
  };
}

// ============================================================================
// PIT Calculation Engine
// ============================================================================

/**
 * Calculates Personal Income Tax (PIT) using progressive tax bands
 *
 * @param annualIncome - Gross annual income in ₦
 * @returns Detailed PIT calculation with breakdown
 */
export function calculatePIT(income: number): PITCalculation {
  // Calculate CRA per Section 33(1): higher of (1% of gross) OR (₦200,000 + 20% of gross)
  const cra = Math.max(income * CRA_MIN_PERCENTAGE, CRA_FIXED + income * CRA_PERCENTAGE);
  const taxableIncome = Math.max(0, income - cra);

  const breakdown: PITCalculation['breakdown'] = [];
  let totalTax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of MOBILE_PIT_BRACKETS) {
    if (remainingIncome <= 0) break;

    const bracketMin = bracket.min;
    const bracketMax = bracket.max ?? Infinity;
    const bracketSize = bracketMax - bracketMin;
    const taxableInBracket = Math.min(remainingIncome, bracketSize);
    const tax = taxableInBracket * bracket.rate;

    if (taxableInBracket > 0) {
      breakdown.push({
        bracket: bracket.label,
        amount: taxableInBracket,
        rate: bracket.rate,
        tax,
      });
      totalTax += tax;
      remainingIncome -= taxableInBracket;
    }
  }

  const effectiveRate = income > 0 ? totalTax / income : 0;
  const takeHome = income - totalTax;

  return {
    income,
    taxableIncome,
    cra,
    breakdown,
    totalTax,
    effectiveRate,
    takeHome,
  };
}

// ============================================================================
// CIT Calculation Engine
// ============================================================================

/**
 * Calculates Company Income Tax (CIT) for incorporated entities
 * 
 * @param revenue - Total annual revenue
 * @param expenses - Sum of allowable expenses
 * @param employeeCount - Number of employees
 * @param digitalIncome - Digital income
 * @returns CIT calculation
 */
export function calculateCIT(
  revenue: number,
  expenses: number,
  employeeCount: number = 0,
  digitalIncome: number = 0
): CITCalculation {
  const profit = Math.max(0, revenue - expenses);

  // Determine CIT tier based on revenue
  let matchedTier = CIT_TIERS[CIT_TIERS.length - 1];
  for (const tier of CIT_TIERS) {
    if (revenue <= tier.maxRevenue) {
      matchedTier = tier;
      break;
    }
  }

  const citRate = matchedTier.rate;
  let taxAmount = profit * citRate;

  // Development Levy (4% of assessable profits)
  const developmentLevy = profit * DEVELOPMENT_LEVY_RATE;

  // Educational Development Tax (2% if ≥10 employees)
  const edt = employeeCount >= 10 ? profit * EDT_RATE : 0;

  // Total tax before minimum ETR check
  let totalTax = taxAmount + developmentLevy + edt;

  // Minimum ETR check (15% for companies with turnover > ₦1B)
  let minimumETRApplied = false;
  if (revenue > MINIMUM_ETR_THRESHOLD) {
    const minimumTax = profit * MINIMUM_ETR;
    if (totalTax < minimumTax) {
      totalTax = minimumTax;
      minimumETRApplied = true;
    }
  }

  // Digital tax applicability check
  const digitalTaxApplicable = digitalIncome >= DIGITAL_TAX_THRESHOLD;

  const effectiveRate = revenue > 0 ? totalTax / revenue : 0;
  const netProfit = profit - totalTax;

  return {
    revenue,
    allowableDeductions: expenses,
    taxableProfit: profit,
    citRate,
    taxAmount: totalTax,
    effectiveRate,
    netProfit,
    category: matchedTier.label,
  };
}

// ============================================================================
// Tax Optimization Engine
// ============================================================================

/**
 * Analyzes tax situation and suggests optimization strategies
 * 
 * @param annualIncome - Annual income in ₦
 * @param businessType - Type of business entity
 * @returns Tax optimization recommendations
 */
export function getTaxOptimization(
  annualIncome: number,
  businessType: 'individual' | 'sole-prop' | 'incorporated' = 'individual'
): TaxOptimization {
  const currentPIT = calculatePIT(annualIncome);
  const recommendations: TaxOptimization['recommendations'] = [];
  
  // Recommendation 1: Maximize CRA allowances
  if (annualIncome > 2000000) {
    recommendations.push({
      title: 'Maximize Pension Contributions',
      description: 'Increase pension contributions to reduce taxable income. Up to 20% of income can be tax-deductible.',
      savingsEstimate: annualIncome * 0.20 * 0.21, // Assume top bracket
      priority: 'high',
      category: 'allowance',
    });
  }

  // Recommendation 2: Consider incorporation
  if (businessType === 'sole-prop' && annualIncome > 5000000) {
    const pitTax = currentPIT.totalTax;
    const citTax = calculateCIT(annualIncome, annualIncome * 0.4).taxAmount; // Assume 40% deductions
    const savings = Math.max(0, pitTax - citTax);
    
    if (savings > 100000) {
      recommendations.push({
        title: 'Consider Incorporation',
        description: 'Incorporating could reduce your tax burden significantly at your income level. Consult a tax advisor.',
        savingsEstimate: savings,
        priority: 'high',
        category: 'structure',
      });
    }
  }

  // Recommendation 3: Claim all allowable deductions
  recommendations.push({
    title: 'Track All Business Expenses',
    description: 'Keep receipts for all business-related expenses. Many SMEs miss deductions for transport, phone, office supplies.',
    savingsEstimate: annualIncome * 0.05 * 0.19, // Estimate 5% missed deductions
    priority: 'medium',
    category: 'deduction',
  });

  // Recommendation 4: Investment allowances
  if (annualIncome > 3000000) {
    recommendations.push({
      title: 'Utilize Investment Allowances',
      description: 'Investments in equipment and technology can qualify for additional tax relief under the Pioneer Status Incentive.',
      savingsEstimate: 150000,
      priority: 'medium',
      category: 'relief',
    });
  }

  // Calculate potential savings
  const potentialSavings = recommendations.reduce(
    (sum, rec) => sum + rec.savingsEstimate, 
    0
  );

  return {
    currentTax: currentPIT.totalTax,
    potentialSavings,
    recommendations: recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats currency amount to Nigerian Naira
 */
export function formatNaira(amount: number, includeDecimals: boolean = true): string {
  if (includeDecimals) {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

/**
 * Formats percentage
 */
export function formatPercentage(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Determines which tax bracket an income falls into
 */
export function getTaxBracket(annualIncome: number): TaxBracket {
  for (const bracket of MOBILE_PIT_BRACKETS) {
    if (annualIncome >= bracket.min && (bracket.max === null || annualIncome <= bracket.max)) {
      return bracket;
    }
  }
  return MOBILE_PIT_BRACKETS[MOBILE_PIT_BRACKETS.length - 1]; // Default to highest bracket
}

/**
 * Calculates effective tax rate
 */
export function getEffectiveRate(income: number, tax: number): number {
  return income > 0 ? tax / income : 0;
}
