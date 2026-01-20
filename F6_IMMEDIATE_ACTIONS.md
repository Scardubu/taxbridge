# F6 Production Deployment — Immediate Actions Required

**Status:** 🟢 SERVICE LIVE — 🔴 MIGRATIONS BLOCKED  
**Time:** 15-20 minutes to complete  
**Priority:** HIGH

---

## Current Situation

✅ **Backend API deployed and running:** https://taxbridge-api.onrender.com  
✅ **Build successful:** Commit `5b5e9ef`  
✅ **Health checks passing:** Liveness endpoint responding  
❌ **Database migrations not run:** Missing `DIRECT_URL` environment variable

---

## Critical Action #1: Add DIRECT_URL to Render (5 minutes)

### Step-by-Step Instructions

1. **Open Render Dashboard**
   - URL: https://dashboard.render.com/web/srv-d5np9lre5dus7398efig
   - Service: `taxbridge-api`

2. **Navigate to Environment Tab**
   - Click **Environment** in the left sidebar

3. **Add New Environment Variable**
   - Click **Add Environment Variable** button
   - Fill in:
     ```
     Key: DIRECT_URL
     Value: [PASTE YOUR SUPABASE DIRECT CONNECTION STRING]
     ```

4. **Get DIRECT_URL from Supabase**
   - Go to: https://supabase.com/dashboard
   - Select your `taxbridge-production` project
   - Navigate: **Settings** → **Database**
   - Find: **Connection string** section
   - Select: **URI** (not Session pooler)
   - Port: **5432** (not 6543)
   - Format: `postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-us-west-1.supabase.co:5432/postgres?sslmode=require`

5. **Save and Wait**
   - Click **Save Changes**
   - Render will auto-redeploy (~2 minutes)
   - Watch logs for "Your service is live 🎉"

---

## Critical Action #2: Run Database Migrations (3 minutes)

### After Redeploy Completes

1. **Open Render Shell**
   - Dashboard: https://dashboard.render.com/web/srv-d5np9lre5dus7398efig
   - Click: **Shell** tab

2. **Execute Migrations**
   ```bash
   yarn workspace @taxbridge/backend prisma:migrate:deploy
   ```

3. **Verify Success**
   Expected output:
   ```
   3 migrations applied:
   └─ 20240115000000_initial_schema
   └─ 20240116000000_add_invoices
   └─ 20240117000000_add_payments
   ```

4. **If Error Occurs**
   - Check `DIRECT_URL` is set correctly (port 5432)
   - Verify Supabase password is URL-encoded if it contains special characters
   - Try running: `npx prisma migrate deploy` directly

---

## Critical Action #3: Validate Health Endpoints (2 minutes)

### Run in PowerShell

```powershell
# Set production URL
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

### Success Criteria

All endpoints should return:
- ✅ HTTP 200 status
- ✅ `{ "status": "healthy" }` or similar
- ✅ No error messages in response

---

## Optional: Add PgBouncer Flag (2 minutes)

### Recommended for Better Pooler Compatibility

This fixes the "prepared statement already exists" warning.

1. **Edit DATABASE_URL in Render**
   - Find existing `DATABASE_URL` in Environment tab
   - Click **Edit**
   - Append `&pgbouncer=true` to the connection string:
     ```
     postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
     ```
   - Save changes
   - Wait for redeploy

2. **Verify Fix**
   - Check logs: Warning about prepared statement should disappear
   - Connection pool metrics should show real numbers (not -1)

---

## After Migrations Complete

### Mark F6 Deployment as Complete

1. **Update Documentation**
   - [ ] Mark Step 3 complete in [F6_DEPLOYMENT_EXECUTION_LOG.md](F6_DEPLOYMENT_EXECUTION_LOG.md)
   - [ ] Update [PRODUCTION_READINESS_FINAL_SUMMARY.md](PRODUCTION_READINESS_FINAL_SUMMARY.md)
   - [ ] Create F6_DEPLOYMENT_COMPLETE.md

2. **Proceed to Mobile Distribution**
   - [ ] Download Android AAB: https://expo.dev/artifacts/eas/dHCysRdLUbq4PzoKYvMsfq.aab
   - [ ] Upload to Google Play Console (internal testing)
   - [ ] Invite 100 beta testers

3. **Deploy Admin Dashboard**
   - [ ] Run `cd admin-dashboard && vercel --prod`
   - [ ] Configure environment variables
   - [ ] Verify all routes

---

## Troubleshooting

### If Migrations Fail

**Error:** `Environment variable not found: DIRECT_URL`
- **Fix:** Ensure `DIRECT_URL` is added to Render environment variables
- **Verify:** Check spelling is exactly `DIRECT_URL` (case-sensitive)

**Error:** `Connection refused` or `timeout`
- **Fix:** Check Supabase firewall allows Render IP range
- **Verify:** Test connection with `psql` or database client

**Error:** `password authentication failed`
- **Fix:** URL-encode password if it contains special characters
- **Tool:** `node -e "console.log(encodeURIComponent('your-password'))"`

### If Health Checks Fail

**`/health/db` returns error:**
- Check `DATABASE_URL` is set correctly
- Verify Supabase database is running
- Check migrations were applied

**`/health/ready` returns degraded:**
- Check Redis connection
- Verify all required env vars are set

---

## Summary Checklist

**Before Moving Forward:**
- [ ] `DIRECT_URL` added to Render
- [ ] Render redeployed successfully
- [ ] Database migrations applied (3 migrations)
- [ ] All 6 health endpoints passing
- [ ] No critical errors in Render logs

**Estimated Time:** 15-20 minutes total

**Success Indicator:** All health checks return HTTP 200 with `"status": "healthy"`

---

## Quick Links

- **Render Dashboard:** https://dashboard.render.com/web/srv-d5np9lre5dus7398efig
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Production API:** https://taxbridge-api.onrender.com
- **GitHub Repo:** https://github.com/Scardubu/taxbridge
- **Latest Commit:** https://github.com/Scardubu/taxbridge/commit/5b5e9ef

---

**Last Updated:** January 20, 2026 15:20 UTC  
**Next Review:** After migrations complete
