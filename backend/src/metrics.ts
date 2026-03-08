/**
 * Prometheus Metrics — TaxBridge V13 Sovereign
 *
 * global.__taxbridge_prom_registry guard prevents duplicate metric registration
 * on hot-reload in development.
 *
 * 7 mandated metrics:
 *   http_request_duration_seconds | http_errors_total | nrs_circuit_state
 *   dlq_depth | filing_submissions_total | active_users_total | penalty_estimate_ngn_total
 */
import { Registry, Histogram, Counter, Gauge } from 'prom-client';

declare global {
  // eslint-disable-next-line no-var
  var __taxbridge_prom_registry: Registry | undefined;
}

if (!globalThis.__taxbridge_prom_registry) {
  globalThis.__taxbridge_prom_registry = new Registry();
  const reg = globalThis.__taxbridge_prom_registry;

  new Histogram({
    name:       'http_request_duration_seconds',
    help:       'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets:    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers:  [reg],
  });

  new Counter({
    name:       'http_errors_total',
    help:       'Total HTTP errors by status code',
    labelNames: ['status_code', 'route'] as const,
    registers:  [reg],
  });

  new Gauge({
    name:      'nrs_circuit_state',
    help:      'NRS circuit breaker state: 0=closed, 1=half-open, 2=open',
    registers: [reg],
  });

  new Gauge({
    name:       'dlq_depth',
    help:       'Dead-letter queue depth by queue name',
    labelNames: ['queue_name'] as const,
    registers:  [reg],
  });

  new Counter({
    name:       'filing_submissions_total',
    help:       'Total filing submissions by tax type',
    labelNames: ['tax_type', 'status'] as const,
    registers:  [reg],
  });

  new Gauge({
    name:      'active_users_total',
    help:      'Active users in the last 24 hours',
    registers: [reg],
  });

  new Counter({
    name:       'penalty_estimate_ngn_total',
    help:       'Total penalty amounts estimated in NGN',
    labelNames: ['tax_type'] as const,
    registers:  [reg],
  });
}

export const register = globalThis.__taxbridge_prom_registry!;

// Legacy compat
export { register as registry };
