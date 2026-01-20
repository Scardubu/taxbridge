# F6 Production Deployment — Execution Log

**Date:** January 20, 2026  
**Status:** 🟢 READY TO EXECUTE  
**Phase:** F6 Production API Deployment  
**UI Sign-Off:** ✅ **COMPLETE** (Phase C 100%)

---

## Pre-Deployment Summary

### Phase C UI Lockdown — ✅ COMPLETE

**Completed Tasks:**
1. ✅ **Mobile i18n:** 267 keys (English + Pidgin) — 100% parity
2. ✅ **Admin Dashboard Audit:** Zero hardcoded strings or placeholders
3. ✅ **UI Sign-Off Checklist:** All gates passed
4. ✅ **Visual Consistency:** Cross-surface alignment verified
5. ✅ **Accessibility:** WCAG 2.1 AA compliant
6. ✅ **Documentation:** UI_SIGN_OFF_CHECKLIST.md + ADMIN_DASHBOARD_UI_AUDIT.md

**Evidence:**
- [UI_SIGN_OFF_CHECKLIST.md](UI_SIGN_OFF_CHECKLIST.md) — Comprehensive sign-off document
- [ADMIN_DASHBOARD_UI_AUDIT.md](ADMIN_DASHBOARD_UI_AUDIT.md) — Admin dashboard audit report
- [PHASE_C_AND_DEPLOYMENT_COMPLETE.md](PHASE_C_AND_DEPLOYMENT_COMPLETE.md) — Phase C summary

**Git Commit:** `9b1542e` — phase/C-ui-sign-off-complete-admin-audit-and-evidence

---

## Generated Production Secrets

**⚠️ CRITICAL SECURITY NOTICE:**
- These secrets are for **PRODUCTION USE ONLY**
- Store in secure password manager (1Password, LastPass, Bitwarden)
- Never commit to Git
- Never share via unencrypted channels
- Rotate if compromised

```bash
JWT_SECRET=b603e0e5e457f24447115812fc93836f20ba6b00371b530523bb6c8f65e1ccd2
JWT_REFRESH_SECRET=efe054eed9edcf21ba039037c4ee86824e1c240fdbebebb3c2fc1aaa9aeffe3c
ENCRYPTION_KEY=136d50a286e57396d680aeb8701c02649b62f05ce89abf3c830f7fe0a96a3b0f
SESSION_SECRET=b0965c1e0f01be697b788e9bc3f4506483474f213c19803579c7978761dc540a
WEBHOOK_SECRET=9b2abe3d60641d3833580be87fd563c9247fb242ac97b2570b7b644c35a41fa1
REMITA_WEBHOOK_SECRET=c659812df0f2226875b94f0ce2eeed754aaa4e04b5999084d3c39b0ba4247753
DIGITAX_HMAC_SECRET=2a612c0f508fa8e9ab4f807ba9a78dfbff7c064e7c9009f3e739f8f3cae8bbed
```

---

## Step 1: Database Setup (Supabase)

### Action Required

1. **Go to:** https://supabase.com/dashboard
2. **Click:** "New Project"
3. **Configure:**
   - **Project Name:** `taxbridge-production`
   - **Database Password:** *(Generate strong password)*
   - **Region:** US West (Oregon) / `us-west-1`
   - **Pricing Plan:** Free tier initially (upgrade after validation)

4. **After creation:**
   - Navigate to: **Settings → Database**
   - Find: **Connection string (Pooler)** — Port 6543
   - Format: `postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require`

5. **Copy connection string and save as:**
   ```bash
   DATABASE_URL=postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require
   ```

**Status:** ⏳ **PENDING USER ACTION**

---

## Step 2: Render Blueprint Deployment

### Prerequisites

- [ ] Supabase production database created
- [ ] DATABASE_URL copied
- [ ] All secrets from Step 1 ready
- [ ] GitHub repository accessible: `Scardubu/taxbridge`

### Deployment Instructions

1. **Go to:** https://dashboard.render.com/blueprints

2. **Click:** "New Blueprint Instance"

3. **Configure:**
   - **Repository:** `Scardubu/taxbridge`
   - **Branch:** `master`
   - **Blueprint file:** `render.yaml`

4. **Click:** "Next"

5. **Set Environment Variables:**

Copy and paste these into Render dashboard (replace `[DATABASE_URL]` with actual value from Supabase):

```bash
# Database
DATABASE_URL=[PASTE_YOUR_SUPABASE_CONNECTION_STRING_HERE]

# Authentication & Security
JWT_SECRET=b603e0e5e457f24447115812fc93836f20ba6b00371b530523bb6c8f65e1ccd2
JWT_REFRESH_SECRET=efe054eed9edcf21ba039037c4ee86824e1c240fdbebebb3c2fc1aaa9aeffe3c
ENCRYPTION_KEY=136d50a286e57396d680aeb8701c02649b62f05ce89abf3c830f7fe0a96a3b0f
SESSION_SECRET=b0965c1e0f01be697b788e9bc3f4506483474f213c19803579c7978761dc540a

# Webhooks
WEBHOOK_SECRET=9b2abe3d60641d3833580be87fd563c9247fb242ac97b2570b7b644c35a41fa1
REMITA_WEBHOOK_SECRET=c659812df0f2226875b94f0ce2eeed754aaa4e04b5999084d3c39b0ba4247753
DIGITAX_HMAC_SECRET=2a612c0f508fa8e9ab4f807ba9a78dfbff7c064e7c9009f3e739f8f3cae8bbed

# External Services (Leave empty for Stage 1 mock mode)
DUPLO_CLIENT_ID=
DUPLO_CLIENT_SECRET=
REMITA_MERCHANT_ID=
REMITA_API_KEY=
REMITA_SERVICE_TYPE_ID=
SENTRY_DSN=
```

**Additional Environment Variables (Already in render.yaml):**
```bash
NODE_ENV=production
PORT=3000
DIGITAX_MOCK_MODE=true
REMITA_MOCK_MODE=true
```

6. **Click:** "Apply"

7. **Wait for deployment:** (~8-15 minutes)

**Expected Output:**
```
✅ taxbridge-api (Web Service) — Deploying...
✅ taxbridge-worker (Background Worker) — Deploying...
✅ taxbridge-redis (Redis) — Starting...
```

**Status:** ⏳ **PENDING USER ACTION**

---

## Step 3: Run Database Migrations

### Prerequisites

- [ ] Render deployment completed (all services "Live")
- [ ] DATABASE_URL environment variable set

### Migration Instructions

**Option A: Render Shell (Recommended)**

1. **Go to:** Render Dashboard → `taxbridge-api` service
2. **Click:** "Shell" tab
3. **Run:**
   ```bash
   yarn workspace @taxbridge/backend prisma:migrate:deploy
   ```
4. **Verify output:**
   ```
   3 migrations applied:
   └─ 20240115000000_initial_schema
   └─ 20240116000000_add_invoices
   └─ 20240117000000_add_payments
   ```

**Option B: Local with Production DATABASE_URL**

```powershell
cd c:\Users\USR\Documents\taxbridge\backend
$env:DATABASE_URL = "[YOUR_PRODUCTION_DATABASE_URL]"
node scripts/run-migrations.js
```

**Status:** ⏳ **PENDING AFTER RENDER DEPLOYMENT**

---

## Step 4: Validate Production Deployment

### Health Check Validation

Once Render deployment is complete, run these health checks:

```powershell
$PROD_URL = "https://taxbridge-api.onrender.com"

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

**Expected Results:**

All endpoints should return:
```json
{
  "status": "ok",
  "timestamp": "2026-01-20T03:00:00.000Z",
  "service": "taxbridge-api",
  "version": "5.0.2"
}
```

**DigiTax/Remita mock mode indicators:**
```json
{
  "status": "ok",
  "mode": "mock",
  "message": "Running in mock mode for Stage 1 soft launch"
}
```

**Status:** ⏳ **PENDING AFTER MIGRATIONS**

---

## Step 5: Post-Deployment Verification

### Deployment Checklist

- [ ] All Render services show "Live" status
- [ ] Health endpoints return 200 (6/6)
- [ ] Database migrations applied (3 migrations)
- [ ] Mock mode confirmed (DigiTax + Remita)
- [ ] Redis/BullMQ operational
- [ ] Worker service processing jobs
- [ ] No critical errors in logs (first 10 minutes)

### Functional Smoke Test (Optional)

Test user registration flow:

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

**Expected:** 400 error (acceptable for Stage 1 mock mode without SMS provider)

**Status:** ⏳ **PENDING AFTER HEALTH VALIDATION**

---

## Step 6: Mobile & Admin Deployment

### Mobile App (Android)

**Status:** ✅ **BUILD READY** (v5.0.2, Build 50001)

**Next Steps:**
1. Download AAB: https://expo.dev/artifacts/eas/dHCysRdLUbq4PzoKYvMsfq.aab
2. Upload to Google Play Console (Internal Testing)
3. Invite 100 internal beta testers
4. Monitor crash-free rate (target: ≥99%)

**Note:** Mobile app already configured with `https://taxbridge-api.onrender.com`

### Admin Dashboard (Vercel)

**Status:** ✅ **BUILD READY** (Next.js 16.1.1)

**Deployment Methods:**

**Method 1: Vercel CLI**
```powershell
cd c:\Users\USR\Documents\taxbridge\admin-dashboard
vercel --prod
```

**Method 2: GitHub Integration**
1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard:
   ```bash
   NEXT_PUBLIC_APP_URL=https://admin.taxbridge.ng
   BACKEND_URL=https://taxbridge-api.onrender.com
   NEXT_PUBLIC_BACKEND_URL=https://taxbridge-api.onrender.com
   ```
3. Deploy from `master` branch

**Status:** ⏳ **PENDING AFTER API DEPLOYMENT**

---

## Step 7: Stage 1 Soft Launch

### Activation Criteria

- [ ] Production API deployed and healthy
- [ ] Mobile app uploaded to Play Store (internal testing)
- [ ] Admin dashboard deployed to Vercel
- [ ] All health endpoints passing
- [ ] Mock mode confirmed
- [ ] Monitoring enabled

### Launch Plan

1. **Invite 100 internal beta testers** via Google Play Console
2. **Enable Sentry monitoring** (optional for Stage 1)
3. **Set up daily metrics dashboard:**
   - Crash-free sessions (target: ≥99%)
   - Sync success rate (target: ≥99%)
   - P95 API latency (target: <400ms)
   - Error rate (target: <1%)
   - Support ticket backlog (target: <24h)

4. **Monitor for 7 days** before Stage 2 expansion

**Status:** ⏳ **PENDING AFTER ALL DEPLOYMENTS**

---

## Production URLs

| Service | URL | Status |
|---------|-----|--------|
| **Backend API** | `https://taxbridge-api.onrender.com` | ⏳ Deploying |
| **Worker** | Background (no URL) | ⏳ Deploying |
| **Redis** | Internal (Render private network) | ⏳ Starting |
| **Admin Dashboard** | `https://admin.taxbridge.ng` (Vercel) | ⏳ Pending |
| **Mobile App** | Google Play Store (Internal Testing) | ⏳ Pending |

---

## Rollback Plan

### If Critical Issue Detected

**Symptoms:**
- Error rate >5% sustained >10 minutes
- Crash-free rate <95%
- Data corruption detected
- Database connection failures

**Actions:**
1. **Immediate:** Stop new user onboarding
2. **Rollback mobile:** `eas update --branch production --message "Rollback"`
3. **Rollback backend:** Redeploy previous commit via Render dashboard
4. **Notify users:** In-app message + email
5. **Incident report:** Document root cause
6. **Fix + redeploy:** After remediation

---

## Monitoring & Alerts

### Render Dashboard

- **Metrics:** CPU, memory, response times
- **Logs:** Real-time log streaming
- **Alerts:** Configure email alerts for service downtime

### Sentry (Optional)

- **Error tracking:** Capture exceptions
- **Performance monitoring:** Track slow endpoints
- **Alerts:** Configure Slack/email notifications

### Google Play Console

- **Crash reports:** Android vitals
- **ANR rate:** Application not responding
- **Crash-free sessions:** Target ≥99%

---

## Success Criteria

### Day 0 (Deployment)

- [ ] Render deployment completed (all services "Live")
- [ ] Health endpoints return 200 (6/6)
- [ ] Database migrations applied (3 migrations)
- [ ] No critical errors in first 30 minutes

### Day 1-7 (Stage 1)

- [ ] Crash-free sessions ≥99%
- [ ] Sync success rate ≥99%
- [ ] P95 API latency <400ms
- [ ] Error rate <1%
- [ ] Support backlog <24h resolution

### Day 7 (Go/No-Go for Stage 2)

**If all metrics pass:** Proceed to Stage 2 (1,000 users)  
**If any metric fails:** Extend Stage 1, investigate, remediate

---

## Deployment Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| **Database Setup** | 5-10 min | ⏳ Pending |
| **Render Deployment** | 8-15 min | ⏳ Pending |
| **Database Migrations** | 2-3 min | ⏳ Pending |
| **Health Validation** | 5 min | ⏳ Pending |
| **Mobile Upload** | 10 min | ⏳ Pending |
| **Admin Deployment** | 5 min | ⏳ Pending |
| **Total Estimated Time** | **35-48 min** | - |

---

## Next Actions

### Immediate (Now)

1. **Create Supabase production database**
2. **Copy DATABASE_URL**
3. **Deploy Render Blueprint with all environment variables**
4. **Monitor deployment logs**

### After Deployment (10 min)

1. **Run database migrations**
2. **Validate all 6 health endpoints**
3. **Check for errors in Render logs**

### After Validation (20 min)

1. **Upload mobile AAB to Play Store**
2. **Deploy admin dashboard to Vercel**
3. **Invite 100 internal beta testers**

### Ongoing (7 days)

1. **Monitor crash-free rate daily**
2. **Track sync success rate**
3. **Collect user feedback**
4. **Iterate on reported issues**

---

## Conclusion

All pre-requisites for F6 production deployment are complete:
- ✅ Phase C UI polish (100% i18n coverage)
- ✅ Mobile build ready (Android AAB v5.0.2)
- ✅ Admin build ready (Next.js 16.1.1)
- ✅ Production secrets generated
- ✅ Deployment configuration updated

**Status:** 🟢 **READY TO DEPLOY**

**Recommendation:** Proceed with Render Blueprint deployment using the secrets and instructions above.

---

**Execution Log Version:** 1.0  
**Created:** January 20, 2026 at 3:15 AM UTC  
**Author:** TaxBridge Production Team
