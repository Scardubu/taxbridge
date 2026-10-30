import { ExpenseCreateOperationPayloadSchema, OperationEnvelopeSchema, OperationEnvelope } from '@taxbridge/contracts';

/** Build the only CRUD operation currently approved for offline execution. */
export function createExpenseOperationEnvelope(
  clientId: string,
  data: Record<string, unknown>,
  createdAt: string,
): OperationEnvelope {
  const payload = ExpenseCreateOperationPayloadSchema.parse({
    action: 'EXPENSE_CREATE',
    data,
  });
  return OperationEnvelopeSchema.parse({
    operationId: clientId,
    idempotencyKey: clientId,
    operationType: 'crud',
    schemaVersion: 1,
    payload,
    createdAt,
  });
}
