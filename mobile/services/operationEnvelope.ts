import { OperationEnvelopeSchema, type OperationEnvelope } from '@taxbridge/contracts';

/**
 * Convert a locally queued legacy operation into the shared server envelope.
 *
 * The durable server pipeline deliberately uses the generic sync category
 * until concrete domain handlers are approved. The original local operation
 * name stays in the payload as data; it is never interpreted as authority.
 */
export interface MobileOperationEnvelopeInput {
  operationId: string;
  idempotencyKey: string;
  clientOperationType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export function buildMobileOperationEnvelope(
  input: MobileOperationEnvelopeInput,
): OperationEnvelope {
  return OperationEnvelopeSchema.parse({
    operationId: input.operationId,
    idempotencyKey: input.idempotencyKey,
    operationType: 'sync',
    schemaVersion: 1,
    payload: {
      clientOperationType: input.clientOperationType,
      data: input.payload,
    },
    createdAt: input.createdAt,
  });
}
