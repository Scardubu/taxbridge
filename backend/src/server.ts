import Fastify from 'fastify';
import path from 'path';
import cors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';
import fastifyEnv from '@fastify/env';
import helmet from '@fastify/helmet';
import { Prisma, PrismaClient } from '@prisma/client';
import { z, ZodError } from 'zod';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import * as Sentry from '@sentry/node';

import invoicesRoutes from './routes/invoices';
import ocrRoutes from './routes/ocr';
import paymentsRoutes from './routes/payments';
import ussdRoutes from './routes/ussd';
import smsRoutes from './routes/sms';
import chatbotRoutes from './routes/chatbot';
import { adminRoutes } from './routes/admin';
import authRoutes from './routes/auth';
import privacyRoutes from './routes/privacy';
import {
  closeInvoiceSyncQueue,
  closeRedisConnection,
  closePaymentQueue,
  getRedisConnection
} from './queue/client';
import { startDeadlineReminderCron } from './services/deadlineReminder';
import { healthCheckAllProviders, getProviderHealth } from './integrations/comms/client';
import { createLogger } from './lib/logger';
import { getPrismaClient, disconnectPrisma } from './lib/prisma';
import { securityMiddleware, checkRateLimit } from './lib/security';
import { RateLimitError, formatErrorResponse } from './lib/errors';
import { 
  createRequestContext, 
  cleanupRequestContext, 
  logRequestCompletion, 
  getRequestContext
} from './lib/request-tracer';
import { setupSentry, checkDuploHealth as observeDuploHealth, checkRemitaHealth as observeRemitaHealth, validateSampleUBL as runUblHealthCheck, captureWithSentry, isSentryEnabled } from './middleware/sentry';
import { metrics } from './services/metrics';
import { initializeDLQMonitoring, shutdownDLQMonitoring, getDLQMonitor } from './services/dlq-monitor';
import { initializePoolMonitoring, shutdownPoolMonitoring, getPoolMonitor } from './services/pool-metrics';

const log = createLogger('server');
const prisma = getPrismaClient();

// Health check tracking
let healthCheckInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// Metrics tracking for production monitoring
const serverMetrics = {
  requestCount: 0,
  errorCount: 0,
  startTime: Date.now(),
  lastHealthCheck: Date.now(),
  componentStatus: {
    database: 'unknown' as 'healthy' | 'degraded' | 'error' | 'unknown',
    redis: 'unknown' as 'healthy' | 'degraded' | 'error' | 'unknown',
    queues: 'unknown' as 'healthy' | 'degraded' | 'error' | 'unknown',
    sms: 'unknown' as 'healthy' | 'degraded' | 'error' | 'unknown'
  }
};

const app = Fastify({ 
  logger: true,
  trustProxy: true // Enable for IP extraction
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Add security middleware
app.addHook('onRequest', async (request, reply) => {
  // Track metrics
  serverMetrics.requestCount++;
  
  // Add security headers
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  
  // Initialize request tracing
  const context = createRequestContext(request);
  reply.header('X-Request-ID', context.requestId);
  reply.header('X-Correlation-ID', context.correlationId);

  // Extract and store IP for rate limiting
  const ip = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || (request as any).socket?.remoteAddress || 'unknown';
  (request as any).clientIP = Array.isArray(ip) ? ip[0] : ip;
  
  // Skip rate limiting for health endpoints
  const skipRateLimit = ['/health', '/ready', '/metrics'].some(p => request.url.startsWith(p));
  
  if (!skipRateLimit && process.env.NODE_ENV === 'production') {
    // Apply rate limiting in production
    const rateLimitResult = await checkRateLimit((request as any).clientIP, 'api', (request as any).clientIP);
    if (!rateLimitResult.allowed) {
      const resetTimeMs = rateLimitResult.resetTime instanceof Date ? rateLimitResult.resetTime.getTime() : Date.now() + 60000;
      const retryAfter = Math.ceil((resetTimeMs - Date.now()) / 1000);
      const err = new RateLimitError(retryAfter);
      reply.code(err.statusCode).send(err.toJSON());
      return;
    }
  }
});

// Clean up request context on response
app.addHook('onResponse', async (request, reply) => {
  const requestId = (request.headers['x-request-id'] as string) || (request as any).id;
  if (requestId) {
    const error = (request as any).raw?.error as Error | undefined;
    logRequestCompletion(requestId, reply.statusCode, error);
    cleanupRequestContext(requestId);
  }
});

app.setErrorHandler((error, request, reply) => {
  // Track error metrics
  serverMetrics.errorCount++;

  if (isSentryEnabled()) {
    captureWithSentry(error, request, reply);
  }

  const { statusCode, body } = formatErrorResponse(error);

  if (statusCode >= 500) {
    app.log.error({ err: error }, 'Server error');
  }

  return reply.status(statusCode).send(body);
});

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'REDIS_URL', 'DIGITAX_API_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY'],
  properties: {
    DATABASE_URL: { type: 'string' },
    DATABASE_POOL_MAX: { type: 'string', default: '10' },
    DATABASE_POOL_TIMEOUT_MS: { type: 'string', default: '5000' },
    PORT: { type: 'string', default: '3000' },
    REDIS_URL: { type: 'string' },
    DIGITAX_API_URL: { type: 'string', default: 'https://sandbox.digitax.ng' },
    DIGITAX_API_KEY: { type: 'string' },
    DIGITAX_HMAC_SECRET: { type: 'string' },
    DIGITAX_MOCK_MODE: { type: 'string', default: 'true' },
    REMITA_MOCK_MODE: { type: 'string', default: 'false' },
    REMITA_MERCHANT_ID: { type: 'string' },
    REMITA_API_KEY: { type: 'string' },
    REMITA_SERVICE_TYPE_ID: { type: 'string' },
    REMITA_API_URL: { type: 'string', default: 'https://remitademo.net' },
    UBL_XSD_PATH: { type: 'string' },
    // SMS Provider settings
    COMMS_PROVIDER: { type: 'string', default: 'africastalking' },
    AT_API_KEY: { type: 'string' },
    AT_USERNAME: { type: 'string' },
    AT_SHORTCODE: { type: 'string' },
    INFOBIP_API_KEY: { type: 'string' },
    INFOBIP_API_URL: { type: 'string' },
    INFOBIP_SIGNATURE_SECRET: { type: 'string' },
    INFOBIP_SENDER: { type: 'string' },
    TERMII_API_KEY: { type: 'string' },
    TERMII_API_URL: { type: 'string' },
    TERMII_SIGNATURE_SECRET: { type: 'string' },
    TERMII_SENDER: { type: 'string' },
    // Security settings
    JWT_SECRET: { type: 'string' },
    JWT_REFRESH_SECRET: { type: 'string' },
    JWT_SECRET_PREVIOUS: { type: 'string' },
    JWT_REFRESH_SECRET_PREVIOUS: { type: 'string' },
    ENCRYPTION_KEY: { type: 'string' },
    SESSION_SECRET: { type: 'string' },
    WEBHOOK_SECRET: { type: 'string' },
    ALLOWED_ORIGINS: { type: 'string' },
    REQUIRE_SMS_SIGNATURE: { type: 'string', default: '0' },
    ENABLE_DEADLINE_REMINDERS: { type: 'string', default: 'true' },
    TEST_PHONE_NUMBER: { type: 'string' },
    PRISMA_SLOW_QUERY_MS: { type: 'string', default: '500' },
    // Queue + worker tuning
    INVOICE_SYNC_CONCURRENCY: { type: 'string', default: '5' },
    INVOICE_SYNC_MAX_ATTEMPTS: { type: 'string', default: '5' },
    INVOICE_SYNC_BACKOFF_MS: { type: 'string', default: '5000' },
    INVOICE_SYNC_RATE_LIMIT: { type: 'string', default: '8' },
    INVOICE_SYNC_RATE_DURATION_MS: { type: 'string', default: '1000' },
    INVOICE_SYNC_FAILURE_THRESHOLD: { type: 'string', default: '5' },
    INVOICE_SYNC_FAILURE_WINDOW_MS: { type: 'string', default: '60000' },
    INVOICE_SYNC_FAILURE_COOLDOWN_MS: { type: 'string', default: '60000' },
    INVOICE_SYNC_TIMEOUT_MS: { type: 'string', default: '120000' },
    INVOICE_SYNC_LOCK_DURATION_MS: { type: 'string', default: '120000' },
    INVOICE_SYNC_REMOVE_ON_COMPLETE: { type: 'string', default: '200' },
    PAYMENT_WEBHOOK_CONCURRENCY: { type: 'string', default: '3' },
    PAYMENT_WEBHOOK_MAX_ATTEMPTS: { type: 'string', default: '4' },
    PAYMENT_WEBHOOK_BACKOFF_MS: { type: 'string', default: '3000' },
    PAYMENT_WEBHOOK_TIMEOUT_MS: { type: 'string', default: '60000' },
    PAYMENT_WEBHOOK_LOCK_DURATION_MS: { type: 'string', default: '60000' },
    PAYMENT_WEBHOOK_REMOVE_ON_COMPLETE: { type: 'string', default: '100' },
    // Monitoring
    ENABLE_METRICS: { type: 'string', default: 'true' },
    METRICS_INTERVAL: { type: 'string', default: '60000' }, // 1 minute
    // Development/testing convenience (MUST remain disabled in production)
    ALLOW_DEBUG_USER_ID_HEADER: { type: 'string', default: 'false' },
    NODE_ENV: { type: 'string', default: 'development' }
  }
} as const;

async function bootstrap() {
  // Load and validate environment variables early so subsequent plugin configuration
  // (CORS, integrations, etc.) sees values from `.env`.
  await app.register(fastifyEnv, {
    schema: envSchema,
    dotenv: { path: path.resolve(process.cwd(), '.env') }
  });

  // Register helmet for security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });

  const corsOriginsRaw = (process.env.ALLOWED_ORIGINS ?? process.env.CORS_ORIGINS ?? '*').trim();
  const corsOrigins = corsOriginsRaw === '*'
    ? '*'
    : corsOriginsRaw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

  await app.register(cors, { 
    origin: corsOrigins,
    credentials: true
  });

  // Enable response compression for bandwidth reduction
  await app.register(fastifyCompress, {
    global: true,
    threshold: 1024, // Compress responses > 1KB
    encodings: ['gzip', 'deflate'],
    // Don't compress already compressed formats
    inflateIfDeflated: true
  });

  const sentryReady = setupSentry(app);
  if (sentryReady) {
    log.info('Sentry monitoring enabled');
  }

  // Initialize monitoring services
  if (process.env.ENABLE_DLQ_MONITORING !== 'false') {
    initializeDLQMonitoring(['invoice-sync', 'payment-webhook', 'email-queue', 'sms-queue']);
    log.info('DLQ monitoring enabled');
  }

  if (process.env.ENABLE_POOL_MONITORING !== 'false') {
    initializePoolMonitoring();
    log.info('Connection pool monitoring enabled');
  }

  // Health check endpoints
  // Liveness: proves the process is up (no external dependencies)
  app.get('/health/live', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      env: process.env.NODE_ENV || 'unknown'
    });
  });

  // Readiness: proves the service can talk to its critical dependencies.
  // Keep this separate from liveness so deploy platforms don't restart-loop on DB outages.
  app.get('/health/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const redis = getRedisConnection();
      await redis.ping();

      return reply.send({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      app.log.error({ err: error }, 'Readiness check failed');
      return reply.status(503).send({
        status: 'not-ready',
        error: 'Critical dependencies unavailable',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/health', async (_req, reply) => {
    try {
      // Basic health check - database and redis
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;
      
      const redisStart = Date.now();
      const redis = getRedisConnection();
      await redis.ping();
      const redisLatency = Date.now() - redisStart;
      
      // Update component status
      serverMetrics.componentStatus.database = dbLatency < 100 ? 'healthy' : 'degraded';
      serverMetrics.componentStatus.redis = redisLatency < 50 ? 'healthy' : 'degraded';
      serverMetrics.lastHealthCheck = Date.now();
      
      const [digitaxHealth, remitaHealth, ublSnapshot] = await Promise.all([
        observeDuploHealth().catch(() => ({ status: 'error', provider: 'digitax', timestamp: new Date().toISOString() } as const)),
        observeRemitaHealth().catch(() => ({ status: 'error', provider: 'remita', timestamp: new Date().toISOString() } as const)),
        runUblHealthCheck().catch(() => ({ status: 'error', missingFields: [], xsdValid: false, timestamp: new Date().toISOString() }))
      ]);

      const overallStatus = Object.values(serverMetrics.componentStatus).every(s => s === 'healthy' || s === 'unknown') 
        ? 'healthy' 
        : Object.values(serverMetrics.componentStatus).some(s => s === 'error') 
          ? 'unhealthy' 
          : 'degraded';
      
      return reply.send({ 
        status: overallStatus === 'healthy' ? 'ok' : overallStatus, 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        latency: {
          database: dbLatency,
          redis: redisLatency
        },
        integrations: {
          // Canonical
          digitax: digitaxHealth,
          // Backward-compatible alias (older docs/monitors)
          duplo: digitaxHealth,
          remita: remitaHealth
        },
        ubl: ublSnapshot
      });
    } catch (error) {
      app.log.error({ err: error }, 'Health check failed');
      return reply.status(503).send({ 
        status: 'error', 
        error: 'Service unavailable',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Detailed health check with metrics
  app.get('/health/detailed', async (_req, reply) => {
    try {
      // Import USSD handler for health check
      const { default: USSDHandler } = await import('./integrations/ussd/handler');
      const ussdHandler = new USSDHandler(prisma);
      
      const metrics = { timestamp: new Date(), uptime: process.uptime() };
      const healthSummary = { status: 'ok', issues: [] };
      
      return reply.send({
        status: healthSummary.status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        metrics,
        issues: healthSummary.issues
      });
    } catch (error) {
      app.log.error({ err: error }, 'Detailed health check failed');
      return reply.status(503).send({
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Readiness check (for Kubernetes)
  app.get('/ready', async (_req, reply) => {
    const injected = await app.inject({ method: 'GET', url: '/health/ready' });
    try {
      const payload = JSON.parse(injected.payload);
      return reply.status(injected.statusCode).send(payload);
    } catch {
      return reply.status(injected.statusCode).send({
        status: injected.statusCode === 200 ? 'ready' : 'not-ready',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Production metrics endpoint (supports JSON and Prometheus format)
  app.get('/metrics', async (req, reply) => {
    try {
      const acceptHeader = req.headers.accept || '';
      const queryFormat = (req.query as Record<string, string>)?.format;
      const wantsPrometheus = acceptHeader.includes('text/plain') || 
                              acceptHeader.includes('application/openmetrics-text') ||
                              queryFormat === 'prometheus';
      
      const poolMonitor = getPoolMonitor();
      const dlqMonitor = getDLQMonitor();
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      const errorRate = serverMetrics.requestCount > 0 
        ? (serverMetrics.errorCount / serverMetrics.requestCount * 100).toFixed(2) 
        : '0.00';

      // Prometheus text format
      if (wantsPrometheus) {
        const coreMetrics = `
# HELP taxbridge_uptime_seconds Server uptime in seconds
# TYPE taxbridge_uptime_seconds gauge
taxbridge_uptime_seconds ${uptime.toFixed(2)}

# HELP taxbridge_requests_total Total number of requests
# TYPE taxbridge_requests_total counter
taxbridge_requests_total ${serverMetrics.requestCount}

# HELP taxbridge_errors_total Total number of errors
# TYPE taxbridge_errors_total counter
taxbridge_errors_total ${serverMetrics.errorCount}

# HELP taxbridge_error_rate_percent Error rate percentage
# TYPE taxbridge_error_rate_percent gauge
taxbridge_error_rate_percent ${errorRate}

# HELP taxbridge_memory_heap_used_bytes Heap memory used
# TYPE taxbridge_memory_heap_used_bytes gauge
taxbridge_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP taxbridge_memory_heap_total_bytes Total heap memory
# TYPE taxbridge_memory_heap_total_bytes gauge
taxbridge_memory_heap_total_bytes ${memUsage.heapTotal}

# HELP taxbridge_memory_rss_bytes Resident set size
# TYPE taxbridge_memory_rss_bytes gauge
taxbridge_memory_rss_bytes ${memUsage.rss}

# HELP taxbridge_component_status Component health status (1=healthy, 0.5=degraded, 0=error)
# TYPE taxbridge_component_status gauge
taxbridge_component_status{component="database"} ${serverMetrics.componentStatus.database === 'healthy' ? 1 : serverMetrics.componentStatus.database === 'degraded' ? 0.5 : 0}
taxbridge_component_status{component="redis"} ${serverMetrics.componentStatus.redis === 'healthy' ? 1 : serverMetrics.componentStatus.redis === 'degraded' ? 0.5 : 0}
taxbridge_component_status{component="queues"} ${serverMetrics.componentStatus.queues === 'healthy' ? 1 : serverMetrics.componentStatus.queues === 'degraded' ? 0.5 : 0}
taxbridge_component_status{component="sms"} ${serverMetrics.componentStatus.sms === 'healthy' ? 1 : serverMetrics.componentStatus.sms === 'degraded' ? 0.5 : 0}
`.trim();

        const promExtension = metrics.formatPrometheusMetrics();
        const payload = [coreMetrics, promExtension].filter(Boolean).join('\n\n');
        
        reply.header('Content-Type', 'text/plain; version=0.0.4');
        return reply.send(payload);
      }

      // JSON format (default)
      const metricsData: any = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        server: {
          requestCount: serverMetrics.requestCount,
          errorCount: serverMetrics.errorCount,
          errorRate: errorRate + '%',
        },
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss,
        },
        componentStatus: serverMetrics.componentStatus,
      };

      if (poolMonitor) {
        metricsData.connectionPools = await poolMonitor.getCurrentMetrics();
      }

      if (dlqMonitor) {
        metricsData.queues = await dlqMonitor.getMetrics();
      }

      return reply.send(metricsData);
    } catch (error) {
      app.log.error({ err: error }, 'Metrics collection failed');
      return reply.status(500).send({ 
        error: 'Failed to collect metrics',
        timestamp: new Date().toISOString()
      });
    }
  });

  // DigiTax health check
  app.get('/health/digitax', async (_req, reply) => {
    const startTime = Date.now();
    try {
      const mockMode = String(process.env.DIGITAX_MOCK_MODE || 'false').toLowerCase() === 'true';
      
      if (mockMode) {
        return reply.send({
          status: 'healthy',
          provider: 'digitax',
          mode: 'mock',
          latency: 2,
          timestamp: new Date().toISOString()
        });
      }

      const digitaxUrl = (process.env.DIGITAX_API_URL || '').trim();
      if (!digitaxUrl) {
        return reply.status(503).send({
          status: 'error',
          provider: 'digitax',
          error: 'Missing DIGITAX_API_URL',
          timestamp: new Date().toISOString()
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        // Lightweight connectivity check (does not assume a specific DigiTax health endpoint)
        const response = await fetch(digitaxUrl, { method: 'GET', signal: controller.signal });
        
        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        if (response.ok || response.status === 302) {
          return reply.send({
            status: 'healthy',
            provider: 'digitax',
            latency,
            timestamp: new Date().toISOString()
          });
        } else if (response.status >= 500) {
          return reply.status(503).send({
            status: 'error',
            provider: 'digitax',
            error: 'DigiTax gateway unavailable',
            latency,
            timestamp: new Date().toISOString()
          });
        } else {
          return reply.send({
            status: 'degraded',
            provider: 'digitax',
            statusCode: response.status,
            latency,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error: any) {
        clearTimeout(timeout);
        return reply.status(503).send({
          status: 'error',
          provider: 'digitax',
          error: error.message || 'Connection failed',
          latency: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      app.log.error({ err: error }, 'DigiTax health check failed');
      return reply.status(503).send({
        status: 'error',
        provider: 'digitax',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Backward-compatible alias (older docs/monitors).
  // If legacy Duplo credentials are configured, run the legacy check;
  // otherwise defer to the DigiTax check.
  app.get('/health/duplo', async (_req, reply) => {
    const hasLegacyDuploCreds = Boolean(process.env.DUPLO_CLIENT_ID && process.env.DUPLO_CLIENT_SECRET);
    if (!hasLegacyDuploCreds) {
      const injected = await app.inject({ method: 'GET', url: '/health/digitax' });
      reply.code(injected.statusCode);
      for (const [k, v] of Object.entries(injected.headers)) reply.header(k, v as any);
      return reply.send(injected.json());
    }

    const startTime = Date.now();
    try {
      const duploUrl = process.env.DUPLO_API_URL || 'https://api.duplo.co';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        // Lightweight OAuth ping
        const response = await fetch(`${duploUrl}/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: process.env.DUPLO_CLIENT_ID,
            client_secret: process.env.DUPLO_CLIENT_SECRET
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        if (response.ok) {
          return reply.send({
            status: 'healthy',
            provider: 'duplo',
            latency,
            timestamp: new Date().toISOString()
          });
        }

        return reply.status(503).send({
          status: response.status >= 500 ? 'error' : 'degraded',
          provider: 'duplo',
          error: `HTTP ${response.status}`,
          latency,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        clearTimeout(timeout);
        return reply.status(503).send({
          status: 'error',
          provider: 'duplo',
          error: error.message || 'Connection failed',
          latency: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      app.log.error({ err: error }, 'Duplo health check failed');
      return reply.status(503).send({
        status: 'error',
        provider: 'duplo',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Remita health check
  app.get('/health/remita', async (_req, reply) => {
    const startTime = Date.now();
    try {
      const mockMode = String(process.env.REMITA_MOCK_MODE || 'false').toLowerCase() === 'true';

      if (mockMode) {
        return reply.send({
          status: 'healthy',
          provider: 'remita',
          mode: 'mock',
          latency: 2,
          timestamp: new Date().toISOString()
        });
      }

      const remitaUrl = process.env.REMITA_API_URL || 'https://login.remita.net';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        // Lightweight connectivity check
        const response = await fetch(remitaUrl, {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        const latency = Date.now() - startTime;

        // Remita base URL should return 200 or 302
        if (response.ok || response.status === 302) {
          return reply.send({
            status: 'healthy',
            provider: 'remita',
            latency,
            timestamp: new Date().toISOString()
          });
        } else if (response.status >= 500) {
          return reply.status(503).send({
            status: 'error',
            provider: 'remita',
            error: 'Remita gateway unavailable',
            latency,
            timestamp: new Date().toISOString()
          });
        } else {
          return reply.send({
            status: 'degraded',
            provider: 'remita',
            statusCode: response.status,
            latency,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error: any) {
        clearTimeout(timeout);
        return reply.status(503).send({
          status: 'error',
          provider: 'remita',
          error: error.message || 'Connection failed',
          latency: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      app.log.error({ err: error }, 'Remita health check failed');
      return reply.status(503).send({
        status: 'error',
        provider: 'remita',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Combined integrations health check (DigiTax + Remita)
  app.get('/health/integrations', async (_req, reply) => {
    const now = new Date().toISOString();

    try {
      const [digitaxInjected, remitaInjected] = await Promise.all([
        app.inject({ method: 'GET', url: '/health/digitax' }),
        app.inject({ method: 'GET', url: '/health/remita' })
      ]);

      const digitax = digitaxInjected.json() as any;
      const remita = remitaInjected.json() as any;

      const digitaxStatus = (digitax?.status as string) || 'error';
      const remitaStatus = (remita?.status as string) || 'error';

      const statuses = [digitaxStatus, remitaStatus];
      const overallStatus: 'healthy' | 'degraded' | 'error' = statuses.includes('error')
        ? 'error'
        : statuses.includes('degraded')
          ? 'degraded'
          : 'healthy';

      return reply
        .status(overallStatus === 'error' ? 503 : 200)
        .send({
          status: overallStatus,
          integrations: {
            // Canonical
            digitax,
            // Backward-compatible alias (older dashboards/monitors)
            duplo: digitax,
            remita,
          },
          timestamp: now,
        });
    } catch (error: any) {
      app.log.error({ err: error }, 'Integrations health check failed');
      return reply.status(503).send({
        status: 'error',
        integrations: {
          digitax: { status: 'error', provider: 'digitax', error: 'Check failed', timestamp: now },
          duplo: { status: 'error', provider: 'digitax', error: 'Check failed', timestamp: now },
          remita: { status: 'error', provider: 'remita', error: 'Check failed', timestamp: now },
        },
        error: error?.message || 'Failed to check integrations health',
        timestamp: now,
      });
    }
  });

  // Database-only health check (used by F3/F4 validation scripts)
  app.get('/health/db', async (_req, reply) => {
    const startTime = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      serverMetrics.componentStatus.database = latency < 100 ? 'healthy' : 'degraded';

      return reply.send({
        status: latency < 100 ? 'healthy' : 'degraded',
        component: 'database',
        latency,
        poolMax: Number(
          (app as any).config?.DATABASE_POOL_MAX ??
            process.env.DATABASE_POOL_MAX ??
            process.env.DB_POOL_MAX ??
            10
        ),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      serverMetrics.componentStatus.database = 'error';
      app.log.error({ err: error }, 'Database health check failed');
      return reply.status(503).send({
        status: 'error',
        component: 'database',
        error: error.message || 'Connection failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Queue health check (BullMQ job counts)
  app.get('/health/queues', async (_req, reply) => {
    try {
      const redis = getRedisConnection();
      const pong = await redis.ping();
      if (pong !== 'PONG') throw new Error('Redis ping failed');

      // Retrieve queue job counts via BullMQ Queue class
      const { Queue } = await import('bullmq');
      const invoiceSyncQueue = new Queue('invoice-sync', { connection: redis });
      const paymentQueue = new Queue('payment-webhook', { connection: redis });

      const [invoiceCounts, paymentCounts] = await Promise.all([
        invoiceSyncQueue.getJobCounts(),
        paymentQueue.getJobCounts()
      ]);

      // Clean up queue instances to avoid dangling listeners
      await invoiceSyncQueue.close();
      await paymentQueue.close();

      const totalFailed = (invoiceCounts.failed || 0) + (paymentCounts.failed || 0);
      const status = totalFailed > 100 ? 'degraded' : 'healthy';

      serverMetrics.componentStatus.queues = status;

      return reply.send({
        status,
        component: 'queues',
        invoiceSync: invoiceCounts,
        paymentWebhooks: paymentCounts,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      serverMetrics.componentStatus.queues = 'error';
      app.log.error({ err: error }, 'Queue health check failed');
      return reply.status(503).send({
        status: 'error',
        component: 'queues',
        error: error.message || 'Queue connection failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  await app.register(invoicesRoutes, { prisma });
  await app.register(ocrRoutes);
  await app.register(paymentsRoutes, { prisma });
  await app.register(ussdRoutes, { prisma });
  await app.register(smsRoutes, { prisma });
  await app.register(chatbotRoutes);
  await app.register(adminRoutes, { prefix: '/admin', prisma });
  await app.register(authRoutes);
  await app.register(privacyRoutes);

  // Optionally start background payment worker in the same process when explicitly enabled.
  if (String(process.env.START_PAYMENT_WORKER || '').toLowerCase() === 'true') {
    try {
      // import side-effecting worker
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      await import('./queue/paymentWorker');
      app.log.info('Payment worker started in-process');
    } catch (err) {
      app.log.error({ err }, 'Failed to start payment worker');
    }
  }

  const port = Number((app as any).config.PORT || 3000);

  // Start background services
  if (String(process.env.ENABLE_DEADLINE_REMINDERS || '').toLowerCase() !== 'false') {
    startDeadlineReminderCron();
    log.info('Deadline reminder cron job started');
  }
  
  // Start health monitoring
  if (process.env.ENABLE_METRICS === 'true') {
    startHealthMonitoring();
  }
  
  // Start SMS provider health checks
  setTimeout(async () => {
    try {
      await healthCheckAllProviders();
      log.info('Initial SMS provider health checks completed');
    } catch (error) {
      log.error('SMS provider health checks failed', { err: error });
    }
  }, 5000); // 5 seconds after startup

  async function listenWithOptionalFallback(startPort: number) {
    const allowFallback =
      (String(process.env.ALLOW_PORT_FALLBACK || '').toLowerCase() === 'true' ||
        String(process.env.ALLOW_PORT_FALLBACK || '') === '1') &&
      String(process.env.NODE_ENV || '').toLowerCase() !== 'production';

    const maxAttempts = allowFallback ? 5 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = startPort + attempt;
      try {
        await app.listen({ port: candidate, host: '0.0.0.0' });
        return candidate;
      } catch (err: any) {
        lastError = err;

        if (err?.code === 'EADDRINUSE') {
          if (!allowFallback) {
            log.error(
              `Failed to start server: Port ${candidate} already in use. Stop the other process or set PORT to a free port.`
            );
            throw err;
          }

          log.warn(`Port ${candidate} in use; trying next port`);
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  }

  const boundPort = await listenWithOptionalFallback(port);

  log.info(`TaxBridge server started on port ${boundPort} (env: ${process.env.NODE_ENV || 'development'}, pid: ${process.pid})`);
}

// Health monitoring function
function startHealthMonitoring() {
  const interval = parseInt(process.env.METRICS_INTERVAL || '60000'); // Default 1 minute
  
  healthCheckInterval = setInterval(async () => {
    if (isShuttingDown) return;
    
    try {
      // Check database
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;
      serverMetrics.componentStatus.database = dbLatency < 100 ? 'healthy' : dbLatency < 500 ? 'degraded' : 'error';
      
      // Check Redis
      const redisStart = Date.now();
      const redis = getRedisConnection();
      await redis.ping();
      const redisLatency = Date.now() - redisStart;
      serverMetrics.componentStatus.redis = redisLatency < 50 ? 'healthy' : redisLatency < 200 ? 'degraded' : 'error';
      
      // Check SMS providers health status
      try {
        const providerHealthStatus = getProviderHealth();
        const healthyCount = Object.values(providerHealthStatus).filter(p => p.isHealthy).length;
        serverMetrics.componentStatus.sms = healthyCount > 0 ? 'healthy' : 'degraded';
      } catch {
        serverMetrics.componentStatus.sms = 'unknown';
      }
      
      serverMetrics.lastHealthCheck = Date.now();
      
      // Log health status if degraded
      const hasIssues = Object.values(serverMetrics.componentStatus).some(s => s !== 'healthy' && s !== 'unknown');
      if (hasIssues) {
        log.warn('System health check', {
          components: serverMetrics.componentStatus,
          latency: { database: dbLatency, redis: redisLatency }
        });
      }
    } catch (error) {
      log.error('Health monitoring failed', { err: error });
    }
  }, interval);
  
  log.info('Health monitoring started', { interval });
}

// Graceful shutdown function
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    log.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  
  isShuttingDown = true;
  log.info(`Starting graceful shutdown (${signal})`);
  
  try {
    // Stop accepting new requests
    log.info('Stopping new requests');
    
    // Stop health monitoring
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
    
    // Wait for ongoing requests to finish (with timeout)
    const shutdownTimeout = setTimeout(() => {
      log.warn('Shutdown timeout, forcing exit');
      process.exit(1);
    }, 30000); // 30 seconds timeout
    
    // Close queues
    log.info('Closing message queues');
    await Promise.all([
      closeInvoiceSyncQueue().catch(err => log.error('Error closing invoice sync queue', { err })),
      closePaymentQueue().catch(err => log.error('Error closing payment queue', { err }))
    ]);
    
    // Shutdown monitoring services
    log.info('Shutting down monitoring services');
    shutdownDLQMonitoring();
    shutdownPoolMonitoring();
    
    // Close database connections
    log.info('Closing database connections');
    await disconnectPrisma().catch(err => log.error('Error closing database', { err }));
    
    // Close Redis connections
    log.info('Closing Redis connections');
    await closeRedisConnection().catch(err => log.error('Error closing Redis', { err }));
    
    // Clear timeout
    clearTimeout(shutdownTimeout);
    
    log.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    log.error('Error during graceful shutdown', { err: error });
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  await gracefulShutdown(signal);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  try {
    app.log.error({ err: reason }, 'unhandledRejection');
    if (isSentryEnabled()) {
      Sentry.captureException(reason);
    }
    void gracefulShutdown('unhandledRejection');
  } catch {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  try {
    app.log.error({ err }, 'uncaughtException');
    if (isSentryEnabled()) {
      Sentry.captureException(err);
    }
    void gracefulShutdown('uncaughtException');
  } catch {
    process.exit(1);
  }
});

process.on('SIGUSR2', () => {
  // For graceful reload in production
  log.info('Received SIGUSR2, initiating graceful restart');
  void gracefulShutdown('SIGUSR2');
});

bootstrap().catch(async (err) => {
  app.log.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
