import { calculateInvoiceTotals } from '../src/invoice';

describe('calculateInvoiceTotals', () => {
  it('calculates VAT and total using the canonical seven-and-a-half percent rate', () => {
    expect(calculateInvoiceTotals([
      { quantity: 2, unitPrice: 100 },
    ])).toEqual({
      subtotal: 200,
      vat: 15,
      total: 215,
    });
  });

  it('supports custom VAT rates without changing shared defaults', () => {
    expect(calculateInvoiceTotals([
      { quantity: 1, unitPrice: 100 },
    ], 0)).toEqual({
      subtotal: 100,
      vat: 0,
      total: 100,
    });
  });

  it('returns zero totals for an empty line-item list', () => {
    expect(calculateInvoiceTotals([])).toEqual({
      subtotal: 0,
      vat: 0,
      total: 0,
    });
  });

  it('rounds VAT to two decimal places before calculating the total', () => {
    expect(calculateInvoiceTotals([
      { quantity: 1, unitPrice: 1 },
    ])).toEqual({
      subtotal: 1,
      vat: 0.08,
      total: 1.08,
    });
  });

  it('rejects non-positive or non-finite quantities', () => {
    expect(() => calculateInvoiceTotals([{ quantity: 0, unitPrice: 100 }])).toThrow(RangeError);
    expect(() => calculateInvoiceTotals([{ quantity: Number.NaN, unitPrice: 100 }])).toThrow(RangeError);
  });

  it('rejects negative or non-finite unit prices', () => {
    expect(() => calculateInvoiceTotals([{ quantity: 1, unitPrice: -1 }])).toThrow(RangeError);
    expect(() => calculateInvoiceTotals([{ quantity: 1, unitPrice: Number.POSITIVE_INFINITY }])).toThrow(RangeError);
  });

  it('rejects VAT rates outside the supported range', () => {
    expect(() => calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], -0.01)).toThrow(RangeError);
    expect(() => calculateInvoiceTotals([{ quantity: 1, unitPrice: 100 }], 1.01)).toThrow(RangeError);
  });
});
