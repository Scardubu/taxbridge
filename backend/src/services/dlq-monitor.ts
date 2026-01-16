/**
 * Dead Letter Queue (DLQ) Monitoring Service
 * 
 * Monitors failed jobs in BullMQ queues and triggers alerts when thresholds are exceeded.
 * Integrates with monitoring systems (Sentry, custom webhooks) for production visibility.
 */

import { Queue } from 'bullmq';
import { getRedisConnection } from '../queue/client';
import { createLogger } from '../lib/logger';
import * as Sentry from '@sentry/node';

const log = createLogger('dlq-monitor');

interface DLQAlert {
  queueName: string;
  failedCount: number;
  threshold: number;
  timestamp: Date;
  failedJobs: Array<{
    jobId: string;
    failedReason: string;
    attemptsMade: number;
  }>;
}

// Configurable thresholds
const DLQ_THRESHOLDS = {
  'invoice-sync': Number(process.env.DLQ_THRESHOLD_INVOICE_SYNC || '10'),
  'payment-webhook': Number(process.env.DLQ_THRESHOLD_PAYMENT || '5'),
  'email-queue': Number(process.env.DLQ_THRESHOLD_EMAIL || '20'),
  'sms-queue': Number(process.env.DLQ_THRESHOLD_SMS || '15'),
};

const CHECK_INTERVAL_MS = Number(process.env.DLQ_CHECK_INTERVAL_MS || '300000'); // 5 minutes

export class DLQMonitor {
  private queues: Map<string, Queue> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

  constructor(queueNames: string[]) {
    const redis = getRedisConnection();
    
    for (const name of queueNames) {
      this.queues.set(name, new Queue(name, { connection: redis }));
    }
  }

  /**
   * Start monitoring DLQs
   */
  start(): void {
    if (this.intervalId) {
      log.warn('DLQ monitor already running');
      return;
    }

    log.info('Starting DLQ monitor', { 
      interval: CHECK_INTERVAL_MS,
      thresholds: DLQ_THRESHOLDS 
    });

    // Initial check
    this.checkAllQueues();

    // Periodic checks
    this.intervalId = setInterval(() => {
      this.checkAllQueues();
    }, CHECK_INTERVAL_MS);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('DLQ monitor stopped');
    }
  }

  /**
   * Check all registered queues for failed jobs
   */
  private async checkAllQueues(): Promise<void> {
    for (const [name, queue] of this.queues) {
      try {
        await this.checkQueue(name, queue);
      } catch (error) {
        log.error('DLQ check failed for queue', { queue: name, error });
      }
    }
  }

  /**
   * Check a specific queue and alert if threshold exceeded
   */
  private async checkQueue(name: string, queue: Queue): Promise<void> {
    const threshold = DLQ_THRESHOLDS[name as keyof typeof DLQ_THRESHOLDS] || 10;

    const failedJobs = await queue.getFailed(0, threshold + 10);
    const failedCount = failedJobs.length;

    log.debug('DLQ check', { queue: name, failedCount, threshold });

    if (failedCount >= threshold) {
      const alert: DLQAlert = {
        queueName: name,
        failedCount,
        threshold,
        timestamp: new Date(),
        failedJobs: failedJobs.slice(0, 5).map(job => ({
          jobId: job.id || 'unknown',
          failedReason: job.failedReason || 'Unknown error',
          attemptsMade: job.attemptsMade,
        })),
      };

      await this.raiseAlert(alert);
    }
  }

  /**
   * Raise alert via configured channels
   */
  private async raiseAlert(alert: DLQAlert): Promise<void> {
    log.error('DLQ threshold exceeded', {
      queueName: alert.queueName,
      failedCount: alert.failedCount,
      threshold: alert.threshold,
      timestamp: alert.timestamp.toISOString(),
      failedJobCount: alert.failedJobs.length,
    });

    // Sentry integration
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(`DLQ Alert: ${alert.queueName} has ${alert.failedCount} failed jobs (threshold: ${alert.threshold})`, {
        level: 'error',
        tags: {
          queue: alert.queueName,
          component: 'dlq-monitor',
        },
        contexts: {
          dlq: {
            failedCount: alert.failedCount,
            threshold: alert.threshold,
            failedJobs: alert.failedJobs,
          },
        },
      });
    }

    // Webhook notification (optional)
    if (process.env.DLQ_ALERT_WEBHOOK_URL) {
      try {
        await fetch(process.env.DLQ_ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
      } catch (error) {
        log.error('Failed to send DLQ webhook alert', { error });
      }
    }
  }

  /**
   * Get current DLQ metrics for all queues
   */
  async getMetrics(): Promise<Record<string, { failedCount: number; waitingCount: number }>> {
    const metrics: Record<string, { failedCount: number; waitingCount: number }> = {};

    for (const [name, queue] of this.queues) {
      try {
        const [failedJobs, waitingJobs] = await Promise.all([
          queue.getFailed(0, 0), // Just get count
          queue.getWaiting(0, 0),
        ]);

        metrics[name] = {
          failedCount: failedJobs.length,
          waitingCount: waitingJobs.length,
        };
      } catch (error) {
        log.error('Failed to get queue metrics', { queue: name, error });
        metrics[name] = { failedCount: -1, waitingCount: -1 };
      }
    }

    return metrics;
  }

  /**
   * Manually retry all failed jobs in a queue (admin operation)
   */
  async retryFailedJobs(queueName: string, maxRetries = 100): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not registered`);
    }

    const failedJobs = await queue.getFailed(0, maxRetries);
    let retriedCount = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) {
        log.error('Failed to retry job', { jobId: job.id, error });
      }
    }

    log.info('Retried failed jobs', { queue: queueName, retriedCount, totalFailed: failedJobs.length });
    return retriedCount;
  }

  /**
   * Clean up old failed jobs (retention policy)
   */
  async cleanOldFailedJobs(queueName: string, olderThanDays = 30): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not registered`);
    }

    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const failedJobs = await queue.getFailed(0, 1000);
    let removedCount = 0;

    for (const job of failedJobs) {
      if (job.finishedOn && job.finishedOn < cutoffTime) {
        try {
          await job.remove();
          removedCount++;
        } catch (error) {
          log.error('Failed to remove old job', { jobId: job.id, error });
        }
      }
    }

    log.info('Cleaned old failed jobs', { queue: queueName, removedCount, cutoffDays: olderThanDays });
    return removedCount;
  }
}

// Singleton instance
let dlqMonitor: DLQMonitor | null = null;

/**
 * Initialize DLQ monitoring for specified queues
 */
export function initializeDLQMonitoring(queueNames: string[]): DLQMonitor {
  if (!dlqMonitor) {
    dlqMonitor = new DLQMonitor(queueNames);
    dlqMonitor.start();
  }
  return dlqMonitor;
}

/**
 * Get DLQ monitor instance
 */
export function getDLQMonitor(): DLQMonitor | null {
  return dlqMonitor;
}

/**
 * Shutdown DLQ monitoring
 */
export function shutdownDLQMonitoring(): void {
  if (dlqMonitor) {
    dlqMonitor.stop();
    dlqMonitor = null;
  }
}
