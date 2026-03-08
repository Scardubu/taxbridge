/**
 * Monitoring Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v2/monitoring'
 * GET /health  — ALWAYS HTTP 200 (never 503); check DB + Redis health; degrade gracefully
 * GET /metrics — preHandler: [authenticate, requireRole('ADMIN')]; Prometheus text format
 *
 * C-07: Health endpoint is ALWAYS 200 — 'degraded' is a valid healthy state for Render.
 */
import { FastifyPluginAsync }  from 'fastify';
import { requireRole }         from '../../plugins/requireRole';
import { prisma }              from '../../lib/prisma';
import { redis }               from '../../lib/redis';
import { register }            from '../../metrics';

const monitoringRoutes: FastifyPluginAsync = async (fastify) => {
  const isDocsMode = process.env.TAXBRIDGE_DOCS_MODE === '1';

  // Health — always 200; Render health check must receive 200 within 500ms
  fastify.get('/health', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'degraded'> = {};

    try   { await (prisma as any).$queryRaw`SELECT 1`; checks.db = 'ok'; }
    catch { checks.db = 'degraded'; }

    try   {
      if (isDocsMode) {
        checks.redis = 'degraded';
      } else {
        await redis.ping();
        checks.redis = 'ok';
      }
    }
    catch { checks.redis = 'degraded'; }

    const status = Object.values(checks).every(v => v === 'ok') ? 'healthy' : 'degraded';

    // ALWAYS 200 — never 503
    return reply.code(200).send({
      status,
      checks,
      uptime:    process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Prometheus metrics — ADMIN only; Grafana scrape target
  fastify.get('/metrics', {
    preHandler: [fastify.authenticate, requireRole('ADMIN')],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (_request, reply) => {
    const metrics = await register.metrics();
    return reply.type('text/plain; version=0.0.4').send(metrics);
  });
};

export default monitoringRoutes;
