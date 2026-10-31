import { ExpenseCreateOperationPayloadSchema, InvoiceCreateOperationPayloadSchema, ReceiptAttachOperationPayloadSchema, OperationEnvelopeSchema } from '@taxbridge/contracts';
import type { OperationEnvelope } from '@taxbridge/contracts';

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

/** Build a validated, stable-id offline invoice draft operation. */
export function createInvoiceOperationEnvelope(
  clientId: string,
  data: Record<string, unknown>,
  createdAt: string,
): OperationEnvelope {
  const payload = InvoiceCreateOperationPayloadSchema.parse({ action: 'INVOICE_CREATE', data });
  return OperationEnvelopeSchema.parse({
    operationId: clientId,
    idempotencyKey: clientId,
    operationType: 'crud',
    schemaVersion: 1,
    payload,
    createdAt,
  });
}

/** Build a validated operation to attach an already verified receipt to an expense. */
export function createReceiptAttachOperationEnvelope(
  clientId: string,
  data: { receiptEvidenceId: string; expenseId: string },
  createdAt: string,
): OperationEnvelope {
  const payload = ReceiptAttachOperationPayloadSchema.parse({ action: 'RECEIPT_ATTACH', data });
  return OperationEnvelopeSchema.parse({
    operationId: clientId,
    idempotencyKey: clientId,
    operationType: 'crud',
    schemaVersion: 1,
    payload,
    createdAt,
  });
}
