# TAXBRIDGE V13 — IMPLEMENTATION PROMPT

**File:** `/prompts/v13_implementation_prompt.md`
**Authority:** Execute against `v13_master_prompt.md` (v13.7) — that document is the single source of truth.
**Revision:** v13.7 — OrgStatus enum case fix, CI Stage 1 gate logic fix, c8 `--workspace=` flag, render.yaml logDrain canonicalised, validToken test clarification, smoke test #6 idempotency/duplicate separation, quick reference additions (2026-03-08)
**Branch:** `upgrade/v13-sovereign-20260307`
**Commit convention:** `feat(v13): <scope> — <description>`
**Tag on completion:** `git tag v13.0.0-sovereign`

---

## AGENT RULES — READ BEFORE WRITING A SINGLE LINE

1. Run §3 session-opening checks first. All 8 must return 0 or stop.
2. Framework is **Fastify 5** — not Express. Never use `app.use()`, `Router()`, `res.json()`, or `import from 'express'`. All middleware is Fastify plugins (`fastify.register()`) or preHandlers. See master §5.
3. Never write inline tax math outside `packages/contracts/src/`. Import from `@taxbridge/contracts`.
4. Never use `console.log` — always `request.log.info/warn/error` in route handlers; `logger.info/warn/error` from `backend/src/lib/logger.ts` in services.
5. Never hardcode `CBN_MPR` — `parseFloat(process.env.CBN_MPR ?? '0.2725')` only.
6. Never write `new PrismaClient` in routes/services — import from `lib/prisma.ts` singleton (C-43).
7. Never write `new IORedis` outside `lib/redis.ts` and `services/eventBus.ts` (C-46).
8. Every POST/PATCH mutation route must include `validate(Schema)` + `idempotency` preHandlers where required.
9. Every dashboard section must be wrapped in `<DashboardZone zone="…">` (C-18).
10. `router.replace` on wizard/onboarding completion — never `router.push`.
11. `runPreFlight()` must complete before the Submit CTA renders in any filing wizard.
12. Admin pages live at `admin/src/app/admin/*/page.tsx` (Next.js 15 App Router) — never under `pages/`.
13. Use `c8` for coverage (not Istanbul/nyc) — required for ESM TypeScript contracts package.
14. Admin analytics pages always fetch from `GET /api/v2/analytics/*` — never call `buildIntelligenceInput()` directly from admin code.
15. `scripts/dump-swagger.ts` must exist and be run before any deploy; `docs/api/openapi.json` must be non-empty (CI Stage 1 checks `[ -s docs/api/openapi.json ]`).
16. `prisma/seeds/smokeTestUser.ts` must upsert both `smokeTestUser` (OWNER) and `smokeTestAdminUser` (ADMIN) — both required for smoke tests #2–#5.
17. After each phase: run `npx tsc --noEmit` + accuracy gates + `npm test` before committing.
18. Ensure to prioritize canonical entrypoints and CI gates over adding new features blindly.

---

## PHASE 0 — FOUNDATION

**Branch:** `feature/v13-phase-0-foundation`

### P0-A: Environment + Singletons

**`backend/src/validateEnv.ts`**
```typescript
// Hard-crash guard — FIRST import in app.ts, before Fastify() constructor
const REQUIRED = [
  'DATABASE_URL','REDIS_URL','JWT_SECRET','NRS_API_KEY',
  'CLOUDFLARE_R2_BUCKET','CLOUDFLARE_R2_ENDPOINT',
  'CORS_ORIGIN','PORT',
  'YOUVERIFY_API_KEY',
  'FLUTTERWAVE_SECRET',
  'PAYSTACK_SECRET',
  'AFRICA_TALKING_API_KEY',
] as const;
for (const key of REQUIRED) {
  if (!process.env[key]) { process.stderr.write(`FATAL: env ${key} missing\n`); process.exit(1); }
}
// Optional with defaults (do NOT add to REQUIRED):
// SENTRY_DSN              → optional; Sentry SDK no-ops gracefully when absent
// DIGITAX_MOCK_MODE       → default 'false'
// CBN_MPR                 → default '0.2725' (use parseFloat(process.env.CBN_MPR ?? '0.2725'))
// LOG_LEVEL               → default 'info'
// LOG_FORMAT              → default 'json' in production
// REMITA_MERCHANT_ID      → required only when Remita gateway is enabled
// JWT_PUBLIC_KEY          → required in production RS256 mode; not required for HS256 local dev
```

**`backend/src/lib/prisma.ts`** — `global.__prisma` singleton (C-43)
```typescript
import { PrismaClient } from '@prisma/client';
declare global { var __prisma: PrismaClient | undefined; }
export const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query','error'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;
```

**`backend/src/lib/redis.ts`** — `global.__taxbridge_redis` IORedis singleton (C-46)
```typescript
import IORedis from 'ioredis';
declare global { var __taxbridge_redis: IORedis | undefined; }
export const redis: IORedis = globalThis.__taxbridge_redis ?? new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,  // REQUIRED by BullMQ 5 — do not remove
  enableReadyCheck: false,
});
if (process.env.NODE_ENV !== 'production') globalThis.__taxbridge_redis = redis;
```

**`backend/src/lib/logger.ts`** — Standalone Pino for services
```typescript
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['req.headers.authorization','body.password','body.tin','body.bvn','body.receiptUrl','body.documentUrl'],
  ...(process.env.LOG_FORMAT !== 'json' ? { transport: { target: 'pino-pretty' } } : {}),
});
// Usage: import { logger } from '../lib/logger' — only in services, workers, cron
// In route handlers: ALWAYS use request.log (Fastify child logger with request ID)
```

**`backend/src/metrics.ts`** — 7 Prometheus metrics with `global.__taxbridge_prom_registry` guard
```typescript
import { Registry, Histogram, Counter, Gauge } from 'prom-client';
declare global { var __taxbridge_prom_registry: Registry | undefined; }
if (!globalThis.__taxbridge_prom_registry) {
  globalThis.__taxbridge_prom_registry = new Registry();
  // Register all 7 metrics here:
  // http_request_duration_seconds (Histogram)
  // http_errors_total (Counter)
  // nrs_circuit_state (Gauge: 0=closed, 1=half-open, 2=open)
  // dlq_depth (Gauge)
  // filing_submissions_total (Counter, labels: taxType)
  // active_users_total (Gauge)
  // penalty_estimate_ngn_total (Counter)
}
export const register = globalThis.__taxbridge_prom_registry!;
```

### P0-B: Contracts Package

Create all files in `packages/contracts/src/`:

| File | Key exports |
|---|---|
| `constants.ts` | All NTA 2025 constants; `calculateRRA()`; no `CBN_MPR` literal |
| `pit.ts` | `calculatePIT({ grossIncome, rentPaid, pension })` |
| `vat.ts` | `calculateVAT({ outputVAT, inputVAT, creditBalance })` |
| `wht.ts` | `calculateWHT(amount, category)` — decision tree from §2.3 |
| `cit.ts` | `calculateCIT({ turnover, taxableProfit })` → `{ citLiability, band }` |
| `cgt.ts` | `calculateCGT({ acquisitionCost, disposalProceeds })` |
| `penalties.ts` | `calculatePenalty({ entityType, daysLate, taxAmountDue, disclosurePhase })` |
| `rbac.ts` | `UserRole` type + `ROLE_HIERARCHY` record |
| `types.ts` | `DashboardComposite`, `IntelligenceInput`, `PaginatedResponse<T>`, all shared interfaces |
| `index.ts` | Re-export everything |

Run all 5 accuracy gates after P0-B (§2.2). All must pass before continuing.

Coverage gate (run after P0-B tests):
```bash
npx c8 --check-coverage --lines 95 --functions 95 --branches 90 npm test -- --workspace=packages/contracts
```

### P0-C: Fastify Plugin Stack

Create in `backend/src/plugins/`:

- **`authenticate.ts`** — `fastify.decorate('authenticate', ...)` with `fp()`; jose JWT RS256 (prod) / HS256 (dev); reads `role_version` from Redis; rejects stale tokens. Use `storedVersion !== null &&` (NOT `storedVersion &&`) — version 0 is valid. Augment `FastifyRequest` interface with `user` type.
- **`resolveOrgContext.ts`** — `fastify.decorate('resolveOrgContext', ...)`; validates `OrgMember.status === 'active'` AND `Organisation.status !== 'suspended'`; also blocks `Organisation.status === 'pending_verification'`; sets `request.orgContext`.
- **`requireRole.ts`** — factory function returning a preHandler; checks `ROLE_HIERARCHY[actor] >= ROLE_HIERARCHY[required]`; fire-and-forget `ACCESS_DENIED` audit.
- **`require2FA.ts`** — preHandler; check `totp:verified:${userId}` in Redis (TTL 300s).
- **`validate.ts`** — preHandler factory `validate(ZodSchema)`; `Zod.safeParse(request.body)` → `reply.code(400).send({ error:'VALIDATION_ERROR', issues: result.error.issues })` on failure (C-11, C-34).
- **`idempotency.ts`** — preHandler; Redis NX `idem:${key}` 24h; replay cached response if hit (C-35); key from `X-Idempotency-Key` header.
- **`rateLimit.ts`** — export per-route config objects for `@fastify/rate-limit` per §5.5 table.

### P0-D: Core Services

- **`backend/src/services/audit.ts`** — `writeAuditEvent(input)`: always `await`; never throws; logs error + returns on DB failure.
- **`backend/src/services/eventBus.ts`** — `EventEmitter`; `setMaxListeners(30)`; export `eventBus`; export BullMQ queue instances using `redis` from `lib/redis.ts`; export `createWorkerConnection()` for BullMQ Workers (dedicated IORedis instance).
- **`backend/src/services/notifications.ts`** — Expo push + Africa's Talking SMS fallback; fire-and-forget.
- **`backend/src/services/youverify.ts`** — TIN validation wrapper (returns `{ valid, entityName, entityType, registrationDate }`); CAC/RC lookup wrapper; never stores credentials.
- **`backend/src/workers/pdfWorker.ts`** — BullMQ 5 Worker consumer; pdfkit → R2; **no `ServerSideEncryption`** (C-40); uses `createWorkerConnection()`.

### P0-E: Mobile Design System

- **`mobile/src/design-system/animation.ts`** — `DURATION`, `EASE`, `ENTER_FROM`, `ZONE_DELAY`
- **`mobile/src/design-system/ngn.ts`** — `formatNGN(amount, opts?)` (C-32); `toFixed(1)` for compact — never `toFixed(0)`
- **`mobile/src/design-system/tokens.ts`** — `COLORS`, `TYPOGRAPHY`, `SPACING`, `RADIUS` dark + light
- **`mobile/src/i18n/en.json`** + **`pidgin.json`** — seed with all keys needed for P0; **`i18n.config.ts`** with `initImmediate: false`

Pidgin spot checks (required before P0 commit):
```
"No revenue this period" → "No money enter this period"  ✓
"You're offline"         → "Network no dey"              ✓
"File VAT"               → "Pay VAT"                     ✓
"Tax filing successful"  → "Your tax don enter"           ✓
"Validation error"       → "Dem no accept am"            ✓
```

### P0-F: Shared Components

- **`SectionState`** — generic `<T>`: loading | error | isEmpty | empty | render children
- **`InlineError`** — icon + message + `onAction` retry button
- **`EmptyState`** — icon + heading + body + CTA
- **`ConfettiAnimation`** — lottie-react-native; `onError` fallback to simple ✅ icon (C-42); < 50KB JSON bundle

### P0-G: Auth Routes (Fastify Plugin)

**`backend/src/routes/v1/auth.ts`** — Fastify plugin with prefix: `/api/v1/auth`
- `POST /login` → validate credentials; issue JWT (RS256 prod / HS256 dev) + refresh token rotation; rate limit 5/min/IP
- `POST /refresh` → single-use; `handleSuspiciousReuse` on token family conflict

**`backend/src/routes/v1/auth/totp.ts`**
- `POST /setup` → speakeasy TOTP secret + QR URI; store encrypted secret in DB
- `POST /verify` → `speakeasy.totp.verify({ secret, encoding:'base32', token, window: 1 })`; issue backup codes (bcrypt cost 12, C-38); set `totp:verified:${userId}` Redis key TTL 300s
- `POST /disable` → increment `role_version` in Redis (C-44); clear TOTP secret; invalidate all sessions
- `POST /backup` → validate backup code with bcrypt; invalidate used code immediately (single-use)

### P0-H: App Assembly

Assemble **`backend/src/app.ts`** with exact plugin registration order from §5.1:
```
validateEnv (import) → Fastify({ trustProxy, logger }) → helmet → cors → compress → rateLimit
→ multipart → content-type parser → swagger → swagger-ui → authenticatePlugin → resolveOrgCtxPlugin
→ all route plugins → setErrorHandler
```

Assemble **`backend/src/server.ts`**:
```typescript
import { buildApp } from './app';
import { registerCronJobs } from './cron/orchestrator';
async function start() {
  const app = await buildApp();
  app.addHook('onReady', () => { registerCronJobs(app); });
  await app.listen({ port: parseInt(process.env.PORT!, 10), host: '0.0.0.0' });
}
start().catch(err => { process.stderr.write(String(err) + '\n'); process.exit(1); });
```

### P0-I: OpenAPI Spec Generation

**`scripts/dump-swagger.ts`** — auto-generate `docs/api/openapi.json`:
```typescript
import { buildApp } from '../backend/src/app';
import { writeFileSync, mkdirSync } from 'fs';

const app = await buildApp();
await app.ready();
mkdirSync('docs/api', { recursive: true });
writeFileSync('docs/api/openapi.json', JSON.stringify(app.swagger(), null, 2));
await app.close();
console.log('✅ OpenAPI spec written to docs/api/openapi.json');
```

Add to root `package.json` scripts: `"docs:api": "tsx scripts/dump-swagger.ts"`

Run `npm run docs:api` and verify `[ -s docs/api/openapi.json ]` before P0 completion commit.

**P0 Complete when:** `npx tsc --noEmit → 0 errors`; all 5 accuracy gates pass; `npm test ≥ 120 passing`; c8 coverage gate passes on contracts; `docs/api/openapi.json` exists and is non-empty (run `npm run docs:api`).

---

## PHASE 1 — CORE PLATFORM

**Branch:** `feature/v13-phase-1-core-platform`

### P1-A: Intelligence Services

**`backend/src/services/anomalyEngine.ts`**
- Pure function `computeAnomalies(input: IntelligenceInput): AnomalySignal[]`
- 8 signals per §11 table; hard cap: `signals.sort(bySeverityDesc).slice(0, 5)`
- Entire function body in `try { ... } catch(e) { Sentry.captureException(e); logger.error(e); return []; }`

**`backend/src/services/riskScoring.ts`**
- `computeRiskScore(input: IntelligenceInput): number`
- 5 components per §11; weights sum to 0.95 → scale to 100
- `return Math.max(0, Math.min(100, Math.round(computedTotal / 0.95)))` — always before any DB write

**`backend/src/services/dashboardService.ts`**
- `buildIntelligenceInput(orgId: string, prisma: PrismaClient): Promise<IntelligenceInput>`
- Export `FALLBACK_STATS`, `FALLBACK_ANOMALIES`, `FALLBACK_DEADLINES`, `FALLBACK_NRS_HEALTH` constants

**`backend/src/services/nrsService.ts`**
- opossum circuit breaker per §5.6
- `callNRSAPI(payload)` wrapped in breaker
- On open: `eventBus.emit('nrs.circuitOpened')` + update `nrsCircuitState` gauge (Gauge value: 2)
- `DIGITAX_MOCK_MODE=true` → bypass; return `{ irn: \`MOCK-IRN-${Date.now()}\` }`

### P1-B: Dashboard Route

```typescript
// GET /api/v1/dashboard
// preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('VIEWER')]
// config.rateLimit: { max: 30, timeWindow: '1 minute' }
// Cache: Redis key `dashboard:composite:v1:${orgId}:${userId}` TTL 120s
// On cache hit: return { ...cached, meta: { cached: true, cacheAge } }
// On cache miss: Promise.all with per-call FALLBACK_* on every .catch()
// Cache write: redis.setex(...).catch(() => {}) // fire-and-forget — NEVER await
```

### P1-C: Cron Orchestrator

**`backend/src/cron/orchestrator.ts`** — register **exactly 7** node-cron jobs:

| Job | Schedule (WAT) | Action |
|---|---|---|
| `riskScoringCron` | Daily 04:00 | computeRiskScore for all orgs; upsert SMERiskRecord |
| `snapshotCron` | Daily 04:30 | Insert TaxHealthSnapshot per org |
| `snapshotPruneCron` | Weekly Sunday 03:00 | Delete TaxHealthSnapshot entries > 24 months |
| `deadlineCron` | Daily 07:00 | Generate upcoming ComplianceEvent reminders |
| `queueHealthCron` | Every 5 min | Check BullMQ queue backlog; alert if nrs-stamp depth > 50. **Monitor only — NEVER call queue.add() or job.retry()** |
| `dlqMonitorCron` | Every 15 min | Alert if DLQJob count > 10 |
| `sessionCleanupCron` | Daily 02:00 | Prune expired refresh tokens |

Pass `{ timezone: 'Africa/Lagos' }` to node-cron for time-based jobs. No `setInterval` anywhere else. `registerCronJobs(fastify)` called from `server.ts` `onReady` hook.

### P1-D: Monitoring Routes

**`backend/src/routes/v2/monitoring.ts`**
- `GET /api/v2/monitoring/health` — always HTTP 200; `{ status: 'healthy' | 'degraded', checks: {} }`; never 503
- `GET /api/v2/monitoring/metrics` — preHandler: `[fastify.authenticate, requireRole('ADMIN')]`; `register.metrics()`

### P1-E: Mobile Dashboard

**`mobile/src/components/dashboard/TaxHealthGauge.tsx`**
- `buildArcPath` + `scoreToStroke` — `'worklet'` as **first line** (both functions)
- Export `computeGaugeMode(data)` from this file — imported by DashboardScreen
- `accessibilityRole="progressbar"` + `accessibilityLabel={\`Tax health: ${score} out of 100\`}`
- Animate with `withTiming(score, { duration: DURATION.slow, easing: EASE.gauge })`

**`mobile/src/components/dashboard/DashboardZone.tsx`**
- Props: `{ zone: 'apex'|'signal'|'action'|'context'|'ambient', visible: boolean, urgent?: boolean, children }`
- Animation from `animation.ts` tokens only (C-16)
- `context` zone: `delay → 0` when `urgent=true`

**`mobile/src/components/dashboard/DashboardSkeleton.tsx`**
- Exact geometry per §12 skeleton table — zero layout shift contract
- Shimmer: `withRepeat(withTiming(1, { duration: DURATION.skeleton, easing: EASE.shimmer }), -1, true)`
- All blocks: `accessibilityElementsHidden={true}`

**`mobile/src/hooks/useDashboard.ts`**
```typescript
export function useDashboard() {
  const { orgId } = useAuthStore();
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
    });
    return () => sub.remove();
  }, [orgId]);
  return useQuery({
    queryKey: ['dashboard', orgId],
    queryFn: () => apiClient.get('/api/v1/dashboard'),
    staleTime: 30_000, gcTime: 300_000,
    networkMode: 'offlineFirst',
  });
}
```

**`mobile/src/screens/DashboardScreen.tsx`**
- Implement canonical structure exactly per §12 dashboard section in master prompt
- Import `computeGaugeMode` from `TaxHealthGauge.tsx` — never inline (C-19, C-20)
- All lists → `@shopify/flash-list FlashList` — never `FlatList`
- Exactly 5 `<DashboardZone>` elements (C-17); verify with `grep -c '<DashboardZone' → 5`

### P1-F: Admin Foundation (Next.js 15 App Router)

> **CRITICAL:** All admin pages are in `admin/src/app/admin/*/page.tsx` — App Router. Never use `admin/src/pages/` directory.

**`admin/src/app/admin/layout.tsx`** — Shared shell (required; implement §23.1 spec)
- Persistent sidebar (240px) with nav items: Analytics | Audit | DLQ | Team | API Health
- Topbar (56px): Logo | Org switcher | `⌘K` Search | Notification bell | Avatar dropdown
- Dark mode toggle; `dark:` Tailwind variants throughout
- Theme stored in `localStorage` (client component only); system `prefers-color-scheme` as default
- No flash of wrong theme: inline script in `<head>` before React hydration

**`admin/src/middleware.ts`** (Edge Runtime)
- jose JWT verification (RS256 or HS256 based on env)
- `role_version` cache 30s TTL
- CSRF: compare `X-CSRF-Token` header vs `csrf_token` cookie → 403 `CSRF_INVALID` on mismatch

**`admin/src/app/admin/analytics/page.tsx`** — implement §23.2 spec
- 5 panels in 2-col responsive grid; each panel is `<Card>` component
- All panels: custom Recharts `<Tooltip>`; legend; accessible `aria-label`
- All data from `GET /api/v2/analytics/*` — never call `buildIntelligenceInput()` directly
- Every `.catch(() => FALLBACK_*)`; loading state: skeleton shimmer matching chart dimensions

**`admin/src/app/admin/audit/page.tsx`** — implement §23.4 spec
- Filter sidebar (240px, collapsible) + timeline; cursor-paginated infinite scroll via IntersectionObserver
- NDJSON streaming export from `GET /api/v2/audit/export`
- Inline diff viewer: `bg-green-50`/`bg-red-50` added/removed lines; no new dependencies

**`admin/src/app/admin/dlq/page.tsx`** — implement §23.3 spec
- Full-width table with sticky header; toolbar with filter + search + bulk actions
- Bulk retry > 10: `<ConfirmModal>` + `require2FA` modal before executing

**`admin/src/app/admin/team/page.tsx`** — implement §23.5 spec
- Two-panel layout; role badge colours per §23.5; last-OWNER guard client + server

**`admin/src/app/admin/api-health/page.tsx`** — implement §23.6 spec
- 3-column stat cards: NRS Circuit State + DLQ Depth + Last NRS Stamp + P99 Latency
- Auto-refresh every 30s; data from `GET /api/v2/monitoring/health` + `/metrics`
- Status indicators: coloured dot + text label + icon (C-15 three-channel rule)

**Shared admin components** — implement §23.7:
- `admin/src/components/ui/Card.tsx`
- `admin/src/components/ui/Badge.tsx`
- `admin/src/components/ui/Skeleton.tsx`
- `admin/src/components/ui/EmptyState.tsx`
- `admin/src/components/ui/ConfirmModal.tsx`
- `admin/src/components/ui/CommandPalette.tsx`

**P1 Complete when:** dashboard composite returns 200 with all 4 fields; TaxHealthGauge renders at 60fps; admin analytics loads with `FALLBACK_*` on network error; admin shell renders with sidebar + topbar on all pages; admin api-health page exists; cron orchestrator starts with exactly 7 jobs logged.

---

## PHASE 2 — TAX FILING MODULES

**Branch:** `feature/v13-phase-2-filing-modules`

### P2-A: Onboarding Routes (Fastify plugins)

**`backend/src/routes/v1/onboarding/tin.ts`**
- preHandler: `[fastify.authenticate, fastify.resolveOrgContext, requireRole('OWNER'), validate(TINSchema)]`
- Rate limit: 3/min/IP
- Body: `{ tin: string }` — Zod: `z.string().regex(/^\d{8}$/)`
- Flow: Youverify TIN lookup → NRS cross-reference → `await writeAuditEvent` → store in orgProfile
- States: IDLE → VALIDATING → SUCCESS | FAILED | NETWORK_ERROR (surface ALL states in mobile)

**`backend/src/routes/v1/onboarding/cac.ts`**
- preHandler: `[fastify.authenticate, fastify.resolveOrgContext, requireRole('OWNER'), validate(CACSchema)]`
- Body: `{ rcNumber: string }` — Zod: `z.string().regex(/^RC-\d+$/i)`
- Youverify → entityName, directors, status → store `cacRcNumber` + `entityName`

**`backend/src/routes/v1/onboarding/progress.ts`**
- `PATCH /progress` — update `OnboardingProgress.step`; `router.replace('/dashboard')` on `completed: true`

### P2-B: Filing Routes (Fastify plugins)

All filing routes: `preHandler: [fastify.authenticate, fastify.resolveOrgContext, requireRole('ACCOUNTANT'), validate(Schema), idempotency]`

**`backend/src/routes/v1/filings/nil.ts`** — implement exactly per §5.2 example
- 409 on duplicate (not 422); audit event always awaited

**`backend/src/routes/v1/filings/vat.ts`**
- `VATCreditBalance.findFirst({ where: { orgId } })` — never recompute (C-22)
- `calculateVAT({ outputVAT, inputVAT, creditBalance })` from contracts

**`backend/src/routes/v1/filings/wht.ts`**
- `calculateWHT(amount, category)` from contracts only
- Dual exemption check: valid TIN AND monthly total ≤ ₦2M (C-23)

**`backend/src/routes/v1/filings/paye.ts`**
- `calculatePIT({ grossIncome, rentPaid, pension })` per employee from contracts
- Batch audit: single `writeAuditEvent` with `metadata: { employeeCount }`

**`backend/src/routes/v1/filings/cit.ts`**
- `calculateCIT({ turnover, taxableProfit })` from contracts — returns `{ citLiability, band }` (C-41)
- Zero inline math

**`backend/src/routes/v1/payroll/run.ts`**
- `idempotency` preHandler required (C-35)
- `validate(PayrollSchema)` preHandler required (C-34)

### P2-C: Compliance Routes

**`backend/src/services/compliancePreFlight.ts`**
- `runPreFlight(orgId, taxType, period, prisma)` — NEVER throws (C-07)
- 4 blocking checks via `Promise.allSettled`
- Return `{ pass: boolean, checks: PreFlightCheck[] }`

**`backend/src/routes/v1/compliance/preflight.ts`**
- Call `runPreFlight()`; return full result; submit CTA blocked until `pass === true`

**`backend/src/routes/v1/compliance/penalty-estimate.ts`**
- `calculatePenalty()` from contracts; `CBN_MPR` from env

**`backend/src/routes/v1/compliance/vat-credit.ts`**
- `GET` only — `VATCreditBalance.findFirst`; never recompute (C-22)

### P2-D: Mobile Filing Wizards

All 5 filing wizards in `mobile/src/screens/filings/`:
- `VATFilingWizard.tsx`, `WHTWizard.tsx`, `PAYEWizard.tsx`, `NILReturnScreen.tsx`, `CITFilingWizard.tsx`

Each wizard must:
1. Call `runPreFlight()` API; block Submit CTA until `preflight.pass === true`
2. Show inline warnings for non-blocking preflight checks
3. Generate `X-Idempotency-Key: crypto.randomUUID()` before first attempt
4. On network error: queue to `AsyncStorage` with same key; retry on reconnect
5. On success: `ConfettiAnimation` (with `onError` fallback) → PDF receipt download
6. `KeyboardAvoidingView` + `ScrollView keyboardShouldPersistTaps="handled"`
7. `AccessibilityInfo.announceForAccessibility` on every step change

`grep -rln "runPreFlight\|preflight" mobile/src/screens/filings --include="*.tsx" | wc -l`  → must equal 5

### P2-E: Admin Analytics + Audit API

**`backend/src/routes/v2/analytics.ts`** — 5 endpoints (ADMIN+):
- `GET /api/v2/analytics/revenue` — time-series revenue trend by period
- `GET /api/v2/analytics/compliance-rate` — filing completion % across orgs
- `GET /api/v2/analytics/risk-distribution` — RiskBand distribution
- `GET /api/v2/analytics/nrs-health` — NRS stamp success rate + circuit state
- `GET /api/v2/analytics/platform-growth` — org + user growth over time

**`backend/src/routes/v2/audit.ts`**
- `GET /api/v2/audit` — cursor-paginated; filters: orgId (SUPER_ADMIN), actorId, action, dateRange
- `GET /api/v2/audit/export` — NDJSON streaming; `Content-Type: application/x-ndjson`

**`backend/src/routes/v2/dlq.ts`**
- `GET /api/v2/dlq` — cursor-paginated DLQJob list; filter by resolved/queue
- `POST /api/v2/dlq/:id/retry` — preHandler: `[fastify.authenticate, requireRole('ADMIN'), require2FA]` when bulk > 10
- `POST /api/v2/dlq/:id/resolve` — mark resolved; `resolvedAt` + `resolvedBy`

**P2 Complete when:** all 5 filing wizards have preflight gate; VAT credit never recomputed; idempotency on all filing routes; admin analytics API returns data for all 5 panels.

---

## PHASE 3 — DEPLOYMENT & INFRASTRUCTURE

**Branch:** `feature/v13-phase-3-deployment`

### P3-A: Docker + Render

**`Dockerfile`** — multi-stage:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY backend/prisma ./backend/prisma
RUN npm ci
COPY . .
RUN npx prisma generate --schema=./backend/prisma/schema.prisma
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S taxbridge && adduser -S taxbridge -G taxbridge
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/package.json ./package.json
RUN npx prisma generate --schema=./backend/prisma/schema.prisma
USER taxbridge
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v2/monitoring/health || exit 1
CMD ["node", "dist/server.js"]
# ↑ dist/server.js — NOT dist/app.js
```

**`render.yaml`**:
```yaml
services:
  - type: web
    name: taxbridge-api
    region: fra
    runtime: docker
    healthCheckPath: /api/v2/monitoring/health
    envVars:
      - key: NODE_ENV
        value: production
    logDrain:
      type: grafana-loki  # required per §19 — do not change to datadog
```

### P3-B: CI/CD Pipeline — 5 Stages

**`.github/workflows/pipeline.yml`**:

```yaml
# Stage 1: Documentation + Contamination gate
- run: grep -q "## \[13\." docs/CHANGELOG.md || exit 1
- run: grep -rn "FIRS\|from 'express'" backend/src mobile/src admin/src --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l | xargs -I{} test {} -eq 0
- run: '! grep -nE "express|SDK 51|pages/admin" prompts/v13_master_prompt.md'
- run: '[ -s docs/api/openapi.json ] || exit 1'

# Stage 2: TypeScript
- run: npx tsc --noEmit  # → 0 errors

# Stage 3: Immutability + schema integrity
- run: awk '/model AuditEvent/,/^}/' backend/prisma/schema.prisma | grep -c updatedAt | xargs test 0 -eq
- run: awk '/model TaxHealthSnapshot/,/^}/' backend/prisma/schema.prisma | grep -c updatedAt | xargs test 0 -eq
- run: grep -c "cron\.schedule(" backend/src/cron/orchestrator.ts | xargs test 7 -eq
- run: grep -rn "<FlatList" mobile/src --include="*.tsx" | grep -v node_modules | wc -l | xargs test 0 -eq

# Stage 4: Tests + coverage
- run: npm test --workspaces -- --coverage  # ≥550 passing, 0 failing
- run: npx c8 --check-coverage --lines 95 --functions 95 --branches 90 npm test -- --workspace=packages/contracts

# Stage 5: Build + Smoke
- run: docker build -t taxbridge-api .
- run: bash scripts/smoke-test.sh $STAGING_URL
```

### P3-C: EAS Configuration

**`mobile/eas.json`** — implement exactly per §16 EAS spec; all 3 profiles `compileSdkVersion: 36`, `targetSdkVersion: 35`; `SENTRY_DSN` via `eas secret:create` — never in this file (C-33).

### P3-D: Grafana Configuration

**`infra/grafana/alerts.yml`** — 5 rules per §18 table

**`infra/grafana/dashboard.json`** — 6 panels:
1. API error rate (time-series)
2. Dashboard P99 latency (gauge)
3. DLQ depth (stat)
4. NRS circuit state (stat: closed/half-open/open with coloured dot + label)
5. Filing submissions by type (bar chart)
6. Active users (stat)

**`infra/k6/load-test.js`**
```javascript
export const options = {
  vus: 200, duration: '10m',
  thresholds: { http_req_duration: ['p(95)<2000'], http_req_failed: ['rate<0.01'] },
};
```

### P3-E: Scripts

**`scripts/backfill-v13.ts`**
- Parse `--dry-run` from `process.argv.includes('--dry-run')`
- Operations (all idempotent — `INSERT ... ON CONFLICT DO NOTHING` or upsert):
  1. Insert missing `TaxHealthSnapshot` for last 30 days
  2. Backfill `OrgMember.orgId` index
  3. Set `OnboardingProgress.step` for pre-existing orgs
  4. Seed `SMERiskRecord` defaults: `{ taxHealthScore: 50, riskBand: 'medium', anomalyCount: 0 }`
- Dry-run: logs SQL without executing

**`scripts/seed-dev.ts`** — Acme Ltd + `smokeTestUser` with deterministic credentials; guard: `if (process.env.NODE_ENV === 'production') process.exit(1)`

**`scripts/verify-prompts.ts`** — validates 12 module markers (M00–M11) in `v13_master_prompt.md`; exits 1 on failure

**`scripts/compress-assets.sh`** — pngquant all PNGs; minify Lottie JSONs; fail if any file > 50KB

**`scripts/smoke-test.sh`** — 7 required smoke tests + 1 duplicate-detection check per §17; expects `STAGING_URL`; exits 1 if any fail

**`scripts/session-checks.sh`** — automates all 8 §3 session-opening checks

**`scripts/run-accuracy-gates.sh`** — runs all 5 §2.2 accuracy gates; exits 1 on any failure

**`backend/prisma/seeds/smokeTestUser.ts`** — upsert `smokeTestUser` (OWNER role) + `smokeTestAdminUser` (ADMIN role) + Acme Ltd org; all upserts idempotent; production guard (`process.env.NODE_ENV === 'production' → exit(1)`)

**P3 Complete when:** Docker build succeeds with `CMD ["node", "dist/server.js"]`; `render.yaml` validates with `region: fra`; CI pipeline runs all 5 stages; admin api-health page renders correctly; `docs/api/openapi.json` is non-empty; k6 load test script executes against staging.

---

## PHASE 4 — HARDENING & CLEANUP

**Branch:** `feature/v13-phase-4-hardening`

### P4-A: Full Test Suite

**Target:** ≥550 passing, 0 failing, ≥95% line coverage on `contracts/`

Use `fastify.inject()` for all backend route tests — not `supertest`:
```typescript
import { buildApp } from '../../app';
import { FastifyInstance } from 'fastify';

describe('Dashboard route', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('returns 200 with composite data', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      headers: { authorization: `Bearer ${validToken}` }, // validToken: sign a test JWT in beforeAll using JWT_SECRET from test env
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);  // never response.body
    expect(body).toHaveProperty('stats');
    expect(body).toHaveProperty('topAnomalies');
    expect(body).toHaveProperty('upcomingDeadlines');
    expect(body).toHaveProperty('nrsHealth');
  });
});
```

**Priority test files:**

`packages/contracts/src/__tests__/`:
- `pit.test.ts` → all 6 bands + RRA calculation + accuracy gate (₦632,400 ±₦1)
- `wht.test.ts` → all 5 categories + dual exemption logic
- `cit.test.ts` → small (₦0) + large (₦4.5M) + band boundary
- `penalties.test.ts` → all 3 disclosure phases + interest calculation
- `vat.test.ts` → net payable + credit carryforward

`backend/src/__tests__/`:
- `dashboard.test.ts` → cache hit/miss + `FALLBACK_*` on each call failure
- `nil-filing.test.ts` → success + 409 idempotency replay + audit event awaited
- `anomalyEngine.test.ts` → all 8 signals + cap at 5 + throw → `[]`
- `riskScoring.test.ts` → clamping at 0 and 100 + all 5 components
- `authenticate.test.ts` → `role_version` stale rejection; version 0 valid (not falsy)
- `preflight.test.ts` → pass + fail + partial (warnings not blocking)
- `webhook-flw.test.ts` → HMAC valid + invalid + Redis idempotency replay
- `webhook-paystack.test.ts` → `x-paystack-signature` HMAC + idempotency

Redis setup: `ioredis-mock` or dedicated test DB index 15.

### P4-B: i18n Completeness

```bash
yarn i18n:check  # → exit 0
# All keys in en.json must exist in pidgin.json
```

### P4-C: Security Audit

```bash
npx snyk test --severity-threshold=high
# → 0 HIGH or CRITICAL vulnerabilities

# PII handling audit
grep -rn "tin\|bvn\|password" backend/src --include="*.ts" | grep -v "redact\|bcrypt\|masked"

# Rate limit smoke test (6th request must be 429)
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    https://staging.taxbridge.ng/api/v1/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"test@x.com","password":"wrong"}'
done
# → 5× 401, 6th → 429 { error: 'RATE_LIMITED' }

# No Express imports
grep -rn "from 'express'" backend/src --include="*.ts"  # → 0
```

### P4-D: Codebase Cleanup

```bash
# 1. Verify no active imports of orphaned files
grep -rn "HomeScreen\|taxHelpers\|event-bus\.ts\|taxCalculator\|'express'" \
  backend/src mobile/src admin/src --include="*.ts" --include="*.tsx" | grep -v node_modules
# → resolve all hits before deleting

# 2. Remove orphaned files
git rm -f backend/src/services/event-bus.ts backend/src/services/taxCalculator.ts \
  backend/src/routes/filings.ts mobile/src/screens/HomeScreen.tsx \
  mobile/src/utils/taxHelpers.ts scripts/backfill-v12.ts \
  scripts/validate-production-readiness.ps1 2>/dev/null || true

# 3. Remove superseded versioned prompt files
git rm -f prompts/v13_master_prompt_FINAL_v5.md 2>/dev/null || true
git rm -f prompts/v13_master_prompt_FINAL_v6.md 2>/dev/null || true
git rm -f prompts/v13_implementation_prompt_FINAL_v5.md 2>/dev/null || true
git rm -f prompts/v13_implementation_prompt_FINAL_v6.md 2>/dev/null || true
# After cleanup: only prompts/v13_master_prompt.md + prompts/v13_implementation_prompt.md

# 3b. Remove DEPLOYMENT_v*.md markers
git rm -f DEPLOYMENT_v10.3_COMPLETE.md DEPLOYMENT_v11.0_COMPLETE.md DEPLOYMENT_v12_COMPLETE.md 2>/dev/null || true

# 4. Documentation normalization (§22)
find . -maxdepth 1 -name "*.md" | grep -vE "README|LICENSE|SECURITY|CONTRIBUTING" \
  | xargs -I{} git mv {} docs/ 2>/dev/null || true
grep "## \[13\." docs/CHANGELOG.md || echo "⚠️  Add v13 CHANGELOG entry"

# 5. Remove Express packages
npx depcheck --ignores="@types/*,eslint-*,prettier-*" 2>/dev/null
# Remove: express, express-rate-limit, cors (express), compression (express)
# Ensure: @fastify/rate-limit, @fastify/cors, @fastify/compress, @fastify/helmet, @fastify/multipart

# 6. Environment variable audit
diff <(grep -oE '^[A-Z_]+' .env.example | sort) \
     <(grep -oE '"[A-Z_]+"' backend/src/validateEnv.ts | tr -d '"' | sort)

# 7. Verify clean
npx tsc --noEmit && npm test --workspaces
# → 0 errors, ≥550 passing, 0 failing
```

### P4-E: Pre-Deploy Validation

```bash
bash scripts/run-accuracy-gates.sh    # 5/5 pass
yarn i18n:check                       # exit 0
npx snyk test --severity-threshold=high  # 0 HIGH/CRITICAL
npm test --workspaces -- --coverage   # ≥550 passing, 0 failing, contracts/ ≥95%
npx tsc --noEmit                      # 0 errors
bash scripts/session-checks.sh        # all 8 return 0
[ -s docs/api/openapi.json ] || npm run docs:api   # openapi.json non-empty
ls admin/src/app/admin/api-health/page.tsx          # file must exist
docker build -t taxbridge-api:v13 .   # exit 0; CMD is dist/server.js
docker run --rm -p 3001:3001 --env-file .env taxbridge-api:v13 &
sleep 5 && curl -f http://localhost:3001/api/v2/monitoring/health
# → { status: 'healthy' }
STAGING_URL=https://staging.taxbridge.ng bash scripts/smoke-test.sh  # 7/7 pass
grep "## \[13\." docs/CHANGELOG.md    # v13 entry present
```

Run every item in the §19 Pre-Deploy Checklist — every checkbox must be ✓.

### P4-F: Final Commit

```bash
git add -A
git commit -m "feat(v13): SOVEREIGN — complete production deployment

Stack: Fastify 5 · Expo SDK 54 · Next.js 15 · Prisma 5.22 · BullMQ 5 · node-cron
- 47 constraints enforced and CI-verified
- All 5 NTA 2025 tax accuracy gates pass (8 anomaly signals)
- 5 CI stages: contamination/TypeScript/immutability/tests/build
- Fastify 5 fully replaces Express — zero express imports
- Youverify + Paystack + Remita integrations added
- Next.js 15 App Router for Admin (pages/ removed)
- Admin shell: sidebar + topbar layout.tsx implemented (§23.1)
- World-class admin UX: analytics/audit/dlq/team/api-health redesigned (§23)
- Admin api-health page added (§23.6); C-15 three-channel status indicators
- scripts/dump-swagger.ts added; docs/api/openapi.json auto-generated
- User + RefreshToken + AccountantClient models added to Prisma schema
- smokeTestAdminUser seeded (ADMIN) alongside smokeTestUser (OWNER)
- c8 (V8 native) coverage for ESM TypeScript contracts
- §22 Documentation normalization complete
- 7 smoke tests pass
- Full codebase cleanup: all versioned _FINAL_v*.md prompts and orphaned files removed"

git tag v13.0.0-sovereign
git push origin upgrade/v13-sovereign-20260307 --tags
```

---

## COMPLETION CRITERIA — ALL 24 MUST PASS

```bash
# 1. Session opening (§3)
bash scripts/session-checks.sh                             # all 8 → 0

# 2. Accuracy gates (§2.2)
bash scripts/run-accuracy-gates.sh                         # 5/5 pass

# 3. Contamination scan
grep -rn "FIRS\|from 'express'" backend/src mobile/src admin/src \
  --include="*.ts" --include="*.tsx" | grep -v node_modules  # → 0

# 4. TypeScript
npx tsc --noEmit                                           # 0 errors

# 5. Tests
npm test --workspaces                                      # ≥550 passing, 0 failing

# 6. Coverage (c8 — V8 native; required for ESM TypeScript)
npx c8 --check-coverage --lines 95 --functions 95 --branches 90 npm test -- --workspace=packages/contracts

# 7. i18n
yarn i18n:check                                            # exit 0

# 8. Snyk
npx snyk test --severity-threshold=high                    # 0 HIGH/CRITICAL

# 9. Docker build
docker build -t taxbridge-api:v13 .                        # exit 0; CMD is dist/server.js

# 10. CI pipeline
gh workflow run pipeline.yml --ref upgrade/v13-sovereign-20260307  # all 5 stages green

# 11. 7 smoke tests
bash scripts/smoke-test.sh $STAGING_URL                    # 7/7 pass

# 12. Cron jobs — count actual cron.schedule() calls (not comments)
grep -c "cron\.schedule(" backend/src/cron/orchestrator.ts # → 7

# 13. DashboardZone count
grep -c '<DashboardZone' mobile/src/screens/DashboardScreen.tsx  # → 5

# 14. FlatList eradicated — JSX usage only
grep -rn "<FlatList" mobile/src --include="*.tsx" | grep -v node_modules  # → 0

# 15. Preflight in all 5 filing wizards
grep -rln "runPreFlight\|preflight" mobile/src/screens/filings --include="*.tsx" | wc -l  # → 5

# 16. AuditEvent no updatedAt
awk '/model AuditEvent/,/^}/' backend/prisma/schema.prisma | grep updatedAt  # → 0

# 17. TaxHealthSnapshot no updatedAt
awk '/model TaxHealthSnapshot/,/^}/' backend/prisma/schema.prisma | grep updatedAt  # → 0

# 18. EAS SDK versions
grep -A5 '"production"' mobile/eas.json | grep -E "compileSdkVersion|targetSdkVersion"
# → compileSdkVersion: 36, targetSdkVersion: 35

# 19. render.yaml region
grep "region:" render.yaml  # → region: fra

# 20. No Express imports
grep -rn "from 'express'" backend/src --include="*.ts"     # → 0

# 21. Documentation integrity
grep "## \[13\." docs/CHANGELOG.md
find . -maxdepth 1 -name "*.md" | grep -vE "README|LICENSE|SECURITY|CONTRIBUTING" | wc -l  # → 0
[ -s docs/api/openapi.json ]
ls scripts/dump-swagger.ts  # → file present

# 22. Admin shell exists
ls admin/src/app/admin/layout.tsx  # → file present; implements §23.1 spec

# 23. Admin api-health page exists
ls admin/src/app/admin/api-health/page.tsx  # → file present; implements §23.6 spec

# 24. Prompt files normalized (no versioned _FINAL_v*.md files remain)
find prompts/ -name "*_FINAL_v*.md" | wc -l  # → 0
ls prompts/v13_master_prompt.md prompts/v13_implementation_prompt.md  # → both present
```

---

## QUICK REFERENCE — KNOWN PITFALLS

| Mistake | Correct |
|---|---|
| `app.use(middleware)` (Express) | `fastify.register(plugin)` or `preHandler: [fn]` |
| `res.json(data)` | `reply.send(data)` |
| `res.status(403).json({...})` | `reply.code(403).send({...})` |
| `req.body` in route | `request.body` (Fastify) |
| `console.log(...)` in backend | `request.log.info(...)` in routes; `logger.info(...)` in services |
| `new PrismaClient()` in service | `import { prisma } from '../lib/prisma'` |
| `new IORedis(...)` in service | `import { redis } from '../lib/redis'` |
| `new IORedis(...)` in BullMQ Worker | `createWorkerConnection()` from `eventBus.ts` |
| `Math.random()` in analytics | `crypto.randomUUID()` or deterministic seed |
| `router.push('/dashboard')` | `router.replace('/dashboard')` |
| `FlatList` | `@shopify/flash-list FlashList` |
| `WHT_RATE = 0.05` (professional) | `WHT_PROFESSIONAL_RATE = 0.10` |
| Inline `if (req.user.role === ...)` | `requireRole('ADMIN')` preHandler |
| `reply.send({ error: result.error.errors })` | `reply.code(400).send({ error:'VALIDATION_ERROR', issues: result.error.issues })` |
| `Alert.alert(...)` for business errors | Toast component (3s / 6s) |
| Audit event fire-and-forget | `await writeAuditEvent(...)` (except `ACCESS_DENIED`) |
| Inline `computeGaugeMode` | Import from `TaxHealthGauge.tsx` |
| Hardcode `CBN_MPR` | `parseFloat(process.env.CBN_MPR ?? '0.2725')` |
| `ServerSideEncryption` on R2 upload | Remove the param entirely |
| `initImmediate: true` in i18n | `initImmediate: false` |
| `buildArcPath()` without `'worklet'` | `'worklet';` as first line |
| Submit CTA before preflight | `preflight.pass === true` gate required |
| `grep -c 'zone='` for zone count | `grep -c '<DashboardZone'` → 5 |
| `pages/admin/` in Next.js | `app/admin/*/page.tsx` (App Router) |
| Missing `admin/layout.tsx` | Create shared shell per §23.1 |
| Per-page sidebar duplication | Single `layout.tsx` — never repeat shell |
| Default Recharts tooltip | Custom `<Tooltip contentStyle={{ borderRadius: '8px', ... }}>` |
| `CMD ["node", "dist/app.js"]` | `CMD ["node", "dist/server.js"]` |
| Paystack `verif-hash` header | `x-paystack-signature` header |
| TIN/CAC via NRS only | Youverify → NRS cross-reference |
| `supertest` for backend tests | `fastify.inject()` |
| `response.body` in inject tests | `JSON.parse(response.payload)` |
| `storedVersion &&` (falsy check) | `storedVersion !== null &&` (version 0 is valid) |
| Admin analytics calling service directly | Fetch from `GET /api/v2/analytics` endpoint |
| `cron '0 3 * * *'` for 04:00 WAT | `'0 4 * * *'` + `timezone: 'Africa/Lagos'` |
| CHANGELOG missing v13 entry | Add before merge; CI Stage 1 checks this |
| `istanbul`/`nyc` for contracts | `c8` (V8 native — ESM TypeScript compatible) |
| Missing admin api-health page | Create `admin/src/app/admin/api-health/page.tsx` per §23.6 |
| Missing `User` model | Add to schema.prisma with `roleVersion Int @default(0)` |
| Missing `RefreshToken` model | Add to schema.prisma with `family String` for rotation |
| `AccountantClient` without revokedAt filter | Always `revokedAt: null` in all queries |
| Emoji in sidebar production code | Use Heroicons SVG; emoji only in spec documentation |
| `scripts/dump-swagger.ts` missing | Create script; run `npm run docs:api`; CI Stage 1 checks `[ -s docs/api/openapi.json ]` |
| `smokeTestAdminUser` not seeded | Upsert ADMIN user in `prisma/seeds/smokeTestUser.ts` — required for smoke test #5 |
| `queueHealthCron` calling `queue.add()` | Monitor only — BullMQ handles retries automatically; NEVER re-enqueue in cron |
| Status indicator colour-only | Always pair with icon + text label (C-15) |
| `localStorage` in server components | Client components only — never in Next.js server components |
| `org.status === 'SUSPENDED'` | `OrgStatus` Prisma enum is lowercase: `'suspended'` / `'pending_verification'` |

---

> **TAXBRIDGE V13 — IMPLEMENTATION PROMPT** · `/prompts/v13_implementation_prompt.md` · v13.7
> 4 phases · 24 completion criteria · Stack-corrected · UX-audited · Schema-complete · Documentation-normalized
> Build it right for the Tecno Spark user first. Everything else follows.
