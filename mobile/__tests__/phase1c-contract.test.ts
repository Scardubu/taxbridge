import { ExpenseCreateOperationPayloadSchema } from '@taxbridge/contracts';

describe('Mobile Phase 1C expense operation contract', () => {
  it('accepts the exact backend handler payload shape', () => {
    expect(ExpenseCreateOperationPayloadSchema.parse({
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
    }).action).toBe('EXPENSE_CREATE');
  });

  it('rejects unsupported legacy action payloads as expense operations', () => {
    expect(ExpenseCreateOperationPayloadSchema.safeParse({
      action: 'TIN_VERIFY',
      data: { tin: '12345678-0001' },
    }).success).toBe(false);
  });
});
