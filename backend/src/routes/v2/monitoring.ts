/**
 * TaxBridge — API v2 Monitoring Route
 * GET /api/v2/monitoring/health
 * GET /api/v2/monitoring/metrics
 *
 * Production observability with v2 envelope.
 * Includes PII scrubbing for Sentry/metrics data (P9).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, errorResponse } from '../../lib/api-envelope';
import { getPrismaClient } from '../../lib/prisma';
import { getRedisConnection } from '../../queue/client';
import { createLogger } from '../../lib/logger';

const log = createLogger('v2-monitoring');
const prisma = getPrismaClient();

// PII fields to scrub from any outbound payload
const PII_FIELDS = new Set([
  'email', 'phone', 'nin', 'tin', 'bvn', 'passwordHash',
  'mfaSecret', 'mfaTempSecret', 'ecdsaPrivateKey',
  'duploClientSecret', 'remitaApiKey', 'ipAddress',
]);

/**
 * Recursively scrub PII from an object (shallow clone — does not mutate input).
 */
function scrubPII(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrubPII);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_FIELDS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = scrubPII(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export default async function v2MonitoringRoute(fastify: FastifyInstance) {

  // ── Health endpoint ────────────────────────────────────────────────────────
  fastify.get('/api/v2/monitoring/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;

      const redis = getRedisConnection();
      const redisStart = Date.now();
      const redisPing = redis
        ? await redis.ping().then(() => Date.now() - redisStart).catch(() => -1)
        : -1;

      const overallStatus = dbLatency < 200 && redisPing >= 0
        ? 'healthy'
        : dbLatency >= 200 || redisPing < 0
          ? 'degraded'
          : 'error';

      return reply.send(successResponse({
        status: overallStatus,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        dependencies: {
          database: { status: dbLatency < 200 ? 'healthy' : 'degraded', latencyMs: dbLatency },
          redis:    { status: redisPing >= 0 ? 'healthy' : 'unavailable', latencyMs: redisPing },
        },
      }));
    } catch (error) {
      log.error('Health check failed', { error });
      return reply.code(503).send(errorResponse('Service unavailable', 'HEALTH_FAILED'));
    }
  });

  // ── Metrics endpoint (Prometheus + JSON) ────────────────────────────────────
  fastify.get('/api/v2/monitoring/metrics', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const memUsage = process.memoryUsage();

      const data = scrubPII({
        uptime:   process.uptime(),
        memory: {
          heapUsed:  memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss:       memUsage.rss,
          external:  memUsage.external,
        },
        node: {
          version: process.version,
          env:     process.env.NODE_ENV || 'development',
        },
      });

      return reply.send(successResponse(data, { requestId: req.id }));
    } catch (error) {
      log.error('Metrics collection failed', { error });
      return reply.code(500).send(errorResponse('Failed to collect metrics', 'METRICS_FAILED'));
    }
  });
}
