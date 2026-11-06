import { buildConflictInvoiceUpdate } from '../services/conflictInvoiceData';

describe('buildConflictInvoiceUpdate', () => {
  it('projects trusted sync snapshots onto editable invoice fields only', () => {
    const result = buildConflictInvoiceUpdate({
      id: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      businessId: '00000000-0000-4000-8000-000000000003',
      version: 99,
      status: 'paid',
      nrsReference: 'NRS-TRUSTED-REFERENCE',
      nrsIRN: 'IRN-TRUSTED-REFERENCE',
      customerName: 'Acme Limited',
      items: [{ description: 'Consulting', quantity: 2, unitPrice: 100 }],
      subtotal: '200.00',
      vat: '15.00',
      total: '215.00',
    }, 'trusted_snapshot');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual(expect.objectContaining({
      customerName: 'Acme Limited',
      subtotal: '200.00',
      vat: '15.00',
      total: '215.00',
    }));
    for (const protectedField of [
      'id', 'userId', 'businessId', 'version', 'status',
      'nrsReference', 'nrsIRN',
    ]) {
      expect(result.data).not.toHaveProperty(protectedField);
    }
  });

  it('rejects protected fields in a manually merged resolution', () => {
    const result = buildConflictInvoiceUpdate({
      userId: '00000000-0000-4000-8000-000000000002',
      items: [{ description: 'Consulting', quantity: 2, unitPrice: 100 }],
    }, 'manual_merge');

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining('UNSUPPORTED_MERGED_FIELDS'),
    });
  });

  it('recalculates totals and rejects mismatched client-supplied totals', () => {
    const result = buildConflictInvoiceUpdate({
      items: [{ description: 'Consulting', quantity: 2, unitPrice: 100 }],
      subtotal: '200.00',
      vat: '30.00',
      total: '230.00',
    }, 'manual_merge');

    expect(result).toEqual({
      success: false,
      error: 'CONFLICT_VAT_DOES_NOT_MATCH_ITEMS',
    });
  });

  it('accepts the canonical VAT calculation for a manual merge', () => {
    const result = buildConflictInvoiceUpdate({
      items: [{ description: 'Consulting', quantity: 2, unitPrice: 100 }],
      subtotal: '200.00',
      vat: '15.00',
      total: '215.00',
      notes: 'Approved after reviewing the device conflict.',
    }, 'manual_merge');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      subtotal: '200.00',
      vat: '15.00',
      total: '215.00',
      notes: 'Approved after reviewing the device conflict.',
    });
  });

  it('rejects totals without corresponding line items', () => {
    expect(buildConflictInvoiceUpdate({
      subtotal: '200.00',
      vat: '15.00',
      total: '215.00',
    }, 'manual_merge')).toEqual({
      success: false,
      error: 'CONFLICT_TOTALS_REQUIRE_LINE_ITEMS',
    });
  });

  it('rejects line items that exceed the invoice amount ceiling', () => {
    const result = buildConflictInvoiceUpdate({
      items: [{ description: 'High value item', quantity: 2, unitPrice: 100_000_000 }],
    }, 'manual_merge');

    expect(result).toEqual({
      success: false,
      error: 'CONFLICT_INVOICE_AMOUNT_OUT_OF_RANGE',
    });
  });
});
