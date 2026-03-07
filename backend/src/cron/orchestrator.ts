/**
 * Cron Orchestrator — TaxBridge V13 Sovereign
 *
 * Exactly 7 jobs registered — no setInterval anywhere else.
 * registerCronJobs(fastify) called from server.ts onReady hook.
 *
 * All times are WAT (UTC+1). Pass { timezone: 'Africa/Lagos' } to node-cron.
 *
 * Jobs:
 *   1. riskScoringCron       — Daily 04:00 WAT
 *   2. snapshotCron          — Daily 04:30 WAT
 *   3. snapshotPruneCron     — Weekly Sunday 03:00 WAT
 *   4. deadlineCron          — Daily 07:00 WAT
 *   5. queueHealthCron       — Every 5 min (monitor + alert only — NEVER re-enqueue)
 *   6. dlqMonitorCron        — Every 15 min
 *   7. sessionCleanupCron    — Daily 02:00 WAT
 *
 * CRITICAL: queueHealthCron only monitors and alerts — must NEVER call
 * queue.add() or job.retry() directly, as BullMQ handles retries automatically.
 */
import cron                 from 'node-cron';
import * as Sentry          from '@sentry/node';
import { FastifyInstance }  from 'fastify';
import { logger }           from '../lib/logger';
import { prisma }           from '../lib/prisma';
import { redis }            from '../lib/redis';
import { nrsStampQueue }    from '../services/eventBus';
import { computeRiskScore } from '../services/riskScoring';
import { buildIntelligenceInput } from '../services/dashboardService';

// All times in WAT (Africa/Lagos = UTC+1)
const WAT = { timezone: 'Africa/Lagos' } as const;

function safe(name: string, fn: () => Promise<void>): () => void {
  return () => {
    const t0 = Date.now();
    fn()
      .then(() => logger.info({ job: name, ms: Date.now() - t0 }, 'Cron job completed'))
      .catch(err => {
        Sentry.captureException(err, { extra: { cronJob: name } });
        logger.error({ err, job: name }, 'Cron job failed — continuing');
      });
  };
}

// ─── Job 1: riskScoringCron — Daily 04:00 WAT ────────────────────────────────
async function riskScoringCron(): Promise<void> {
  logger.info('riskScoringCron: starting');
  const orgs: any[] = await (prisma as any).organisation?.findMany({
    where:  { status: 'ACTIVE' },
    select: { id: true },
    take:   1000,
  }).catch(() => []) ?? [];

  for (const org of orgs) {
    try {
      const input = await buildIntelligenceInput(org.id, 'system');
      const result = computeRiskScore(input);
      const score: number = typeof result === 'number' ? result : (result as any).score ?? 50;
      await (prisma as any).sMERiskRecord?.upsert({
        where:  { orgId: org.id },
        update: {
          taxHealthScore:  Math.round(score),
          riskBand:        score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high',
          computedAt:      new Date(),
        },
        create: {
          orgId:          org.id,
          taxHealthScore:  Math.round(score),
          riskBand:        score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high',
          anomalyCount:    0,
          computedAt:      new Date(),
        },
      });
    } catch { /* non-critical per org */ }
  }

  logger.info({ orgCount: orgs.length }, 'riskScoringCron: completed');
}

// ─── Job 2: snapshotCron — Daily 04:30 WAT ───────────────────────────────────
async function snapshotCron(): Promise<void> {
  logger.info('snapshotCron: starting');
  const period = _periodKey();
  const orgs: any[] = await (prisma as any).organisation?.findMany({
    where:  { status: 'ACTIVE' },
    select: { id: true },
    take:   1000,
  }).catch(() => []) ?? [];

  for (const org of orgs) {
    await (prisma as any).taxHealthSnapshot?.create({
      data: { orgId: org.id, period, score: 0, createdAt: new Date() },
    }).catch(() => {/* skip if exists — no updatedAt on this model */});
  }

  logger.info({ orgCount: orgs.length, period }, 'snapshotCron: completed');
}

// ─── Job 3: snapshotPruneCron — Weekly Sunday 03:00 WAT ──────────────────────
async function snapshotPruneCron(): Promise<void> {
  logger.info('snapshotPruneCron: starting');
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);

  const result = await (prisma as any).taxHealthSnapshot?.deleteMany({
    where: { createdAt: { lt: cutoff } },
  }).catch(() => ({ count: 0 })) ?? { count: 0 };

  logger.info({ deleted: result.count }, 'snapshotPruneCron: pruned snapshots > 24 months');
}

// ─── Job 4: deadlineCron — Daily 07:00 WAT ───────────────────────────────────
async function deadlineCron(): Promise<void> {
  logger.info('deadlineCron: starting');
  // Generate upcoming ComplianceEvent reminders
  const orgs: any[] = await (prisma as any).organisation?.findMany({
    where:  { status: 'ACTIVE' },
    select: { id: true },
    take:   1000,
  }).catch(() => []) ?? [];

  const upcomingDeadlines = getUpcomingDeadlines();

  for (const org of orgs) {
    for (const deadline of upcomingDeadlines) {
      await (prisma as any).complianceEvent?.upsert({
        where:  { orgId_taxType_period: { orgId: org.id, taxType: deadline.taxType, period: deadline.period } },
        create: { orgId: org.id, ...deadline, status: 'upcoming', createdAt: new Date() },
        update: { deadline: deadline.deadline, status: 'upcoming' },
      }).catch(() => {});
    }
  }

  logger.info({ orgCount: orgs.length, deadlineCount: upcomingDeadlines.length }, 'deadlineCron: completed');
}

// ─── Job 5: queueHealthCron — Every 5 min (MONITOR ONLY) ─────────────────────
// CRITICAL: NEVER calls queue.add() or job.retry() — BullMQ handles retries.
async function queueHealthCron(): Promise<void> {
  const nrsDepth = await nrsStampQueue.getWaitingCount().catch(() => 0);

  if (nrsDepth > 50) {
    Sentry.captureMessage(`NRS stamp queue depth critical: ${nrsDepth}`, { level: 'warning' });
    logger.warn({ nrsDepth }, 'queueHealthCron: nrs-stamp queue depth > 50');
  } else {
    logger.debug({ nrsDepth }, 'queueHealthCron: nrs-stamp depth OK');
  }
}

// ─── Job 6: dlqMonitorCron — Every 15 min ────────────────────────────────────
async function dlqMonitorCron(): Promise<void> {
  const dlqCount = await (prisma as any).dLQJob?.count({
    where: { status: 'FAILED' },
  }).catch(() => 0) ?? 0;

  if (dlqCount > 10) {
    Sentry.captureMessage(`DLQ count critical: ${dlqCount} failed jobs`, { level: 'error' });
    logger.error({ dlqCount }, 'dlqMonitorCron: DLQ count > 10');
  } else {
    logger.debug({ dlqCount }, 'dlqMonitorCron: DLQ count OK');
  }
}

// ─── Job 7: sessionCleanupCron — Daily 02:00 WAT ─────────────────────────────
async function sessionCleanupCron(): Promise<void> {
  logger.info('sessionCleanupCron: starting');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const result = await (prisma as any).refreshToken?.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  }).catch(() => ({ count: 0 })) ?? { count: 0 };

  logger.info({ deleted: result.count }, 'sessionCleanupCron: pruned expired refresh tokens');
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const _tasks: ReturnType<typeof cron.schedule>[] = [];

export function registerCronJobs(_fastify: FastifyInstance): void {
  if (_tasks.length > 0) {
    logger.warn('registerCronJobs called more than once — skipping');
    return;
  }

  // 7 exactly — cron.schedule() calls
  const jobs = [
    { name: 'riskScoringCron',    schedule: '0 4 * * *',      fn: riskScoringCron    },  // 04:00 WAT
    { name: 'snapshotCron',       schedule: '30 4 * * *',     fn: snapshotCron       },  // 04:30 WAT
    { name: 'snapshotPruneCron',  schedule: '0 3 * * 0',      fn: snapshotPruneCron  },  // Sun 03:00 WAT
    { name: 'deadlineCron',       schedule: '0 7 * * *',      fn: deadlineCron       },  // 07:00 WAT
    { name: 'queueHealthCron',    schedule: '*/5 * * * *',    fn: queueHealthCron    },  // every 5 min
    { name: 'dlqMonitorCron',     schedule: '*/15 * * * *',   fn: dlqMonitorCron     },  // every 15 min
    { name: 'sessionCleanupCron', schedule: '0 2 * * *',      fn: sessionCleanupCron },  // 02:00 WAT
  ];

  for (const job of jobs) {
    const task = cron.schedule(job.schedule, safe(job.name, job.fn), WAT);
    _tasks.push(task);
    logger.info({ job: job.name, schedule: job.schedule }, 'Cron job registered');
  }

  logger.info({ count: _tasks.length }, 'Cron orchestrator started');
}

export function stopCronOrchestrator(): void {
  for (const task of _tasks) task.stop();
  _tasks.length = 0;
  logger.info('Cron orchestrator stopped');
}

// Legacy compat
export const startCronOrchestrator = registerCronJobs as any;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _periodKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getUpcomingDeadlines(): Array<{ taxType: string; period: string; deadline: string; description: string }> {
  const now   = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year  = now.getFullYear();
  const period = `${year}-${month}`;

  const vatDeadline  = new Date(year, now.getMonth() + 1, 21).toISOString();
  const payeDeadline = new Date(year, now.getMonth() + 1, 10).toISOString();

  return [
    { taxType: 'VAT',  period, deadline: vatDeadline,  description: 'Monthly VAT return due' },
    { taxType: 'PAYE', period, deadline: payeDeadline, description: 'Monthly PAYE remittance due' },
    { taxType: 'WHT',  period, deadline: vatDeadline,  description: 'Monthly WHT remittance due' },
  ];
}
