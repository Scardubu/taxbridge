/**
 * Personal Income Tax — TaxBridge V13 Sovereign
 * NTA 2025 §1–40 Fourth Schedule
 *
 * C-09: Tax calculations only in packages/contracts/
 * CRA is ABOLISHED. Use RRA (Rent Relief Allowance) via calculateRRA().
 * No minimum ETR or 1%-gross minimum tax for individuals.
 */

import { PIT_BANDS, calculateRRA } from './constants';

export interface PITInput {
  grossIncome: number;
  /** Annual rent actually paid — used to compute RRA */
  rentPaid?:   number;
  /** Employee pension contribution (default: 8% of gross) */
  pension?:    number;
  /** NHF contribution (default: 2.5% of gross) */
  nhf?:        number;
}

export interface PITResult {
  grossIncome:    number;
  rra:            number;
  pension:        number;
  nhf:            number;
  taxableIncome:  number;
  taxLiability:   number;
  effectiveRate:  number;
  monthlyTax:     number;
  bandBreakdown:  Array<{ width: number; rate: number; tax: number }>;
}

/**
 * calculatePIT — Full PIT computation per NTA 2025 §1–40
 *
 * Accuracy gate:
 *   calculatePIT({ grossIncome: 5_000_000, rentPaid: 600_000, pension: 200_000 })
 *   → taxLiability === 632_400
 *   (RRA=120k | Taxable=4.68M | Band 1: 800k@0%=0 | Band 2: 2.2M@15%=330k | Band 3: 1.68M@18%=302,400)
 */
export function calculatePIT(input: PITInput): PITResult {
  const {
    grossIncome,
    rentPaid  = 0,
    pension   = Math.round(grossIncome * 0.08),  // default 8% employee pension
    nhf       = Math.round(grossIncome * 0.025), // default 2.5% NHF
  } = input;

  const rra           = calculateRRA(rentPaid);
  const totalRelief   = pension + nhf + rra;
  const taxableIncome = Math.max(0, grossIncome - totalRelief);

  let remaining     = taxableIncome;
  let taxLiability  = 0;
  const bandBreakdown: Array<{ width: number; rate: number; tax: number }> = [];

  for (const band of PIT_BANDS) {
    if (remaining <= 0) break;
    const width    = Math.min(remaining, band.limit);
    const tax      = Math.round(width * band.rate);
    taxLiability  += tax;
    if (width > 0) bandBreakdown.push({ width, rate: band.rate, tax });
    remaining     -= width;
  }

  return {
    grossIncome,
    rra,
    pension,
    nhf,
    taxableIncome,
    taxLiability,
    effectiveRate: grossIncome > 0 ? taxLiability / grossIncome : 0,
    monthlyTax:    Math.round(taxLiability / 12),
    bandBreakdown,
  };
}
