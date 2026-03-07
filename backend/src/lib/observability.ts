/**
 * Observability — TaxBridge V13 Sovereign
 *
 * Single initialisation point for:
 *   - Sentry (error tracking, tracing, performance)
 *   - Prometheus (prom-client default metrics + custom counters)
 *
 * Usage: import './lib/observability' once in server.ts, before Fastify starts.
 *
 * Rules:
 *   - Never import this module more than once (singleton pattern)
 *   - All Prometheus metrics created here are exported for use in services
 *   - Sentry tracesSampleRate: 0.2 in production, 1.0 in development/test
 *   - C-26: No console.log — use logger from lib/logger.ts
 */

import * as Sentry from '@sentry/node';
import { collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { registry }   from '../services/metrics';
import { createLogger } from './logger';

const log = createLogger('observability');

let _initialised = false;

// ─── Sentry ───────────────────────────────────────────────────────────────────

export function initialiseSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    log.info('SENTRY_DSN not set — Sentry disabled (local dev)');
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn,
    environment:        process.env.NODE_ENV ?? 'development',
    release:            process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT,
    tracesSampleRate:   isProd ? 0.2 : 1.0,
    profilesSampleRate: isProd ? 0.1 : 0,
    integrations: [
      // Strip authorization header + cookies from events (PII / security)
      new Sentry.Integrations.Http({ tracing: true }),
    ],
    beforeSend(event) {
      // Strip PII from breadcrumbs
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      return event;
    },
    ignoreErrors: [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'AbortError',
    ],
  });

  log.info({ environment: process.env.NODE_ENV, tracesSampleRate: isProd ? 0.2 : 1.0 }, 'Sentry initialised');
}

// ─── Prometheus ───────────────────────────────────────────────────────────────

export function initialiseMetrics(): void {
  // Default Node.js process metrics (CPU, memory, GC, event loop lag)
  collectDefaultMetrics({ register: registry, prefix: 'taxbridge_' });
  log.info('Prometheus default metrics registered');
}

// ─── V13 Platform Metrics ─────────────────────────────────────────────────────
// Additional business-level metrics beyond the gateway-specific ones in services/metrics.ts

export const v13Metrics = {
  /**
   * Count of compliance preflight checks by result (pass | fail | warn)
   * Labels: { result: 'pass' | 'fail' | 'warn', taxType: 'VAT' | 'WHT' | 'PAYE' | 'CIT' | 'NIL' }
   */
  preflightChecks: new Counter({
    name:       'taxbridge_preflight_checks_total',
    help:       'Total compliance preflight checks',
    labelNames: ['result', 'taxType'] as const,
    registers:  [registry],
  }),

  /**
   * Count of filings submitted by tax type and status
   * Labels: { taxType, status: 'submitted' | 'duplicate' | 'error' }
   */
  filingsTotal: new Counter({
    name:       'taxbridge_filings_total',
    help:       'Total tax filings submitted',
    labelNames: ['taxType', 'status'] as const,
    registers:  [registry],
  }),

  /**
   * Filing submission latency in milliseconds
   * Labels: { taxType }
   */
  filingDuration: new Histogram({
    name:       'taxbridge_filing_duration_ms',
    help:       'Tax filing submission latency (ms)',
    labelNames: ['taxType'] as const,
    buckets:    [50, 100, 250, 500, 1000, 2500, 5000],
    registers:  [registry],
  }),

  /**
   * BullMQ DLQ depth by queue name — polled by dlqMonitorCron every 15 min
   * Labels: { queue }
   */
  dlqDepth: new Gauge({
    name:       'taxbridge_dlq_depth',
    help:       'Current BullMQ dead-letter queue depth',
    labelNames: ['queue'] as const,
    registers:  [registry],
  }),

  /**
   * Count of onboarding wizard completions
   * Labels: { step: 'tin' | 'cac' | 'obligations' | 'security' | 'review' | 'complete' }
   */
  onboardingSteps: new Counter({
    name:       'taxbridge_onboarding_steps_total',
    help:       'Onboarding wizard step completions',
    labelNames: ['step'] as const,
    registers:  [registry],
  }),

  /**
   * Active WebSocket / SSE connections (for real-time dashboard push)
   */
  activeConnections: new Gauge({
    name:      'taxbridge_active_connections',
    help:      'Active real-time connections (WebSocket/SSE)',
    registers: [registry],
  }),

  /**
   * Circuit breaker state — 1 = open (tripped), 0 = closed (healthy)
   * Labels: { service: 'nrs' | 'youverify' | 'paystack' | 'flutterwave' }
   */
  circuitBreakerState: new Gauge({
    name:       'taxbridge_circuit_breaker_state',
    help:       'Circuit breaker state (1=open, 0=closed)',
    labelNames: ['service'] as const,
    registers:  [registry],
  }),
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * initialiseObservability — call ONCE from server.ts before Fastify starts.
 * Idempotent: safe to call in tests but only initialises once.
 */
export function initialiseObservability(): void {
  if (_initialised) return;
  _initialised = true;

  initialiseSentry();
  initialiseMetrics();

  log.info('Observability stack ready (Sentry + Prometheus)');
}
