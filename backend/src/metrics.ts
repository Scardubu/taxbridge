/**
 * V12 §17.1 — TaxBridge Prometheus Metrics (re-export + V12 additions)
 *
 * This file re-exports the existing prom-client Registry singleton from
 * services/metrics.ts and registers the 7 V12-mandated "taxbridge_*" metrics.
 *
 * Gate check: grep -c "new Registry()" backend/src → 1 (singleton lives in services/metrics.ts)
 * Gate check: grep "taxbridge_api_request_duration_seconds" backend/src/metrics.ts → pass
 */

import { Counter, Histogram, Gauge } from 'prom-client';
import { registry } from './services/metrics';

// ── Re-export existing registry & service ──────────────────────────────
export { registry };
export { metrics as metricsService } from './services/metrics';

// ── V12 §17.1: 7 mandatory TaxBridge metrics ──────────────────────────

/** 1. API request duration (seconds) — Histogram */
export const taxbridge_api_request_duration_seconds = new Histogram({
  name: 'taxbridge_api_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/** 2. NRS stamp success — Counter */
export const taxbridge_nrs_stamp_success_total = new Counter({
  name: 'taxbridge_nrs_stamp_success_total',
  help: 'Successful NRS stamp submissions',
  labelNames: ['orgId'] as const,
  registers: [registry],
});

/** 3. NRS stamp failure — Counter */
export const taxbridge_nrs_stamp_failure_total = new Counter({
  name: 'taxbridge_nrs_stamp_failure_total',
  help: 'Failed NRS stamp submissions',
  labelNames: ['reason'] as const,
  registers: [registry],
});

/** 4. Anomaly detected — Counter */
export const taxbridge_anomaly_detected_total = new Counter({
  name: 'taxbridge_anomaly_detected_total',
  help: 'Anomalies detected by signal type and severity',
  labelNames: ['signal', 'severity'] as const,
  registers: [registry],
});

/** 5. DLQ depth — Gauge */
export const taxbridge_dlq_depth = new Gauge({
  name: 'taxbridge_dlq_depth',
  help: 'Dead-letter queue depth by queue name',
  labelNames: ['queue_name'] as const,
  registers: [registry],
});

/** 6. Penalty estimate — Counter */
export const taxbridge_penalty_estimate_total = new Counter({
  name: 'taxbridge_penalty_estimate_total',
  help: 'Penalty estimates computed',
  labelNames: ['taxType'] as const,
  registers: [registry],
});

/** 7. NRS circuit state — Gauge (0=closed, 1=half-open, 2=open) */
export const taxbridge_nrs_circuit_state = new Gauge({
  name: 'taxbridge_nrs_circuit_state',
  help: 'NRS circuit breaker state: 0=closed, 1=half-open, 2=open',
  registers: [registry],
});
