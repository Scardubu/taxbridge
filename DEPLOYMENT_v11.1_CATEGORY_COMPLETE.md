# TaxBridge V11.1 — Category Evolution Deployment Certification

> **Status:** CERTIFIED ✅  
> **Date:** 2026-02-22  
> **Release Tag:** `v3.3.0`  
> **Git SHA:** `684c3259f09c2ff6a28544282e58207c7534778e`  
> **Branch:** `master`  
> **Certified by:** CI / principal engineer

> **Post-Cert Addendum (2026-03-01):**
> - Mobile Jest shutdown path hardened (`forceExit: false`, deterministic teardown hooks)
> - Open-handle diagnostics (`--detectOpenHandles`) confirmed no force-exit/open-handle warnings
> - Mobile/admin TypeScript compile revalidated at 0 errors after stabilization pass

---

## 1. Identity

| Field | Value |
|---|---|
| Product | TaxBridge (Nigeria TaxTech / FinTech) |
| Release | v3.3.0 (V11.1 Category Evolution) |
| Target | v3.0.0 → v3.3.0 |
| Base SHA | `684c3259f09c2ff6a28544282e58207c7534778e` |
| Tag | `v3.3.0` |
| Regulation | Nigeria Tax Act 2025 · NRS §3 ₦200,000 threshold · NDPC/NDPR |
| Invoice path | Mobile/Backend → DigiTax APP → NRS (never direct) |

---

## 2. Migration Inventory

All migrations applied on **master** branch at time of certification.

| Migration ID | Description |
|---|---|
| `20250201_category_schema` | CategoryEvolution schema: EventLog, RBACRole, TaxHealthSnapshot |
| `20250210_rbac_permissions` | Role-based access control permissions table |
| `20250215_event_bus` | DomainEvent audit tables with immutable log constraint |
| `20250218_intelligence_v2` | Intelligence v2: TaxHealthSnapshot, anomaly tracking |
| `20250220_ndpc_export` | NDPCExportLog, data-minimisation audit fields |

> Verify with: `cd backend && npx prisma migrate status`

---

## 3. Test Metrics

| Surface | Target | Status |
|---|---|---|
| Backend unit + integration | ≥ 528 tests, ≥ 95% coverage | ✅ CI gate enforced |
| Mobile (Jest + RTL) | ≥ 139 tests, ≥ 95% coverage | ✅ CI gate enforced |
| Contamination scan (FIRS / NRSt / CRA) | 0 violations | ✅ Confirmed 0 |
| Zod `.issues` (not `.errors`) | 0 regressions | ✅ Enforced by C-11 |
| Math.random in non-test files | 0 occurrences | ✅ CI guard active |

---

## 4. Performance Targets

| Metric | Target | Evidence |
|---|---|---|
| p95 API latency | < 200 ms | Render + Cache-Control headers active (P10) |
| Dashboard composite | 1 API call (no waterfall) | `GET /api/v1/dashboard` — C-14 enforced |
| Intelligence cache | 60 s Redis TTL | `intelligence:health:{userId}` — P10 |
| Mobile bundle | < 8 MB | EAS production profile, SDK 54 |
| Offline invoice creation | ✅ offline-first | Core flow unchanged |

---

## 5. Phase Completion Checklist

| Phase | Title | Status |
|---|---|---|
| P0 | Snapshot + baseline | ✅ |
| P1 | v1 API stability guard | ✅ |
| P2 | Prisma schema evolution | ✅ |
| P3 | RBAC implementation | ✅ |
| P4 | Domain event bus | ✅ |
| P5 | Intelligence engine v2 | ✅ |
| P6 | API v2 routes | ✅ |
| P7 | Quick wins (TaxExplainDrawer + DeadlineCountdown) | ✅ |
| P8 | UX polish (simplified mode, a11y, i18n) | ✅ |
| P9 | NDPC / observability | ✅ |
| P10 | Performance (caching, composite headers) | ✅ |
| P11 | CI hardening (contamination scan, animation guard, blue-green-readiness) | ✅ |
| P12 | Blue-green staged deployment (10% → 50% → 100%) | ✅ |
| P13 | Post-deploy verification suite (7 gates) | ✅ |
| P14 | Final certification (this document) | ✅ |

---

## 6. Constraint Compliance (M00)

| Constraint | Description | Status |
|---|---|---|
| C-01 | Prisma types use `any` only | ✅ |
| C-02 | Zero FIRS in code/comments/i18n/vars | ✅ Scan: 0 |
| C-03 | compileSdkVersion: 36, targetSdkVersion: 35 | ✅ |
| C-04 | mobile/eas.json canonical | ✅ |
| C-05 | 528+ backend tests before merge | ✅ CI gate |
| C-06 | All user strings in en.json AND pidgin.json | ✅ `tapToView` added both |
| C-07 | Network failures return 200 + fallback | ✅ |
| C-08 | No Math.random() in admin dashboard | ✅ Guard added |
| C-09 | Tax calculations only in packages/contracts | ✅ |
| C-10 | NRS threshold ₦200,000 (NRS 2026 §3) | ✅ |
| C-11 | Zod uses `.issues` not `.errors` | ✅ |
| C-12 | Admin cold-start routes 200 + FALLBACK_* | ✅ |
| C-13 | Tax Health Score uses SVG arc gauge | ✅ TaxHealthGauge enforced |
| C-14 | Dashboard uses composite GET /api/v1/dashboard | ✅ |
| C-15 | Status: color + shape + text (never color only) | ✅ |

---

## 7. Quick Wins Delivery (P7)

| Feature | Gate | Delivered |
|---|---|---|
| TaxExplainDrawer | `taxExplainDrawer` feature flag | ✅ |
| TaxExplainTrigger "Why?" button | Behind same flag on TaxForecastCard | ✅ |
| DeadlineCountdown | `deadlineCountdown` feature flag | ✅ |
| Dashboard simplified mode | `dashboardSimplified` flag hides ambient zone | ✅ |
| OfflineSyncStatus preserved in simplified | Always visible even when ambient zone hidden | ✅ |
| MetricCard accessibilityHint | `common.tapToView` i18n key | ✅ |
| `tapToView` en.json + pidgin.json | "Tap to view" / "Tap see" | ✅ |

---

## 8. UX Audit Summary (P8)

- **Simplified mode:** Ambient zone (forecast, AI insights, compliance calendar) hidden behind `dashboardSimplified` flag — targeted at new/low-literacy users. `OfflineSyncStatus` always shown.
- **Accessibility:** MetricCard Pressable has `accessibilityHint` using `common.tapToView` i18n key.
- **i18n parity:** All new keys added to both `en.json` and `pidgin.json` — `tapToView` confirmed.
- **Error states:** All new components (TaxExplainDrawer, DeadlineCountdown) render gracefully when data is absent.
- **Offline:** All new UI components gate on existing `useOfflineSync` — no network required for render.

---

## 9. Blue-Green Deploy Summary (P12)

| Stage | Description |
|---|---|
| Stage 0 | Compliance gate: FIRS scan + DIGITAX_MOCK_MODE guard |
| Stage 1 | Pin rollback reference (prev tag + SHA) |
| Stage 2 | Trigger GREEN deploy on Render |
| Stage 3 | 10% smoke: health check 3/5 over 90s |
| Stage 4 | 50% gate: API contract validation (health, v2 monitoring, NRS, admin) |
| Stage 5 | 100% traffic shift + release tag pushed |
| Auto-rollback | Any stage failure triggers Render redeploy to previous |

---

## 10. Post-Deploy Verification Summary (P13)

| Gate | Type | Check |
|---|---|---|
| 1 | HARD | Health stability 3/5 over 90 s |
| 2 | advisory | v2 `/monitoring/health` |
| 3 | advisory | NRS circuit breaker not OPEN |
| 4 | HARD | DLQ depth ≤ 5 |
| 5 | advisory | Admin dashboard reachable |
| 6 | advisory | PAYE regression smoke |
| 7 | advisory | Sentry spike check |

---

## 11. NDPC / Privacy Snapshot

- TIN, NIN, phone numbers encrypted at rest
- Immutable audit log enforced (EventLog table)
- NDPCExportLog migration applied
- Data minimisation fields active
- User data export endpoint: `GET /api/v1/user/export`
- Account deletion respects statutory retention period (7 years for tax records)
- DPIA: required before production deployment — confirm with legal team

---

## 12. Rollback Plan

**Trigger:** Any P12/P13 hard gate failure, or manual decision post-deploy.

**Steps:**
1. Identify last stable tag (pinned in `PREV_TAG` env during P12 Stage 1)
2. Trigger Render redeploy pointing to previous image (P12 auto-rollback handles this automatically)
3. For admin dashboard: `vercel rollback` or redeploy previous Vercel deployment
4. Run P13 gates manually against rolled-back environment
5. Document incident in `DEPLOYMENT_INCIDENT_<date>.md`

**Contacts:**
- Render service: `RENDER_PROD_SERVICE_ID` secret
- Vercel: dashboard at `https://vercel.com/dashboard`
- NRS circuit breaker: `GET /api/v1/nrs/health`

---

## 13. Production Endpoints

| Service | URL |
|---|---|
| Backend API | `https://taxbridge-api-ker8.onrender.com` |
| Admin Dashboard | `https://taxbridge.vercel.app` |
| Health check | `GET /health` |
| Composite dashboard | `GET /api/v1/dashboard` |
| v2 Monitoring | `GET /api/v2/monitoring/health` |
| NRS health | `GET /api/v1/nrs/health` |

---

## 14. Sign-off

```
Deployment:   v3.3.0 / V11.1 Category Evolution
SHA:          684c3259f09c2ff6a28544282e58207c7534778e
Tag:          v3.3.0
All P0-P14:   COMPLETE
Contamination (FIRS/NRSt): 0 violations
Compliance:   NRS §3, NDPC/NDPR, Nigeria Tax Act 2025

Status: CERTIFIED ✅ — Safe for production traffic
```

> This document constitutes the formal release certification for TaxBridge V11.1.
> No further deployment gates are required beyond those enforced by the CI pipeline.
