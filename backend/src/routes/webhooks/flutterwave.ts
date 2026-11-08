import type { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { flutterwaveAdapter } from '../../integrations/flutterwave/adapter';
import { settleVerifiedPayment } from '../../services/verifiedPaymentWebhook';

interface FlutterwaveWebhookBody {
  event?: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
  };
}

const flutterwaveWebhook: FastifyPluginAsync<{ prisma: PrismaClient }> = async (fastify, opts) => {
  fastify.post('/flutterwave', async (request, reply) => {
    const headerValue = request.headers['verif-hash'];
    const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue ?? '';
    if (!flutterwaveAdapter.verifyWebhookSignature(signature)) {
      return reply.code(401).send({ error: 'INVALID_SIGNATURE' });
    }

    const event = request.body as FlutterwaveWebhookBody;
    if (event?.event !== 'charge.completed') return reply.code(200).send({ status: 'ignored' });

    const reference = event.data?.tx_ref;
    const transactionId = event.data?.id;
    if (!reference || transactionId === undefined) {
      return reply.code(400).send({ error: 'MISSING_TRANSACTION_REFERENCE' });
    }

    try {
      // Verify by transaction ID and reconcile the authoritative reference,
      // currency, and amount before any payment state transition.
      const verified = await flutterwaveAdapter.verifyTransaction(String(transactionId));
      const currency = verified.currency;
      if (
        verified.status !== 'successful' ||
        verified.reference !== reference ||
        verified.amount === undefined ||
        !currency ||
        currency.toUpperCase() !== 'NGN'
      ) {
        return reply.code(503).send({ error: 'PAYMENT_PROVIDER_VERIFICATION_PENDING' });
      }

      const outcome = await settleVerifiedPayment(opts.prisma, {
        gateway: 'flutterwave',
        reference,
        gatewayRef: verified.flwRef,
        amountNgn: verified.amount,
        currency,
        channel: verified.channel,
        paidAt: verified.paidAt ? new Date(verified.paidAt) : undefined,
        // Flutterwave permits overpayment but not underpayment.
        allowOverpayment: true,
      });

      if (outcome === 'updated' || outcome === 'already_paid') {
        request.log.info({ reference, outcome }, 'Flutterwave payment verified and reconciled');
        return reply.code(200).send({ status: outcome === 'updated' ? 'accepted' : 'already_processed' });
      }
      if (outcome === 'not_found') return reply.code(404).send({ error: 'PAYMENT_NOT_FOUND' });
      request.log.error({ reference, outcome }, 'Flutterwave payment requires reconciliation');
      return reply.code(409).send({ error: 'PAYMENT_RECONCILIATION_REQUIRED', reason: outcome });
    } catch (error) {
      request.log.error({ err: error }, 'Flutterwave webhook verification or settlement failed');
      return reply.code(503).send({ error: 'PAYMENT_WEBHOOK_RETRY_REQUIRED' });
    }
  });
};

export default flutterwaveWebhook;
