/**
 * TaxBridge — Health Snapshot Job
 * Runs daily to persist TaxHealthSnapshot records for trend analysis (CF-05 fix)
 *
 * Constraints:
 *   C-01  Prisma `any` types only — no Prisma.XxxWhereInput
 *   C-08  No Math.random() — deterministic computation only
 *   C-09  Tax calculations use computeTaxHealthScore from contracts
 *
 * Schedule: Run once per day (e.g. via BullMQ repeated job or node-cron)
 * Triggered by: server startup registration or a BullMQ scheduler
 */

import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import { computeTaxHealthScore } from '../services/tax-intelligence';

const JOB_NAME    = 'health-snapshot';
const BATCH_SIZE  = 50; // Process N users per run to avoid memory spikes

export interface HealthSnapshotJobResult {
  processed: number;
  errors:    number;
  durationMs: number;
}

/**
 * Main job function — computes and persists health snapshots for all active users.
 * Designed to be called from a scheduler (BullMQ, node-cron, or Render cron job).
 */
export async function runHealthSnapshotJob(
  prisma: PrismaClient,
  redis:  Redis,
  log:    FastifyBaseLogger,
): Promise<HealthSnapshotJobResult> {
  const startMs = Date.now();
  let processed = 0;
  let errors    = 0;

  log.info({ job: JOB_NAME }, 'Starting health snapshot job');

  // Get all users with recent activity (invoices in last 90 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const activeUsers: Array<{ id: string }> = await (prisma as any).user.findMany({
    where: {
      invoices: { some: { createdAt: { gte: cutoff } } },
    },
    select:  { id: true },
    orderBy: { createdAt: 'asc' },
  });

  log.info({ job: JOB_NAME, totalUsers: activeUsers.length }, 'Active users fetched');

  // Process in batches to avoid RAM spike
  for (let i = 0; i < activeUsers.length; i += BATCH_SIZE) {
    const batch = activeUsers.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async ({ id: userId }) => {
        try {
          // Compute score
          const score = await computeTaxHealthScore(userId, prisma);

          // Upsert today's snapshot (idempotent — safe to re-run)
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          await (prisma as any).taxHealthSnapshot.upsert({
            where:  { userId_snapshotDate: { userId, snapshotDate: today } },
            create: {
              userId,
              score,
              snapshotDate: today,
              metadata:     JSON.stringify({ computedAt: new Date().toISOString() }),
            },
            update: {
              score,
              metadata: JSON.stringify({ computedAt: new Date().toISOString() }),
            },
          });

          // Invalidate composite cache — fresh snapshot available
          try {
            await redis.del(`dashboard:composite:${userId}`);
          } catch {
            // Non-fatal
          }

          processed++;
        } catch (err) {
          errors++;
          log.error({ job: JOB_NAME, userId, err }, 'Health snapshot failed for user');
        }
      })
    );
  }

  const durationMs = Date.now() - startMs;
  log.info({ job: JOB_NAME, processed, errors, durationMs }, 'Health snapshot job complete');

  return { processed, errors, durationMs };
}

/**
 * Register the job as a BullMQ repeatable job.
 * Call this from server startup (after queue is ready).
 *
 * Example in server.ts:
 *   import { registerHealthSnapshotJob } from './jobs/health-snapshot.job';
 *   await registerHealthSnapshotJob(prisma, redis, log);
 */
export async function registerHealthSnapshotJob(
  prisma: PrismaClient,
  redis:  Redis,
  log:    FastifyBaseLogger,
): Promise<void> {
  // Use node-cron pattern: run at 02:00 AM Lagos time (UTC+1)
  // If BullMQ scheduler is available, prefer that for reliability across restarts.

  try {
    const cron = await import('node-cron');

    // 02:00 AM daily — low-traffic window for Nigerian users
    cron.schedule('0 2 * * *', async () => {
      try {
        await runHealthSnapshotJob(prisma, redis, log);
      } catch (err) {
        log.error({ job: JOB_NAME, err }, 'Health snapshot cron execution failed');
      }
    }, { timezone: 'Africa/Lagos' });

    log.info({ job: JOB_NAME }, 'Health snapshot cron registered (02:00 Africa/Lagos daily)');
  } catch {
    // node-cron not installed — job will need to be triggered externally (Render cron)
    log.warn({ job: JOB_NAME }, 'node-cron not available — register via Render Cron Jobs');
  }
}
