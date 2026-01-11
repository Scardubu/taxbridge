import path from 'path';

import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { closeRedisConnection, getRedisConnection } from './client';
import { submitToDigiTax } from '../../integrations/digitax/adapter';
import { DigiTaxError } from '../../integrations/digitax/adapter';
import { generateUBL } from '../lib/ubl/generator';
import { validateUblXml } from '../lib/ubl/validate';
import { createLogger } from '../lib/logger';
import { notifyInvoiceStamped } from '../services/notifications';

const prisma = new PrismaClient();

const log = createLogger('worker');

export const invoiceSyncWorker = new Worker(
  'invoice-sync',
  async (job) => {
    const invoiceId = String((job.data as any)?.invoiceId || '');
    if (!invoiceId) {
      job.discard();
      throw new Error('Missing invoiceId');
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { user: true }
    });

    if (!invoice) {
      job.discard();
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    if (invoice.status === 'stamped') {
      await prisma.auditLog.create({
        data: {
          action: 'invoice_sync_skipped_already_stamped',
          userId: invoice.userId,
          metadata: { invoiceId }
        }
      });
      return { status: 'skipped' };
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'processing' }
    });

    await prisma.syncQueue.create({
      data: {
        invoiceId,
        status: 'processing',
        retryCount: job.attemptsMade
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'invoice_sync_started',
        userId: invoice.userId,
        metadata: { invoiceId, attemptsMade: job.attemptsMade }
      }
    });

    try {
      const merchantTin = invoice.user.tin;
      if (!merchantTin) {
        job.discard();
        throw new Error('Missing merchant TIN');
      }

      const issueDate = invoice.createdAt.toISOString().slice(0, 10);

      const rawItems = invoice.items as any;
      if (!Array.isArray(rawItems)) {
        throw new Error('Invoice items is not an array');
      }

      const ublXml = generateUBL({
        id: invoice.id,
        issueDate,
        supplierTIN: merchantTin,
        supplierName: invoice.user.name,
        customerName: invoice.customerName ?? undefined,
        items: rawItems,
        subtotal: Number(invoice.subtotal),
        vat: Number(invoice.vat),
        total: Number(invoice.total)
      });

      const xsdPath = process.env.UBL_XSD_PATH;
      if (xsdPath) {
        const validation = validateUblXml(ublXml, xsdPath);
        if (!validation.ok) {
          throw new Error(validation.error);
        }
      }

      const mockMode = String(process.env.DIGITAX_MOCK_MODE || 'true').toLowerCase() !== 'false';

      const submitResult = await submitToDigiTax(
        { invoiceId, ublXml },
        {
          apiUrl: String(process.env.DIGITAX_API_URL),
          apiKey: process.env.DIGITAX_API_KEY,
          hmacSecret: process.env.DIGITAX_HMAC_SECRET,
          mockMode
        }
      );

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'stamped',
          ublXml,
          nrsReference: submitResult.nrsReference,
          qrCode: submitResult.qrCode
        }
      });

      await prisma.syncQueue.create({
        data: {
          invoiceId,
          status: 'stamped',
          retryCount: job.attemptsMade
        }
      });

      await prisma.auditLog.create({
        data: {
          action: 'invoice_sync_succeeded',
          userId: invoice.userId,
          metadata: { invoiceId, nrsReference: submitResult.nrsReference, mockMode }
        }
      });

      // Notify user if opted-in
      try {
        if (invoice.user && (invoice.user as any).smsOptIn && invoice.user.phone) {
          await notifyInvoiceStamped(invoice.user.phone, invoiceId, submitResult.nrsReference);
        }
      } catch (notifyErr) {
        log.error('Failed to notify user of invoice stamping', { err: notifyErr, invoiceId });
      }

      return { status: 'stamped', nrsReference: submitResult.nrsReference };
    } catch (err) {
      if (err instanceof DigiTaxError && !err.retriable) {
        job.discard();
      }

      const message = err instanceof Error ? err.message : 'Invoice sync failed';

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'failed' }
      });

      await prisma.syncQueue.create({
        data: {
          invoiceId,
          status: 'failed',
          retryCount: job.attemptsMade,
          error: message
        }
      });

      await prisma.auditLog.create({
        data: {
          action: 'invoice_sync_failed',
          userId: invoice.userId,
          metadata: { invoiceId, error: message, attemptsMade: job.attemptsMade }
        }
      });

      throw err;
    }
  },
  { connection: getRedisConnection() }
);

invoiceSyncWorker.on('completed', (job, result) => {
  log.info('job completed', {
    jobId: job.id,
    invoiceId: (job.data as any)?.invoiceId,
    result
  });
});

invoiceSyncWorker.on('failed', (job, err) => {
  log.error('job failed', {
    jobId: job?.id,
    invoiceId: (job?.data as any)?.invoiceId,
    err
  });
});

async function shutdown() {
  try {
    await invoiceSyncWorker.close();
  } catch {
    // ignore
  }
  try {
    await closeRedisConnection();
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
