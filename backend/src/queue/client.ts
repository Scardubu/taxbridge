import { Queue } from 'bullmq';
import Redis from 'ioredis';

let redisConnection: Redis | undefined;
let invoiceSyncQueue: Queue | undefined;
let paymentQueue: Queue | undefined;
let deviceSyncQueue: Queue | undefined;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null
    });
  }

  return redisConnection;
}

export function getInvoiceSyncQueue(): Queue {
  if (!invoiceSyncQueue) {
    invoiceSyncQueue = new Queue('invoice-sync', { connection: getRedisConnection() });
  }

  return invoiceSyncQueue;
}

export function getPaymentQueue(): Queue {
  if (!paymentQueue) {
    paymentQueue = new Queue('payment-webhook', { connection: getRedisConnection() });
  }

  return paymentQueue;
}

export function getDeviceSyncQueue(): Queue {
  if (!deviceSyncQueue) {
    deviceSyncQueue = new Queue('device-sync', { connection: getRedisConnection() });
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
  if (!redisConnection) return;
  const redis = redisConnection;
  redisConnection = undefined;
  await redis.quit();
}

/**
 * Enqueue an invoice for background stamping
 */
export async function enqueueInvoiceSync(invoiceId: string): Promise<void> {
  const queue = getInvoiceSyncQueue();
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
