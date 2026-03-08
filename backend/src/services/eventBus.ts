/**
 * EventBus — TaxBridge V13 Sovereign
 *
 * Node EventEmitter with setMaxListeners(30) to prevent warnings.
 * BullMQ queue instances exported here (lazy-initialized to support docs mode).
 * createWorkerConnection() here provides dedicated connections for BullMQ Workers.
 *
 * C-46: Workers use createWorkerConnection() — not the global redis singleton.
 */
import { EventEmitter } from 'events';
import IORedis from 'ioredis';
import { Queue }        from 'bullmq';
import { redis } from '../lib/redis';

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(30);

const isDocsMode = process.env.TAXBRIDGE_DOCS_MODE === '1';

// ─── BullMQ Queue Instances (lazy-initialized) ───────────────────────────────
let _pdfQueue: Queue | null = null;
let _nrsStampQueue: Queue | null = null;
let _notificationQueue: Queue | null = null;

export function getPdfQueue(): Queue | null {
  if (isDocsMode || !redis) return null;
  if (!_pdfQueue) {
    _pdfQueue = new Queue('pdf-generation', {
      connection:        redis,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    });
  }
  return _pdfQueue;
}

export function getNrsStampQueue(): Queue | null {
  if (isDocsMode || !redis) return null;
  if (!_nrsStampQueue) {
    _nrsStampQueue = new Queue('nrs-stamp', {
      connection:        redis,
      defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 3000 } },
    });
  }
  return _nrsStampQueue;
}

export function getNotificationQueue(): Queue | null {
  if (isDocsMode || !redis) return null;
  if (!_notificationQueue) {
    _notificationQueue = new Queue('notifications', {
      connection:        redis,
      defaultJobOptions: { attempts: 3, backoff: { type: 'fixed', delay: 1000 } },
    });
  }
  return _notificationQueue;
}

// Legacy exports for backward compatibility (may be null in docs mode)
export const pdfQueue = isDocsMode ? null : getPdfQueue();
export const nrsStampQueue = isDocsMode ? null : getNrsStampQueue();
export const notificationQueue = isDocsMode ? null : getNotificationQueue();

export function createWorkerConnection(): IORedis {
  if (isDocsMode) {
    throw new Error('Cannot create worker connection in docs mode');
  }

  return new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });
}
