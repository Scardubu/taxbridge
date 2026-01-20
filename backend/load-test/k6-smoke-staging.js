import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Staging-optimized smoke test: Public endpoints only
// Duration: ~3 minutes
// Purpose: Validate infrastructure and public APIs before full load tests

export let errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 users
    { duration: '2m', target: 5 },    // Stay at 5 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // Relaxed for smoke test
    http_req_failed: ['rate<0.05'],   // 5% error tolerance
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test 1: Liveness probe (no dependencies)
  const liveRes = http.get(`${BASE_URL}/health/live`);
  const liveOk = check(liveRes, {
    'liveness check returns 200': (r) => r.status === 200,
    'liveness has status field': (r) => r.json()?.status === 'ok',
    'liveness response time <100ms': (r) => r.timings.duration < 100,
  });
  if (!liveOk) errorRate.add(1);

  // Test 2: Readiness probe (requires DB + Redis)
  const readyRes = http.get(`${BASE_URL}/health/ready`);
  const readyOk = check(readyRes, {
    'readiness check returns 200': (r) => r.status === 200,
    'readiness has database status': (r) => r.json()?.dependencies?.database !== undefined,
    'readiness has redis status': (r) => r.json()?.dependencies?.redis !== undefined,
  });
  if (!readyOk) errorRate.add(1);

  // Test 3: Database health
  const dbRes = http.get(`${BASE_URL}/health/db`);
  const dbOk = check(dbRes, {
    'database health returns 200': (r) => r.status === 200,
    'database reports healthy status': (r) => r.json()?.status === 'healthy',
  });
  if (!dbOk) errorRate.add(1);

  // Test 4: Queue health
  const queueRes = http.get(`${BASE_URL}/health/queues`);
  const queueOk = check(queueRes, {
    'queue health returns 200': (r) => r.status === 200,
    'queue reports status': (r) => r.json()?.status !== undefined,
  });
  if (!queueOk) errorRate.add(1);

  // Test 5: DigiTax integration health (should report mock mode in staging)
  const digitaxRes = http.get(`${BASE_URL}/health/digitax`);
  const digitaxOk = check(digitaxRes, {
    'digitax health returns 200': (r) => r.status === 200,
    'digitax reports mode': (r) => r.json()?.mode !== undefined,
  });
  if (!digitaxOk) errorRate.add(1);

  // Test 6: Remita integration health (should report mock mode in staging)
  const remitaRes = http.get(`${BASE_URL}/health/remita`);
  const remitaOk = check(remitaRes, {
    'remita health returns 200': (r) => r.status === 200,
    'remita reports mode': (r) => r.json()?.mode !== undefined,
  });
  if (!remitaOk) errorRate.add(1);

  sleep(1);
}

export function handleSummary(data) {
  const healthChecksPassed = (
    data.metrics.checks.values.passes / 
    data.metrics.checks.values.fails
  ) > 0.95;

  console.log(`\n${'='.repeat(60)}`);
  console.log('SMOKE TEST SUMMARY (Staging)');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Success Rate: ${(100 - data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`P95 Latency: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`Checks Passed: ${data.metrics.checks.values.passes}/${data.metrics.checks.values.passes + data.metrics.checks.values.fails}`);
  console.log(`${'='.repeat(60)}`);
  
  if (healthChecksPassed) {
    console.log('✅ SMOKE TEST PASSED - Proceed to load testing');
  } else {
    console.log('❌ SMOKE TEST FAILED - Investigate health endpoint issues');
  }
  console.log(`${'='.repeat(60)}\n`);

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
