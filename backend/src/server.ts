import { buildApp } from './app';
import { registerCronJobs } from './cron/orchestrator';

async function start(): Promise<void> {
  const app = await buildApp();

  app.addHook('onReady', () => {
    registerCronJobs(app);
  });

  await app.listen({
    port: parseInt(process.env.PORT!, 10),
    host: '0.0.0.0',
  });
}

start().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
