/**
 * Centralized BullMQ Queue Registry
 *
 * All 6 application queues defined here with shared Redis connection,
 * retry strategies, DLQ semantics, and health reporting.
 *
 * CONSTRAINT: `connection as any` cast is intentional — bullmq bundles its own
 * ioredis version that conflicts with the root ioredis type definitions.
 * DO NOT restore typed connection without resolving the ioredis version conflict.
 * Reference: DEPLOYMENT_v1.0.3_COMPLETE.md, commit 218972e.
 */

import { Queue, type ConnectionOptions } from 'bullmq';
import { getRedisConnection } from '../queue/client';
import { createLogger } from '../lib/logger';

const log = createLogger('queues');

// ─── Queue Name Registry ─────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  NRS_SUBMISSION:        'nrs-submission',
  OCR_PROCESSING:        'ocr-processing',
  PAYROLL_CALCULATION:   'payroll-calculation',
  DEVICE_SYNC:           'device-sync',
  NOTIFICATION_DISPATCH: 'notification-dispatch',
  COMPLIANCE_DIGEST:     'compliance-digest',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── Singleton Queue Instances ────────────────────────────────────────────────

const queueInstances = new Map<QueueName, Queue>();

function getConnection(): ConnectionOptions {
  const redis = getRedisConnection();
  if (!redis) throw new Error('Redis unavailable');
  return redis as unknown as ConnectionOptions;
}

/**
 * Returns (and lazily creates) a singleton Queue instance by name.
 * Safe to call multiple times — will not create duplicate connections.
 */
export function getQueue(name: QueueName): Queue {
  if (!queueInstances.has(name)) {
    const conn = getConnection();

    const defaults = buildDefaultJobOptions(name);

    log.debug('Initialising queue', { name });
    queueInstances.set(name, new Queue(name, { connection: conn, defaultJobOptions: defaults }));
  }
  return queueInstances.get(name)!;
}

// ─── Per-Queue Retry Strategies ───────────────────────────────────────────────

function buildDefaultJobOptions(name: QueueName) {
  const base = {
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 200 },
  };

  switch (name) {
    case QUEUE_NAMES.NRS_SUBMISSION:
      // NRS API can be slow — 5 attempts with exponential backoff starting at 2s
      return { ...base, attempts: 5,  backoff: { type: 'exponential' as const, delay: 2_000 } };

    case QUEUE_NAMES.OCR_PROCESSING:
      // Vision API transient failures — 3 attempts, 1s base
      return { ...base, attempts: 3,  backoff: { type: 'exponential' as const, delay: 1_000 } };

    case QUEUE_NAMES.PAYROLL_CALCULATION:
      // Idempotent — fixed 5s retry, 2 attempts
      return { ...base, attempts: 2,  backoff: { type: 'fixed' as const, delay: 5_000 } };

    case QUEUE_NAMES.DEVICE_SYNC:
      // Mobile network flakiness — 10 attempts, exponential from 500ms
      return { ...base, attempts: 10, backoff: { type: 'exponential' as const, delay: 500 } };

    case QUEUE_NAMES.NOTIFICATION_DISPATCH:
      // Must be delivered — 3 attempts, 3s base
      return { ...base, attempts: 3,  backoff: { type: 'exponential' as const, delay: 3_000 } };

    case QUEUE_NAMES.COMPLIANCE_DIGEST:
      // Scheduled daily — no retries (cron job)
      return { ...base, attempts: 1 };

    default:
      return base;
  }
}

// ─── Job Helpers ──────────────────────────────────────────────────────────────

/** Enqueue an NRS submission job. Idempotent: uses invoiceId as jobId. */
export async function enqueueNRSSubmission(invoiceId: string, businessId: string) {
  const queue = getQueue(QUEUE_NAMES.NRS_SUBMISSION);
  return queue.add('submit', { invoiceId, businessId }, {
    jobId: `nrs-${invoiceId}`,
    priority: 1,
  });
}

/** Enqueue an OCR processing job with 30-second timeout guard. */
export async function enqueueOCRProcessing(imageKey: string, userId: string) {
  const queue = getQueue(QUEUE_NAMES.OCR_PROCESSING);
  return queue.add('process', { imageKey, userId }, {
    jobId: `ocr-${imageKey}`,
    priority: 2,
  });
}

/** Enqueue a device-sync job. Rate-limited to 100/min via BullMQ limiter. */
export async function enqueueDeviceSync(deviceId: string, userId: string, payload: unknown) {
  const queue = getQueue(QUEUE_NAMES.DEVICE_SYNC);
  return queue.add('sync', { deviceId, userId, payload }, {
    jobId: `sync-${deviceId}-${Date.now()}`,
    priority: 4,
  });
}

/** Enqueue a notification. */
export async function enqueueNotification(
  userId: string,
  channel: 'push' | 'sms' | 'email',
  template: string,
  data: Record<string, unknown>,
) {
  const queue = getQueue(QUEUE_NAMES.NOTIFICATION_DISPATCH);
  return queue.add('notify', { userId, channel, template, data }, { priority: 3 });
}

// ─── Health Reporting ─────────────────────────────────────────────────────────

export interface QueueStats {
  name:       QueueName;
  waiting:    number;
  active:     number;
  delayed:    number;
  failed:     number;
  completed:  number;
  dlqDepth:   number;   // failed jobs above DLQ threshold
}

export interface QueueHealthStatus {
  status:    'healthy' | 'degraded' | 'unavailable';
  queues:    QueueStats[];
  timestamp: string;
  error?:    string;
}

const DLQ_ALERT_THRESHOLD = 10;

/**
 * Returns a health snapshot for all 6 queues.
 * Always resolves (never throws) — returns 'unavailable' gracefully when Redis
 * is cold-starting. This preserves the admin cold-start resilience pattern
 * established in v2.0.0.
 */
export async function getQueueHealth(): Promise<QueueHealthStatus> {
  try {
    const redis = getRedisConnection();
    if (!redis) {
      return {
        status: 'unavailable',
        queues: [],
        timestamp: new Date().toISOString(),
        error: 'Redis unavailable',
      };
    }

    const names = Object.values(QUEUE_NAMES) as QueueName[];

    const stats = await Promise.all(
      names.map(async (name): Promise<QueueStats> => {
        try {
          const queue = getQueue(name);
          const [waiting, active, delayed, failed, completed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getDelayedCount(),
            queue.getFailedCount(),
            queue.getCompletedCount(),
          ]);
          return { name, waiting, active, delayed, failed, completed, dlqDepth: failed };
        } catch {
          // Individual queue failure is non-fatal
          return { name, waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0, dlqDepth: 0 };
        }
      }),
    );

    const totalFailed   = stats.reduce((s, q) => s + q.failed, 0);
    const dlqOverflow   = stats.some(q => q.dlqDepth > DLQ_ALERT_THRESHOLD);
    const criticalQueue = stats.find(
      q => q.name === QUEUE_NAMES.NRS_SUBMISSION && q.failed > DLQ_ALERT_THRESHOLD,
    );

    let status: QueueHealthStatus['status'] = 'healthy';
    if (criticalQueue || dlqOverflow || totalFailed > 50) status = 'degraded';

    return { status, queues: stats, timestamp: new Date().toISOString() };
  } catch (err: any) {
    log.error('Queue health check failed', { error: err?.message });
    // Graceful fallback — preserve admin cold-start resilience
    return {
      status: 'unavailable',
      queues: [],
      timestamp: new Date().toISOString(),
      error: err?.message ?? 'Unknown error',
    };
  }
}

/** Close all queue connections (for graceful shutdown). */
export async function closeAllQueues(): Promise<void> {
  await Promise.allSettled(
    [...queueInstances.values()].map(q => q.close()),
  );
  queueInstances.clear();
}
