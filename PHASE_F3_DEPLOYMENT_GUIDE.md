# Phase F3: Backend Staging Deployment - Complete Guide

**Started:** January 16, 2026  
**Status:** 🟢 READY TO DEPLOY  
**Prerequisites:** ✅ All met (F1 + F2 complete, configs validated)

---

## Executive Summary

Phase F3 deploys the TaxBridge backend to a staging environment to validate:
- Infrastructure stability (Render + Supabase + Upstash)
- Database migrations in cloud environment
- Health check endpoints under real network conditions
- Queue processing with Redis in production setting
- Mock mode operation (DigiTax + Remita disabled)

**Duration:** ~30 minutes (includes deployment + validation)

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│            Staging Environment                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  Render Services:                                │
│  ├─ taxbridge-api-staging (Node.js web service) │
│  │  ├─ Health: /health                           │
│  │  ├─ Mock Mode: DigiTax + Remita               │
│  │  └─ CORS: staging domains + emulator          │
│  │                                                │
│  └─ taxbridge-worker-staging (BullMQ worker)     │
│     ├─ Concurrency: 5                             │
│     ├─ DLQ monitoring enabled                     │
│     └─ Processes: invoice sync, payments          │
│                                                  │
│  Render Redis:                                   │
│  └─ taxbridge-redis-staging                      │
│     ├─ Plan: Starter                              │
│     ├─ Policy: allkeys-lru                        │
│     └─ Max Memory: 256 MB                         │
│                                                  │
│  Supabase PostgreSQL:                            │
│  └─ taxbridge_staging database                   │
│     ├─ Schema: Separate from production          │
│     ├─ Connection Pool: 10                        │
│     └─ Backups: Daily (Supabase Pro)             │
│                                                  │
└─────────────────────────────────────────────────┘
          ↓ HTTP/S
┌─────────────────────────────────────────────────┐
│         Mobile App (Expo Go / EAS Build)        │
│  API: https://api-staging.taxbridge.ng          │
│  Or:  http://10.0.2.2:3000 (emulator)           │
└─────────────────────────────────────────────────┘
```

---

## Prerequisites Checklist

### ✅ Phase F1 Complete
- [x] Production secrets generated (JWT, encryption keys, session secrets)
- [x] Staging secrets generated (separate from production)
- [x] Environment variable templates validated

### ✅ Phase F2 Complete
- [x] Android production build successful (Build ID: 446d5211...)
- [x] Mobile app version: 5.0.2
- [x] EAS Update channels configured

### ✅ Code & Configuration
- [x] Backend TypeScript compiles with 0 errors
- [x] Backend tests: 68/68 passing
- [x] `render.staging.yaml` created with mock mode enabled
- [x] Database migration scripts ready
- [x] Health check endpoints implemented

### ✅ External Accounts
- [x] Render.com account active (free tier sufficient for staging)
- [ ] Supabase account with project created
  - Required: Database connection string (`DATABASE_URL`)
  - Required: Separate staging database/schema
- [ ] Upstash account with Redis instance (or use Render Redis)
  - Required: Redis connection string (`REDIS_URL`)

---

## Step-by-Step Deployment

### Step 1: Prepare Supabase Database (5 min)

**1.1 Create Staging Database:**

```bash
# Option A: Create new Supabase project for staging
# Go to https://supabase.com/dashboard
# Create project: taxbridge-staging
# Region: Singapore or Ireland (closest to Nigeria)
# Plan: Free tier OK for staging

# Option B: Use existing project with separate schema
# SQL Editor in Supabase dashboard:
CREATE SCHEMA IF NOT EXISTS taxbridge_staging;
SET search_path TO taxbridge_staging;
```

**1.2 Get Connection String:**

```
Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:6543/postgres?schema=taxbridge_staging
```

Save this as `DATABASE_URL` for next steps.

---

### Step 2: Configure Render Environment Variables (10 min)

**2.1 Navigate to Render Dashboard:**
- Go to https://dashboard.render.com
- Click "New +" → "Blueprint"
- Connect your GitHub repository: `taxbridge`
- Select `render.staging.yaml` blueprint

**2.2 Set Secret Environment Variables:**

In Render dashboard, for **taxbridge-api-staging** service, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | From Supabase (Step 1.2) |
| `REDIS_URL` | Auto-filled from service | Render managed Redis |
| `JWT_SECRET` | `<64-char hex>` | From Phase F1 secrets (staging) |
| `ENCRYPTION_KEY` | `<64-char hex>` | From Phase F1 secrets (staging) |
| `SESSION_SECRET` | `<64-char hex>` | From Phase F1 secrets (staging) |
| `WEBHOOK_SECRET` | `<64-char hex>` | From Phase F1 secrets (staging) |
| `SENTRY_DSN` | `https://...` | Optional: Sentry project DSN |

For **taxbridge-worker-staging** service, add same secrets (except `WEBHOOK_SECRET`).

**Pre-set Values (already in yaml):**
- `NODE_ENV=staging`
- `DIGITAX_MOCK_MODE=true`
- `REMITA_MOCK_MODE=true`
- `LOG_LEVEL=debug`
- `ALLOWED_ORIGINS=https://staging.taxbridge.ng,...` (legacy `CORS_ORIGINS` also supported)

**2.3 Review and Deploy:**
- Click "Create Blueprint" or "Apply Changes"
- Render will:
  1. Clone repository
  2. Run `yarn install --frozen-lockfile`
  3. Run `yarn build`
  4. Download UBL XSD schema
  5. Start services

---

### Step 3: Monitor Deployment (5 min)

**3.1 Watch Build Logs:**

In Render dashboard:
- Navigate to `taxbridge-api-staging` service
- Click "Logs" tab
- Watch for:
  ```
  Installing dependencies...
  ✅ Compiled successfully
  Downloading UBL schema...
  Starting server...
  🚀 Server listening on port 10000
  ```

**3.2 Check Service Status:**

Expected statuses:
- `taxbridge-api-staging`: Live (green)
- `taxbridge-worker-staging`: Live (green)
- `taxbridge-redis-staging`: Available (green)

**3.3 Get Service URL:**

Render provides auto-generated URL:
```
https://taxbridge-api-staging-XXXXX.onrender.com
```

Copy this URL for next steps.

---

### Step 4: Run Database Migrations (3 min)

**4.1 SSH into Render Service:**

```bash
# From Render dashboard:
# Navigate to taxbridge-api-staging → Shell
# Or use Render CLI:
render shell taxbridge-api-staging
```

**4.2 Apply Migrations:**

```bash
cd backend
npx prisma migrate deploy
```

**Expected Output:**
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "taxbridge_staging" at "..."

3 migrations found in prisma/migrations

Applying migration `20260106083801_add_ussd_sms`
Applying migration `20260106085514_add_sms_delivery`
Applying migration `add_encryption_key_version`

The following migrations have been applied:

migrations/
  └─ 20260106083801_add_ussd_sms/
      └─ migration.sql
  └─ 20260106085514_add_sms_delivery/
      └─ migration.sql
  └─ add_encryption_key_version.sql

All migrations have been successfully applied.
```

**4.3 Generate Prisma Client:**

```bash
npx prisma generate
```

**4.4 Restart Service:**

In Render dashboard:
- Click "Manual Deploy" → "Clear build cache & deploy"
- Or: Services auto-restart after migration

---

### Step 5: Validate Health Endpoints (5 min)

**5.1 Use Validation Script:**

From your local machine:

```powershell
cd c:\Users\USR\Documents\taxbridge\backend
node scripts\validate-health.js https://taxbridge-api-staging-XXXXX.onrender.com
```

**Expected Output:**
```
🏥 Validating Health Endpoints: https://taxbridge-api-staging-...

Checking Base Health Check... ✅ 200 (120ms)
Checking DigiTax Health Check... ✅ 200 (15ms)
Checking Remita Health Check... ✅ 200 (12ms)
Checking Database Health Check... ✅ 200 (250ms)
Checking Queue Health Check... ✅ 200 (80ms)

📊 Health Check Summary:

  ✅ Healthy: 5/5

  ⏱️  Average Latency: 95ms

✅ Health check PASSED: All required endpoints are healthy
```

**5.2 Manual Validation:**

```bash
# Base health
curl https://taxbridge-api-staging-XXXXX.onrender.com/health

# Expected:
{
  "status": "healthy",
  "timestamp": "2026-01-16T...",
  "checks": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" }
  }
}

# DigiTax health (should be mock mode)
curl https://taxbridge-api-staging-XXXXX.onrender.com/health/digitax

# Expected:
{
  "status": "healthy",
  "provider": "digitax",
  "mode": "mock",
  "latency": 1,
  "timestamp": "..."
}
```

---

### Step 6: Test Mobile App Integration (5 min)

**6.1 Update Mobile API URL:**

Option A: Use Expo Go for quick test:
```bash
cd c:\Users\USR\Documents\taxbridge\mobile
yarn start

# In Expo Go app (Android/iOS):
# Settings → API URL → Enter staging URL
# https://taxbridge-api-staging-XXXXX.onrender.com
```

Option B: Use EAS Build (recommended):
```bash
# Deploy staging update (uses eas.json staging profile)
eas update --branch staging --message "Connect to staging backend"
```

**6.2 Create Test Invoice:**

In mobile app:
1. Navigate to "Create Invoice"
2. Enter test data:
   - Customer: "Test Customer - Staging"
   - Item: "Test Product", Qty: 1, Price: ₦1000
3. Click "Save Invoice"

**Expected:**
- Invoice saves to local SQLite (offline mode works)
- Sync icon appears
- When online, invoice syncs to backend
- Backend processes with mock DigiTax submission
- Invoice status updates to "stamped" with mock CSID/IRN

**6.3 Check Backend Logs:**

In Render dashboard:
```
[INFO] POST /api/v1/invoices - Invoice created: <uuid>
[INFO] Queue: invoice-sync - Processing job <uuid>
[INFO] DigiTax: Mock mode - Generating synthetic CSID
[INFO] Queue: invoice-sync - Job completed successfully
```

---

## Success Criteria (Go/No-Go for F4)

### ✅ Must Pass (Blocking)

- [ ] Backend API responds to `/health` with 200
- [ ] Database migrations applied successfully
- [ ] Redis connection established (no connection errors in logs)
- [ ] Queue worker processing jobs (check logs for "Processing job")
- [ ] DigiTax mock mode working (returns synthetic CSID/IRN)
- [ ] Remita mock mode working (returns synthetic RRR)
- [ ] Mobile app can create invoice via staging API
- [ ] Invoice sync from mobile to backend succeeds

### ⚠️ Should Pass (Non-Blocking)

- [ ] Average API latency < 500ms
- [ ] No memory leaks in 10-minute observation
- [ ] Worker processes jobs within 30 seconds
- [ ] CORS allows mobile app origins

### ❌ Known Limitations (Staging Only)

- Mock mode enabled (DigiTax/Remita not real)
- Smaller database (free tier may have connection limits)
- Render free tier may spin down after 15 min inactivity
- No auto-scaling (fixed concurrency)

---

## Troubleshooting

### Issue: Build Failed - "Module not found"

**Cause:** Missing dependencies or wrong Node version

**Fix:**
```bash
# Ensure package.json has all dependencies
# Render uses Node 20.x by default

# In render.yaml, verify:
env: node

# Clear build cache in Render dashboard
```

### Issue: Health Check Returns 503

**Cause:** Database or Redis connection failed

**Fix:**
1. Verify `DATABASE_URL` is correct (check Supabase dashboard)
2. Verify `REDIS_URL` is set (should auto-fill from Render Redis)
3. Check service logs for connection errors:
   ```
   Error: connect ETIMEDOUT
   Error: getaddrinfo ENOTFOUND
   ```
4. Ensure Render services are in same region (reduces latency)

### Issue: Migrations Fail - "Schema not found"

**Cause:** Prisma schema path or search_path misconfigured

**Fix:**
```bash
# In DATABASE_URL, ensure schema parameter:
?schema=taxbridge_staging

# Or set in prisma/schema.prisma:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["taxbridge_staging"]
}
```

### Issue: Worker Not Processing Jobs

**Cause:** Redis connection or BullMQ configuration

**Fix:**
1. Check worker logs for errors
2. Verify `REDIS_URL` matches API service
3. Restart worker service
4. Check Redis memory not exhausted (Render free tier: 25 MB)

### Issue: CORS Error from Mobile App

**Cause:** Origin not whitelisted

**Fix:**
Add mobile app origin to `ALLOWED_ORIGINS` env var (legacy `CORS_ORIGINS` also supported):
```
https://staging.taxbridge.ng,http://localhost:19006,http://10.0.2.2:3000
```

---

## Post-Deployment Tasks

### 1. Document Service URLs

Update `PHASE_F3_DEPLOYMENT_REPORT.md`:
- API URL: `https://taxbridge-api-staging-XXXXX.onrender.com`
- Worker logs: (link to Render dashboard)
- Database: `taxbridge_staging` on Supabase project

### 2. Update Mobile App EAS Config

In `mobile/eas.json`, verify staging profile:
```json
{
  "staging": {
    "channel": "staging",
    "env": {
      "EXPO_PUBLIC_API_URL": "https://taxbridge-api-staging-XXXXX.onrender.com"
    }
  }
}
```

### 3. Set Up Monitoring (Optional)

- Add Render service to UptimeRobot (ping `/health` every 5 min)
- Configure Sentry alerts for staging errors
- Add Slack webhook for deployment notifications

### 4. Smoke Test Suite

Run automated smoke tests:
```bash
cd c:\Users\USR\Documents\taxbridge\backend
npm run test:integration -- --testNamePattern="Staging"
```

Expected tests:
- Invoice creation via API
- Health endpoint validation
- Queue job processing
- Mock mode verification

---

## Rollback Procedure

If staging deployment fails:

**Option 1: Revert Code**
```bash
git revert <commit-hash>
git push origin staging
# Render auto-deploys on push
```

**Option 2: Redeploy Previous Version**
In Render dashboard:
- Navigate to service → "Deploys"
- Find last successful deploy
- Click "Rollback to this version"

**Option 3: Delete and Recreate**
```bash
# In Render dashboard, delete services
# Re-run deployment from Step 2
```

---

## Next Steps (Phase F4)

After F3 passes all success criteria:

1. **Proceed to Load Testing:**
   - Create k6 test scripts for staging API
   - Run smoke, load, and soak tests
   - Validate performance under stress

2. **Parallel Track - DigiTax Certification (F5):**
   - Submit test invoices to DigiTax sandbox
   - Obtain production API credentials
   - Can run in parallel with F4

3. **Document Staging Environment:**
   - URLs, credentials (in secure vault)
   - Known issues and workarounds
   - Rollback procedures

---

## F3 Sign-Off

| Role | Name | Status | Date |
|------|------|--------|------|
| Engineering Lead | | ⏳ Pending | |
| DevOps | | ⏳ Pending | |
| QA | | ⏳ Pending | |

**Sign-off requires:**
- ✅ All blocking success criteria passed
- ✅ Health checks validated
- ✅ Mobile integration tested
- ✅ Deployment documented

---

**Phase F3 Status:** 🟢 READY TO DEPLOY  
**Estimated Completion:** January 16, 2026 (within 30 minutes of deployment start)  
**Next Phase:** F4 - Load Testing Suite (62 minutes)
