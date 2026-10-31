import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

import { remitaAdapter } from '../integrations/remita/adapter';
import { paystackAdapter } from '../integrations/paystack/adapter';
import { flutterwaveAdapter } from '../integrations/flutterwave/adapter';
import { paymentGateway, GatewayName } from '../services/payment-gateway';
import { computeRequestHash, isIdempotencyExpired } from '../lib/idempotency';
import { getPaymentQueue } from '../queue/client';
import {
  ValidationError,
  NotFoundError,
  RemitaError,
  formatErrorResponse
} from '../lib/errors';
import { metrics } from '../services/metrics';
import { redis } from '../lib/redis';
import { invalidateDashboardCache } from './dashboard-composite';

export default async function paymentRoutes(app: FastifyInstance, opts: { prisma: PrismaClient }) {
  const prisma = opts.prisma;

  const PaymentSchema = z.object({
    invoiceId: z.string().uuid(),
    payerName: z.string(),
    payerEmail: z.string().email(),
    payerPhone: z.string(),
    gateway: z.enum(['paystack', 'flutterwave', 'remita']).optional(),
    callbackUrl: z.string().url().optional()
  });

  const PaymentResponseSchema = z.object({
    rrr: z.string(),
    paymentUrl: z.string().nullable().optional(),
    amount: z.number(),
    gateway: z.string().optional()
  });

  app.post('/api/v1/payments/generate', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.userId;
    const idempotencyKeyHeader = req.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyKeyHeader) ? idempotencyKeyHeader[0] : idempotencyKeyHeader;
    if (idempotencyKey && idempotencyKey.length > 128) {
      return reply.code(400).send({ error: 'INVALID_IDEMPOTENCY_KEY' });
    }
    const scopedIdempotencyKey = idempotencyKey ? 'payment:' + userId + ':' + idempotencyKey : undefined;
    const requestHash = computeRequestHash({
      method: req.method,
      path: req.url,
      body: { userId, payload: req.body },
    });

    if (scopedIdempotencyKey) {
      const existing = await prisma.idempotencyCache.findUnique({ where: { key: scopedIdempotencyKey } });
      if (existing) {
        if (isIdempotencyExpired(existing.createdAt)) {
          await prisma.idempotencyCache.delete({ where: { key: scopedIdempotencyKey } });
        } else {
        if (existing.requestHash !== requestHash) {
          return reply.status(409).send({ error: 'Idempotency-Key reuse with different request body' });
        }

        const parsed = PaymentResponseSchema.safeParse(existing.responseBody);
        if (!parsed.success) {
          app.log.error({ err: parsed.error, idempotencyKey }, 'Invalid cached idempotency responseBody');
          return reply.status(500).send({ error: 'Internal Server Error' });
        }

        return reply.status(200).send(parsed.data);
        }
      }
    }

    const parsed = PaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = new ValidationError('Invalid payment request', parsed.error.flatten());
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    const { invoiceId, payerName, payerEmail, payerPhone, gateway: requestedGateway, callbackUrl } = parsed.data;

    // Serialize all payment-initiation requests for this invoice across API
    // instances. The reservation is committed before contacting a gateway.
    const reservation = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        invoiceId,
      );

      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, userId } });
      if (!invoice) return { kind: 'not_found' as const };

      if (invoice.status !== 'stamped') {
        return { kind: 'invoice_not_ready' as const, invoiceStatus: invoice.status };
      }

      const existingPayment = await tx.payment.findFirst({
        where: { invoiceId, status: { in: ['paid', 'pending', 'processing'] } },
      });
      if (existingPayment) {
        return {
          kind: existingPayment.status === 'paid' ? 'already_paid' as const : 'already_pending' as const,
          paymentId: existingPayment.id,
        };
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId,
          gateway: requestedGateway ?? 'remita',
          // Temporary internal reference. It is replaced by the gateway
          // reference before a successful response is returned to the client.
          rrr: 'INIT-' + randomUUID(),
          amount: invoice.total,
          status: 'processing',
          payerName,
          payerEmail,
          payerPhone,
          metadata: { initializationState: 'REQUESTED' },
        },
        select: { id: true },
      });

      return { kind: 'reserved' as const, invoice, paymentId: payment.id };
    });

    if (reservation.kind === 'not_found') {
      const error = new NotFoundError('Invoice', invoiceId);
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }
    if (reservation.kind === 'invoice_not_ready') {
      const error = new ValidationError('Invoice must be NRS-stamped before payment', {
        invoiceStatus: reservation.invoiceStatus,
      });
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }
    if (reservation.kind === 'already_paid') {
      const error = new ValidationError('Invoice already paid', { paymentId: reservation.paymentId });
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }
    if (reservation.kind === 'already_pending') {
      return reply.code(409).send({
        error: 'PAYMENT_ALREADY_PENDING',
        message: 'A payment attempt already exists for this invoice. Check its status before starting another.',
        paymentId: reservation.paymentId,
      });
    }

    let initResult;
    try {
      initResult = await paymentGateway.initializePayment({
        invoiceId,
        amount: Number(reservation.invoice.total.toString()),
        payerName,
        payerEmail,
        payerPhone,
        gateway: requestedGateway as GatewayName | undefined,
        callbackUrl,
      });
    } catch (error) {
      // A timeout or circuit-breaker failure can occur after a provider has
      // accepted the request. Keep the reservation in processing so another
      // client request cannot create a second gateway session.
      await prisma.payment.update({
        where: { id: reservation.paymentId },
        data: { metadata: { initializationState: 'OUTCOME_UNKNOWN' } },
      }).catch((persistenceError) => {
        req.log.error({ err: persistenceError, paymentId: reservation.paymentId }, 'Failed to annotate payment initialization outcome');
      });
      req.log.error({ err: error, paymentId: reservation.paymentId }, 'Payment initialization outcome is unknown');
      return reply.code(503).send({
        error: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
        paymentId: reservation.paymentId,
        message: 'The payment provider outcome must be reconciled before another attempt is allowed.',
      });
    }

    if (!initResult.success || !initResult.reference) {
      await prisma.payment.update({
        where: { id: reservation.paymentId },
        data: {
          metadata: {
            initializationState: 'OUTCOME_UNKNOWN',
            provider: initResult.gateway,
          },
        },
      });
      return reply.code(502).send({
        error: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
        paymentId: reservation.paymentId,
        message: 'The payment provider outcome must be reconciled before another attempt is allowed.',
      });
    }

    // Finalize the durable reservation only after a provider reference exists.
    await prisma.payment.update({
      where: { id: reservation.paymentId },
      data: {
        gateway: initResult.gateway,
        rrr: initResult.reference,
        status: 'pending',
        metadata: { initializationState: 'SUCCEEDED' },
      },
    });

    const responseBody = {
      rrr: initResult.reference,
      paymentUrl: initResult.paymentUrl,
      amount: Number(reservation.invoice.total.toString()),
      gateway: initResult.gateway,
    };

    if (scopedIdempotencyKey) {
      await prisma.idempotencyCache.create({
        data: {
          key: scopedIdempotencyKey,
          requestHash,
          method: req.method,
          path: req.url,
          statusCode: 200,
          responseBody,
        },
      });
    }

    return reply.send(responseBody);
  });

  const REMITA_WEBHOOK_CANONICAL_PATH = '/api/v1/payments/webhook/remita';
  const remitaWebhookHandler = async (req: any, reply: any) => {
    const signature = (req.headers['x-remita-signature'] as string) || '';
    const body = req.body as any;
    const payloadStr = JSON.stringify(body);

    if (!remitaAdapter.verifyWebhookSignature(payloadStr, signature)) {
      app.log.warn({ headers: req.headers }, 'Invalid remita signature');
      metrics.recordRemitaWebhook(false);
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // Idempotency: compute request hash and check cache
    try {
      // Normalize path so legacy + canonical endpoints dedupe consistently
      const requestHash = computeRequestHash({ method: 'POST', path: REMITA_WEBHOOK_CANONICAL_PATH, body });
      const cacheKey = `remita:webhook:${requestHash}`;

      const existing = await prisma.idempotencyCache.findUnique({ where: { key: cacheKey } });
      if (existing) {
        if (isIdempotencyExpired(existing.createdAt)) {
          await prisma.idempotencyCache.delete({ where: { key: cacheKey } });
        } else {
        app.log.info({ key: cacheKey }, 'Duplicate webhook received — skipping');
        return reply.status(existing.statusCode === 200 ? 200 : 202).send({ received: true });
        }
      }

      // Create placeholder idempotency record to prevent concurrent reprocessing
      await prisma.idempotencyCache.create({
        data: {
          key: cacheKey,
          requestHash,
          method: 'POST',
          path: REMITA_WEBHOOK_CANONICAL_PATH,
          statusCode: 202,
          responseBody: {}
        }
      });

      const rrr = String(body?.rrr || '');
      if (!rrr) {
        app.log.error({ body }, 'Missing rrr in webhook payload');
        metrics.recordRemitaWebhook(false);
        return reply.status(400).send({ error: 'Missing rrr' });
      }

      const payment = await prisma.payment.findUnique({ where: { rrr }, include: { invoice: true } });
      if (!payment) {
        app.log.error({ rrr }, 'Payment not found for RRR');
        metrics.recordRemitaWebhook(false);
        await prisma.idempotencyCache.update({
          where: { key: cacheKey },
          data: { statusCode: 404, responseBody: { error: 'Payment not found' } }
        });
        return reply.status(404).send({ error: 'Payment not found' });
      }

      // Enqueue background processing and return quickly
      const queue = getPaymentQueue();
      if (queue) {
        const maxAttempts = Number.parseInt(process.env.PAYMENT_WEBHOOK_MAX_ATTEMPTS || '4', 10);
        const backoffMs = Number.parseInt(process.env.PAYMENT_WEBHOOK_BACKOFF_MS || '3000', 10);

        await queue.add(
          'process-remita-webhook',
          { rrr, body },
          {
            attempts: Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 4,
            backoff: { type: 'exponential', delay: Number.isFinite(backoffMs) && backoffMs > 0 ? backoffMs : 3000 }
          }
        );
      }
      metrics.recordRemitaWebhook(true);

      return reply.status(200).send({ received: true });
    } catch (err) {
      app.log.error({ err }, 'Failed to process remita webhook');
      metrics.recordRemitaWebhook(false);
      return reply.status(500).send({ error: 'Internal error' });
    }
  };

  // Canonical endpoint (documented)
  app.post('/api/v1/payments/webhook/remita', remitaWebhookHandler);
  // Legacy endpoint (backward compatibility)
  app.post('/webhooks/remita/payment', remitaWebhookHandler);

  app.get('/api/v1/payments/:invoiceId/status', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { invoiceId } = req.params as { invoiceId: string };
    const userId = req.user.userId;

    const payment = await prisma.payment.findFirst({
      where: { invoiceId, invoice: { userId } },
      orderBy: { createdAt: 'desc' },
      include: { invoice: true },
    });
    if (!payment) {
      const error = new NotFoundError('Payment', invoiceId);
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    if (payment.status === 'pending') {
      const gateway = (payment as any).gateway as GatewayName || 'remita';
      const verification = await paymentGateway.verifyPayment(gateway, payment.rrr, invoiceId);
      if (verification.status === 'paid') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'paid',
            paidAt: new Date(),
            gatewayRef: verification.gatewayRef || verification.reference,
            channel: verification.channel,
            metadata: {
              cardType: verification.cardType,
              last4: verification.last4,
              bank: verification.bank,
            },
          },
        });
        await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'paid' } });
        if ((payment as any).invoice?.userId) {
          await invalidateDashboardCache(redis, (payment as any).invoice.userId);
        }
      }

      return reply.send({ status: verification.status, gateway, payment });
    }

    return reply.send({ status: payment.status, payment });
  });
}
