/**
 * app.ts — TaxBridge V13 Sovereign
 *
 * Exports buildApp(). Never calls listen() directly.
 * Plugin registration order per §5.1 is EXACT.
 *
 * C-47: Zero Express imports.
 */
import './validateEnv'; // ← MUST be absolute first import; hard-crashes on missing env

import Fastify, { FastifyInstance }     from 'fastify';
import fastifyCors                       from '@fastify/cors';
import fastifyHelmet                     from '@fastify/helmet';
import fastifyCompress                   from '@fastify/compress';
import fastifyRateLimit                  from '@fastify/rate-limit';
import fastifyMultipart                  from '@fastify/multipart';
import fastifySwagger                    from '@fastify/swagger';
import fastifySwaggerUI                  from '@fastify/swagger-ui';
import { redis }                         from './lib/redis';
import { prisma }                        from './lib/prisma';

// Plugin imports
import authenticatePlugin    from './plugins/authenticate';
import resolveOrgCtxPlugin   from './plugins/resolveOrgContext';

// V1 Route imports
import authRoutes            from './routes/v1/auth';
import totpRoutes            from './routes/v1/auth/totp';
import dashboardRoutes       from './routes/v1/dashboard';
import onboardingRoutes      from './routes/v1/onboarding';
import filingsRoutes         from './routes/v1/filings';
import complianceRoutes      from './routes/v1/compliance';
import documentsRoutes       from './routes/v1/documents';
import teamRoutes            from './routes/v1/team';
import notifRoutes           from './routes/v1/notifications';
import payrollRoutes         from './routes/payroll';

// V2 Route imports
import monitoringRoutes      from './routes/v2/monitoring';
import v2DashboardRoute      from './routes/v2/dashboard';
import analyticsRoutes       from './routes/v2/analytics';
import dlqRoutes             from './routes/v2/dlq';
import auditRoutes           from './routes/v2/audit';
import v2IntelligenceRoute   from './routes/v2/intelligence';
import v2OnboardingRoute2    from './routes/v2/onboarding';
import v2NdpcExportRoute     from './routes/v2/ndpc-export';

// Root-level Route imports
import invoicesRoutes           from './routes/invoices';
import invoiceManagementRoutes  from './routes/invoiceManagement';
import paymentRoutes            from './routes/payments';
import businessRoutes           from './routes/business';
import cryptoRoutes             from './routes/crypto';
import reconciliationRoutes     from './routes/reconciliation';

// Webhook Route imports
import flutterwaveWebhook    from './routes/webhooks/flutterwave';
import paystackWebhook       from './routes/webhooks/paystack';
import remitaWebhook         from './routes/webhooks/remita';

export async function buildApp(): Promise<FastifyInstance> {
  const isDocsMode = process.env.TAXBRIDGE_DOCS_MODE === '1';
  const fastify = Fastify({
    trustProxy: true, // Required for Render.com + Vercel proxy headers
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: [
        'req.headers.authorization', 'body.password', 'body.tin',
        'body.bvn', 'body.receiptUrl', 'body.documentUrl',
      ],
      ...(process.env.LOG_FORMAT !== 'json'
        ? { transport: { target: 'pino-pretty' } }
        : {}),
    },
  });

  // ── Security plugins ────────────────────────────────────────────────────────
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:              ["'self'"],
        connectSrc:              [
          "'self'",
          process.env.RENDER_EXTERNAL_URL ?? '',
          ...(process.env.SENTRY_DSN
            ? [new URL(process.env.SENTRY_DSN).origin]
            : ['https://*.ingest.sentry.io']),
        ].filter(Boolean),
        frameAncestors:          ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  });

  await fastify.register(fastifyCors, {
    origin:      (process.env.CORS_ORIGIN ?? '').split(',').map(s => s.trim()),
    credentials: true,
  });

  // ── Performance plugins ─────────────────────────────────────────────────────
  await fastify.register(fastifyCompress, { encodings: ['gzip', 'deflate'], threshold: 1024 });

  if (!isDocsMode && redis) {
    await fastify.register(fastifyRateLimit, {
      global:    false,
      redis,
      nameSpace: 'rl:',
      errorResponseBuilder: (_req: any, ctx: any) => ({
        error:   'RATE_LIMITED',
        message: `Rate limit exceeded. Retry after ${ctx.after}`,
      }),
    });
  }

  await fastify.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

  // ── JSON body parser — preserves rawBody for HMAC webhook verification ──────
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer', bodyLimit: 1_048_576 },
    (_req: any, body: Buffer, done) => {
      _req.rawBody = body; // Preserved for Flutterwave/Paystack HMAC (C-37)
      try { done(null, JSON.parse(body.toString('utf8'))); }
      catch (err) { done(err as Error, undefined); }
    },
  );

  // ── OpenAPI spec (non-production) ──────────────────────────────────────────
  await fastify.register(fastifySwagger, {
    openapi: {
      info:       { title: 'TaxBridge API', version: '13.0.0', description: 'Nigerian SME Tax Compliance' },
      servers:    [{ url: process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:3000' }],
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security:   [{ bearerAuth: [] }],
    },
  });
  if (process.env.NODE_ENV !== 'production') {
    await fastify.register(fastifySwaggerUI, { routePrefix: '/docs' });
  }

  // ── Auth decorator plugins ──────────────────────────────────────────────────
  await fastify.register(authenticatePlugin);
  await fastify.register(resolveOrgCtxPlugin);

  // ── Route plugins ───────────────────────────────────────────────────────────
  await fastify.register(authRoutes,         { prefix: '/api/v1/auth' });
  await fastify.register(totpRoutes,         { prefix: '/api/v1/auth/totp' });
  await fastify.register(dashboardRoutes,    { prefix: '/api/v1' });
  await fastify.register(onboardingRoutes,   { prefix: '/api/v1/onboarding' });
  await fastify.register(filingsRoutes,      { prefix: '/api/v1/filings' });
  await fastify.register(complianceRoutes,   { prefix: '/api/v1/compliance' });
  await fastify.register(payrollRoutes,      { prisma });
  await fastify.register(documentsRoutes,    { prefix: '/api/v1' });
  await fastify.register(teamRoutes,         { prefix: '/api/v1' });
  await fastify.register(notifRoutes,        { prefix: '/api/v1' });
  await fastify.register(monitoringRoutes,   { prefix: '/api/v2/monitoring' });
  await fastify.register(v2DashboardRoute);
  await fastify.register(analyticsRoutes,    { prefix: '/api/v2' });
  await fastify.register(dlqRoutes,          { prefix: '/api/v2' });
  await fastify.register(auditRoutes,        { prefix: '/api/v2' });
  await fastify.register(v2IntelligenceRoute);
  await fastify.register(v2OnboardingRoute2);
  await fastify.register(v2NdpcExportRoute);
  await fastify.register(invoicesRoutes,      { prisma });
  await fastify.register(invoiceManagementRoutes, { prisma });
  await fastify.register(paymentRoutes,       { prisma });
  await fastify.register(businessRoutes,      { prisma });
  await fastify.register(cryptoRoutes,        { prisma });
  await fastify.register(reconciliationRoutes, { prisma });
  await fastify.register(flutterwaveWebhook,  { prefix: '/webhooks' });
  await fastify.register(paystackWebhook,     { prefix: '/webhooks' });
  await fastify.register(remitaWebhook,       { prefix: '/webhooks' });

  fastify.get('/health/live', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  fastify.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'degraded'> = {};

    try {
      await (prisma as any).$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch {
      checks.db = 'degraded';
    }

    try {
      if (isDocsMode) {
        checks.redis = 'degraded';
      } else {
        await redis.ping();
        checks.redis = 'ok';
      }
    } catch {
      checks.redis = 'degraded';
    }

    const status = Object.values(checks).every((value) => value === 'ok') ? 'ready' : 'degraded';
    return reply.code(200).send({ status, checks, timestamp: new Date().toISOString() });
  });

  // ── Global catch-all error handler ─────────────────────────────────────────
  fastify.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    fastify.log.error({ err: error }, 'Unhandled error');
    const status = (error as any).statusCode ?? 500;
    reply.code(status).send({
      error:   status === 500 ? 'INTERNAL_ERROR' : ((error as any).code ?? 'ERROR'),
      message: status === 500 ? 'An unexpected error occurred' : error.message,
    });
  });

  return fastify;
}
