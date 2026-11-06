/**
 * Paystack Webhook — TaxBridge V13 Sovereign
 *
 * PAYSTACK uses 'x-paystack-signature' header (NOT verif-hash — that is Flutterwave)
 * Signature: HMAC-SHA256 of raw body, hex-encoded
 * Redis NX idempotency: webhook:paystack:${reference} 48h TTL
 */
import { FastifyPluginAsync }              from 'fastify';
import { timingSafeEqual, createHmac }    from 'crypto';
import { redis }                           from '../../lib/redis';
import { writeAuditEvent }                 from '../../services/audit';
import { logger }                          from '../../lib/logger';

const paystackWebhook: FastifyPluginAsync = async (fastify) => {
  fastify.post('/paystack', async (request, reply) => {
    const rawBody = (request as any).rawBody as Buffer | undefined;
    if (!rawBody) return reply.code(400).send({ error: 'MISSING_BODY' });

    const payload  = rawBody.toString('utf8');
    const webhookSecret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_WEBHOOK_SECRET;
    if (!webhookSecret) return reply.code(500).send({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' });

    // Paystack uses x-paystack-signature (hex string, NOT hex-decoded buffer)
    const received = request.headers['x-paystack-signature'] as string | undefined;
    if (!received) return reply.code(403).send({ error: 'MISSING_SIGNATURE' });

    const expected512 = createHmac('sha512', webhookSecret).update(payload).digest('hex');
    const expected256 = createHmac('sha256', webhookSecret).update(payload).digest('hex');

    const matches512 = received.length === expected512.length && timingSafeEqual(Buffer.from(expected512), Buffer.from(received));
    const matches256 = received.length === expected256.length && timingSafeEqual(Buffer.from(expected256), Buffer.from(received));

    if (!matches512 && !matches256) {
      return reply.code(403).send({ error: 'INVALID_SIGNATURE' });
    }

    const body      = request.body as { data?: { reference?: string; status?: string; amount?: number; currency?: string } };
    const reference = body.data?.reference;
    if (!reference) return reply.code(400).send({ error: 'MISSING_REFERENCE' });

    const idemKey = `webhook:paystack:${reference}`;
    const isNew   = await redis.set(idemKey, '1', 'EX', 172_800, 'NX'); // 48h TTL
    if (!isNew) {
      return reply.send({ status: 'already_processed' });
    }

    processPaystackPayment(reference, body.data?.status, body.data?.amount)
      .catch(err => fastify.log.error({ err, reference }, 'Paystack payment processing failed'));

    return reply.send({ status: 'accepted' });
  });
};

async function processPaystackPayment(
  reference: string,
  status?:   string,
  amount?:   number,
): Promise<void> {
  if (status !== 'success') {
    logger.info({ reference, status }, 'Paystack payment not successful — skipping');
    return;
  }

  // Amount from Paystack is in kobo (× 100)
  const amountNGN = (amount ?? 0) / 100;

  await writeAuditEvent({
    actorId:  'system',
    action:   'PAYMENT_RECEIVED',
    resource: 'Payment',
    details:  { reference, gateway: 'paystack', amount: amountNGN },
  });

  logger.info({ reference, amount: amountNGN }, 'Paystack payment processed');
}

export default paystackWebhook;
