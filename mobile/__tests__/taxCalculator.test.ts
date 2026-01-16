/**
 * TaxBridge Tax Calculator Unit Tests
 * Nigeria Tax Act 2025 Compliance Tests
 * 
 * These tests validate the core tax calculation logic.
 */

import {
  calculatePIT,
  calculateRentRelief,
  calculateNHF,
  checkVATThreshold,
  checkCITRate,
  calculateDeductions,
  formatNaira,
  PIT_BANDS,
} from '../src/utils/taxCalculator';

describe('Tax Calculator - Nigeria Tax Act 2025', () => {
  describe('PIT Bands Configuration', () => {
    it('should have 6 tax bands', () => {
      expect(PIT_BANDS).toHaveLength(6);
    });

    it('should have correct band limits', () => {
      expect(PIT_BANDS[0].limit).toBe(800_000);
      expect(PIT_BANDS[1].limit).toBe(3_000_000);
      expect(PIT_BANDS[2].limit).toBe(12_000_000);
      expect(PIT_BANDS[3].limit).toBe(25_000_000);
      expect(PIT_BANDS[4].limit).toBe(50_000_000);
      expect(PIT_BANDS[5].limit).toBe(Infinity);
    });

    it('should have correct rates', () => {
      expect(PIT_BANDS[0].rate).toBe(0);
      expect(PIT_BANDS[1].rate).toBe(0.15);
      expect(PIT_BANDS[2].rate).toBe(0.18);
      expect(PIT_BANDS[3].rate).toBe(0.21);
      expect(PIT_BANDS[4].rate).toBe(0.23);
      expect(PIT_BANDS[5].rate).toBe(0.25);
    });
  });

  describe('calculatePIT', () => {
    it('should return zero tax for income below ₦800k (exempt)', () => {
      const result = calculatePIT(500_000);
      expect(result.estimatedTax).toBe(0);
      expect(result.isExempt).toBe(true);
      expect(result.effectiveRate).toBe(0);
    });

    it('should return zero tax for exactly ₦800k (exempt threshold)', () => {
      const result = calculatePIT(800_000);
      expect(result.estimatedTax).toBe(0);
      expect(result.isExempt).toBe(true);
    });

    it('should calculate tax correctly for ₦1M (₦30k tax)', () => {
      // Income: ₦1,000,000
      // Band 1: ₦800,000 @ 0% = ₦0
      // Band 2: ₦200,000 @ 15% = ₦30,000
      // Total: ₦30,000
      const result = calculatePIT(1_000_000);
      expect(result.estimatedTax).toBe(30_000);
      expect(result.isExempt).toBe(false);
      expect(result.breakdown).toHaveLength(2);
    });

    it('should calculate tax correctly for ₦3M (₦330k tax)', () => {
      // Income: ₦3,000,000
      // Band 1: ₦800,000 @ 0% = ₦0
      // Band 2: ₦2,200,000 @ 15% = ₦330,000
      // Total: ₦330,000
      const result = calculatePIT(3_000_000);
      expect(result.estimatedTax).toBe(330_000);
      expect(result.breakdown).toHaveLength(2);
    });

    it('should calculate tax correctly for ₦5M (₦690k tax)', () => {
      // Income: ₦5,000,000
      // Band 1: ₦800,000 @ 0% = ₦0
      // Band 2: ₦2,200,000 @ 15% = ₦330,000
      // Band 3: ₦2,000,000 @ 18% = ₦360,000
      // Total: ₦690,000
      const result = calculatePIT(5_000_000);
      expect(result.estimatedTax).toBe(690_000);
      expect(result.breakdown).toHaveLength(3);
    });

    it('should calculate tax correctly for ₦12M (₦1.95M tax)', () => {
      // Income: ₦12,000,000
      // Band 1: ₦800,000 @ 0% = ₦0
      // Band 2: ₦2,200,000 @ 15% = ₦330,000
      // Band 3: ₦9,000,000 @ 18% = ₦1,620,000
      // Total: ₦1,950,000
      const result = calculatePIT(12_000_000);
      expect(result.estimatedTax).toBe(1_950_000);
      expect(result.breakdown).toHaveLength(3);
    });

    it('should calculate tax correctly for ₦25M', () => {
      // Income: ₦25,000,000
      // Band 1: ₦800,000 @ 0% = ₦0
      // Band 2: ₦2,200,000 @ 15% = ₦330,000
      // Band 3: ₦9,000,000 @ 18% = ₦1,620,000
      // Band 4: ₦13,000,000 @ 21% = ₦2,730,000
      // Total: ₦4,680,000
      const result = calculatePIT(25_000_000);
      expect(result.estimatedTax).toBe(4_680_000);
      expect(result.breakdown).toHaveLength(4);
    });

    it('should calculate tax correctly for ₦50M', () => {
      // Income: ₦50,000,000
      // Band 1-4: ₦4,680,000 (as above)
      // Band 5: ₦25,000,000 @ 23% = ₦5,750,000
      // Total: ₦10,430,000
      const result = calculatePIT(50_000_000);
      expect(result.estimatedTax).toBe(10_430_000);
      expect(result.breakdown).toHaveLength(5);
    });

    it('should calculate tax correctly for ₦100M (high earner)', () => {
      // Income: ₦100,000,000
      // Bands 1-5: ₦10,430,000
      // Band 6: ₦50,000,000 @ 25% = ₦12,500,000
      // Total: ₦22,930,000
      const result = calculatePIT(100_000_000);
      expect(result.estimatedTax).toBe(22_930_000);
      expect(result.breakdown).toHaveLength(6);
      expect(result.effectiveRate).toBeCloseTo(0.2293, 2);
    });

    it('should handle zero income', () => {
      const result = calculatePIT(0);
      expect(result.estimatedTax).toBe(0);
      expect(result.isExempt).toBe(true);
      expect(result.breakdown).toHaveLength(0);
    });

    it('should handle negative income', () => {
      const result = calculatePIT(-100_000);
      expect(result.estimatedTax).toBe(0);
      expect(result.isExempt).toBe(true);
    });

    it('should calculate effective rate correctly', () => {
      const result = calculatePIT(3_000_000);
      // Tax: ₦330,000 / Income: ₦3,000,000 = 11%
      expect(result.effectiveRate).toBeCloseTo(0.11, 2);
    });
  });

  describe('calculateRentRelief', () => {
    it('should return 0 for no rent', () => {
      expect(calculateRentRelief(0)).toBe(0);
    });

    it('should return 20% of rent when below ₦500k cap', () => {
      // 20% of ₦1,000,000 = ₦200,000 (below cap)
      expect(calculateRentRelief(1_000_000)).toBe(200_000);
    });

    it('should cap relief at ₦500k', () => {
      // 20% of ₦3,000,000 = ₦600,000, but capped at ₦500,000
      expect(calculateRentRelief(3_000_000)).toBe(500_000);
    });

    it('should return exactly ₦500k when 20% equals cap', () => {
      // 20% of ₦2,500,000 = ₦500,000
      expect(calculateRentRelief(2_500_000)).toBe(500_000);
    });

    it('should handle large rent values', () => {
      expect(calculateRentRelief(10_000_000)).toBe(500_000);
    });

    it('should handle negative rent', () => {
      expect(calculateRentRelief(-100_000)).toBe(0);
    });
  });

  describe('calculateNHF', () => {
    it('should return 2.5% of gross income', () => {
      expect(calculateNHF(1_000_000)).toBe(25_000);
      expect(calculateNHF(10_000_000)).toBe(250_000);
    });

    it('should handle zero income', () => {
      expect(calculateNHF(0)).toBe(0);
    });

    it('should handle decimal precision', () => {
      const result = calculateNHF(3_333_333);
      expect(result).toBeCloseTo(83_333.325, 2);
    });
  });

  describe('checkVATThreshold', () => {
    it('should return exempt for turnover below ₦80M', () => {
      const result = checkVATThreshold(50_000_000);
      expect(result.requiresRegistration).toBe(false);
      expect(result.status).toBe('Exempt from registration');
      expect(result.percentageOfThreshold).toBe(50);
    });

    it('should return approaching for turnover at 80-99%', () => {
      const result = checkVATThreshold(85_000_000);
      expect(result.requiresRegistration).toBe(false);
      expect(result.status).toBe('Approaching threshold');
    });

    it('should return mandatory for turnover at ₦100M', () => {
      const result = checkVATThreshold(100_000_000);
      expect(result.requiresRegistration).toBe(true);
      expect(result.status).toBe('Registration mandatory');
    });

    it('should return mandatory for turnover above ₦100M', () => {
      const result = checkVATThreshold(150_000_000);
      expect(result.requiresRegistration).toBe(true);
      expect(result.percentageOfThreshold).toBe(100); // Capped at 100%
    });

    it('should return correct threshold value', () => {
      const result = checkVATThreshold(50_000_000);
      expect(result.threshold).toBe(100_000_000);
    });

    it('should handle zero turnover', () => {
      const result = checkVATThreshold(0);
      expect(result.requiresRegistration).toBe(false);
      expect(result.percentageOfThreshold).toBe(0);
    });
  });

  describe('checkCITRate', () => {
    it('should return 0% for small companies (≤₦50M)', () => {
      const result = checkCITRate(30_000_000);
      expect(result.rate).toBe(0);
      expect(result.description).toContain('Small company');
    });

    it('should return 0% at exactly ₦50M', () => {
      const result = checkCITRate(50_000_000);
      expect(result.rate).toBe(0);
    });

    it('should return 20% for medium companies (₦50M-₦100M)', () => {
      const result = checkCITRate(75_000_000);
      expect(result.rate).toBe(0.20);
      expect(result.description).toContain('Medium company');
    });

    it('should return 20% at exactly ₦100M', () => {
      const result = checkCITRate(100_000_000);
      expect(result.rate).toBe(0.20);
    });

    it('should return 30% for large companies (>₦100M)', () => {
      const result = checkCITRate(150_000_000);
      expect(result.rate).toBe(0.30);
      expect(result.description).toContain('Standard CIT');
    });

    it('should handle zero turnover', () => {
      const result = checkCITRate(0);
      expect(result.rate).toBe(0);
    });

    it('should handle edge case at ₦50,000,001', () => {
      const result = checkCITRate(50_000_001);
      expect(result.rate).toBe(0.20);
    });

    it('should handle edge case at ₦100,000,001', () => {
      const result = checkCITRate(100_000_001);
      expect(result.rate).toBe(0.30);
    });
  });

  describe('calculateDeductions', () => {
    it('should calculate all deductions correctly', () => {
      const result = calculateDeductions({
        grossIncome: 5_000_000,
        annualRent: 1_200_000,
        pensionContribution: 400_000,
        nhisContribution: 50_000,
        lifeInsurance: 100_000,
      });

      expect(result.rentRelief).toBe(240_000); // 20% of ₦1.2M
      expect(result.nhf).toBe(125_000); // 2.5% of ₦5M
      expect(result.pension).toBe(400_000);
      expect(result.nhis).toBe(50_000);
      expect(result.lifeInsurance).toBe(100_000);
      expect(result.totalDeductions).toBe(915_000);
      expect(result.chargeableIncome).toBe(4_085_000);
    });

    it('should handle missing optional deductions', () => {
      const result = calculateDeductions({
        grossIncome: 3_000_000,
      });

      expect(result.rentRelief).toBe(0);
      expect(result.nhf).toBe(75_000);
      expect(result.pension).toBe(0);
      expect(result.nhis).toBe(0);
      expect(result.chargeableIncome).toBe(2_925_000);
    });

    it('should not return negative chargeable income', () => {
      const result = calculateDeductions({
        grossIncome: 100_000,
        annualRent: 2_500_000, // Relief would be ₦500k
        pensionContribution: 1_000_000,
      });

      expect(result.chargeableIncome).toBe(0);
    });
  });

  describe('formatNaira', () => {
    it('should format whole numbers', () => {
      expect(formatNaira(1_000_000)).toBe('₦1,000,000');
    });

    it('should format with decimals', () => {
      expect(formatNaira(1_234_567.89)).toBe('₦1,234,567.89');
    });

    it('should format zero', () => {
      expect(formatNaira(0)).toBe('₦0');
    });

    it('should format large numbers', () => {
      expect(formatNaira(100_000_000)).toBe('₦100,000,000');
    });
  });

  describe('Integration Tests', () => {
    it('should calculate full tax scenario for typical SME owner', () => {
      // Scenario: SME owner with ₦5M gross income, pays ₦1.2M rent, ₦400k pension
      const deductions = calculateDeductions({
        grossIncome: 5_000_000,
        annualRent: 1_200_000,
        pensionContribution: 400_000,
      });

      const pit = calculatePIT(deductions.chargeableIncome);

      // Verify deductions
      expect(deductions.chargeableIncome).toBeLessThan(5_000_000);

      // Verify tax is reasonable
      expect(pit.estimatedTax).toBeGreaterThan(0);
      expect(pit.effectiveRate).toBeLessThan(0.25); // Below top marginal rate
    });

    it('should calculate full tax scenario for market trader (low income)', () => {
      // Scenario: Market trader with ₦1.5M gross income, pays ₦300k rent
      const deductions = calculateDeductions({
        grossIncome: 1_500_000,
        annualRent: 300_000,
      });

      const pit = calculatePIT(deductions.chargeableIncome);

      // Should have very low or no tax
      expect(pit.estimatedTax).toBeLessThan(100_000);
    });

    it('should verify VAT + CIT for growing business', () => {
      const turnover = 80_000_000;

      const vat = checkVATThreshold(turnover);
      const cit = checkCITRate(turnover);

      // Approaching VAT threshold
      expect(vat.status).toBe('Approaching threshold');

      // Medium company CIT rate
      expect(cit.rate).toBe(0.20);
    });
  });
});
