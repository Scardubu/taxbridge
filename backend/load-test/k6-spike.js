import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

// Spike test: Sudden traffic surge to validate circuit breaker and rate limiting
// Duration: ~5 minutes
// Purpose: Test system resilience under sudden load

export let errorRate = new Rate('errors');
export let rateLimitHits = new Rate('rate_limit_429');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Normal load
    { duration: '1m', target: 200 },   // Instant spike
    { duration: '2m', target: 200 },   // Sustain spike
    { duration: '1m', target: 10 },    // Drop back
    { duration: '30s', target: 0 },    // Cooldown
  ],
  thresholds: {
    http_req_failed: ['rate<0.2'], // 20% tolerance during spike
    rate_limit_429: ['rate<0.3'],  // Expect some rate limiting
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.post(`${BASE_URL}/invoices`, JSON.stringify({
    customerName: 'Spike Test',
    items: [{
      description: 'Service',
      quantity: 1,
      unitPrice: 100
    }],
    subtotal: 100,
    vat: 7.5,
    total: 107.5
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
  });

  check(res, {
    'not rate limited': (r) => r.status !== 429,
    'request processed': (r) => r.status < 500,
  });

  if (res.status === 429) {
    rateLimitHits.add(1);
  }

  // No sleep - maximum pressure
}

export function handleSummary(data) {
  const rateLimitRate = data.metrics.rate_limit_429?.values?.rate || 0;
  
  if (rateLimitRate > 0.3) {
    console.warn('⚠️ High rate limiting (>30%) - consider increasing limits or adding graduated penalties');
  }
  
  return {
    'spike-test-summary.json': JSON.stringify(data),
  };
}
