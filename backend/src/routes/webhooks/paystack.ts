import type { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { paystackAdapter } from '../../integrations/paystack/adapter';
import { settleVerifiedPayment } from '../../services/verifiedPaymentWebhook';

interface PaystackWebhookBody {
  event?: string;
  data?: {
    id?: number | string;
    reference?: string;
  };
}

const paystackWebhook: FastifyPluginAsync<{ prisma: PrismaClient }> = async (fastify, opts) => {
  fastify.post('/paystack', async (request, reply) => {
    const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody) return reply.code(400).send({ error: 'MISSING_RAW_BODY' });

    const headerValue = request.headers['paystack-signature'] ?? request.headers['x-paystack-signature'];
    const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue ?? '';
    if (!paystackAdapter.verifyWebhookSignature(rawBody, signature)) {
      return reply.code(401).send({ error: 'INVALID_SIGNATURE' });
    }

    const event = request.body as PaystackWebhookBody;
    if (event?.event === 'ping') return reply.code(200).send({ status: 'acknowledged' });
    if (event?.event !== 'charge.success') return reply.code(200).send({ status: 'ignored' });

    const reference = event.data?.reference;
    if (!reference) return reply.code(400).send({ error: 'MISSING_REFERENCE' });

    try {
      // The signed event is only a notification. Confirm the transaction with
      // Paystack's verify endpoint before changing payment or invoice state.
      const verified = await paystackAdapter.verifyTransaction(reference);
      const currency = verified.currency;
      if (
        verified.status !== 'success' ||
        verified.reference !== reference ||
        verified.amount === undefined ||
        !currency ||
        currency.toUpperCase() !== 'NGN'
      ) {
        return reply.code(503).send({ error: 'PAYMENT_PROVIDER_VERIFICATION_PENDING' });
      }

      const outcome = await settleVerifiedPayment(opts.prisma, {
        gateway: 'paystack',
        reference,
        gatewayRef: event.data?.id === undefined ? undefined : String(event.data.id),
        amountNgn: verified.amount,
        currency,
        channel: verified.channel,
        paidAt: verified.paidAt ? new Date(verified.paidAt) : undefined,
      });

      if (outcome === 'updated' || outcome === 'already_paid') {
        request.log.info({ reference, outcome }, 'Paystack payment verified and reconciled');
        return reply.code(200).send({ status: outcome === 'updated' ? 'accepted' : 'already_processed' });
      }
      if (outcome === 'not_found') return reply.code(404).send({ error: 'PAYMENT_NOT_FOUND' });
      request.log.error({ reference, outcome }, 'Paystack payment requires reconciliation');
      return reply.code(409).send({ error: 'PAYMENT_RECONCILIATION_REQUIRED', reason: outcome });
    } catch (error) {
      request.log.error({ err: error }, 'Paystack webhook verification or settlement failed');
      return reply.code(503).send({ error: 'PAYMENT_WEBHOOK_RETRY_REQUIRED' });
    }
  });
};

export default paystackWebhook;
