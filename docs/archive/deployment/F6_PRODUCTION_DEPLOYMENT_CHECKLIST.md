# F6: Production Deployment Checklist

**Date:** January 20, 2026  
**Status:** 🟢 READY TO EXECUTE  
**Prerequisites:** ✅ F1-F4 Complete  
**Estimated Time:** 30-45 minutes

---

## Pre-Deployment Verification

### Environment Readiness
- [ ] F3 staging deployment validated (6/6 health checks passing)
- [ ] F4 smoke test passed (99.2% success rate)
- [ ] Production secrets prepared (see below)
- [ ] Rollback plan documented
- [ ] Team briefed on deployment timeline

### Documentation Review
- [ ] Read [F3_STAGING_DEPLOYMENT.md](F3_STAGING_DEPLOYMENT.md) — Deployment procedure
- [ ] Read [F4_COMPLETION_SUMMARY.md](F4_COMPLETION_SUMMARY.md) — Load test results
- [ ] Read [PRODUCTION_READINESS_FINAL_2026_01_19.md](PRODUCTION_READINESS_FINAL_2026_01_19.md) — System status
- [ ] Review [render.yaml](render.yaml) — Production blueprint

---

## Step 1: Prepare Production Environment

### 1.1 Create Production Database (Supabase)

**Action:**
1. Go to https://supabase.com/dashboard
2. Create new project:
   - Name: `taxbridge-production`
   - Region: US West (Oregon)
   - Generate strong password (save securely)
3. Navigate to: Settings → Database
4. Copy **Connection string (Pooler)** (port 6543)

**Save to:**
- Secure password manager
- Render Dashboard (DATABASE_URL env var)

### 1.2 Generate Production Secrets

**Command:**
```powershell
cd c:\Users\USR\Documents\taxbridge\backend
node scripts/generate-secrets.js
```

**Secrets to generate:**
- `JWT_SECRET` (64-char hex)
- `JWT_REFRESH_SECRET` (64-char hex)
- `ENCRYPTION_KEY` (64-char hex)
- `SESSION_SECRET` (64-char hex)
- `WEBHOOK_SECRET` (64-char hex)
- `REMITA_WEBHOOK_SECRET` (64-char hex)

**⚠️ CRITICAL:** Never commit these to Git. Store in Render Dashboard only.

### 1.3 External Service Credentials Status

| Service | Status | Action | Blocker? |
|---------|--------|--------|----------|
| DigiTax OAuth | 🟡 Pending | Use `DIGITAX_MOCK_MODE=true` for Stage 1 | No |
| Remita Keys | 🟡 Pending | Use `REMITA_MOCK_MODE=true` for Stage 1 | No |
| Africa's Talking (SMS) | 🟡 Pending | Keep optional; surface in-app status | No |
| Sentry DSN | 🟢 Optional | Leave empty initially | No |

**Decision:** Proceed with **mock mode** for Stage 1 soft launch (100 users).

---

## Step 2: Deploy to Render Production

### 2.1 Create Blueprint Instance

1. Go to: https://dashboard.render.com/blueprints
2. Click: **"New Blueprint Instance"**
3. Repository: `Scardubu/taxbridge`
4. Blueprint file: `render.yaml` (production)
5. Branch: `master`
6. Click: **"Next"**

### 2.2 Set Environment Variables

Configure all secrets marked `sync: false` in [render.yaml](render.yaml):

| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Supabase (step 1.1) | Use pooler connection (port 6543) |
| `JWT_SECRET` | `generate-secrets.js` | 64-char hex |
| `JWT_REFRESH_SECRET` | `generate-secrets.js` | 64-char hex |
| `ENCRYPTION_KEY` | `generate-secrets.js` | 64-char hex |
| `SESSION_SECRET` | `generate-secrets.js` | 64-char hex |
| `WEBHOOK_SECRET` | `generate-secrets.js` | 64-char hex |
| `REMITA_WEBHOOK_SECRET` | `generate-secrets.js` | 64-char hex |
| `DUPLO_CLIENT_ID` | DigiTax | Leave empty for mock mode |
| `DUPLO_CLIENT_SECRET` | DigiTax | Leave empty for mock mode |
| `REMITA_MERCHANT_ID` | Remita | Leave empty for mock mode |
| `REMITA_API_KEY` | Remita | Leave empty for mock mode |
| `REMITA_SERVICE_TYPE_ID` | Remita | Leave empty for mock mode |
| `SENTRY_DSN` | Sentry | Optional |

**Public Environment Variables (Already in blueprint):**
- `NODE_ENV=production`
- `DIGITAX_MOCK_MODE=false` ← **Change to `true` for Stage 1**
- `REMITA_MOCK_MODE=false` ← **Change to `true` for Stage 1**

### 2.3 Monitor Deployment

Watch build logs for:
```
✅ yarn install --frozen-lockfile --production=false
✅ yarn workspace @taxbridge/backend build
✅ yarn workspace @taxbridge/backend ubl:download-xsd
✅ Server listening on port 3000
```

**Expected deployment time:** 5-8 minutes

---

## Step 3: Run Database Migrations

### Option A: Render Shell (Recommended)

1. Open Render Dashboard → taxbridge-api service
2. Click **"Shell"** tab
3. Run:
   ```bash
   yarn workspace @taxbridge/backend prisma:migrate:deploy
   ```
4. Verify output: **"3 migrations applied"**

### Option B: Local with Production DATABASE_URL

```powershell
cd c:\Users\USR\Documents\taxbridge\backend
$env:DATABASE_URL = "postgresql://postgres.[PROJECT]:password@[HOST]:5432/postgres?sslmode=require"
node scripts/run-migrations.js
```

---

## Step 4: Validate Production Deployment

### 4.1 Health Check Validation

```powershell
$PROD_URL = "https://taxbridge-api.onrender.com"

# Quick health validation
yarn workspace @taxbridge/backend validate:health $PROD_URL

# Expected: All 6 health checks return 200
```

### 4.2 Manual Health Endpoint Tests

```powershell
# Liveness (no dependencies)
Invoke-RestMethod -Uri "$PROD_URL/health/live" | ConvertTo-Json

# Readiness (DB + Redis)
Invoke-RestMethod -Uri "$PROD_URL/health/ready" | ConvertTo-Json

# Database
Invoke-RestMethod -Uri "$PROD_URL/health/db" | ConvertTo-Json

# Queues
Invoke-RestMethod -Uri "$PROD_URL/health/queues" | ConvertTo-Json

# DigiTax (should report mock mode)
Invoke-RestMethod -Uri "$PROD_URL/health/digitax" | ConvertTo-Json

# Remita (should report mock mode)
Invoke-RestMethod -Uri "$PROD_URL/health/remita" | ConvertTo-Json
```

### 4.3 Smoke Test (Optional but Recommended)

```powershell
cd c:\Users\USR\Documents\taxbridge\backend\load-test
$env:BASE_URL = "https://taxbridge-api.onrender.com"
k6 run --vus 3 --duration 60s k6-smoke-staging.js
```

**Expected:** >95% success rate, all health endpoints operational.

---

## Step 5: Configure Monitoring

### 5.1 Enable Sentry (Optional)

1. Create Sentry project: https://sentry.io
2. Copy DSN
3. Add to Render env vars: `SENTRY_DSN=...`
4. Redeploy service

### 5.2 Set Up Uptime Monitoring

**Option A: UptimeRobot (Free)**
1. Create account: https://uptimerobot.com
2. Add monitor:
   - URL: `https://taxbridge-api.onrender.com/health/live`
   - Interval: 5 minutes
   - Alert: Email

**Option B: Render Built-in**
- Render automatically monitors `/health/live`
- Alerts via dashboard notifications

### 5.3 Slack Webhook (Optional)

Configure Render to send deployment/error alerts to Slack:
1. Create Slack webhook
2. Add to Render notification settings

---

## Step 6: Mobile App Configuration

### 6.1 Update Mobile Environment

Update `mobile/.env.production` or EAS secrets:

```env
API_URL=https://taxbridge-api.onrender.com
ENVIRONMENT=production
ENABLE_ANALYTICS=true
SENTRY_DSN=<mobile-sentry-dsn>
```

### 6.2 Trigger OTA Update (If Needed)

```powershell
cd c:\Users\USR\Documents\taxbridge\mobile
eas update --branch production --message "Connect to production API"
```

---

## Step 7: Post-Deployment Validation

### 7.1 Deployment Evidence Checklist

- [ ] All Render services show "Live" status
- [ ] Health endpoints return 200 (6/6)
- [ ] Database migrations applied (3 migrations)
- [ ] Mock mode confirmed (DigiTax + Remita)
- [ ] Redis/BullMQ operational
- [ ] Worker service processing jobs
- [ ] No critical errors in logs (first 10 minutes)

### 7.2 Functional Smoke Test

Test user registration flow (if SMS provider configured):
```powershell
$body = @{
    phone = "+2349012345678"
    name = "Production Test User"
    password = "ProdTest123!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://taxbridge-api.onrender.com/api/v1/auth/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

If SMS not configured, expect 400 error (acceptable for Stage 1 mock mode).

---

## Step 8: Enable Stage 1 Soft Launch

### 8.1 Announce Internal Beta

- Send invite to 100 internal/friendly beta testers
- Provide:
  - Download link (EAS build or Play Store internal testing)
  - Known limitations (mock mode, no real payments)
  - Feedback channels (Slack, email)

### 8.2 Monitor Launch Metrics

**Daily Dashboard (First Week):**
- Crash-free sessions (target: ≥99%)
- Sync success rate (target: ≥99%)
- P95 API latency (target: <400ms)
- Error rate (target: <1%)
- Support ticket backlog (target: <24h resolution)

**Tools:**
- Render Dashboard: CPU/memory/response times
- Sentry: Error tracking + performance
- Mobile analytics: Crash reports, session duration

### 8.3 Go/No-Go for Stage 2

**After 7 days, evaluate:**
- [ ] Crash-free ≥99%
- [ ] Sync success ≥99%
- [ ] No critical bugs reported
- [ ] Support backlog manageable (<24h)
- [ ] Infrastructure stable (no outages)

**If all pass:** Proceed to Stage 2 (1,000 users).  
**If any fail:** Extend Stage 1, investigate, remediate.

---

## Rollback Plan

### If Critical Issue Discovered

**Symptoms:**
- Error rate >5% sustained >10 minutes
- Crash-free rate <95%
- Data corruption detected
- "Paid" invoices without webhook confirmation

**Action:**
1. **Immediate:** Stop user onboarding (pause invites)
2. **Rollback mobile app:** 
   ```powershell
   eas update --branch production --message "Rollback to previous version"
   ```
3. **Rollback backend:** Redeploy previous commit via Render dashboard
4. **Notify users:** In-app message + email if needed
5. **Incident report:** Document root cause + remediation
6. **Fix + redeploy:** After root cause resolved

---

## Production URLs

| Service | URL | Status |
|---------|-----|--------|
| API | `https://taxbridge-api.onrender.com` | ⏳ |
| Worker | Background (no URL) | ⏳ |
| Redis | Internal | ⏳ |

---

## Success Criteria

- [ ] Production deployment live within 45 minutes
- [ ] All health checks passing (6/6)
- [ ] No critical errors in first 30 minutes
- [ ] Database migrations applied successfully
- [ ] Mock mode validated (DigiTax + Remita)
- [ ] Monitoring alerts configured
- [ ] Stage 1 beta testers invited (100 users)
- [ ] Rollback plan tested and documented

---

## Next Phase: F7 Phased Rollout

After successful Stage 1 validation (7-14 days):
- **Stage 2:** 1,000 users (2-4 weeks)
- **Stage 3:** 10,000 users (regional scale)
- **Stage 4:** 50,000+ users (national rollout)

---

**Document Version:** 1.0  
**Created:** January 20, 2026  
**Author:** TaxBridge DevOps
