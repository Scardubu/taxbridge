import type { PrismaClient } from '@prisma/client';

export type VerifiedPaymentGateway = 'paystack' | 'flutterwave' | 'remita';
export type VerifiedPaymentSettlement =
  | 'updated'
  | 'already_paid'
  | 'not_found'
  | 'gateway_mismatch'
  | 'currency_mismatch'
  | 'amount_mismatch'
  | 'state_conflict';

interface SettleVerifiedPaymentInput {
  gateway: VerifiedPaymentGateway;
  reference: string;
  gatewayRef?: string;
  amountNgn: number;
  currency: string;
  channel?: string;
  paidAt?: Date;
  allowOverpayment?: boolean;
}

/**
 * A provider callback is not settlement authority. Call this only after the
 * provider's verify endpoint has confirmed the same transaction reference.
 * The conditional payment update and invoice transition are atomic and safe
 * under webhook retries or concurrent deliveries.
 */
export async function settleVerifiedPayment(
  prisma: PrismaClient,
  input: SettleVerifiedPaymentInput,
): Promise<VerifiedPaymentSettlement> {
  const payment = await prisma.payment.findUnique({ where: { rrr: input.reference } });
  if (!payment) return 'not_found';
  if (String(payment.gateway).toLowerCase() !== input.gateway) return 'gateway_mismatch';
  if (input.currency.trim().toUpperCase() !== 'NGN') return 'currency_mismatch';

  const expectedKobo = Math.round(Number(payment.amount.toString()) * 100);
  const verifiedKobo = Math.round(input.amountNgn * 100);
  if (
    !Number.isFinite(input.amountNgn) ||
    !Number.isSafeInteger(verifiedKobo) ||
    (input.allowOverpayment ? verifiedKobo < expectedKobo : verifiedKobo !== expectedKobo)
  ) {
    return 'amount_mismatch';
  }

  if (payment.status === 'paid') return 'already_paid';
  if (!['pending', 'processing'].includes(payment.status)) return 'state_conflict';

  return prisma.$transaction(async (tx) => {
    const update = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ['pending', 'processing'] } },
      data: {
        status: 'paid',
        paidAt: input.paidAt ?? new Date(),
        gatewayRef: input.gatewayRef,
        channel: input.channel ?? null,
      },
    });

    if (update.count !== 1) {
      const current = await tx.payment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      return current?.status === 'paid' ? 'already_paid' : 'state_conflict';
    }

    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'paid' },
    });
    return 'updated';
  });
}
