/**
 * Backwards-compatible backend import surface.
 * Invoice totals are implemented and versioned in @taxbridge/contracts.
 */
export {
  calculateInvoiceTotals,
  type InvoiceLineItem,
  type InvoiceTotals,
} from '@taxbridge/contracts';
