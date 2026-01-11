import { sendSMS } from '../integrations/comms/client';

export async function notifyInvoiceStamped(phone: string, invoiceId: string, nrsRef: string) {
  if (!phone) return;
  const msg = `TaxBridge: Invoice ${invoiceId.slice(0, 8)} stamped! Ref: ${nrsRef}. Details at taxbridge.ng`;
  await sendSMS(phone, msg);
}

export async function notifyPaymentConfirmed(phone: string, amount: number, rrr: string) {
  if (!phone) return;
  const msg = `TaxBridge: Payment ₦${amount} confirmed (RRR: ${rrr}). Compliant!`;
  await sendSMS(phone, msg);
}

export async function notifyFilingDeadline(phone: string, deadline: string) {
  if (!phone) return;
  const msg = `Reminder: Tax deadline ${deadline}. File via taxbridge.ng or contact support.`;
  await sendSMS(phone, msg);
}

export default { notifyInvoiceStamped, notifyPaymentConfirmed, notifyFilingDeadline };
