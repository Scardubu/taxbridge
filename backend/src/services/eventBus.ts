/**
 * EventBus — TaxBridge V13 Sovereign
 *
 * Node EventEmitter with setMaxListeners(30) to prevent warnings.
 * BullMQ queue instances exported here.
 * createWorkerConnection() from lib/redis.ts provides dedicated connections for BullMQ Workers.
 *
 * C-46: Workers use createWorkerConnection() — not the global redis singleton.
 */
import { EventEmitter } from 'events';
import { Queue }        from 'bullmq';
import { redis, createWorkerConnection } from '../lib/redis';

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(30);

// ─── BullMQ Queue Instances ──────────────────────────────────────────────────
export const pdfQueue = new Queue('pdf-generation', {
  connection:        redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
});

export const nrsStampQueue = new Queue('nrs-stamp', {
  connection:        redis,
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 3000 } },
});

export const notificationQueue = new Queue('notifications', {
  connection:        redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'fixed', delay: 1000 } },
});

// Re-export for BullMQ Worker usage
export { createWorkerConnection };
