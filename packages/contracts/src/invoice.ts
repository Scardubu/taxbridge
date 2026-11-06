/**
 * Shared invoice arithmetic.
 *
 * This is the canonical invoice-total implementation for backend, mobile and
 * admin consumers. Keep rounding behavior stable: VAT is rounded to two
 * decimal places, then added to the exact subtotal and rounded to two places.
 */
import { VAT_RATE } from './constants';

export interface InvoiceLineItem {
  quantity: number;
  unitPrice: number;
}

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  total: number;
}

export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  vatRate: number = VAT_RATE,
): InvoiceTotals {
  if (!Array.isArray(items)) {
    throw new TypeError('Invoice items must be an array');
  }
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 1) {
    throw new RangeError('VAT rate must be a finite value between 0 and 1');
  }

  const subtotal = items.reduce((sum, item) => {
    if (
      !item ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice < 0
    ) {
      throw new RangeError('Invoice line items require a positive quantity and non-negative finite unit price');
    }
    return sum + item.quantity * item.unitPrice;
  }, 0);

  if (!Number.isFinite(subtotal)) {
    throw new RangeError('Invoice subtotal is outside the supported numeric range');
  }

  const vat = Number((subtotal * vatRate).toFixed(2));
  const total = Number((subtotal + vat).toFixed(2));
  if (!Number.isFinite(vat) || !Number.isFinite(total)) {
    throw new RangeError('Invoice totals are outside the supported numeric range');
  }

  return { subtotal, vat, total };
}
