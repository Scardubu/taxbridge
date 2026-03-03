/**
 * TaxBridge V12 APEX — k6 Load Test
 * File: infra/k6/load-test.js
 *
 * Thresholds:
 *   - p95 response time < 2000ms
 *   - error rate < 1%
 *   - filing submission idempotency verified
 *
 * Run:
 *   k6 run --env BASE_URL=https://taxbridge-api-ker8.onrender.com infra/k6/load-test.js
 *
 * Requires k6 >= 0.46.0 with Scenarios API.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ── Custom metrics ──────────────────────────────────────────────────────────
const errorRate       = new Rate('taxbridge_errors');
const dashboardTrend  = new Trend('taxbridge_dashboard_latency', true);
const filingTrend     = new Trend('taxbridge_filing_latency', true);
const authTrend       = new Trend('taxbridge_auth_latency', true);
const idempotencyHits = new Counter('taxbridge_idempotency_hits');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'https://taxbridge-api-ker8.onrender.com';
const TEST_TOKEN = __ENV.TEST_TOKEN || '';   // Pre-issued load-test JWT

// ── Options ─────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Ramp up to 200 VUs over 10 min
    main_load: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m',  target: 50  },
        { duration: '5m',  target: 200 },
        { duration: '2m',  target: 200 },
        { duration: '1m',  target: 0   },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // P95 < 2000ms (k6 uses microseconds by default for trends in ms mode)
    'taxbridge_dashboard_latency': ['p(95)<2000'],
    'taxbridge_filing_latency':    ['p(95)<3000'],
    'taxbridge_auth_latency':      ['p(95)<1500'],
    // Overall p95 < 2000ms
    'http_req_duration':           ['p(95)<2000'],
    // Error rate < 1%
    'taxbridge_errors':            ['rate<0.01'],
    'http_req_failed':             ['rate<0.01'],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function authHeaders() {
  return {
    Authorization: `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Request-ID': randomString(16),
  };
}

function checkResponse(res, name) {
  const ok = check(res, {
    [`${name} status 200`]: (r) => r.status === 200,
    [`${name} has body`]:   (r) => r.body && r.body.length > 0,
  });
  errorRate.add(!ok);
  return ok;
}

// ── Scenarios ────────────────────────────────────────────────────────────────

/**
 * Health / smoke check — always verify backend is up
 */
export function healthCheck() {
  const res = http.get(`${BASE_URL}/health/live`);
  check(res, { 'health:live 200': (r) => r.status === 200 });
}

/**
 * Dashboard composite endpoint — primary SME flow
 */
export function dashboardTest() {
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/api/v1/dashboard`,
    { headers: authHeaders(), tags: { name: 'dashboard_composite' } },
  );
  dashboardTrend.add(Date.now() - start);
  checkResponse(res, 'dashboard');
}

/**
 * Filing submission — idempotency key prevents duplicate charges
 */
export function filingTest() {
  const idempotencyKey = `load-test-${randomString(12)}`;
  const payload = JSON.stringify({
    invoiceNumber: `INV-${randomIntBetween(10000, 99999)}`,
    amount:        randomIntBetween(50000, 5000000),
    vatRate:       0.075,
    buyerTin:      `12345678-${randomIntBetween(1000, 9999)}`,
    idempotencyKey,
  });

  const headers = { ...authHeaders(), 'Idempotency-Key': idempotencyKey };

  const start = Date.now();
  const res1 = http.post(`${BASE_URL}/api/v1/invoices`, payload, { headers, tags: { name: 'filing_create' } });
  filingTrend.add(Date.now() - start);

  const ok1 = checkResponse(res1, 'filing:create');
  if (!ok1) return;

  // Re-submit with same idempotency key — must not create duplicate
  const res2 = http.post(`${BASE_URL}/api/v1/invoices`, payload, { headers, tags: { name: 'filing_idempotent' } });
  const isIdempotent = check(res2, {
    'filing:idempotent 200 or 409': (r) => r.status === 200 || r.status === 409,
  });
  if (isIdempotent) idempotencyHits.add(1);
}

/**
 * Auth flow — login + session check (reduced rate: 1 per 5 VUs to avoid flood)
 */
export function authTest() {
  if (__VU % 5 !== 0) return;   // Only 20% of VUs run auth test

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email:    `loadtest+${randomIntBetween(1, 100)}@example.com`,
      password: 'LoadTest#2026!',
    }),
    {
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': randomString(16) },
      tags:    { name: 'auth_login' },
    },
  );
  authTrend.add(Date.now() - start);
  // Auth may return 401 for fake accounts — that's expected; we only track error on 5xx
  check(res, {
    'auth:no 500': (r) => r.status < 500,
  });
  if (res.status >= 500) errorRate.add(1);
}

/**
 * NRS health check — integration circuit breaker probe
 */
export function nrsHealthTest() {
  if (__VU % 20 !== 0) return;   // Only 5% of VUs

  const res = http.get(
    `${BASE_URL}/api/v1/nrs/health`,
    { headers: authHeaders(), tags: { name: 'nrs_health' } },
  );
  check(res, {
    'nrs:health 200': (r) => r.status === 200,
    'nrs:circuit in payload': (r) => {
      try { return JSON.parse(r.body).data?.circuitState !== undefined; }
      catch { return false; }
    },
  });
}

// ── Default scenario ─────────────────────────────────────────────────────────
export default function () {
  group('health', healthCheck);
  group('dashboard', dashboardTest);
  group('filing', filingTest);
  group('auth', authTest);
  group('nrs_health', nrsHealthTest);

  // Think time: 1-3 seconds (simulate real user behavior)
  sleep(randomIntBetween(1, 3) / 10);
}

// ── Teardown ─────────────────────────────────────────────────────────────────
export function teardown() {
  console.log('Load test complete. Check Grafana for metrics.');
}
