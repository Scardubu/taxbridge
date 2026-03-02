/**
 * nrsService — TaxBridge V12
 *
 * NRS (Nigeria Revenue Service) integration via opossum circuit breaker.
 * Architecture §3.3 — all NRS API calls go through this service.
 *
 * Circuit breaker exposed as Prometheus Gauge `nrsCircuitState`
 * (0=CLOSED, 1=OPEN, 2=HALF_OPEN) per V12 criterion #14.
 *
 * C-07: Every exported function returns a safe fallback on failure.
 */

import CircuitBreaker from 'opossum';
import * as Sentry from '@sentry/node';
import { createLogger } from '../lib/logger';
import { registry as metricsRegistry } from './metrics';
import { Gauge } from 'prom-client';

const log = createLogger('nrs-service');

const NRS_API_URL  = process.env.NRS_API_URL  || 'https://api.nrs.gov.ng';
const NRS_API_KEY  = process.env.NRS_API_KEY  || '';
const MOCK_MODE    = process.env.DIGITAX_MOCK_MODE === 'true';

// ─── prom-client gauge (criterion #14) ───────────────────────────────────────
// 0 = CLOSED (healthy), 1 = OPEN (failing), 2 = HALF_OPEN (probing)

let nrsCircuitStateGauge: Gauge<string>;
try {
  nrsCircuitStateGauge = new Gauge({
    name:       'nrs_circuit_state',
    help:       'NRS circuit breaker state: 0=CLOSED, 1=OPEN, 2=HALF_OPEN',
    registers:  [metricsRegistry],
  });
} catch {
  // Gauge already registered in hot-reload (C-43 dev reload safe)
  nrsCircuitStateGauge = metricsRegistry.getSingleMetric('nrs_circuit_state') as Gauge<string>;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface NrsHealthResult {
  status:      'healthy' | 'degraded' | 'down' | 'mock' | 'unknown';
  latencyMs:   number | null;
  lastChecked: string;
}

export interface NrsStampResult {
  irn:        string;
  csid:       string;
  qrCode:     string;
  stampedAt:  string;
}

// ─── Circuit breaker setup ────────────────────────────────────────────────────

const BREAKER_OPTIONS: CircuitBreaker.Options = {
  timeout:              8_000,   // 8s per NRS SLA
  errorThresholdPercentage: 50,  // open after 50% failure rate
  resetTimeout:         30_000,  // try again after 30s
  volumeThreshold:      5,       // minimum requests before tripping
};

async function _callNrsApi<T>(
  endpoint: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${NRS_API_URL}${endpoint}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${NRS_API_KEY}`,
      'X-API-Key':     NRS_API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NRS API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

const breaker = new CircuitBreaker(_callNrsApi, BREAKER_OPTIONS);

// ─── Breaker event listeners ───────────────────────────────────────────────────

breaker.on('open',     () => {
  nrsCircuitStateGauge.set(1);
  log.error('NRS circuit breaker OPENED — all calls will fast-fail');
  Sentry.captureMessage('NRS circuit breaker opened', { level: 'error' });
});
breaker.on('close',    () => {
  nrsCircuitStateGauge.set(0);
  log.info('NRS circuit breaker CLOSED — service restored');
});
breaker.on('halfOpen', () => {
  nrsCircuitStateGauge.set(2);
  log.info('NRS circuit breaker HALF-OPEN — probing service');
});
breaker.on('fallback', () => {
  log.warn('NRS circuit breaker fallback triggered');
});

// Initialise gauge to closed state
nrsCircuitStateGauge.set(0);

// ─── Health check ─────────────────────────────────────────────────────────────

export async function getNrsHealth(): Promise<NrsHealthResult> {
  if (MOCK_MODE) {
    return { status: 'mock', latencyMs: null, lastChecked: new Date().toISOString() };
  }

  const t0 = Date.now();
  try {
    await breaker.fire('/health', {});
    return {
      status:      'healthy',
      latencyMs:   Date.now() - t0,
      lastChecked: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status:      breaker.opened ? 'down' : 'degraded',
      latencyMs:   Date.now() - t0,
      lastChecked: new Date().toISOString(),
    };
  }
}

// ─── IRN / stamp submission ───────────────────────────────────────────────────

/**
 * Submit an invoice to NRS for stamping and IRN assignment.
 * Returns null on any failure — caller should queue for retry.
 */
export async function submitInvoiceForStamp(
  invoice: Record<string, unknown>,
): Promise<NrsStampResult | null> {
  if (MOCK_MODE) {
    return _mockStamp(invoice);
  }

  try {
    const result = await breaker.fire('/v1/invoice/stamp', invoice) as NrsStampResult;
    return result;
  } catch (err) {
    Sentry.captureException(err, { extra: { invoiceId: (invoice as any).id } });
    log.error('NRS stamp submission failed', { err });
    return null;
  }
}

// ─── Mock helpers (DIGITAX_MOCK_MODE=true, dev/staging only) ─────────────────

function _mockStamp(invoice: Record<string, unknown>): NrsStampResult {
  const id = (invoice as any).id ?? 'mock-id';
  return {
    irn:       `MOCK-IRN-${id.slice(0, 8).toUpperCase()}`,
    csid:      `MOCK-CSID-${Date.now()}`,
    qrCode:    `https://verify.nrs.gov.ng/mock/${id}`,
    stampedAt: new Date().toISOString(),
  };
}
