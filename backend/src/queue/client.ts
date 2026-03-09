import { Queue } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { createLogger } from '../lib/logger';

const log = createLogger('redis');

let invoiceSyncQueue: Queue | undefined;
let paymentQueue: Queue | undefined;
let deviceSyncQueue: Queue | undefined;
let redisAvailable = true;

const isDevelopment = process.env.NODE_ENV === 'development';
const isDocsMode = process.env.TAXBRIDGE_DOCS_MODE === '1';

/**
 * Lazy-load Redis singleton only when actually needed.
 * In docs mode we never connect — OpenAPI generation must work offline.
 */
export function getRedisConnection() {
  if (isDocsMode) {
    return null;
  }

  if (!redisAvailable && isDevelopment) {
    return null;
  }

  try {
    // Lazy import to avoid module-load-time connection in docs mode
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { redis } = require('../lib/redis');
    return redis;
  } catch (err: any) {
    if (isDevelopment) {
      log.warn('Redis unavailable - continuing without queue support', { error: err?.message ?? String(err) });
      redisAvailable = false;
      return null;
    }

    throw err;
  }
}

export function toBullMQConnection(connection: unknown): ConnectionOptions {
  return connection as ConnectionOptions;
}

export function getInvoiceSyncQueue(): Queue | null {
  const redis = getRedisConnection();
  if (!redis) return null;

  if (!invoiceSyncQueue) {
    invoiceSyncQueue = new Queue('invoice-sync', { connection: toBullMQConnection(redis) });
  }

  return invoiceSyncQueue;
}

export function getPaymentQueue(): Queue | null {
  const redis = getRedisConnection();
  if (!redis) return null;

  if (!paymentQueue) {
    paymentQueue = new Queue('payment-webhook', { connection: toBullMQConnection(redis) });
  }

  return paymentQueue;
}

export function getDeviceSyncQueue(): Queue | null {
  const redis = getRedisConnection();
  if (!redis) return null;

  if (!deviceSyncQueue) {
    deviceSyncQueue = new Queue('device-sync', { connection: toBullMQConnection(redis) });
  }

  return deviceSyncQueue;
}

export async function closeInvoiceSyncQueue(): Promise<void> {
  if (!invoiceSyncQueue) return;
  const queue = invoiceSyncQueue;
  invoiceSyncQueue = undefined;
  await queue.close();
}

export async function closePaymentQueue(): Promise<void> {
  if (!paymentQueue) return;
  const queue = paymentQueue;
  paymentQueue = undefined;
  await queue.close();
}

export async function closeDeviceSyncQueue(): Promise<void> {
  if (!deviceSyncQueue) return;
  const queue = deviceSyncQueue;
  deviceSyncQueue = undefined;
  await queue.close();
}

export async function closeRedisConnection(): Promise<void> {
  const redis = getRedisConnection();
  if (redis) {
    await redis.quit();
  }
}

/**
 * Enqueue an invoice for background stamping
 */
export async function enqueueInvoiceSync(invoiceId: string): Promise<void> {
  const queue = getInvoiceSyncQueue();
  if (!queue) {
    if (isDevelopment) {
      log.warn('Queue unavailable - invoice sync will be processed synchronously');
      return;
    }
    throw new Error('Invoice sync queue unavailable');
  }
  
  await queue.add('process-invoice', { invoiceId }, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100,
    removeOnFail: false
  });
}

/**
 * Enqueue a device sync job for background processing
 */
export async function enqueueDeviceSync(syncJobId: string): Promise<void> {
  const queue = getDeviceSyncQueue();
  if (!queue) {
    if (isDevelopment) {
      log.warn('Queue unavailable - device sync will be processed synchronously');
      return;
    }
    throw new Error('Device sync queue unavailable');
  }
  
  await queue.add('process-sync', { syncJobId }, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 100,
    removeOnFail: false
  });
}
