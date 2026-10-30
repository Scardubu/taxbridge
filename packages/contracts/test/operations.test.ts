import { ExpenseCreateOperationPayloadSchema, OperationEnvelopeSchema } from '../src/operations';

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
