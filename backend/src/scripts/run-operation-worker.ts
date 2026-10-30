import { startOperationWorker } from '../operations/operation-worker';
import { disconnectPrisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const worker = startOperationWorker();
async function shutdown(): Promise<void> {
  await worker.close();
  await redis.quit();
  await disconnectPrisma();
}
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
worker.on('error', (error) => {
  process.stderr.write(`[operation-worker] ${error.message}\n`);
});
