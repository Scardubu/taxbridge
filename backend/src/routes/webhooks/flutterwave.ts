/**
 * Flutterwave Webhook — TaxBridge V13 Sovereign
 *
 * C-37: HMAC rawBody via Fastify content-type parser + timingSafeEqual
 * Flutterwave uses 'verif-hash' header (NOT x-paystack-signature)
 * Redis NX idempotency: webhook:flw:${txRef} 48h TTL
 */
import { FastifyPluginAsync }              from 'fastify';
import { timingSafeEqual, createHmac }    from 'crypto';
import { redis }                           from '../../lib/redis';
import { writeAuditEvent }                 from '../../services/audit';
import { logger }                          from '../../lib/logger';

const flutterwaveWebhook: FastifyPluginAsync = async (fastify) => {
  fastify.post('/flutterwave', async (request, reply) => {
    const rawBody = (request as any).rawBody as Buffer | undefined;
    if (!rawBody) return reply.code(400).send({ error: 'MISSING_BODY' });

    const payload  = rawBody.toString('utf8'); // C-37: toString('utf8') only
    const expected = createHmac('sha256', process.env.FLUTTERWAVE_SECRET!)
      .update(payload).digest();
    const hashHeader = request.headers['verif-hash'] as string | undefined;
    if (!hashHeader) return reply.code(403).send({ error: 'MISSING_SIGNATURE' });

    const received = Buffer.from(hashHeader, 'hex');

    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return reply.code(403).send({ error: 'INVALID_SIGNATURE' });
    }

    const body  = request.body as { data?: { tx_ref?: string; status?: string; amount?: number } };
    const txRef = body.data?.tx_ref;
    if (!txRef) return reply.code(400).send({ error: 'MISSING_TX_REF' });

    const idemKey = `webhook:flw:${txRef}`;
    const isNew   = await redis.set(idemKey, '1', 'EX', 172_800, 'NX'); // 48h TTL
    if (!isNew) {
      return reply.send({ status: 'already_processed' });
    }

    // Process payment fire-and-forget
    processFlutterwavePayment(txRef, body.data?.status, body.data?.amount)
      .catch(err => fastify.log.error({ err, txRef }, 'Flutterwave payment processing failed'));

    return reply.send({ status: 'accepted' });
  });
};

async function processFlutterwavePayment(
  txRef:  string,
  status?: string,
  amount?: number,
): Promise<void> {
  if (status !== 'successful') {
    logger.info({ txRef, status }, 'Flutterwave payment not successful — skipping');
    return;
  }

  await writeAuditEvent({
    actorId:  'system',
    action:   'PAYMENT_RECEIVED',
    resource: 'Payment',
    details:  { txRef, gateway: 'flutterwave', amount },
  });

  logger.info({ txRef, amount }, 'Flutterwave payment processed');
}

export default flutterwaveWebhook;
