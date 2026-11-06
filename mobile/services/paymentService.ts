import { apiRequest, initiatePayment as initiateInvoicePayment } from './api';
import { logComplianceEvent } from './complianceEventService';
import { getDatabase } from './database';

export type PaymentGateway = 'paystack' | 'flutterwave' | 'remita';

export interface InitializePaymentInput {
  invoiceId: string;
  idempotencyKey: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  gateway: PaymentGateway;
  callbackUrl?: string;
}

export type InitializePaymentResponse = Awaited<ReturnType<typeof initiateInvoicePayment>>;

/**
 * Thin domain wrapper around the canonical API helper. Local persistence
 * happens in one place (api.ts), so callers cannot create duplicate SQLite
 * payment rows by using different service entry points.
 */
export async function initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResponse> {
  const { idempotencyKey, ...paymentRequest } = input;
  const response = await initiateInvoicePayment({
    ...paymentRequest,
    idempotency_key: idempotencyKey,
  });

  await logComplianceEvent('tax_payment_initiated', 'Invoice payment initiated via ' + input.gateway, 'info', {
    gateway: response.gateway,
    invoiceId: input.invoiceId,
    amount: response.amount,
    reference: response.rrr,
  }).catch(() => undefined);

  return response;
}

/** Fetch the server-authoritative payment status for an invoice. */
export async function verifyPayment(invoiceId: string) {
  return apiRequest('/api/v1/payments/' + encodeURIComponent(invoiceId) + '/status', {
    method: 'GET',
  });
}

export async function markPaymentConfirmed(reference: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE tax_payments
     SET status = 'successful', completed_at = datetime('now')
     WHERE remita_rrr = ? OR provider_ref = ?`,
    [reference, reference]
  );
}
