# TaxBridge Production Load Testing Guide

**Version:** 5.0.2  
**Purpose:** Comprehensive load testing strategy for production readiness

---

## Test Suite Overview

TaxBridge includes **4 specialized load tests** designed to validate different aspects of system performance and resilience:

| Test | Duration | Purpose | Thresholds |
|------|----------|---------|-----------|
| **Smoke** | ~5 min | Quick validation before full tests | P95 < 500ms, Errors < 5% |
| **Load** | ~27 min | Standard production traffic simulation | P95 < 300ms, Errors < 10% |
| **Soak** | ~60 min | Detect memory leaks & degradation | P95 < 400ms, consistent over time |
| **Spike** | ~5 min | Validate circuit breaker & rate limiting | Errors < 20%, Rate limiting < 30% |
| **Offline Sync** | ~8 min | Queue burst handling | P95 < 1000ms, Circuit breaker active |

---

## Running Tests

### Prerequisites

```bash
# Install k6
# Windows (via Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Start backend server
cd backend
npm run dev  # or npm start for production mode
```

### Test Execution

```bash
cd backend/load-test

# 1. Smoke test (run first)
k6 run k6-smoke.js --out json=smoke-results.json

# 2. Load test (standard production simulation)
k6 run k6-script.js --out json=load-results.json

# 3. Soak test (1 hour)
k6 run k6-soak.js --out json=soak-results.json

# 4. Spike test (circuit breaker validation)
k6 run k6-spike.js --out json=spike-results.json

# 5. Offline sync burst
k6 run k6-offline-sync-burst.js --out json=offline-sync-results.json

# Custom base URL
k6 run k6-script.js -e BASE_URL=https://api-staging.taxbridge.ng
```

---

## Test Scenarios

### Smoke Test (`k6-smoke.js`)

**Purpose:** Catch critical failures early before running full test suite

**Stages:**
- Ramp up: 1 minute → 5 VU
- Sustain: 3 minutes at 5 VU
- Ramp down: 1 minute → 0 VU

**Scenarios:**
- Health checks (`/health`)
- Simple invoice creation

**Success Criteria:**
- ✅ Health endpoint responds < 500ms (P95)
- ✅ Error rate < 5%
- ✅ No server crashes

---

### Load Test (`k6-script.js`)

**Purpose:** Validate performance under expected production load

**Stages:**
- Progressive ramp: 10 → 50 → 100 → 150 VU over 18 minutes
- Peak sustain: 150 VU for 3 minutes
- Gradual ramp down: 2 minutes

**Scenarios:**
- Invoice creation with UBL XML
- Invoice listing
- Payment RRR generation (Remita)
- E-invoice submission (DigiTax/Duplo)
- Status checks

**Success Criteria:**
- ✅ P95 latency < 300ms (NRS requirement)
- ✅ Error rate < 10%
- ✅ DigiTax submission P95 < 2000ms
- ✅ Remita RRR P95 < 3000ms

---

### Soak Test (`k6-soak.js`)

**Purpose:** Detect memory leaks and performance degradation over time

**Stages:**
- Ramp up: 5 minutes → 50 VU
- Soak: 50 minutes at 50 VU
- Ramp down: 5 minutes → 0 VU

**Scenarios:**
- Mixed workload (invoice creation, listing, health checks)
- Random scenario selection to simulate real traffic

**Monitoring:**
- Response time stability (should not degrade > 50% over duration)
- Memory usage (via `/metrics` endpoint)
- Connection pool utilization

**Success Criteria:**
- ✅ P95 latency < 400ms (consistent throughout)
- ✅ No memory leaks (check server metrics)
- ✅ Error rate < 8%

---

### Spike Test (`k6-spike.js`)

**Purpose:** Validate circuit breaker and rate limiting under sudden traffic surge

**Stages:**
- Baseline: 30 seconds at 10 VU
- Spike: 1 minute → 200 VU (instant)
- Sustain: 2 minutes at 200 VU
- Recovery: 1 minute → 10 VU
- Cooldown: 30 seconds → 0 VU

**Scenarios:**
- Rapid invoice creation (maximum pressure)

**Expected Behavior:**
- Rate limiting kicks in (429 responses)
- Circuit breaker may trip temporarily
- Server remains responsive (no crashes)

**Success Criteria:**
- ✅ Error rate < 20% (some failures expected)
- ✅ Rate limiting < 30% of requests
- ⚠️ If rate limiting > 30%, consider increasing limits or adding graduated penalties

---

### Offline Sync Burst (`k6-offline-sync-burst.js`)

**Purpose:** Validate queue handling when many users sync offline invoices simultaneously

**Stages:**
- Baseline: 1 minute at 5 VU
- Burst: 30 seconds → 100 VU (users coming online)
- Sustain: 3 minutes at 100 VU
- Recovery: 2 minutes → 20 VU
- Ramp down: 1 minute → 0 VU

**Scenarios:**
- Each VU syncs 3-10 invoices rapidly
- Simulates real offline-first mobile app behavior

**Expected Behavior:**
- BullMQ queues absorb load
- Circuit breaker may trip if DigiTax is overwhelmed
- Jobs queued for eventual processing

**Success Criteria:**
- ✅ P95 latency < 1000ms (queue acceptance)
- ✅ Error rate < 15%
- ✅ Circuit breaker trips appropriately (> 0% but < 10%)
- ⚠️ If circuit breaker never trips, it may not be working

---

## Interpreting Results

### Key Metrics

```bash
# View summary
k6 run k6-script.js | grep -A 20 "checks"

# Check thresholds
k6 run k6-script.js | grep "✓\|✗"
```

**What to look for:**

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| `http_req_duration` P95 | < 300ms | 300-500ms | > 500ms |
| `http_req_failed` | < 5% | 5-10% | > 10% |
| `duplo_errors` | < 2% | 2-5% | > 5% |
| Connection pool utilization | < 70% | 70-85% | > 85% |

### Common Issues

**High latency (> 300ms P95):**
- ✅ Check Postgres connection pool settings
- ✅ Review slow query logs (`PRISMA_SLOW_QUERY_MS`)
- ✅ Verify Redis connection health

**High error rate (> 10%):**
- ✅ Check BullMQ circuit breaker logs
- ✅ Review DigiTax/Remita mock/sandbox status
- ✅ Inspect rate limiting thresholds

**Memory leak (response time degrades in soak test):**
- ✅ Check Prisma client instantiation (should use singleton)
- ✅ Review Redis connection pooling
- ✅ Inspect for event listener leaks

---

## Production Checklist

Before go-live, ensure:

- [ ] All 5 load tests pass with green thresholds
- [ ] Soak test shows no degradation after 1 hour
- [ ] Circuit breaker trips appropriately in spike test
- [ ] Offline sync burst handled without queue exhaustion
- [ ] `/metrics` endpoint shows:
  - Connection pool utilization < 80%
  - DLQ counts within thresholds
  - Error rate < 5%

---

## CI/CD Integration

Add to GitHub Actions:

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday 2am
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Start server
        run: |
          cd backend
          npm start &
          sleep 10
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run smoke test
        run: |
          cd backend/load-test
          k6 run k6-smoke.js
      
      - name: Run load test
        run: |
          cd backend/load-test
          k6 run k6-script.js
```

---

**TaxBridge Team** | Production Performance Validation 🚀
