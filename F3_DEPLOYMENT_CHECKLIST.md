# F3 Staging Deployment — Execution Checklist

**Date:** January 20, 2026  
**Status:** ✅ **COMPLETE — ALL HEALTH CHECKS PASSING**  
**Staging URL:** https://taxbridge-api-35w0.onrender.com  
**Service ID:** srv-d5nbui6r433s739ltga0  
**Operator:** DevOps / Technical Lead

---

## Pre-Flight Verification ✅ (All Complete)

- [x] Pre-production check: 37/37 passed
- [x] Backend build validated: `yarn workspace @taxbridge/backend build`
- [x] All tests passing: 215/215 (100%)
- [x] Security hardening: All secrets removed from repository
- [x] Performance optimization: Pool metrics + health monitoring ready
- [x] Documentation: F3_STAGING_DEPLOYMENT.md reviewed
- [x] Render blueprints validated: render.staging.yaml

---

## F3 Validation Results (January 20, 2026)

### Health Endpoint Status (Final Validation - January 20, 2026 01:23 UTC)
| Endpoint | Status | Response Time | Notes |
|----------|--------|---------------|-------|
| `/health/live` | ✅ 200 | ~1ms | Liveness OK, env=staging |
| `/health/ready` | ✅ 200 | ~3ms | DB + Redis healthy |
| `/health/db` | ✅ 200 | 4ms | Pool: 10 connections |
| `/health/queues` | ✅ 200 | ~1ms | BullMQ operational |
| `/health/digitax` | ✅ 200 | 2ms | **Mock mode enabled** |
| `/health/remita` | ✅ 200 | 2ms | **Mock mode enabled** |

### ✅ Mock Mode Applied Successfully

Environment variables confirmed in Render Dashboard:
- `DIGITAX_MOCK_MODE=true`
- `REMITA_MOCK_MODE=true`
- `NODE_ENV=staging`

---

## Required Prerequisites (Operator Must Have)

### 1. Access & Credentials
- [ ] Render account with deployment permissions
- [ ] Supabase account with project creation access
- [ ] GitHub repository access (for blueprint deployment)
- [ ] PowerShell or terminal access

### 2. Local Tools
- [ ] Node.js 20.x installed
- [ ] Yarn Classic 1.22.x installed
- [ ] Git CLI installed
- [ ] PowerShell 5.1+ or 7+

### 3. Documentation Ready
- [ ] Open [F3_STAGING_DEPLOYMENT.md](F3_STAGING_DEPLOYMENT.md) in browser
- [ ] Open [INTEGRATION_CHECKLIST.md](docs/INTEGRATION_CHECKLIST.md) for reference
- [ ] Have [PRODUCTION_READINESS_FINAL_2026_01_19.md](PRODUCTION_READINESS_FINAL_2026_01_19.md) available

---

## Step 1: Create Staging Database (Supabase)

**Estimated Time:** 5 minutes

- [ ] Go to https://supabase.com/dashboard
- [ ] Click "New project"
- [ ] **Name:** `taxbridge-staging`
- [ ] **Region:** US West (Oregon) — matches Render region
- [ ] **Database password:** Generate strong password (save securely)
- [ ] Click "Create new project" and wait for provisioning (~2 min)
- [ ] Navigate to: Settings → Database
- [ ] Copy **Connection string (Pooler)**:
  ```
  postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
  ```
- [ ] Save connection string to secure notes (you'll need it in Step 2)

**⚠️ Important:** Use the **pooler connection** (port 6543) for runtime queries. For migrations, you may need the direct connection (port 5432) if running locally.

---

## Step 2: Deploy Backend to Render (Blueprint Method)

**Estimated Time:** 8-10 minutes (including build)

### 2.1 Create Blueprint Instance

- [ ] Go to https://dashboard.render.com/blueprints
- [ ] Click **"New Blueprint Instance"**
- [ ] **Repository:** Search for and select `Scardubu/taxbridge`
- [ ] **Blueprint file:** `render.staging.yaml` (should auto-detect)
- [ ] **Branch:** `master`
- [ ] Click **"Next"**

### 2.2 Configure Secret Environment Variables

For each variable marked `sync: false` in render.staging.yaml, set the value:

- [ ] `DATABASE_URL` = `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@...` (from Step 1)
- [ ] `JWT_SECRET` = (generate via command below)
- [ ] `JWT_REFRESH_SECRET` = (generate via command below)
- [ ] `ENCRYPTION_KEY` = (generate via command below)
- [ ] `SESSION_SECRET` = (generate via command below)
- [ ] `WEBHOOK_SECRET` = (generate via command below)
- [ ] `REMITA_WEBHOOK_SECRET` = (generate via command below)
- [ ] `SENTRY_DSN` = (leave empty for now)

**Generate secrets locally:**
```powershell
# Run this command 6 times to generate 6 secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use the provided script:
```powershell
cd c:\Users\USR\Documents\taxbridge\backend
node scripts/generate-secrets.js
```

- [ ] Click **"Apply"** to start deployment

### 2.3 Monitor Deployment

- [ ] Watch build logs in Render dashboard
- [ ] **Expected build logs:**
  ```
  yarn install --frozen-lockfile --production=false
  yarn workspace @taxbridge/backend build
  yarn workspace @taxbridge/backend ubl:download-xsd
  ```
- [ ] **Expected start logs:**
  ```
  Running 'yarn workspace @taxbridge/backend start'
  Node.js v20.19.4
  Server listening on port 3000
  ```
- [ ] Wait for services to show **"Live"** status (~5-8 min total)
- [ ] Note the staging URL (e.g., `https://taxbridge-api-staging.onrender.com`)

**✅ Checkpoint:** All 3 services (API, Worker, Redis) show "Live" status in Render dashboard.

---

## Step 3: Run Database Migrations

**Estimated Time:** 2-3 minutes

### Option A: Render Shell (Recommended for Staging)

- [ ] In Render dashboard, open the **taxbridge-api-staging** service
- [ ] Click **"Shell"** tab
- [ ] Run migration command:
  ```bash
  cd backend
  npx prisma migrate deploy
  ```
- [ ] Verify output shows: **"3 migrations applied"**

### Option B: Local with Staging DATABASE_URL

- [ ] Open PowerShell in repo root
- [ ] Set staging DATABASE_URL:
  ```powershell
  cd c:\Users\USR\Documents\taxbridge\backend
  $env:DATABASE_URL = "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.com:5432/postgres?sslmode=require"
  ```
- [ ] Run migration script:
  ```powershell
  node scripts/run-migrations.js
  ```
- [ ] Verify output shows: **"Migrations deployed successfully"**

**⚠️ Troubleshooting:** If you see `P1001: Can't reach database server`, use the Render shell method (Option A).

**✅ Checkpoint:** Migrations applied successfully (3 migrations confirmed).

---

## Step 4: Validate Health Endpoints

**Estimated Time:** 3-5 minutes

### 4.1 Quick Health Validation

- [ ] Replace `<staging-url>` with your actual staging URL in commands below
- [ ] Run health validation script:
  ```powershell
  cd c:\Users\USR\Documents\taxbridge
  $STAGING_URL = "https://taxbridge-api-staging.onrender.com"
  yarn workspace @taxbridge/backend validate:health $STAGING_URL
  ```

**Expected Output:**
```
🏥 Validating Health Endpoints: https://taxbridge-api-staging.onrender.com

Checking Base Health Check... ✅ 200 (150ms)
Checking DigiTax Health Check... ✅ 200 (mock mode)
Checking Remita Health Check... ✅ 200 (mock mode)
Checking Database Health Check... ✅ 200 (80ms)
Checking Queue Health Check... ✅ 200 (50ms)

✅ All health checks passed!
```

- [ ] Verify all 5 health checks return ✅ 200
- [ ] Confirm DigiTax and Remita report **"mock mode"**

### 4.2 Comprehensive Staging Validation

- [ ] Run full staging validation suite:
  ```powershell
  yarn workspace @taxbridge/backend validate:staging $STAGING_URL
  ```

**Expected Output:**
```
🔍 Comprehensive Staging Validation
✅ Health endpoints: 5/5 passing
✅ Mock mode: DigiTax + Remita confirmed
✅ API smoke test: Version endpoint responds
✅ Environment: NODE_ENV=staging
✅ Render configuration: Correct build/start commands
```

- [ ] Verify comprehensive validation passes

**✅ Checkpoint:** All health endpoints return 200; mock mode confirmed.

---

## Step 5: API Smoke Test

**Estimated Time:** 2-3 minutes

### 5.1 Test Core Endpoints

- [ ] Test liveness (no DB dependency):
  ```powershell
  Invoke-RestMethod -Uri "$STAGING_URL/health/live" | ConvertTo-Json
  ```
  **Expected:** `{"status":"ok"}`

- [ ] Test readiness (requires DB + Redis):
  ```powershell
  Invoke-RestMethod -Uri "$STAGING_URL/health/ready" | ConvertTo-Json
  ```
  **Expected:** `{"status":"ok","database":"connected","redis":"connected"}`

- [ ] Test API version:
  ```powershell
  Invoke-RestMethod -Uri "$STAGING_URL/api/v1/version" | ConvertTo-Json
  ```
  **Expected:** `{"version":"5.0.2","environment":"staging"}`

### 5.2 Test Mock Integration Status

- [ ] Check DigiTax mock mode:
  ```powershell
  Invoke-RestMethod -Uri "$STAGING_URL/health/digitax" | ConvertTo-Json
  ```
  **Expected:** `{"status":"ok","mode":"mock"}`

- [ ] Check Remita mock mode:
  ```powershell
  Invoke-RestMethod -Uri "$STAGING_URL/health/remita" | ConvertTo-Json
  ```
  **Expected:** `{"status":"ok","mode":"mock"}`

**✅ Checkpoint:** All smoke tests pass; mock mode confirmed for external integrations.

---

## Step 6: Verify Worker Service

**Estimated Time:** 2 minutes

- [ ] In Render dashboard, open **taxbridge-worker-staging** service
- [ ] Check logs for:
  ```
  BullMQ worker started
  Listening for jobs on queue: invoice-sync
  Listening for jobs on queue: payment-processing
  ```
- [ ] Verify no error messages in logs
- [ ] Confirm service status: **"Live"**

**✅ Checkpoint:** Worker service is running and listening for queue jobs.

---

## Step 7: Update Integration Checklist

**Estimated Time:** 1 minute

- [ ] Open [docs/INTEGRATION_CHECKLIST.md](docs/INTEGRATION_CHECKLIST.md)
- [ ] Update F3 validation status:
  - Staging deploy via `render.staging.yaml`: ✅
  - Migrations applied: ✅
  - Health validation: ✅ (all 5 endpoints)
  - Mock mode confirmed: ✅ (DigiTax + Remita)
  - Worker service online: ✅
- [ ] Save checklist
- [ ] Commit update:
  ```powershell
  git add docs/INTEGRATION_CHECKLIST.md
  git commit -m "chore: F3 staging deployment complete - all health checks pass"
  git push origin master
  ```

---

## F3 Completion Criteria ✅

### Must Pass (All Required)

- [ ] **Render services:** All 3 services (API, Worker, Redis) show "Live" status
- [ ] **Database migrations:** 3 migrations applied successfully
- [ ] **Health endpoints:** All 5 endpoints return 200
  - `/health/live` ✅
  - `/health/ready` ✅
  - `/health/db` ✅
  - `/health/queues` ✅
  - `/health/digitax` ✅ (mock mode)
  - `/health/remita` ✅ (mock mode)
- [ ] **Mock mode:** DigiTax and Remita confirmed in mock mode
- [ ] **Worker service:** Logs show BullMQ worker listening for jobs
- [ ] **API smoke test:** Core endpoints respond correctly
- [ ] **No critical errors:** Build logs, start logs, runtime logs clean

### Evidence Collected

- [ ] Render deployment logs saved (build + start)
- [ ] Migration output captured
- [ ] Health validation output saved
- [ ] Smoke test results documented
- [ ] Worker logs captured
- [ ] Integration checklist updated

---

## Troubleshooting Quick Reference

### Issue: Build Fails with "prisma: not found"
**Cause:** Render not using blueprint (manual service creation)  
**Fix:** Delete service and redeploy via "New Blueprint Instance"

### Issue: "P1001: Can't reach database server"
**Cause:** IPv6-only DNS resolution (Supabase direct connection)  
**Fix:** Use Render shell for migrations (Option A in Step 3)

### Issue: Health check fails with 503
**Cause:** Database connection not established  
**Fix:** Verify `DATABASE_URL` is correct in Render environment variables

### Issue: Redis eviction policy warning
**Cause:** Legacy Redis instance without `noeviction` policy  
**Fix:** Delete Redis service and redeploy via Blueprint (auto-configures policy)

### Issue: Static assets not found (ENOENT tax_faqs.json)
**Cause:** Build didn't copy `src/data/` to `dist/`  
**Fix:** Verify latest code deployed; `copy-static-assets.js` should run during build

---

## Next Step: F4 Load Testing

After F3 completion checklist is fully validated:

- [ ] Install k6: `winget install Grafana.k6`
- [ ] Set staging URL: `$env:BASE_URL = "<staging-url>"`
- [ ] Run F4 test suite: `yarn workspace @taxbridge/backend test:load:f4`
- [ ] Document results in F4 execution report

**Estimated F4 Time:** ~90 minutes total (smoke 5min + load 27min + soak 60min)

---

## Sign-Off

**F3 Staging Deployment Complete:** [ ]

**Completed by:** ___________________________  
**Date/Time:** ___________________________  
**Staging URL:** ___________________________  
**Evidence Location:** ___________________________

**Next Gate:** F4 Load Testing  
**Approved by:** ___________________________  
**Date:** ___________________________

---

**Document Version:** 1.0  
**Created:** January 19, 2026  
**Owner:** Production Finalization Team
