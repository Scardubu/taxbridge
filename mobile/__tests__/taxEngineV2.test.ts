import { computeTaxEngine } from '../services/taxEngine';
import type { TaxEngineInput } from '../types/taxEngine';

const baseInput: TaxEngineInput = {
  businessType: 'company',
  sector: 'retail',
  annualTurnover: 60_000_000,
  annualProfit: 12_000_000,
  employeeCount: 4,
  tinVerified: true,
  vatRegistered: true,
  businessName: 'TaxBridge Foods',
  periodMonth: 3,
  periodYear: 2026,
  monthlySales: 5_000_000,
  monthlyPurchases: 1_000_000,
  vatInputCreditsNgn: 20_000,
  whtTransactions: [],
  eInvoiceCompliant: true,
  vatFiledMonthly: true,
  whtRemitted: true,
  citFiled: true,
};

describe('computeTaxEngine', () => {
  test('calculates VAT output, net payable, and next filing date', () => {
    const result = computeTaxEngine(baseInput);

    expect(result.vatRequired).toBe(true);
    expect(result.vatOutputNgn).toBe(375_000);
    expect(result.vatNetPayableNgn).toBe(355_000);
    expect(result.vatNilReturn).toBe(false);
    expect(result.vatFilingDueDate).toBe('2026-04-21');
    expect(result.nextFilingType).toBe('vat_return');
    expect(result.nextFilingDate).toBe('2026-04-21');
  });

  test('marks VAT nil return when input credits offset output VAT', () => {
    const result = computeTaxEngine({
      ...baseInput,
      monthlySales: 100_000,
      vatInputCreditsNgn: 9_000,
    });

    expect(result.vatOutputNgn).toBe(7_500);
    expect(result.vatNetPayableNgn).toBe(0);
    expect(result.vatNilReturn).toBe(true);
  });

  test('applies CIT band thresholds correctly', () => {
    const small = computeTaxEngine({
      ...baseInput,
      annualTurnover: 25_000_000,
      annualProfit: 5_000_000,
      vatRegistered: false,
      monthlySales: 0,
      vatInputCreditsNgn: 0,
    });
    const medium = computeTaxEngine({
      ...baseInput,
      annualTurnover: 25_000_001,
      annualProfit: 5_000_000,
    });
    const large = computeTaxEngine({
      ...baseInput,
      annualTurnover: 100_000_001,
      annualProfit: 10_000_000,
    });

    expect(small.citBand).toBe('small');
    expect(small.citRate).toBe(0);
    expect(small.citEstimatedNgn).toBe(0);

    expect(medium.citBand).toBe('medium');
    expect(medium.citRate).toBe(0.2);
    expect(medium.citEstimatedNgn).toBe(1_000_000);

    expect(large.citBand).toBe('large');
    expect(large.citRate).toBe(0.3);
    expect(large.citEstimatedNgn).toBe(3_000_000);
  });

  test('produces WHT breakdown totals from configured rates', () => {
    const result = computeTaxEngine({
      ...baseInput,
      whtTransactions: [
        { type: 'consulting', amountNgn: 400_000 },
        { type: 'royalty', amountNgn: 200_000 },
      ],
    });

    expect(result.whtBreakdown).toEqual([
      { type: 'consulting', rate: 0.05, amountNgn: 400_000, whtNgn: 20_000 },
      { type: 'royalty', rate: 0.15, amountNgn: 200_000, whtNgn: 30_000 },
    ]);
    expect(result.whtTotalNgn).toBe(50_000);
  });

  test('derives e-invoicing phase and compliance score from filing status', () => {
    const result = computeTaxEngine({
      ...baseInput,
      annualTurnover: 1_500_000_000,
      eInvoiceCompliant: false,
      vatFiledMonthly: false,
      whtRemitted: false,
      citFiled: false,
    });

    expect(result.eInvoicePhase).toBe('large');
    expect(result.eInvoiceEnforcementDate).toBe('2026-04-01');
    expect(result.complianceScore).toBe(40);
    expect(result.scoreBrackets.find((entry) => entry.factor === 'tin_verified')?.earned).toBe(20);
    expect(result.scoreBrackets.find((entry) => entry.factor === 'e_invoice_compliant')?.earned).toBe(0);
  });
});
