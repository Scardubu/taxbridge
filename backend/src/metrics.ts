/**
 * V12 §17.1 — TaxBridge Prometheus Metrics (re-export + V12 additions)
 *
 * This file re-exports the existing prom-client Registry singleton from
 * services/metrics.ts and registers the 7 V12-mandated "taxbridge_*" metrics.
 *
 * Gate check: grep -c "new Registry()" backend/src → 1 (singleton lives in services/metrics.ts)
 * Gate check: grep "taxbridge_api_request_duration_seconds" backend/src/metrics.ts → pass
 */

import { Counter, Histogram, Gauge, Summary } from 'prom-client';
import { registry, metrics as metricsService } from './services/metrics';

// ── Re-export existing registry & service ──────────────────────────────
export { registry, metricsService };

// ── V12 §17.1: 7 mandatory TaxBridge metrics ──────────────────────────

/** 1. API request duration (seconds) — Histogram */
export const taxbridge_api_request_duration_seconds = new Histogram({
  name: 'taxbridge_api_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/** 2. NRS submission total — Counter */
export const taxbridge_nrs_submission_total = new Counter({
  name: 'taxbridge_nrs_submission_total',
  help: 'Total NRS invoice submissions',
  labelNames: ['status'] as const,
  registers: [registry],
});

/** 3. Payment amount (naira) — Summary */
export const taxbridge_payment_amount_naira = new Summary({
  name: 'taxbridge_payment_amount_naira',
  help: 'Payment amounts in naira',
  labelNames: ['gateway'] as const,
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [registry],
});

/** 4. Active users — Gauge */
export const taxbridge_active_users = new Gauge({
  name: 'taxbridge_active_users',
  help: 'Currently active / connected users',
  registers: [registry],
});

/** 5. OCR confidence — Histogram */
export const taxbridge_ocr_confidence = new Histogram({
  name: 'taxbridge_ocr_confidence',
  help: 'OCR receipt scan confidence scores',
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [registry],
});

/** 6. Sync queue depth — Gauge */
export const taxbridge_sync_queue_depth = new Gauge({
  name: 'taxbridge_sync_queue_depth',
  help: 'Pending items in sync queue',
  registers: [registry],
});

/** 7. DLQ size — Gauge */
export const taxbridge_dlq_size = new Gauge({
  name: 'taxbridge_dlq_size',
  help: 'Dead-letter queue size',
  registers: [registry],
});
