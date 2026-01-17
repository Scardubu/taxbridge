import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics for enhanced monitoring
export const errorRate = new Rate('errors');
// Kept name for backward compatibility with existing dashboards
export const duploErrorRate = new Rate('duplo_errors');
export const remitaErrorRate = new Rate('remita_errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 150 },
    { duration: '3m', target: 150 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.1'],
    errors: ['rate<0.1'],
    duplo_errors: ['rate<0.05'],
    remita_errors: ['rate<0.05'],
    'http_req_duration{name:invoice-create}': ['p(95)<800'],
    'http_req_duration{name:invoice-list}': ['p(95)<500'],
    'http_req_duration{name:invoice-detail}': ['p(95)<500'],
    'http_req_duration{name:remita-generate}': ['p(95)<3000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

function generateInvoiceRequest() {
  return {
    customerName: `Test Customer ${Math.random().toString(36).substr(2, 5)}`,
    items: [
      {
        description: `Service ${Math.random().toString(36).substr(2, 7)}`,
        quantity: Math.floor(Math.random() * 10) + 1,
        unitPrice: Math.floor(Math.random() * 1000) + 100,
      },
    ],
  };
}

function generatePaymentData(invoiceId) {
  return {
    invoiceId,
    payerName: `Test User ${Math.random().toString(36).substr(2, 5)}`,
    payerEmail: `test${Math.random().toString(36).substr(2, 7)}@example.com`,
    payerPhone: `+234${Math.random().toString().substr(2, 10)}`,
  };
}

function authHeaders() {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (__ENV.AUTH_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.AUTH_TOKEN}`;
  }

  // Local-only convenience (requires backend env ALLOW_DEBUG_USER_ID_HEADER=true)
  if (!headers.Authorization && __ENV.ALLOW_DEV_USER_HEADER === 'true' && __ENV.USER_ID) {
    headers['X-TaxBridge-User-Id'] = __ENV.USER_ID;
  }

  return headers;
}

function waitForInvoiceStatus(invoiceId, desiredStatuses, maxSeconds) {
  const start = Date.now();
  let lastStatus = null;

  while ((Date.now() - start) / 1000 < maxSeconds) {
    const res = http.get(`${BASE_URL}/api/v1/invoices/${invoiceId}`, {
      headers: authHeaders(),
      tags: { name: 'invoice-detail' },
    });

    if (res.status !== 200) {
      return { ok: false, status: `http_${res.status}` };
    }

    const json = res.json();
    lastStatus = json?.invoice?.status;
    if (desiredStatuses.includes(lastStatus)) {
      return { ok: true, status: lastStatus };
    }

    sleep(1);
  }

  return { ok: false, status: lastStatus || 'unknown' };
}

export function setup() {
  console.log('Load test setup complete');
}

export default function () {
  const healthResponse = http.get(`${BASE_URL}/health`, {
    tags: { name: 'health-check' },
  });

  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  const digitaxHealth = http.get(`${BASE_URL}/health/digitax`, {
    tags: { name: 'digitax-health' },
  });

  const digitaxOk = check(digitaxHealth, {
    'digitax health reachable': (r) => r.status === 200 || r.status === 503,
  });
  if (!digitaxOk) duploErrorRate.add(1);

  const remitaHealth = http.get(`${BASE_URL}/health/remita`, {
    tags: { name: 'remita-health' },
  });

  const remitaHealthOk = check(remitaHealth, {
    'remita health reachable': (r) => r.status === 200 || r.status === 503,
  });
  if (!remitaHealthOk) remitaErrorRate.add(1);

  const invoiceReq = generateInvoiceRequest();
  const createRes = http.post(`${BASE_URL}/api/v1/invoices`, JSON.stringify(invoiceReq), {
    headers: authHeaders(),
    tags: { name: 'invoice-create' },
  });

  const createOk = check(createRes, {
    'invoice create status 201': (r) => r.status === 201,
    'invoice create returns invoiceId': (r) => Boolean(r.json()?.invoiceId),
  });

  if (!createOk) {
    errorRate.add(1);
    return;
  }

  const invoiceId = createRes.json().invoiceId;

  const listRes = http.get(`${BASE_URL}/api/v1/invoices?take=20`, {
    headers: authHeaders(),
    tags: { name: 'invoice-list' },
  });

  check(listRes, {
    'invoice list status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  const maxWaitSeconds = Number(__ENV.INVOICE_STAMP_WAIT_SECONDS || 10);
  const waitResult = waitForInvoiceStatus(invoiceId, ['stamped', 'paid'], maxWaitSeconds);

  if (String(__ENV.EXPECT_STAMPED || 'false').toLowerCase() === 'true' && waitResult.status !== 'stamped') {
    errorRate.add(1);
  }

  if (waitResult.ok && waitResult.status === 'stamped') {
    const paymentData = generatePaymentData(invoiceId);
    const remitaResponse = http.post(`${BASE_URL}/api/v1/payments/generate`, JSON.stringify(paymentData), {
      headers: authHeaders(),
      tags: { name: 'remita-generate' },
    });

    const remitaSuccess = check(remitaResponse, {
      'remita generate status 200/201': (r) => r.status === 200 || r.status === 201,
      'remita generate has RRR': (r) => r.json()?.rrr !== undefined,
      'remita generate has paymentUrl': (r) => r.json()?.paymentUrl !== undefined,
    });

    if (!remitaSuccess) {
      remitaErrorRate.add(1);
      errorRate.add(1);
    }
  }

  sleep(1);
}

export function teardown() {
  console.log('Load test teardown complete');
}

export function apiSpikeTest() {
  const batchRequests = [];
  for (let i = 0; i < 50; i++) {
    if (i % 2 === 0) {
      batchRequests.push(['GET', `${BASE_URL}/health`, null, { tags: { name: 'spike-health' } }]);
    } else {
      batchRequests.push([
        'GET',
        `${BASE_URL}/api/v1/invoices?take=20`,
        null,
        { headers: authHeaders(), tags: { name: 'spike-invoice-list' } }
      ]);
    }
  }

  const responses = http.batch(batchRequests);
  for (const response of responses) {
    check(response, {
      'spike test status is successful': (r) => r.status < 400,
      'spike test response time < 5000ms': (r) => r.timings.duration < 5000
    }) || errorRate.add(1);
  }
}

export function remitaStressTest() {
  const invoiceId = __ENV.STAMPED_INVOICE_ID;
  if (!invoiceId) {
    console.log('STAMPED_INVOICE_ID not provided; skipping remitaStressTest');
    return;
  }

  for (let i = 0; i < 10; i++) {
    const paymentData = generatePaymentData(invoiceId);
    const response = http.post(`${BASE_URL}/api/v1/payments/generate`, JSON.stringify(paymentData), {
      headers: authHeaders(),
      tags: { name: 'remita-generate' },
    });

    const success = check(response, {
      'remita stress status 200/201': (r) => r.status === 200 || r.status === 201,
      'remita stress has RRR': (r) => r.json()?.rrr !== undefined,
    });

    if (!success) {
      remitaErrorRate.add(1);
      errorRate.add(1);
    }

    sleep(0.5);
  }
}

export function performanceBenchmark() {
  const samples = Number(__ENV.BENCH_SAMPLES || 20);

  const times = {
    health: [],
    invoiceList: [],
  };

  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    http.get(`${BASE_URL}/health`);
    times.health.push(Date.now() - t0);

    const t1 = Date.now();
    http.get(`${BASE_URL}/api/v1/invoices?take=20`, { headers: authHeaders() });
    times.invoiceList.push(Date.now() - t1);

    sleep(0.2);
  }

  const stats = (arr) => {
    const sorted = arr.slice().sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { p50, p95, p99, avg };
  };

  console.log('Performance Benchmark Results:');
  console.log('Health:', stats(times.health));
  console.log('Invoice List:', stats(times.invoiceList));
}
