import { z } from 'zod';

/** Shared, versioned operation contracts consumed by backend and mobile. */
export const OperationTypeSchema = z.enum(['crud', 'sync', 'payment', 'filing']);
export const OperationStatusSchema = z.enum([
  'pending', 'processing', 'retry_scheduled', 'acknowledged',
  'dead_letter', 'reconciling', 'resolved',
]);
export const OperationFailureClassSchema = z.enum([
  'retryable', 'terminal', 'ambiguous_external_outcome',
]);

const moneyAmount = z.number()
  .finite()
  .min(0)
  .max(9_999_999_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, {
    message: 'Amount must have no more than two decimal places',
  });

export const ExpenseCreateOperationPayloadSchema = z.object({
  action: z.literal('EXPENSE_CREATE'),
  data: z.object({
    businessId: z.string().uuid(),
    amount: moneyAmount.refine((value) => value > 0, 'Amount must be positive'),
    category: z.enum([
      'office-supplies', 'travel', 'meals', 'utilities', 'rent', 'fuel',
      'maintenance', 'professional-services', 'telecommunications',
      'insurance', 'marketing', 'equipment', 'other',
    ]),
    description: z.string().trim().min(1).max(500),
    date: z.string().datetime({ offset: true }),
    vatAmount: moneyAmount,
    vatEligible: z.boolean(),
  }).strict(),
}).strict();

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
