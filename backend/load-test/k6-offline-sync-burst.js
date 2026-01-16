import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Offline sync burst test: Simulates users coming online and syncing many invoices
// Duration: ~8 minutes
// Purpose: Validate queue handling and circuit breaker under burst load

export let errorRate = new Rate('errors');
export let circuitBreakerTrips = new Rate('circuit_breaker_trips');

export const options = {
  stages: [
    { duration: '1m', target: 5 },    // Normal baseline
    { duration: '30s', target: 100 }, // Burst: 100 users sync at once
    { duration: '3m', target: 100 },  // Sustain burst
    { duration: '2m', target: 20 },   // Gradual recovery
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // Queue should absorb load
    http_req_failed: ['rate<0.15'],    // Some failures expected
    circuit_breaker_trips: ['rate<0.1'], // Circuit breaker should protect
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Simulate user syncing 3-10 invoices in rapid succession
  const invoiceCount = Math.floor(Math.random() * 8) + 3;
  
  for (let i = 0; i < invoiceCount; i++) {
    const res = http.post(`${BASE_URL}/invoices/sync`, JSON.stringify({
      invoiceId: `offline-${Date.now()}-${i}`,
      customerName: `Offline Customer ${i}`,
      items: [{
        description: `Service ${i}`,
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

    check(res, {
      'sync accepted': (r) => r.status === 202 || r.status === 200,
    });

    if (res.status === 503) {
      circuitBreakerTrips.add(1);
    }

    // Small delay between invoices from same user
    sleep(0.1);
  }

  // Delay before next user batch
  sleep(Math.random() * 2);
}

export function handleSummary(data) {
  const cbTripRate = data.metrics.circuit_breaker_trips?.values?.rate || 0;
  
  if (cbTripRate > 0.1) {
    console.warn('⚠️ Circuit breaker tripped frequently (>10%) - consider tuning thresholds');
  } else if (cbTripRate === 0) {
    console.warn('⚠️ Circuit breaker never triggered - may not be working');
  } else {
    console.log('✅ Circuit breaker functioning correctly');
  }
  
  return {
    'offline-sync-burst-summary.json': JSON.stringify(data),
  };
}
