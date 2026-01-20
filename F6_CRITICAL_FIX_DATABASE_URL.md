# F6 Critical Fix — DATABASE_URL Malformation

**Date:** January 20, 2026  
**Status:** 🔴 **CRITICAL — FIX REQUIRED IN RENDER DASHBOARD**  
**Priority:** IMMEDIATE

---

## Issue Identified

The production deployment has a **malformed DATABASE_URL** that causes Prisma to interpret the query parameter as part of the database name.

### Error in Logs

```
Database `postgres&pgbouncer=true` does not exist on the database server at `aws-0-us-west-2.pooler.supabase.com:6543`
```

### Root Cause

**Wrong:** `postgresql://...@aws-0-us-west-2.pooler.supabase.com:6543/postgres&pgbouncer=true`  
**Correct:** `postgresql://...@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true`

The `&` should be `?` because it's the **first** query parameter. URL query strings start with `?`, and subsequent parameters are separated by `&`.

---

## ✅ Migrations Applied Successfully

Database migrations were run **locally** and applied successfully:

```
2 migrations found in prisma/migrations

Applying migration `20260106083801_add_ussd_sms`
Applying migration `20260106085514_add_sms_delivery`

All migrations have been successfully applied.
```

The database schema is now up-to-date.

---

## 🔴 Required Fix: Update DATABASE_URL in Render

### Step-by-Step Instructions

1. **Open Render Dashboard**
   - URL: https://dashboard.render.com/web/srv-d5np9lre5dus7398efig
   - Service: `taxbridge-api`

2. **Navigate to Environment Tab**
   - Click **Environment** in the left sidebar

3. **Edit DATABASE_URL**
   - Find `DATABASE_URL` in the list
   - Click **Edit** (pencil icon)
   - Change the value from:
     ```
     postgresql://postgres.etjzktvjnuolxtddlmfr:newleaF12666@aws-0-us-west-2.pooler.supabase.com:6543/postgres&pgbouncer=true
     ```
   - To:
     ```
     postgresql://postgres.etjzktvjnuolxtddlmfr:newleaF12666@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - **Key change:** Replace `&pgbouncer` with `?pgbouncer`

4. **Update DIRECT_URL**
   - Find `DIRECT_URL` in the list
   - Ensure it uses **port 5432** and **same region** (`us-west-2`):
     ```
     postgresql://postgres.etjzktvjnuolxtddlmfr:newleaF12666@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require
     ```

5. **Save Changes**
   - Click **Save Changes**
   - Wait for automatic redeploy (~2 minutes)

---

## Verification After Fix

### Expected Log Output (After Redeploy)

```json
{"level":"info","time":...,"component":"pool-metrics","msg":"Connection pool metrics","postgresActive":0,"postgresIdle":10,"postgresUtilization":0,"redisConnected":true,"redisReady":true}
```

The `postgresActive` and `postgresIdle` should show real numbers (not `-1`).

### Health Check Validation

Run in PowerShell:

```powershell
$PROD_URL = "https://taxbridge-api.onrender.com"
$checks = @("live","ready","db","queues","digitax","remita")
foreach ($check in $checks) {
    Write-Host "`n=== /health/$check ===" -ForegroundColor Cyan
    Invoke-RestMethod -Uri "$PROD_URL/health/$check" | ConvertTo-Json
}
```

**Success Criteria:**
- All 6 endpoints return HTTP 200
- `/health/db` shows real pool metrics
- No "database does not exist" errors in logs

---

## Current Health Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| `/health/live` | ✅ 200 | Working |
| `/health/ready` | ✅ 200 | DB + Redis healthy |
| `/health/db` | ✅ 200 | Latency: 12ms |
| `/health/queues` | ✅ 200 | BullMQ operational |
| `/health/digitax` | ⚠️ 503 | Needs investigation |
| `/health/remita` | ✅ 200 | Latency: 226ms |

---

## Summary

1. ✅ **Migrations applied** (2 migrations via local Prisma)
2. 🔴 **DATABASE_URL needs fix** (change `&` to `?` in Render)
3. ⚠️ **DigiTax health check** (returning 503, investigate mock mode)
4. ✅ **5/6 health endpoints passing**

**After fixing DATABASE_URL:** The "prepared statement already exists" warning should disappear, and connection pool metrics will show accurate values.

---

**Last Updated:** January 20, 2026 15:58 UTC
