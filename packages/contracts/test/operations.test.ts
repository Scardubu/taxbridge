import { ExpenseCreateOperationPayloadSchema, InvoiceCreateOperationPayloadSchema, ReceiptAttachOperationPayloadSchema, OperationEnvelopeSchema } from '../src/operations';

describe('Phase 1C operation contracts', () => {
  const validPayload = {
    action: 'EXPENSE_CREATE',
    data: {
      businessId: '8f9b9d3a-8a4b-4f2a-9d20-3b5f14e8b7a1',
      amount: 1250.5,
      category: 'office-supplies',
      description: 'Printer paper',
      date: '2026-10-30T10:00:00.000Z',
      vatAmount: 0,
      vatEligible: false,
    },
  };

  it('accepts the shared expense-create payload', () => {
    expect(ExpenseCreateOperationPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects client-controlled actor, organization, or approval fields', () => {
    expect(ExpenseCreateOperationPayloadSchema.safeParse({
      ...validPayload,
      userId: 'attacker-controlled',
      organizationId: 'attacker-controlled',
      data: { ...validPayload.data, status: 'approved' },
    }).success).toBe(false);
  });

  it('rejects monetary precision that the Decimal(15,2) column cannot represent', () => {
    expect(ExpenseCreateOperationPayloadSchema.safeParse({
      ...validPayload,
      data: { ...validPayload.data, amount: 1.001 },
    }).success).toBe(false);
  });

  it('accepts the mobile envelope carrying the same validated payload', () => {
    expect(OperationEnvelopeSchema.safeParse({
      operationId: '8f9b9d3a-8a4b-4f2a-9d20-3b5f14e8b7a1',
      idempotencyKey: 'phase1c-client-operation-0001',
      operationType: 'crud',
      schemaVersion: 1,
      payload: validPayload,
      createdAt: '2026-10-30T10:00:00.000Z',
    }).success).toBe(true);
  });
});

describe('Phase 1C.2 invoice draft contract', () => {
  const invoice = {
    action: 'INVOICE_CREATE',
    data: {
      businessId: '8f9b9d3a-8a4b-4f2a-9d20-3b5f14e8b7a1',
      customerName: 'Example Customer',
      items: [{ description: 'Consulting', quantity: 2, unitPrice: 5000 }],
      subtotal: 10000,
      vat: 750,
      total: 10750,
      template: 'professional',
    },
  };

  it('accepts a valid invoice draft with explicit VAT', () => {
    expect(InvoiceCreateOperationPayloadSchema.safeParse(invoice).success).toBe(true);
  });

  it('rejects totals that do not reconcile to subtotal plus explicit VAT', () => {
    expect(InvoiceCreateOperationPayloadSchema.safeParse({
      ...invoice, data: { ...invoice.data, total: 11000 },
    }).success).toBe(false);
  });

  it('rejects a subtotal that does not equal the supplied line items', () => {
    expect(InvoiceCreateOperationPayloadSchema.safeParse({
      ...invoice, data: { ...invoice.data, subtotal: 9000 },
    }).success).toBe(false);
  });

  it('rejects client-controlled invoice status, identity and NRS fields', () => {
    expect(InvoiceCreateOperationPayloadSchema.safeParse({
      ...invoice, data: { ...invoice.data, status: 'stamped', userId: 'other', nrsIRN: 'fake' },
    }).success).toBe(false);
  });
});

describe('Phase 1C.3 receipt attachment contract', () => {
  const valid = {
    action: 'RECEIPT_ATTACH',
    data: {
      receiptEvidenceId: '8f9b9d3a-8a4b-4f2a-9d20-3b5f14e8b7a1',
      expenseId: '0f9b9d3a-8a4b-4f2a-9d20-3b5f14e8b7a1',
    },
  };
  it('accepts a receipt-to-expense attachment', () => {
    expect(ReceiptAttachOperationPayloadSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects caller-controlled storage keys and tenant identity', () => {
    expect(ReceiptAttachOperationPayloadSchema.safeParse({
      ...valid,
      data: { ...valid.data, storageKey: 'receipts/other-tenant/object', organizationId: 'other' },
    }).success).toBe(false);
  });
});
