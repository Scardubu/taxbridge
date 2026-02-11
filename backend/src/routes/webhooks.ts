/**
 * Payment Gateway Webhook Routes
 *
 * POST /api/v1/payments/webhook/paystack     — Paystack charge events
 * POST /api/v1/payments/webhook/flutterwave  — Flutterwave charge events
 *
 * Remita webhook is handled in payments.ts (existing).
 */

import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { paystackAdapter } from '../integrations/paystack/adapter';
import { flutterwaveAdapter } from '../integrations/flutterwave/adapter';
import { computeRequestHash, isIdempotencyExpired } from '../lib/idempotency';
import { getPaymentQueue } from '../queue/client';
import { metrics } from '../services/metrics';
import type { PaystackWebhookEvent } from '../integrations/paystack/types';
import type { FlutterwaveWebhookEvent } from '../integrations/flutterwave/types';

export default async function webhookRoutes(app: FastifyInstance, opts: { prisma: PrismaClient }) {
  const prisma = opts.prisma;

  // =========================================================================
  // Paystack Webhook
  // =========================================================================

  app.post('/api/v1/payments/webhook/paystack', async (req, reply) => {
    const signature = (req.headers['x-paystack-signature'] as string) || '';
    const rawBody = JSON.stringify(req.body);

    if (!paystackAdapter.verifyWebhookSignature(rawBody, signature)) {
      app.log.warn({ headers: req.headers }, 'Invalid Paystack webhook signature');
      metrics.recordPaystackWebhook(false);
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    try {
      const requestHash = computeRequestHash({ method: 'POST', path: '/api/v1/payments/webhook/paystack', body: req.body });
      const cacheKey = `paystack:webhook:${requestHash}`;

      const existing = await prisma.idempotencyCache.findUnique({ where: { key: cacheKey } });
      if (existing) {
        if (isIdempotencyExpired(existing.createdAt)) {
          await prisma.idempotencyCache.delete({ where: { key: cacheKey } });
        } else {
          app.log.info({ key: cacheKey }, 'Duplicate Paystack webhook — skipping');
          return reply.status(200).send({ received: true });
        }
      }

      await prisma.idempotencyCache.create({
        data: {
          key: cacheKey,
          requestHash,
          method: 'POST',
          path: '/api/v1/payments/webhook/paystack',
          statusCode: 202,
          responseBody: {},
        },
      });

      const event = req.body as PaystackWebhookEvent;

      if (event.event !== 'charge.success') {
        app.log.info({ event: event.event }, 'Ignoring non-success Paystack event');
        return reply.status(200).send({ received: true });
      }

      const reference = event.data?.reference;
      if (!reference) {
        app.log.error({ body: req.body }, 'Missing reference in Paystack webhook');
        metrics.recordPaystackWebhook(false);
        return reply.status(400).send({ error: 'Missing reference' });
      }

      const payment = await prisma.payment.findUnique({ where: { rrr: reference } });
      if (!payment) {
        app.log.error({ reference }, 'Payment not found for Paystack reference');
        metrics.recordPaystackWebhook(false);
        return reply.status(404).send({ error: 'Payment not found' });
      }

      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'paid',
          paidAt: event.data.paid_at ? new Date(event.data.paid_at) : new Date(),
          gatewayRef: String(event.data.id),
          channel: event.data.channel,
          metadata: {
            cardType: event.data.authorization?.card_type,
            last4: event.data.authorization?.last4,
            bank: event.data.authorization?.bank,
          },
        },
      });

      // Update invoice status
      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: 'paid' },
      });

      await prisma.idempotencyCache.update({
        where: { key: cacheKey },
        data: { statusCode: 200, responseBody: { reference, status: 'paid' } },
      });

      metrics.recordPaystackWebhook(true);
      app.log.info({ reference }, 'Paystack payment confirmed via webhook');

      return reply.status(200).send({ received: true });
    } catch (err) {
      app.log.error({ err }, 'Failed to process Paystack webhook');
      metrics.recordPaystackWebhook(false);
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // =========================================================================
  // Flutterwave Webhook
  // =========================================================================

  app.post('/api/v1/payments/webhook/flutterwave', async (req, reply) => {
    const secretHash = (req.headers['verif-hash'] as string) || '';

    if (!flutterwaveAdapter.verifyWebhookSignature(secretHash)) {
      app.log.warn({ headers: req.headers }, 'Invalid Flutterwave webhook signature');
      metrics.recordFlutterwaveWebhook(false);
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    try {
      const requestHash = computeRequestHash({ method: 'POST', path: '/api/v1/payments/webhook/flutterwave', body: req.body });
      const cacheKey = `flutterwave:webhook:${requestHash}`;

      const existing = await prisma.idempotencyCache.findUnique({ where: { key: cacheKey } });
      if (existing) {
        if (isIdempotencyExpired(existing.createdAt)) {
          await prisma.idempotencyCache.delete({ where: { key: cacheKey } });
        } else {
          app.log.info({ key: cacheKey }, 'Duplicate Flutterwave webhook — skipping');
          return reply.status(200).send({ received: true });
        }
      }

      await prisma.idempotencyCache.create({
        data: {
          key: cacheKey,
          requestHash,
          method: 'POST',
          path: '/api/v1/payments/webhook/flutterwave',
          statusCode: 202,
          responseBody: {},
        },
      });

      const event = req.body as FlutterwaveWebhookEvent;

      if (event.event !== 'charge.completed' || event.data?.status !== 'successful') {
        app.log.info({ event: event.event, status: event.data?.status }, 'Ignoring non-success Flutterwave event');
        return reply.status(200).send({ received: true });
      }

      const reference = event.data?.tx_ref;
      if (!reference) {
        app.log.error({ body: req.body }, 'Missing tx_ref in Flutterwave webhook');
        metrics.recordFlutterwaveWebhook(false);
        return reply.status(400).send({ error: 'Missing tx_ref' });
      }

      const payment = await prisma.payment.findUnique({ where: { rrr: reference } });
      if (!payment) {
        app.log.error({ reference }, 'Payment not found for Flutterwave reference');
        metrics.recordFlutterwaveWebhook(false);
        return reply.status(404).send({ error: 'Payment not found' });
      }

      // Verify the transaction server-side before trusting the webhook
      const verification = await flutterwaveAdapter.verifyTransaction(String(event.data.id));

      if (verification.status !== 'successful' || verification.amount !== parseFloat(payment.amount.toString())) {
        app.log.warn({ reference, expected: payment.amount, got: verification.amount }, 'Flutterwave amount mismatch or verification failed');
        metrics.recordFlutterwaveWebhook(false);
        return reply.status(400).send({ error: 'Verification failed' });
      }

      // Update payment status
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          gatewayRef: event.data.flw_ref,
          channel: event.data.payment_type,
          metadata: {
            cardType: event.data.card?.type,
            last4: event.data.card?.last_4digits,
          },
        },
      });

      // Update invoice status
      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: 'paid' },
      });

      await prisma.idempotencyCache.update({
        where: { key: cacheKey },
        data: { statusCode: 200, responseBody: { reference, status: 'paid' } },
      });

      metrics.recordFlutterwaveWebhook(true);
      app.log.info({ reference }, 'Flutterwave payment confirmed via webhook');

      return reply.status(200).send({ received: true });
    } catch (err) {
      app.log.error({ err }, 'Failed to process Flutterwave webhook');
      metrics.recordFlutterwaveWebhook(false);
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // =========================================================================
  // Gateway availability endpoint
  // =========================================================================

  app.get('/api/v1/payments/gateways', async (_req, reply) => {
    const { paymentGateway: pgw } = await import('../services/payment-gateway');
    const available = pgw.getAvailableGateways();
    return reply.send({
      success: true,
      data: {
        gateways: available,
        primary: available[0] || null,
      },
    });
  });
}
