import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

import { remitaAdapter } from '../integrations/remita/adapter';
import { computeRequestHash } from '../lib/idempotency';
import { getPaymentQueue } from '../queue/client';
import {
  ValidationError,
  NotFoundError,
  RemitaError,
  formatErrorResponse
} from '../lib/errors';
import { metrics } from '../services/metrics';

export default async function paymentRoutes(app: FastifyInstance, opts: { prisma: PrismaClient }) {
  const prisma = opts.prisma;

  const PaymentSchema = z.object({
    invoiceId: z.string().uuid(),
    payerName: z.string(),
    payerEmail: z.string().email(),
    payerPhone: z.string()
  });

  app.post('/api/v1/payments/generate', async (req, reply) => {
    const parsed = PaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = new ValidationError('Invalid payment request', parsed.error.flatten());
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    const { invoiceId, payerName, payerEmail, payerPhone } = parsed.data;

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      const error = new NotFoundError('Invoice', invoiceId);
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    if (invoice.status !== 'stamped') {
      const error = new ValidationError('Invoice must be NRS-stamped before payment', { invoiceStatus: invoice.status });
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    const existingPayment = await prisma.payment.findFirst({ where: { invoiceId } });
    if (existingPayment?.status === 'paid') {
      const error = new ValidationError('Invoice already paid', { paymentId: existingPayment.id });
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    const result = await remitaAdapter.generateRRR({
      amount: parseFloat(invoice.total.toString()),
      payerName,
      payerEmail,
      payerPhone,
      description: `Tax payment for invoice ${invoice.id.slice(0, 8)}`,
      orderId: invoice.id
    });

    if (!result.success) {
      const error = new RemitaError(`RRR generation failed: ${result.error}`, true, { operation: 'GENERATE_RRR' });
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    await prisma.payment.create({
      data: {
        invoiceId,
        rrr: result.rrr!,
        amount: invoice.total,
        status: 'pending',
        payerName,
        payerEmail,
        payerPhone
      }
    });

    return reply.send({ rrr: result.rrr, paymentUrl: result.paymentUrl, amount: parseFloat(invoice.total.toString()) });
  });

  app.post('/webhooks/remita/payment', async (req, reply) => {
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
      const requestHash = computeRequestHash({ method: 'POST', path: '/webhooks/remita/payment', body });
      const cacheKey = `remita:webhook:${requestHash}`;

      const existing = await prisma.idempotencyCache.findUnique({ where: { key: cacheKey } });
      if (existing) {
        app.log.info({ key: cacheKey }, 'Duplicate webhook received — skipping');
        return reply.status(existing.statusCode === 200 ? 200 : 202).send({ received: true });
      }

      // Create placeholder idempotency record to prevent concurrent reprocessing
      await prisma.idempotencyCache.create({
        data: {
          key: cacheKey,
          requestHash,
          method: 'POST',
          path: '/webhooks/remita/payment',
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
        // update idempotency with 404
        await prisma.idempotencyCache.update({ where: { key: cacheKey }, data: { statusCode: 404, responseBody: { error: 'Payment not found' } } });
        return reply.status(404).send({ error: 'Payment not found' });
      }

      // Enqueue background processing and return quickly
      const queue = getPaymentQueue();
      await queue.add('process-remita-webhook', { rrr, body }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
      metrics.recordRemitaWebhook(true);

      return reply.status(200).send({ received: true });
    } catch (err) {
      app.log.error({ err }, 'Failed to process remita webhook');
      metrics.recordRemitaWebhook(false);
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  app.get('/api/v1/payments/:invoiceId/status', async (req, reply) => {
    const { invoiceId } = req.params as { invoiceId: string };

    const payment = await prisma.payment.findFirst({ where: { invoiceId }, orderBy: { createdAt: 'desc' } });
    if (!payment) {
      const error = new NotFoundError('Payment', invoiceId);
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    if (payment.status === 'pending') {
      const verification = await remitaAdapter.verifyPayment(payment.rrr, invoiceId);
      if (verification.status === 'paid') {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'paid', paidAt: new Date() } });
        await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'paid' } });
      }

      return reply.send({ status: verification.status, payment });
    }

    return reply.send({ status: payment.status, payment });
  });
}
