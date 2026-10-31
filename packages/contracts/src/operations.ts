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


const invoiceMoney = moneyAmount.max(9_999_999_999.99);
export const InvoiceCreateOperationPayloadSchema = z.object({
  action: z.literal('INVOICE_CREATE'),
  data: z.object({
    businessId: z.string().uuid(),
    customerName: z.string().trim().min(1).max(200),
    customerEmail: z.string().email().max(254).optional(),
    customerTIN: z.string().trim().min(1).max(32).optional(),
    customerPhone: z.string().trim().min(5).max(32).optional(),
    customerAddress: z.string().trim().min(1).max(500).optional(),
    items: z.array(z.object({
      description: z.string().trim().min(1).max(300),
      quantity: z.number().finite().positive().max(1_000_000),
      unitPrice: invoiceMoney,
    }).strict()).min(1).max(100),
    subtotal: invoiceMoney.refine((value) => value > 0, 'Subtotal must be positive'),
    vat: invoiceMoney,
    total: invoiceMoney.refine((value) => value > 0, 'Total must be positive'),
    dueDate: z.string().datetime({ offset: true }).optional(),
    template: z.enum(['professional', 'retail', 'service', 'wholesale']).default('professional'),
    notes: z.string().max(5000).optional(),
  }).strict().superRefine((data, ctx) => {
    const cents = (value: number) => Math.round(value * 100);
    const computedSubtotal = data.items.reduce(
      (sum, item) => sum + Math.round(item.quantity * cents(item.unitPrice)), 0,
    );
    if (computedSubtotal !== cents(data.subtotal)) {
      ctx.addIssue({ code: 'custom', path: ['subtotal'], message: 'Subtotal must equal the sum of line items' });
    }
    if (cents(data.subtotal) + cents(data.vat) !== cents(data.total)) {
      ctx.addIssue({ code: 'custom', path: ['total'], message: 'Total must equal subtotal plus explicitly supplied VAT' });
    }
  }),
}).strict();

export const ReceiptAttachOperationPayloadSchema = z.object({
  action: z.literal('RECEIPT_ATTACH'),
  data: z.object({
    receiptEvidenceId: z.string().uuid(),
    expenseId: z.string().uuid(),
  }).strict(),
}).strict();

/** Only these CRUD payloads are approved for durable offline replay. */
export const SupportedOfflineOperationPayloadSchema = z.discriminatedUnion('action', [
  ExpenseCreateOperationPayloadSchema,
  InvoiceCreateOperationPayloadSchema,
  ReceiptAttachOperationPayloadSchema,
]);

export const ApprovedOfflineOperationEnvelopeSchema = OperationEnvelopeSchema.extend({
  operationType: z.literal('crud'),
  schemaVersion: z.literal(1),
  payload: SupportedOfflineOperationPayloadSchema,
});

/** Editable financial/document fields shared by governed invoice routes. */
export const InvoiceDraftContentSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().email().max(254).nullable().optional(),
  customerTIN: z.string().trim().min(1).max(32).nullable().optional(),
  customerPhone: z.string().trim().min(5).max(32).nullable().optional(),
  customerAddress: z.string().trim().min(1).max(500).nullable().optional(),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(300),
    quantity: z.number().finite().positive().max(1_000_000),
    unitPrice: invoiceMoney,
    vatApplicable: z.boolean().optional(),
  }).strict()).min(1).max(100),
  subtotal: invoiceMoney.refine((value) => value > 0, 'Subtotal must be positive'),
  vat: invoiceMoney,
  total: invoiceMoney.refine((value) => value > 0, 'Total must be positive'),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  template: z.enum(['professional', 'retail', 'service', 'wholesale']),
  notes: z.string().max(5000).nullable().optional(),
}).strict().superRefine((data, ctx) => {
  const cents = (value: number) => Math.round(value * 100);
  const computedSubtotal = data.items.reduce(
    (sum, item) => sum + Math.round(item.quantity * cents(item.unitPrice)), 0,
  );
  if (computedSubtotal !== cents(data.subtotal)) {
    ctx.addIssue({ code: 'custom', path: ['subtotal'], message: 'Subtotal must equal the sum of line items' });
  }
  if (cents(data.subtotal) + cents(data.vat) !== cents(data.total)) {
    ctx.addIssue({ code: 'custom', path: ['total'], message: 'Total must equal subtotal plus explicitly supplied VAT' });
  }
});

export const InvoiceDraftUpdateRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  draft: InvoiceDraftContentSchema,
}).strict();

export const InvoiceLifecycleVersionRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();

export const InvoiceRejectRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(10).max(1000),
}).strict();

