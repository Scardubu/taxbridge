import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { createLogger } from '../lib/logger';
import { submitToNRS } from '../services/nrs-submission';

const log = createLogger('nrs-queue');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const nrsQueue = new Queue('nrs-submissions', {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const nrsWorker = new Worker(
  'nrs-submissions',
  async (job: Job<{ invoiceId: string; businessId: string }>) => {
    const { invoiceId } = job.data;
    await submitToNRS(invoiceId);
  },
  {
    connection: connection as any,
    concurrency: 3,
  }
);

nrsWorker.on('failed', (job, err) => {
  log.error('NRS queue job failed', {
    jobId: job?.id,
    invoiceId: job?.data?.invoiceId,
    error: err.message,
  });
});

export async function enqueueNRSSubmission(invoiceId: string, businessId: string) {
  return nrsQueue.add('submit', { invoiceId, businessId }, { jobId: `nrs-${invoiceId}` });
}

export async function getNRSQueueHealth() {
  const [waiting, active, failed, completed] = await Promise.all([
    nrsQueue.getWaitingCount(),
    nrsQueue.getActiveCount(),
    nrsQueue.getFailedCount(),
    nrsQueue.getCompletedCount(),
  ]);

  return { waiting, active, failed, completed };
}
