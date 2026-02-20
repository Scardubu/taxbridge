// ─────────────────────────────────────────────────────────────────────────────
// ADD THESE IMPORTS to backend/src/index.ts (after existing imports)
// ─────────────────────────────────────────────────────────────────────────────

import insightsRoutes   from './routes/insights.js';
import adminStatsRoutes from './routes/admin-stats.js';
import ocrRoutes        from './routes/ocr.js';
import nrsQueueRoutes   from './routes/nrs-queue-routes.js';
import { setFastifyInstance, nrsWorker } from './queues/nrs-queue.js';

// ─────────────────────────────────────────────────────────────────────────────
// ADD THESE REGISTRATIONS after existing fastify.register() calls
// ─────────────────────────────────────────────────────────────────────────────

fastify.register(insightsRoutes);
fastify.register(adminStatsRoutes);
fastify.register(ocrRoutes);
fastify.register(nrsQueueRoutes);

// Wire fastify instance into queue worker for logging
setFastifyInstance(fastify);

// Graceful shutdown — drain NRS queue before exit
const gracefulShutdown = async (signal: string) => {
  fastify.log.info(`[Shutdown] Received ${signal} — closing NRS worker...`);
  await nrsWorker.close();
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ─────────────────────────────────────────────────────────────────────────────
// ADD THESE ENV VARS to backend/.env.production and Render dashboard
// ─────────────────────────────────────────────────────────────────────────────
//
//   GOOGLE_CLOUD_KEY_FILE=./secrets/google-vision-key.json
//   REDIS_URL=redis://...   (already configured in v1.0.3)
//   ADMIN_API_KEY=<64-char-hex-secret>
//
// ─────────────────────────────────────────────────────────────────────────────
// ADD THESE ENV VARS to Vercel dashboard (admin-dashboard)
// ─────────────────────────────────────────────────────────────────────────────
//
//   BACKEND_API_URL=https://taxbridge-api-ker8.onrender.com
//   NEXT_PUBLIC_API_URL=https://taxbridge-api-ker8.onrender.com
//   ADMIN_API_KEY=<same-64-char-hex-secret>
//
// ─────────────────────────────────────────────────────────────────────────────
// ADD THESE PACKAGES
// ─────────────────────────────────────────────────────────────────────────────
//
//   cd backend
//   npm install @google-cloud/vision tesseract.js sharp bullmq
//
//   cd admin-dashboard
//   npm install swr  # if not already installed
