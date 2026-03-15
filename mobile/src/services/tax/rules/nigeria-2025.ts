/**
 * Nigeria 2025 Tax Rules
 * 
 * Comprehensive rule-based system for Nigerian tax compliance
 * Updated for Tax Act 2025 amendments and NRS/DigiTax requirements
 */

import {
  PIT_BRACKETS,
  VAT_RATE,
  VAT_EXEMPT_CATEGORIES as CANONICAL_VAT_EXEMPT_CATEGORIES,
  VAT_REGISTRATION_THRESHOLD,
  CIT_TIERS,
  WHT_RATES as CANONICAL_WHT_RATES,
  PENALTY_RATES as CANONICAL_PENALTY_RATES,
  DIGITAL_TAX_THRESHOLD,
  CGT_RATE,
} from '@taxbridge/contracts';
import { CIT_RATE_MEDIUM, CIT_RATE_SMALL } from '../engine';

/** Max deductible charitable donation: CGT_RATE (10%) of profit — NTA 2025 §38 */
const DONATIONS_MAX_RATE = CGT_RATE;

// ============================================================================
// Tax Exemptions & Reliefs
// ============================================================================

/**
 * VAT-Exempt Goods and Services (Nigeria Tax Act 2025)
 */
export const VAT_EXEMPT_CATEGORIES = CANONICAL_VAT_EXEMPT_CATEGORIES;

export type VATExemptCategory = typeof VAT_EXEMPT_CATEGORIES[number];

/**
 * Checks if item category is VAT-exempt
 */
export function isVATExempt(category: string): boolean {
  return VAT_EXEMPT_CATEGORIES.includes(category as VATExemptCategory);
}

/**
 * Basic food items exempt from VAT
 */
export const BASIC_FOOD_ITEMS = [
  'rice',
  'flour',
  'beans',
  'yam',
  'cassava',
  'plantain',
  'bread',
  'milk',
  'sugar',
  'salt',
  'fish',
  'meat',
  'eggs',
  'vegetable-oil',
] as const;

/**
 * Checks if food item is VAT-exempt
 */
export function isBasicFoodItem(itemName: string): boolean {
  const normalized = itemName.toLowerCase();
  return BASIC_FOOD_ITEMS.some(food => normalized.includes(food));
}

// ============================================================================
// Allowable Business Deductions
// ============================================================================

/**
 * Categories of allowable business deductions for CIT
 */
export interface AllowableDeduction {
  category: string;
  description: string;
  limit?: number | 'unlimited';
  requiresDocumentation: boolean;
}

export const ALLOWABLE_DEDUCTIONS: AllowableDeduction[] = [
  {
    category: 'rent',
    description: 'Business premises rent',
    limit: 'unlimited',
    requiresDocumentation: true,
  },
  {
    category: 'salaries',
    description: 'Staff salaries and benefits',
    limit: 'unlimited',
    requiresDocumentation: true,
  },
  {
    category: 'utilities',
    description: 'Electricity, water, internet',
    limit: 'unlimited',
    requiresDocumentation: true,
  },
  {
    category: 'transport',
    description: 'Business-related transport',
    limit: 'unlimited',
    requiresDocumentation: true,
  },
  {
    category: 'professional-fees',
    description: 'Accounting, legal, consulting fees',
    limit: 'unlimited',
    requiresDocumentation: true,
  },
  {
    category: 'depreciation',
    description: 'Capital allowances on assets',
    limit: 'unlimited',
    requiresDocumentation: true,
  },
  {
    category: 'bad-debts',
    description: 'Write-off of irrecoverable debts',
    limit: 'unlimited',
    requiresDocumentation: true,
  },
  {
    category: 'donations',
    description: 'Charitable donations (max 10% of profit)',
    limit: DONATIONS_MAX_RATE,
    requiresDocumentation: true,
  },
];

/**
 * Validates if expense category is allowable deduction
 */
export function isAllowableDeduction(category: string): boolean {
  return ALLOWABLE_DEDUCTIONS.some(d => d.category === category);
}

// ============================================================================
// Small Business Reliefs
// ============================================================================

/**
 * Small and Medium Enterprise (SME) Relief Thresholds
 */
export const SME_THRESHOLDS = {
  // Turnover thresholds (₦)
  micro: 10000000, // ₦10M
  small: 25000000, // ₦25M
  medium: 100000000, // ₦100M

  // Employee count thresholds
  microEmployees: 10,
  smallEmployees: 50,
  mediumEmployees: 200,
} as const;

/**
 * Determines SME category
 */
export function getSMECategory(
  annualTurnover: number,
  employeeCount: number
): 'micro' | 'small' | 'medium' | 'large' {
  if (
    annualTurnover <= SME_THRESHOLDS.micro &&
    employeeCount <= SME_THRESHOLDS.microEmployees
  ) {
    return 'micro';
  }

  if (
    annualTurnover <= SME_THRESHOLDS.small &&
    employeeCount <= SME_THRESHOLDS.smallEmployees
  ) {
    return 'small';
  }

  if (
    annualTurnover <= SME_THRESHOLDS.medium &&
    employeeCount <= SME_THRESHOLDS.mediumEmployees
  ) {
    return 'medium';
  }

  return 'large';
}

/**
 * SME-specific tax reliefs
 */
export interface SMERelief {
  category: 'micro' | 'small' | 'medium';
  benefits: string[];
  citRate: number;
  vatRegistrationMandatory: boolean;
}

export const SME_RELIEFS: Record<'micro' | 'small' | 'medium', SMERelief> = {
  micro: {
    category: 'micro',
    benefits: [
      'Simplified tax filing',
      'CIT exempt (0%)',
      'Optional VAT registration',
      'Reduced compliance requirements',
    ],
    citRate: CIT_RATE_SMALL,
    vatRegistrationMandatory: false,
  },
  small: {
    category: 'small',
    benefits: [
      'CIT exempt (0%)',
      'Accelerated depreciation',
      'Optional VAT registration below ₦100M turnover',
    ],
    citRate: CIT_RATE_SMALL,
    vatRegistrationMandatory: false,
  },
  medium: {
    category: 'medium',
    benefits: [
      'Medium CIT rate (20%)',
      'Investment allowances',
      'Mandatory VAT registration',
    ],
    citRate: CIT_RATE_MEDIUM,
    vatRegistrationMandatory: VAT_REGISTRATION_THRESHOLD <= SME_THRESHOLDS.medium,
  },
};

// ============================================================================
// Compliance Requirements
// ============================================================================

/**
 * Tax filing deadlines (2025)
 */
export const TAX_DEADLINES = {
  pit: {
    monthlyWithholding: 10, // 10th of following month
    annualReturns: '03-31', // March 31
  },
  vat: {
    monthlyReturns: 21, // 21st of following month
  },
  cit: {
    annualReturns: '06-30', // June 30 (6 months after year-end)
    advancePayment1: '04-30',
    advancePayment2: '07-31',
    advancePayment3: '10-31',
  },
} as const;

/**
 * Returns next filing deadline
 */
export function getNextDeadline(taxType: 'pit' | 'vat' | 'cit'): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (taxType === 'vat') {
    // Next 21st
    const deadline = new Date(year, month, TAX_DEADLINES.vat.monthlyReturns);
    if (deadline < now) {
      deadline.setMonth(month + 1);
    }
    return deadline;
  }

  if (taxType === 'pit') {
    // Next annual return: March 31
    const deadline = new Date(year, 2, 31); // March = month 2
    if (deadline < now) {
      deadline.setFullYear(year + 1);
    }
    return deadline;
  }

  // CIT annual return: June 30
  const deadline = new Date(year, 5, 30); // June = month 5
  if (deadline < now) {
    deadline.setFullYear(year + 1);
  }
  return deadline;
}

// ============================================================================
// Penalty Calculations
// ============================================================================

/**
 * Late filing penalty rates
 */
export const PENALTY_RATES = {
  lateFiling: CANONICAL_PENALTY_RATES.lateFiling, // 5% of tax due per month
  latePayment: CANONICAL_PENALTY_RATES.latePayment, // 10% of tax due per month
  underDeclaration: 0.25, // legacy UI helper only
  evasion: 3.0, // 300% of tax evaded + potential prosecution
} as const;

/**
 * Calculates late filing penalty
 */
export function calculateLatePenalty(
  taxDue: number,
  monthsLate: number
): number {
  return taxDue * PENALTY_RATES.lateFiling * monthsLate;
}

// ============================================================================
// Withholding Tax Rules
// ============================================================================

/**
 * Withholding tax rates by transaction type
 */
export const WHT_RATES = {
  dividend: CANONICAL_WHT_RATES.dividends,
  interest: CANONICAL_WHT_RATES.interest,
  rent: CANONICAL_WHT_RATES.rent,
  royalty: CANONICAL_WHT_RATES.royalties,
  consultancy: CANONICAL_WHT_RATES.consultancy,
  construction: CANONICAL_WHT_RATES.construction,
  contractServices: CANONICAL_WHT_RATES.contracts,
  professionalFees: CANONICAL_WHT_RATES.professional,
} as const;

/**
 * Calculates withholding tax
 */
export function calculateWHT(
  amount: number,
  type: keyof typeof WHT_RATES
): number {
  return amount * WHT_RATES[type];
}

// ============================================================================
// NRS/DigiTax Compliance Rules
// ============================================================================

/**
 * E-invoicing requirements (NRS/DigiTax mandate)
 */
export const E_INVOICE_REQUIREMENTS = {
  mandatoryFields: [
    'sellerTIN',
    'buyerTIN',
    'invoiceNumber',
    'issueDate',
    'totalAmount',
    'vatAmount',
    'lineItems',
  ],
  maxSubmissionDelay: 24, // 24 hours from issue
  requiredFormat: 'UBL 2.1',
  digitalSignatureRequired: true,
} as const;

/**
 * Validates if business must use e-invoicing
 */
export function requiresEInvoicing(annualTurnover: number): boolean {
  // E-invoicing mandatory for businesses with turnover above canonical threshold
  return annualTurnover > DIGITAL_TAX_THRESHOLD;
}

// ============================================================================
// Export All Rules
// ============================================================================

export const NIGERIA_TAX_RULES_2025 = {
  pitBrackets: PIT_BRACKETS,
  vatRate: VAT_RATE,
  vatExempt: VAT_EXEMPT_CATEGORIES,
  basicFoodItems: BASIC_FOOD_ITEMS,
  allowableDeductions: ALLOWABLE_DEDUCTIONS,
  smeThresholds: SME_THRESHOLDS,
  smeReliefs: SME_RELIEFS,
  deadlines: TAX_DEADLINES,
  penalties: PENALTY_RATES,
  whtRates: WHT_RATES,
  citTiers: CIT_TIERS,
  eInvoiceRequirements: E_INVOICE_REQUIREMENTS,
} as const;
