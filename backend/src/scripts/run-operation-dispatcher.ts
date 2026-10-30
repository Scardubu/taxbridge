import { dispatchOutboxBatch, closeOutboxDispatcher } from '../operations/outbox-dispatcher';
import { disconnectPrisma } from '../lib/prisma';

let stopping = false;
async function main(): Promise<void> {
  const intervalMs = Number.parseInt(process.env.OUTBOX_POLL_INTERVAL_MS ?? '1000', 10);
  if (!Number.isFinite(intervalMs) || intervalMs < 100) throw new Error('OUTBOX_POLL_INTERVAL_MS must be >= 100');
  while (!stopping) {
    try {
      const count = await dispatchOutboxBatch(100);
      if (count === 0) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      process.stderr.write(`[outbox-dispatcher] ${String(error)}\n`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
process.once('SIGINT', () => { stopping = true; });
process.once('SIGTERM', () => { stopping = true; });
main().finally(async () => {
  await closeOutboxDispatcher();
  await disconnectPrisma();
}).catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
