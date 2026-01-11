import { Queue } from 'bullmq';
import Redis from 'ioredis';

let redisConnection: Redis | undefined;
let invoiceSyncQueue: Queue | undefined;
let paymentQueue: Queue | undefined;

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

export async function closeRedisConnection(): Promise<void> {
  if (!redisConnection) return;
  const redis = redisConnection;
  redisConnection = undefined;
  await redis.quit();
}
