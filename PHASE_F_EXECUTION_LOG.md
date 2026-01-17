# Phase F: Production Launch Execution Log

**Version:** 5.0.2  
**Start Date:** January 16, 2026  
**Status:** 🟡 F3 IN PROGRESS (F1-F2 Complete)  
**Lead:** Production Finalization Team

---

## Execution Overview

This document tracks real-time execution of Phase F: Phased Production Launch for TaxBridge V5.0.2.

### Prerequisites ✅
- [x] Phase E complete (139 mobile + 68 backend + 8 admin tests passing)
- [x] TypeScript errors: 0 across all layers
- [x] Documentation aligned and streamlined
- [x] Security hardening complete (Phase B)
- [x] EAS build configuration validated
- [x] Pre-staging check passed (31/31)

### Test Summary (January 17, 2026)
| Suite | Tests | Status |
|-------|-------|--------|
| Mobile | 139/139 | ✅ |
| Backend | 68/68 | ✅ |
| Admin | 8/8 | ✅ |
| **Total** | **215/215** | **✅ 100%** |

---

## Phase F Task Breakdown

| Task | Status | Start | End | Notes |
|------|--------|-------|-----|-------|
| F1: Production Environment Setup | ✅ Complete | 2026-01-16 | 2026-01-16 | Secrets in RENDER_SECRETS.txt |
| F2: Build Production Mobile Artifacts | ✅ Complete | 2026-01-16 | 2026-01-16 | Android AAB: 446d5211-e437-438c-9fc1-c56361286855 |
| F3: Deploy Backend to Staging | 🟡 Ready | 2026-01-17 | - | See [F3_STAGING_DEPLOYMENT.md](F3_STAGING_DEPLOYMENT.md) |
| F4: Execute Load Testing Suite | ⏳ Pending | - | - | k6: smoke, load, soak tests |
| F5: DigiTax Certification | ⏳ Pending | - | - | External dependency |
| F6: Production Deployment | ⏳ Pending | - | - | Controlled rollout |
| F7: Phased Rollout Activation | ⏳ Pending | - | - | 100 → 1k → 10k → 50k users |

---

## F1: Production Environment Setup

### Objective
Create production-ready `.env.production` with:
- Secure secrets generation
- Real credentials (where available)
- Mock placeholders (where pending)
- Full validation before deployment

### Current State Analysis

**Examined Files:**
1. `.env.production.example` (171 lines) - Root-level template
2. `backend/.env.example` (181 lines) - Backend-specific template
3. `mobile/eas.json` - Mobile build configuration

**Critical Finding:**
- `.env.production.example` contains **REAL CREDENTIALS** (marked as production)
- These should be secured immediately or marked for rotation

### Secrets Status

| Secret | Status | Action Required |
|--------|--------|-----------------|
| `DATABASE_URL` (Supabase) | ✅ Present | Verify connection |
| `REDIS_URL` (Upstash) | ✅ Present | Verify connection |
| `JWT_SECRET` | ✅ Generated | Ready to use |
| `JWT_REFRESH_SECRET` | ✅ Generated | Ready to use |
| `ENCRYPTION_KEY` | ✅ Generated | Ready to use |
| `SESSION_SECRET` | ✅ Generated | Ready to use |
| `WEBHOOK_SECRET` | ✅ Generated | Ready to use |
| `DIGITAX_API_KEY` | ✅ Present | Test in sandbox first |
| `DUPLO_CLIENT_ID` | ❌ Placeholder | Need from DigiTax |
| `DUPLO_CLIENT_SECRET` | ❌ Placeholder | Need from DigiTax |
| `REMITA_MERCHANT_ID` | ❌ Placeholder | Need from Remita |
| `REMITA_API_KEY` | ❌ Placeholder | Need from Remita |
| `REMITA_SERVICE_TYPE_ID` | ❌ Placeholder | Need from Remita |
| `AT_API_KEY` | ❌ Placeholder | Need from Africa's Talking |
| `AT_USERNAME` | ❌ Placeholder | Need from Africa's Talking |
| `AT_SHORTCODE` | ❌ Placeholder | Need from Africa's Talking |

### Next Steps

1. **Execute F3 staging deployment**
   - Create Supabase staging DB and capture `DATABASE_URL`
   - Deploy Render blueprint using `render.staging.yaml`
   - Set staging secrets in Render dashboard

2. **Apply migrations**
   - Run `npx prisma migrate deploy` in Render shell

3. **Validate health**
   - Run `node backend/scripts/validate-health.js <staging-url>`

4. **Record F3 evidence**
   - Health check output (all endpoints 200)
   - Queue worker status
   - Migration log/confirmation

### Blockers

| Blocker | Impact | Resolution Path |
|---------|--------|-----------------|
| Missing Remita credentials | Payment flows blocked | Contact Remita support → sandbox keys first |
| Missing DigiTax OAuth credentials | NRS submission blocked | Contact DigiTax → test with existing API key first |
| Missing SMS provider credentials | USSD/SMS blocked | Use mock mode initially, parallel track activation |

### Decision Points

**Option A: Full Production (Recommended for Final Launch)**
- Wait for all external credentials
- Complete DigiTax certification
- Launch with full payment + NRS integration

**Option B: Soft Launch with Mocks (Recommended for Phase 1)**
- Use `DIGITAX_MOCK_MODE=true`
- Skip payment integration initially
- Focus on core invoice creation + offline sync
- Unblock mobile app validation

**Recommendation:** **Option B for Phase F1-F4**, transition to Option A for F6 (production deployment)

---

## F3: Staging Deployment Validation (In Progress)

### Objective
Deploy backend to staging and validate health, queues, and migrations before load testing.

### Validation Checklist (Live)
| Item | Status | Evidence | Notes |
|------|--------|----------|-------|
| Render blueprint deployed (`render.staging.yaml`) | ⏳ | - | Awaiting deployment run |
| Staging `DATABASE_URL` configured | ⏳ | - | Supabase staging DB required |
| All required secrets set in Render | ⏳ | - | JWT, encryption, DigiTax/Remita mock creds |
| Migrations applied (`prisma migrate deploy`) | ❌ | P1001 from local | Supabase direct connection unreachable |
| `/health` returns 200 | ⏳ | - | Must include DB + Redis status |
| `/health/db` returns 200 | ⏳ | - | Connection pool healthy |
| `/health/queues` returns 200 | ⏳ | - | Queue counts reported |
| `/health/digitax` returns 200 (mock) | ⏳ | - | `DIGITAX_MOCK_MODE=true` |
| `/health/remita` returns 200 (mock) | ⏳ | - | `REMITA_MOCK_MODE=true` |
| Worker service online | ⏳ | - | BullMQ processing logs |

### Evidence Capture (Required)
- Render deployment logs (build + start)
- Migration output (success confirmation)
- Health validation output (all endpoints 200)
- Worker logs confirming queue processing

### Current Blocker (F3)
- Local migration attempt failed with `P1001` (cannot reach Supabase host).
- DNS lookup for `db.<project-ref>.supabase.co` returns IPv6 only in this environment; local network lacks IPv6 connectivity.
- Resolution path: run migrations from Render shell (same region/VPC), or set `MIGRATION_DATABASE_URL` to Supabase pooler **session** endpoint (IPv4) and run `node backend/scripts/run-migrations.js`.
   - Example (session pooler / 5432): `postgresql://postgres.<project-ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`

### Render Install Stability (F3)
- If Render logs show `/bin/sh: 1: prisma: not found` during dependency installation, set `PRISMA_SKIP_POSTINSTALL_GENERATE=true` in the Render service Environment.
   - This prevents `@prisma/client` from attempting `prisma generate` during `yarn install`; Prisma generation is executed explicitly during build/start.

### Blueprint Not Applied (F3)
- If Render logs show `Running 'cd backend && yarn start'` and Node `v22.x`, the service is not using the blueprint settings (`render.staging.yaml`).
   - Fix: recreate via Blueprint Instance, or manually update the Render service Build/Start commands + Node version to match the blueprint.

### Deployment Blocker (F3)
- Render service failing to start with `@prisma/client did not initialize yet` (missing Prisma Client in build output).
- Resolution: Prisma generation is now enforced at service start via backend lifecycle scripts (`prestart`/`preworker`), and Prisma CLI is included in backend production dependencies to avoid `prisma: not found` when Render installs in production mode.
   - Added `postinstall: prisma generate` in backend package.json.
   - Added `yarn prisma:generate` to Render build commands (API + worker, staging + production).
 - Additional blocker: `DIGITAX_API_URL` and `JWT_REFRESH_SECRET` were required by env schema but not set in Render.
    - Added `DIGITAX_API_URL` + `JWT_REFRESH_SECRET` to Render blueprints (staging + production).

### Latest Execution (2026-01-17 16:00 UTC)

**Root Cause Identified:**
Render was **not using the blueprint file**. Services created via "New Web Service" ignore `render.staging.yaml` and use Render defaults:
- Build: `yarn`
- Start: `cd backend && yarn start`
- Node: v22.x (latest)

This caused:
1. `prisma: not found` — `@prisma/client` postinstall runs `prisma generate` but Prisma CLI not on PATH
2. `MODULE_NOT_FOUND: dist/src/server.js` — TypeScript never compiled (no build step)

**Fix Applied:**
1. Blueprint updated: `PRISMA_SKIP_POSTINSTALL_GENERATE=true`, `PORT=3000`, branch set to `master`
2. F3 deployment guide rewritten with explicit "New Blueprint Instance" instructions
3. Added manual service update fallback steps

**Next Action:**
Delete existing Render staging service and redeploy via **Blueprints → New Blueprint Instance** using `render.staging.yaml`.

**Expected Build Logs (success):**
```
yarn install --frozen-lockfile --production=false
yarn workspace @taxbridge/backend build
yarn workspace @taxbridge/backend prisma:generate
yarn workspace @taxbridge/backend ubl:download-xsd
```

**Expected Start Logs (success):**
```
Running 'yarn workspace @taxbridge/backend start'
Node.js v20.19.4
Server listening on port 3000
```
- Commit pushed to `master` and redeploy triggered.
- Health validation against https://taxbridge-api.onrender.com still returns 502 (awaiting successful redeploy).

### Pre-Staging Check (January 17, 2026)

**Result:** ✅ **31/31 checks passed**

```
📁 Required files: 5/5 ✅
🔐 Environment templates: 6/6 ✅
📐 Render blueprint: 6/6 ✅
🗄️ Prisma schema: 3/3 ✅
🏥 Health endpoints: 5/5 ✅
📊 Load test scripts: 4/4 ✅
🔧 Validation scripts: 2/2 ✅
```

**Conclusion:** Codebase is ready for Render staging deployment.

---

## Execution Timeline

```
Day 1 (Completed): F1 + F2
├── Morning: Production environment setup
├── Afternoon: Mobile builds (Android AAB + iOS IPA)
└── Evening: Build artifact verification

Day 2 (In Progress): F3 + F4
├── Morning: Staging deployment
├── Afternoon: Load testing (smoke → load → soak)
└── Evening: Results analysis + optimization

Day 3-5: F5 (External Dependency)
└── DigiTax certification (async, non-blocking)

Day 6: F6
├── Morning: Production deployment (backend + admin)
├── Afternoon: Mobile OTA update
└── Evening: Post-deployment monitoring

Day 7+: F7
└── Phased rollout activation (100 → 1k → 10k users)
```

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| DigiTax API rate limits | Medium | High | Implement exponential backoff + queue throttling |
| Supabase connection pool exhaustion | Low | High | Pool metrics already instrumented (Phase B) |
| Remita webhook failures | Medium | Medium | DLQ monitoring + manual reconciliation |
| Mobile build signing issues | Low | High | Pre-validate credentials before EAS build |
| Load test reveals performance regression | Medium | High | Staged rollout allows fast rollback |

---

## Go/No-Go Criteria (Per Stage)

### F1 → F2 Gate
- [ ] Backend compiles with production env vars
- [ ] Database connection verified
- [ ] Redis connection verified
- [ ] No hardcoded secrets in source code

### F2 → F3 Gate
- [ ] Android AAB build successful
- [ ] iOS IPA build successful (or blocked with plan)
- [ ] Mobile app launches without crashes
- [ ] API connectivity verified

### F3 → F4 Gate
- [ ] Staging deployment healthy
- [ ] All health endpoints returning 200
- [ ] Queue workers processing jobs
- [ ] Database migrations applied

### F4 → F6 Gate (F5 async)
- [ ] Smoke test passes (0% error rate)
- [ ] Load test passes (<10% error rate, p95 <300ms)
- [ ] Soak test passes (no memory leaks, stable performance)
- [ ] Circuit breakers activate under stress

### F6 → F7 Gate
- [ ] Production deployment successful
- [ ] Post-deployment health checks pass
- [ ] Monitoring dashboards active
- [ ] Rollback plan tested

---

## Compliance Checkpoints

| Checkpoint | Status | Evidence |
|------------|--------|----------|
| Encryption at rest (TIN/NIN) | ✅ | `backend/src/lib/encryption.ts` |
| Audit logging enabled | ✅ | Structured logs to Sentry |
| CORS configured | ✅ | `ALLOWED_ORIGINS` env var |
| Rate limiting active | ✅ | 5-tier system (Phase B) |
| UBL 3.0 validation | ✅ | 55 mandatory fields |
| Data minimization | ✅ | PRD compliance section |

---

## Communications Plan

### Internal Stakeholders
- **Engineering:** Daily standups during F1-F6
- **Compliance:** Pre-launch sign-off before F6
- **Operations:** On-call rotation for F6-F7

### External Dependencies
- **DigiTax:** Certification request submitted (F5)
- **Remita:** Sandbox credentials requested
- **Africa's Talking:** Production credentials requested

### User Communication
- **Phase 1 (100 users):** Direct WhatsApp messages
- **Phase 2 (1k users):** In-app announcements
- **Phase 3 (10k users):** Email + SMS campaigns
- **Phase 4 (50k+ users):** Press release + influencer partnerships

---

## Success Metrics (Phase F)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Build success rate | 100% | - | ⏳ |
| Staging uptime | >99% | - | ⏳ |
| Load test error rate | <10% | - | ⏳ |
| Production deployment time | <30 min | - | ⏳ |
| Rollback readiness | <5 min | - | ⏳ |

---

## Phase F Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | | | |
| Product Owner | | | |
| Compliance Officer | | | |
| DevOps | | | |

---

**Next Update:** After F3 staging deployment + health validation
