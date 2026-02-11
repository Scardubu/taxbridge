/**
 * TaxBridge Backend Tax Engine — Unit Tests
 * 
 * Validates all 6 tax calculators against NTA 2025 rules:
 * PIT, VAT, CIT, CGT, WHT, PAYE
 */

import {
  calculatePIT,
  calculateVAT,
  calculateCIT,
  calculateCGT,
  calculateWHT,
  calculatePAYE,
} from '../services/tax-engine';

// =============================================================================
// PIT — Personal Income Tax
// =============================================================================

describe('calculatePIT', () => {
  it('should exempt minimum-wage earners (≤₦840,000)', () => {
    const result = calculatePIT({ grossIncome: 840_000 });
    expect(result.taxAmount).toBe(0);
    expect(result.isMinimumWageExempt).toBe(true);
    expect(result.netIncome).toBe(840_000);
    expect(result.breakdown).toHaveLength(0);
  });

  it('should exempt income below minimum wage', () => {
    const result = calculatePIT({ grossIncome: 500_000 });
    expect(result.taxAmount).toBe(0);
    expect(result.isMinimumWageExempt).toBe(true);
  });

  it('should calculate CRA correctly (higher of 1% or ₦200k + 20%)', () => {
    // For ₦5M: 1% = ₦50k, ₦200k + 20% = ₦1.2M → CRA = ₦1.2M
    const result = calculatePIT({ grossIncome: 5_000_000 });
    expect(result.reliefs.cra).toBe(1_200_000);
    expect(result.taxableIncome).toBe(3_800_000);
  });

  it('should apply progressive brackets on taxable income', () => {
    // ₦2M gross, CRA = max(20k, 200k + 400k) = 600k, taxable = 1.4M
    // Band 1: ₦800k @ 0% = 0
    // Band 2: ₦600k @ 15% = 90k
    const result = calculatePIT({ grossIncome: 2_000_000 });
    expect(result.taxableIncome).toBe(1_400_000);
    expect(result.taxAmount).toBe(90_000);
    expect(result.breakdown).toHaveLength(2);
  });

  it('should handle high income (₦100M)', () => {
    const result = calculatePIT({ grossIncome: 100_000_000 });
    expect(result.taxAmount).toBeGreaterThan(0);
    expect(result.effectiveRate).toBeLessThan(0.25);
    expect(result.netIncome).toBeLessThan(100_000_000);
    // Should use all 6 brackets
    expect(result.breakdown.length).toBeGreaterThanOrEqual(5);
  });

  it('should apply rent relief (capped at ₦500k)', () => {
    const result = calculatePIT({
      grossIncome: 5_000_000,
      reliefs: { annualRent: 3_000_000 },
    });
    // 20% of ₦3M = ₦600k, capped at ₦500k
    expect(result.reliefs.rentRelief).toBe(500_000);
  });

  it('should apply rent relief (20% when below cap)', () => {
    const result = calculatePIT({
      grossIncome: 5_000_000,
      reliefs: { annualRent: 1_000_000 },
    });
    // 20% of ₦1M = ₦200k (below ₦500k cap)
    expect(result.reliefs.rentRelief).toBe(200_000);
  });

  it('should include pension and NHF in reliefs', () => {
    const result = calculatePIT({
      grossIncome: 5_000_000,
      reliefs: { pension: 400_000, nhf: 125_000 },
    });
    expect(result.reliefs.pension).toBe(400_000);
    expect(result.reliefs.nhf).toBe(125_000);
    expect(result.totalReliefs).toBeGreaterThan(1_200_000); // CRA + pension + nhf
  });

  it('should allow disabling CRA', () => {
    const withCRA = calculatePIT({ grossIncome: 5_000_000 });
    const withoutCRA = calculatePIT({ grossIncome: 5_000_000, reliefs: { cra: false } });
    expect(withoutCRA.taxAmount).toBeGreaterThan(withCRA.taxAmount);
    expect(withoutCRA.reliefs.cra).toBe(0);
  });

  it('should handle zero income', () => {
    const result = calculatePIT({ grossIncome: 0 });
    expect(result.taxAmount).toBe(0);
    expect(result.isMinimumWageExempt).toBe(true);
  });

  it('should never produce negative taxable income', () => {
    const result = calculatePIT({
      grossIncome: 1_000_000,
      reliefs: { pension: 500_000, nhf: 500_000, lifeInsurance: 500_000 },
    });
    expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
    expect(result.taxAmount).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// VAT — Value Added Tax
// =============================================================================

describe('calculateVAT', () => {
  it('should apply 7.5% VAT on standard category', () => {
    const result = calculateVAT({ amount: 1_000_000 });
    expect(result.vatRate).toBe(0.075);
    expect(result.vatAmount).toBe(75_000);
    expect(result.totalAmount).toBe(1_075_000);
    expect(result.isExempt).toBe(false);
  });

  it('should apply 7.5% when category is "standard"', () => {
    const result = calculateVAT({ amount: 500_000, category: 'standard' });
    expect(result.vatAmount).toBe(37_500);
  });

  it('should exempt medical services', () => {
    const result = calculateVAT({ amount: 1_000_000, category: 'medical-services' });
    expect(result.vatRate).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.totalAmount).toBe(1_000_000);
    expect(result.isExempt).toBe(true);
  });

  it('should exempt basic food items', () => {
    const result = calculateVAT({ amount: 500_000, category: 'basic-food-items' });
    expect(result.isExempt).toBe(true);
    expect(result.vatAmount).toBe(0);
  });

  it('should exempt educational services', () => {
    const result = calculateVAT({ amount: 200_000, category: 'educational-services' });
    expect(result.isExempt).toBe(true);
  });

  it('should handle small amounts', () => {
    const result = calculateVAT({ amount: 100 });
    expect(result.vatAmount).toBe(7.5);
    expect(result.totalAmount).toBe(107.5);
  });
});

// =============================================================================
// CIT — Company Income Tax
// =============================================================================

describe('calculateCIT', () => {
  it('should return 0% for small companies (revenue ≤₦25M)', () => {
    const result = calculateCIT({ revenue: 20_000_000, expenses: 10_000_000 });
    expect(result.taxRate).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.profit).toBe(10_000_000);
    expect(result.netProfit).toBe(10_000_000);
  });

  it('should return 20% for medium companies (₦25M < revenue ≤₦100M)', () => {
    const result = calculateCIT({ revenue: 50_000_000, expenses: 30_000_000 });
    expect(result.taxRate).toBe(0.20);
    expect(result.profit).toBe(20_000_000);
    expect(result.taxAmount).toBe(4_000_000);
    expect(result.netProfit).toBe(16_000_000);
  });

  it('should return 30% for large companies (revenue >₦100M)', () => {
    const result = calculateCIT({ revenue: 200_000_000, expenses: 100_000_000 });
    expect(result.taxRate).toBe(0.30);
    expect(result.taxAmount).toBe(30_000_000);
  });

  it('should handle zero profit (expenses >= revenue)', () => {
    const result = calculateCIT({ revenue: 50_000_000, expenses: 60_000_000 });
    expect(result.profit).toBe(0);
    expect(result.taxAmount).toBe(0);
  });

  it('should handle boundary at ₦25M', () => {
    const atBoundary = calculateCIT({ revenue: 25_000_000, expenses: 5_000_000 });
    const aboveBoundary = calculateCIT({ revenue: 25_000_001, expenses: 5_000_000 });
    expect(atBoundary.taxRate).toBe(0);
    expect(aboveBoundary.taxRate).toBe(0.20);
  });

  it('should handle boundary at ₦100M', () => {
    const atBoundary = calculateCIT({ revenue: 100_000_000, expenses: 50_000_000 });
    const aboveBoundary = calculateCIT({ revenue: 100_000_001, expenses: 50_000_000 });
    expect(atBoundary.taxRate).toBe(0.20);
    expect(aboveBoundary.taxRate).toBe(0.30);
  });
});

// =============================================================================
// CGT — Capital Gains Tax
// =============================================================================

describe('calculateCGT', () => {
  it('should apply 10% on net gains', () => {
    const result = calculateCGT({
      proceeds: 10_000_000,
      costBasis: 6_000_000,
      assetType: 'property',
    });
    expect(result.netGain).toBe(4_000_000);
    expect(result.taxRate).toBe(0.10);
    expect(result.taxAmount).toBe(400_000);
    expect(result.isLoss).toBe(false);
  });

  it('should return zero tax on capital losses', () => {
    const result = calculateCGT({
      proceeds: 3_000_000,
      costBasis: 5_000_000,
      assetType: 'stocks',
    });
    expect(result.netGain).toBe(-2_000_000);
    expect(result.taxAmount).toBe(0);
    expect(result.isLoss).toBe(true);
  });

  it('should handle break-even (no gain, no loss)', () => {
    const result = calculateCGT({
      proceeds: 5_000_000,
      costBasis: 5_000_000,
      assetType: 'crypto',
    });
    expect(result.netGain).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.isLoss).toBe(true); // 0 gain treated as no taxable event
  });

  it('should handle crypto asset type', () => {
    const result = calculateCGT({
      proceeds: 2_000_000,
      costBasis: 1_000_000,
      assetType: 'crypto',
    });
    expect(result.taxAmount).toBe(100_000);
    expect(result.assetType).toBe('crypto');
  });
});

// =============================================================================
// WHT — Withholding Tax
// =============================================================================

describe('calculateWHT', () => {
  it('should apply 10% on dividends', () => {
    const result = calculateWHT({ amount: 1_000_000, type: 'dividend' });
    expect(result.rate).toBe(0.10);
    expect(result.whtAmount).toBe(100_000);
    expect(result.netAmount).toBe(900_000);
  });

  it('should apply 10% on rent', () => {
    const result = calculateWHT({ amount: 500_000, type: 'rent' });
    expect(result.whtAmount).toBe(50_000);
  });

  it('should apply 5% on construction', () => {
    const result = calculateWHT({ amount: 10_000_000, type: 'construction' });
    expect(result.rate).toBe(0.05);
    expect(result.whtAmount).toBe(500_000);
  });

  it('should apply 5% on contract services', () => {
    const result = calculateWHT({ amount: 2_000_000, type: 'contractServices' });
    expect(result.rate).toBe(0.05);
    expect(result.whtAmount).toBe(100_000);
  });

  it('should apply 10% on professional fees', () => {
    const result = calculateWHT({ amount: 3_000_000, type: 'professionalFees' });
    expect(result.rate).toBe(0.10);
    expect(result.whtAmount).toBe(300_000);
  });

  it('should throw on unknown WHT type', () => {
    expect(() => calculateWHT({ amount: 1_000_000, type: 'unknown' })).toThrow(
      /Unknown WHT type/,
    );
  });
});

// =============================================================================
// PAYE — Pay As You Earn
// =============================================================================

describe('calculatePAYE', () => {
  it('should calculate PAYE for basic salary', () => {
    const result = calculatePAYE({ grossSalary: 500_000 });
    expect(result.grossIncome).toBe(500_000);
    expect(result.pensionContribution).toBe(40_000); // 8% of ₦500k
    expect(result.nhfContribution).toBe(12_500); // 2.5% of ₦500k
    expect(result.taxDue).toBeGreaterThanOrEqual(0);
    expect(result.netPay).toBeLessThan(500_000);
  });

  it('should include allowances in gross income', () => {
    const result = calculatePAYE({
      grossSalary: 500_000,
      allowances: { housing: 100_000, transport: 50_000, meal: 30_000, others: 20_000 },
    });
    expect(result.grossIncome).toBe(700_000);
    expect(result.totalAllowances).toBe(200_000);
    // Pension is on gross salary only
    expect(result.pensionContribution).toBe(40_000);
  });

  it('should produce correct breakdown items', () => {
    const result = calculatePAYE({
      grossSalary: 500_000,
      allowances: { housing: 100_000 },
    });
    const descriptions = result.breakdown.map((b) => b.description);
    expect(descriptions).toContain('Gross Salary');
    expect(descriptions).toContain('Housing Allowance');
    expect(descriptions).toContain('Gross Income');
    expect(descriptions).toContain('Net Pay');
  });

  it('should ensure net pay = gross - pension - nhf - tax', () => {
    const result = calculatePAYE({ grossSalary: 1_000_000 });
    const expected = result.grossIncome - result.pensionContribution - result.nhfContribution - result.taxDue;
    expect(result.netPay).toBeCloseTo(expected, 0);
  });

  it('should handle zero allowances', () => {
    const result = calculatePAYE({ grossSalary: 300_000 });
    expect(result.totalAllowances).toBe(0);
    expect(result.grossIncome).toBe(300_000);
  });

  it('should handle high salary with all allowances', () => {
    const result = calculatePAYE({
      grossSalary: 5_000_000,
      allowances: { housing: 1_000_000, transport: 500_000, meal: 200_000, others: 300_000 },
    });
    expect(result.grossIncome).toBe(7_000_000);
    expect(result.taxDue).toBeGreaterThan(0);
    expect(result.effectiveRate).toBeGreaterThan(0);
    expect(result.effectiveRate).toBeLessThan(0.25);
  });
});

// =============================================================================
// Cross-tax consistency checks
// =============================================================================

describe('Cross-tax consistency', () => {
  it('PIT and PAYE should use same brackets (same tax on same taxable income)', () => {
    // PAYE auto-calculates pension (8%) and NHF (2.5%) from grossSalary
    const payeResult = calculatePAYE({ grossSalary: 3_000_000 });
    
    // PIT with explicit pension/nhf matching PAYE's calculations
    const pitResult = calculatePIT({
      grossIncome: 3_000_000,
      reliefs: {
        cra: true,
        pension: 3_000_000 * 0.08, // 8% = 240,000
        nhf: 3_000_000 * 0.025,     // 2.5% = 75,000
      },
    });
    
    // With same reliefs, taxable incomes should match
    expect(payeResult.taxableIncome).toBe(pitResult.taxableIncome);
    // And tax amounts should match
    expect(payeResult.taxDue).toBe(pitResult.taxAmount);
  });

  it('VAT exempt categories should produce zero VAT', () => {
    const exemptCategories = [
      'medical-services',
      'pharmaceuticals',
      'basic-food-items',
      'books-newspapers',
      'educational-services',
      'agricultural-products',
      'exported-goods',
    ];
    for (const category of exemptCategories) {
      const result = calculateVAT({ amount: 1_000_000, category });
      expect(result.vatAmount).toBe(0);
      expect(result.isExempt).toBe(true);
    }
  });
});
