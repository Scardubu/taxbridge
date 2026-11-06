import { apiRequest } from './api';
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

export interface InitializePaymentResponse {
  rrr: string;
  paymentUrl: string | null;
  gateway: PaymentGateway;
  amount: number;
}

export async function initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResponse> {
  if (input.idempotencyKey.trim().length < 16 || input.idempotencyKey.length > 200) {
    throw new Error('A stable payment idempotency key is required');
  }

  const { idempotencyKey, ...paymentRequest } = input;
  const response = await apiRequest<InitializePaymentResponse>('/api/v1/payments/generate', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(paymentRequest),
  });

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO tax_payments (
       provider, provider_ref, remita_rrr, amount, currency, status
     ) VALUES (?, ?, ?, ?, 'NGN', 'pending')`,
    [
      response.gateway,
      response.rrr,
      response.gateway === 'remita' ? response.rrr : null,
      response.amount,
    ]
  );

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

export async function markPaymentConfirmed(remitaRrr: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE tax_payments
     SET status = 'successful', completed_at = datetime('now')
     WHERE remita_rrr = ? OR provider_ref = ?`,
    [remitaRrr, remitaRrr]
  );
}
