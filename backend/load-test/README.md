# Load Testing with k6

This directory contains load testing scripts for TaxBridge API endpoints using k6.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo apt-get install k6
```

## Usage

### Basic Load Test
```bash
# Run against local development server
k6 run load-test/k6-script.js

# Run against staging server
BASE_URL=https://staging.taxbridge.com k6 run load-test/k6-script.js

# Run with custom options
k6 run --vus 50 --duration 10m load-test/k6-script.js
```

### Specialized Tests

#### Duplo Stress Test
```bash
k6 run -e SCENARIO=duploStressTest load-test/k6-script.js
```

#### Remita Stress Test
```bash
k6 run -e SCENARIO=remitaStressTest load-test/k6-script.js
```

#### API Spike Test
```bash
k6 run -e SCENARIO=apiSpikeTest load-test/k6-script.js
```

## Test Scenarios

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Expected**: 200 OK, <100ms response time
- **Purpose**: Verify API availability

### 2. Duplo E-Invoice Submission
- **Endpoint**: `POST /api/einvoice/submit`
- **Expected**: 200/202, <2000ms response time
- **Data**: Valid UBL 3.0 XML with 55 mandatory fields
- **Purpose**: Test NRS e-invoicing integration

### 3. E-Invoice Status Check
- **Endpoint**: `GET /api/einvoice/status/{irn}`
- **Expected**: 200, <1000ms response time
- **Purpose**: Monitor invoice processing status

### 4. Remita RRR Generation
- **Endpoint**: `POST /api/payments/rrr`
- **Expected**: 200/201, <3000ms response time
- **Data**: Payment request with SHA512 hash
- **Purpose**: Test payment gateway integration

### 5. Payment Status Check
- **Endpoint**: `GET /api/payments/status/{rrr}`
- **Expected**: 200, <1000ms response time
- **Purpose**: Monitor payment status

### 6. Invoice List API
- **Endpoint**: `GET /api/invoices`
- **Expected**: 200, <500ms response time
- **Purpose**: Test data retrieval performance

### 7. OCR Processing
- **Endpoint**: `POST /api/ocr/process`
- **Expected**: 200/400, <5000ms response time
- **Purpose**: Test receipt processing capabilities

## Performance Thresholds

- **p95 Response Time**: <300ms for all endpoints
- **Error Rate**: <10% across all tests
- **Duplo Submission**: <2000ms (95th percentile)
- **Remita RRR**: <3000ms (95th percentile)
- **Health Check**: <100ms (95th percentile)

## Load Test Stages

1. **Warm-up**: 2 minutes, 10 users
2. **Baseline**: 5 minutes, 10 users
3. **Moderate Load**: 2 minutes ramp to 50 users
4. **Sustained Load**: 5 minutes, 50 users
5. **High Load**: 2 minutes ramp to 100 users
6. **Peak Load**: 5 minutes, 100 users
7. **Cool-down**: 2 minutes ramp to 0 users

## Metrics Collected

- Response times (avg, min, max, p95, p99)
- Request counts and rates
- Error rates by endpoint
- Custom error tracking
- Connection metrics

## Environment Variables

- `BASE_URL`: Target API URL (default: http://localhost:3000)
- `SCENARIO`: Specific test scenario to run

## Output Analysis

k6 provides real-time metrics:
```
running (15m0s), 000/100 VUs, 123456 complete and 0 interrupted iterations
default ✓ [======================================] 100 VUs  15m0s

     ✓ health check status is 200
     ✓ duplo submit status is 200 or 202
     ✓ remita RRR status is 200 or 201
     ✓ invoice list status is 200

     checks.........................: 99.98% ✓ 123456 ✗ 23
     data_received..................: 2.3 MB 153 kB/s
     data_sent......................: 5.6 MB 374 kB/s
     http_req_blocked...............: avg=1.2ms  min=0s    med=1ms   max=45ms  p(90)=2ms   p(95)=3ms
     http_req_connecting..........: avg=5.4ms  min=0s    med=3ms   max=120ms p(90)=8ms   p(95)=12ms
     http_req_duration.............: avg=145ms  min=2ms   med=89ms  max=2.1s  p(90)=234ms p(95)=289ms
     http_req_receiving.............: avg=12ms   min=1ms   med=8ms   max=234ms p(90)=18ms  p(95)=28ms
     http_req_sending...............: avg=3ms    min=0s    med=2ms   max=45ms  p(90)=4ms   p(95)=6ms
     http_req_tls_handshaking.......: avg=8ms    min=0s    med=5ms   max=89ms  p(90)=12ms  p(95)=18ms
     http_req_waiting...............: avg=130ms  min=1ms   med=78ms  max=1.9s  p(90)=198ms p(95)=245ms
     http_reqs......................: 123456  823.04/s
     iteration_duration.............: avg=1.8s   min=1.2s  med=1.7s  max=3.4s  p(90)=2.3s  p(95)=2.7s
     iterations.....................: 123456  823.04/s
     vus............................: 100    min=100 max=100
     vus_max........................: 100    min=100 max=100
```

## CI/CD Integration

Add to GitHub Actions:
```yaml
- name: Load Test
  run: |
    k6 run --out json=results.json load-test/k6-script.js
    k6 run --out json=load-test-results.json load-test/k6-script.js
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure API server is running
2. **High Error Rates**: Check server logs and resource utilization
3. **Slow Response Times**: Monitor database queries and external API calls

### Debug Mode
```bash
k6 run --http-debug load-test/k6-script.js
```

### Custom Reports
```bash
k6 run --out json=results.json load-test/k6-script.js
```

## Production Considerations

- Use staging environment for load testing
- Monitor real-time metrics during tests
- Have rollback plan ready
- Test during off-peak hours
- Coordinate with infrastructure team

## Target Metrics for TaxBridge

Based on NRS 2026 requirements and user expectations:

- **Concurrent Users**: Support 100+ simultaneous users
- **Invoice Processing**: <2 seconds for Duplo submission
- **Payment Generation**: <3 seconds for RRR creation
- **API Availability**: 99.9% uptime
- **Response Times**: p95 <300ms for all endpoints

These tests ensure TaxBridge meets the performance requirements for Nigerian SME tax compliance under the 2026 NRS mandate.
