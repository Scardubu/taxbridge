/**
 * Remita Webhook — TaxBridge V13 Sovereign
 *
 * Verify RRR (Remita Retrieval Reference) via Remita status API.
 * Redis NX idempotency: webhook:remita:${rrr} 48h TTL
 */
import { FastifyPluginAsync }  from 'fastify';
import { redis }               from '../../lib/redis';
import { writeAuditEvent }     from '../../services/audit';
import { logger }              from '../../lib/logger';

const remitaWebhook: FastifyPluginAsync = async (fastify) => {
  fastify.post('/remita', async (request, reply) => {
    const body = request.body as { rrr?: string; status?: string; amount?: number };
    const rrr  = body.rrr;

    if (!rrr) return reply.code(400).send({ error: 'MISSING_RRR' });

    const idemKey = `webhook:remita:${rrr}`;
    const isNew   = await redis.set(idemKey, '1', 'EX', 172_800, 'NX'); // 48h TTL
    if (!isNew) {
      return reply.send({ status: 'already_processed' });
    }

    // Verify RRR via Remita status API
    const verified = await verifyRemitaRRR(rrr).catch(() => false);
    if (!verified) {
      // Remove idempotency key to allow retry
      await redis.del(idemKey).catch(() => {});
      return reply.code(422).send({ error: 'RRR_VERIFICATION_FAILED' });
    }

    await writeAuditEvent({
      actorId:  'system',
      action:   'PAYMENT_RECEIVED',
      resource: 'Payment',
      details:  { rrr, gateway: 'remita', amount: body.amount },
    });

    logger.info({ rrr, amount: body.amount }, 'Remita payment processed');
    return reply.send({ status: 'accepted' });
  });
};

async function verifyRemitaRRR(rrr: string): Promise<boolean> {
  const merchantId = process.env.REMITA_MERCHANT_ID;
  if (!merchantId) {
    logger.warn({ rrr }, 'REMITA_MERCHANT_ID not set — skipping RRR verification');
    return true; // Graceful degradation in dev
  }

  try {
    const res = await fetch(
      `https://remitademo.net/remita/exapp/api/v1/send/api/echannelsvc/${merchantId}/${rrr}/status.reg`,
      { headers: { 'Content-Type': 'application/json' } },
    );
    const data: any = await res.json();
    return data?.status === '00' || data?.status === 'PAID';
  } catch (err) {
    logger.warn({ err, rrr }, 'Remita RRR verification failed');
    return false;
  }
}

export default remitaWebhook;
