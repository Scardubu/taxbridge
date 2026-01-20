# Render Database URL Optimization Guide

**Date:** January 20, 2026  
**Status:** ⚠️ **OPTIONAL (NON-BLOCKING)**  
**Priority:** Low (Production is stable without these fixes)

---

## Overview

The production backend is **fully operational** with all health checks passing. However, two Render environment variables have minor misconfigurations that don't affect runtime but can be optimized for future operations:

1. **DATABASE_URL** query string syntax (affects pool metrics logging)
2. **DIRECT_URL** region mismatch (affects running migrations from Render Shell)

**Current Status:**
- ✅ Production API: LIVE and stable
- ✅ All 6 health endpoints: Passing
- ✅ Database migrations: Applied successfully (via local Prisma)
- ✅ Worker & Redis: Operational
- ⚠️ Prepared statement warning: Minor (non-critical)
- ⚠️ Render Shell migrations: Blocked by region mismatch

---

## Issue 1: DATABASE_URL Query String Syntax

### Problem

**Current Value (in Render):**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres&pgbouncer=true
```

**Issue:** The `&` should be `?` because it's the **first query parameter**.

**Impact:**
- ⚠️ Prisma logs a warning: `prepared statement "s0" already exists`
- ⚠️ Connection pool metrics show `-1` (unavailable) instead of actual numbers
- ✅ Application **still works correctly** (non-blocking)

**Expected Value:**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Why Fix:**
- Removes harmless but noisy log warnings
- Enables proper connection pool metrics in logs
- Aligns with PostgreSQL connection string best practices

---

### Fix Instructions (5 minutes)

#### Step 1: Open Render Dashboard

1. **Navigate to:** https://dashboard.render.com/web/srv-d5np9lre5dus7398efig
2. **Click:** "Environment" tab in the left sidebar

#### Step 2: Edit DATABASE_URL

1. **Locate** `DATABASE_URL` in the environment variables list
2. **Click** the pencil icon (Edit) next to DATABASE_URL
3. **Current value format:**
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres&pgbouncer=true
   ```

4. **Change to:** (replace `&pgbouncer` with `?pgbouncer`)
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

5. **Verify:**
   - Database name is still `postgres` (before the `?`)
   - Query parameter starts with `?` (not `&`)
   - No extra spaces or characters

6. **Click:** "Save Changes"

#### Step 3: Wait for Auto-Redeploy

- Render will automatically redeploy the service (~2 minutes)
- Monitor: Events tab shows "Deploying..."
- Wait for: "Live" status to return

#### Step 4: Verify Fix

**Run health check:**

```powershell
$PROD_URL = "https://taxbridge-api.onrender.com"
Invoke-RestMethod -Uri "$PROD_URL/health/db" | ConvertTo-Json
```

**Expected result:**
```json
{
  "status": "healthy",
  "latency": "15ms",
  "pool": {
    "active": 0,
    "idle": 10,
    "utilization": 0
  }
}
```

**Success indicators:**
- `active` and `idle` show **real numbers** (not `-1`)
- Log warnings about prepared statements should disappear

**Check Render logs:**

```
# Before fix (warning present)
{"level":"warn","message":"prepared statement 's0' already exists"}
{"postgresActive":-1,"postgresIdle":-1}

# After fix (clean)
{"postgresActive":0,"postgresIdle":10,"postgresUtilization":0}
```

---

## Issue 2: DIRECT_URL Region Mismatch

### Problem

**Current DIRECT_URL (in Render):**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-1.supabase.co:5432/postgres?sslmode=require
```

**Issue:** Points to **us-west-1**, but the actual Supabase database is in **us-west-2**.

**Impact:**
- ✅ Runtime operations work fine (they use pooler, not DIRECT_URL)
- ❌ Running migrations from Render Shell fails with connection timeout
- ✅ Migrations via **local Prisma** work (we've been using this workaround)

**Expected Value:**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require
```

**Why Fix:**
- Enables running migrations directly from Render Shell (useful for future deployments)
- Removes need for local migration workaround
- Ensures correct region targeting for direct connections

---

### Fix Instructions (5 minutes)

#### Step 1: Get Correct Supabase Region

1. **Go to:** https://supabase.com/dashboard
2. **Select:** taxbridge-production project
3. **Navigate to:** Settings → Database
4. **Find:** Connection string section
5. **Note the region** in the hostname (should be `us-west-2`)

**Example:**
```
Host: aws-0-us-west-2.pooler.supabase.com
```

#### Step 2: Edit DIRECT_URL in Render

1. **Navigate to:** https://dashboard.render.com/web/srv-d5np9lre5dus7398efig
2. **Click:** "Environment" tab
3. **Locate:** `DIRECT_URL` in the environment variables list
4. **Click:** Edit (pencil icon)

5. **Current value (WRONG region):**
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-1.supabase.co:5432/postgres?sslmode=require
   ```

6. **New value (CORRECT region):**
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require
   ```

   **Changes:**
   - `us-west-1` → `us-west-2`
   - `supabase.co` → `pooler.supabase.com` (use pooler for consistency)

7. **Verify:**
   - Port is `5432` (direct connection, not `6543` pooler)
   - Query parameter is `?sslmode=require`
   - Region matches your Supabase project

8. **Click:** "Save Changes"

#### Step 3: Wait for Auto-Redeploy

- Same as Issue 1: ~2 minute redeploy
- Monitor via Events tab

#### Step 4: Verify Fix (Optional)

**Test migration command from Render Shell:**

1. **Go to:** https://dashboard.render.com/web/srv-d5np9lre5dus7398efig
2. **Click:** "Shell" tab
3. **Run:**
   ```bash
   echo "Testing DIRECT_URL connection..."
   yarn workspace @taxbridge/backend prisma migrate status
   ```

**Expected output:**
```
Status: All migrations have been applied
```

**If successful:**
- Future migrations can be run directly from Render Shell
- No need to use local Prisma workaround

---

## Summary: Should You Apply These Fixes?

### Recommendation Matrix

| Scenario | DATABASE_URL Fix | DIRECT_URL Fix | Priority |
|----------|------------------|----------------|----------|
| **Production is stable, no issues** | Optional | Optional | Low |
| **Planning Stage 2 (1,000 users)** | Recommended | Recommended | Medium |
| **Seeing log warnings** | Recommended | Optional | Medium |
| **Need to run migrations from Render** | Optional | Required | High |
| **Preparing for investor demo** | Recommended | Recommended | Medium |

### Time Investment vs. Benefit

| Fix | Time Required | Benefit | Risk |
|-----|---------------|---------|------|
| **DATABASE_URL** | 5 minutes | Clean logs, pool metrics | Very Low (tested in staging) |
| **DIRECT_URL** | 5 minutes | Render Shell migrations | Very Low (affects migrations only) |
| **Both** | 10 minutes | Future-proofing | Very Low |

---

## Alternative: Leave As-Is

**If you choose NOT to fix:**

✅ **Production remains stable**  
✅ **All functionality works**  
✅ **No user impact**  
⚠️ **Log warnings persist** (cosmetic only)  
⚠️ **Migrations require local Prisma** (minor inconvenience)

**You can safely defer these fixes to:**
- After Stage 1 completes
- Before Stage 2 launch
- During next maintenance window
- Never (if not bothered by warnings)

---

## Full Fix Script (PowerShell)

**For reference only — manual fix in Render Dashboard is recommended.**

```powershell
# This is a reference script showing the correct values.
# You MUST manually update these in Render Dashboard.

# Issue 1: DATABASE_URL (Change & to ?)
$DATABASE_URL = "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Issue 2: DIRECT_URL (Change us-west-1 to us-west-2)
$DIRECT_URL = "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"

Write-Host "✅ Copy these values to Render Dashboard:" -ForegroundColor Green
Write-Host "   DATABASE_URL: $DATABASE_URL" -ForegroundColor Yellow
Write-Host "   DIRECT_URL: $DIRECT_URL" -ForegroundColor Yellow
Write-Host "`n⚠️  Remember to replace [PROJECT_REF] and [PASSWORD] with actual values!" -ForegroundColor Red
```

---

## Verification Checklist

**After applying fixes:**

### DATABASE_URL Fix
- [ ] Query string starts with `?` (not `&`)
- [ ] Redeploy completed successfully
- [ ] Health check shows real pool metrics (not `-1`)
- [ ] Log warnings about prepared statements disappeared
- [ ] Application still stable (no regressions)

### DIRECT_URL Fix
- [ ] Region is `us-west-2` (matches Supabase project)
- [ ] Port is `5432` (direct connection)
- [ ] Redeploy completed successfully
- [ ] `prisma migrate status` works from Render Shell
- [ ] Application still stable (no regressions)

---

## Rollback Plan (If Issues Arise)

**Unlikely, but if fixes cause problems:**

### Rollback DATABASE_URL

1. **Go to:** Render Dashboard → Environment
2. **Edit `DATABASE_URL`**
3. **Revert to original:** (change `?` back to `&`)
   ```
   postgresql://...postgres&pgbouncer=true
   ```
4. **Save and redeploy**

### Rollback DIRECT_URL

1. **Go to:** Render Dashboard → Environment
2. **Edit `DIRECT_URL`**
3. **Revert to original:** (change `us-west-2` back to `us-west-1`)
   ```
   postgresql://...@aws-0-us-west-1.supabase.co:5432/postgres?sslmode=require
   ```
4. **Save and redeploy**

**Note:** Rollback should never be needed — these are purely configuration changes, not code changes.

---

## Documentation References

### Relevant Files
- [F6_CRITICAL_FIX_DATABASE_URL.md](F6_CRITICAL_FIX_DATABASE_URL.md) — Original issue identification
- [F6_IMMEDIATE_ACTIONS.md](F6_IMMEDIATE_ACTIONS.md) — Marked as optional after migrations succeeded
- [render.yaml](render.yaml) — Blueprint configuration (for reference)
- [backend/.env.example](backend/.env.example) — Environment variable documentation

### External Documentation
- **Prisma Pooling:** https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
- **Supabase Pooling:** https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- **PostgreSQL URLs:** https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING

---

## Decision: Apply Now or Later?

### Apply Now If:
- ✅ You have 10 minutes
- ✅ You want clean logs
- ✅ You prefer everything "perfect" before Stage 1
- ✅ You'll need to run migrations from Render later

### Defer to Later If:
- ✅ Production is stable and you're happy
- ✅ You're focused on mobile app distribution
- ✅ You want to minimize changes before Stage 1
- ✅ You're comfortable with local Prisma migrations

**No wrong answer** — both approaches are valid.

---

## Final Recommendation

**For Stage 1:**  
**DEFER** — Focus on mobile app distribution and tester onboarding. These fixes are cosmetic.

**Before Stage 2:**  
**APPLY** — Clean up environment for scale (1,000 users). Takes 10 minutes during a maintenance window.

**Priority Order for Immediate Actions:**
1. 🚀 **Mobile app upload to Play Store** (Priority 1)
2. 📊 **Set up monitoring dashboard** (Priority 2)
3. 📖 **Brief testers** (Priority 3)
4. 🔧 **Database URL optimizations** (Priority 4 — Optional)

---

**Last Updated:** January 20, 2026  
**Status:** Optional (non-blocking)  
**Can be applied:** Anytime after Stage 1 launch
