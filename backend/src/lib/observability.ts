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
 *   - C-26: Zero raw console output — use logger from lib/logger.ts
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
      Sentry.httpIntegration(),
    ],
    beforeSend(event) {
      // Tax identifiers, payer contact data and auth material must not leave
      // the application through error telemetry.
      if (event.request) {
        if (event.request.headers) {
          for (const headerName of Object.keys(event.request.headers)) {
            if (/^(authorization|cookie|set-cookie|x-api-key|x-admin-api-key|x-internal-key|x-admin-user-id)$/i.test(headerName)) {
              delete event.request.headers[headerName];
            }
          }
        }
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        if (event.request.url) {
          try {
            const url = new URL(event.request.url);
            event.request.url = `${url.origin}${url.pathname}`;
          } catch {
            delete event.request.url;
          }
        }
      }

      // User context often contains email, phone or internal identifiers.
      delete event.user;

      // HTTP breadcrumbs may carry request payloads or query strings.
      for (const breadcrumb of event.breadcrumbs ?? []) {
        if (!breadcrumb.data) continue;
        for (const key of Object.keys(breadcrumb.data)) {
          if (/body|payload|headers|cookies|authorization|token|email|phone|tin|nin|bvn/i.test(key)) {
            delete breadcrumb.data[key];
          }
        }
        const urlValue = breadcrumb.data.url;
        if (typeof urlValue === 'string') {
          try {
            const url = new URL(urlValue);
            breadcrumb.data.url = `${url.origin}${url.pathname}`;
          } catch {
            delete breadcrumb.data.url;
          }
        }
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
