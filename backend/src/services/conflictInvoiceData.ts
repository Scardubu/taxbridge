import { z } from 'zod';
import { MAX_INVOICE_AMOUNT } from '../lib/constants';
import { calculateInvoiceTotals } from '../utils/taxCalculator';

const InvoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().finite().positive().max(1_000_000),
  unitPrice: z.number().finite().nonnegative().max(MAX_INVOICE_AMOUNT),
  vatApplicable: z.boolean().optional(),
}).strict();

const SuppliedAmountSchema = z.union([
  z.number().finite().nonnegative(),
  z.string().regex(/^\d+(?:\.\d{1,2})?$/),
]);

const EditableConflictDataSchema = z.object({
  customerName: z.string().trim().max(200).nullable().optional(),
  customerTIN: z.string().trim().max(64).nullable().optional(),
  customerEndpointId: z.string().trim().max(128).nullable().optional(),
  customerEmail: z.string().email().max(254).nullable().optional(),
  customerPhone: z.string().trim().max(32).nullable().optional(),
  customerAddress: z.string().trim().max(1000).nullable().optional(),
  items: z.array(InvoiceItemSchema).min(1).max(1000).optional(),
  subtotal: SuppliedAmountSchema.optional(),
  vat: SuppliedAmountSchema.optional(),
  total: SuppliedAmountSchema.optional(),
  dueDate: z.string().datetime().nullable().optional(),
  template: z.enum(['professional', 'retail', 'service', 'wholesale']).optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict();

const EDITABLE_KEYS = new Set(Object.keys(EditableConflictDataSchema.shape));

export type ConflictInvoiceDataMode = 'trusted_snapshot' | 'manual_merge';

export type ConflictInvoiceDataResult =
  | { success: true; data: Record<string, unknown>; changedFields: string[] }
  | { success: false; error: string };

function amountToNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.01;
}

/**
 * Project conflict payloads onto invoice-editable fields and calculate all
 * financial totals from line items through the canonical backend calculator.
 *
 * Trusted device/server snapshots may carry identifiers and server metadata;
 * these fields are projected away. Manually merged payloads must contain
 * only the documented editable fields.
 */
export function buildConflictInvoiceUpdate(
  value: unknown,
  mode: ConflictInvoiceDataMode,
): ConflictInvoiceDataResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { success: false, error: 'CONFLICT_DATA_MUST_BE_AN_OBJECT' };
  }

  const source = value as Record<string, unknown>;
  const unknownKeys = Object.keys(source).filter((key) => !EDITABLE_KEYS.has(key));
  if (mode === 'manual_merge' && unknownKeys.length > 0) {
    return {
      success: false,
      error: `UNSUPPORTED_MERGED_FIELDS: ${unknownKeys.sort().join(', ')}`,
    };
  }

  const candidate = Object.fromEntries(
    Object.entries(source).filter(([key]) => EDITABLE_KEYS.has(key)),
  );
  const parsed = EditableConflictDataSchema.safeParse(candidate);
  if (!parsed.success) {
    return { success: false, error: 'CONFLICT_DATA_VALIDATION_FAILED' };
  }

  const updateData: Record<string, unknown> = {};
  const data = parsed.data;

  for (const key of [
    'customerName',
    'customerTIN',
    'customerEndpointId',
    'customerEmail',
    'customerPhone',
    'customerAddress',
    'dueDate',
    'template',
    'notes',
  ] as const) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  if (data.items) {
    const totals = calculateInvoiceTotals(data.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })));

    if (
      !Number.isFinite(totals.subtotal) ||
      !Number.isFinite(totals.vat) ||
      !Number.isFinite(totals.total) ||
      totals.subtotal > MAX_INVOICE_AMOUNT ||
      totals.total > MAX_INVOICE_AMOUNT
    ) {
      return { success: false, error: 'CONFLICT_INVOICE_AMOUNT_OUT_OF_RANGE' };
    }

    const suppliedTotals = [
      ['subtotal', data.subtotal, totals.subtotal],
      ['vat', data.vat, totals.vat],
      ['total', data.total, totals.total],
    ] as const;
    for (const [field, supplied, calculated] of suppliedTotals) {
      if (supplied !== undefined && !approximatelyEqual(amountToNumber(supplied), calculated)) {
        return { success: false, error: `CONFLICT_${field.toUpperCase()}_DOES_NOT_MATCH_ITEMS` };
      }
    }

    updateData.items = data.items;
    updateData.subtotal = totals.subtotal.toFixed(2);
    updateData.vat = totals.vat.toFixed(2);
    updateData.total = totals.total.toFixed(2);
  } else if (data.subtotal !== undefined || data.vat !== undefined || data.total !== undefined) {
    return { success: false, error: 'CONFLICT_TOTALS_REQUIRE_LINE_ITEMS' };
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'CONFLICT_DATA_HAS_NO_EDITABLE_FIELDS' };
  }

  return { success: true, data: updateData, changedFields: Object.keys(updateData).sort() };
}
