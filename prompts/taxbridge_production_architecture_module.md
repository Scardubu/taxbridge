# TaxBridge V12 — Production Architecture Completion Document
**Version:** V12-ARCH-2 | **Date:** 2026-03-03 | **Branch:** `upgrade/v12-elevated-20260302`
**Authority:** Defines deployable production system architecture. Companion to V12 APEX Execution Directive and Enhancement Guide.
**Commit:** `prompts/v12_production_architecture_module.md` — verified present via pre-execution gate.

---

# §1. SYSTEM OVERVIEW

**Product:** TaxBridge — Nigerian SME tax compliance platform
**Stack:** React Native (Expo) mobile | Next.js admin | Express backend | PostgreSQL + Redis | Cloudflare R2
**Deployment:** Render (backend) | Vercel (admin) | Expo EAS (mobile)
**Scale target:** 2,000 concurrent users | 99.5% uptime SLA
**Regulatory scope:** NRS integration | VAT | WHT | PAYE | NIL | CIT | Document Vault

**North Star:** A first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin.

---

# §2. REPOSITORY STRUCTURE

```
/
├── mobile/                        # Expo React Native app
│   ├── src/
│   │   ├── design-system/         # animation.ts | ngn.ts | tokens.ts
│   │   ├── contexts/              # ThemeContext.tsx
│   │   ├── components/
│   │   │   ├── shared/            # SectionState | InlineError | EmptyState | ConfettiAnimation
│   │   │   └── dashboard/         # DashboardZone | DashboardSkeleton | TaxHealthGauge
│   │   │                          # QuickActionsGrid | ComplianceCalendar | MetricsRow | OfflineSyncStatus
│   │   ├── hooks/                 # useDashboard | usePushNotification | useDeepLink | useBiometric
│   │   ├── screens/
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── OnboardingWizard.tsx
│   │   │   ├── auth/              # TOTPSetupScreen
│   │   │   ├── filings/           # VATFilingWizard | WHTWizard | PAYEWizard | NILReturnScreen | CITFilingWizard
│   │   │   ├── documents/         # DocumentVaultScreen
│   │   │   └── team/              # TeamManagementScreen
│   │   ├── services/              # apiClient.ts
│   │   ├── i18n/                  # en.json | pidgin.json | i18n.config.ts
│   │   └── assets/animations/     # confetti | success-checkmark | loading-spinner | empty-state
│   ├── app.json                   # scheme, universal links, notification config
│   └── eas.json                   # 3 profiles: development | preview | production
│
├── backend/                       # Express API
│   ├── src/
│   │   ├── validateEnv.ts         # LINE 1 import in app.ts
│   │   ├── app.ts                 # exact middleware order (see §5)
│   │   ├── lib/
│   │   │   ├── prisma.ts          # PgBouncer singleton (C-43)
│   │   │   └── logger.ts          # Pino with redaction
│   │   ├── metrics.ts             # 7 Prometheus metrics, singleton guard
│   │   ├── middleware/
│   │   │   ├── authenticate.ts    # JWT RS256 + role_version check
│   │   │   ├── validate.ts        # Zod safeParse wrapper (C-34)
│   │   │   ├── idempotency.ts     # X-Idempotency-Key + Redis (C-35)
│   │   │   ├── requireRole.ts     # ROLE_HIERARCHY enforcement (C-24)
│   │   │   ├── require2FA.ts      # TOTP TTL check (5-min Redis)
│   │   │   ├── rateLimit.ts       # standardHeaders:true (GAP-09)
│   │   │   └── tenant.ts          # resolveOrgContext (active + not deleted)
│   │   ├── routes/
│   │   │   ├── v1/
│   │   │   │   ├── auth.ts        # login | refresh | handleSuspiciousReuse
│   │   │   │   ├── auth/totp.ts   # setup | verify | disable | backup
│   │   │   │   ├── dashboard.ts   # composite Promise.all, TTL 120s
│   │   │   │   ├── notifications.ts  # register | unregister
│   │   │   │   ├── compliance/preflight.ts
│   │   │   │   ├── filings/       # nil | vat | wht | cit
│   │   │   │   ├── payroll/run.ts
│   │   │   │   ├── documents.ts
│   │   │   │   └── team.ts
│   │   │   ├── v2/
│   │   │   │   ├── monitoring.ts  # health (public) | metrics (ADMIN)
│   │   │   │   ├── audit.ts       # paginated + NDJSON export
│   │   │   │   └── dlq.ts         # list | retry | resolve
│   │   │   └── webhooks/
│   │   │       └── flutterwave.ts # HMAC verify + Redis NX idempotency
│   │   ├── services/
│   │   │   ├── audit.ts           # writeAuditEvent (always awaited)
│   │   │   ├── anomalyEngine.ts   # computeAnomalies (7 signals, cap 5, throws → [])
│   │   │   ├── riskScoring.ts     # 5 sub-scores, clamp 0-100
│   │   │   ├── nrsService.ts      # opossum circuit breaker
│   │   │   ├── notifications.ts   # sendPushNotification + sendSMSFallback
│   │   │   ├── dashboardService.ts  # FALLBACK_* constants
│   │   │   ├── compliancePreFlight.ts  # VAT registration guard (GAP-13)
│   │   │   └── eventBus.ts        # filing.submitted → pdfQueue
│   │   ├── workers/
│   │   │   └── pdfWorker.ts       # BullMQ consumer, A4 receipt → R2 (C-40)
│   │   └── cron/
│   │       └── orchestrator.ts    # exactly 7 jobs
│   └── prisma/schema.prisma
│
├── admin/                         # Next.js admin panel
│   └── src/
│       ├── middleware.ts          # jose JWT + role_version + CSRF (GAP-12)
│       └── pages/admin/
│           ├── analytics/index.tsx  # 5 panels
│           ├── dlq/index.tsx
│           ├── audit/index.tsx
│           └── team/index.tsx
│
├── packages/
│   └── contracts/src/
│       ├── types.ts               # PaginatedResponse | IntelligenceInput | DashboardStats | etc.
│       ├── cit.ts                 # calculateCIT (C-41)
│       └── index.ts               # re-exports all
│
├── infra/
│   ├── grafana/alerts.yml         # 5 alert rules
│   ├── grafana/dashboard.json     # 6 panels
│   └── k6/load-test.js
│
├── scripts/
│   ├── backfill-v12.ts
│   └── compress-assets.sh
│
├── prompts/                       # COMMITTED TO REPO — verified in pre-execution gate
│   ├── v12_master_prompt.md
│   └── v12_production_architecture_module.md
│
├── Dockerfile                     # multi-stage: builder + production
├── render.yaml
├── .github/workflows/pipeline.yml  # 5 stages
└── package.json                   # yarn workspaces root
```

---

# §3. DATA ARCHITECTURE

## §3.1 Database Models (Prisma / PostgreSQL)

**Enums:**
```prisma
enum UserRole    { SUPER_ADMIN ADMIN OWNER ACCOUNTANT EMPLOYEE VIEWER }
enum NilReason   { NO_REVENUE_THIS_PERIOD BUSINESS_INACTIVE EXEMPT_SUPPLY_ONLY BELOW_REGISTRATION_THRESHOLD }
enum AuditAction { CREATE UPDATE DELETE FILE AMEND APPROVE OVERRIDE REVOKE INVITE EXPORT ACCESS_DENIED ROLE_CHANGE LOGIN LOGOUT NRS_STAMP PAYMENT_RECEIVED SECURITY_ALERT }
enum RiskBand    { critical high medium low healthy }
enum OrgStatus   { active suspended pending_verification }
```

**Critical model constraints:**
- `TaxHealthSnapshot` — INSERT-ONLY. NO `updatedAt` field. Immutability contract.
- `AuditEvent` — NO `updatedAt` field. Immutability contract.
- `UserDevice` — `@@unique([userId, pushToken])` | soft-delete only (`active=false`)

**Required indexes on existing models:**
```prisma
// TaxReturn:        @@index([orgId, taxType, submittedAt])
// AuditEvent:       @@index([orgId, action, createdAt])
// VATCreditBalance: @@index([orgId, usedInPeriod, refundClaimed])
// SMERiskRecord:    @@index([band, computedAt]) @@index([score])
// UserSession:      @@index([userId, expiresAt]) @@index([expiresAt])
```

**Application-layer constraints (not DB-level):**
- `VATCreditBalance.carriedFromPeriod ≥ currentPeriod` → throw `ValidationError` in `vatCredit.service.ts`
- `SMERiskRecord.score` → clamp `Math.max(0, Math.min(100, score))` before every upsert
- `OrgMember` last OWNER guard → `409 LAST_OWNER` if `ownerCount ≤ 1 && target.role === 'OWNER'`

## §3.2 Migration Strategy

```bash
# NEVER between 08:00–20:00 WAT | NEVER use prisma migrate rollback
# WHY NO ROLLBACK: prisma migrate rollback destroys migration history metadata, leaving the
# database in a state that cannot be cleanly re-migrated. Use the emergency stored procedure instead.
npx prisma migrate dev --name "v12_step1_nullable_additions"
# Deploy code — backward-compatible with old and new schema simultaneously
yarn workspace backend ts-node scripts/backfill-v12.ts
npx prisma migrate dev --name "v12_step2_constraints_indexes_userdevice"
npx prisma migrate deploy  # CI/CD production only — never locally
```

## §3.3 Connection Pooling

`DATABASE_URL` must include: `?pgbouncer=true&connection_limit=1&pool_timeout=20`

Prisma singleton at `backend/src/lib/prisma.ts` — `global.__prisma` guard. Zero `new PrismaClient()` calls in route handlers (C-43).

## §3.4 Caching (Redis)

| Key Pattern | TTL | Purpose |
|---|---|---|
| `dashboard:composite:v1:${orgId}:${userId}` | 120s | Dashboard composite response |
| `idem:${idempotencyKey}` | 86400s | Idempotency response cache |
| `totp:${userId}` | 300s | TOTP verification session |
| `role_version:${userId}` | — | Role change invalidation token |
| `webhook:flw:${tx_ref}` | 86400s | Flutterwave dedup key |

---

# §4. API ARCHITECTURE

## §4.1 Route Namespace

| Namespace | Auth | Purpose |
|---|---|---|
| `GET /api/v2/monitoring/health` | PUBLIC | Health + latency check |
| `GET /api/v2/monitoring/metrics` | ADMIN | Prometheus registry dump |
| `GET /api/v2/analytics/revenue-at-risk` | ADMIN+ | Bar by taxType |
| `GET /api/v2/analytics/compliance-rate` | ADMIN+ | 6-month compliance line |
| `GET /api/v2/analytics/risk-distribution` | ADMIN+ | Band distribution |
| `GET /api/v2/analytics/nrs-health` | ADMIN+ | Circuit timeline |
| `GET /api/v2/analytics/dlq-trend` | ADMIN+ | DLQ depth over time |
| `POST /webhooks/flutterwave` | HMAC | Payment webhook |
| `/api/v1/*` | authenticate + resolveOrgContext | All business routes |
| `/api/v2/audit`, `/api/v2/dlq` | ADMIN+ | Admin-only data routes |

## §4.2 Middleware Stack — Exact Order

```typescript
// backend/src/app.ts — LINE 1: import './validateEnv'
1. import './validateEnv'            ← ABSOLUTE LINE 1
2. Sentry.init({ dsn: process.env.SENTRY_DSN })
3. app.set('trust proxy', 1)
4. app.use(helmet({ ... }))
5. app.use(cors({ origin: CORS_ORIGIN.split(','), credentials: true }))
6. app.use(compression({ level:6, threshold:1024 }))
7. app.use(requestLogger)            // Pino — zero console.log
8. app.use('/webhooks', express.raw({ type:'application/json' }))  ← BEFORE express.json
9. app.use(express.json({ limit:'1mb' }))
10. Route mounts (v1, v2, webhooks)
11. Global error handler             // last middleware — never leaks stack traces
12. app.listen(parseInt(process.env.PORT!, 10), '0.0.0.0')
```

## §4.3 Route Handler Middleware Chain

```typescript
// Standard business route:
router.post('/route', authenticate, resolveOrgContext, requireRole('ACCOUNTANT'), validate(Schema), idempotency, handler)

// SUPER_ADMIN + 2FA route:
router.post('/route', authenticate, requireRole('SUPER_ADMIN'), require2FA, handler)

// NEVER: schema.parse() in handlers (C-34)
// NEVER: req.user.role checks in handlers (C-24)
// NEVER: new PrismaClient() in routes (C-43)
```

## §4.4 Response Standards

- All validation errors: `{ error:'VALIDATION_ERROR', issues: result.error.issues }` — Zod v3 `.issues` never `.errors` (C-11)
- All DB/network failures: return `FALLBACK_*` constants — never 500 (C-07)
- All pagination: `PaginatedResponse<T>` from `@taxbridge/contracts`
- All NGN amounts: `formatNGN()` from `@taxbridge/contracts/ngn` (C-32)
- Dashboard: `meta: { cached: boolean, cacheAge?: number }`
- Health: always HTTP 200 — never 503; `status:'degraded'` when `db/redis latencyMs > 500`

---

# §5. TAX WORKFLOW MODULES

| Module | ID | Files | Gate |
|---|---|---|---|
| VAT Filing Wizard | MOD-22 | `VATFilingWizard.tsx` + `filings/vat.ts` + `vatCredit.service.ts` | 9 steps; VAT registration preflight; emit `filing.submitted` |
| WHT Remittance | MOD-23 | `WHTWizard.tsx` + `filings/wht.ts` | Rate tree; amber alert not color-only; deadline 21st |
| PAYE Payroll | MOD-24 | `PAYEWizard.tsx` + `payroll/run.ts` | `calculatePIT()` per employee; idempotency; ConfettiAnimation |
| NIL Return | MOD-25 | `NILReturnScreen.tsx` + `filings/nil.ts` | NilReason selector; 409 on duplicate |
| Document Vault | MOD-26 | `DocumentVaultScreen.tsx` + `documents.ts` | 24h signed URL; AES-256-GCM; NRS stamp check ≥₦200k |
| Team Management | MOD-27 | `TeamManagementScreen.tsx` + `team/index.tsx` + `team.ts` | Invite OTP; role change → session invalidation; OWNER guard |
| CIT Assessment | MOD-28 | `CITFilingWizard.tsx` + `filings/cit.ts` | **8 steps**: tax year+turnover → P&L upload → carryforward → Dev Levy → Education Tax → summary → payment → receipt; `calculateCIT()` exclusively (C-41); WCAG all 8 steps |

**Tax math accuracy requirements (must pass CI):**
```bash
calculatePIT({grossIncome:5_000_000, rentPaid:600_000, pension:200_000}).taxLiability === 632_400 ±₦1
calculatePenalty({entityType:'company', daysLate:32, taxAmountDue:0, disclosurePhase:'after_assessment'}).netPenalty === 375_000
calculateCIT({turnover:200_000_000, profit:50_000_000, devLevyApplies:false}).citLiability === 15_000_000
calculateCIT({turnover:80_000_000,  profit:20_000_000, devLevyApplies:false}).citLiability === 0
formatNGN(632_400) === '₦632,400' | formatNGN(5_000_000, {compact:true}) === '₦5.0M'
```

---

# §6. MOBILE ARCHITECTURE

## §6.1 Design System

- **Animation tokens:** `DURATION.*` | `EASE.*` | `ENTER_FROM.*` | `ZONE_DELAY.*` — all in `design-system/animation.ts`
- **Color tokens:** `COLORS.*` | dark/light scheme via `useTheme().colors.*` — zero raw hex in components (C-16)
- **Typography:** `TYPOGRAPHY.*` | **Spacing:** `SPACING.*` | **Radius:** `RADIUS.*`
- **Currency:** `formatNGN()` for all NGN display — never `toLocaleString()` (C-32)

## §6.2 Dashboard Architecture

```
5 zones — EXACT COUNT (C-17):
  apex     → TaxHealthGauge (SVG arc, 230° sweep, useDerivedValue — C-13)
  signal   → MetricsRow (3 cards)
  action   → QuickActionsGrid (3-col, urgency-sorted)
  context  → SectionState(anomalies, empty={null}) — NEVER "No anomalies" text (C-19)
  ambient  → ComplianceCalendar + OfflineSyncStatus

Loading: single isLoading gate → DashboardSkeleton (0px layout shift, exact pixel geometry)
Data: single composite call (Promise.all) → TTL 120s Redis cache (C-14)
Refresh: RefreshControl → useCallback(()=>refetch(),[refetch])
Haptics: ALL onPress fire Haptics BEFORE any await (C-20)
```

## §6.3 Network Resilience (2G)

- `axios` timeout: 15,000ms
- React Query: `retry: n<2 (not 401/404)` | `retryDelay: min(1000×2^n, 10_000)` | `networkMode:'offlineFirst'`
- Mutations: `retry:0, networkMode:'online'`
- On 429: toast with retry-after seconds — never auto-retry
- On 401: refresh → retry once → `router.replace('/auth/login')`
- FlashList throughout — no `FlatList` anywhere in mobile (estimatedItemSize per list type)

## §6.4 Security — Mobile

- Deep links: `SAFE_ROUTES` allowlist only — no dynamic path injection (C-36)
- Biometric: fallthrough to PIN — never blocks login
- Push tokens: register on App mount via `registerForPushNotifications()`; unregister on logout
- TOTP setup: `TOTPSetupScreen` → QR + manual secret → 6-digit verify → 10 backup codes with confirmation gate

---

# §7. BACKEND ARCHITECTURE

## §7.1 Intelligence Pipeline

```
computeAnomalies(IntelligenceInput) → AnomalySignal[] (cap 5, throw → [], never propagates)
  7 signals: vat_gap | nrs_stamp_delay
             auth_failure_flood: >10/1h/IP → critical  ← anomaly signal (long-window pattern; distinct from Grafana real-time alert)
             nil_overuse (≥3 consecutive→medium) | payroll_spike (>50% MoM→medium)
             unfiled_period (>30d→high) | vat_credit_aging (unused >90d→low)

computeRiskScore() → { score(0–100), band }
  5 sub-scores: filing(0–30) + anomaly(0–25) + health(0–25) + vat(0–10) + data(0–10)
  Bands: ≥80=healthy | ≥60=low | ≥40=medium | ≥20=high | <20=critical
  ENFORCE: score = Math.max(0, Math.min(100, total)) before every DB write
```

## §7.2 NRS Integration

```typescript
const breaker = new CircuitBreaker(callNRSAPI, {
  timeout: 10_000, errorThresholdPercentage: 50, resetTimeout: 30_000, volumeThreshold: 5
});
// State: 0=closed | 1=half-open | 2=open
// DIGITAX_MOCK_MODE=true → bypass, return { irn:`MOCK-IRN-${Date.now()}` }
// Circuit override: SUPER_ADMIN + require2FA only (C-29)
```

## §7.3 Security Architecture

| Mechanism | Implementation |
|---|---|
| Auth | JWT RS256 (4096-bit PEM) access (15m) + refresh (7d) |
| Refresh reuse | `handleSuspiciousReuse()` → invalidate all sessions + SECURITY_ALERT audit + push alert |
| TOTP | speakeasy + AES-256-GCM secret + 10 bcrypt-hashed backup codes (C-38) |
| RBAC | `requireRole()` middleware — actor cannot assign role ≥ own level (C-24) |
| Webhook integrity | `crypto.timingSafeEqual()` HMAC-SHA256 verification |
| Idempotency | Redis NX + 24h TTL on all exactly-once mutations (C-35, C-37) |
| Audit | Insert-only `AuditEvent` — NO `updatedAt` — always `await writeAuditEvent()` (C-25) |
| Admin CSRF | `X-CSRF-Token === csrf_token cookie` for all POST/PATCH/DELETE |
| Role invalidation | `role_version` checked in both admin middleware (Edge Config) and mobile JWT interceptor; **incremented in 3 paths: (1) role change via MOD-27, (2) TOTP disable, (3) account suspension** — all 3 must call `redis.del(\`role_version:${userId}\`)` (C-44) |
| Input validation | `validate(ZodSchema)` middleware on all POST/PATCH — never `schema.parse()` in handlers (C-34) |
| Logging | Pino with PII redaction — zero `console.log` in backend (C-26) |

## §7.4 Observability — 7 Metrics

| Metric | Type | Labels |
|---|---|---|
| `taxbridge_api_request_duration_seconds` | Histogram | route, method, status |
| `taxbridge_nrs_stamp_success_total` | Counter | orgId |
| `taxbridge_nrs_stamp_failure_total` | Counter | reason |
| `taxbridge_anomaly_detected_total` | Counter | signal, severity |
| `taxbridge_dlq_depth` | Gauge | queue_name |
| `taxbridge_penalty_estimate_total` | Counter | taxType |
| `taxbridge_nrs_circuit_state` | Gauge | 0=closed, 1=half-open, 2=open |

Singleton guard: `global.__taxbridge_prom_registry`

---

# §8. INFRASTRUCTURE ARCHITECTURE

## §8.1 Deployment Topology

```
[EAS Build] → Expo mobile (iOS/Android)
[Vercel]    → Next.js admin panel (Edge Runtime middleware)
[Render]    → Express API (region: fra — Frankfurt, PORT=10000)
              └── Docker multi-stage (node:20-alpine, USER taxbridge non-root)
              └── HEALTHCHECK → /api/v2/monitoring/health every 30s
[Render PG] → PostgreSQL via PgBouncer (connection_limit=1)
[Render Redis] → Redis (TLS: rediss://)
[Cloudflare R2] → Document Vault (default at-rest encryption — no ServerSideEncryption header) + PDF receipts
[Grafana]   → Loki log drain + Prometheus metrics + 5 alerts
```

## §8.2 Docker Multi-Stage

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
RUN yarn install --frozen-lockfile  # prisma must be in backend devDependencies
COPY packages/contracts/ packages/contracts/
COPY backend/ backend/
RUN yarn workspace @taxbridge/contracts build && yarn workspace backend build
RUN yarn workspace backend npx prisma generate  # generate for builder platform

FROM node:20-alpine AS production
RUN addgroup -S taxbridge && adduser -S taxbridge -G taxbridge
WORKDIR /app
COPY --from=builder /app/backend/dist   ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/node_modules   ./node_modules
COPY --from=builder /app/packages       ./packages
# Re-generate for production alpine target to ensure query engine binary match
RUN npx prisma generate --schema=./prisma/schema.prisma
USER taxbridge
ENV NODE_ENV=production
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:10000/api/v2/monitoring/health || exit 1
CMD ["node", "dist/app.js"]
```

## §8.3 Cron — Exactly 7 Jobs

```
taxHealthSnapshot  '0 */6 * * *'    INSERT-ONLY TaxHealthSnapshot
riskScoring        '0 3 * * *'      04:00 WAT — upsert SMERiskRecord
nrsQueueDrain      '*/30 * * * *'   drain NRS BullMQ queue
complianceReminder '0 8 * * *'      09:00 WAT — sendPushNotification via UserDevice
anomalyDigest      '0 7 * * 1'      Mon 08:00 WAT — weekly summary push
sessionCleanup     '0 1 * * *'      02:00 WAT — expire UserSession records
keepAlive          '*/14 * * * *'   GET ${RENDER_EXTERNAL_URL}/api/v2/monitoring/health — prevent Render free-tier spin-down
```
Gate: `grep -rn "setInterval" backend/src | grep -v orchestrator` → 0

## §8.4 Grafana Alerts — 5 Rules

```yaml
- alert: API_Error_Rate    expr: rate(taxbridge_api_request_duration_seconds_count{status=~'5..'}[5m])>0.01      for: 2m  severity: critical
- alert: Dashboard_P99     expr: histogram_quantile(0.99,...dashboard...[5m])>2                                   for: 5m  severity: warning
- alert: DLQ_Depth_High    expr: sum(taxbridge_dlq_depth)>10                                                      for: 15m severity: warning
- alert: Auth_Flood        expr: rate(taxbridge_anomaly_detected_total{signal='auth_failure_flood'}[1m])>10        for: 1m  severity: critical
- alert: NRS_Circuit_Open  expr: taxbridge_nrs_circuit_state==2                                                   for: 5m  severity: critical
```

## §8.5 Grafana Dashboard — 6 Panels

1. API Error Rate — timeseries
2. Dashboard P99 — gauge, thresholds 0.5s/2.0s
3. NRS Circuit State — stat: 0=Closed ✓ / 1=Half-Open ⚠️ / 2=OPEN ❌
4. DLQ Depth by Queue — bargauge
5. Filing Submissions Last Hour — stat
6. Active Users Last 15m — stat

## §8.6 k6 Load Test

```javascript
// Dashboard load test: 200 VUs, 10 min, p95 < 2000ms, error rate < 1%
export function filingTest() {
  const r = http.post(`${__ENV.BASE_URL}/api/v1/filings/nil`,
    JSON.stringify({ taxType:'VAT', period:'2026-02', nilReason:'NO_REVENUE_THIS_PERIOD' }),
    { headers:{ Authorization:`Bearer ${__ENV.TOKEN}`, 'X-Idempotency-Key':`load-${__VU}-${__ITER}` } });
  check(r, {
    '200 or 409': r => r.status === 200 || r.status === 409,
    'has ref':    r => JSON.parse(r.body).filingReference != null,
  });
}
```

---

# §9. CI/CD PIPELINE — 5 STAGES

**`.github/workflows/pipeline.yml`**

**Stage 1 — Pre-flight:**
```bash
grep '"SENTRY_DSN": "REPLACE' mobile/eas.json                                       # → 0 (C-33)
grep '"EXPO_PUSH_ACCESS_TOKEN": "REPLACE' mobile/eas.json                           # → 0
head -3 backend/src/app.ts | grep -q "validateEnv"
grep -rn "opossum" backend/src | grep -q "nrsService"
grep -rn "schema\.parse(" backend/src/routes --include="*.ts"                       # → 0 (C-34)
grep -rn "new PrismaClient" backend/src/routes --include="*.ts"                     # → 0 (C-43)
grep -q "already_processed" backend/src/routes/webhooks/flutterwave.ts              # C-37
grep -q "SAFE_ROUTES"        mobile/src/hooks/useDeepLink.ts                        # C-36
test -f backend/src/workers/pdfWorker.ts
test -f backend/src/routes/v1/notifications.ts
test -f backend/src/routes/v1/auth/totp.ts
grep -q "bcrypt" backend/src/routes/v1/auth/totp.ts                                 # C-38
grep -q "global.__prisma" backend/src/lib/prisma.ts                                 # C-43
grep -q "standardHeaders.*true" backend/src/middleware/rateLimit.ts                 # GAP-09
npx ts-node -e "const{calculateCIT}=require('./packages/contracts/src');if(calculateCIT({turnover:200_000_000,profit:50_000_000,devLevyApplies:false}).citLiability!==15_000_000)process.exit(1)"
npx ts-node -e "const{calculateCIT}=require('./packages/contracts/src');if(calculateCIT({turnover:80_000_000,profit:20_000_000,devLevyApplies:false}).citLiability!==0)process.exit(1)"
```

**Stage 2 — Lint + Type-check:**
```bash
yarn workspaces foreach -A run lint
yarn workspaces foreach -A run type-check  # → 0 errors
yarn i18n:check
yarn prompts:verify                        # → "✅ 11/11 modules"
```

**Stage 3 — Schema integrity:**
```bash
awk '/^model AuditEvent/,/^}/'        backend/prisma/schema.prisma | grep -q "updatedAt" && exit 1 || true
awk '/^model TaxHealthSnapshot/,/^}/' backend/prisma/schema.prisma | grep -q "updatedAt" && exit 1 || true
grep -q "UserDevice"     backend/prisma/schema.prisma || exit 1
grep -q "SECURITY_ALERT" backend/prisma/schema.prisma || exit 1
npx prisma validate
```

**Stage 4 — Tests + Coverage:**
```bash
npm test --workspaces -- --coverage --ci
npx nyc check-coverage --lines 95 --functions 95 --branches 90
npx snyk test --all-projects --severity-threshold=high
```

**Stage 5 — Staging smoke:**
```bash
curl -sf ${STAGING_URL}/api/v2/monitoring/health | jq -e '.status=="healthy" and .db.latencyMs!=null'
curl -sf "${STAGING_URL}/api/v1/compliance/penalty-estimate?taxType=VAT&daysLate=32&taxAmountDue=0&entityType=company&disclosurePhase=after_assessment" -H "Authorization:Bearer $TOKEN" | jq -e '.netPenalty==375000'
sleep 5 && curl -sf -H "Authorization:Bearer $TOKEN" "${STAGING_URL}/api/v1/filings/$FID" | jq -e '.receiptUrl|startswith("https://")'
```

---

# §10. PERFORMANCE REQUIREMENTS

| Metric | Target | Gate |
|---|---|---|
| Dashboard 2G initial paint | < 2000ms | Lighthouse mobile |
| Admin Lighthouse performance | ≥ 98 | Lighthouse desktop |
| Dashboard API P99 | < 2000ms | Grafana alert |
| API error rate | < 1% | Grafana alert |
| DLQ depth | < 10 | Grafana alert |
| k6 filing test p95 | < 2000ms | CI Stage 5 |
| Skeleton layout shift | 0px | RN Profiler |

**`admin/next.config.js`:**
```javascript
module.exports = { compress:true, poweredByHeader:false,
  experimental:{ optimizeCss:true }, images:{ formats:['image/avif','image/webp'] } };
```

**`scripts/compress-assets.sh`:** `pngquant` all PNGs — <50KB icons, <200KB illustrations. Run Lottie minifier from §11.

---

# §11. DOCUMENT VAULT ARCHITECTURE

- Storage: Cloudflare R2 (`taxbridge-vault` bucket)
- Encryption: AES-256-GCM at rest via R2 default encryption (R2 encrypts all objects at rest automatically — do NOT pass `ServerSideEncryption` to the S3 SDK; that parameter is S3-only and will cause upload failures on R2)
- Access: `getSignedUrl()` — 24h expiry. Never expose raw R2 URLs.
- Upload key pattern: `receipts/${orgId}/${filingId}.pdf` | `documents/${orgId}/${documentId}`
- Audit: `await writeAuditEvent` on every upload and download
- NRS stamp check: triggered on invoice upload if value ≥ ₦200,000
- Retention: soft-delete only; SUPER_ADMIN hard-delete available after 7-year retention period
- PDF receipts: auto-added to vault on `filing.submitted` event via BullMQ worker (C-40)

---

# §12. NOTIFICATION ARCHITECTURE

```
Filing deadline approaching → complianceReminder cron (09:00 WAT)
                            → sendPushNotification(userId, payload)
                            → UserDevice.findMany(userId, active:true)
                            → Expo push (chunked 100/request)
                            → fallback: Africa's Talking SMS if no active devices

Payload constraints:
  title: bilingual per user.langPreference, ≤80 chars
  body:  ≤150 chars — Expo hard limit (C-39)
  data:  { route: SAFE_ROUTES member, orgId, type }
  channelId: 'compliance' | 'general'

Deep link: useDeepLink() in App root → SAFE_ROUTES allowlist → router.push (C-36)
```

---

# §13. ADMIN PANEL ARCHITECTURE

**Authentication:** Next.js middleware (Edge Runtime) — `jose` JWT verification + role_version Edge Config check (30s TTL) + CSRF token validation for POST/PATCH/DELETE (GAP-12)

**Analytics panels (5):**
1. Revenue at Risk — bar by taxType (`TaxReturn` where `status='draft' && deadline past`)
2. Filing Compliance Rate — 6-month line, WAT x-axis
3. Risk Band Distribution — horizontal bar, clickable → filtered org table
4. NRS Health Timeline — circuit state + incident annotations (auto-refresh 60s)
5. DLQ Depth Over Time — area + threshold line at 10 (auto-refresh 60s)

**DLQ management:** `GET /api/v2/dlq` paginated | Retry (`AuditEvent:'OVERRIDE'`) | Resolve | Bulk >10 requires 2FA | auto-refresh 30s

**Audit log:** filters: orgId | actorId | action (multi-select) | dateFrom | dateTo | sort `createdAt DESC` | cursor pagination 50/page | Export → NDJSON → `AuditEvent:'EXPORT'`

---

# §14. INTERNATIONALIZATION

- Languages: English (`en.json`) + Natural Lagos Pidgin (`pidgin.json`)
- Config: `i18n.config.ts` — `initImmediate: false` (no raw keys before translations load)
- Validation: `yarn i18n:check` → 0 (all keys present in both languages)
- Prohibited string pattern: `"NRSt"` → must be `"NRS"` throughout
- Required key: `"common.offline"` in both languages
- Pidgin quality standard: natural Lagos idiom — not literal translation
  - ✅ `"Your TIN don check out"` | ✅ `"Goverment fit charge you ₦375,000"` | ✅ `"Oya file now before deadline"`
  - ❌ `"Tii-ai-en dey valid"` | ❌ `"Penalty go dey applied"` | ❌ `"Please to submit the form"`

---

# §15. ROLLBACK PROCEDURES

```bash
render traffic swap --from prod --to blue --api-key "$RENDER_API_KEY"           # backend blue-green
npx vercel rollback --token="$VERCEL_TOKEN" --cwd admin                         # admin panel
eas update --branch production --message "revert" \
  --git-commit-hash $(git rev-parse HEAD~1)                                     # mobile OTA

# DB emergency only — never standard rollback path:
# psql $DATABASE_URL -c "CALL taxbridge_v12_emergency_rollback();"
```

Rollback tags: `git tag | grep "v11\|v10"` must return ≥1 tag. Verify before any production deploy.

---

# §16. LOCAL DEVELOPMENT SETUP

**Prerequisites:** Docker Desktop 4.x | Node 20 LTS | Yarn 4 | EAS CLI | Expo CLI

```bash
# 1 — Clone and bootstrap
git clone <repo> && cd taxbridge
git checkout upgrade/v12-elevated-20260302

# 2 — Local services (postgres:15-alpine port 5432, redis:7-alpine port 6379)
docker compose up -d

# 3 — Environment (copy template, then edit the 4 required fields)
cp .env.example .env.local
# Required edits: DATABASE_URL | REDIS_URL | JWT_SECRET (any 32+ chars) | EXPO_PUBLIC_API_URL=http://localhost:10000
# Set automatically:  DIGITAX_MOCK_MODE=true | NODE_ENV=development

# 4 — Database + seed
yarn workspace backend npx prisma migrate dev
yarn workspace backend ts-node scripts/seed-dev.ts
# Seed output: 1 org (Acme Ltd) | 1 SUPER_ADMIN (admin@acme.ng / dev-password-only)
#              3 TaxReturn records | 1 TaxHealthSnapshot (score:62, band:'low')

# 5 — Start all services concurrently
yarn dev  # runs backend:10000 + admin:3000 + mobile (Expo)

# 6 — Verify
curl -s http://localhost:10000/api/v2/monitoring/health | jq '.status'  # → "healthy"
open http://localhost:3000/admin  # admin panel
```

**Mock NRS:** `DIGITAX_MOCK_MODE=true` bypasses NRS circuit breaker and returns `{ irn: 'MOCK-IRN-{timestamp}' }` for all NRS stamp requests. Always `true` in local dev.

---

# §17. DEPENDENCY VERSION PINS

Critical packages pinned to prevent inadvertent breaking upgrades. Update only with explicit testing.

| Package | Pinned Version | Risk if Upgraded Without Testing |
|---|---|---|
| `opossum` | `^8.0.0` | Circuit breaker API changed in v9; `fallback()` signature differs |
| `bullmq` | `^5.0.0` | Job schema changed in v6; existing queued jobs become unparseable |
| `lottie-react-native` | `^6.0.0` | RN 0.74+ breaking changes; `onError` prop signature may change |
| `@shopify/flash-list` | `^1.6.0` | `estimatedItemSize` behavior changed; list heights may reflow |
| `@tanstack/react-query` | `^5.0.0` | v5 breaking change from v4: `cacheTime` → `gcTime`; `isLoading` semantics changed |
| `speakeasy` | `^2.0.0` | TOTP algorithm defaults may shift; backup code generation differs |
| `pdfkit` | `^0.14.0` | Font embedding API changed in 0.15; A4 layout measurements differ |
| `expo-notifications` | `^0.28.0` | Notification handler API varies; `setNotificationHandler` signature may change |
| `jose` | `^5.0.0` | Edge Runtime compatibility; v4→v5 had breaking key import changes |

**Upgrade procedure:** create branch → upgrade single package → run full test suite + `yarn workspace backend ts-node scripts/seed-dev.ts` smoke → review output diff → merge only after 0 failures.

---

*TaxBridge V12 — Production Architecture Completion Document | V12-ARCH-3 | 2026-03-03*
*Branch: `upgrade/v12-elevated-20260302`*