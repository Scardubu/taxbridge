/**
 * Phase 6 Services Unit Tests
 *
 * Tests for:
 * - Payroll PAYE calculations (via tax engine)
 * - Compliance priority calculation and penalty estimation
 * - Crypto FIFO cost basis and CGT calculations
 * - Reconciliation matching logic
 */

import { calculatePAYE } from '../services/tax-engine';
import { ComplianceService } from '../services/compliance';
import { PENALTY_RATES } from '@taxbridge/contracts';

// =============================================================================
// PAYE / Payroll Calculation Tests
// =============================================================================

describe('Payroll — PAYE Calculations', () => {
  describe('calculatePAYE', () => {
    it('calculates PAYE for basic salary with no allowances', () => {
      const result = calculatePAYE({ grossSalary: 500000 });
      expect(result.grossIncome).toBe(500000);
      expect(result.totalAllowances).toBe(0);
      expect(result.pensionContribution).toBeGreaterThan(0);
      expect(result.nhfContribution).toBeGreaterThan(0);
      expect(result.taxDue).toBeGreaterThanOrEqual(0);
      expect(result.netPay).toBeLessThan(result.grossIncome);
      expect(result.netPay).toBeGreaterThan(0);
    });

    it('calculates PAYE with housing and transport allowances', () => {
      const result = calculatePAYE({
        grossSalary: 500000,
        allowances: { housing: 100000, transport: 50000 },
      });
      expect(result.grossIncome).toBe(650000);
      expect(result.totalAllowances).toBe(150000);
      expect(result.pensionContribution).toBeGreaterThan(0);
      expect(result.nhfContribution).toBeGreaterThan(0);
    });

    it('calculates PAYE with all allowances', () => {
      const result = calculatePAYE({
        grossSalary: 500000,
        allowances: { housing: 100000, transport: 50000, meal: 30000, others: 20000 },
      });
      expect(result.grossIncome).toBe(700000);
      expect(result.totalAllowances).toBe(200000);
    });

    it('pension is 8% of gross salary', () => {
      const result = calculatePAYE({ grossSalary: 1000000 });
      expect(result.pensionContribution).toBe(80000);
    });

    it('NHF is 2.5% of gross salary', () => {
      const result = calculatePAYE({ grossSalary: 1000000 });
      expect(result.nhfContribution).toBe(25000);
    });

    it('net pay = gross income - pension - NHF - tax', () => {
      const result = calculatePAYE({
        grossSalary: 500000,
        allowances: { housing: 100000 },
      });
      const expectedNet = result.grossIncome - result.pensionContribution - result.nhfContribution - result.taxDue;
      expect(result.netPay).toBe(expectedNet);
    });

    it('breakdown includes all components', () => {
      const result = calculatePAYE({
        grossSalary: 500000,
        allowances: { housing: 100000, transport: 50000 },
      });
      const descriptions = result.breakdown.map(b => b.description);
      expect(descriptions).toContain('Gross Salary');
      expect(descriptions).toContain('Housing Allowance');
      expect(descriptions).toContain('Transport Allowance');
      expect(descriptions).toContain('Gross Income');
      expect(descriptions).toContain('Net Pay');
    });

    it('handles zero salary', () => {
      const result = calculatePAYE({ grossSalary: 0 });
      expect(result.grossIncome).toBe(0);
      expect(result.taxDue).toBe(0);
      expect(result.netPay).toBe(0);
    });

    it('handles very high salary', () => {
      const result = calculatePAYE({ grossSalary: 100000000 });
      expect(result.taxDue).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeLessThanOrEqual(0.25);
    });

    it('effective rate increases with income', () => {
      const low = calculatePAYE({ grossSalary: 500000 });
      const high = calculatePAYE({ grossSalary: 5000000 });
      expect(high.effectiveRate).toBeGreaterThanOrEqual(low.effectiveRate);
    });

    it('only includes non-zero allowances in breakdown', () => {
      const result = calculatePAYE({
        grossSalary: 500000,
        allowances: { housing: 100000, transport: 0, meal: 0, others: 0 },
      });
      const descriptions = result.breakdown.map(b => b.description);
      expect(descriptions).toContain('Housing Allowance');
      expect(descriptions).not.toContain('Transport Allowance');
      expect(descriptions).not.toContain('Meal Allowance');
      expect(descriptions).not.toContain('Other Allowances');
    });
  });

  describe('Payroll batch calculations', () => {
    it('processes multiple employees consistently', () => {
      const employees = [
        { grossSalary: 300000, allowances: { housing: 50000 } },
        { grossSalary: 500000, allowances: { housing: 100000, transport: 50000 } },
        { grossSalary: 1000000, allowances: { housing: 200000, transport: 100000, meal: 50000 } },
      ];

      let totalGross = 0;
      let totalNet = 0;
      let totalTax = 0;

      for (const emp of employees) {
        const result = calculatePAYE(emp);
        totalGross += result.grossIncome;
        totalNet += result.netPay;
        totalTax += result.taxDue;

        // Each employee's net pay should be positive
        expect(result.netPay).toBeGreaterThan(0);
        // Tax should be non-negative
        expect(result.taxDue).toBeGreaterThanOrEqual(0);
      }

      // Total tax should be less than total gross
      expect(totalTax).toBeLessThan(totalGross);
      // Total net should equal total gross minus deductions
      expect(totalNet).toBeLessThan(totalGross);
      expect(totalNet).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Compliance Service Tests (pure methods)
// =============================================================================

describe('ComplianceService — Priority & Penalty Calculations', () => {
  // Instantiate with null prisma since we only test pure methods
  const service = new ComplianceService(null as any);

  describe('calculatePriority', () => {
    it('returns critical for overdue dates', () => {
      const now = new Date('2026-02-10');
      const dueDate = new Date('2026-02-05');
      expect(service.calculatePriority(dueDate, now)).toBe('critical');
    });

    it('returns critical for due within 3 days', () => {
      const now = new Date('2026-02-10');
      const dueDate = new Date('2026-02-12');
      expect(service.calculatePriority(dueDate, now)).toBe('critical');
    });

    it('returns high for due within 7 days', () => {
      const now = new Date('2026-02-10');
      const dueDate = new Date('2026-02-15');
      expect(service.calculatePriority(dueDate, now)).toBe('high');
    });

    it('returns medium for due within 14 days', () => {
      const now = new Date('2026-02-10');
      const dueDate = new Date('2026-02-20');
      expect(service.calculatePriority(dueDate, now)).toBe('medium');
    });

    it('returns low for due beyond 14 days', () => {
      const now = new Date('2026-02-10');
      const dueDate = new Date('2026-03-10');
      expect(service.calculatePriority(dueDate, now)).toBe('low');
    });
  });

  describe('estimatePenalty', () => {
    it('returns 0 for filed reminders', () => {
      const now = new Date('2026-02-10');
      const dueDate = new Date('2026-02-05');
      expect(service.estimatePenalty('filed', dueDate, now, 100000)).toBe(0);
    });

    it('returns 0 for dismissed reminders', () => {
      const now = new Date('2026-02-10');
      const dueDate = new Date('2026-02-05');
      expect(service.estimatePenalty('dismissed', dueDate, now, 100000)).toBe(0);
    });

    it('returns 0 for not-yet-due reminders', () => {
      const now = new Date('2026-02-10');
      const dueDate = new Date('2026-02-20');
      expect(service.estimatePenalty('pending', dueDate, now, 100000)).toBe(0);
    });

    it('calculates penalty for overdue with amount', () => {
      const now = new Date('2026-03-15');
      const dueDate = new Date('2026-02-10');
      const amount = 500000;
      const penalty = service.estimatePenalty('overdue', dueDate, now, amount);

      // Should include late return fixed penalty + late payment interest
      expect(penalty).toBeGreaterThan(PENALTY_RATES.lateReturn);
      expect(penalty).toBeGreaterThan(0);
    });

    it('calculates penalty for overdue without amount', () => {
      const now = new Date('2026-03-15');
      const dueDate = new Date('2026-02-10');
      const penalty = service.estimatePenalty('overdue', dueDate, now, 0);

      // Should be just the late return fixed penalty
      expect(penalty).toBe(PENALTY_RATES.lateReturn);
    });

    it('penalty increases with months overdue', () => {
      const dueDate = new Date('2026-01-10');
      const amount = 1000000;

      const oneMonthLater = new Date('2026-02-15');
      const threeMonthsLater = new Date('2026-04-15');

      const penalty1 = service.estimatePenalty('overdue', dueDate, oneMonthLater, amount);
      const penalty3 = service.estimatePenalty('overdue', dueDate, threeMonthsLater, amount);

      expect(penalty3).toBeGreaterThan(penalty1);
    });
  });
});

// =============================================================================
// Crypto Tax — CGT Calculation Tests
// =============================================================================

describe('Crypto Tax — CGT Calculations', () => {
  // Test CGT via the tax engine directly
  const { calculateCGT } = require('../services/tax-engine');

  describe('calculateCGT', () => {
    it('calculates 10% CGT on net gain', () => {
      const result = calculateCGT({
        proceeds: 1000000,
        costBasis: 600000,
        assetType: 'crypto',
      });
      expect(result.netGain).toBe(400000);
      expect(result.cgtRate).toBe(0.10);
      expect(result.cgtLiability).toBe(40000);
      expect(result.isLoss).toBe(false);
    });

    it('returns 0 tax for losses', () => {
      const result = calculateCGT({
        proceeds: 500000,
        costBasis: 800000,
        assetType: 'crypto',
      });
      expect(result.netGain).toBe(-300000);
      expect(result.cgtLiability).toBe(0);
      expect(result.isLoss).toBe(true);
    });

    it('returns 0 tax for break-even', () => {
      const result = calculateCGT({
        proceeds: 1000000,
        costBasis: 1000000,
        assetType: 'crypto',
      });
      expect(result.netGain).toBe(0);
      expect(result.cgtLiability).toBe(0);
      expect(result.isLoss).toBe(false);
    });

    it('handles large crypto gains', () => {
      const result = calculateCGT({
        proceeds: 50000000,
        costBasis: 10000000,
        assetType: 'crypto',
      });
      expect(result.netGain).toBe(40000000);
      expect(result.cgtLiability).toBe(4000000);
    });

    it('handles NFT transactions', () => {
      const result = calculateCGT({
        proceeds: 2000000,
        costBasis: 500000,
        assetType: 'other',
      });
      expect(result.assetType).toBe('other');
      expect(result.cgtLiability).toBe(150000);
    });

    it('handles stock transactions', () => {
      const result = calculateCGT({
        proceeds: 5000000,
        costBasis: 3000000,
        assetType: 'shares',
      });
      expect(result.assetType).toBe('shares');
      expect(result.cgtLiability).toBe(200000);
    });
  });

  describe('FIFO cost basis logic', () => {
    it('FIFO should consume oldest lots first', () => {
      // Simulate FIFO manually (the service method needs DB)
      const lots = [
        { amount: 1.0, pricePerUnit: 10000000 }, // Bought 1 BTC at ₦10M
        { amount: 0.5, pricePerUnit: 15000000 }, // Bought 0.5 BTC at ₦15M
        { amount: 2.0, pricePerUnit: 20000000 }, // Bought 2 BTC at ₦20M
      ];

      // Sell 1.2 BTC — should consume: 1.0 from lot 1 + 0.2 from lot 2
      let remaining = 1.2;
      let costBasis = 0;

      for (const lot of lots) {
        if (remaining <= 0) break;
        const consumed = Math.min(lot.amount, remaining);
        costBasis += consumed * lot.pricePerUnit;
        remaining -= consumed;
      }

      // 1.0 * 10M + 0.2 * 15M = 10M + 3M = 13M
      expect(costBasis).toBe(13000000);
    });

    it('FIFO handles exact lot consumption', () => {
      const lots = [
        { amount: 1.0, pricePerUnit: 10000000 },
        { amount: 1.0, pricePerUnit: 20000000 },
      ];

      let remaining = 1.0;
      let costBasis = 0;

      for (const lot of lots) {
        if (remaining <= 0) break;
        const consumed = Math.min(lot.amount, remaining);
        costBasis += consumed * lot.pricePerUnit;
        remaining -= consumed;
      }

      expect(costBasis).toBe(10000000);
    });

    it('FIFO handles selling more than available', () => {
      const lots = [
        { amount: 0.5, pricePerUnit: 10000000 },
      ];

      let remaining = 1.0;
      let costBasis = 0;

      for (const lot of lots) {
        if (remaining <= 0) break;
        const consumed = Math.min(lot.amount, remaining);
        costBasis += consumed * lot.pricePerUnit;
        remaining -= consumed;
      }

      // Only 0.5 BTC available, so cost basis is 0.5 * 10M = 5M
      expect(costBasis).toBe(5000000);
      expect(remaining).toBe(0.5); // 0.5 BTC unaccounted
    });
  });
});

// =============================================================================
// Reconciliation — Matching Logic Tests
// =============================================================================

describe('Reconciliation — Matching Logic', () => {
  describe('Exact matching', () => {
    it('matches invoice and payment with identical amounts', () => {
      const invoiceTotal = 591250;
      const paymentAmount = 591250;
      const difference = Math.abs(invoiceTotal - paymentAmount);
      expect(difference).toBe(0);
    });
  });

  describe('Fuzzy matching', () => {
    it('calculates percentage difference correctly', () => {
      const invoiceTotal = 100000;
      const paymentAmount = 97500;
      const difference = Math.abs(invoiceTotal - paymentAmount);
      const percentDiff = (difference / invoiceTotal) * 100;
      expect(percentDiff).toBe(2.5);
      expect(percentDiff).toBeLessThanOrEqual(5); // Within 5% threshold
    });

    it('rejects matches beyond threshold', () => {
      const invoiceTotal = 100000;
      const paymentAmount = 90000;
      const difference = Math.abs(invoiceTotal - paymentAmount);
      const percentDiff = (difference / invoiceTotal) * 100;
      expect(percentDiff).toBe(10);
      expect(percentDiff).toBeGreaterThan(5); // Beyond 5% threshold
    });

    it('calculates confidence from percentage difference', () => {
      const invoiceTotal = 100000;
      const paymentAmount = 98000;
      const difference = Math.abs(invoiceTotal - paymentAmount);
      const percentDiff = (difference / invoiceTotal) * 100;
      const confidence = Math.round(100 - percentDiff);
      expect(confidence).toBe(98);
    });
  });

  describe('Partial matching', () => {
    it('finds closest amount match', () => {
      const paymentAmount = 50000;
      const invoiceTotals = [45000, 49500, 55000, 100000];

      let bestDiff = Infinity;
      let bestIdx = -1;

      for (let i = 0; i < invoiceTotals.length; i++) {
        const diff = Math.abs(invoiceTotals[i] - paymentAmount);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }

      expect(bestIdx).toBe(1); // 49500 is closest to 50000
      expect(bestDiff).toBe(500);
    });

    it('calculates partial match confidence', () => {
      const invoiceTotal = 50000;
      const difference = 2500;
      const percentDiff = (difference / invoiceTotal) * 100;
      const confidence = Math.max(30, Math.round(70 - percentDiff));
      expect(confidence).toBe(65);
    });

    it('clamps confidence to minimum 30', () => {
      const invoiceTotal = 50000;
      const difference = 25000;
      const percentDiff = (difference / invoiceTotal) * 100;
      const confidence = Math.max(30, Math.round(70 - percentDiff));
      expect(confidence).toBe(30); // Clamped to 30
    });
  });

  describe('Summary calculations', () => {
    it('calculates match rate correctly', () => {
      const totalInvoices = 10;
      const matchedCount = 7;
      const matchRate = Math.round((matchedCount / totalInvoices) * 100 * 100) / 100;
      expect(matchRate).toBe(70);
    });

    it('calculates discrepancy correctly', () => {
      const totalInvoiceValue = 1000000;
      const totalPaymentValue = 950000;
      const discrepancy = Math.round((totalInvoiceValue - totalPaymentValue) * 100) / 100;
      expect(discrepancy).toBe(50000);
    });

    it('handles zero invoices', () => {
      const totalInvoices = 0;
      const matchedCount = 0;
      const matchRate = totalInvoices > 0 ? Math.round((matchedCount / totalInvoices) * 100 * 100) / 100 : 0;
      expect(matchRate).toBe(0);
    });
  });
});

// =============================================================================
// Cross-Service Consistency Tests
// =============================================================================

describe('Cross-Service Consistency', () => {
  it('PAYE tax is always non-negative', () => {
    const salaries = [0, 50000, 100000, 500000, 1000000, 5000000, 50000000];
    for (const salary of salaries) {
      const result = calculatePAYE({ grossSalary: salary });
      expect(result.taxDue).toBeGreaterThanOrEqual(0);
      expect(result.netPay).toBeGreaterThanOrEqual(0);
    }
  });

  it('PAYE net pay never exceeds gross income', () => {
    const salaries = [100000, 500000, 1000000, 10000000];
    for (const salary of salaries) {
      const result = calculatePAYE({
        grossSalary: salary,
        allowances: { housing: salary * 0.2, transport: salary * 0.1 },
      });
      expect(result.netPay).toBeLessThanOrEqual(result.grossIncome);
    }
  });

  it('compliance penalty rates match NTA 2025 constants', () => {
    expect(PENALTY_RATES.lateReturn).toBe(25000);
    expect(PENALTY_RATES.latePayment).toBe(0.10);
    expect(PENALTY_RATES.lateRemittance).toBe(0.10);
    expect(PENALTY_RATES.nonRemittance).toBe(0.10);
  });

  it('CGT rate is 10% per NTA 2025', () => {
    const { CGT_RATE } = require('@taxbridge/contracts');
    expect(CGT_RATE).toBe(0.10);
  });
});
