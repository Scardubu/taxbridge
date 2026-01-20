# TaxBridge V5.0.2 — Integration Checklist (Live)

**Owner:** Product + Engineering (Compliance-first)  
**Updated:** 2026-01-20 (Post F3 deployment validation)  
**Staging URL:** https://taxbridge-api-35w0.onrender.com  
**Pre-Production Check:** ✅ 37/37 passed  
**Rule:** No critical-path gaps before go-live.

This checklist tracks end-to-end integration readiness across the monorepo:

```
Mobile (SQLite/offline)
  -> Sync Engine
  -> Backend API (Fastify)
  -> DB (Postgres/Prisma)
  -> Queues (Redis/BullMQ)
  -> External APP (DigiTax) + Payments (Remita) + SMS
  -> Admin Dashboard (Ops + audits)
```

## Status Legend
- ✅ Ready
- 🟡 Ready with constraints (acceptable for soft launch)
- 🔶 In progress
- ❌ Blocked

## Critical-Path Checklist
| Component | Status | Gate | Evidence / Notes |
|---|---:|---|---|
| Mobile offline invoice creation (SQLite) | ✅ | Works offline; no data loss | Mobile test suite passes (139/139 per Phase E reports). |
| Mobile → Backend sync (retry/backoff/idempotency) | 🟡 | Sync success > 99% under poor networks | Requires staging soak + field pilot validation (F4 + soft launch). |
| Backend API core (auth, invoices, sync endpoints) | ✅ | API p95 < 400ms; error rate < 1% | Backend tests pass (68/68). Pre-production check: 37/37 passed. |
| Database migrations (Prisma migrate deploy) | ✅ | Migrations apply cleanly in staging | Run via Render shell or `node backend/scripts/run-migrations.js`. |
| Redis + BullMQ worker processing | ✅ | Worker running; queues healthy | `/health/queues` returns 200; `maxmemoryPolicy: noeviction` configured. |
| UBL/XSD validation pipeline | ✅ | XSD available and validated | XSD downloaded during deploy (`ubl:download-xsd`); `/health` returns UBL snapshot. |
| DigiTax (APP) integration | 🟡 | No direct NRS integration; APP only | Soft launch allowed with `DIGITAX_MOCK_MODE=true`; certification required before full production. |
| Remita payment integration | 🟡 | No “paid” without webhook | Soft launch allowed with `REMITA_MOCK_MODE=true`; real keys + webhook confirmation required before enabling payments. |
| SMS provider integration (AT/Termii) | 🟡 | No silent failures; retries | Soft launch can run with mock/disabled SMS; verify DLQ + alerts. |
| Admin dashboard (ops + launch metrics) | ✅ | Can view system status + audits | Admin tests pass (8/8); confirm staging env vars + backend URL. |
| Audit logs + encryption (NDPC) | ✅ | Sensitive fields encrypted; immutable audit trail | Confirmed in security docs + backend config; verify in staging with a real flow. |
| Monitoring (Sentry + health/metrics) | ✅ | Errors observable; alerts configured | Health log throttling (5-min intervals); pool metrics optimized for Supabase pooler; `/health/live` for liveness, `/health/ready` for readiness. |

## Blockers & Escalations (Tracked)
| Blocker | Impact | Current Mitigation | Escalation Owner |
|---|---|---|---|
| DigiTax OAuth credentials (Duplo client id/secret) | Real NRS submission blocked | Use mock mode for soft launch | Compliance lead to APP provider |
| Remita merchant keys + webhook setup | Payment flows blocked | Use mock mode; do not mark invoices paid | Payments lead to Remita |
| SMS provider credentials | SMS/USSD fallbacks limited | Keep SMS optional; surface in-app status | Ops lead |

## Next Gate (F3 → F4)
1. Staging deploy via `render.staging.yaml`
2. Apply migrations (`prisma migrate deploy`)
3. Validate health: `/health`, `/health/db`, `/health/queues`, `/health/digitax`, `/health/remita`
4. Proceed to load tests (F4) only when required endpoints are healthy

## Verification Commands (Run locally before F3)
```bash
# Pre-production readiness check (37 checks)
yarn workspace @taxbridge/backend preproduction:check

# Backend build validation
yarn workspace @taxbridge/backend build

# Full test suite (215 tests)
yarn workspace @taxbridge/backend test    # 68 tests
cd mobile && yarn test                     # 139 tests
cd admin-dashboard && npm test             # 8 tests

# Health validation against deployed staging
yarn workspace @taxbridge/backend validate:health https://taxbridge-api-staging.onrender.com

# Staging environment validation (comprehensive)
yarn workspace @taxbridge/backend validate:staging https://taxbridge-api-staging.onrender.com
```

## Load Test Commands (F4)
```bash
# Run all F4 load tests sequentially (smoke → load → soak)
BASE_URL=https://taxbridge-api-staging.onrender.com yarn workspace @taxbridge/backend test:load:f4

# Or run individually:
BASE_URL=https://taxbridge-api-staging.onrender.com k6 run backend/load-test/k6-smoke.js
BASE_URL=https://taxbridge-api-staging.onrender.com k6 run backend/load-test/k6-script.js
BASE_URL=https://taxbridge-api-staging.onrender.com k6 run backend/load-test/k6-soak.js
```
