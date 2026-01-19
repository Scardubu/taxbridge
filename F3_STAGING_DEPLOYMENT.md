# F3: Staging Deployment Execution Guide

**Status:** 🟡 READY TO EXECUTE  
**Estimated Time:** 20-30 minutes  
**Prerequisite:** F1-F2 ✅ Complete

---

## Pre-Flight Checklist

| Check | Status | Command |
|-------|--------|---------|
| Pre-production check | ✅ | `yarn workspace @taxbridge/backend preproduction:check` (37/37 passed) |
| Backend build | ✅ | `yarn workspace @taxbridge/backend build` (Prisma + TS) |
| Backend tests | ✅ | 68/68 passing |
| Mobile tests | ✅ | 139/139 passing |
| Admin tests | ✅ | 8/8 passing |
| Load tests aligned | ✅ | Endpoints corrected to `/api/v1/invoices` |

---

## Step 1: Create Staging Database (Supabase)

1. **Go to:** https://supabase.com/dashboard
2. **Create new project:**
   - Name: `taxbridge-staging`
   - Region: US West (Oregon) — matches Render
   - Database password: Generate strong password
3. **Copy connection string:**
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

---

## Step 2: Deploy to Render

### ⚠️ CRITICAL: You MUST use "New Blueprint Instance"

If you create a Render service manually (via "New Web Service"), Render will **ignore the blueprint file** and use its own defaults:
- Build: `yarn` 
- Start: `cd backend && yarn start`
- Node: v22.x

This causes `prisma: not found` and `MODULE_NOT_FOUND` errors.

### Option A: Render Dashboard — Blueprint Instance (Recommended)

1. **Go to:** https://dashboard.render.com/blueprints
2. **Click:** "New Blueprint Instance"
3. **Connect repository:**
   - Search for: `Scardubu/taxbridge`
   - Select the repo and authorize if prompted
4. **Blueprint file:** `render.staging.yaml` (auto-detected from repo)
5. **Branch:** `master`
6. **Set Secret Environment Variables** (marked `sync: false` in blueprint):

   | Variable | Value | Source |
   |----------|-------|--------|
   | `DATABASE_URL` | `postgresql://postgres.zdgbbbcjptygvwqufvoc:...@aws-1-eu-west-1.pooler.supabase.com:5432/postgres` | Supabase pooler |
   | `JWT_SECRET` | 64-char hex | RENDER_SECRETS.txt |
   | `JWT_REFRESH_SECRET` | 64-char hex | RENDER_SECRETS.txt |
   | `ENCRYPTION_KEY` | 64-char hex | RENDER_SECRETS.txt |
   | `SESSION_SECRET` | 64-char hex | RENDER_SECRETS.txt |
   | `WEBHOOK_SECRET` | 64-char hex | RENDER_SECRETS.txt |
   | `REMITA_WEBHOOK_SECRET` | 64-char hex | RENDER_SECRETS.txt |
   | `SENTRY_DSN` | (leave empty) | Optional |

7. **Click "Apply"** → Wait for build (~5-8 min)

**Verify Blueprint Applied:**
- Build logs should show: `yarn workspace @taxbridge/backend build`
- Start logs should show: `yarn workspace @taxbridge/backend start`
- Node version should be: `v20.19.4`

**Deployment Hardening (already configured in blueprint):**
- `PRISMA_SKIP_POSTINSTALL_GENERATE=true` prevents `prisma: not found` during install
- `PORT=3000` ensures health checks work
- Prisma CLI is in backend production dependencies as fallback

### Option B: Manual Service Update (if service already exists)

If you already created a service manually, update these settings:

1. **Go to:** Render Dashboard → Your Service → Settings
2. **Build Command:**
   ```
   yarn install --frozen-lockfile --production=false && yarn workspace @taxbridge/backend build && yarn workspace @taxbridge/backend ubl:download-xsd
   ```
   > **Note:** `prisma generate` is already run by `yarn workspace @taxbridge/backend build`.
3. **Start Command:**
   ```
   yarn workspace @taxbridge/backend start
   ```
4. **Environment → Add:**
   - `NODE_VERSION` = `20.19.4`
   - `PRISMA_SKIP_POSTINSTALL_GENERATE` = `true`
   - `PORT` = `3000`
5. **Manual Deploy** → Trigger new deploy

---

## Step 3: Run Database Migrations

After Render shows services as "Live":

```powershell
# SSH into Render service (via Dashboard > Shell)
# Or use local connection:

cd c:\Users\USR\Documents\taxbridge\backend

# Set DATABASE_URL to staging Supabase
# Recommended for migrations (direct connection + SSL)
$env:DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require"

# If the direct host is unreachable locally due to IPv6-only DNS, use the migration override:
#   $env:MIGRATION_DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
# Then run:
#   node backend/scripts/run-migrations.js
#
# Note: Supabase pooler transaction mode (6543) is intended for runtime queries, not Prisma migrations.

# Recommended (works locally + on Render, supports MIGRATION_DATABASE_URL override)
node scripts/run-migrations.js

# Or, if you're running from repo root:
#   node backend/scripts/run-migrations.js

# Verify status (dry run)
node scripts/run-migrations.js --dry-run
```

---

## Step 4: Validate Deployment

### 4.1 Health Check Validation

```powershell
# Replace with your actual staging URL
$STAGING_URL = "https://taxbridge-api-staging.onrender.com"

# Quick health validation
yarn workspace @taxbridge/backend validate:health $STAGING_URL

# Comprehensive staging validation (health + mock mode + API smoke tests)
yarn workspace @taxbridge/backend validate:staging $STAGING_URL
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

### 4.2 API Smoke Test

```powershell
# Basic auth test
Invoke-RestMethod -Uri "$STAGING_URL/health/live" -Method GET | ConvertTo-Json

# Dependency readiness check
Invoke-RestMethod -Uri "$STAGING_URL/health/ready" -Method GET | ConvertTo-Json

# API version check
Invoke-RestMethod -Uri "$STAGING_URL/api/v1/version" -Method GET | ConvertTo-Json
```

### 4.3 Quick Functional Test

```powershell
# Register test user
$body = @{
    email = "staging-test@taxbridge.ng"
    password = "StagingTest123!"
    businessName = "Staging Test Business"
    tin = "12345678-0001"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$STAGING_URL/api/v1/auth/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

---

## Step 5: Verify Mock Mode

Confirm integrations are in mock mode (staging should NOT hit real APIs):

```powershell
# Check DigiTax mock mode
Invoke-RestMethod -Uri "$STAGING_URL/health/digitax" | ConvertTo-Json
# Should show: "mode": "mock"

# Check Remita mock mode  
Invoke-RestMethod -Uri "$STAGING_URL/health/remita" | ConvertTo-Json
# Should show: "mode": "mock"
```

---

## Step 6: Update DNS (Optional)

If using custom staging domain:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | api-staging | taxbridge-api-staging.onrender.com | 300 |

---

## F3 Completion Checklist

After deployment, verify all items:

- [ ] Render services show "Live" status
- [ ] Health endpoint returns 200
- [ ] Database migrations applied successfully
- [ ] DigiTax mock mode confirmed
- [ ] Remita mock mode confirmed
- [ ] Redis connection working (check /health/queues)
- [ ] Test user registration succeeds
- [ ] ALLOWED_ORIGINS includes staging domains

---

## Staging URLs (After Deployment)

| Service | URL | Status |
|---------|-----|--------|
| API | `https://taxbridge-api-staging.onrender.com` | ⏳ |
| Worker | Background (no URL) | ⏳ |
| Redis | Internal | ⏳ |

---

## Troubleshooting

### Build Fails
```powershell
# Check Render logs
# Common issues:
# - yarn.lock mismatch: Run `yarn install` locally and commit
# - Missing env vars: Check all `sync: false` vars are set
```

### Database Connection Fails
```powershell
# Verify Supabase allows external connections
# Check connection string format
# Ensure SSL mode is correct for Supabase
```

### P1001 (Supabase Host Unreachable)
If the direct host (`db.<project-ref>.supabase.co`) resolves to IPv6 only and your network lacks IPv6 support:
- Run migrations from the Render shell (preferred for staging).
- Or use the Supabase pooler host (IPv4) with the correct pooler username format.

### Health Check Fails
```powershell
# Check Render logs for startup errors
# Verify PORT env var (Render sets automatically)
# Check ALLOWED_ORIGINS includes health check origin
```

---

## Next Step: F4 Load Testing

After F3 validation passes:

```powershell
cd c:\Users\USR\Documents\taxbridge

# Install k6 (if not installed)
winget install Grafana.k6

# Set the staging URL
$env:BASE_URL = "https://taxbridge-api-staging.onrender.com"

# Run all F4 tests (smoke → load → soak)
yarn workspace @taxbridge/backend test:load:f4

# Or run individually:
yarn workspace @taxbridge/backend test:load:smoke   # 5 min, 5 VUs
k6 run backend/load-test/k6-script.js              # 27 min, up to 150 VUs
k6 run backend/load-test/k6-soak.js                # 60 min, 50 VUs sustained
```

---

**Document Version:** 1.0  
**Created:** January 17, 2026  
**Author:** TaxBridge DevOps
