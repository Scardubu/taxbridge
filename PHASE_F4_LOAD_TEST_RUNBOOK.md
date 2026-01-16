# Phase F4: Load Test Runbook

**Created:** January 16, 2026  
**Status:** 🟢 READY TO EXECUTE (after F3 staging deployment)  
**Prerequisite:** F3 staging deployment complete and health checks passing

---

## Executive Summary

Phase F4 validates TaxBridge's performance under load using k6 against the staging environment. Tests cover:

- Health endpoint responsiveness
- Invoice CRUD operations (queue-driven stamping)
- Payment (Remita RRR) generation
- System behavior under spike conditions

---

## Prerequisites Checklist

Before running load tests, confirm:

- [ ] F3 staging deployment is live (`/health` returns 200)
- [ ] Staging URL is available: `https://taxbridge-api-staging-XXXXX.onrender.com`
- [ ] Redis connection healthy (`/health/queues` returns 200)
- [ ] Database migrations applied (`/health/db` returns 200)
- [ ] Auth token generated for authenticated endpoints

### Generate Auth Token

```bash
# Local backend (dev mode)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+2348012345678", "password": "testPassword123!"}' \
| jq -r '.accessToken'
```

Or for staging, use an existing test user credential.

---

## Test Environments

| Variable | Local | Staging |
|----------|-------|---------|
| `BASE_URL` | `http://localhost:3000` | `https://taxbridge-api-staging-XXXXX.onrender.com` |
| `AUTH_TOKEN` | (optional for dev) | (required) |
| `INVOICE_STAMP_WAIT_SECONDS` | `10` | `30` (queue may be slower) |
| `EXPECT_STAMPED` | `false` | `false` (mock mode) |

---

## Test Execution Commands

### Install k6 (if not installed)

```powershell
# Windows (Chocolatey)
choco install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

### 1. Smoke Test (Baseline Validation)

Quick 1-minute test to confirm endpoints work:

```powershell
cd c:\Users\USR\Documents\taxbridge\backend\load-test

# Local
$env:BASE_URL = "http://localhost:3000"
k6 run --vus 1 --duration 1m k6-script.js

# Staging
$env:BASE_URL = "https://taxbridge-api-staging-XXXXX.onrender.com"
$env:AUTH_TOKEN = "<your-staging-jwt>"
$env:INVOICE_STAMP_WAIT_SECONDS = 30
k6 run --vus 1 --duration 1m k6-script.js
```

**Pass criteria:**
- Error rate: 0%
- All health checks return 200
- Invoice create returns 201

---

### 2. Default Load Test (Full 28-minute Ramp)

Exercises the full load profile from 10 → 150 VUs:

```powershell
$env:BASE_URL = "https://taxbridge-api-staging-XXXXX.onrender.com"
$env:AUTH_TOKEN = "<your-staging-jwt>"
$env:INVOICE_STAMP_WAIT_SECONDS = 30

k6 run k6-script.js
```

**Pass criteria (NRS 2026):**
- `http_req_duration{p(95)}` < 300ms
- `http_req_failed{rate}` < 10%
- `errors{rate}` < 10%
- `http_req_duration{name:invoice-create,p(95)}` < 800ms
- `http_req_duration{name:remita-generate,p(95)}` < 3000ms

---

### 3. Spike Test (Burst Traffic)

Tests system resilience to sudden traffic bursts:

```powershell
k6 run --exec apiSpikeTest k6-script.js
```

**Pass criteria:**
- Success rate > 90%
- P95 latency < 5000ms
- No 503 errors on health endpoints

---

### 4. Remita Stress Test (Payment Generation)

Requires a pre-stamped invoice ID:

```powershell
$env:STAMPED_INVOICE_ID = "<uuid-of-stamped-invoice>"
k6 run --exec remitaStressTest k6-script.js
```

**Pass criteria:**
- Remita generate returns 200/201
- RRR field present in response
- P95 latency < 3000ms

---

### 5. Performance Benchmark

Quick statistical analysis of endpoint latencies:

```powershell
$env:BENCH_SAMPLES = 50
k6 run --exec performanceBenchmark k6-script.js
```

Outputs P50, P95, P99 for health and invoice list endpoints.

---

## Export Results

### JSON Output

```powershell
k6 run --out json=results.json k6-script.js
```

### Summary to File

```powershell
k6 run k6-script.js 2>&1 | Tee-Object -FilePath load-test-results.txt
```

---

## Interpreting Results

### Green (Pass)

```
✓ http_req_duration..............: avg=45.12ms  p(95)=123.45ms
✓ http_req_failed................: 0.00%
✓ errors.........................: 0.00%
```

### Yellow (Warning - Review)

```
✓ http_req_duration..............: avg=180.50ms p(95)=450.00ms
✓ http_req_failed................: 5.20%
```

- P95 elevated but under threshold
- Some errors but under 10%

### Red (Fail - Investigate)

```
✗ http_req_duration..............: avg=520.00ms p(95)=1200.00ms
✗ http_req_failed................: 15.30%
```

Common causes:
- Database connection pool exhausted
- Redis connection timeout
- Render service under-provisioned

---

## Troubleshooting

### High Latency

1. Check `/health/db` - database pool may be saturated
2. Check `/health/queues` - job backlog may be growing
3. Review Render metrics for CPU/memory limits

### Auth Errors (401/403)

1. Verify `AUTH_TOKEN` is valid and not expired
2. Check `ALLOWED_ORIGINS` includes test origin
3. For local dev, enable `ALLOW_DEBUG_USER_ID_HEADER=true`

### Queue Failures

1. Check `/health/queues` for failed job counts
2. Review worker logs in Render dashboard
3. Ensure Redis is connected (`/health` should show redis: healthy)

---

## Go/No-Go Criteria for F5

| Metric | Target | Must Pass |
|--------|--------|-----------|
| P95 Latency (all requests) | < 300ms | ✅ |
| Error Rate | < 10% | ✅ |
| Invoice Create P95 | < 800ms | ✅ |
| Remita Generate P95 | < 3000ms | ✅ |
| Health Endpoints | All return 200 | ✅ |
| No Memory Leaks | Heap stable | ✅ |

If all criteria pass, proceed to **Phase F5: DigiTax Certification**.

---

## Post-Test Actions

1. **Archive results:** Save `results.json` to `docs/load-test-results/`
2. **Update status:** Mark F4 complete in Phase F documentation
3. **Review metrics:** Check Render dashboard for resource utilization
4. **Clean test data:** Optionally purge test invoices from staging DB

---

## Quick Reference Commands

```powershell
# Navigate to load test directory
cd c:\Users\USR\Documents\taxbridge\backend\load-test

# Set staging environment
$env:BASE_URL = "https://taxbridge-api-staging-XXXXX.onrender.com"
$env:AUTH_TOKEN = "eyJhbGciOiJIUzI1..."

# Run smoke test
k6 run --vus 1 --duration 1m k6-script.js

# Run full load test
k6 run k6-script.js

# Run with JSON output
k6 run --out json=results.json k6-script.js
```

---

**Next Phase:** F5 - DigiTax Certification (requires F4 pass)
