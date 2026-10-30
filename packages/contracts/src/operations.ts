import { z } from 'zod';

/**
 * Additive Phase 1 operation contract. Existing v1 schemas remain unchanged.
 * Unknown fields are stripped deliberately at the validation boundary; clients
 * must use schemaVersion to negotiate new operation payloads.
 */
export const OperationTypeSchema = z.enum([
  'crud', 'sync', 'payment', 'filing',
]);
export const OperationStatusSchema = z.enum([
  'pending', 'processing', 'retry_scheduled', 'acknowledged',
  'dead_letter', 'reconciling', 'resolved',
]);
export const OperationFailureClassSchema = z.enum([
  'retryable', 'terminal', 'ambiguous_external_outcome',
]);

export const OperationEnvelopeSchema = z.object({
  operationId: z.string().uuid(),
  idempotencyKey: z.string().min(16).max(200),
  operationType: OperationTypeSchema,
  schemaVersion: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export const OperationResultSchema = z.object({
  operationId: z.string().uuid(),
  status: OperationStatusSchema,
  acknowledgedAt: z.string().datetime().nullable(),
  retryAt: z.string().datetime().nullable(),
  errorCode: z.string().nullable(),
});

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.string(),
  requestId: z.string(),
  retryable: z.boolean(),
});

export type OperationType = z.infer<typeof OperationTypeSchema>;
export type OperationEnvelope = z.infer<typeof OperationEnvelopeSchema>;
export type OperationResult = z.infer<typeof OperationResultSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
