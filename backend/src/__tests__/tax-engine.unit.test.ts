/**
 * Tax Engine Unit Tests — V13 Canonical API
 * Tests all 6 tax types using the canonical contracts API shapes
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
  it('should calculate tax for ₦2M income', () => {
    const result = calculatePIT({ grossIncome: 2_000_000 });
    expect(result.taxLiability).toBeGreaterThan(0);
    expect(result.effectiveRate).toBeGreaterThan(0);
    expect(result.effectiveRate).toBeLessThan(0.25);
  });

  it('should have zero tax for very low income (within 0% band)', () => {
    const result = calculatePIT({ grossIncome: 500_000 });
    expect(result.taxLiability).toBe(0);
  });

  it('should return zero RRA when no rent is paid', () => {
    const result = calculatePIT({ grossIncome: 5_000_000 });
    expect(result.rra).toBe(0);
  });

  it('should apply RRA when rent is paid (capped at ₦500k)', () => {
    const result = calculatePIT({ grossIncome: 5_000_000, rentPaid: 3_000_000 });
    expect(result.rra).toBe(500_000); // 20% of 3M = 600k, capped at 500k
  });

  it('should apply RRA at 20% when below cap', () => {
    const result = calculatePIT({ grossIncome: 5_000_000, rentPaid: 1_000_000 });
    expect(result.rra).toBe(200_000); // 20% of 1M
  });

  it('should include pension and NHF in result', () => {
    const result = calculatePIT({
      grossIncome: 5_000_000,
      pension: 400_000,
      nhf: 125_000,
    });
    expect(result.pension).toBe(400_000);
    expect(result.nhf).toBe(125_000);
  });

  it('should handle zero income', () => {
    const result = calculatePIT({ grossIncome: 0 });
    expect(result.taxLiability).toBe(0);
  });

  it('should never produce negative taxable income', () => {
    const result = calculatePIT({
      grossIncome: 1_000_000,
      pension: 500_000,
      nhf: 500_000,
    });
    expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
    expect(result.taxLiability).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// VAT — Value Added Tax
// =============================================================================

describe('calculateVAT', () => {
  it('should calculate VAT net payable', () => {
    const result = calculateVAT({ outputVAT: 100_000, inputVAT: 30_000 });
    expect(result.netPayable).toBe(70_000);
    expect(result.creditCarryover).toBe(0);
  });

  it('should apply credit balance', () => {
    const result = calculateVAT({ outputVAT: 100_000, inputVAT: 30_000, creditBalance: 20_000 });
    expect(result.netPayable).toBe(50_000);
    expect(result.creditApplied).toBe(20_000);
  });

  it('should carry over excess credit', () => {
    const result = calculateVAT({ outputVAT: 50_000, inputVAT: 30_000, creditBalance: 30_000 });
    expect(result.netPayable).toBe(0);
    expect(result.creditCarryover).toBe(10_000);
  });

  it('should handle zero output VAT', () => {
    const result = calculateVAT({ outputVAT: 0, inputVAT: 10_000 });
    expect(result.netPayable).toBe(0);
  });
});

// =============================================================================
// CIT — Company Income Tax
// =============================================================================

describe('calculateCIT', () => {
  it('should apply 0% for small companies (<₦100M turnover)', () => {
    const result = calculateCIT({ turnover: 80_000_000, taxableProfit: 10_000_000 });
    expect(result.rate).toBe(0);
    expect(result.citLiability).toBe(0);
    expect(result.band).toBe('small');
    expect(result.exempt).toBe(true);
  });

  it('should apply 30% for large companies (≥₦100M turnover)', () => {
    const result = calculateCIT({ turnover: 150_000_000, taxableProfit: 15_000_000 });
    expect(result.rate).toBe(0.30);
    expect(result.citLiability).toBe(4_500_000);
    expect(result.band).toBe('large');
    expect(result.exempt).toBe(false);
  });

  it('should handle zero profit', () => {
    const result = calculateCIT({ turnover: 150_000_000, taxableProfit: 0 });
    expect(result.citLiability).toBe(0);
  });

  it('should apply development levy when applicable', () => {
    const result = calculateCIT({ turnover: 150_000_000, taxableProfit: 10_000_000, devLevyApplies: true });
    expect(result.devLevy).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(result.citLiability);
  });

  it('should handle tax loss carryforward', () => {
    const result = calculateCIT({ turnover: 150_000_000, taxableProfit: 10_000_000, taxLossCarryforward: 5_000_000 });
    // Taxable profit reduced by carryforward
    expect(result.taxableProfit).toBe(5_000_000);
  });
});

// =============================================================================
// CGT — Capital Gains Tax
// =============================================================================

describe('calculateCGT', () => {
  it('should apply 10% on capital gains', () => {
    const result = calculateCGT({ proceeds: 10_000_000, costBasis: 6_000_000 });
    expect(result.cgtRate).toBe(0.10);
    expect(result.netGain).toBe(4_000_000);
    expect(result.cgtLiability).toBe(400_000);
  });

  it('should return 0 tax on losses', () => {
    const result = calculateCGT({ proceeds: 3_000_000, costBasis: 5_000_000 });
    expect(result.cgtLiability).toBe(0);
    expect(result.isLoss).toBe(true);
    expect(result.netGain).toBe(-2_000_000);
  });

  it('should include improvement costs in deductions', () => {
    const result = calculateCGT({ proceeds: 10_000_000, costBasis: 6_000_000, improvementCosts: 1_000_000 });
    expect(result.netGain).toBe(3_000_000);
    expect(result.cgtLiability).toBe(300_000);
  });

  it('should include disposal costs in deductions', () => {
    const result = calculateCGT({ proceeds: 10_000_000, costBasis: 6_000_000, disposalCosts: 500_000 });
    expect(result.netGain).toBe(3_500_000);
    expect(result.cgtLiability).toBe(350_000);
  });

  it('should handle zero proceeds', () => {
    const result = calculateCGT({ proceeds: 0, costBasis: 1_000_000 });
    expect(result.cgtLiability).toBe(0);
    expect(result.isLoss).toBe(true);
  });
});

// =============================================================================
// WHT — Withholding Tax
// =============================================================================

describe('calculateWHT', () => {
  it('should apply 10% for dividends', () => {
    const result = calculateWHT({ amount: 1_000_000, category: 'dividends' });
    expect(result.rate).toBe(0.10);
    expect(result.whtAmount).toBe(100_000);
    expect(result.netPayable).toBe(900_000);
  });

  it('should apply 5% for construction', () => {
    const result = calculateWHT({ amount: 1_000_000, category: 'construction' });
    expect(result.rate).toBe(0.05);
    expect(result.whtAmount).toBe(50_000);
  });

  it('should apply 10% for rent', () => {
    const result = calculateWHT({ amount: 1_000_000, category: 'rent' });
    expect(result.rate).toBe(0.10);
    expect(result.whtAmount).toBe(100_000);
  });

  it('should apply 10% for professional fees', () => {
    const result = calculateWHT({ amount: 1_000_000, category: 'professional' });
    expect(result.rate).toBe(0.10);
    expect(result.whtAmount).toBe(100_000);
  });

  it('should exempt when TIN present and within monthly limit', () => {
    const result = calculateWHT({ amount: 500_000, category: 'dividends', hasTIN: true, monthlyTotal: 1_000_000 });
    expect(result.exempt).toBe(true);
    expect(result.whtAmount).toBe(0);
  });

  it('should NOT exempt when monthly limit exceeded', () => {
    const result = calculateWHT({ amount: 500_000, category: 'dividends', hasTIN: true, monthlyTotal: 3_000_000 });
    expect(result.exempt).toBe(false);
    expect(result.whtAmount).toBe(50_000);
  });
});

// =============================================================================
// PAYE — Pay As You Earn
// =============================================================================

describe('calculatePAYE', () => {
  it('should calculate PAYE with pension and NHF deductions', () => {
    const result = calculatePAYE({ grossSalary: 500_000 });
    expect(result.grossIncome).toBe(500_000);
    expect(result.pensionContribution).toBe(40_000); // 8% of 500k
    expect(result.nhfContribution).toBe(12_500); // 2.5% of 500k
    expect(result.netPay).toBeLessThan(500_000);
  });

  it('should include allowances in gross income', () => {
    const result = calculatePAYE({
      grossSalary: 500_000,
      housingAllowance: 100_000,
      transportAllowance: 50_000,
    });
    expect(result.grossIncome).toBe(650_000);
    expect(result.totalAllowances).toBe(150_000);
  });

  it('should calculate pension on gross income', () => {
    const result = calculatePAYE({ grossSalary: 1_000_000 });
    expect(result.pensionContribution).toBe(80_000); // 8% of 1M
    expect(result.nhfContribution).toBe(25_000); // 2.5% of 1M
  });

  it('should produce breakdown of tax bands', () => {
    const result = calculatePAYE({ grossSalary: 500_000 });
    expect(result.breakdown).toBeDefined();
    expect(Array.isArray(result.breakdown)).toBe(true);
  });

  it('should handle zero salary', () => {
    const result = calculatePAYE({ grossSalary: 0 });
    expect(result.taxDue).toBe(0);
    expect(result.netPay).toBe(0);
  });
});

// =============================================================================
// Cross-Tax Consistency
// =============================================================================

describe('Cross-Tax Consistency', () => {
  it('should never produce negative tax amounts', () => {
    const pitResult = calculatePIT({ grossIncome: 100_000 });
    const vatResult = calculateVAT({ outputVAT: 0, inputVAT: 100_000 });
    const citResult = calculateCIT({ turnover: 50_000_000, taxableProfit: 0 });
    const cgtResult = calculateCGT({ proceeds: 100_000, costBasis: 200_000 });
    const payeResult = calculatePAYE({ grossSalary: 100_000 });

    expect(pitResult.taxLiability).toBeGreaterThanOrEqual(0);
    expect(vatResult.netPayable).toBeGreaterThanOrEqual(0);
    expect(citResult.citLiability).toBeGreaterThanOrEqual(0);
    expect(cgtResult.cgtLiability).toBeGreaterThanOrEqual(0);
    expect(payeResult.taxDue).toBeGreaterThanOrEqual(0);
  });
});
