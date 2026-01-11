import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics for enhanced monitoring
export let errorRate = new Rate('errors');
export let duploErrorRate = new Rate('duplo_errors');
export let remitaErrorRate = new Rate('remita_errors');
export let apiLatency = new Rate('api_latency');

// Enhanced test configuration for NRS 2026 compliance
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 150 }, // Peak load for NRS compliance
    { duration: '3m', target: 150 }, // Sustain peak load
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests under 300ms (NRS requirement)
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    errors: ['rate<0.1'],
    duplo_errors: ['rate<0.05'], // Duplo error rate under 5%
    remita_errors: ['rate<0.05'], // Remita error rate under 5%
    'http_req_duration{name:duplo-submit}': ['p(95)<2000'], // Duplo submission under 2s
    'http_req_duration{name:remita-rrr}': ['p(95)<3000'], // Remita RRR under 3s
    'http_req_duration{name:duplo-status}': ['p(95)<1000'], // Status checks under 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data generators
function generateInvoiceData() {
  return {
    id: `INV-${Math.random().toString(36).substr(2, 9)}`,
    issueDate: new Date().toISOString().split('T')[0],
    supplierTIN: `${Math.random().toString(36).substr(2, 8)}-${Math.random().toString(36).substr(2, 4)}`,
    supplierName: `Test Supplier ${Math.random().toString(36).substr(2, 5)}`,
    customerName: `Test Customer ${Math.random().toString(36).substr(2, 5)}`,
    items: [
      {
        description: `Service ${Math.random().toString(36).substr(2, 7)}`,
        quantity: Math.floor(Math.random() * 10) + 1,
        unitPrice: Math.floor(Math.random() * 1000) + 100,
      }
    ],
    subtotal: 0,
    vat: 0,
    total: 0,
  };
}

function generateUBLXML(invoiceData) {
  const subtotal = invoiceData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const vat = subtotal * 0.075;
  const total = subtotal + vat;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${invoiceData.id}</cbc:ID>
  <cbc:IssueDate>${invoiceData.issueDate}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>NGN</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${invoiceData.supplierTIN}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${invoiceData.supplierName}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${invoiceData.customerName}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  ${invoiceData.items.map((item, index) => `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="NGN">${(item.quantity * item.unitPrice).toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${item.description}</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="NGN">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`).join('')}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="NGN">${vat.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="NGN">${subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="NGN">${vat.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>7.5</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="NGN">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="NGN">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="NGN">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="NGN">${total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
}

function generatePaymentData() {
  return {
    merchantId: 'test-merchant-id',
    serviceTypeId: 'test-service-type',
    orderId: `ORDER-${Math.random().toString(36).substr(2, 9)}`,
    amount: Math.floor(Math.random() * 5000) + 500,
    payerName: `Test User ${Math.random().toString(36).substr(2, 5)}`,
    payerEmail: `test${Math.random().toString(36).substr(2, 7)}@example.com`,
    payerPhone: `+234${Math.random().toString().substr(2, 10)}`,
    description: 'TaxBridge Invoice Payment',
  };
}

// Test scenarios
export function setup() {
  // Setup data if needed
  console.log('Load test setup complete');
}

export default function () {
  // Scenario 1: Health Check
  const healthResponse = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health-check' },
  });
  
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  // Scenario 2: Duplo E-Invoice Submission (Enhanced)
  const invoiceData = generateInvoiceData();
  const ublXML = generateUBLXML(invoiceData);
  
  const duploResponse = http.post(`${BASE_URL}/api/einvoice/submit`, ublXML, {
    headers: {
      'Content-Type': 'application/xml',
      'Authorization': `Bearer ${__ENV.DUPLO_TOKEN || 'test-token'}`,
    },
    tags: { name: 'duplo-submit' },
  });
  
  const duploSuccess = check(duploResponse, {
    'duplo submit status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'duplo submit response time < 2000ms': (r) => r.timings.duration < 2000,
    'duplo submit has IRN': (r) => r.json().irn !== undefined,
    'duplo submit has QR code': (r) => r.json().qr_code !== undefined,
    'duplo submit timestamp present': (r) => r.json().timestamp !== undefined,
  });
  
  if (!duploSuccess) {
    duploErrorRate.add(1);
  }
  errorRate.add(!duploSuccess);

  // Scenario 3: E-Invoice Status Check
  if (duploResponse.status === 200 && duploResponse.json().irn) {
    const irn = duploResponse.json().irn;
    const statusResponse = http.get(`${BASE_URL}/api/einvoice/status/${irn}`, {
      tags: { name: 'duplo-status' },
    });
    
    check(statusResponse, {
      'status check status is 200': (r) => r.status === 200,
      'status check response time < 1000ms': (r) => r.timings.duration < 1000,
      'status check returns valid status': (r) => ['pending', 'stamped', 'rejected'].includes(r.json().status),
    }) || errorRate.add(1);
  }

  // Scenario 4: Remita RRR Generation (Enhanced)
  const paymentData = generatePaymentData();
  
  const remitaResponse = http.post(`${BASE_URL}/api/payments/rrr`, JSON.stringify(paymentData), {
    headers: {
      'Content-Type': 'application/json',
      'X-Merchant-ID': __ENV.REMITA_MERCHANT_ID || 'test-merchant',
    },
    tags: { name: 'remita-rrr' },
  });
  
  const remitaSuccess = check(remitaResponse, {
    'remita RRR status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'remita RRR response time < 3000ms': (r) => r.timings.duration < 3000,
    'remita RRR has RRR number': (r) => r.json().rrr !== undefined,
    'remita RRR has payment URL': (r) => r.json().paymentUrl !== undefined,
    'remita RRR has transaction date': (r) => r.json().transactionDate !== undefined,
  });
  
  if (!remitaSuccess) {
    remitaErrorRate.add(1);
  }
  errorRate.add(!remitaSuccess);

  // Scenario 5: Payment Status Check
  if (remitaResponse.status === 200 && remitaResponse.json().rrr) {
    const rrr = remitaResponse.json().rrr;
    const paymentStatusResponse = http.get(`${BASE_URL}/api/payments/status/${rrr}`, {
      tags: { name: 'remita-status' },
    });
    
    check(paymentStatusResponse, {
      'payment status check status is 200': (r) => r.status === 200,
      'payment status check response time < 1000ms': (r) => r.timings.duration < 1000,
      'payment status returns valid status': (r) => ['pending', 'successful', 'failed'].includes(r.json().status),
    }) || errorRate.add(1);
  }

  // Scenario 6: Invoice List API
  const listResponse = http.get(`${BASE_URL}/api/invoices`, {
    tags: { name: 'invoice-list' },
  });
  
  check(listResponse, {
    'invoice list status is 200': (r) => r.status === 200,
    'invoice list response time < 500ms': (r) => r.timings.duration < 500,
    'invoice list returns array': (r) => Array.isArray(r.json()),
  }) || errorRate.add(1);

  // Scenario 7: OCR Processing (if endpoint exists)
  const mockImageData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  
  const ocrResponse = http.post(`${BASE_URL}/api/ocr/process`, JSON.stringify({ image: mockImageData }), {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'ocr-process' },
  });
  
  check(ocrResponse, {
    'OCR process status is 200 or 400': (r) => r.status === 200 || r.status === 400, // 400 if OCR service unavailable
    'OCR process response time < 5000ms': (r) => r.timings.duration < 5000,
  }) || errorRate.add(1);

  sleep(1); // Wait 1 second between iterations
}

export function teardown() {
  console.log('Load test teardown complete');
}

// Additional specialized test scenarios
export function duploStressTest() {
  // Focus specifically on Duplo API performance
  console.log('Running Duplo Stress Test...');
  
  for (let i = 0; i < 10; i++) {
    const invoiceData = generateInvoiceData();
    const ublXML = generateUBLXML(invoiceData);
    
    const response = http.post(`${BASE_URL}/api/einvoice/submit`, ublXML, {
      headers: { 
        'Content-Type': 'application/xml',
        'Authorization': `Bearer ${__ENV.DUPLO_TOKEN || 'test-token'}`,
      },
      tags: { name: 'duplo-stress' },
    });
    
    const success = check(response, {
      'duplo stress test status is 200 or 202': (r) => r.status === 200 || r.status === 202,
      'duplo stress test response time < 3000ms': (r) => r.timings.duration < 3000,
      'duplo stress has IRN': (r) => r.json().irn !== undefined,
    });
    
    if (!success) {
      duploErrorRate.add(1);
    }
    errorRate.add(!success);
    
    sleep(0.5); // Short pause between submissions
  }
}

export function remitaStressTest() {
  // Focus specifically on Remita API performance
  console.log('Running Remita Stress Test...');
  
  for (let i = 0; i < 10; i++) {
    const paymentData = generatePaymentData();
    
    const response = http.post(`${BASE_URL}/api/payments/rrr`, JSON.stringify(paymentData), {
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-ID': __ENV.REMITA_MERCHANT_ID || 'test-merchant',
      },
      tags: { name: 'remita-stress' },
    });
    
    const success = check(response, {
      'remita stress test status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'remita stress test response time < 4000ms': (r) => r.timings.duration < 4000,
      'remita stress has RRR': (r) => r.json().rrr !== undefined,
    });
    
    if (!success) {
      remitaErrorRate.add(1);
    }
    errorRate.add(!success);
    
    sleep(0.5); // Short pause between generations
  }
}

export function apiSpikeTest() {
  // Simulate sudden spike in API traffic
  console.log('Running API Spike Test...');
  
  const requests = [];
  const startTime = Date.now();
  
  // Generate 50 requests in rapid succession
  for (let i = 0; i < 50; i++) {
    const invoiceData = generateInvoiceData();
    const ublXML = generateUBLXML(invoiceData);
    
    const response = http.post(`${BASE_URL}/api/einvoice/submit`, ublXML, {
      headers: { 
        'Content-Type': 'application/xml',
        'Authorization': `Bearer ${__ENV.DUPLO_TOKEN || 'test-token'}`,
      },
      tags: { name: 'spike-test' },
    });
    
    requests.push(response);
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`Spike test completed: 50 requests in ${duration}ms`);
  
  // Check response times
  let successCount = 0;
  requests.forEach((response) => {
    if (response.status === 200 || response.status === 202) {
      successCount++;
    }
  });
  
  const successRate = (successCount / requests.length) * 100;
  console.log(`Success rate: ${successRate.toFixed(2)}%`);
  
  check(successRate, {
    'spike test success rate > 90%': (rate) => rate > 90,
  }) || errorRate.add(1);
}

export function endToEndInvoicePaymentFlow() {
  // Complete flow: invoice creation → Duplo submission → RRR generation → status check
  console.log('Running End-to-End Invoice Payment Flow...');
  
  // Step 1: Create invoice (simulated - would normally be POST /api/invoices)
  const invoiceData = generateInvoiceData();
  console.log(`Step 1: Invoice created - ${invoiceData.id}`);
  
  // Step 2: Generate UBL and submit to Duplo
  const ublXML = generateUBLXML(invoiceData);
  const duploResponse = http.post(`${BASE_URL}/api/einvoice/submit`, ublXML, {
    headers: { 
      'Content-Type': 'application/xml',
      'Authorization': `Bearer ${__ENV.DUPLO_TOKEN || 'test-token'}`,
    },
    tags: { name: 'e2e-duplo-submit' },
  });
  
  const duploSuccess = check(duploResponse, {
    'e2e: Duplo submission successful': (r) => r.status === 200 || r.status === 202,
    'e2e: IRN received': (r) => r.json().irn !== undefined,
  });
  
  if (!duploSuccess) {
    console.error('E2E test failed at Duplo submission');
    errorRate.add(1);
    return;
  }
  
  const irn = duploResponse.json().irn;
  console.log(`Step 2: Duplo submission successful - IRN: ${irn}`);
  
  sleep(1); // Wait for stamping
  
  // Step 3: Check e-invoice status
  const statusResponse = http.get(`${BASE_URL}/api/einvoice/status/${irn}`, {
    tags: { name: 'e2e-duplo-status' },
  });
  
  check(statusResponse, {
    'e2e: Status check successful': (r) => r.status === 200,
    'e2e: Status is stamped or pending': (r) => ['stamped', 'pending'].includes(r.json().status),
  }) || errorRate.add(1);
  
  console.log(`Step 3: Invoice status checked - ${statusResponse.json().status}`);
  
  // Step 4: Generate RRR for payment
  const paymentData = {
    invoiceId: invoiceData.id,
    payerName: invoiceData.customerName,
    payerEmail: `${Math.random().toString(36).substr(2, 7)}@example.com`,
    payerPhone: `+234${Math.random().toString().substr(2, 10)}`,
  };
  
  const rrrResponse = http.post(`${BASE_URL}/api/payments/generate`, JSON.stringify(paymentData), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'e2e-remita-rrr' },
  });
  
  const rrrSuccess = check(rrrResponse, {
    'e2e: RRR generation successful': (r) => r.status === 200 || r.status === 201,
    'e2e: RRR received': (r) => r.json().rrr !== undefined,
  });
  
  if (!rrrSuccess) {
    console.error('E2E test failed at RRR generation');
    errorRate.add(1);
    return;
  }
  
  const rrr = rrrResponse.json().rrr;
  console.log(`Step 4: RRR generated - ${rrr}`);
  
  // Step 5: Check payment status
  const paymentStatusResponse = http.get(`${BASE_URL}/api/payments/${invoiceData.id}/status`, {
    tags: { name: 'e2e-payment-status' },
  });
  
  check(paymentStatusResponse, {
    'e2e: Payment status check successful': (r) => r.status === 200,
    'e2e: Payment status is pending': (r) => r.json().status === 'pending',
  }) || errorRate.add(1);
  
  console.log(`Step 5: Payment status checked - ${paymentStatusResponse.json().status}`);
  console.log('End-to-End flow completed successfully');
}

// Performance benchmark tests
export function performanceBenchmark() {
  console.log('Running Performance Benchmark...');
  
  const benchmarks = {
    health: [],
    duploSubmit: [],
    remitaRRR: [],
    invoiceList: [],
  };
  
  // Run 20 iterations of each endpoint
  for (let i = 0; i < 20; i++) {
    // Health check
    const healthStart = Date.now();
    http.get(`${BASE_URL}/api/health`);
    benchmarks.health.push(Date.now() - healthStart);
    
    // Duplo submit
    const duploStart = Date.now();
    const invoiceData = generateInvoiceData();
    const ublXML = generateUBLXML(invoiceData);
    http.post(`${BASE_URL}/api/einvoice/submit`, ublXML, {
      headers: { 
        'Content-Type': 'application/xml',
        'Authorization': `Bearer ${__ENV.DUPLO_TOKEN || 'test-token'}`,
      },
    });
    benchmarks.duploSubmit.push(Date.now() - duploStart);
    
    // Remita RRR
    const remitaStart = Date.now();
    const paymentData = generatePaymentData();
    http.post(`${BASE_URL}/api/payments/rrr`, JSON.stringify(paymentData), {
      headers: { 'Content-Type': 'application/json' },
    });
    benchmarks.remitaRRR.push(Date.now() - remitaStart);
    
    // Invoice list
    const listStart = Date.now();
    http.get(`${BASE_URL}/api/invoices`);
    benchmarks.invoiceList.push(Date.now() - listStart);
    
    sleep(0.2);
  }
  
  // Calculate statistics
  const calculateStats = (times) => {
    const sorted = times.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(times.length * 0.5)];
    const p95 = sorted[Math.floor(times.length * 0.95)];
    const p99 = sorted[Math.floor(times.length * 0.99)];
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return { p50, p95, p99, avg };
  };
  
  console.log('Performance Benchmark Results:');
  console.log('Health Check:', calculateStats(benchmarks.health));
  console.log('Duplo Submit:', calculateStats(benchmarks.duploSubmit));
  console.log('Remita RRR:', calculateStats(benchmarks.remitaRRR));
  console.log('Invoice List:', calculateStats(benchmarks.invoiceList));
  
  // Validate against NRS 2026 requirements
  const duploStats = calculateStats(benchmarks.duploSubmit);
  const remitaStats = calculateStats(benchmarks.remitaRRR);
  
  check(duploStats, {
    'benchmark: Duplo p95 < 2000ms': (stats) => stats.p95 < 2000,
  }) || errorRate.add(1);
  
  check(remitaStats, {
    'benchmark: Remita p95 < 3000ms': (stats) => stats.p95 < 3000,
  }) || errorRate.add(1);
}
    const ublXML = generateUBLXML(invoiceData);
    
    requests.push(http.asyncRequest('POST', `${BASE_URL}/api/einvoice/submit`, ublXML, {
      headers: { 'Content-Type': 'application/xml' },
      tags: { name: 'duplo-stress' },
    }));
  }
  
  const responses = Promise.all(requests);
  
  responses.forEach(response => {
    check(response, {
      'duplo stress test status is 200 or 202': (r) => r.status === 200 || r.status === 202,
      'duplo stress test response time < 3000ms': (r) => r.timings.duration < 3000,
    }) || errorRate.add(1);
  });
}

export function remitaStressTest() {
  // Focus specifically on Remita API performance
  const requests = [];
  
  for (let i = 0; i < 10; i++) {
    const paymentData = generatePaymentData();
    
    requests.push(http.asyncRequest('POST', `${BASE_URL}/api/payments/rrr`, JSON.stringify(paymentData), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'remita-stress' },
    }));
  }
  
  const responses = Promise.all(requests);
  
  responses.forEach(response => {
    check(response, {
      'remita stress test status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'remita stress test response time < 4000ms': (r) => r.timings.duration < 4000,
    }) || errorRate.add(1);
  });
}

export function apiSpikeTest() {
  // Simulate sudden traffic spike
  const spikeUsers = 50;
  const requests = [];
  
  for (let i = 0; i < spikeUsers; i++) {
    // Mix of different API calls
    if (i % 3 === 0) {
      const invoiceData = generateInvoiceData();
      const ublXML = generateUBLXML(invoiceData);
      requests.push(http.asyncRequest('POST', `${BASE_URL}/api/einvoice/submit`, ublXML, {
        headers: { 'Content-Type': 'application/xml' },
        tags: { name: 'spike-duplo' },
      }));
    } else if (i % 3 === 1) {
      const paymentData = generatePaymentData();
      requests.push(http.asyncRequest('POST', `${BASE_URL}/api/payments/rrr`, JSON.stringify(paymentData), {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'spike-remita' },
      }));
    } else {
      requests.push(http.asyncRequest('GET', `${BASE_URL}/api/invoices`, {
        tags: { name: 'spike-list' },
      }));
    }
  }
  
  const responses = Promise.all(requests);
  
  responses.forEach(response => {
    check(response, {
      'spike test status is successful': (r) => r.status < 400,
      'spike test response time < 5000ms': (r) => r.timings.duration < 5000,
    }) || errorRate.add(1);
  });
}
