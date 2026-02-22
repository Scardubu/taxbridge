import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnection } from '../queue/client';

// ─── Connection ──────────────────────────────────────────────────────────────
// `as any` is intentional — bullmq bundles its own ioredis version that
// conflicts with the root ioredis type definitions. See constraint C-01.
const connection = getRedisConnection() as any;

// ─── Queue ───────────────────────────────────────────────────────────────────

export const nrsQueue = new Queue('nrs-submissions', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10_000, // 10s, 20s, 40s, 80s, 160s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// ─── Worker ──────────────────────────────────────────────────────────────────

export const nrsWorker = new Worker(
  'nrs-submissions',
  async (job: Job<{ invoiceId: string; businessId: string }>) => {
    const { invoiceId, businessId } = job.data;

    fastify.log?.info(
      `[NRS Queue] Processing job ${job.id}: invoice ${invoiceId} for business ${businessId}`
    );

    // Dynamic import to avoid circular deps
    const { submitToNRS } = await import('../services/nrs-submission.js');
    await submitToNRS(invoiceId); // businessId is resolved internally from invoice record

    fastify.log?.info(`[NRS Queue] Job ${job.id} succeeded`);
  },
  {
    connection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 1_000, // 10 submissions/second max — avoid NRS rate limits
    },
  }
);

// ─── Worker events ───────────────────────────────────────────────────────────

nrsWorker.on('completed', (job) => {
  console.log(`[NRS Queue] ✅ Job ${job.id} completed (invoice ${job.data.invoiceId})`);
});

nrsWorker.on('failed', (job, err) => {
  console.error(
    `[NRS Queue] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`,
    err.message
  );
});

nrsWorker.on('stalled', (jobId) => {
  console.warn(`[NRS Queue] ⚠️ Job ${jobId} stalled — will be retried`);
});

// ─── Public API ──────────────────────────────────────────────────────────────

export async function enqueueNRSSubmission(
  invoiceId: string,
  businessId: string
): Promise<string> {
  const job = await nrsQueue.add(
    'submit',
    { invoiceId, businessId },
    {
      jobId: `nrs-${invoiceId}`, // Idempotent job ID — prevents duplicate submissions
    }
  );
  return job.id!;
}

export async function getNRSQueueHealth() {
  const [waiting, active, failed, completed, delayed] = await Promise.all([
    nrsQueue.getWaitingCount(),
    nrsQueue.getActiveCount(),
    nrsQueue.getFailedCount(),
    nrsQueue.getCompletedCount(),
    nrsQueue.getDelayedCount(),
  ]);

  const successRate =
    completed + failed > 0 ? completed / (completed + failed) : null;

  return {
    waiting,
    active,
    failed,
    completed,
    delayed,
    successRate,
    healthy: failed === 0 || (successRate !== null && successRate >= 0.9),
  };
}

// Hack to satisfy TS — fastify is set via plugin init
let fastify: any = { log: console };
export function setFastifyInstance(f: any) {
  fastify = f;
}
