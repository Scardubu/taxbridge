# TaxBridge V5 — Phase F DevOps Execution Checklist

**Version:** 5.0.4  
**Last Updated:** January 24, 2026  
**Status:** Production-Ready → Deployment  
**Lead:** DevOps + Engineering Team

---

## 📋 Executive Summary

This comprehensive checklist systematically guides the deployment of TaxBridge V5 from production-ready state to live operation across all surfaces (mobile, admin, backend, worker). All commands are PowerShell-optimized for Windows environments with fallback Bash commands where needed.

**Deployment Scope:**
- Backend API (Render.com)
- Worker Service (Render.com)
- Redis Cache (Render.com)
- Admin Dashboard (Vercel)
- Mobile App (Google Play Store Internal Testing)

**Estimated Total Time:** 2-3 hours (first deployment)

---

## 🎯 Pre-Flight Validation (15 minutes)

### PF-1: Verify Current System State

**Location:** Root directory

```powershell
# 1. Check Git status (should be clean or only docs changed)
git status

# 2. Verify current version
$mobileVersion = (Get-Content mobile/package.json | ConvertFrom-Json).version
$backendVersion = (Get-Content backend/package.json | ConvertFrom-Json).version
Write-Host "Mobile: $mobileVersion | Backend: $backendVersion" -ForegroundColor Cyan

# 3. Verify Node.js version (must be 20.x)
node --version  # Expected: v20.x.x

# 4. Verify Yarn version
yarn --version  # Expected: 1.22.x
```

**Validation Criteria:**
- [ ] Git working directory clean (or only documentation changes)
- [ ] Node.js 20.x installed
- [ ] Yarn 1.22.x installed
- [ ] Mobile version: 5.0.4
- [ ] Backend version: 5.0.2+

---

### PF-2: Run Pre-Production Check

```powershell
# Navigate to backend
cd backend

# Run comprehensive validation
node scripts/pre-production-check.js --verbose
```

**Expected Output:**
```
✅ 37/37 checks passed
📁 Required files: 5/5
🔐 Environment templates: 6/6
📐 Render blueprint: 6/6
🗄️ Prisma schema: 3/3
🏥 Health endpoints: 5/5
```

**Action on Failure:**
- Review failed checks
- Fix issues before proceeding
- Re-run validation

**Checklist:**
- [ ] All 37 checks passed
- [ ] No critical warnings

---

### PF-3: Verify Documentation Completeness

```powershell
# Check for required documents
$docs = @(
    "UI_SIGN_OFF_CHECKLIST.md",
    "PRODUCTION_READINESS_AUDIT.md",
    "PRODUCTION_READINESS_FINAL_SUMMARY.md",
    "PHASE_F_PRODUCTION_READINESS_GATE.md",
    "F6_DEPLOYMENT_EXECUTION_LOG.md"
)

foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "✅ $doc" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $doc" -ForegroundColor Red
    }
}
```

**Checklist:**
- [ ] All 5 core documents exist
- [ ] UI sign-off approved (UI_SIGN_OFF_CHECKLIST.md)
- [ ] Production readiness gate passed

---

## 🔐 F1: Production Secrets & Environment (30 minutes)

### F1-1: Generate Production Secrets

**Location:** `backend/scripts/`

```powershell
cd backend

# Generate all production secrets
node scripts/generate-secrets.js
```

**Expected Output:**
```
🔐 TaxBridge Production Secrets Generated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

JWT_SECRET=<64-char-hex>
JWT_REFRESH_SECRET=<64-char-hex>
ENCRYPTION_KEY=<64-char-hex>
SESSION_SECRET=<64-char-hex>
WEBHOOK_SECRET=<64-char-hex>
REMITA_WEBHOOK_SECRET=<64-char-hex>
DIGITAX_HMAC_SECRET=<64-char-hex>

⚠️  SAVE THESE SECRETS SECURELY - THEY CANNOT BE RECOVERED
```

**Action:**
1. Copy output to secure password manager (1Password, LastPass, Bitwarden)
2. Create separate entry for each secret
3. Tag as "TaxBridge Production Secrets"
4. **NEVER commit these to git**

**Checklist:**
- [ ] All 7 secrets generated
- [ ] Secrets saved to password manager
- [ ] Secrets NOT in clipboard/terminal history

---

### F1-2: Prepare Database (Supabase Production)

**Platform:** https://supabase.com/dashboard

#### Step 1: Create Production Database

1. Navigate to Supabase Dashboard
2. Click "New Project"
3. Configure:
   - **Name:** TaxBridge Production
   - **Database Password:** (generate strong password, save to password manager)
   - **Region:** US West 2 (closest to Render Oregon)
   - **Plan:** Pro ($25/mo - required for production)

4. Wait for provisioning (3-5 minutes)

#### Step 2: Capture Connection Strings

```powershell
# In Supabase Dashboard → Settings → Database

# Copy these values:
# 1. Connection Pooling (Transaction mode, port 6543) - for DATABASE_URL
# 2. Direct Connection (Session mode, port 5432) - for DIRECT_URL

# Save to password manager:
# - Key: TaxBridge Supabase DATABASE_URL
# - Key: TaxBridge Supabase DIRECT_URL
```

**Connection String Format:**
```
# DATABASE_URL (Pooler - Transaction Mode, Port 6543)
postgresql://postgres.PROJECT_REF:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres

# DIRECT_URL (Direct - Session Mode, Port 5432)
postgresql://postgres.PROJECT_REF:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres
```

**Checklist:**
- [ ] Production database created
- [ ] Database password saved
- [ ] DATABASE_URL captured (port 6543)
- [ ] DIRECT_URL captured (port 5432)

---

### F1-3: Prepare Redis (Render Managed)

**Note:** Redis is automatically created by Render Blueprint. No manual setup required.

**Checklist:**
- [ ] Confirmed Redis will be auto-provisioned

---

### F1-4: External Service Credentials

#### DigiTax / NRS Access Point

**For Stage 1:** Use Mock Mode

```powershell
# Stage 1 Configuration (Mock Mode)
DIGITAX_MOCK_MODE=true
DIGITAX_API_URL=https://api.digitax.ng
DUPLO_CLIENT_ID=placeholder_for_stage1
DUPLO_CLIENT_SECRET=placeholder_for_stage1
```

**For Stage 2+:** Contact DigiTax
- Email: support@digitax.ng
- Request: Production OAuth credentials
- Wait time: 3-5 business days

**Checklist (Stage 1):**
- [ ] Mock mode values prepared
- [ ] DigiTax production request ticket created (for Stage 2)

---

#### Remita Payment Gateway

**For Stage 1:** Use Mock Mode

```powershell
# Stage 1 Configuration (Mock Mode)
REMITA_MOCK_MODE=true
REMITA_MERCHANT_ID=placeholder_for_stage1
REMITA_API_KEY=placeholder_for_stage1
REMITA_SERVICE_TYPE_ID=placeholder_for_stage1
```

**For Stage 2+:** Contact Remita
- Email: developers@remita.net
- Request: Production API credentials
- Wait time: 5-7 business days

**Checklist (Stage 1):**
- [ ] Mock mode values prepared
- [ ] Remita production request ticket created (for Stage 2)

---

#### Africa's Talking (SMS/USSD)

**For Stage 1:** Optional (can use mock)

```powershell
# If not configuring yet:
AT_API_KEY=placeholder
AT_USERNAME=placeholder
AT_SHORTCODE=placeholder
```

**For Stage 2+:**
- Sign up: https://africastalking.com
- Activate Nigerian account
- Purchase SMS credits

**Checklist (Stage 1):**
- [ ] Placeholder values prepared
- [ ] Africa's Talking account created (optional)

---

### F1-5: Prepare Environment Variable List

**Create a text file (DO NOT COMMIT):** `production-secrets-staging-area.txt`

```env
# TaxBridge Production Environment Variables
# RENDER DASHBOARD ONLY - DO NOT COMMIT

# ============================================
# Node Environment
# ============================================
NODE_ENV=production
NODE_VERSION=20.19.4
PORT=3000
LOG_LEVEL=info

# ============================================
# Database (Supabase)
# ============================================
DATABASE_URL=<from Supabase - pooler port 6543>
DIRECT_URL=<from Supabase - direct port 5432>

# ============================================
# Redis (Auto-provisioned by Render)
# ============================================
# REDIS_URL is set automatically by Render

# ============================================
# Security Secrets (Generated)
# ============================================
JWT_SECRET=<from generate-secrets.js>
JWT_REFRESH_SECRET=<from generate-secrets.js>
ENCRYPTION_KEY=<from generate-secrets.js>
SESSION_SECRET=<from generate-secrets.js>
WEBHOOK_SECRET=<from generate-secrets.js>
REMITA_WEBHOOK_SECRET=<from generate-secrets.js>
DIGITAX_HMAC_SECRET=<from generate-secrets.js>

# ============================================
# DigiTax / NRS (Stage 1: Mock Mode)
# ============================================
DIGITAX_MOCK_MODE=true
DIGITAX_API_URL=https://api.digitax.ng
DUPLO_CLIENT_ID=placeholder_for_stage1
DUPLO_CLIENT_SECRET=placeholder_for_stage1

# ============================================
# Remita (Stage 1: Mock Mode)
# ============================================
REMITA_MOCK_MODE=true
REMITA_MERCHANT_ID=placeholder_for_stage1
REMITA_API_KEY=placeholder_for_stage1
REMITA_SERVICE_TYPE_ID=placeholder_for_stage1

# ============================================
# Africa's Talking (Optional Stage 1)
# ============================================
AT_API_KEY=placeholder
AT_USERNAME=placeholder
AT_SHORTCODE=placeholder

# ============================================
# CORS & URLs
# ============================================
ALLOWED_ORIGINS=https://taxbridge.vercel.app,https://admin.taxbridge.ng
FRONTEND_URL=https://taxbridge.vercel.app

# ============================================
# Optional: Sentry (Recommended)
# ============================================
SENTRY_DSN=<from sentry.io - optional for Stage 1>
SENTRY_ENVIRONMENT=production

# ============================================
# Prisma
# ============================================
PRISMA_SKIP_POSTINSTALL_GENERATE=true
```

**Checklist:**
- [ ] All secrets filled in
- [ ] File saved locally (not committed)
- [ ] File backed up to password manager

---

## 🏗️ F2: Backend Production Build (15 minutes)

### F2-1: Local Build Validation

```powershell
# Navigate to repo root
cd c:\Users\USR\Documents\taxbridge

# Clean previous builds
Remove-Item -Recurse -Force backend/dist -ErrorAction SilentlyContinue

# Install dependencies (if not already done)
yarn install --frozen-lockfile

# Build backend
yarn workspace @taxbridge/backend build
```

**Expected Output:**
```
✓ Prisma Client generated
✓ TypeScript compiled (0 errors)
✓ UBL XSD downloaded
✓ Static assets copied to dist/

Build complete: backend/dist/
```

**Validation:**
```powershell
# Check build artifacts
Test-Path backend/dist/src/server.js  # Should be True
Test-Path backend/dist/src/queue/index.js  # Should be True
```

**Checklist:**
- [ ] Build successful (0 TypeScript errors)
- [ ] `dist/src/server.js` exists
- [ ] `dist/src/queue/index.js` exists

---

### F2-2: Local Health Check Test

```powershell
# Set mock environment variables
$env:DATABASE_URL = "postgresql://localhost:5432/taxbridge_test"
$env:REDIS_URL = "redis://localhost:6380"
$env:JWT_SECRET = "test-secret-32-chars-long-1234"
$env:DIGITAX_MOCK_MODE = "true"
$env:REMITA_MOCK_MODE = "true"

# Start server locally (ctrl+c to stop after health check)
yarn workspace @taxbridge/backend start
```

**In another terminal:**
```powershell
# Test health endpoints
Invoke-RestMethod -Uri "http://localhost:3000/health/live" | ConvertTo-Json
```

**Expected:**
```json
{
  "status": "live",
  "env": "development",
  "uptime": 5
}
```

**Checklist:**
- [ ] Server starts without errors
- [ ] `/health/live` returns 200
- [ ] Stop server (Ctrl+C)

---

## 🚀 F3: Render Production Deployment (45 minutes)

### F3-1: Push Code to GitHub

```powershell
# Ensure all changes committed
git status

# If needed:
git add .
git commit -m "phase/F-production-deployment-ready"
git push origin master
```

**Checklist:**
- [ ] All code pushed to `master` branch
- [ ] No uncommitted changes

---

### F3-2: Deploy via Render Blueprint

**Platform:** https://dashboard.render.com

#### Step 1: Create Blueprint Instance

1. Navigate to: https://dashboard.render.com/blueprints
2. Click **"New Blueprint Instance"**
3. Configure:
   - **Repository:** Scardubu/taxbridge
   - **Branch:** master
   - **Blueprint File:** `render.yaml` (production)

#### Step 2: Configure Environment Variables

**In Render Dashboard, set these environment variables for `taxbridge-api` service:**

```
# Database
DATABASE_URL=<from Supabase pooler>
DIRECT_URL=<from Supabase direct>

# Security Secrets
JWT_SECRET=<from generate-secrets.js>
JWT_REFRESH_SECRET=<from generate-secrets.js>
ENCRYPTION_KEY=<from generate-secrets.js>
SESSION_SECRET=<from generate-secrets.js>
WEBHOOK_SECRET=<from generate-secrets.js>
REMITA_WEBHOOK_SECRET=<from generate-secrets.js>
DIGITAX_HMAC_SECRET=<from generate-secrets.js>

# DigiTax (Stage 1: Mock)
DIGITAX_MOCK_MODE=true
DUPLO_CLIENT_ID=placeholder_for_stage1
DUPLO_CLIENT_SECRET=placeholder_for_stage1

# Remita (Stage 1: Mock)
REMITA_MOCK_MODE=true
REMITA_MERCHANT_ID=placeholder_for_stage1
REMITA_API_KEY=placeholder_for_stage1
REMITA_SERVICE_TYPE_ID=placeholder_for_stage1

# Optional
SENTRY_DSN=<optional>
ALLOWED_ORIGINS=https://taxbridge.vercel.app
```

#### Step 3: Apply Blueprint

1. Click **"Apply"**
2. Wait for deployment (8-12 minutes)

**Monitor:**
- Build logs: Should show `yarn workspace @taxbridge/backend build`
- Start logs: Should show `Server listening on port 3000`

**Checklist:**
- [ ] Blueprint applied successfully
- [ ] Build logs show successful compilation
- [ ] Service status: "Live"

---

### F3-3: Run Database Migrations

**Platform:** Render Dashboard → Service → Shell

```bash
# In Render Shell (terminal in browser):
yarn workspace @taxbridge/backend prisma:migrate:deploy
```

**Expected Output:**
```
2 migrations found in prisma/migrations
✓ 20260106083801_add_ussd_sms applied (1.2s)
✓ 20260106085514_add_sms_delivery applied (0.8s)

All migrations have been successfully applied.
```

**Checklist:**
- [ ] 2 migrations applied successfully
- [ ] No migration errors

---

### F3-4: Validate Production Health

```powershell
$PROD_URL = "https://taxbridge-api.onrender.com"

# Test all 6 health endpoints
Write-Host "1. Liveness..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$PROD_URL/health/live" | ConvertTo-Json

Write-Host "`n2. Readiness..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$PROD_URL/health/ready" | ConvertTo-Json

Write-Host "`n3. Database..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$PROD_URL/health/db" | ConvertTo-Json

Write-Host "`n4. Queues..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$PROD_URL/health/queues" | ConvertTo-Json

Write-Host "`n5. DigiTax..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$PROD_URL/health/digitax" | ConvertTo-Json

Write-Host "`n6. Remita..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$PROD_URL/health/remita" | ConvertTo-Json
```

**Expected Results:**
- `/health/live`: `status: "live"`
- `/health/ready`: `status: "ready"`, `database: "healthy"`, `redis: "healthy"`
- `/health/db`: `status: "healthy"`, `latency: <50ms`
- `/health/queues`: `status: "healthy"`
- `/health/digitax`: `status: "healthy"`, `mode: "mock"`
- `/health/remita`: `status: "healthy"`, `mode: "mock"`

**Checklist:**
- [ ] All 6 endpoints return HTTP 200
- [ ] Mock mode confirmed (DigiTax + Remita)
- [ ] Database latency <100ms

---

## 📱 F4: Mobile App Distribution (30 minutes)

### F4-1: Build Production Android AAB

```powershell
cd mobile

# Login to Expo (if not already)
npx eas login

# Build production Android App Bundle
npx eas build --platform android --profile production
```

**Expected:**
```
✓ Build started
✓ Build ID: <build-id>
✓ Download: https://expo.dev/artifacts/eas/<build-id>.aab
```

**Wait Time:** 10-15 minutes

**Checklist:**
- [ ] Build completed successfully
- [ ] AAB download link captured

---

### F4-2: Download AAB

```powershell
# Download to local machine
$buildId = "<build-id-from-eas>"
$aabUrl = "https://expo.dev/artifacts/eas/$buildId.aab"

Invoke-WebRequest -Uri $aabUrl -OutFile "$env:USERPROFILE\Downloads\taxbridge-v5.0.4-production.aab"
```

**Checklist:**
- [ ] AAB downloaded to Downloads folder

---

### F4-3: Upload to Google Play Console

**Platform:** https://play.google.com/console

1. Navigate to: **Create App** (if first time) or **Select App**
2. Go to: **Release → Testing → Internal Testing**
3. Click: **Create New Release**
4. Upload: `taxbridge-v5.0.4-production.aab`
5. **Release Notes:**
   ```
   TaxBridge V5.0.4 - Production Release

   New Features:
   - Full Nigerian Pidgin localization
   - Offline-first invoice creation
   - Improved sync reliability
   - Enhanced header layout

   Bug Fixes:
   - Fixed button visibility in create invoice screen
   - Fixed logo overlap in header
   - Improved splash screen configuration

   Technical:
   - Production backend integration
   - Mock mode for DigiTax/Remita (Stage 1)
   ```
6. Click: **Review Release** → **Start Rollout to Internal Testing**

**Checklist:**
- [ ] AAB uploaded successfully
- [ ] Release notes added
- [ ] Release rolled out to internal testing

---

### F4-4: Add Internal Testers

1. In Play Console: **Testing → Internal Testing → Testers**
2. Create email list: `taxbridge-beta-testers@googlegroups.com` (or manual list)
3. Add 100 testers
4. Save

**Checklist:**
- [ ] 100 testers added
- [ ] Opt-in link copied

---

## 🖥️ F5: Admin Dashboard Deployment (15 minutes)

### F5-1: Deploy to Vercel

**Platform:** https://vercel.com/dashboard

#### Option A: Via Vercel Dashboard

1. Navigate to: https://vercel.com/new
2. Import repository: `Scardubu/taxbridge`
3. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `admin-dashboard`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
4. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://taxbridge-api.onrender.com
   NEXT_PUBLIC_ENV=production
   ```
5. Click: **Deploy**

#### Option B: Via CLI

```powershell
cd admin-dashboard

# Install Vercel CLI (if not already)
npm install -g vercel

# Deploy
vercel --prod
```

**Checklist:**
- [ ] Deployment successful
- [ ] Production URL: https://taxbridge.vercel.app
- [ ] Dashboard loads correctly

---

### F5-2: Validate Admin Dashboard

```powershell
# Test production URL
Invoke-WebRequest -Uri "https://taxbridge.vercel.app" | Select-Object StatusCode
# Expected: 200

# Open in browser
Start-Process "https://taxbridge.vercel.app"
```

**Manual Validation:**
- [ ] Dashboard loads without errors
- [ ] System Health widget shows green
- [ ] Launch Metrics widget displays correctly
- [ ] No console errors (F12 DevTools)

**Checklist:**
- [ ] Admin dashboard live
- [ ] API connectivity verified
- [ ] No visual/functional issues

---

## 📊 F6: Monitoring & Observability (20 minutes)

### F6-1: Set Up Uptime Monitoring

**Option A: UptimeRobot (Free)**

1. Sign up: https://uptimerobot.com
2. Create monitors:
   - **Name:** TaxBridge API - Liveness
   - **URL:** https://taxbridge-api.onrender.com/health/live
   - **Interval:** 5 minutes
   - **Alert:** Email

   - **Name:** TaxBridge API - Database
   - **URL:** https://taxbridge-api.onrender.com/health/db
   - **Interval:** 5 minutes
   - **Alert:** Email

   - **Name:** TaxBridge Admin Dashboard
   - **URL:** https://taxbridge.vercel.app
   - **Interval:** 5 minutes
   - **Alert:** Email

**Checklist:**
- [ ] 3 monitors created
- [ ] Email alerts configured
- [ ] Test alert triggered

---

### F6-2: Configure Sentry (Optional but Recommended)

**Platform:** https://sentry.io

1. Create account (if needed)
2. Create project: **TaxBridge Backend**
3. Copy DSN
4. Add to Render environment variables:
   ```
   SENTRY_DSN=<from sentry.io>
   SENTRY_ENVIRONMENT=production
   ```
5. Redeploy Render service

**Test:**
```powershell
# Trigger test error (if endpoint exists)
Invoke-RestMethod -Uri "https://taxbridge-api.onrender.com/test-sentry-error"
```

**Checklist:**
- [ ] Sentry project created
- [ ] DSN configured in Render
- [ ] Test error reported to Sentry

---

### F6-3: Set Up Daily Health Check Script

**Create:** `monitoring\health-monitor.ps1`

```powershell
# TaxBridge Production Health Monitor
# Run: .\monitoring\health-monitor.ps1 -Verbose

param(
    [switch]$Verbose
)

$PROD_URL = "https://taxbridge-api.onrender.com"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "`n🔍 TaxBridge Health Check - $timestamp`n" -ForegroundColor Cyan

$endpoints = @(
    @{Name="Liveness"; Path="/health/live"},
    @{Name="Readiness"; Path="/health/ready"},
    @{Name="Database"; Path="/health/db"},
    @{Name="Queues"; Path="/health/queues"},
    @{Name="DigiTax"; Path="/health/digitax"},
    @{Name="Remita"; Path="/health/remita"}
)

$allHealthy = $true

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-RestMethod -Uri "$PROD_URL$($endpoint.Path)" -TimeoutSec 10
        if ($response.status -match "live|ready|healthy") {
            Write-Host "✅ $($endpoint.Name): Healthy" -ForegroundColor Green
            if ($Verbose) {
                Write-Host "   $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
            }
        } else {
            Write-Host "⚠️  $($endpoint.Name): Degraded" -ForegroundColor Yellow
            $allHealthy = $false
        }
    } catch {
        Write-Host "❌ $($endpoint.Name): Failed" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        $allHealthy = $false
    }
}

if ($allHealthy) {
    Write-Host "`n✅ All systems operational`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ Some systems degraded - investigate immediately`n" -ForegroundColor Red
    exit 1
}
```

**Schedule (Windows Task Scheduler):**
1. Open Task Scheduler
2. Create Basic Task: "TaxBridge Health Check"
3. Trigger: Daily at 9:00 AM and 5:00 PM WAT
4. Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-File C:\Users\USR\Documents\taxbridge\monitoring\health-monitor.ps1 -Verbose`
5. Save

**Checklist:**
- [ ] Script created
- [ ] Manual test successful
- [ ] Scheduled task created

---

## ✅ F7: Post-Deployment Validation (30 minutes)

### F7-1: End-to-End Flow Test

**Prerequisites:**
- Internal tester email added to Play Store
- Mobile app installed on Android device

#### Test Scenario 1: User Registration

1. Open TaxBridge app
2. Complete onboarding flow
3. Register with phone number
4. Verify OTP (if SMS enabled)
5. Complete profile setup

**Checklist:**
- [ ] Onboarding completes without errors
- [ ] Registration successful
- [ ] Profile saved to backend

---

#### Test Scenario 2: Offline Invoice Creation

1. Enable airplane mode
2. Create new invoice:
   - Add customer details
   - Add line items
   - Calculate tax
3. Save invoice
4. Disable airplane mode
5. Trigger manual sync

**Expected:**
- Invoice saved locally
- Sync queue shows 1 pending
- After reconnect, invoice syncs to backend

**Checklist:**
- [ ] Invoice created offline
- [ ] Invoice synced successfully
- [ ] Invoice visible in admin dashboard

---

#### Test Scenario 3: Admin Dashboard Oversight

1. Open admin dashboard
2. Verify system health widget
3. Check launch metrics
4. Verify invoice appears in list (if implemented)

**Checklist:**
- [ ] Dashboard loads correctly
- [ ] System health shows "All Operational"
- [ ] Metrics display correctly

---

### F7-2: Performance Validation

```powershell
# Run k6 smoke test against production
cd backend/load-test

# Install k6 (if not already)
# Download from: https://k6.io/docs/get-started/installation/

# Run smoke test (reduced load for production)
k6 run --duration 30s --vus 2 k6-smoke-production.js
```

**Expected Metrics:**
- Success rate: >99%
- P95 latency: <500ms
- Error rate: <1%

**Checklist:**
- [ ] Smoke test passed
- [ ] No critical errors

---

### F7-3: Security Validation

```powershell
# Test CORS configuration
Invoke-WebRequest -Uri "https://taxbridge-api.onrender.com/health" `
  -Headers @{Origin="https://malicious-site.com"} `
  -Method OPTIONS

# Should return 403 or no Access-Control-Allow-Origin header
```

**Checklist:**
- [ ] CORS blocks unauthorized origins
- [ ] HTTPS enforced (no HTTP redirect)
- [ ] No secrets exposed in error messages

---

### F7-4: Rollback Plan Validation

**Create:** `rollback-plan.md`

```markdown
# TaxBridge Rollback Plan

## Trigger Conditions
- Crash rate >5%
- Data corruption detected
- Critical security vulnerability
- Sync failure rate >20%

## Rollback Steps

### Backend (Render)
1. Go to Render Dashboard → taxbridge-api
2. Click "Manual Deploy"
3. Select previous commit: <commit-hash>
4. Deploy
5. Wait 2-3 minutes
6. Validate health endpoints

### Admin Dashboard (Vercel)
1. Go to Vercel Dashboard → taxbridge
2. Click "Deployments"
3. Find previous deployment
4. Click "Promote to Production"

### Mobile (Play Store)
1. Cannot rollback app bundle
2. Release hotfix version via EAS Update:
   ```bash
   cd mobile
   npx eas update --branch production --message "Hotfix: Rollback critical issue"
   ```

## Communication Plan
- Email all 100 internal testers
- Slack notification to #taxbridge-alerts
- Post-mortem document within 24 hours
```

**Checklist:**
- [ ] Rollback plan documented
- [ ] Previous commit hash saved
- [ ] Communication templates prepared

---

## 📝 F8: Documentation Finalization (15 minutes)

### F8-1: Update CHANGELOG

```powershell
# Edit CHANGELOG.md
code CHANGELOG.md
```

**Add:**
```markdown
## [5.0.4] - 2026-01-24

### Production Deployment
- ✅ Backend API deployed to Render (https://taxbridge-api.onrender.com)
- ✅ Admin dashboard deployed to Vercel (https://taxbridge.vercel.app)
- ✅ Mobile app published to Play Store (Internal Testing)
- ✅ Database migrations applied (2 migrations)
- ✅ Health monitoring configured (UptimeRobot)

### Features
- Full i18n support (English + Nigerian Pidgin)
- Offline-first invoice creation
- Enhanced header layout with trust badges
- Splash screen configuration

### Infrastructure
- Mock mode enabled for DigiTax + Remita (Stage 1)
- Supabase production database
- Render managed Redis
- Sentry error tracking

### Known Limitations (Stage 1)
- DigiTax integration in mock mode
- Remita integration in mock mode
- Limited to 100 internal testers
```

**Checklist:**
- [ ] CHANGELOG updated
- [ ] Version 5.0.4 documented

---

### F8-2: Update README.md

```powershell
code README.md
```

**Update Production URLs:**
```markdown
## Production URLs

- **Backend API:** https://taxbridge-api.onrender.com
- **Admin Dashboard:** https://taxbridge.vercel.app
- **Mobile App:** Google Play Store (Internal Testing)

## Status

✅ **PRODUCTION LIVE** (Stage 1: 100 users)

Last Deployment: January 24, 2026
```

**Checklist:**
- [ ] README updated
- [ ] Production URLs added

---

### F8-3: Create Deployment Evidence Document

**Create:** `DEPLOYMENT_EVIDENCE_F_PHASE.md`

```markdown
# Phase F Production Deployment Evidence

**Date:** January 24, 2026
**Version:** 5.0.4
**Status:** ✅ COMPLETE

## Deployment Summary

### Backend API
- **URL:** https://taxbridge-api.onrender.com
- **Status:** Live
- **Build ID:** <from Render>
- **Deployment Time:** <timestamp>
- **Health Checks:** 6/6 passing

### Admin Dashboard
- **URL:** https://taxbridge.vercel.app
- **Status:** Live
- **Build ID:** <from Vercel>
- **Deployment Time:** <timestamp>

### Mobile App
- **Build:** Android AAB v5.0.4
- **Distribution:** Google Play (Internal Testing)
- **Testers:** 100
- **Download Link:** <Play Store link>

## Validation Results

### Health Endpoints
- [x] /health/live - 200 OK
- [x] /health/ready - 200 OK
- [x] /health/db - 200 OK (latency: <50ms)
- [x] /health/queues - 200 OK
- [x] /health/digitax - 200 OK (mock mode)
- [x] /health/remita - 200 OK (mock mode)

### Database Migrations
- [x] 2 migrations applied successfully
- [x] Schema version: <latest>

### Monitoring
- [x] UptimeRobot configured (3 monitors)
- [x] Sentry error tracking enabled
- [x] Daily health check script scheduled

## Next Steps (Stage 2 Preparation)

1. Collect feedback from 100 testers (7 days)
2. Configure real DigiTax credentials
3. Configure real Remita credentials
4. Expand to 1,000 users
```

**Checklist:**
- [ ] Evidence document created
- [ ] All sections filled with actual values

---

## 🎯 Success Criteria Validation

### Critical (Must Pass)

- [ ] Backend API responding (6/6 health checks)
- [ ] Database migrations applied (2/2)
- [ ] Admin dashboard accessible
- [ ] Mobile app distributed (100 testers)
- [ ] Mock mode confirmed (DigiTax + Remita)
- [ ] No critical errors in first 1 hour

### Important (Should Pass)

- [ ] All endpoints <500ms P95 latency
- [ ] Uptime monitoring configured
- [ ] Sentry error tracking enabled
- [ ] Rollback plan documented
- [ ] CHANGELOG updated

### Nice to Have (Optional)

- [ ] Grafana dashboards (deferred to Stage 2)
- [ ] Prometheus metrics (deferred to Stage 2)
- [ ] Slack webhooks (optional for Stage 1)

---

## 🚨 Incident Response

### P0 (Critical - Immediate Response)

**Triggers:**
- All health endpoints failing
- Database connection lost
- Crash rate >10%
- Data corruption detected

**Actions:**
1. Execute rollback plan immediately
2. Post to #taxbridge-alerts Slack channel
3. Email all stakeholders
4. Begin post-mortem investigation

### P1 (High - 2 Hour Response)

**Triggers:**
- Single health endpoint failing
- Sync failure rate >20%
- Error rate >5%
- Latency P95 >1000ms

**Actions:**
1. Investigate root cause
2. Deploy hotfix if identified
3. Monitor for 1 hour
4. Escalate to P0 if worsens

### P2 (Medium - 24 Hour Response)

**Triggers:**
- Minor UI issues
- Non-critical feature degraded
- Performance degradation (but <1000ms)

**Actions:**
1. Create Jira ticket
2. Schedule fix for next sprint
3. Document in known issues

---

## 📞 Contact & Escalation

### On-Call Rotation (Stage 1)

**Primary:** <Name> - <Email> - <Phone>  
**Secondary:** <Name> - <Email> - <Phone>

### Escalation Path

1. **On-Call Engineer** (P0/P1)
2. **Tech Lead** (if unresolved in 1 hour)
3. **CTO** (if unresolved in 4 hours or data loss)

---

## ✅ Final Deployment Checklist

### Pre-Deployment
- [ ] All code pushed to master
- [ ] Pre-production check passed (37/37)
- [ ] UI sign-off approved
- [ ] Production secrets generated
- [ ] Database created (Supabase)
- [ ] Environment variables prepared

### Backend Deployment
- [ ] Render blueprint deployed
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] All 6 health endpoints passing
- [ ] Worker service operational

### Mobile Deployment
- [ ] Production AAB built
- [ ] AAB uploaded to Play Store
- [ ] 100 internal testers added
- [ ] Release notes published

### Admin Deployment
- [ ] Vercel deployment successful
- [ ] Environment variables configured
- [ ] Dashboard loads correctly
- [ ] API connectivity verified

### Monitoring
- [ ] UptimeRobot monitors created
- [ ] Sentry error tracking enabled
- [ ] Daily health check scheduled
- [ ] Rollback plan documented

### Documentation
- [ ] CHANGELOG updated
- [ ] README updated
- [ ] Deployment evidence created
- [ ] Known issues documented

---

## 🎉 Deployment Complete

**Congratulations! TaxBridge V5 is now in production.**

### Immediate Next Steps (First 24 Hours)

1. Monitor health endpoints every 30 minutes
2. Check Sentry for error reports
3. Respond to tester feedback within 4 hours
4. Track daily active users (DAU)
5. Prepare daily status report

### Stage 1 Success Metrics (7 Days)

- Crash-free rate: ≥99%
- Sync success rate: ≥99%
- P95 latency: <400ms
- Error rate: <1%
- Daily active users: ≥70 (70% of 100 testers)

**Next Gate:** Stage 2 (1,000 Users) - After successful 7-day validation

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026  
**Prepared By:** TaxBridge DevOps Team
