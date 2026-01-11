import path from 'path';
import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { getRedisConnection } from './client';
import { remitaAdapter } from '../integrations/remita/adapter';
import { createLogger } from '../lib/logger';
import { notifyPaymentConfirmed } from '../services/notifications';

const prisma = new PrismaClient();
const log = createLogger('payment-worker');

export const paymentWebhookWorker = new Worker(
  'payment-webhook',
  async (job) => {
    const payload = job.data as any;
    const rrr = String(payload?.rrr || '');
    if (!rrr) {
      job.discard();
      throw new Error('Missing rrr in job payload');
    }

    const payment = await prisma.payment.findUnique({ where: { rrr }, include: { invoice: true } });
    if (!payment) {
      job.discard();
      throw new Error(`Payment not found for RRR ${rrr}`);
    }

    if (payment.status === 'paid') {
      log.info('Payment already marked paid — skipping', { rrr, paymentId: payment.id });
      return { status: 'skipped' };
    }

    try {
      // Prefer status from payload if present
      const incomingStatus = String(payload?.status || payload?.paymentStatus || '').toLowerCase();

      let finalStatus = 'pending';
      if (incomingStatus === 'success' || incomingStatus === '00' || incomingStatus === 'paid') {
        finalStatus = 'paid';
      } else {
        // fallback to verification with Remita API
        const verification = await remitaAdapter.verifyPayment(rrr, payment.invoiceId);
        finalStatus = verification.status;
      }

      if (finalStatus === 'paid') {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'paid', paidAt: new Date(), transactionRef: payload.transactionRef ?? payload?.transactionRef } });
        await prisma.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'paid' } });

        await prisma.auditLog.create({ data: { action: 'payment_confirmed', userId: payment.invoice.userId, metadata: { invoiceId: payment.invoiceId, rrr } } });

        // Notify user if opted-in
        try {
          const user = await prisma.user.findUnique({ where: { id: payment.invoice.userId } });
          if (user && (user as any).smsOptIn) {
            await notifyPaymentConfirmed(user.phone, parseFloat(payment.amount.toString()), rrr);
          }
        } catch (notifyErr) {
          log.error('Failed to notify user of payment', { err: notifyErr });
        }

        log.info('Payment confirmed and invoice marked paid', { rrr, invoiceId: payment.invoiceId });

        return { status: 'paid' };
      }

      return { status: finalStatus };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'payment worker error';
      log.error('Payment worker failed', { err: message, rrr });
      throw err;
    }
  },
  { connection: getRedisConnection() }
);

paymentWebhookWorker.on('completed', (job, result) => {
  log.info('payment job completed', { jobId: job.id, rrr: (job.data as any)?.rrr, result });
});

paymentWebhookWorker.on('failed', (job, err) => {
  log.error('payment job failed', { jobId: job?.id, rrr: (job?.data as any)?.rrr, err });
});

async function shutdown() {
  try {
    await paymentWebhookWorker.close();
  } catch {
    // ignore
  }
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});

process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection', { err: reason });
  void shutdown().finally(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  log.error('uncaughtException', { err });
  void shutdown().finally(() => process.exit(1));
});
