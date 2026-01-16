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

#+#+#+#+--------------------------------------------------------------------------
# TaxBridge Load Testing (Phase F4)

This folder contains k6 load tests aligned to the **canonical TaxBridge backend API**.

## Quick Start

### Install k6

```bash
# Windows (Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo apt install k6
```

### Run locally

```bash
k6 run k6-script.js
```

### Run against staging

```bash
BASE_URL=https://taxbridge-staging.onrender.com \
AUTH_TOKEN=... \
k6 run k6-script.js
```

## Auth

Invoice and payment endpoints are authenticated.

Preferred (staging/prod):
- `AUTH_TOKEN` (JWT) is required.

Local/dev convenience (do not use in production):
- `ALLOW_DEV_USER_HEADER=true` and `USER_ID=<uuid>`
  - Backend must be started with `ALLOW_DEBUG_USER_ID_HEADER=true` (and non-production `NODE_ENV`).

## Endpoints Exercised

- `GET /health`
- `GET /health/digitax`
- `GET /health/remita`
- `POST /api/v1/invoices`
- `GET /api/v1/invoices`
- `GET /api/v1/invoices/:id` (polling for queue-driven stamping)
- `POST /api/v1/payments/generate` (only when invoice is `stamped`)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Backend base URL | `http://localhost:3000` |
| `AUTH_TOKEN` | Bearer token for authenticated routes | (none) |
| `INVOICE_STAMP_WAIT_SECONDS` | Max seconds to poll invoice status | `10` |
| `EXPECT_STAMPED` | If `true`, fail iteration when invoice isn't stamped in time | `false` |
| `ALLOW_DEV_USER_HEADER` | Enable `X-TaxBridge-User-Id` header mode (local/dev only) | `false` |
| `USER_ID` | User id for `ALLOW_DEV_USER_HEADER` | (none) |
| `STAMPED_INVOICE_ID` | Pre-stamped invoice id for `remitaStressTest` | (none) |
| `BENCH_SAMPLES` | Iterations for `performanceBenchmark` | `20` |

## Running Specific Scenarios

k6 runs `default` unless you specify `--exec`.

```bash
# Spike a mix of health + invoice list
k6 run --exec apiSpikeTest k6-script.js

# Stress Remita generation against a known stamped invoice
STAMPED_INVOICE_ID=... AUTH_TOKEN=... k6 run --exec remitaStressTest k6-script.js

# Basic benchmark output
AUTH_TOKEN=... k6 run --exec performanceBenchmark k6-script.js
```

## Notes for Staging (Phase F3/F4)

- Stamping is queue-driven; ensure the worker/queue is running in staging.
- If DigiTax is disabled or mocked in staging, invoices may remain `pending` — set `EXPECT_STAMPED=false` for baseline throughput testing.
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
