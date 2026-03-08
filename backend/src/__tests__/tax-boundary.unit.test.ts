/**
 * Tax Engine Boundary & Edge Case Tests — V13 Canonical
 *
 * Tests aligned with actual @taxbridge/contracts API:
 * - CIT: calculateCIT({ turnover, taxableProfit, devLevyApplies?, taxLossCarryforward? })
 *        → { citLiability, band, rate, taxableProfit, devLevy, total, exempt }
 * - PIT: calculatePIT({ grossIncome, rentPaid?, pension?, nhf? })
 *        → { grossIncome, rra, pension, nhf, taxableIncome, taxLiability, effectiveRate, monthlyTax, bandBreakdown }
 * - VAT: calculateVAT({ outputVAT, inputVAT, creditBalance? })
 *        → { outputVAT, inputVAT, creditApplied, netPayable, creditCarryover }
 * - VAT Transaction: calculateTransactionVAT(amount, inclusive?)
 *        → { net, vatAmount, total }
 * - PAYE: calculatePAYE({ grossSalary, ... })
 */

import {
  calculateCIT,
  calculatePIT,
  calculateVAT,
  calculateTransactionVAT,
  calculatePAYE,
  SMALL_CO_CIT_THRESHOLD,
  VAT_RATE,
} from '@taxbridge/contracts';

describe('CIT Boundary Tests (V13 2-tier system)', () => {
  describe('Tier boundaries', () => {
    it('should apply 0% (small) below ₦100M turnover', () => {
      const result = calculateCIT({ turnover: 99_999_999, taxableProfit: 10_000_000 });
      expect(result.rate).toBe(0);
      expect(result.band).toBe('small');
      expect(result.exempt).toBe(true);
      expect(result.citLiability).toBe(0);
    });

    it('should apply 30% (large) at exactly ₦100M turnover', () => {
      const result = calculateCIT({ turnover: 100_000_000, taxableProfit: 10_000_000 });
      expect(result.rate).toBe(0.30);
      expect(result.band).toBe('large');
      expect(result.exempt).toBe(false);
      expect(result.citLiability).toBe(3_000_000);
    });

    it('should apply 30% (large) above ₦100M turnover', () => {
      const result = calculateCIT({ turnover: 150_000_000, taxableProfit: 15_000_000 });
      expect(result.rate).toBe(0.30);
      expect(result.band).toBe('large');
      expect(result.citLiability).toBe(4_500_000);
    });

    it('should return zero CIT for small companies', () => {
      const result = calculateCIT({ turnover: 80_000_000, taxableProfit: 5_000_000 });
      expect(result.citLiability).toBe(0);
      expect(result.band).toBe('small');
      expect(result.total).toBe(0);
    });
  });

  describe('Development Levy (4%)', () => {
    it('should NOT apply dev levy when devLevyApplies is false (default)', () => {
      const result = calculateCIT({ turnover: 150_000_000, taxableProfit: 10_000_000 });
      expect(result.devLevy).toBe(0);
    });

    it('should apply 4% dev levy when devLevyApplies is true', () => {
      const result = calculateCIT({ turnover: 150_000_000, taxableProfit: 10_000_000, devLevyApplies: true });
      expect(result.devLevy).toBe(400_000); // 4% of 10M
    });

    it('should include dev levy in total', () => {
      const result = calculateCIT({ turnover: 150_000_000, taxableProfit: 10_000_000, devLevyApplies: true });
      expect(result.total).toBe(result.citLiability + result.devLevy);
    });

    it('should NOT apply dev levy for small companies', () => {
      const result = calculateCIT({ turnover: 50_000_000, taxableProfit: 5_000_000, devLevyApplies: true });
      expect(result.devLevy).toBe(0);
      expect(result.exempt).toBe(true);
    });
  });

  describe('Tax loss carryforward', () => {
    it('should reduce taxable profit by loss carryforward', () => {
      const result = calculateCIT({
        turnover: 150_000_000,
        taxableProfit: 10_000_000,
        taxLossCarryforward: 3_000_000,
      });
      expect(result.taxableProfit).toBe(7_000_000);
      expect(result.citLiability).toBe(2_100_000); // 30% of 7M
    });

    it('should not produce negative taxable profit', () => {
      const result = calculateCIT({
        turnover: 150_000_000,
        taxableProfit: 5_000_000,
        taxLossCarryforward: 10_000_000,
      });
      expect(result.taxableProfit).toBe(0);
      expect(result.citLiability).toBe(0);
    });
  });
});

describe('PIT Boundary Tests', () => {
  it('should compute tax with default pension and NHF', () => {
    const result = calculatePIT({ grossIncome: 5_000_000 });
    expect(result.pension).toBe(400_000); // 8% of 5M
    expect(result.nhf).toBe(125_000); // 2.5% of 5M
    expect(result.taxableIncome).toBeLessThan(result.grossIncome);
  });

  it('should apply RRA when rent is paid', () => {
    const result = calculatePIT({ grossIncome: 5_000_000, rentPaid: 600_000 });
    expect(result.rra).toBe(120_000); // 20% of 600k, capped at 500k
  });

  it('should cap RRA at ₦500,000', () => {
    const result = calculatePIT({ grossIncome: 10_000_000, rentPaid: 5_000_000 });
    expect(result.rra).toBe(500_000); // Capped
  });

  it('should produce band breakdown that sums to tax liability', () => {
    const result = calculatePIT({ grossIncome: 10_000_000 });
    const totalFromBreakdown = result.bandBreakdown.reduce((sum, b) => sum + b.tax, 0);
    expect(totalFromBreakdown).toBe(result.taxLiability);
  });

  it('should compute effective rate correctly', () => {
    const result = calculatePIT({ grossIncome: 5_000_000 });
    expect(result.effectiveRate).toBeCloseTo(result.taxLiability / result.grossIncome, 4);
  });

  it('should compute monthly tax as 1/12 of annual', () => {
    const result = calculatePIT({ grossIncome: 6_000_000 });
    expect(result.monthlyTax).toBe(Math.round(result.taxLiability / 12));
  });
});

describe('VAT Boundary Tests', () => {
  describe('VAT net payable calculation', () => {
    it('should compute net payable as output - input', () => {
      const result = calculateVAT({ outputVAT: 100_000, inputVAT: 30_000 });
      expect(result.netPayable).toBe(70_000);
    });

    it('should apply credit balance to reduce net payable', () => {
      const result = calculateVAT({ outputVAT: 100_000, inputVAT: 30_000, creditBalance: 20_000 });
      expect(result.creditApplied).toBe(20_000);
      expect(result.netPayable).toBe(50_000);
    });

    it('should carry over unused credit', () => {
      const result = calculateVAT({ outputVAT: 50_000, inputVAT: 30_000, creditBalance: 50_000 });
      // Gross = 50k - 30k = 20k, credit applied = 20k, carryover = 30k
      expect(result.creditApplied).toBe(20_000);
      expect(result.netPayable).toBe(0);
      expect(result.creditCarryover).toBe(30_000);
    });

    it('should never produce negative net payable', () => {
      const result = calculateVAT({ outputVAT: 30_000, inputVAT: 50_000 });
      expect(result.netPayable).toBe(0);
    });
  });

  describe('Transaction VAT calculation', () => {
    it('should apply 7.5% VAT on exclusive amount', () => {
      const result = calculateTransactionVAT(100_000, false);
      expect(result.vatAmount).toBe(7_500);
      expect(result.total).toBe(107_500);
      expect(result.net).toBe(100_000);
    });

    it('should extract VAT from inclusive amount', () => {
      const result = calculateTransactionVAT(107_500, true);
      expect(result.net).toBe(100_000);
      expect(result.vatAmount).toBe(7_500);
      expect(result.total).toBe(107_500);
    });

    it('should handle small amounts', () => {
      const result = calculateTransactionVAT(100, false);
      expect(result.vatAmount).toBe(8); // Rounded
      expect(result.total).toBe(108);
    });

    it('should handle large amounts', () => {
      const result = calculateTransactionVAT(1_000_000_000, false);
      expect(result.vatAmount).toBe(75_000_000);
      expect(result.total).toBe(1_075_000_000);
    });
  });
});

describe('PAYE Boundary Tests', () => {
  it('should calculate pension at 8% of gross income', () => {
    const result = calculatePAYE({ grossSalary: 1_000_000 });
    // Pension is 8% of grossIncome (grossSalary + allowances)
    expect(result.pensionContribution).toBe(80_000);
  });

  it('should calculate NHF at 2.5% of gross income', () => {
    const result = calculatePAYE({ grossSalary: 1_000_000 });
    // NHF is 2.5% of grossIncome
    expect(result.nhfContribution).toBe(25_000);
  });

  it('should compute taxable income after deductions', () => {
    const result = calculatePAYE({ grossSalary: 1_000_000 });
    expect(result.taxableIncome).toBe(result.grossIncome - result.totalDeductions);
  });

  it('should compute net pay correctly', () => {
    const result = calculatePAYE({ grossSalary: 1_000_000 });
    const expectedNet = result.grossIncome - result.totalDeductions - result.taxDue;
    expect(result.netPay).toBe(expectedNet);
  });

  it('should include allowances in gross income', () => {
    const result = calculatePAYE({
      grossSalary: 500_000,
      housingAllowance: 100_000,
      transportAllowance: 50_000,
    });
    expect(result.totalAllowances).toBe(150_000);
    expect(result.grossIncome).toBe(650_000);
  });
});

describe('Cross-boundary consistency', () => {
  it('should maintain consistency across CIT tier boundary', () => {
    const belowThreshold = calculateCIT({ turnover: SMALL_CO_CIT_THRESHOLD - 1, taxableProfit: 10_000_000 });
    const atThreshold = calculateCIT({ turnover: SMALL_CO_CIT_THRESHOLD, taxableProfit: 10_000_000 });

    expect(belowThreshold.band).toBe('small');
    expect(belowThreshold.exempt).toBe(true);
    expect(atThreshold.band).toBe('large');
    expect(atThreshold.exempt).toBe(false);
  });

  it('should never produce negative tax amounts in CIT', () => {
    const edgeCases = [
      { turnover: 0, taxableProfit: 0 },
      { turnover: 1, taxableProfit: 0 },
      { turnover: 150_000_000, taxableProfit: 0 },
      { turnover: 150_000_000, taxableProfit: -1_000_000 }, // Negative profit handled
    ];

    for (const input of edgeCases) {
      const result = calculateCIT(input);
      expect(result.citLiability).toBeGreaterThanOrEqual(0);
      expect(result.devLevy).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeGreaterThanOrEqual(0);
    }
  });

  it('should never produce negative tax amounts in PIT', () => {
    const edgeCases = [
      { grossIncome: 0 },
      { grossIncome: 1 },
      { grossIncome: 100_000 },
    ];

    for (const input of edgeCases) {
      const result = calculatePIT(input);
      expect(result.taxLiability).toBeGreaterThanOrEqual(0);
      expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
    }
  });
});
