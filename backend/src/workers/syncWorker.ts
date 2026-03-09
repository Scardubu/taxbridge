import path from 'path';

import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import { getPrismaClient } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { getRedisConnection, toBullMQConnection } from '../queue/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const log = createLogger('device-sync-worker');
const prisma = getPrismaClient();

function isDeviceSyncEnabled(): boolean {
  return String(process.env.FEATURE_DEVICE_SYNC || 'false').toLowerCase() === 'true';
}

type InvoicePayload = {
  id?: string;
  customerName?: string | null;
  status?: string;
  subtotal?: number;
  vat?: number;
  total?: number;
  items?: unknown;
  ublXml?: string | null;
  nrsReference?: string | null;
  qrCode?: string | null;
  version?: number;
};

function buildInvoiceUpdatePayload(payload: InvoicePayload): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (payload.customerName !== undefined) data.customerName = payload.customerName;
  if (payload.status !== undefined) data.status = payload.status;
  if (payload.subtotal !== undefined) data.subtotal = payload.subtotal;
  if (payload.vat !== undefined) data.vat = payload.vat;
  if (payload.total !== undefined) data.total = payload.total;
  if (payload.items !== undefined) data.items = payload.items;
  if (payload.ublXml !== undefined) data.ublXml = payload.ublXml;
  if (payload.nrsReference !== undefined) data.nrsReference = payload.nrsReference;
  if (payload.qrCode !== undefined) data.qrCode = payload.qrCode;

  return data;
}

async function notifyDevice(userId: string, deviceId: string, event: string, metadata: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      action: 'device_sync_notification_queued',
      userId,
      metadata: {
        deviceId,
        event,
        ...metadata
      }
    }
  });
}

export async function processSyncJob(syncJobId: string): Promise<{ status: string; conflictId?: string }> {
  if (!isDeviceSyncEnabled()) {
    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        result: { error: 'feature_disabled' }
      }
    });
    return { status: 'feature_disabled' };
  }

  const syncJob = await prisma.syncJob.findUnique({
    where: { id: syncJobId },
    include: { device: true, invoice: true }
  });

  if (!syncJob) {
    throw new Error(`SyncJob not found: ${syncJobId}`);
  }

  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: { status: 'processing', startedAt: syncJob.startedAt ?? new Date() }
  });

  const payload = syncJob.payload as InvoicePayload;

  if (syncJob.entity !== 'invoice') {
    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        result: { error: `Entity ${syncJob.entity} not supported` }
      }
    });
    return { status: 'failed' };
  }

  const invoiceId = syncJob.invoiceId || payload?.id;
  if (!invoiceId) {
    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        result: { error: 'Missing invoice id' }
      }
    });
    return { status: 'failed' };
  }

  const existingInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

  if (syncJob.action === 'create') {
    if (existingInvoice) {
      const conflict = await prisma.conflict.create({
        data: {
          invoiceId,
          userId: syncJob.userId,
          deviceId: syncJob.deviceId,
          localVersion: syncJob.clientVersion,
          serverVersion: existingInvoice.version,
          localData: payload as any,
          serverData: existingInvoice as any
        }
      });

      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'conflict',
          completedAt: new Date(),
          result: { conflictId: conflict.id }
        }
      });

      await notifyDevice(syncJob.userId, syncJob.deviceId, 'conflict_created', { conflictId: conflict.id, invoiceId });

      return { status: 'conflict', conflictId: conflict.id };
    }

    const requiredMissing = ['subtotal', 'vat', 'total', 'items'].filter((field) => (payload as any)?.[field] === undefined);
    if (requiredMissing.length > 0) {
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          result: { error: `Missing required invoice fields: ${requiredMissing.join(', ')}` }
        }
      });
      return { status: 'failed' };
    }

    await prisma.invoice.create({
      data: {
        id: invoiceId,
        userId: syncJob.userId,
        customerName: payload.customerName ?? null,
        status: payload.status ?? 'queued',
        subtotal: payload.subtotal as number,
        vat: payload.vat as number,
        total: payload.total as number,
        items: payload.items as any,
        ublXml: payload.ublXml ?? null,
        nrsReference: payload.nrsReference ?? null,
        qrCode: payload.qrCode ?? null,
        version: payload.version ?? 1
      }
    });

    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: {
        status: 'synced',
        completedAt: new Date(),
        result: { invoiceId }
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'device_sync_invoice_created',
        userId: syncJob.userId,
        metadata: { invoiceId, deviceId: syncJob.deviceId }
      }
    });

    return { status: 'synced' };
  }

  if (syncJob.action === 'update') {
    if (!existingInvoice) {
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          result: { error: 'Invoice not found' }
        }
      });
      return { status: 'failed' };
    }

    if (existingInvoice.version > syncJob.clientVersion) {
      const conflict = await prisma.conflict.create({
        data: {
          invoiceId,
          userId: syncJob.userId,
          deviceId: syncJob.deviceId,
          localVersion: syncJob.clientVersion,
          serverVersion: existingInvoice.version,
          localData: payload as any,
          serverData: existingInvoice as any
        }
      });

      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'conflict',
          completedAt: new Date(),
          result: { conflictId: conflict.id }
        }
      });

      await notifyDevice(syncJob.userId, syncJob.deviceId, 'conflict_created', { conflictId: conflict.id, invoiceId });

      return { status: 'conflict', conflictId: conflict.id };
    }

    const updatePayload = buildInvoiceUpdatePayload(payload);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ...updatePayload,
        version: { increment: 1 }
      }
    });

    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: {
        status: 'synced',
        completedAt: new Date(),
        result: { invoiceId }
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'device_sync_invoice_updated',
        userId: syncJob.userId,
        metadata: { invoiceId, deviceId: syncJob.deviceId }
      }
    });

    return { status: 'synced' };
  }

  // Handle delete action
  if (syncJob.action === 'delete') {
    if (!existingInvoice) {
      // Invoice already deleted or never existed - mark as synced
      await prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: 'synced',
          completedAt: new Date(),
          result: { message: 'Invoice already deleted or not found' }
        }
      });
      return { status: 'synced' };
    }

    // Soft delete the invoice
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'deleted',
        version: { increment: 1 }
      }
    });

    await prisma.syncJob.update({
      where: { id: syncJobId },
      data: {
        status: 'synced',
        completedAt: new Date(),
        result: { invoiceId, deleted: true }
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'device_sync_invoice_deleted',
        userId: syncJob.userId,
        metadata: { invoiceId, deviceId: syncJob.deviceId }
      }
    });

    return { status: 'synced' };
  }

  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: {
      status: 'failed',
      completedAt: new Date(),
      result: { error: `Action ${syncJob.action} not supported` }
    }
  });

  return { status: 'failed' };
}

export function createDeviceSyncWorker(): Worker {
  return new Worker(
    'device-sync',
    async (job) => {
      const syncJobId = String((job.data as any)?.syncJobId || '');
      if (!syncJobId) {
        job.discard();
        throw new Error('Missing syncJobId');
      }

      try {
        const result = await processSyncJob(syncJobId);
        log.info('device sync job processed', { syncJobId, result });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'device sync job failed';
        log.error('device sync job failed', { syncJobId, err: message });

        await prisma.syncJob.update({
          where: { id: syncJobId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            attempts: { increment: 1 },
            lastError: message,
            result: { error: message }
          }
        });

        throw err;
      }
    },
    { connection: toBullMQConnection(getRedisConnection()) }
  );
}
