/**
 * Cron Orchestrator — TaxBridge V12
 *
 * Central registry of ALL scheduled jobs.
 * Exactly 7 jobs — as required by V12 spec §10.
 *
 * Rules:
 *   - NO scattered setInterval() allowed anywhere else in the codebase.
 *   - All timing uses node-cron schedule strings (WAT = UTC+1).
 *   - Each job has a name, schedule, and isolated error handling.
 *   - A failed job logs + Sentry but NEVER crashes the server.
 *
 * Jobs:
 *   1. taxHealthSnapshot   — daily at 03:00 WAT (02:00 UTC)
 *   2. riskScoringUpdate   — every 6 hours
 *   3. deadlineReminders   — daily at 08:00 WAT (07:00 UTC)
 *   4. nrsStampRetry       — every hour
 *   5. sessionCleanup      — daily at 00:00 WAT (23:00 UTC prev day)
 *   6. dlqMonitor          — every 15 minutes
 *   7. keepAlive           — every 10 minutes (Render cold-start prevention)
 */

import cron from 'node-cron';
import * as Sentry from '@sentry/node';
import { createLogger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { getRedisConnection } from '../queue/client';

const log = createLogger('cron-orchestrator');

// ─── Type helpers ─────────────────────────────────────────────────────────────

interface CronJob {
  name:     string;
  schedule: string;
  handler:  () => Promise<void>;
}

function safe(name: string, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const t0 = Date.now();
    try {
      await fn();
      log.info('Cron job completed', { job: name, ms: Date.now() - t0 });
    } catch (err) {
      Sentry.captureException(err, { extra: { cronJob: name } });
      log.error('Cron job failed — continuing', { err, job: name });
    }
  };
}

// ─── Job 1: Tax health snapshot ───────────────────────────────────────────────
// 03:00 WAT = 02:00 UTC (spec §10: "0 3 * * * WAT")

async function taxHealthSnapshot(): Promise<void> {
  log.info('Running tax health snapshot');
  const orgs = await (prisma as any).org.findMany({
    where:   { isActive: true },
    select:  { id: true },
    take:    500,
  });

  for (const org of orgs) {
    await (prisma as any).taxHealthSnapshot.upsert({
      where:  { orgId_period: { orgId: org.id, period: _periodKey() } },
      create: {
        orgId:     org.id,
        period:    _periodKey(),
        score:     0,   // populated by risk scoring job
        createdAt: new Date(),
      },
      update: { updatedAt: new Date() },
    }).catch(() => {/* non-critical */});
  }
  log.info('Tax health snapshots upserted', { orgCount: orgs.length });
}

// ─── Job 2: Risk scoring update ───────────────────────────────────────────────
// Every 6 hours — keeps risk scores fresh without hammering DB

async function riskScoringUpdate(): Promise<void> {
  log.info('Risk scoring batch update — starting');
  // Build intelligence input and recompute scores in batches
  // Full implementation deferred to riskScoringCron.ts integration
  // This job triggers the queue so work is distributed
  const redis = getRedisConnection();
  if (!redis) { log.warn('Redis unavailable — skipping risk scoring queue'); return; }
  await redis.lpush('jobs:risk-scoring', JSON.stringify({ triggeredAt: new Date().toISOString() }));
  log.info('Risk scoring update queued');
}

// ─── Job 3: Deadline reminders ────────────────────────────────────────────────
// 08:00 WAT = 07:00 UTC daily

async function deadlineReminders(): Promise<void> {
  log.info('Deadline reminder job started');
  // Fetch upcoming deadlines in next 7 days
  const in7Days  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const filings  = await (prisma as any).taxFiling.findMany({
    where: {
      status:       'DRAFT',
      deadlineDate: { lte: in7Days, gte: new Date() },
    },
    select:  { id: true, orgId: true, taxType: true, period: true, deadlineDate: true },
    take:    500,
  });

  const redis = getRedisConnection();
  if (!redis) { log.warn('Redis unavailable — skipping deadline reminders'); return; }
  for (const f of filings) {
    const jKey = `deadline-reminder:${f.id}`;
    const sent = await redis.get(jKey);
    if (!sent) {
      await redis.lpush('jobs:deadline-notify', JSON.stringify(f));
      await redis.set(jKey, '1', 'EX', 86_400); // don't remind twice in 24h
    }
  }
  log.info('Deadline reminders queued', { count: filings.length });
}

// ─── Job 4: NRS stamp retry ───────────────────────────────────────────────────
// Every hour — retries invoices stuck in UNSTAMPED state

async function nrsStampRetry(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const unstamped    = await (prisma as any).invoice.findMany({
    where:  { status: 'UNSTAMPED', createdAt: { gte: sevenDaysAgo } },
    select: { id: true, orgId: true },
    take:   50,
  });

  if (unstamped.length === 0) return;

  const redis = getRedisConnection();
  if (!redis) { log.warn('Redis unavailable — skipping NRS stamp retry'); return; }
  for (const inv of unstamped) {
    await redis.lpush('jobs:nrs-stamp-retry', JSON.stringify(inv));
  }
  log.info('NRS stamp retry jobs queued', { count: unstamped.length });
}

// ─── Job 5: Session cleanup ───────────────────────────────────────────────────
// 00:00 WAT = 23:00 UTC (prev day)

async function sessionCleanup(): Promise<void> {
  const result = await (prisma as any).userSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  log.info('Expired sessions cleaned up', { deleted: result.count });
}

// ─── Job 6: DLQ monitor ───────────────────────────────────────────────────────
// Every 15 minutes — alert if DLQ depth exceeds threshold

const DLQ_ALERT_THRESHOLD = 50;

async function dlqMonitor(): Promise<void> {
  const redis = getRedisConnection();
  if (!redis) { log.warn('Redis unavailable — skipping DLQ monitor'); return; }
  const dlqLen = await redis.llen('bull:pdf-generation:failed');
  if (dlqLen > DLQ_ALERT_THRESHOLD) {
    Sentry.captureMessage(`DLQ depth critical: ${dlqLen} failed PDF jobs`, { level: 'error' });
    log.error('DLQ depth exceeds threshold', { dlqLen });
  } else {
    log.debug('DLQ monitor check passed', { dlqLen });
  }
}

// ─── Job 7: Keep-alive ────────────────────────────────────────────────────────
// Every 10 minutes — prevents Render free-tier cold starts

async function keepAlive(): Promise<void> {
  const apiUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`;
  try {
    const res = await fetch(`${apiUrl}/api/v2/monitoring/health`, { signal: AbortSignal.timeout(5_000) });
    log.debug('Keep-alive ping sent', { status: res.status });
  } catch {
    // Expected on shutdown — ignore
  }
}

// ─── Registry (exactly 7) ─────────────────────────────────────────────────────

const JOBS: CronJob[] = [
  { name: 'taxHealthSnapshot', schedule: '0 2 * * *',    handler: taxHealthSnapshot },   // 02:00 UTC = 03:00 WAT
  { name: 'riskScoringUpdate', schedule: '0 */6 * * *',  handler: riskScoringUpdate },
  { name: 'deadlineReminders', schedule: '0 7 * * *',    handler: deadlineReminders },   // 07:00 UTC = 08:00 WAT
  { name: 'nrsStampRetry',     schedule: '0 * * * *',    handler: nrsStampRetry     },   // every hour
  { name: 'sessionCleanup',    schedule: '0 23 * * *',   handler: sessionCleanup    },   // 23:00 UTC = 00:00 WAT
  { name: 'dlqMonitor',        schedule: '*/15 * * * *', handler: dlqMonitor        },   // every 15 min
  { name: 'keepAlive',         schedule: '*/10 * * * *', handler: keepAlive         },   // every 10 min
];

// ─── Start / stop ─────────────────────────────────────────────────────────────

const _tasks: ReturnType<typeof cron.schedule>[] = [];

/**
 * Start all 7 cron jobs.
 * Call once during server startup.
 * safe() wrapper ensures individual job failures are isolated.
 */
export function startCronOrchestrator(): void {
  if (_tasks.length > 0) {
    log.warn('startCronOrchestrator called more than once — skipping duplicate start');
    return;
  }

  for (const job of JOBS) {
    const task = cron.schedule(job.schedule, safe(job.name, job.handler), {
      timezone: 'UTC', // All schedules specified in UTC
    });
    _tasks.push(task);
    log.info('Cron job registered', { job: job.name, schedule: job.schedule });
  }

  log.info(`Cron orchestrator started with ${_tasks.length} jobs`, { count: _tasks.length });
}

/** Graceful shutdown of all cron jobs. */
export function stopCronOrchestrator(): void {
  for (const task of _tasks) {
    task.stop();
  }
  _tasks.length = 0;
  log.info('Cron orchestrator stopped');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _periodKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
