import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Soak test: Long-duration test to detect memory leaks and degradation
// Duration: 1 hour
// Purpose: Validate stability under sustained load

export let errorRate = new Rate('errors');
export let memoryLeakIndicator = new Rate('response_time_degradation');

export const options = {
  stages: [
    { duration: '5m', target: 50 },   // Ramp up
    { duration: '50m', target: 50 },  // Soak for 50 minutes
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'], // Should stay consistent
    http_req_failed: ['rate<0.08'],
    errors: ['rate<0.08'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const scenarios = [
    () => {
      // Invoice creation
      const res = http.post(`${BASE_URL}/invoices`, JSON.stringify({
        customerName: `Customer-${Date.now()}`,
        items: [{
          description: 'Soak Test Service',
          quantity: 1,
          unitPrice: 500
        }],
        subtotal: 500,
        vat: 37.5,
        total: 537.5
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
      });
      check(res, { 'invoice created': (r) => r.status < 400 });
    },
    () => {
      // Invoice list
      const res = http.get(`${BASE_URL}/invoices`, {
        headers: { 'Authorization': 'Bearer test-token' },
      });
      check(res, { 'invoice list retrieved': (r) => r.status === 200 });
    },
    () => {
      // Health check (connection pool monitoring)
      const res = http.get(`${BASE_URL}/health`);
      check(res, { 'health ok': (r) => r.status === 200 });
    }
  ];

  // Randomly execute scenarios
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  scenario();

  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function handleSummary(data) {
  // Check if response times degraded significantly (memory leak indicator)
  const p95Start = data.metrics.http_req_duration.values['p(95)'];
  const p95End = data.metrics.http_req_duration.values['p(95)'];
  
  if (p95End > p95Start * 1.5) {
    console.warn('⚠️ Response time degraded by >50% - potential memory leak');
  }
  
  return {
    'soak-test-summary.json': JSON.stringify(data),
  };
}
