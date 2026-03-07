# TaxBridge V12 — Sovereign Complementary Architecture & Quick-Win Playbook
**Rev:** V12-COMP-FINAL-HARDENED | **Date:** 2026-03-07 | **Branch:** `upgrade/v12-elevated-20260302`
**Authority:** Companion to `TAXBRIDGE_V12_MASTER_PROMPT.md`. Commit both to `prompts/`. Together they form the complete, self-sufficient implementation specification. No retired document requires cross-referencing.

---

## PART I — PRODUCTION ARCHITECTURE REFERENCE

### §1 System Overview

| Attribute | Value |
|---|---|
| Product | TaxBridge — Nigerian SME intelligent tax compliance platform |
| Mobile | React Native (Expo SDK 51) |
| Admin | Next.js 14 |
| Backend | Express 5, Node 20 LTS |
| Data | PostgreSQL 15 + Redis 7 |
| Storage | Cloudflare R2 (`taxbridge-vault`) |
| Deployment | Render `fra` (backend) · Vercel (admin) · Expo EAS (mobile) |
| Scale target | 2,000 concurrent users · 99.5% uptime SLA |
| Regulatory | NRS · VAT · WHT · PAYE · NIL · CIT · Document Vault |

---

### §2 Repository Structure

```
/
├── mobile/
│   ├── src/
│   │   ├── design-system/        animation.ts | ngn.ts | tokens.ts
│   │   ├── contexts/             ThemeContext.tsx
│   │   ├── components/
│   │   │   ├── shared/           SectionState | InlineError | EmptyState | ConfettiAnimation
│   │   │   └── dashboard/        DashboardZone | DashboardSkeleton | TaxHealthGauge
│   │   │                         QuickActionsGrid | ComplianceCalendar | MetricsRow | OfflineSyncStatus
│   │   ├── hooks/                useDashboard | usePushNotification | useDeepLink | useBiometric
│   │   ├── screens/
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── OnboardingWizard.tsx
│   │   │   ├── auth/             TOTPSetupScreen.tsx
│   │   │   ├── filings/          VATFilingWizard | WHTWizard | PAYEWizard | NILReturnScreen | CITFilingWizard
│   │   │   ├── documents/        DocumentVaultScreen.tsx
│   │   │   └── team/             TeamManagementScreen.tsx
│   │   ├── services/             apiClient.ts
│   │   ├── i18n/                 en.json | pidgin.json | i18n.config.ts
│   │   └── assets/animations/   confetti | success-checkmark | loading-spinner | empty-state
│   ├── app.json                  scheme · universal links · notification config
│   └── eas.json                  development | preview | production profiles
│
├── backend/
│   ├── src/
│   │   ├── validateEnv.ts        LINE 1 import in app.ts
│   │   ├── app.ts                exact middleware order (immutable)
│   │   ├── lib/
│   │   │   ├── prisma.ts         global.__prisma singleton (C-43)
│   │   │   ├── redis.ts          global.__taxbridge_redis singleton (C-46, COMP-19)
│   │   │   └── logger.ts         Pino + full redaction (C-21, C-45, COMP-10)
│   │   ├── metrics.ts            7 Prometheus metrics, singleton guard
│   │   ├── middleware/
│   │   │   ├── authenticate.ts   JWT RS256 + role_version check
│   │   │   ├── validate.ts       Zod safeParse wrapper (C-34)
│   │   │   ├── idempotency.ts    X-Idempotency-Key + Redis NX (C-35)
│   │   │   ├── requireRole.ts    ROLE_HIERARCHY enforcement (C-24)
│   │   │   ├── require2FA.ts     TOTP 5-min TTL Redis check
│   │   │   ├── rateLimit.ts      standardHeaders:true (C-30, GAP-09)
│   │   │   └── tenant.ts         resolveOrgContext: OrgMember + OrgStatus (C-12, COMP-08)
│   │   ├── routes/
│   │   │   ├── v1/
│   │   │   │   ├── auth.ts       login | refresh | handleSuspiciousReuse (GAP-02)
│   │   │   │   ├── auth/totp.ts  setup | verify | disable | backup (GAP-03)
│   │   │   │   ├── dashboard.ts  composite Promise.all, TTL 120s
│   │   │   │   ├── notifications.ts  register | unregister (GAP-01)
│   │   │   │   ├── compliance/preflight.ts
│   │   │   │   ├── filings/      nil | vat | wht | cit
│   │   │   │   ├── payroll/run.ts
│   │   │   │   ├── documents.ts
│   │   │   │   └── team.ts
│   │   │   ├── v2/
│   │   │   │   ├── monitoring.ts  health (public) | metrics (ADMIN)
│   │   │   │   ├── analytics.ts   5 endpoints (COMP-03)
│   │   │   │   ├── audit.ts       paginated + NDJSON export
│   │   │   │   └── dlq.ts         list | retry | resolve
│   │   │   └── webhooks/
│   │   │       └── flutterwave.ts  HMAC + Redis NX idempotency (GAP-06, C-37)
│   │   ├── services/
│   │   │   ├── audit.ts           writeAuditEvent (always awaited, C-25)
│   │   │   ├── anomalyEngine.ts   7 signals, cap 5, throw → [] (never propagates)
│   │   │   ├── riskScoring.ts     5 sub-scores, clamp 0–100
│   │   │   ├── nrsService.ts      opossum circuit breaker (C-29)
│   │   │   ├── notifications.ts   push + Africa's Talking SMS fallback (GAP-01, C-39)
│   │   │   ├── dashboardService.ts  FALLBACK_* constants (C-07)
│   │   │   ├── vatCredit.service.ts
│   │   │   ├── compliancePreFlight.ts
│   │   │   └── eventBus.ts        EventEmitter + BullMQ pdfQueue (COMP-05)
│   │   ├── workers/
│   │   │   └── pdfWorker.ts       BullMQ consumer → R2 (GAP-15, C-40)
│   │   └── cron/
│   │       └── orchestrator.ts    exactly 7 jobs
│   └── prisma/schema.prisma
│
├── admin/
│   └── src/
│       ├── middleware.ts          jose JWT + role_version + CSRF (GAP-12)
│       └── pages/admin/
│           ├── analytics/index.tsx  5 panels (COMP-03)
│           ├── dlq/index.tsx
│           ├── audit/index.tsx
│           └── team/index.tsx
│
├── packages/
│   └── contracts/src/
│       ├── constants.ts           ALL rate constants (C-04, COMP-01)
│       ├── types.ts               PaginatedResponse | DashboardStats | etc.
│       ├── cit.ts                 calculateCIT (C-41, GAP-05)
│       └── index.ts               re-exports all
│
├── infra/
│   ├── grafana/alerts.yml         5 alert rules (COMP-15)
│   ├── grafana/dashboard.json     6 panels
│   └── k6/load-test.js
│
├── scripts/
│   ├── backfill-v12.ts            PDF + band + ref audit (COMP-06)
│   ├── create-emergency-rollback-proc.sql  (COMP-07)
│   ├── seed-dev.ts                Acme Ltd dev seed (COMP-18)
│   ├── verify-prompts.ts          yarn prompts:verify → 12/12 (COMP-09)
│   └── compress-assets.sh         QW-10
│
├── prompts/                       COMMITTED TO REPO
│   ├── TAXBRIDGE_V12_MASTER_PROMPT.md
│   └── v12_complementary_architecture.md
│
├── Dockerfile                     multi-stage: builder + production
├── docker-compose.yml             postgres:15 + redis:7 (COMP-04)
├── .env.example                   template (COMP-04)
├── render.yaml
├── .github/workflows/pipeline.yml  5 CI stages
└── package.json                   yarn workspaces root
```

---

### §3 Data Architecture

#### §3.1 Schema Enums & Immutability Contracts

```prisma
enum UserRole    { SUPER_ADMIN ADMIN OWNER ACCOUNTANT EMPLOYEE VIEWER }
enum NilReason   { NO_REVENUE_THIS_PERIOD BUSINESS_INACTIVE EXEMPT_SUPPLY_ONLY BELOW_REGISTRATION_THRESHOLD }
enum AuditAction { CREATE UPDATE DELETE FILE AMEND APPROVE OVERRIDE REVOKE INVITE EXPORT ACCESS_DENIED ROLE_CHANGE LOGIN LOGOUT NRS_STAMP PAYMENT_RECEIVED SECURITY_ALERT }
enum RiskBand    { critical high medium low healthy }
enum OrgStatus   { active suspended pending_verification }
```

**Immutability contracts (CI Stage 3 enforced):**
- `TaxHealthSnapshot` — INSERT-ONLY. **NO `updatedAt` field.** Backfill via raw SQL only.
- `AuditEvent` — **NO `updatedAt` field.**

**Application-layer invariants:**
- `VATCreditBalance.carriedFromPeriod ≥ currentPeriod` → throw `ValidationError` in `vatCredit.service.ts`
- `SMERiskRecord.score` → `Math.max(0,Math.min(100,score))` before every upsert
- `OrgMember` last OWNER guard → `409 LAST_OWNER` when `ownerCount≤1 && target.role==='OWNER'`

#### §3.2 Redis Cache Keys

| Key Pattern | TTL | Purpose |
|---|---|---|
| `dashboard:composite:v1:${orgId}:${userId}` | 120s | Dashboard composite response |
| `idem:${idempotencyKey}` | 86400s | Idempotency response cache |
| `totp:${userId}` | 300s | TOTP verification session |
| `role_version:${userId}` | — | Role invalidation token (deleted on change) |
| `webhook:flw:${tx_ref}` | 86400s | Flutterwave deduplication key |

#### §3.3 Migration Strategy (Zero-Downtime)

```bash
# NEVER between 08:00–20:00 WAT
# NEVER use prisma migrate rollback — it destroys migration history metadata
# Use create-emergency-rollback-proc.sql instead
npx prisma migrate dev --name "v12_step1_nullable_additions"
yarn workspace backend ts-node scripts/backfill-v12.ts       # between steps
npx prisma migrate dev --name "v12_step2_constraints_indexes_userdevice"
npx prisma migrate deploy                                      # CI/CD production only
```

---

### §4 Intelligence Pipeline

```
computeAnomalies(IntelligenceInput) → AnomalySignal[]
  Cap: 5 signals maximum returned
  Error handling: throw → return [] — never propagates to caller

7 signals:
  auth_failure_flood   >10/1h/IP → critical   [long-window; Grafana Auth_Flood >10/1min is SEPARATE — COMP-15]
  nil_overuse          ≥3 consecutive → medium
  payroll_spike        >50% MoM → medium
  unfiled_period       >30d → high
  vat_credit_aging     unused >90d → low
  vat_gap              output/input ratio anomaly → high
  nrs_stamp_delay      stamp latency exceeds threshold → high

computeRiskScore() → { score:number(0–100), band:RiskBand }
  5 sub-scores: filing(0–30) + anomaly(0–25) + health(0–25) + vat(0–10) + data(0–10)
  Bands: ≥80=healthy | ≥60=low | ≥40=medium | ≥20=high | <20=critical
  ENFORCE: score = Math.max(0, Math.min(100, total)) before every DB write
```

---

### §5 Security Architecture

| Mechanism | Implementation |
|---|---|
| Auth tokens | JWT RS256 (4096-bit PEM key), access TTL 15min, refresh TTL 7d |
| Refresh reuse | `handleSuspiciousReuse()` → `UserSession.deleteMany({userId})` + `redis.del('role_version:${userId}')` + `SECURITY_ALERT` audit + push notification + Sentry |
| TOTP | speakeasy + AES-256-GCM encrypted secret + 10 bcrypt-hashed backup codes (C-38) |
| RBAC | `requireRole()` middleware — actor cannot assign role ≥ own level (C-24) |
| Webhook integrity | `crypto.timingSafeEqual()` HMAC-SHA256 on `verif-hash` header |
| Idempotency | Redis NX + 24h TTL on all exactly-once mutations (C-35, C-37) |
| Audit log | INSERT-ONLY `AuditEvent` — NO `updatedAt` — always `await writeAuditEvent()` (C-25) |
| Admin CSRF | `X-CSRF-Token === csrf_token cookie` for all POST/PATCH/DELETE |
| Role invalidation | `role_version` incremented in **3 paths**: (1) role change via MOD-27, (2) TOTP disable, (3) account suspension — all 3 call `redis.del('role_version:${userId}')` (C-44) |
| Deep link | `useDeepLink()` validates against `SAFE_ROUTES` allowlist — no dynamic path construction (C-36) |
| Rate limiting | `authRateLimit` (10/15min/IP) on login, `standardHeaders:true` on all limiters (C-30, GAP-09) |

#### TOTP Lockout Recovery Runbook (COMP-17)

```
Path 1 — Peer SUPER_ADMIN:
  POST /api/v1/auth/totp/disable with peer SUPER_ADMIN credentials + their own 2FA confirmation

Path 2 — Backup codes:
  POST /api/v1/auth/totp/backup
  Each code: bcrypt.compare, one-time redemption, immutable once used

Path 3 — DBA fallback (MAINTENANCE WINDOW ONLY — drain active connections first; race condition risk):
  UPDATE "User" SET "totpEnabled"=false, "totpSecret"=NULL WHERE id='<userId>';
  INSERT INTO "AuditEvent" (id,"orgId","actorId","actorRole","targetType","targetId",action,after,"createdAt")
    VALUES (gen_random_uuid(),'SYSTEM','DBA','SYSTEM','User','<userId>','OVERRIDE',
            '{"reason":"emergency_totp_disable"}',now());
```

---

### §6 Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Dashboard 2G initial paint | < 2000ms | Lighthouse mobile |
| Admin Lighthouse performance | ≥ 98 | Lighthouse desktop |
| Dashboard API P99 | < 2000ms | Grafana `Dashboard_P99` alert |
| API error rate | < 1% | Grafana `API_Error_Rate` alert |
| DLQ depth | < 10 | Grafana `DLQ_Depth_High` alert |
| k6 filing p95 | < 2000ms | CI Stage 5 |
| Skeleton layout shift | 0px | RN Profiler |

---

### §7 NRS Integration

```typescript
const breaker=new CircuitBreaker(callNRSAPI,{
  timeout:10_000,errorThresholdPercentage:50,resetTimeout:30_000,volumeThreshold:5
});
// States: 0=closed | 1=half-open | 2=open
// DIGITAX_MOCK_MODE=true → return {irn:`MOCK-IRN-${Date.now()}`} — bypasses breaker
// Override: SUPER_ADMIN + require2FA only (C-29)
// Update taxbridge_nrs_circuit_state Gauge on every state-change event
```

---

### §8 Document Vault

- Storage: Cloudflare R2, bucket `taxbridge-vault`
- **NEVER set `ServerSideEncryption`** — R2 encrypts all objects at rest automatically. `aws:kms` is S3-only and causes upload failures on R2.
- URL access: `getSignedUrl()` with 24h expiry. Never expose raw R2 object URLs.
- Key format: `receipts/${orgId}/${filingId}.pdf` | `documents/${orgId}/${documentId}`
- Audit: `await writeAuditEvent` on every upload and every download (C-25)
- NRS stamp check on invoice upload when value ≥ ₦200,000
- Retention: soft-delete only; SUPER_ADMIN hard-delete only after 7-year retention period
- PDF receipts: auto-generated via BullMQ `pdfWorker.ts` on `filing.submitted` event (C-40)

---

## PART II — ALL 19 COMP GAPS CLOSED

### COMP-01 · WHT 4% Non-Resident Rate — ERADICATED — CRITICAL

**The 4% non-resident WHT rate does not exist in Nigerian law (CITA, PITA, or WHT schedules). Any prior reference is a regulatory violation.**

Canonical rates in `packages/contracts/src/constants.ts`:
```typescript
export const WHT_RATES={
  professional: 0.10,  // consultancy/management/technical/dividends/interest/royalties/rent
  construction: 0.05,  // survey/contracts
  nonResident:  0.10,  // same rate; nonResident:true flag routes to separate NRS TCC channel
} as const;
// CIT_DEV_LEVY_RATE=0.04 is the ITF Development Levy on CIT assessable profit — NOT a WHT rate
```
Gates:
```bash
grep -rn "0\.04\b\|\"4%\"\|'4%'" backend/src/routes/v1/filings/wht.ts packages/contracts/src  # → 0
npx ts-node -e "const{WHT_RATES:w}=require('./packages/contracts/src/constants');if(w.nonResident!==0.10)process.exit(1);console.log('✅')"
```

---

### COMP-02 · `computeGaugeMode()` — Exported from TaxHealthGauge.tsx — CRITICAL

Location: `mobile/src/components/dashboard/TaxHealthGauge.tsx`
```typescript
export function computeGaugeMode(data:DashboardStats|undefined):'expanded'|'compact'{
  if(!data)return'expanded';
  const deadlines=data.upcomingDeadlines??[];
  return deadlines.some(d=>d.daysRemaining<=7||d.daysRemaining<0)?'compact':'expanded';
  // compact:  120px right-aligned — any deadline ≤7d or overdue
  // expanded: 200px centered    — no imminent urgency
}
```
Usage: `const gaugeMode=useMemo(()=>computeGaugeMode(data),[data]);`
Gate: `grep -q "computeGaugeMode" mobile/src/components/dashboard/TaxHealthGauge.tsx`

---

### COMP-03 · `backend/src/routes/v2/analytics.ts` — All 5 Endpoints

All routes: `authenticate + requireRole('ADMIN')`. Base path: `/api/v2/analytics/`.
```typescript
GET /revenue-at-risk
  // TaxReturn where status='draft' AND dueDate < now(), grouped by taxType
  // Response: {taxType:string, totalAtRisk:number, count:number}[]

GET /compliance-rate
  // 6 calendar months; per month: {month:string, filedOnTime:number, totalDue:number, rate:number}[]
  // month format: 'YYYY-MM', WAT timezone

GET /risk-distribution
  // SMERiskRecord.count() grouped by band
  // Response: {band:RiskBand, count:number}[]

GET /nrs-health
  // nrsCircuitState samples last 24h from taxbridge_nrs_circuit_state metric
  // Response: {ts:string, state:0|1|2}[]

GET /dlq-trend
  // BullMQ DLQ depth samples last 7 days
  // Response: {ts:string, depth:number, queueName:string}[]
```

---

### COMP-04 · `docker-compose.yml` and `.env.example`

See Master Prompt §5.2. Both files are required before `yarn dev` and before CI Stage 1.

---

### COMP-05 · `backend/src/services/eventBus.ts` — Complete Implementation

See Master Prompt §2.5. Key invariants:
- `eventBus.setMaxListeners(20)` — prevents Node warning when many modules listen
- `pdfQueue` uses `redis` singleton from `lib/redis.ts` (C-46)
- `pdfQueue.add` errors captured by Sentry and logged — never thrown to caller

Gate: `grep -q "setMaxListeners" backend/src/services/eventBus.ts`

---

### COMP-06 · `scripts/backfill-v12.ts` — Idempotent, 4 Operations

```typescript
// Operation 1: PDF receipt backfill
// Find TaxReturn where receiptUrl IS NULL AND status='filed'
// Emit 'filing.submitted' for each → pdfQueue picks up
// Idempotency: check TaxReturn.receiptUrl again before emitting

// Operation 2: TaxHealthSnapshot band backfill
// TaxHealthSnapshot is INSERT-ONLY — NO prisma.update — use raw SQL:
// UPDATE "TaxHealthSnapshot" SET band=CASE WHEN score>=80 THEN 'healthy'... WHERE band IS NULL;

// Operation 3: filingReference format audit
// SELECT id, "filingReference" FROM "TaxReturn" WHERE "filingReference" NOT LIKE 'TB-%'
// Log warnings only — NEVER mutate references

// Operation 4: UserDevice — no-op (schema already correct)

// All 4 operations are idempotent: safe to re-run
```

---

### COMP-07 · `scripts/create-emergency-rollback-proc.sql`

```sql
-- Create BEFORE every production deploy
-- Uses _V12DeployMarker table (NOT SystemConfig — not in Prisma schema)
CREATE TABLE IF NOT EXISTS "_V12DeployMarker" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  version     TEXT NOT NULL,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rolled_back BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "_V12DeployMarker" (version) VALUES ('v12');

CREATE OR REPLACE PROCEDURE taxbridge_v12_emergency_rollback()
LANGUAGE plpgsql AS $$
BEGIN
  -- Log rollback event
  INSERT INTO "AuditEvent" (id,"orgId","actorId","actorRole","targetType","targetId",action,after,"createdAt")
    VALUES (gen_random_uuid()::text,'SYSTEM','DBA','SYSTEM','Deployment','v12','OVERRIDE',
            '{"reason":"emergency_rollback"}',now());
  UPDATE "_V12DeployMarker" SET rolled_back=true WHERE version='v12';
  RAISE NOTICE 'V12 emergency rollback marker set. Execute infra rollback separately.';
END;
$$;
```

---

### COMP-08 · `backend/src/middleware/tenant.ts` — Dual Status Check

See Master Prompt §2.5. Both checks are mandatory:
1. `OrgMember.status === 'active'` AND `OrgMember.deletedAt IS NULL`
2. `Organisation.status` — suspended → `403 ORG_SUSPENDED`, pending → `403 ORG_PENDING_VERIFICATION`

Gate: `grep -q "ORG_SUSPENDED" backend/src/middleware/tenant.ts`

---

### COMP-09 · `scripts/verify-prompts.ts` — 12 Required Modules

```typescript
const REQUIRED_MODULES=[
  'prompts/TAXBRIDGE_V12_MASTER_PROMPT.md',
  'prompts/v12_complementary_architecture.md',
  'packages/contracts/src/constants.ts',
  'packages/contracts/src/cit.ts',
  'backend/src/lib/redis.ts',
  'backend/src/lib/prisma.ts',
  'backend/src/lib/logger.ts',
  'backend/src/services/eventBus.ts',
  'backend/src/services/anomalyEngine.ts',
  'backend/src/workers/pdfWorker.ts',
  'backend/src/routes/v1/auth/totp.ts',
  'backend/src/routes/v1/notifications.ts',
];
let passed=0;
for(const m of REQUIRED_MODULES){
  if(require('fs').existsSync(m)){passed++;console.log(`✅ ${m}`);}
  else{console.error(`❌ MISSING: ${m}`);}
}
if(passed<REQUIRED_MODULES.length)process.exit(1);
console.log(`\n✅ ${passed}/${REQUIRED_MODULES.length} modules verified`);
```
Register in root `package.json`: `"prompts:verify": "ts-node scripts/verify-prompts.ts"`

---

### COMP-10 · `backend/src/lib/logger.ts` — Complete Redaction Array

```typescript
import pino from'pino';
export const logger=pino({
  level:process.env.LOG_LEVEL??'info',
  redact:{
    paths:[
      'req.headers.authorization',
      'body.password','body.tin','body.bvn',
      'body.bankAccount','body.cardNumber',
      'body.receiptUrl','body.documentUrl',
      '*.receiptUrl','*.documentUrl',
    ],
    censor:'[REDACTED]',
  },
});
```
Gate: `grep -q "receiptUrl" backend/src/lib/logger.ts`

---

### COMP-11 · `decodeCursor` — try/catch with 400 Status

See Master Prompt §2.5 `packages/contracts/src/types.ts`. Malformed base64 or missing `{createdAt,id}` → `throw Object.assign(new Error('INVALID_CURSOR'),{status:400})`. Route error handler reads `.status` and returns 400.

---

### COMP-12 · `formatNGN` K Suffix — `toFixed(1)`

```typescript
if(amount>=1e3)return`₦${(amount/1e3).toFixed(1)}K`;
```
Gate: `formatNGN(1_500,{compact:true})==='₦1.5K'` — NOT `'₦2K'`

---

### COMP-13 · `admin/next.config.js` — CSP Header

See Master Prompt §3.2. CSP must include `connect-src` for both `https://api.taxbridge.ng` and `https://*.r2.cloudflarestorage.com`.
Gate: `grep -q "Content-Security-Policy" admin/next.config.js`

---

### COMP-14 · `useDashboard.ts` — Stale-on-Resume

```typescript
// On AppState 'active': if last fetch was >120s ago → invalidate dashboard query
// Update lastFetchTimeRef.current=Date.now() in each successful fetch's onSuccess callback
```
Gate: `grep -q "lastFetchTimeRef" mobile/src/hooks/useDashboard.ts`

---

### COMP-15 · Auth Failure Flood — Dual Threshold (Both Required)

| Mechanism | Threshold | Purpose |
|---|---|---|
| `anomalyEngine.ts` signal | >10 failures/1h/IP | Long-window pattern detection → `AnomalySignal` |
| Grafana `Auth_Flood` alert | rate >10/1min | Real-time spike detection → PagerDuty/webhook |

**These are complementary. Do NOT consolidate. Do NOT change either threshold.**

Required comment in `anomalyEngine.ts`:
```typescript
// auth_failure_flood: >10/1h/IP long-window anomaly; Grafana Auth_Flood >10/1min real-time spike (COMP-15)
```

---

### COMP-16 · `VIEWER_TOKEN` in GitHub Secrets

Add to GitHub repository secrets:
```
VIEWER_TOKEN  # Low-privilege JWT for smoke test #6 RBAC enforcement verification
```
Used in: `smoke test #6 — curl -H "Authorization:Bearer $VIEWER_TOKEN"` attempting ADMIN action → assert `error==="INSUFFICIENT_ROLE"`.

---

### COMP-17 · TOTP Lockout Recovery Runbook

See §5 Security Architecture above. Three paths in priority order: peer SUPER_ADMIN → backup code redemption → DBA emergency fallback (maintenance window only, connections drained).

---

### COMP-18 · `scripts/seed-dev.ts` — Dev Seed Data

```typescript
// Creates in order (respect FK constraints):
// 1. Organisation { name:'Acme Ltd', status:'active', vatRegistrationNumber:'12345678-0001' }
// 2. User { email:'admin@acme.ng', role:'SUPER_ADMIN', orgId:<above> }
// 3. 3× TaxReturn { orgId, taxType:'VAT'|'WHT'|'PAYE', status:'draft', period:'2026-01' }
// 4. TaxHealthSnapshot { orgId, userId, score:62, band:'low', period:'2026-01' }
// All creates are idempotent: use upsert or check-then-insert
```

---

### COMP-19 · `backend/src/lib/redis.ts` — IORedis Singleton (C-46)

See Master Prompt §2.5 for complete implementation.

Key invariants:
- `maxRetriesPerRequest:null` — required by BullMQ v5
- `enableReadyCheck:false` — prevents startup race in serverless/warm restarts
- `global.__taxbridge_redis` dev-mode singleton prevents connection leaks in HMR
- Production: new connection per cold start (Render is always cold-start safe)

Gate: `grep -q "global.__taxbridge_redis" backend/src/lib/redis.ts`
Gate: `grep -rn "new IORedis" backend/src | grep -v lib/redis` → 0

---

## PART III — QUICK-WIN PLAYBOOK

Each win is implementable within one engineering day. Implement in priority order.

---

### QW-01 · Skeleton Pixel-Perfect Geometry *(4h)*

**Impact:** 0px CLS — the single largest perceived-performance killer on 2G.

Set exact pixel dimensions in `DashboardSkeleton.tsx` matching each zone's final rendered size (specified in Master Prompt §2.4). Use `RADIUS.*` tokens per block to prevent shape-pop on reveal. Set `accessibilityElementsHidden={true}` on all shimmer blocks.

Gate: Visual diff shows 0px layout shift in RN Profiler on reveal.

---

### QW-02 · Expo Font Preload Splash Lock *(2h)*

**Impact:** Eliminates FOUT (flash of unstyled text) on first impression.

Implemented via BUG-S01. Verify:
```typescript
SplashScreen.preventAutoHideAsync();  // module level
// in App.tsx:
const[fontsLoaded]=useFonts({Inter_400Regular,Inter_600SemiBold,Inter_700Bold});
useEffect(()=>{if(fontsLoaded)SplashScreen.hideAsync();},[fontsLoaded]);
if(!fontsLoaded)return null;
```
Gate: No system font fallback visible on Tecno Spark cold start.

---

### QW-03 · Push Notification Deep Link Handler *(3h)*

**Impact:** Every compliance push becomes a one-tap filing action — direct conversion driver.

In App root (alongside `usePushNotification`):
```typescript
Notifications.addNotificationResponseReceivedListener(response=>{
  const route=response.notification.request.content.data?.route as string|undefined;
  if(route&&(SAFE_ROUTES as readonly string[]).includes(route))router.push(route);
});
```
Gate: Tapping a test push notification navigates to the correct filing screen without additional taps.

---

### QW-04 · `X-Request-ID` on Every Response *(1h)*

**Impact:** Enables support staff to trace any user-reported error to a specific Sentry/Pino entry in seconds. Production debuggability is impossible at scale without this.

Already specified in Master Prompt §2.5 `app.ts` middleware line 6. Verify `nanoid(21)` is used (21 chars = 128 bits collision resistance).

Gate: `curl -I localhost:10000/api/v2/monitoring/health | grep X-Request-ID` returns header.

---

### QW-05 · Offline Queue for Onboarding Steps *(4h)*

**Impact:** 2G users frequently lose connectivity mid-onboarding. Converts failure into seamless resume.

In `OnboardingWizard.tsx`:
```typescript
async function completeStep(step:number){
  try{
    await apiClient.patch('/onboarding/step',{step});
  }catch(e){
    if(isOfflineError(e)){
      const existing=JSON.parse(await AsyncStorage.getItem('onboarding_queue')||'[]');
      await AsyncStorage.setItem('onboarding_queue',JSON.stringify([...existing,step]));
      // Show "Saving..." indicator — not a blocking error
    }else throw e;
  }
}
// Drain queue on AppState 'active':
useEffect(()=>{
  const sub=AppState.addEventListener('change',async s=>{
    if(s==='active'){
      const q:number[]=JSON.parse(await AsyncStorage.getItem('onboarding_queue')||'[]');
      if(!q.length)return;
      for(const step of q){await apiClient.patch('/onboarding/step',{step});}
      await AsyncStorage.removeItem('onboarding_queue');
    }
  });
  return()=>sub.remove();
},[]);
```
Gate: Complete step while offline → queue written → reconnect → step synced without user action.

---

### QW-06 · Haptic Confirmation Choreography *(2h)*

**Impact:** Disproportionate perceived responsiveness on low-end devices — zero engineering risk.

Audit all interactive elements. All haptics fire synchronously before any `await` (C-20):

| Interaction | Haptic |
|---|---|
| `QuickActionsGrid` tile press | `Haptics.impactAsync(Light)` |
| Filing submission success | `Haptics.notificationAsync(Success)` |
| Form validation error | `Haptics.notificationAsync(Error)` |
| WHT rate toggle | `Haptics.impactAsync(Medium)` |
| `ConfettiAnimation` trigger | `Haptics.notificationAsync(Success)` |
| Biometric prompt | `Haptics.impactAsync(Medium)` |

Gate: `grep -rn "await.*Haptics\|Haptics.*await" mobile/src` → 0 (haptics always before await)

---

### QW-07 · 429 Rate-Limit Toast with Retry Countdown *(2h)*

**Impact:** Stops rage-tapping escalation. Turns throttle error into a reassuring system message.

In `apiClient.ts` response interceptor:
```typescript
if(error.response?.status===429){
  const retryAfter=parseInt(error.response.headers['retry-after']||'60',10);
  Toast.show(`Too many requests — try again in ${retryAfter}s`,{
    type:'warning',duration:Math.min(retryAfter*1000,30_000)
  });
  return Promise.reject(error); // NEVER auto-retry on 429
}
```
Pidgin variant: `"Too many request — wait ${retryAfter}s before you try again"`
Gate: 429 response → toast shows correct seconds → no automatic retry occurs.

---

### QW-08 · Accessibility Announcements on Step Transitions *(2h)*

**Impact:** WCAG 2.2 AA compliance (GAP-08) + usable by ~15% of users with visual impairment.

Pattern (already in Master Prompt §3.3). Apply to all 5 filing wizards:
```typescript
useEffect(()=>{
  AccessibilityInfo.announceForAccessibility(`Step ${currentStep} of ${totalSteps}: ${stepTitle}`);
},[currentStep]);
```
Gate: VoiceOver (iOS) and TalkBack (Android) announce step changes in all 5 wizards.

---

### QW-09 · TIN Validation State Machine *(3h)*

**Impact:** TIN validation is the first NRS interaction. Clear states reduce support tickets.

In `OnboardingWizard.tsx` TIN field:
```typescript
type TINState='IDLE'|'VALIDATING'|'SUCCESS'|'FAILED'|'NETWORK_ERROR';

// IDLE:          default — i18n key 'onboarding.tin.placeholder'
// VALIDATING:    spinner — i18n key 'onboarding.tin.checking'       Pidgin: "Dey check am..."
// SUCCESS:       green ✓ — i18n key 'onboarding.tin.success'        Pidgin: "Your TIN don check out"
// FAILED:        red ✗  — i18n key 'onboarding.tin.failed'          Pidgin: "TIN no dey valid. Check am again"
// NETWORK_ERROR: amber ⚠ — i18n key 'onboarding.tin.networkError'   Pidgin: "Network issue — try again when you get signal"
//   On NETWORK_ERROR: store TIN in AsyncStorage; offer Retry button; NEVER block onboarding progress
```
Gate: All 4 non-IDLE states render correctly in EN and Pidgin.

---

### QW-10 · Asset Compression Pipeline *(2h)*

**Impact:** 30–50% bundle size reduction → faster first paint on 2G.

`scripts/compress-assets.sh`:
```bash
#!/bin/bash
set -e

# PNG compression (requires pngquant)
find mobile/src/assets -name "*.png" -exec pngquant --force --quality=65-80 --output {} {} \;

# Lottie minification
node -e "
const fs=require('fs'),path=require('path'),d='mobile/src/assets/animations';
fs.readdirSync(d).filter(f=>f.endsWith('.json')).forEach(f=>{
  const fp=path.join(d,f),before=fs.statSync(fp).size;
  fs.writeFileSync(fp,JSON.stringify(JSON.parse(fs.readFileSync(fp,'utf8'))));
  const after=fs.statSync(fp).size;
  console.log(f+': '+before+'→'+after+' ('+Math.round((1-after/before)*100)+'% reduction)');
});
"

# Enforce size limits
for f in mobile/src/assets/animations/*.json; do
  size=$(wc -c < "$f")
  if [ "$size" -gt 51200 ]; then echo "❌ $f exceeds 50KB ($size bytes)"; exit 1; fi
done
for f in mobile/src/assets/icons/*.png; do
  [ -f "$f" ] || continue
  size=$(wc -c < "$f")
  if [ "$size" -gt 51200 ]; then echo "❌ $f exceeds 50KB ($size bytes)"; exit 1; fi
done
echo "✅ All assets within size limits"
```
Gate: All Lottie files <50KB; all icon PNGs <50KB; illustration PNGs <200KB.

---

## PART IV — IMPLEMENTATION CHECKLIST

### Pre-Execution (Day 0)
- [ ] Pre-execution gate (§0): all commands exit 0
- [ ] Dependency installation (§1) complete
- [ ] EAS secrets created via CLI — never written to `eas.json`
- [ ] `.env.local` created from `.env.example`
- [ ] `git tag | grep "v11\|v10"` returns ≥1 rollback tag
- [ ] `scripts/create-emergency-rollback-proc.sql` executed in target DB

### Phase 0 — Foundation
- [ ] BUG-S01 through BUG-S04 fixed
- [ ] Design system: `animation.ts` | `ngn.ts` | `tokens.ts` | `ThemeContext.tsx`
- [ ] Shared components: `SectionState` | `InlineError` | `EmptyState` | `ConfettiAnimation`
- [ ] Lottie assets bundled locally and minified (QW-10)
- [ ] Dashboard components: `DashboardZone` | `DashboardSkeleton` (QW-01) | `TaxHealthGauge` (COMP-02)
- [ ] Backend: `validateEnv.ts` | `redis.ts` (COMP-19, C-46) | `prisma.ts` (C-43) | `logger.ts` (COMP-10) | `app.ts`
- [ ] Backend: `eventBus.ts` (COMP-05) | `anomalyEngine.ts` | `riskScoring.ts` | `notifications.ts` | `pdfWorker.ts`
- [ ] Auth: `auth.ts` + `handleSuspiciousReuse` (GAP-02) | `auth/totp.ts` (GAP-03, C-38)
- [ ] Routes: `notifications.ts` (GAP-01) | `dashboard.ts` | `analytics.ts` (COMP-03) | `flutterwave.ts` (GAP-06)
- [ ] Middleware: `tenant.ts` (COMP-08, C-12) | `rateLimit.ts` (GAP-09, C-30) | `idempotency.ts` (C-35) | `validate.ts` (C-34)
- [ ] Database: schema migrations | `UserDevice` model | immutability gates (CI Stage 3)
- [ ] Mobile: `apiClient.ts` (GAP-11) | `useDashboard.ts` (COMP-14) | `usePushNotification.ts` (GAP-01, QW-03) | `useDeepLink.ts` (GAP-07, C-36)
- [ ] Mobile: `DashboardScreen.tsx` | `OnboardingWizard.tsx` (QW-05, QW-09) | `TOTPSetupScreen.tsx`
- [ ] Quick wins: QW-02 font preload | QW-04 X-Request-ID | QW-07 429 toast
- [ ] Phase 0 gate: all commands exit 0

### Phase 1 — Sprint
- [ ] Dashboard: `QuickActionsGrid` (QW-06) | `ComplianceCalendar` | `OfflineSyncStatus` | `MetricsRow`
- [ ] Admin: `analytics/index.tsx` | `dlq/index.tsx` | `audit/index.tsx` | `middleware.ts` (GAP-12)
- [ ] `admin/next.config.js` with CSP (COMP-13)
- [ ] WCAG 2.2 AA on all 5 filing wizards (GAP-08, QW-08)
- [ ] All raw hex → theme tokens | all `FlatList` → `FlashList`
- [ ] Biometric fallthrough | haptic choreography complete (QW-06)
- [ ] Pidgin translations natural and complete
- [ ] Phase 1 gate: all commands exit 0

### Phase 2 — Tax Modules
- [ ] MOD-22 VAT Filing Wizard (9 steps, WCAG)
- [ ] MOD-23 WHT Remittance (no 4% rate — COMP-01)
- [ ] MOD-24 PAYE Payroll (`calculatePIT` per employee, ConfettiAnimation)
- [ ] MOD-25 NIL Return (409 on duplicate)
- [ ] MOD-26 Document Vault (no `ServerSideEncryption` — COMP-08 R2 caveat)
- [ ] MOD-27 Team Management (`role_version` increment path 1 — C-44)
- [ ] MOD-28 CIT Assessment (8 steps, `calculateCIT` only — C-41)
- [ ] Phase 2 gate: all commands exit 0

### Phase 3 — Infrastructure
- [ ] Dockerfile (multi-stage, `USER taxbridge`, dual `prisma generate`)
- [ ] `docker-compose.yml` + `.env.example` (COMP-04)
- [ ] `render.yaml` (`region:fra` — NOT `frankfurt`)
- [ ] `mobile/eas.json` (`compileSdkVersion:36` in all 3 profiles; `SENTRY_DSN` via EAS secret)
- [ ] `scripts/backfill-v12.ts` (COMP-06) | `scripts/seed-dev.ts` (COMP-18)
- [ ] `scripts/verify-prompts.ts` → `yarn prompts:verify` (COMP-09)
- [ ] `scripts/compress-assets.sh` (QW-10)
- [ ] Cron orchestrator (exactly 7 jobs; `setInterval` outside orchestrator → 0)
- [ ] `infra/grafana/alerts.yml` (5 rules) + `infra/grafana/dashboard.json` (6 panels) (COMP-15)
- [ ] `.github/workflows/pipeline.yml` (5 stages)
- [ ] Phase 3 gate: all commands exit 0

### Pre-Deployment
- [ ] Full pre-deployment validation: all commands exit 0
- [ ] All 5 tax accuracy tests pass (PIT | Penalty | CIT large | CIT small | formatNGN)
- [ ] All 9 smoke tests pass in staging
- [ ] All 33 completion criteria simultaneously true
- [ ] Admin Lighthouse ≥98 | Dashboard 2G paint <2000ms | Skeleton 0px CLS
- [ ] `git commit -m "feat(v12): SOVEREIGN — complete production deployment"`

---

## PART V — RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| NRS API downtime during filing window | High | Critical | opossum circuit breaker + `DIGITAX_MOCK_MODE` fallback + `NRS_Circuit_Open` Grafana alert (5m) |
| PgBouncer misconfiguration → connection exhaustion | Medium | Critical | `pgbouncer=true&connection_limit=1` in `DATABASE_URL`; Prisma singleton (C-43) |
| `CBN_MPR` env var stale after rate change | High | High | C-27: update within 24h; stored in GitHub Secrets; never hardcode |
| WHT 4% rate regulatory violation in production | Low (mitigated) | Critical | COMP-01 eradication + `grep -n "0\.04"` gate in CI Stage 1 |
| Refresh token reuse attack | Low (mitigated) | Critical | `handleSuspiciousReuse` + `SECURITY_ALERT` + all sessions invalidated (GAP-02) |
| EAS secret leakage via `eas.json` commit | Low (mitigated) | Critical | C-33 gate in CI Stage 1; `git log -S "SENTRY_DSN"` in pre-execution gate |
| `TaxHealthSnapshot` mutated via `prisma.update` | Low (mitigated) | High | CI Stage 3 `awk` check; `backfill-v12.ts` uses raw SQL only |
| R2 upload failure from `ServerSideEncryption` | Low (mitigated) | High | `pdfWorker.ts` comment + completion criterion 26 |
| Expo push token absent on filing deadline | Medium | Medium | Africa's Talking SMS fallback; both `AFRICA_TALKING_API_KEY` and `AFRICA_TALKING_USERNAME` required |
| DLQ depth spike → missed PDF receipts | Medium | Medium | Grafana `DLQ_Depth_High` alert (>10 for 15m); 2FA gate on bulk retry |
| 2G connection loss mid-filing | High | Medium | `networkMode:'offlineFirst'` + `AsyncStorage` offline queue (QW-05) + exponential backoff |
| Deep link injection attack | Low (mitigated) | High | `SAFE_ROUTES` allowlist (C-36); no dynamic path construction |
| Role escalation via stale JWT | Low (mitigated) | Critical | `role_version` check in `authenticate.ts` + Vercel Edge Config 30s TTL (C-44) |
| Admin CSRF | Low (mitigated) | High | `X-CSRF-Token` cookie check in `admin/src/middleware.ts` (GAP-12) |
| Lottie animation crash → white screen | Medium | Medium | `ConfettiAnimation` `onError` fallback (C-42); local bundle prevents network dependency |

---

## PART VI — GAP CLOSURE SUMMARY

| ID | Gap | Severity | Status |
|---|---|---|---|
| COMP-01 | WHT 4% non-resident rate eradicated; canonical 10% enforced | Critical | ✅ Closed |
| COMP-02 | `computeGaugeMode()` spec'd and exported from `TaxHealthGauge.tsx` | Critical | ✅ Closed |
| COMP-03 | `analytics.ts` all 5 endpoints spec'd with response shapes | High | ✅ Closed |
| COMP-04 | `docker-compose.yml` and `.env.example` fully spec'd | High | ✅ Closed |
| COMP-05 | `eventBus.ts` complete: EventEmitter + BullMQ + `setMaxListeners` + error capture | High | ✅ Closed |
| COMP-06 | `scripts/backfill-v12.ts` spec'd: 4 idempotent operations; raw SQL for INSERT-ONLY models | High | ✅ Closed |
| COMP-07 | Emergency rollback stored procedure with `_V12DeployMarker` table | High | ✅ Closed |
| COMP-08 | `tenant.ts` enforces both `OrgMember.status` and `Organisation.status` | High | ✅ Closed |
| COMP-09 | `verify-prompts.ts` spec'd with exact 12 module list | Medium | ✅ Closed |
| COMP-10 | `logger.ts` redaction includes `receiptUrl` and `documentUrl` | Medium | ✅ Closed |
| COMP-11 | `decodeCursor` has try/catch throwing 400 on malformed input | Medium | ✅ Closed |
| COMP-12 | `formatNGN` K suffix uses `toFixed(1)` — gate `₦1.5K` not `₦2K` | Medium | ✅ Closed |
| COMP-13 | `admin/next.config.js` CSP header with R2 connect-src | Medium | ✅ Closed |
| COMP-14 | `useDashboard` stale-on-resume: 120s `AppState` check + `lastFetchTimeRef` | Medium | ✅ Closed |
| COMP-15 | Auth failure flood: dual threshold — anomaly engine >10/1h AND Grafana >10/1min | Medium | ✅ Closed |
| COMP-16 | `VIEWER_TOKEN` added to GitHub Secrets manifest | Low | ✅ Closed |
| COMP-17 | TOTP lockout recovery: 3-path runbook documented | Low | ✅ Closed |
| COMP-18 | `scripts/seed-dev.ts` spec'd with Acme Ltd seed data | Low | ✅ Closed |
| COMP-19 | `backend/src/lib/redis.ts` IORedis singleton; C-46 enforced | High | ✅ Closed |

**19 complementary gaps closed · 15 enhancement gaps resolved (GAP-01–15) · 46 constraints enforced (C-01–C-46) · 33 completion criteria binary-gated · 10 quick wins specified.**

---

*TaxBridge V12 — Sovereign Complementary Architecture & Quick-Win Playbook | V12-COMP-FINAL-HARDENED | 2026-03-07*
*Branch: `upgrade/v12-elevated-20260302` | Commit to: `prompts/v12_complementary_architecture.md`*
*19 COMP gaps closed · 10 Quick Wins · Zero deferred items.*
