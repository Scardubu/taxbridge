import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Smoke test: Quick validation before full load tests
// Duration: ~5 minutes
// Purpose: Catch critical failures early

export let errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 5 },   // Ramp up to 5 users
    { duration: '3m', target: 5 },   // Stay at 5 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // Relaxed for smoke test
    http_req_failed: ['rate<0.05'],   // 5% error tolerance
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function authHeaders() {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (__ENV.AUTH_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.AUTH_TOKEN}`;
  }

  if (!headers.Authorization && __ENV.ALLOW_DEV_USER_HEADER === 'true' && __ENV.USER_ID) {
    headers['X-TaxBridge-User-Id'] = __ENV.USER_ID;
  }

  return headers;
}

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status 200': (r) => r.status === 200,
  });

  // Simple invoice creation
  const invoicePayload = JSON.stringify({
    customerName: 'Test Customer',
    items: [{
      description: 'Test Service',
      quantity: 1,
      unitPrice: 1000
    }]
  });

  const invoiceRes = http.post(`${BASE_URL}/api/v1/invoices`, invoicePayload, {
    headers: authHeaders(),
  });
  
  check(invoiceRes, {
    'invoice creation successful': (r) => r.status === 201 || r.status === 200,
  });

  sleep(1);
}
