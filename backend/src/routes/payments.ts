import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

import { remitaAdapter } from '../integrations/remita/adapter';
import { paystackAdapter } from '../integrations/paystack/adapter';
import { flutterwaveAdapter } from '../integrations/flutterwave/adapter';
import { paymentGateway, GatewayName } from '../services/payment-gateway';
import { computeRequestHash } from '../lib/idempotency';
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
import { requireRole } from '../plugins/requireRole';
import { PaymentGatewayUnavailableError } from '../services/circuit-breaker';

export default async function paymentRoutes(app: FastifyInstance, opts: { prisma: PrismaClient }) {
  const prisma = opts.prisma;

  const PaymentSchema = z.object({
    invoiceId: z.string().uuid(),
    payerName: z.string().min(1).max(200),
    payerEmail: z.string().email(),
    payerPhone: z.string().min(7).max(32),
    gateway: z.enum(['paystack', 'flutterwave', 'remita']).optional(),
    callbackUrl: z.string().url().optional()
  });

  const IdempotencyKeySchema = z.string().min(16).max(200);

  const PaymentResponseSchema = z.object({
    rrr: z.string().min(1),
    paymentUrl: z.string().url().nullable().optional(),
    amount: z.number().positive(),
    gateway: z.enum(['paystack', 'flutterwave', 'remita'])
  });

  const PaymentReservationSchema = z.discriminatedUnion('state', [
    z.object({ state: z.literal('initializing') }),
    z.object({ state: z.literal('unknown'), errorCode: z.string() }),
    z.object({ state: z.literal('provider_initialized'), payment: PaymentResponseSchema }),
    z.object({ state: z.literal('complete'), payment: PaymentResponseSchema }),
  ]);

  app.post('/api/v1/payments/generate', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ACCOUNTANT')],
  }, async (req, reply) => {
    const parsed = PaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = new ValidationError('Invalid payment request', parsed.error.flatten());
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    const suppliedKeyHeader = req.headers['idempotency-key'];
    const suppliedIdempotencyKey = Array.isArray(suppliedKeyHeader) ? suppliedKeyHeader[0] : suppliedKeyHeader;
    const keyParse = IdempotencyKeySchema.safeParse(suppliedIdempotencyKey);
    if (!keyParse.success) {
      return reply.code(400).send({
        error: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Payment initiation requires an Idempotency-Key header between 16 and 200 characters',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        requestId: req.id,
        retryable: false,
      });
    }

    const { invoiceId, payerName, payerEmail, payerPhone } = parsed.data;
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: req.user.userId },
    });
    if (!invoice) {
      const error = new NotFoundError('Invoice', invoiceId);
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    // One reservation per authenticated user/invoice prevents a second
    // idempotency key from starting a parallel provider transaction.
    // The caller's key is part of the fingerprint and must be reused on retry.
    const idempotencyKey = 'payment:' + req.user.userId + ':' + invoiceId;
    const requestHash = computeRequestHash({
      method: req.method,
      path: req.url,
      body: { ...parsed.data, idempotencyKey: keyParse.data },
    });

    const persistProviderPayment = async (paymentData: z.infer<typeof PaymentResponseSchema>) => {
      await prisma.$transaction(async (tx) => {
        const existingPayment = await tx.payment.findUnique({
          where: { rrr: paymentData.rrr },
        });
        if (!existingPayment) {
          await tx.payment.create({
            data: {
              invoiceId,
              gateway: paymentData.gateway,
              rrr: paymentData.rrr,
              amount: invoice.total,
              status: 'pending',
              payerName,
              payerEmail,
              payerPhone,
            },
          });
        }
        await tx.idempotencyCache.update({
          where: { key: idempotencyKey },
          data: {
            statusCode: 200,
            responseBody: {
              state: 'complete',
              payment: paymentData,
            } as Prisma.InputJsonValue,
          },
        });
      });
    };

    const respondFromReservation = async (reservation: {
      requestHash: string;
      responseBody: Prisma.JsonValue;
    }) => {
      if (reservation.requestHash !== requestHash) {
        return reply.code(409).send({
          error: 'IDEMPOTENCY_KEY_REUSED',
          message: 'This invoice already has a payment attempt with a different request fingerprint',
          code: 'IDEMPOTENCY_KEY_REUSED',
          requestId: req.id,
          retryable: false,
        });
      }

      const legacySuccess = PaymentResponseSchema.safeParse(reservation.responseBody);
      if (legacySuccess.success) {
        return reply.code(200).send(legacySuccess.data);
      }

      const parsedReservation = PaymentReservationSchema.safeParse(reservation.responseBody);
      if (!parsedReservation.success) {
        req.log.error({ idempotencyKey }, 'Payment reservation has an invalid stored state');
        return reply.code(503).send({
          error: 'PAYMENT_RESERVATION_UNAVAILABLE',
          message: 'Payment state requires operational reconciliation',
          code: 'PAYMENT_RESERVATION_UNAVAILABLE',
          requestId: req.id,
          retryable: false,
        });
      }

      switch (parsedReservation.data.state) {
        case 'complete':
          return reply.code(200).send(parsedReservation.data.payment);
        case 'provider_initialized':
          try {
            await persistProviderPayment(parsedReservation.data.payment);
            return reply.code(200).send(parsedReservation.data.payment);
          } catch (error) {
            req.log.error({ err: error, idempotencyKey }, 'Payment persistence recovery is pending');
            return reply.code(503).send({
              error: 'PAYMENT_PERSISTENCE_PENDING',
              message: 'The provider transaction exists; retry with the same Idempotency-Key to complete local persistence',
              code: 'PAYMENT_PERSISTENCE_PENDING',
              requestId: req.id,
              retryable: true,
            });
          }
        case 'unknown':
          return reply.code(409).send({
            error: parsedReservation.data.errorCode,
            message: 'The provider outcome is unknown. Do not initiate another payment; reconcile this attempt first',
            code: parsedReservation.data.errorCode,
            requestId: req.id,
            retryable: false,
          });
        case 'initializing':
          return reply.code(409).send({
            error: 'PAYMENT_INITIALIZATION_IN_PROGRESS',
            message: 'An earlier payment initialization may still be in progress. Do not start another payment attempt',
            code: 'PAYMENT_INITIALIZATION_IN_PROGRESS',
            requestId: req.id,
            retryable: false,
          });
      }
    };

    const existingReservation = await prisma.idempotencyCache.findUnique({
      where: { key: idempotencyKey },
    });
    if (existingReservation) return respondFromReservation(existingReservation);

    if (invoice.status !== 'stamped') {
      const error = new ValidationError('Invoice must be NRS-stamped before payment', { invoiceStatus: invoice.status });
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { invoiceId },
    });
    if (existingPayment) {
      return reply.code(409).send({
        error: existingPayment.status === 'paid' ? 'INVOICE_ALREADY_PAID' : 'PAYMENT_ATTEMPT_EXISTS',
        message: 'An existing payment attempt is recorded for this invoice; reconcile its status before starting another attempt',
        code: existingPayment.status === 'paid' ? 'INVOICE_ALREADY_PAID' : 'PAYMENT_ATTEMPT_EXISTS',
        requestId: req.id,
        retryable: false,
      });
    }

    // Persist the reservation before making any external provider request.
    // A concurrent request for this invoice can never start a second charge.
    try {
      await prisma.idempotencyCache.create({
        data: {
          key: idempotencyKey,
          requestHash,
          method: req.method,
          path: req.url,
          statusCode: 202,
          responseBody: { state: 'initializing' } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await prisma.idempotencyCache.findUnique({ where: { key: idempotencyKey } });
        if (winner) return respondFromReservation(winner);
      }
      req.log.error({ err: error, idempotencyKey }, 'Could not reserve payment idempotency key');
      return reply.code(503).send({
        error: 'PAYMENT_RESERVATION_FAILED',
        message: 'Payment was not started because a durable reservation could not be created',
        code: 'PAYMENT_RESERVATION_FAILED',
        requestId: req.id,
        retryable: true,
      });
    }

    let initResult;
    try {
      initResult = await paymentGateway.initializePayment({
        invoiceId,
        amount: parseFloat(invoice.total.toString()),
        payerName,
        payerEmail,
        payerPhone,
        gateway: parsed.data.gateway as GatewayName | undefined,
        callbackUrl: parsed.data.callbackUrl,
      });
    } catch (error) {
      if (error instanceof PaymentGatewayUnavailableError) {
        await prisma.idempotencyCache.delete({ where: { key: idempotencyKey } }).catch(() => undefined);
        return reply.code(503).send({
          error: 'PAYMENT_GATEWAY_UNAVAILABLE',
          message: error.message,
          code: 'PAYMENT_GATEWAY_UNAVAILABLE',
          requestId: req.id,
          retryable: true,
        });
      }

      req.log.error({ err: error, idempotencyKey }, 'Payment provider outcome is unknown');
      await prisma.idempotencyCache.update({
        where: { key: idempotencyKey },
        data: {
          statusCode: 409,
          responseBody: {
            state: 'unknown',
            errorCode: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
          } as Prisma.InputJsonValue,
        },
      }).catch((persistError) => {
        req.log.error({ err: persistError, idempotencyKey }, 'Failed to persist unknown payment outcome');
      });
      return reply.code(409).send({
        error: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
        message: 'The provider outcome is unknown. Do not retry with a new key or initialize another payment; reconcile this attempt first',
        code: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
        requestId: req.id,
        retryable: false,
      });
    }

    if (!initResult.success || !initResult.reference) {
      req.log.error({
        gateway: initResult.gateway,
        error: initResult.error,
        idempotencyKey,
      }, 'Payment provider did not confirm an initialization result');

      await prisma.idempotencyCache.update({
        where: { key: idempotencyKey },
        data: {
          statusCode: 409,
          responseBody: {
            state: 'unknown',
            errorCode: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
          } as Prisma.InputJsonValue,
        },
      });
      return reply.code(409).send({
        error: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
        message: 'The provider did not return a confirmed result. Do not retry with a new key; reconcile this attempt first',
        code: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
        requestId: req.id,
        retryable: false,
      });
    }

    const responseBody = PaymentResponseSchema.parse({
      rrr: initResult.reference,
      paymentUrl: initResult.paymentUrl,
      amount: parseFloat(invoice.total.toString()),
      gateway: initResult.gateway,
    });

    // Store the provider reference before creating the Payment row. If the
    // database transaction below fails, the next same-key retry can recover
    // locally without creating another provider transaction.
    try {
      await prisma.idempotencyCache.update({
        where: { key: idempotencyKey },
        data: {
          statusCode: 202,
          responseBody: {
            state: 'provider_initialized',
            payment: responseBody,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      req.log.error({ err: error, idempotencyKey, rrr: responseBody.rrr }, 'Provider reference could not be durably stored');
      return reply.code(503).send({
        error: 'PAYMENT_PROVIDER_REFERENCE_PERSISTENCE_FAILED',
        message: 'The provider may have initialized a payment, but TaxBridge could not safely persist its reference. Do not retry with a new key; contact support for reconciliation',
        code: 'PAYMENT_PROVIDER_REFERENCE_PERSISTENCE_FAILED',
        requestId: req.id,
        retryable: false,
      });
    }

    try {
      await persistProviderPayment(responseBody);
      return reply.code(200).send(responseBody);
    } catch (error) {
      req.log.error({ err: error, idempotencyKey }, 'Payment row creation failed after provider initialization');
      return reply.code(503).send({
        error: 'PAYMENT_PERSISTENCE_PENDING',
        message: 'The provider transaction exists; retry with the same Idempotency-Key to complete local persistence',
        code: 'PAYMENT_PERSISTENCE_PENDING',
        requestId: req.id,
        retryable: true,
      });
    }
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

  app.get('/api/v1/payments/:invoiceId/status', {
    preHandler: [app.authenticate, app.resolveOrgContext, requireRole('VIEWER')],
  }, async (req, reply) => {
    const params = z.object({ invoiceId: z.string().uuid() }).safeParse(req.params);
    if (!params.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: params.error.issues });
    }
    const { invoiceId } = params.data;

    const payment = await prisma.payment.findFirst({
      where: {
        invoiceId,
        invoice: { is: { userId: req.user.userId } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      const error = new NotFoundError('Payment', invoiceId);
      return reply.status(error.statusCode).send(formatErrorResponse(error));
    }

    // GET is read-only. Provider verification and state transitions are handled
    // by signed webhook/reconciliation flows, never triggered by a page refresh.
    // Return only the minimum fields required by the authenticated invoice owner.
    return reply.send({
      status: payment.status,
      payment: {
        id: payment.id,
        invoiceId: payment.invoiceId,
        gateway: payment.gateway,
        rrr: payment.rrr,
        amount: payment.amount.toString(),
        status: payment.status,
        createdAt: payment.createdAt.toISOString(),
        paidAt: payment.paidAt?.toISOString() ?? null,
      },
    });
  });
}
