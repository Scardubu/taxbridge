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
  citAmount: number;
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

// PIT Brackets (Annual Income in ₦)
export const PIT_BRACKETS: TaxBracket[] = [
  { min: 0, max: 300000, rate: 0.07, label: 'Band 1: ₦0 - ₦300,000' },
  { min: 300001, max: 600000, rate: 0.11, label: 'Band 2: ₦300,001 - ₦600,000' },
  { min: 600001, max: 1100000, rate: 0.15, label: 'Band 3: ₦600,001 - ₦1,100,000' },
  { min: 1100001, max: 1600000, rate: 0.19, label: 'Band 4: ₦1,100,001 - ₦1,600,000' },
  { min: 1600001, max: 3200000, rate: 0.21, label: 'Band 5: ₦1,600,001 - ₦3,200,000' },
  { min: 3200001, max: null, rate: 0.24, label: 'Band 6: Above ₦3,200,000' },
];

// Minimum wage (2025) - determines minimum tax exemption
export const MINIMUM_WAGE = 70000; // ₦70,000 monthly = ₦840,000 annually
export const ANNUAL_MINIMUM_WAGE = MINIMUM_WAGE * 12;

// Consolidated Relief Allowance (CRA)
// Higher of 1% of gross income or ₦200,000 + 20% of gross income
export const CRA_FIXED = 200000;
export const CRA_PERCENTAGE = 0.20;
export const CRA_MIN_PERCENTAGE = 0.01;

// VAT Rate (7.5% standard)
export const VAT_RATE = 0.075;

// VAT Threshold for mandatory registration (₦25 million annual turnover)
export const VAT_REGISTRATION_THRESHOLD = 25000000;

// CIT Rate (30% for large companies, 20% for small companies with turnover < ₦25M)
export const CIT_RATE_LARGE = 0.30;
export const CIT_RATE_SMALL = 0.20;
export const CIT_SMALL_BUSINESS_THRESHOLD = 25000000;

// Educational development tax (2% on assessable profit for companies with 10+ employees)
export const EDT_RATE = 0.02;
export const EDT_EMPLOYEE_THRESHOLD = 10;

// ============================================================================
// PIT Calculation Engine
// ============================================================================

/**
 * Calculates Personal Income Tax (PIT) using progressive tax bands
 * 
 * @param annualIncome - Gross annual income in ₦
 * @returns Detailed PIT calculation with breakdown
 */
export function calculatePIT(annualIncome: number): PITCalculation {
  // Apply minimum wage exemption
  if (annualIncome <= ANNUAL_MINIMUM_WAGE) {
    return {
      income: annualIncome,
      taxableIncome: 0,
      cra: 0,
      breakdown: [],
      totalTax: 0,
      effectiveRate: 0,
      takeHome: annualIncome,
    };
  }

  // Calculate Consolidated Relief Allowance (CRA)
  const craOption1 = annualIncome * CRA_MIN_PERCENTAGE;
  const craOption2 = CRA_FIXED + (annualIncome * CRA_PERCENTAGE);
  const cra = Math.max(craOption1, craOption2);

  // Taxable income after CRA
  const taxableIncome = Math.max(0, annualIncome - cra);

  // Calculate tax per bracket
  const breakdown: PITCalculation['breakdown'] = [];
  let totalTax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of PIT_BRACKETS) {
    if (remainingIncome <= 0) break;

    const bracketMin = bracket.min;
    const bracketMax = bracket.max || Infinity;
    const bracketSize = bracketMax - bracketMin;
    
    // Amount of income in this bracket
    const amountInBracket = Math.min(remainingIncome, bracketSize);
    
    if (amountInBracket > 0) {
      const taxForBracket = amountInBracket * bracket.rate;
      
      breakdown.push({
        bracket: bracket.label,
        amount: amountInBracket,
        rate: bracket.rate,
        tax: taxForBracket,
      });
      
      totalTax += taxForBracket;
      remainingIncome -= amountInBracket;
    }
  }

  const effectiveRate = totalTax / annualIncome;
  const takeHome = annualIncome - totalTax;

  return {
    income: annualIncome,
    taxableIncome,
    cra,
    breakdown,
    totalTax,
    effectiveRate,
    takeHome,
  };
}

/**
 * Calculates monthly PIT from monthly income
 */
export function calculateMonthlyPIT(monthlyIncome: number) {
  const annualIncome = monthlyIncome * 12;
  const annualCalculation = calculatePIT(annualIncome);
  
  return {
    ...annualCalculation,
    monthlyTax: annualCalculation.totalTax / 12,
    monthlyTakeHome: annualCalculation.takeHome / 12,
  };
}

// ============================================================================
// VAT Calculation Engine
// ============================================================================

/**
 * Calculates VAT (7.5%) on taxable amount
 * 
 * @param amount - Pre-VAT amount in ₦
 * @param isVATInclusive - Whether amount already includes VAT
 * @returns VAT calculation breakdown
 */
export function calculateVAT(
  amount: number, 
  isVATInclusive: boolean = false
): VATCalculation {
  if (isVATInclusive) {
    // Reverse calculate: amount = base + (base * 0.075)
    // amount = base * 1.075
    // base = amount / 1.075
    const baseAmount = amount / (1 + VAT_RATE);
    const vatAmount = amount - baseAmount;
    
    return {
      amount: baseAmount,
      vatRate: VAT_RATE,
      vatAmount,
      totalWithVAT: amount,
    };
  } else {
    const vatAmount = amount * VAT_RATE;
    const totalWithVAT = amount + vatAmount;
    
    return {
      amount,
      vatRate: VAT_RATE,
      vatAmount,
      totalWithVAT,
    };
  }
}

/**
 * Checks if business should register for VAT
 */
export function shouldRegisterForVAT(annualTurnover: number): boolean {
  return annualTurnover >= VAT_REGISTRATION_THRESHOLD;
}

// ============================================================================
// CIT Calculation Engine
// ============================================================================

/**
 * Calculates Company Income Tax (CIT) for incorporated entities
 * 
 * @param revenue - Total annual revenue
 * @param allowableDeductions - Sum of allowable expenses
 * @returns CIT calculation
 */
export function calculateCIT(
  revenue: number,
  allowableDeductions: number
): CITCalculation {
  const taxableProfit = Math.max(0, revenue - allowableDeductions);
  
  // Determine rate based on turnover
  const citRate = revenue >= CIT_SMALL_BUSINESS_THRESHOLD 
    ? CIT_RATE_LARGE 
    : CIT_RATE_SMALL;
  
  const citAmount = taxableProfit * citRate;

  return {
    revenue,
    allowableDeductions,
    taxableProfit,
    citRate,
    citAmount,
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
    const citTax = calculateCIT(annualIncome, annualIncome * 0.4).citAmount; // Assume 40% deductions
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
  for (const bracket of PIT_BRACKETS) {
    if (annualIncome >= bracket.min && (bracket.max === null || annualIncome <= bracket.max)) {
      return bracket;
    }
  }
  return PIT_BRACKETS[PIT_BRACKETS.length - 1]; // Default to highest bracket
}

/**
 * Calculates effective tax rate
 */
export function getEffectiveRate(income: number, tax: number): number {
  return income > 0 ? tax / income : 0;
}
