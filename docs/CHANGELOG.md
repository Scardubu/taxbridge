# Changelog

## [13.4.0] - 2026-03-10

### Fixed

- `package.json` (root) — Added `"packageManager": "npm@10.9.2"` for deterministic installs on Render and Vercel
- `admin-dashboard/vercel.json` — Changed `buildCommand` from `next build` to `npm run build` to align with canonical package script
- `package-lock.json` (root) — Regenerated via `npm install` to fix stale workspace metadata; restored missing packages (`encodeurl`, `finalhandler`, `proxy-addr`, `type-is`, etc.) causing Render `npm ci` failures
- `admin-dashboard/package.json` — Upgraded `@reduxjs/toolkit` from `^1.9.7` to `^2.11.2` to resolve React 19 peer dependency conflict blocking `package-lock.json` generation
- `render.yaml` — Fixed region values from invalid `fra` to `frankfurt` (valid Render blueprint value); removed invalid `logDrain` field; aligned worker region to `frankfurt` (matches API service); removed `--prefer-offline=false` flag from worker `buildCommand`
- `.github/workflows/ci.yml` — Fixed `admin-v13` job: changed `cache-dependency-path` from `admin/package-lock.json` to root `package-lock.json` (admin depends on `@taxbridge/contracts` workspace package); switched to root `npm ci` + `npm install --legacy-peer-deps` for admin workspace install

### Added

- `backend/package-lock.json` — Generated workspace-level lockfile for CI npm cache correctness
- `mobile/package-lock.json` — Generated workspace-level lockfile for CI npm cache correctness
- `admin-dashboard/package-lock.json` — Generated workspace-level lockfile for CI npm cache correctness
- `packages/contracts/package-lock.json` — Generated workspace-level lockfile for CI npm cache correctness

### Verified

- `npx tsc --noEmit` (backend): **PASS** — zero errors
- All 8 session-opening checks pass (contamination, console.log, inline rates, Redis/Prisma singletons)
- `docs/api/openapi.json` non-empty (CI Stage 1 gate)

---

## [13.3.0] - 2026-03-09

### Fixed

- `scripts/session-checks.sh` — Check 3: tightened `FIRS` pattern to `\bFIRS\b` (word-boundary) to eliminate false positives on `firstName` field names
- `scripts/session-checks.sh` — Check 4: narrowed `ProgressBar` pattern to `import.*ProgressBar` so only import statements are flagged
- `scripts/session-checks.sh` — Check 5: extended exclusion list to filter `shadowOpacity`, `opacity`, `rgba`, `boxShadow`, `.min(`, `.max(`, `resolvedSize`, `Math.*`, and `@risk-weight` annotated lines from the inline-rate drift scan
- `scripts/session-checks.sh` — Check 7: exclude comment-line `console.log` occurrences (`//.*console.log`, `\*.*console.log`) so JSDoc examples do not trigger the gate
- `mobile/src/components/education/TaxEducation.tsx` — Replaced deprecated `ProgressBar` import/usage with an inline `Animated.View` progress bar; added `progressTrack`/`progressFill` styles (C-13)
- `mobile/src/screens/tabs/TaxToolsScreen.tsx` — Removed unused `ProgressBar` from design-system import (C-13)
- `backend/src/services/compliance.ts` — Replaced hardcoded `0.10`/`0.05` penalty rate literals in `NTA2025_DEADLINES` with `PENALTY_RATES.underDeduction.base` / `.interest` from `@taxbridge/contracts` (C-04/C-10)
- `backend/src/services/riskScoring.ts` — Extracted algorithmic scoring weights into named `W_*` constants annotated `@risk-weight`; C-09 exempt as these are not tax rates
- `backend/src/routes/filings/wht.ts` — Replaced inline `0.10` runtime guard with `WHT_PROFESSIONAL_RATE` constant from `@taxbridge/contracts` (C-04/C-10)
- `mobile/src/services/tax/rules/nigeria-2025.ts` — Replaced inline `0.10` charitable-donation cap with `DONATIONS_MAX_RATE = CGT_RATE` from `@taxbridge/contracts` (C-04/C-10)
- `backend/src/routes/invoices.ts` — Removed Zod schemas from Fastify `schema:` blocks (invalid in Fastify 5); migrated to manual `.safeParse()` pattern matching canonical v13 route style; resolves `FastifyError: schema is invalid: data/required must be array` that blocked OpenAPI generation

### Verified

- All 8 session-opening checks pass (Checks 3–7 code gates: 0 hits each)
- `npx tsc --noEmit` (backend): **PASS** — zero errors
- `npm run docs:api`: **PASS** — `docs/api/openapi.json` generated (23,402 bytes)

---

## [13.2.0] - 2026-03-09

### Added

- `backend/src/app.ts` — Registered missing route plugins: `invoicesRoutes`, `invoiceManagementRoutes`, `paymentRoutes`, `businessRoutes`, `cryptoRoutes`, `reconciliationRoutes`, `v2IntelligenceRoute`, `v2OnboardingRoute`, `v2NdpcExportRoute`
- `scripts/smoke-test.sh` — Extended from 5 to 7 smoke checks covering health, preflight, OpenAPI spec, V2 dashboard, and V2 analytics revenue; auth-gated routes now assert `< 500` instead of `--fail`

### Fixed

- `backend/src/cron/orchestrator.ts` — Corrected `SMERiskRecord` field mapping (`taxHealthScore` → `score`, `riskBand` → `band`, `anomalyCount` → `anomalyScore`); replaced invalid upsert-by-non-unique-`orgId` with `findFirst` + `create`/`update` pattern
- `.github/workflows/ci.yml` — Removed invalid empty `needs: []`, aligned blue-green checklist paths to `docs/CHANGELOG.md` and `docs/PRODUCTION_READY.md`, and stopped canonical production gating jobs from depending on the legacy `admin-v13` job

---

## [13.1.0] - 2026-03-08

### Added

- `docs/ADMIN_ARCHITECTURE.md` — Architecture decision record documenting canonical admin surface
- `admin-dashboard/lib/backendHealth.ts` — Shared utility for public health endpoint fetching
- `admin-dashboard/app/api/admin/audit/route.ts` — Server-side audit API proxy

### Changed

- Root workspace `type-check:admin` and `build` scripts now target the canonical `admin-dashboard/` production surface instead of building the legacy `admin/` app as part of production-oriented root flows
- `deploy-production.yml` no longer triggers production admin deploy logic from legacy `admin/**` changes
- **Admin Surface Consolidation**: `admin-dashboard/` confirmed as canonical production admin
- Root workspace scripts now target `admin-dashboard` instead of `@taxbridge/admin`
- Normalized all health API routes to use shared `backendHealth.ts` utility
- Refactored `audit` page to use `/api/admin/audit` proxy with proper pagination
- Refactored `dlq` page to use `/api/admin/health/queues` for queue telemetry
- Backend v2 routes normalized to canonical singletons (`prisma`, `redis`, `request.log`)

### Fixed

- Broken direct `/api/v2/admin/*` browser calls in deployed admin dashboard
- Inconsistent backend URL resolution across health routes
- Missing fallback handling in audit and DLQ pages

---

## [13.0.0-sovereign] - 2026-03-08

### Added

- Canonical backend bootstrap via `backend/src/server.ts`
- OpenAPI generation script at `scripts/dump-swagger.ts`
- Session opening checks at `scripts/session-checks.sh`
- Accuracy gates at `scripts/run-accuracy-gates.sh`
- V13 prompt marker verification in `scripts/verify-prompts.ts`
- V13 pipeline skeleton in `.github/workflows/pipeline.yml`

### Changed

- Aligned org context resolution with lowercase organisation status handling
- Aligned dashboard response shape to use `upcomingDeadlines`
- Updated auth token org resolution to derive membership from `OrgMember`
- Updated TOTP route to use canonical Redis singleton and stronger backup-code hashing

### Resolved

- Backend route/schema reconciliation against full v13 contract
- Admin API health surface completion
- Validation sweep and smoke-test completion
