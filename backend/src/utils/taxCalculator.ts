import { VAT_RATE } from '../lib/constants';

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
  vatRate: number = VAT_RATE
): InvoiceTotals {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vat = +(subtotal * vatRate).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);

  return { subtotal, vat, total };
}
