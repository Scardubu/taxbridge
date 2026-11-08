import type { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { remitaAdapter } from '../../integrations/remita/adapter';
import { settleVerifiedPayment } from '../../services/verifiedPaymentWebhook';

interface RemitaWebhookBody {
  rrr?: string;
}

const remitaWebhook: FastifyPluginAsync<{ prisma: PrismaClient }> = async (fastify, opts) => {
  fastify.post('/remita', async (request, reply) => {
    const body = request.body as RemitaWebhookBody;
    const rrr = body?.rrr?.trim();
    if (!rrr) return reply.code(400).send({ error: 'MISSING_RRR' });

    // Never accept webhook-only confirmation. Missing credentials, an unknown
    // RRR, or a non-final provider status all keep the payment unpaid.
    if (
      !process.env.REMITA_MERCHANT_ID ||
      !process.env.REMITA_API_KEY ||
      !process.env.REMITA_SERVICE_TYPE_ID ||
      !process.env.REMITA_API_URL
    ) {
      request.log.error({ rrr }, 'Remita verification configuration is incomplete');
      return reply.code(503).send({ error: 'REMITA_VERIFICATION_UNCONFIGURED' });
    }

    try {
      const verified = await remitaAdapter.verifyPayment(rrr, 'webhook');
      if (
        verified.status !== 'paid' ||
        verified.transactionRef !== rrr ||
        verified.amount === undefined
      ) {
        return reply.code(503).send({ error: 'REMITA_PROVIDER_VERIFICATION_PENDING' });
      }

      const outcome = await settleVerifiedPayment(opts.prisma, {
        gateway: 'remita',
        reference: rrr,
        gatewayRef: verified.transactionRef,
        amountNgn: verified.amount,
        currency: 'NGN',
        paidAt: verified.paymentDate ? new Date(verified.paymentDate) : undefined,
      });

      if (outcome === 'updated' || outcome === 'already_paid') {
        request.log.info({ rrr, outcome }, 'Remita payment verified and reconciled');
        return reply.code(200).send({ status: outcome === 'updated' ? 'accepted' : 'already_processed' });
      }
      if (outcome === 'not_found') return reply.code(404).send({ error: 'PAYMENT_NOT_FOUND' });
      request.log.error({ rrr, outcome }, 'Remita payment requires reconciliation');
      return reply.code(409).send({ error: 'PAYMENT_RECONCILIATION_REQUIRED', reason: outcome });
    } catch (error) {
      request.log.error({ err: error, rrr }, 'Remita webhook verification or settlement failed');
      return reply.code(503).send({ error: 'PAYMENT_WEBHOOK_RETRY_REQUIRED' });
    }
  });
};

export default remitaWebhook;
