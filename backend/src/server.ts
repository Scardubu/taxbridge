import Fastify from 'fastify';
import path from 'path';
import cors from '@fastify/cors';
import fastifyCompress from '@fastify/compress';
import fastifyEnv from '@fastify/env';
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
import {
  closeInvoiceSyncQueue,
  closeRedisConnection,
  closePaymentQueue,
  getRedisConnection
} from './queue/client';
import { startDeadlineReminderCron } from './services/deadlineReminder';
import { healthCheckAllProviders, getProviderHealth } from './integrations/comms/client';
import { createLogger } from './lib/logger';
import { securityMiddleware, checkRateLimit } from './lib/security';
import { 
  createRequestContext, 
  cleanupRequestContext, 
  logRequestCompletion, 
  getRequestContext
} from './lib/request-tracer';
import { setupSentry, checkDuploHealth as observeDuploHealth, checkRemitaHealth as observeRemitaHealth, validateSampleUBL as runUblHealthCheck, captureWithSentry, isSentryEnabled } from './middleware/sentry';
import { metrics } from './services/metrics';

const log = createLogger('server');
const prisma = new PrismaClient();

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
      reply.code(429).send({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((resetTimeMs - Date.now()) / 1000)
      });
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
  const statusCode = (error as any)?.statusCode ?? 500;
  
  // Track error metrics
  serverMetrics.errorCount++;

  if (isSentryEnabled()) {
    captureWithSentry(error, request, reply);
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({ 
      error: 'Validation failed',
      details: error.flatten() 
    });
  }

  const publicMessage =
    statusCode >= 500
      ? 'Internal Server Error'
      : error instanceof Error
        ? error.message
        : 'Bad Request';

  if (statusCode >= 500) {
    app.log.error({ err: error }, 'Server error');
  }

  return reply.status(statusCode).send({ 
    error: publicMessage,
    code: statusCode,
    timestamp: new Date().toISOString()
  });
});

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'REDIS_URL', 'DIGITAX_API_URL'],
  properties: {
    DATABASE_URL: { type: 'string' },
    PORT: { type: 'string', default: '3000' },
    REDIS_URL: { type: 'string' },
    DIGITAX_API_URL: { type: 'string' },
    DIGITAX_API_KEY: { type: 'string' },
    DIGITAX_HMAC_SECRET: { type: 'string' },
    DIGITAX_MOCK_MODE: { type: 'string', default: 'true' },
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
    ALLOWED_ORIGINS: { type: 'string' },
    REQUIRE_SMS_SIGNATURE: { type: 'string', default: '0' },
    ENABLE_DEADLINE_REMINDERS: { type: 'string', default: 'true' },
    TEST_PHONE_NUMBER: { type: 'string' },
    // Monitoring
    ENABLE_METRICS: { type: 'string', default: 'true' },
    METRICS_INTERVAL: { type: 'string', default: '60000' }, // 1 minute
    NODE_ENV: { type: 'string', default: 'development' }
  }
} as const;

async function bootstrap() {
  await app.register(cors, { 
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
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

  await app.register(fastifyEnv, {
    schema: envSchema,
    dotenv: { path: path.resolve(process.cwd(), '.env') }
  });

  const sentryReady = setupSentry(app);
  if (sentryReady) {
    log.info('Sentry monitoring enabled');
  }

  // Health check endpoints
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
      
      const [duploHealth, remitaHealth, ublSnapshot] = await Promise.all([
        observeDuploHealth().catch(() => ({ status: 'error', provider: 'duplo', timestamp: new Date().toISOString() } as const)),
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
          duplo: duploHealth,
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
    try {
      await prisma.$queryRaw`SELECT 1`;
      const redis = getRedisConnection();
      await redis.ping();
      
      // Check if all critical services are ready
      const isReady = true; // Could add more checks
      
      return reply.send({ 
        status: isReady ? 'ready' : 'not-ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      app.log.error({ err: error }, 'Readiness check failed');
      return reply.status(503).send({ 
        status: 'not-ready', 
        error: 'Services not ready' 
      });
    }
  });

  // Duplo/DigiTax health check
  app.get('/health/duplo', async (_req, reply) => {
    const startTime = Date.now();
    try {
      const mockMode = String(process.env.DIGITAX_MOCK_MODE || 'false').toLowerCase() === 'true';
      
      if (mockMode) {
        return reply.send({
          status: 'healthy',
          provider: 'duplo',
          mode: 'mock',
          latency: 2,
          timestamp: new Date().toISOString()
        });
      }

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
        } else {
          return reply.status(503).send({
            status: 'degraded',
            provider: 'duplo',
            error: `HTTP ${response.status}`,
            latency,
            timestamp: new Date().toISOString()
          });
        }
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

  // Metrics endpoint (Prometheus-compatible format for monitoring)
  app.get('/metrics', async (_req, reply) => {
    if (process.env.ENABLE_METRICS !== 'true') {
      return reply.status(404).send({ error: 'Metrics not enabled' });
    }
    
    try {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      const errorRate = serverMetrics.requestCount > 0 
        ? (serverMetrics.errorCount / serverMetrics.requestCount * 100).toFixed(2) 
        : '0.00';
      
      // Prometheus text format
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
    } catch (error) {
      app.log.error({ err: error }, 'Metrics collection failed');
      return reply.status(500).send({ error: 'Failed to collect metrics' });
    }
  });

  await app.register(invoicesRoutes, { prisma });
  await app.register(ocrRoutes);
  await app.register(paymentsRoutes, { prisma });
  await app.register(ussdRoutes, { prisma });
  await app.register(smsRoutes, { prisma });
  await app.register(chatbotRoutes);
  await app.register(adminRoutes, { prefix: '/admin', prisma });

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

  await app.listen({ port, host: '0.0.0.0' });
  
  log.info('TaxBridge server started', {
    port,
    env: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
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
    
    // Close database connections
    log.info('Closing database connections');
    await prisma.$disconnect().catch(err => log.error('Error closing database', { err }));
    
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
