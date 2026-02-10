import { Queue } from 'bullmq';
import Redis from 'ioredis';

let redisConnection: Redis | undefined;
let invoiceSyncQueue: Queue | undefined;
let paymentQueue: Queue | undefined;
let deviceSyncQueue: Queue | undefined;
let redisAvailable = true;

const isDevelopment = process.env.NODE_ENV === 'development';

export function getRedisConnection(): Redis | null {
  if (!redisAvailable && isDevelopment) {
    return null;
  }

  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Parse Redis URL for Redis Cloud connection
    // Format: rediss://username:password@host:port or redis://localhost:6379
    const isRedisCloud = redisUrl.includes('redislabs.com') || redisUrl.includes('cloud.redis');
    
    if (isRedisCloud) {
      // Parse Redis Cloud URL manually
      const urlMatch = redisUrl.match(/redis(?:s)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
      if (urlMatch) {
        const [, username, password, host, port] = urlMatch;
        
        // Try connection without TLS first (some Redis Cloud instances don't use TLS)
        console.log(`🔄 Connecting to Redis Cloud: ${host}:${port}`);
        
        redisConnection = new Redis({
          host,
          port: parseInt(port),
          username,
          password,
          // Don't specify TLS - let Redis Cloud handle it
          maxRetriesPerRequest: null,
          retryStrategy: (times: number) => {
            if (isDevelopment && times > 3) {
              console.warn('⚠️  Redis Cloud unavailable - running in degraded mode');
              redisAvailable = false;
              return null;
            }
            const delay = Math.min(times * 1000, 10000);
            return delay;
          },
          lazyConnect: true,
          enableOfflineQueue: false,
          connectTimeout: 10000
        });
      } else {
        throw new Error('Invalid Redis Cloud URL format');
      }
    } else {
      // Standard Redis connection (local or non-cloud)
      redisConnection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => {
          if (isDevelopment && times > 3) {
            console.warn('⚠️  Redis unavailable - running in degraded mode (queues disabled)');
            redisAvailable = false;
            return null;
          }
          const delay = Math.min(times * 1000, 10000);
          return delay;
        },
        lazyConnect: true,
        enableOfflineQueue: false
      });
    }

    // Handle connection errors gracefully
    redisConnection.on('error', (err) => {
      if (isDevelopment) {
        console.warn('⚠️  Redis connection error (development mode):', err.message);
        redisAvailable = false;
      } else {
        console.error('❌ Redis connection error:', err);
      }
    });

    redisConnection.on('connect', () => {
      console.log('✅ Redis connected successfully');
      redisAvailable = true;
    });

    // Attempt to connect
    redisConnection.connect().catch((err) => {
      if (isDevelopment) {
        console.warn('⚠️  Redis not available - continuing without queue support');
        redisAvailable = false;
      } else {
        console.error('❌ Failed to connect to Redis:', err);
        throw err;
      }
    });
  }

  return redisConnection;
}

export function getInvoiceSyncQueue(): Queue | null {
  const redis = getRedisConnection();
  if (!redis) return null;

  if (!invoiceSyncQueue) {
    invoiceSyncQueue = new Queue('invoice-sync', { connection: redis });
  }

  return invoiceSyncQueue;
}

export function getPaymentQueue(): Queue | null {
  const redis = getRedisConnection();
  if (!redis) return null;

  if (!paymentQueue) {
    paymentQueue = new Queue('payment-webhook', { connection: redis });
  }

  return paymentQueue;
}

export function getDeviceSyncQueue(): Queue | null {
  const redis = getRedisConnection();
  if (!redis) return null;

  if (!deviceSyncQueue) {
    deviceSyncQueue = new Queue('device-sync', { connection: redis });
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
  if (!queue) {
    if (isDevelopment) {
      console.warn('⚠️  Queue unavailable - invoice sync will be processed synchronously');
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
      console.warn('⚠️  Queue unavailable - device sync will be processed synchronously');
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
