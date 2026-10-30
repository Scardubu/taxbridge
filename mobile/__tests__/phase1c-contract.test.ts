import { createExpenseOperationEnvelope, createInvoiceOperationEnvelope } from '../services/operationEnvelope';

describe('Mobile Phase 1C operation envelope', () => {
  const clientId = '8f9b9d3a-8a4b-4f2a-9d20-3b5f14e8b7a1';
  const createdAt = '2026-10-30T10:00:00.000Z';
  const expense = {
    businessId: '0f9b9d3a-8a4b-4f2a-9d20-3b5f14e8b7a1',
    amount: 1250.5,
    category: 'office-supplies',
    description: 'Printer paper',
    date: '2026-10-30T10:00:00.000Z',
    vatAmount: 0,
    vatEligible: false,
  };

  it('builds the exact shared CRUD envelope with stable client idempotency', () => {
    const envelope = createExpenseOperationEnvelope(clientId, expense, createdAt);
    expect(envelope).toMatchObject({
      operationId: clientId,
      idempotencyKey: clientId,
      operationType: 'crud',
      schemaVersion: 1,
      payload: { action: 'EXPENSE_CREATE', data: expense },
      createdAt,
    });
  });

  it('rejects invalid expense data before network transmission', () => {
    expect(() => createExpenseOperationEnvelope(clientId, {
      ...expense,
      amount: 1.001,
    }, createdAt)).toThrow();
  });

  it('rejects non-UUID client IDs rather than generating unstable replacement IDs', () => {
    expect(() => createExpenseOperationEnvelope('not-a-uuid', expense, createdAt)).toThrow();
  });
});

describe('Mobile Phase 1C.2 invoice envelope', () => {
  const clientId = '8f9b9d3a-8a4b-4f2a-9d20-3b5f14e8b7a1';
  const createdAt = '2026-10-30T10:00:00.000Z';
  const invoice = {
    businessId: '0f9b9d3a-8a4b-4f2a-9d20-3b5f14e8b7a1',
    customerName: 'Example Customer',
    items: [{ description: 'Consulting', quantity: 2, unitPrice: 5000 }],
    subtotal: 10000,
    vat: 750,
    total: 10750,
    template: 'professional',
  };

  it('builds a stable CRUD envelope for an invoice draft', () => {
    expect(createInvoiceOperationEnvelope(clientId, invoice, createdAt)).toMatchObject({
      operationId: clientId,
      idempotencyKey: clientId,
      operationType: 'crud',
      schemaVersion: 1,
      payload: { action: 'INVOICE_CREATE', data: invoice },
    });
  });

  it('rejects inconsistent invoice totals before queue transmission', () => {
    expect(() => createInvoiceOperationEnvelope(clientId, { ...invoice, total: 9999 }, createdAt)).toThrow();
  });
});
