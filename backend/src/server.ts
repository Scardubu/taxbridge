import { buildApp } from './app';
import { initialiseObservability } from './lib/observability';
import { prisma } from './lib/prisma';
import { registerCronJobs } from './cron/orchestrator';

let app: Awaited<ReturnType<typeof buildApp>> | null = null;
let shuttingDown = false;

async function start(): Promise<void> {
  initialiseObservability();
  app = await buildApp();

  app.addHook('onReady', () => {
    registerCronJobs(app!);
  });
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  await app.listen({
    port: Number.parseInt(process.env.PORT!, 10),
    host: '0.0.0.0',
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stderr.write(`[server] ${signal} received; draining Fastify\n`);
  try {
    if (app) await app.close();
    else await prisma.$disconnect();
  } catch (error) {
    process.stderr.write(`[server] graceful shutdown failed: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

start().catch((error) => {
  process.stderr.write(`[server] startup failed: ${String(error)}\n`);
  process.exitCode = 1;
});
