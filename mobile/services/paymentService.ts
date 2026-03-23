import { apiRequest } from './api';
import { logComplianceEvent } from './complianceEventService';
import { getDatabase } from './database';

export type PaymentGateway = 'paystack' | 'flutterwave' | 'remita';

export interface InitializePaymentInput {
  invoiceId?: string;
  taxRecordId?: string;
  gateway: PaymentGateway;
  amountNGN: number;
  email: string;
  callbackUrl?: string;
}

export interface InitializePaymentResponse {
  paymentId?: string;
  reference: string;
  authorizationUrl?: string;
  accessCode?: string;
  gateway: PaymentGateway;
  amount: number;
  remitaRrr?: string;
  status: string;
}

export async function initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResponse> {
  const response = await apiRequest<InitializePaymentResponse>('/api/v1/payments/initialize', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      amount: input.amountNGN,
    }),
  });

  if (input.gateway === 'remita' && response.remitaRrr) {
    const db = await getDatabase();
    const numericTaxRecordId = input.taxRecordId && /^\d+$/.test(input.taxRecordId)
      ? Number(input.taxRecordId)
      : null;

    await db.runAsync(
      `INSERT INTO tax_payments (
         server_id, tax_record_id, provider, provider_ref, remita_rrr, amount, currency, status
       ) VALUES (?, ?, 'remita', ?, ?, ?, 'NGN', ?)` ,
      [
        response.paymentId ?? null,
        numericTaxRecordId,
        response.reference,
        response.remitaRrr,
        input.amountNGN,
        response.status,
      ]
    );
  }

  await logComplianceEvent('tax_payment_initiated', `Payment initiated via ${input.gateway}`, 'info', {
    gateway: input.gateway,
    amount: input.amountNGN,
    reference: response.reference,
    remitaRrr: response.remitaRrr,
  }).catch(() => undefined);

  return response;
}

export async function verifyPayment(reference: string) {
  return apiRequest('/api/v1/payments/verify/' + reference, {
    method: 'GET',
  });
}
