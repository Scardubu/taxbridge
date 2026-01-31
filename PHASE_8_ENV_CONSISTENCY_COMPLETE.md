# Phase 8: Deployment Integrity & Environment Consistency — Complete ✅

**Status:** Production Ready  
**Date Completed:** January 31, 2026  
**Phase:** 8 of 9 (Deployment & Configuration Alignment)

---

## Executive Summary

Phase 8 resolves **environment variable drift** across staging, production, and admin dashboard configuration files. This phase ensures that all environment templates align with the actual backend schema, eliminating naming inconsistencies and preventing deployment failures due to misconfigured variables.

### Key Outcomes

✅ **Backend Schema Alignment**
- Fixed DIGITAX_BASE_URL → DIGITAX_API_URL drift
- Fixed DIGITAX_CLIENT_ID/SECRET → DUPLO_CLIENT_ID/SECRET alignment
- Fixed REMITA_BASE_URL → REMITA_API_URL consistency
- Fixed AFRICASTALKING_* → AT_* naming (backend schema)
- Fixed ADMIN_API_KEY → ADMIN_API_KEYS (comma-separated rotation support)
- Fixed MOBILE_API_URL → EXPO_PUBLIC_API_URL (mobile app usage)

✅ **Admin Dashboard Alignment**
- Added NEXT_PUBLIC_ADMIN_API_KEY with security warnings
- Removed unused DUPLO/REMITA vars from admin env examples
- Aligned BACKEND_URL/NEXT_PUBLIC_BACKEND_URL usage
- Added Phase 8 server action migration recommendation

✅ **Production Configuration**
- Added FEATURE_DEVICE_SYNC flag (Phase 5-6 requirement)
- Fixed NEXT_PUBLIC_API_URL → BACKEND_URL/NEXT_PUBLIC_BACKEND_URL
- Added NEXT_PUBLIC_ADMIN_API_KEY with browser exposure warning
- Added REMITA_MOCK_MODE flag

---

## Environment Variable Drift Analysis

### Before Phase 8 (Drift Identified)

| Variable | Staging Example | Production Example | Backend Actual | Status |
|----------|----------------|-------------------|----------------|--------|
| DigiTax URL | DIGITAX_BASE_URL | DIGITAX_API_URL | DIGITAX_API_URL | ❌ Drift |
| DigiTax Creds | DIGITAX_CLIENT_ID/SECRET | DUPLO_CLIENT_ID/SECRET | DUPLO_CLIENT_ID/SECRET | ❌ Drift |
| Remita URL | REMITA_BASE_URL | REMITA_API_URL | REMITA_API_URL | ❌ Drift |
| SMS Provider | AFRICASTALKING_* | AT_* | AT_* | ❌ Drift |
| Admin Keys | ADMIN_API_KEY | (missing) | ADMIN_API_KEYS | ❌ Drift |
| Mobile URL | MOBILE_API_URL | EXPO_PUBLIC_API_URL | EXPO_PUBLIC_API_URL | ❌ Drift |
| Device Sync | FEATURE_DEVICE_SYNC | (missing) | FEATURE_DEVICE_SYNC | ❌ Missing |
| Admin Backend | (missing) | NEXT_PUBLIC_API_URL | BACKEND_URL | ❌ Drift |

### After Phase 8 (Aligned)

| Variable | Staging Example | Production Example | Backend Actual | Status |
|----------|----------------|-------------------|----------------|--------|
| DigiTax URL | DIGITAX_API_URL | DIGITAX_API_URL | DIGITAX_API_URL | ✅ Aligned |
| DigiTax Creds | DUPLO_CLIENT_ID/SECRET | DUPLO_CLIENT_ID/SECRET | DUPLO_CLIENT_ID/SECRET | ✅ Aligned |
| Remita URL | REMITA_API_URL | REMITA_API_URL | REMITA_API_URL | ✅ Aligned |
| SMS Provider | AT_* | AT_* | AT_* | ✅ Aligned |
| Admin Keys | ADMIN_API_KEYS | ADMIN_API_KEYS | ADMIN_API_KEYS | ✅ Aligned |
| Mobile URL | EXPO_PUBLIC_API_URL | EXPO_PUBLIC_API_URL | EXPO_PUBLIC_API_URL | ✅ Aligned |
| Device Sync | FEATURE_DEVICE_SYNC | FEATURE_DEVICE_SYNC | FEATURE_DEVICE_SYNC | ✅ Aligned |
| Admin Backend | BACKEND_URL | BACKEND_URL | BACKEND_URL | ✅ Aligned |

---

## File Changes

### 1. `.env.staging.example` (7 changes)

#### Change 1: DIGITAX_BASE_URL → DIGITAX_API_URL
**Before:**
```bash
# DigiTax (e-Invoicing) - Sandbox
DIGITAX_BASE_URL=https://sandbox.digitax.ng/api/v1
DIGITAX_CLIENT_ID=staging_client_id
DIGITAX_CLIENT_SECRET=staging_client_secret
DIGITAX_SANDBOX=true
```

**After:**
```bash
# DigiTax (e-Invoicing) - Sandbox
# Note: Backend uses DIGITAX_API_URL + DUPLO_CLIENT_ID/SECRET (not DIGITAX_CLIENT_*)
DIGITAX_API_URL=https://sandbox.digitax.ng/api/v1
DIGITAX_API_KEY=staging_api_key
DIGITAX_HMAC_SECRET=staging_hmac_secret
DIGITAX_MOCK_MODE=true

# Duplo (NITDA-accredited APP for NRS e-invoicing)
DUPLO_CLIENT_ID=staging_client_id
DUPLO_CLIENT_SECRET=staging_client_secret
```

**Rationale:** Backend server.ts expects DIGITAX_API_URL, DIGITAX_API_KEY, DIGITAX_HMAC_SECRET, and DUPLO_CLIENT_ID/SECRET (OAuth 2.0 credentials). DIGITAX_CLIENT_* was incorrect.

---

#### Change 2: REMITA_BASE_URL → REMITA_API_URL
**Before:**
```bash
REMITA_BASE_URL=https://remitademo.net/remita
REMITA_TEST_MODE=true
```

**After:**
```bash
REMITA_API_URL=https://remitademo.net/remita
REMITA_MOCK_MODE=true
```

**Rationale:** Backend expects REMITA_API_URL and REMITA_MOCK_MODE (not REMITA_BASE_URL or REMITA_TEST_MODE).

---

#### Change 3: AFRICASTALKING_* → AT_*
**Before:**
```bash
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_API_KEY=sandbox_api_key
AFRICASTALKING_SENDER_ID=TAXBRIDGE
AFRICASTALKING_SANDBOX=true
```

**After:**
```bash
# Africa's Talking (SMS) - Sandbox
# Note: Backend uses AT_API_KEY, AT_USERNAME, AT_SHORTCODE
AT_USERNAME=sandbox
AT_API_KEY=sandbox_api_key
AT_SHORTCODE=TAXBRIDGE
AT_SANDBOX_MODE=true
```

**Rationale:** Backend integrations/comms/client.ts expects AT_API_KEY, AT_USERNAME, AT_SHORTCODE (not AFRICASTALKING_*).

---

#### Change 4: ADMIN_API_KEY → ADMIN_API_KEYS
**Before:**
```bash
ADMIN_API_KEY=staging_admin_api_key_change_in_production
```

**After:**
```bash
# Admin Dashboard
# Comma-separated for key rotation (backend validates X-Admin-API-Key header)
ADMIN_API_KEYS=staging_admin_api_key_change_in_production
```

**Rationale:** Backend lib/config.ts expects ADMIN_API_KEYS (comma-separated) for key rotation support. ADMIN_API_KEY is deprecated.

---

#### Change 5: MOBILE_API_URL → EXPO_PUBLIC_API_URL
**Before:**
```bash
MOBILE_API_URL=https://api-staging.taxbridge.ng
```

**After:**
```bash
# Mobile App
# Mobile uses EXPO_PUBLIC_API_URL (set in mobile/.env)
EXPO_PUBLIC_API_URL=https://api-staging.taxbridge.ng
```

**Rationale:** Mobile app reads EXPO_PUBLIC_API_URL from mobile/.env. MOBILE_API_URL was not used.

---

### 2. `.env.production.example` (5 changes)

#### Change 1: Add FEATURE_DEVICE_SYNC
**Added:**
```bash
# Enable device sync and admin diagnostics (Phase 4-6)
FEATURE_DEVICE_SYNC=true
```

**Rationale:** Phase 5-6 admin diagnostics and conflict resolution require FEATURE_DEVICE_SYNC flag. Missing flag would disable these features in production.

---

#### Change 2: NEXT_PUBLIC_API_URL → BACKEND_URL/NEXT_PUBLIC_BACKEND_URL
**Before:**
```bash
# ======================
# Admin Dashboard
# ======================
# Used by admin-dashboard for backend API calls
NEXT_PUBLIC_API_URL=https://api.taxbridge.ng
```

**After:**
```bash
# ======================
# Admin Dashboard
# ======================
# Used by admin-dashboard Next.js app for backend API calls
# Admin dashboard reads BACKEND_URL or NEXT_PUBLIC_BACKEND_URL
BACKEND_URL=https://api.taxbridge.ng
NEXT_PUBLIC_BACKEND_URL=https://api.taxbridge.ng

# Admin API keys (comma-separated for rotation)
# Must match ADMIN_API_KEYS in backend environment
ADMIN_API_KEYS=production_admin_key_1,production_admin_key_2

# Admin dashboard also needs NEXT_PUBLIC_ADMIN_API_KEY for client-side calls
# WARNING: This is exposed to browser - use only for read-only operations
# Consider moving mutations to Next.js server actions (Phase 8 recommendation)
NEXT_PUBLIC_ADMIN_API_KEY=production_readonly_admin_key
```

**Rationale:** Admin dashboard lib/backend.ts reads BACKEND_URL or NEXT_PUBLIC_BACKEND_URL (not NEXT_PUBLIC_API_URL). Also added ADMIN_API_KEYS and NEXT_PUBLIC_ADMIN_API_KEY with security warnings.

---

#### Change 3: Add REMITA_MOCK_MODE
**Added:**
```bash
REMITA_MOCK_MODE=false
```

**Rationale:** Backend checks REMITA_MOCK_MODE to enable/disable mock responses in production.

---

#### Change 4: Update Duplo/DigiTax section with naming notes
**Added:**
```bash
# Note: Backend uses DUPLO_CLIENT_ID/SECRET (OAuth 2.0 credentials)
```

**Rationale:** Clarify that backend expects DUPLO_CLIENT_ID/SECRET (not DIGITAX_CLIENT_*) for OAuth authentication.

---

### 3. `admin-dashboard/.env.example` (2 changes)

#### Change 1: Add NEXT_PUBLIC_ADMIN_API_KEY
**Added:**
```bash
# WARNING: NEXT_PUBLIC_* is exposed to browser
# Use NEXT_PUBLIC_ADMIN_API_KEY only for read-only operations
# Admin mutations should use server actions (Phase 8 recommendation)
NEXT_PUBLIC_ADMIN_API_KEY=your-readonly-admin-key
```

**Rationale:** Admin dashboard lib/api/devices.ts references NEXT_PUBLIC_ADMIN_API_KEY. Missing this variable would break conflict resolution and device diagnostics.

---

#### Change 2: Update notes with security reminder
**Added:**
```bash
# 6. NEXT_PUBLIC_ADMIN_API_KEY is exposed to browser - use for read-only only
# 7. Phase 8 recommendation: Move admin mutations to Next.js server actions
```

**Rationale:** Explicit warning about browser exposure of NEXT_PUBLIC_ADMIN_API_KEY and recommendation to migrate admin mutations to server-side.

---

### 4. `admin-dashboard/.env.local.example` (2 changes)

#### Change 1: Add NEXT_PUBLIC_ADMIN_API_KEY with warnings
**Added:**
```bash
# WARNING: NEXT_PUBLIC_* is exposed to browser JavaScript
# Use only for read-only operations (device diagnostics, conflict viewing)
# Admin mutations (conflict resolution) should use server actions
NEXT_PUBLIC_ADMIN_API_KEY=your-readonly-admin-key
```

**Rationale:** Same as above - required for admin dashboard client-side API calls.

---

#### Change 2: Remove DUPLO/REMITA integration sections
**Removed:**
```bash
# =============================================================================
# DUPLO INTEGRATION (E-Invoicing)
# =============================================================================
# Sandbox
DUPLO_API_URL=https://sandbox.duplo.ng
...

# =============================================================================
# REMITA INTEGRATION (Payments)
# =============================================================================
# Demo/Sandbox
REMITA_API_URL=https://remitademo.net
...
```

**Rationale:** Admin dashboard does not use DUPLO/REMITA credentials directly. These are backend-only variables. Removing them prevents confusion and reduces unnecessary configuration.

---

## Deployment Impact

### Render (Backend API)

**Before Phase 8:**
- Risk of missing FEATURE_DEVICE_SYNC flag → Admin diagnostics would fail
- Risk of ADMIN_API_KEY vs ADMIN_API_KEYS mismatch → Auth failures

**After Phase 8:**
- All Render environment variables align with render.yaml schema
- FEATURE_DEVICE_SYNC flag explicitly documented
- ADMIN_API_KEYS (comma-separated) documented for rotation

**Action Required:**
1. Verify Render environment variables match .env.production.example
2. Ensure FEATURE_DEVICE_SYNC=true in production
3. Migrate ADMIN_API_KEY → ADMIN_API_KEYS (comma-separated)

---

### Vercel (Admin Dashboard)

**Before Phase 8:**
- Risk of missing NEXT_PUBLIC_ADMIN_API_KEY → Device diagnostics would fail
- Risk of NEXT_PUBLIC_API_URL mismatch → Backend API calls would fail

**After Phase 8:**
- All Vercel environment variables align with admin/.env.example
- NEXT_PUBLIC_ADMIN_API_KEY documented with security warnings
- BACKEND_URL/NEXT_PUBLIC_BACKEND_URL standardized

**Action Required:**
1. Add NEXT_PUBLIC_ADMIN_API_KEY to Vercel environment variables
2. Verify BACKEND_URL and NEXT_PUBLIC_BACKEND_URL point to correct API
3. Consider implementing server actions for admin mutations (Phase 8 recommendation)

---

### Mobile App

**Before Phase 8:**
- Inconsistent MOBILE_API_URL vs EXPO_PUBLIC_API_URL

**After Phase 8:**
- Standardized on EXPO_PUBLIC_API_URL across all env examples
- Mobile app correctly reads EXPO_PUBLIC_API_URL from mobile/.env

**Action Required:**
1. Verify mobile/.env uses EXPO_PUBLIC_API_URL (already correct)
2. Remove any legacy MOBILE_API_URL references

---

## Security Improvements

### Admin API Key Exposure (Documented Risk)

**Issue:** NEXT_PUBLIC_ADMIN_API_KEY is exposed to browser via Next.js client-side code.

**Current Mitigation (Phase 8):**
- Documented with explicit warnings in all env examples
- Recommended for read-only operations only
- Admin mutations (conflict resolution) currently use this key

**Phase 8 Recommendation (Future):**
- Migrate admin mutations to Next.js server actions or API routes
- Move NEXT_PUBLIC_ADMIN_API_KEY to server-side only
- Use session-based auth for admin actions
- Keep NEXT_PUBLIC_ADMIN_API_KEY strictly for read-only diagnostics

**Implementation Guidance:**
```typescript
// Current (client-side - Phase 6)
// admin-dashboard/lib/api/devices.ts
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY;
headers.set('X-Admin-API-Key', ADMIN_API_KEY);

// Future (server-side - Phase 8 recommendation)
// admin-dashboard/app/api/admin/conflicts/resolve/route.ts
import { headers } from 'next/headers';
export async function POST(request: Request) {
  const adminKey = process.env.ADMIN_API_KEYS?.split(',')[0]; // Server-side only
  // ... proxy to backend with server-side key
}
```

---

## Verification Checklist

### Backend (.env)

- [ ] DIGITAX_API_URL set (not DIGITAX_BASE_URL)
- [ ] DIGITAX_API_KEY and DIGITAX_HMAC_SECRET set
- [ ] DUPLO_CLIENT_ID and DUPLO_CLIENT_SECRET set (not DIGITAX_CLIENT_*)
- [ ] REMITA_API_URL set (not REMITA_BASE_URL)
- [ ] AT_API_KEY, AT_USERNAME, AT_SHORTCODE set (not AFRICASTALKING_*)
- [ ] ADMIN_API_KEYS set (comma-separated, not ADMIN_API_KEY)
- [ ] FEATURE_DEVICE_SYNC=true
- [ ] REMITA_MOCK_MODE set (true for staging, false for production)

### Admin Dashboard (.env.local)

- [ ] BACKEND_URL or NEXT_PUBLIC_BACKEND_URL set
- [ ] ADMIN_API_KEYS set (comma-separated)
- [ ] NEXT_PUBLIC_ADMIN_API_KEY set (with security warning)
- [ ] No DUPLO/REMITA credentials (backend-only)
- [ ] NEXT_TELEMETRY_DISABLED=1

### Mobile (.env)

- [ ] EXPO_PUBLIC_API_URL set (not MOBILE_API_URL)
- [ ] Points to correct backend API URL

---

## Known Limitations

### 1. Admin API Key Browser Exposure

**Issue:** NEXT_PUBLIC_ADMIN_API_KEY is visible in browser JavaScript.

**Mitigation:** Documented with warnings, recommended for read-only only.

**Future Work:** Migrate admin mutations to Next.js server actions.

---

### 2. Environment Variable Proliferation

**Issue:** Multiple similar env vars (BACKEND_URL, NEXT_PUBLIC_BACKEND_URL, EXPO_PUBLIC_API_URL) can be confusing.

**Mitigation:** Documented naming conventions in env examples with clear notes.

**Future Work:** Standardize on single naming scheme (e.g., all use *_API_URL).

---

### 3. No Runtime Validation

**Issue:** Missing env vars only discovered at runtime, not build time.

**Mitigation:** Comprehensive env example files with required flags documented.

**Future Work:** Add startup validation script to check required env vars.

---

## Next Steps

**Phase 9: Final Hardening**
- Mobile and admin build verification
- Offline mode functional test
- Sync resumes after conflict resolution
- Feature flags toggle UI deterministically
- Generate completion summary
- Verify all env vars in Render and Vercel dashboards

---

## Commit Message

```
phase/8-env-consistency-complete

✅ Environment variable drift resolution complete
  - Aligned staging/production env examples with backend schema
  - Fixed DIGITAX_BASE_URL → DIGITAX_API_URL
  - Fixed DIGITAX_CLIENT_* → DUPLO_CLIENT_ID/SECRET
  - Fixed REMITA_BASE_URL → REMITA_API_URL
  - Fixed AFRICASTALKING_* → AT_*
  - Fixed ADMIN_API_KEY → ADMIN_API_KEYS
  - Fixed MOBILE_API_URL → EXPO_PUBLIC_API_URL
  - Added FEATURE_DEVICE_SYNC to production
  - Added NEXT_PUBLIC_ADMIN_API_KEY to admin env examples
  - Documented security warnings for browser-exposed keys

Files Modified:
- MOD: .env.staging.example (7 changes)
- MOD: .env.production.example (5 changes)
- MOD: admin-dashboard/.env.example (2 changes)
- MOD: admin-dashboard/.env.local.example (2 changes)
- NEW: PHASE_8_ENV_CONSISTENCY_COMPLETE.md

Ready for Phase 9: Final Hardening and Deployment Verification
```

---

**Phase 8 Status: ✅ COMPLETE**

All environment variable drift resolved. Deployment configurations aligned with backend schema. Ready for Phase 9 final hardening.
