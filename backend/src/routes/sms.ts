import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
  verifyInfobipSignature,
  parseInfobipDelivery,
  verifyTermiiSignature,
  parseTermiiDelivery,
} from '../integrations/comms/client';

export default async function smsRoutes(app: FastifyInstance, opts: { prisma: PrismaClient }) {
  const prisma = opts.prisma;

  // Generic delivery report endpoint used by SMS providers
  app.post('/webhooks/sms/delivery', async (req, reply) => {
    const body = req.body as any;
    const headers = (req.headers || {}) as Record<string, any>;

    // Try provider-specific verification in order: Infobip -> Termii -> fallback
    let provider = (headers['x-sms-provider'] as string) || (body.provider as string) || 'unknown';
    let verified = false;
    let normalized: { messageId?: string; to?: string; status?: string; raw?: any } | null = null;

    // Infobip
    try {
      if (verifyInfobipSignature(body, headers)) {
        provider = 'infobip';
        verified = true;
        normalized = parseInfobipDelivery(body);
      }
    } catch (e) {
      // ignore
    }

    // Termii
    if (!verified) {
      try {
        if (verifyTermiiSignature(body, headers)) {
          provider = 'termii';
          verified = true;
          normalized = parseTermiiDelivery(body);
        }
      } catch (e) {
        // ignore
      }
    }

    // If not verified and no provider hint, try to infer common shapes (Africa's Talking and others)
    if (!normalized) {
      const messageId = body.messageId || body.message_id || body.id || body.smsId || (Array.isArray(body) && body[0]?.messageId);
      const to = body.to || body.destination || body.msisdn || (Array.isArray(body) && body[0]?.to);
      const status = body.status || body.deliveryStatus || body.statusText || 'unknown';
      normalized = { messageId: messageId ? String(messageId) : undefined, to: to ? String(to) : undefined, status: String(status || 'unknown'), raw: body };
      // leave provider as inferred or unknown
    }

    // Optional: require verification for Infobip/Termii if env requires it
    if ((provider === 'infobip' || provider === 'termii') && process.env.REQUIRE_SMS_SIGNATURE === '1' && !verified) {
      app.log.warn({ headers }, 'SMS webhook signature required but not verified');
      return reply.status(401).send({ error: 'invalid_signature' });
    }

    try {
      await prisma.sMSDelivery.create({ data: { to: String(normalized.to || ''), messageId: normalized.messageId ? String(normalized.messageId) : undefined, provider: provider || 'unknown', status: normalized.status || 'unknown', providerPayload: normalized.raw || body || {} } });

      // Also create an audit log entry
      await prisma.auditLog.create({ data: { action: 'sms_delivery_report', metadata: { provider, messageId: normalized.messageId, to: normalized.to, status: normalized.status } } });

      return reply.status(200).send({ received: true });
    } catch (err) {
      app.log.error({ err }, 'Failed to persist SMS delivery report');
      return reply.status(500).send({ error: 'failed' });
    }
  });
}
