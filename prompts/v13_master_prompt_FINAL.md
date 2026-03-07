# TAXBRIDGE V13 MASTER PROMPT — SOVEREIGN

**Path:** `/prompts/v13_master_prompt.md`
**Repo:** `github.com/Scardubu/taxbridge`
**Branch:** `upgrade/v13-sovereign-20260307`
**Supersedes:** All prior versions — V10.3, V11.0, V12-FINAL, V13-Draft
**Effective:** 2026-03-07
**Revision:** v13.2 — Final corrections pass (2026-03-07)
**Stack:** Fastify 5 · Node 20 LTS · PostgreSQL 15 · Redis 7 (IORedis) · React Native Expo SDK 54 · Next.js 15 (App Router)
**Deployment:** Backend → Render Docker `fra` · Admin → Vercel · Mobile → EAS (Android + iOS)

> **This document is the single immutable source of truth for all engineering decisions in the Scardubu/taxbridge monorepo. No deviation is permitted.**

---

## §0 FOUNDATIONAL IDENTITY CONTRACT

TaxBridge transforms Nigerian SME tax compliance from an anxiety-inducing obligation into a confident, guided, and delightful experience. Every line of code must honour this mission.

> **Design Target:** A first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin. If it works for them, it works for everyone.

> **Engineering Target:** Fintech-grade. Zero-trust. Audit-immutable. Deterministic. Production-sovereign from day one.

| Principle | Enforcement |
|---|---|
| Tax numbers are defensible | Every calculation from `@taxbridge/contracts` — cites NTA 2025 §XX |
| Offline is invisible | React Query cache + AsyncStorage queue; `OfflineSyncStatus` in AMBIENT zone |
| Pidgin is first-class | Natural Lagos Pidgin; CI blocks raw keys and literal translations |
| Performance is trust | Single composite call; FlashList; 60fps gauge; gzip; 2G < 2s first paint |
| Multi-tenant always | `orgId` on every business query; `resolveOrgContext` on every business route |
| Audit trail is immutable | `AuditEvent` + `TaxHealthSnapshot` have no `updatedAt`; all filing writes awaited |
| Security is zero-trust | Every route: `authenticate` → `resolveOrgContext` → `requireRole`. No exceptions. |
| Secrets are never literals | `CBN_MPR`, `CORS_ORIGIN`, `DOCUMENT_VAULT_KMS_PROVIDER`, `SENTRY_DSN` — always from env |
| Compliance is proactive | NIL returns required; preflight before Submit CTA; penalty estimates before deadlines |
| Intelligence is explainable | Anomaly descriptions cite specific data points; `throw → []`, never propagate |

---

## §1 SYSTEM ARCHITECTURE

### 1.1 Confirmed Technology Stack

| Layer | Package | Version |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| API Framework | **Fastify** | **5.x** |
| ORM | Prisma | 5.22 |
| Database | PostgreSQL | 15 |
| Cache / Queue broker | Redis (IORedis) | 7 |
| Job queue | BullMQ | 5.x |
| Structured logging | Pino (via Fastify built-in) | 9.x |
| Error tracking | Sentry | latest |
| Mobile framework | React Native / Expo | SDK 54 |
| Navigation | Expo Router | 3.x |
| Animation | Reanimated | 3.x |
| List rendering | @shopify/flash-list | latest |
| i18n | i18next | latest |
| Animation assets | lottie-react-native | latest |
| Admin framework | **Next.js** | **15 (App Router)** |
| Admin auth | jose | latest |
| Admin UI | Tailwind CSS | latest |
| Admin charts | Recharts | latest |
| TOTP | speakeasy | latest |
| Password hashing | bcrypt | latest |
| Circuit breaker | opossum | latest |
| Metrics | prom-client | latest |
| Cron scheduling | node-cron | latest |
| File upload | @fastify/multipart | latest |
| ID generation | @paralleldrive/cuid2 | latest |
| Test Redis mock | ioredis-mock | devDependency |

> ⚠️ **CRITICAL:** The API framework is **Fastify 5**, not Express. All middleware, routing, request/reply, error handling, and plugin patterns follow Fastify conventions exclusively. Do not introduce Express-style `app.use()`, `router.get/post`, `res.json()`, or `req.body` without the Fastify request context. See §5 for all Fastify-specific patterns.

### 1.2 Monorepo Structure

```
taxbridge/
├── packages/contracts/src/          # ZERO business logic outside this package
│   ├── constants.ts                 # NTA 2025 canonical rates + thresholds
│   ├── pit.ts                       # calculatePIT() + calculateRRA()
│   ├── vat.ts                       # calculateVAT() + registration logic
│   ├── wht.ts                       # calculateWHT() + exemption logic
│   ├── cit.ts                       # calculateCIT() → { citLiability, band }
│   ├── cgt.ts                       # calculateCGT()
│   ├── penalties.ts                 # calculatePenalty() — NTA 2025 §§153-180
│   ├── rbac.ts                      # UserRole enum + ROLE_HIERARCHY
│   ├── types.ts                     # DashboardComposite, IntelligenceInput, PaginatedResponse<T>
│   └── index.ts                     # Barrel — the only import consumers use
│
├── backend/src/
│   ├── server.ts                    # Process entry point: imports buildApp(), calls fastify.listen()
│   ├── app.ts                       # buildApp(): validateEnv FIRST import; plugin registration; exports FastifyInstance
│   ├── validateEnv.ts               # Hard-crash on missing required env vars — imported before fastify()
│   ├── metrics.ts                   # prom-client singleton — global.__taxbridge_prom_registry
│   ├── lib/
│   │   ├── prisma.ts                # global.__prisma singleton (C-43)
│   │   ├── redis.ts                 # global.__taxbridge_redis IORedis singleton (C-46)
│   │   └── logger.ts                # Re-export fastify.log; Pino redact config
│   ├── plugins/
│   │   ├── authenticate.ts          # fastify.decorate('authenticate'); JWT RS256 + role_version check
│   │   ├── resolveOrgContext.ts     # fastify.decorate('resolveOrgContext'); tenant isolation
│   │   ├── requireRole.ts           # fastify preHandler factory; fire-and-forget ACCESS_DENIED audit
│   │   ├── require2FA.ts            # TOTP 5-min Redis TTL preHandler
│   │   ├── rateLimit.ts             # @fastify/rate-limit per-route config map
│   │   ├── validate.ts              # Zod safeParse preHandler (C-34)
│   │   └── idempotency.ts           # X-Idempotency-Key Redis NX 24h (C-35)
│   ├── routes/v1/
│   │   ├── auth.ts                  # login | refresh | handleSuspiciousReuse
│   │   ├── auth/totp.ts             # setup | verify | disable | backup
│   │   ├── dashboard.ts             # Promise.all composite; TTL 120s; FALLBACK_* on every .catch()
│   │   ├── notifications.ts         # register | unregister UserDevice
│   │   ├── onboarding/
│   │   │   ├── tin.ts               # Youverify + NRS TIN validation + audit event
│   │   │   ├── cac.ts               # CAC/RC via Youverify + audit event
│   │   │   └── progress.ts          # PATCH — resume wizard; router.replace on completion
│   │   ├── filings/
│   │   │   ├── nil.ts               # idempotent; 409 on duplicate; audit awaited
│   │   │   ├── vat.ts               # VATCreditBalance read; calculateVAT from contracts
│   │   │   ├── wht.ts               # rates from contracts only; C-23 dual exemption
│   │   │   ├── paye.ts              # calculatePIT per employee; batch audit
│   │   │   └── cit.ts               # calculateCIT() only — no inline math (C-41)
│   │   ├── compliance/
│   │   │   ├── preflight.ts         # runPreFlight() — 4× Promise.allSettled; never throws
│   │   │   ├── penalty-estimate.ts  # calculatePenalty via contracts
│   │   │   └── vat-credit.ts        # DB read only — never recompute (C-22)
│   │   ├── payroll/run.ts           # idempotency + validate preHandler required
│   │   ├── documents.ts             # R2 signed URLs 24h; @fastify/multipart; no ServerSideEncryption (C-40)
│   │   ├── team.ts                  # role_version increment; last-OWNER guard
│   │   └── accountant.ts            # revokedAt: null on all delegation queries (C-28)
│   ├── routes/v2/
│   │   ├── monitoring.ts            # /health always 200; /metrics ADMIN only
│   │   ├── analytics.ts             # 5 endpoints for admin panels (ADMIN+)
│   │   ├── dlq.ts                   # list | retry (2FA gate depth>10) | resolve
│   │   └── audit.ts                 # cursor-paginated + NDJSON streaming export
│   ├── routes/webhooks/
│   │   ├── flutterwave.ts           # HMAC rawBody + Redis NX idempotency
│   │   ├── paystack.ts              # HMAC x-paystack-signature + Redis NX idempotency
│   │   └── remita.ts                # RRR verification + payment status update
│   ├── services/
│   │   ├── audit.ts                 # writeAuditEvent — always awaited (exception: ACCESS_DENIED)
│   │   ├── dashboardService.ts      # buildIntelligenceInput(); FALLBACK_* constants
│   │   ├── anomalyEngine.ts         # 7 signals; cap 5; try/catch → [] (never propagates)
│   │   ├── riskScoring.ts           # 5 components; Math.max(0, Math.min(100, total)) before DB
│   │   ├── compliancePreFlight.ts   # 4× Promise.allSettled; C-07 never throws
│   │   ├── nrsService.ts            # opossum circuit breaker; DIGITAX_MOCK_MODE fallback
│   │   ├── vatCredit.service.ts     # VATCreditBalance read + write
│   │   ├── penaltyService.ts        # calculatePenalty wrapper
│   │   ├── notifications.ts         # Expo push + Africa's Talking SMS fallback
│   │   ├── youverify.ts             # TIN/BVN/CAC identity verification wrapper
│   │   └── eventBus.ts              # EventEmitter (setMaxListeners 30) + BullMQ queue exports
│   ├── workers/
│   │   └── pdfWorker.ts             # BullMQ → pdfkit → R2 (no ServerSideEncryption)
│   └── cron/
│       └── orchestrator.ts          # node-cron; exactly 7 jobs registered — no setInterval anywhere else
│
├── backend/prisma/
│   ├── schema.prisma
│   ├── migrations/                  # Append-only; compensating migrations only; never rollback
│   └── seeds/smokeTestUser.ts       # Deterministic credentials for CI smoke tests
│
├── mobile/src/
│   ├── design-system/
│   │   ├── animation.ts             # DURATION | EASE | ENTER_FROM | ZONE_DELAY — only animation source
│   │   ├── ngn.ts                   # formatNGN() — only NGN formatting source (C-32)
│   │   └── tokens.ts                # COLORS | TYPOGRAPHY | SPACING | RADIUS (dark + light)
│   ├── contexts/ThemeContext.tsx
│   ├── components/
│   │   ├── shared/                  # SectionState | InlineError | EmptyState | ConfettiAnimation
│   │   ├── dashboard/               # DashboardZone | DashboardSkeleton | TaxHealthGauge
│   │   │                            # QuickActionsGrid | ComplianceCalendar | MetricsRow | OfflineSyncStatus
│   │   └── education/               # ExplainMyTax — 7 bundled concepts; zero API calls; offline-safe
│   ├── hooks/
│   │   ├── useDashboard.ts          # gcTime 5min; staleTime 30s; AppState active → invalidate
│   │   ├── usePushNotification.ts
│   │   ├── useDeepLink.ts           # SAFE_ROUTES allowlist enforced (C-36)
│   │   └── useBiometric.ts          # expo-local-authentication; fallthrough to PIN always
│   ├── screens/
│   │   ├── DashboardScreen.tsx      # Exactly 5 zones: apex | signal | action | context | ambient
│   │   ├── OnboardingWizard.tsx     # 5 steps; router.replace('/dashboard') on completion
│   │   ├── auth/TOTPSetupScreen.tsx # 5-step enrollment; backup codes gate
│   │   ├── filings/                 # VATFilingWizard | WHTWizard | PAYEWizard | NILReturnScreen | CITFilingWizard
│   │   ├── documents/DocumentVaultScreen.tsx
│   │   └── team/TeamManagementScreen.tsx
│   ├── i18n/
│   │   ├── en.json                  # Every user-visible string
│   │   ├── pidgin.json              # Natural Lagos Pidgin — NOT literal translation
│   │   └── i18n.config.ts           # initImmediate: false (prevents raw keys on device)
│   └── services/apiClient.ts        # isOfflineError() | 429 toast | stale-on-resume 120s threshold
│
├── admin/src/
│   ├── middleware.ts                # jose Edge JWT + role_version 30s TTL + CSRF token check
│   └── app/admin/                   # Next.js 15 App Router — NOT pages/admin
│       ├── analytics/page.tsx        # 5 panels; FALLBACK_* on all .catch()
│       ├── dlq/page.tsx              # Retry + resolve; require2FA gate for bulk >10
│       ├── audit/page.tsx            # Cursor-paginated viewer + NDJSON export
│       └── team/page.tsx             # RBAC management; last-OWNER guard enforced
│
├── infra/
│   ├── grafana/alerts.yml           # 5 alert rules (see §18)
│   ├── grafana/dashboard.json       # 6-panel Grafana dashboard
│   └── k6/load-test.js              # 200 VUs; 10 min; p95 < 2,000ms; error < 1%
│
├── scripts/
│   ├── backfill-v13.ts              # Idempotent; raw SQL for INSERT-ONLY models; --dry-run flag
│   ├── seed-dev.ts                  # Acme Ltd + deterministic smokeTestUser credentials
│   ├── verify-prompts.ts            # yarn prompts:verify → ✅ 12/12
│   ├── compress-assets.sh           # pngquant + Lottie JSON minify; size gates enforced
│   └── create-emergency-rollback-proc.sql
│
├── prompts/
│   ├── v13_master_prompt.md         # ← THIS FILE
│   └── v13_implementation_prompt.md # Cursor agent execution directive
│
├── docs/
│   ├── PRD.md                       # Current product requirements
│   ├── ARCHITECTURE.md              # Generated from this document
│   ├── INCIDENT_RESPONSE.md
│   ├── CHANGELOG.md
│   ├── PRODUCTION_READY.md
│   └── api/                         # OpenAPI 3.1 specs (auto-generated via fastify-swagger)
│
├── Dockerfile                       # Multi-stage; USER taxbridge; dual prisma generate; HEALTHCHECK
├── docker-compose.yml               # postgres:15 + redis:7 + api; env_file: .env
├── render.yaml                      # region: fra; logDrain: grafana-loki
└── .github/workflows/pipeline.yml   # 5 CI stages
```

### 1.3 Service Boundary Rules

| Package | Owns | Cannot Touch |
|---|---|---|
| `contracts/` | All tax math, RBAC types, shared interfaces, `IntelligenceInput` | No DB; no HTTP |
| `backend/` | API, auth, filing, queues, anomaly engine, risk scoring | No inline tax math |
| `mobile/` | UX, offline queue, filing wizards, onboarding | No tax math; no admin logic |
| `admin/` | Ops dashboard, DLQ, audit explorer, analytics | No mobile-only logic |
| `infra/` | IaC, Grafana configs, load tests | No application code |

**Cross-boundary rules:**
- Tax calculation always flows `mobile → API → contracts`. Never `mobile → contracts` in production runtime.
- `anomalyEngine.ts` and `riskScoring.ts` are pure functions. They consume `IntelligenceInput`. They never call HTTP or touch the event bus.

### 1.4 Multi-Tenant Org Isolation

```typescript
// backend/src/plugins/resolveOrgContext.ts
// Registered as a Fastify preHandler decorator — applied to EVERY business route
import fp                           from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma }                   from '../lib/prisma';

declare module 'fastify' {
  interface FastifyInstance {
    resolveOrgContext: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    orgContext: { orgId: string; role: string; memberId: string };
  }
}

export default fp(async function resolveOrgContextPlugin(fastify) {
  fastify.decorate('resolveOrgContext', async function resolveOrgContext(
    request: FastifyRequest, reply: FastifyReply
  ) {
    const { userId, orgId } = request.user;
    const member = await prisma.orgMember.findFirst({
      where: { userId, orgId, status: 'active', deletedAt: null },
    });
    if (!member)
      return reply.code(403).send({ error: 'ORG_ACCESS_DENIED', message: 'Access denied to this organisation' });
    const org = await prisma.organisation.findUnique({ where: { id: orgId } });
    if (!org || org.status === 'SUSPENDED')
      return reply.code(403).send({ error: 'ORG_SUSPENDED' });
    if (org.status === 'PENDING_VERIFICATION')
      return reply.code(403).send({ error: 'ORG_PENDING_VERIFICATION' });
    request.orgContext = { orgId, role: member.role, memberId: member.id };
  });
});
// All route handlers: destructure request.orgContext.orgId — NEVER request.user.id alone for business data
```

### 1.5 NGN Currency Formatting

```typescript
// mobile/src/design-system/ngn.ts — single source for all NGN formatting (C-32)
export function formatNGN(amount: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (amount >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000)     return `₦${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000)         return `₦${(amount / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}
// ✅ formatNGN(632_400)                       → "₦632,400"
// ✅ formatNGN(5_000_000, { compact: true }) → "₦5.0M"
// ❌ `₦${amount.toLocaleString()}`           → OEM-dependent; breaks on some Android
// ❌ `₦1.5K` via toFixed(0)                 → loses decimal precision; use toFixed(1)
```

---

## §2 NTA 2025 TAX CONSTANTS

> **Single source of truth: `packages/contracts/src/constants.ts`.** Zero inline math anywhere outside this file.

```typescript
export const NRS_STAMP_THRESHOLD          = 200_000;
export const VAT_RATE                     = 0.075;
export const VAT_REGISTRATION_THRESHOLD   = 25_000_000;   // NTA 2025 §12 — NOT ₦100M
export const VAT_SMALL_CO_EXEMPTION       = 100_000_000;
export const SMALL_CO_CIT_THRESHOLD       = 100_000_000;
export const SMALL_CO_FIXED_ASSETS_MAX    = 250_000_000;
export const WHT_PROFESSIONAL_RATE        = 0.10;  // 10% — NOT 5%; most common dev error
export const WHT_CONSTRUCTION_RATE        = 0.05;  // 5% — construction/contracts ONLY
export const WHT_NONRESIDENT_RATE         = 0.04;  // non-resident ONLY; never a default
export const WHT_MONTHLY_EXEMPTION_CAP    = 2_000_000;
export const DEV_LEVY_RATE                = 0.04;
export const CIT_LARGE_RATE               = 0.30;
export const CIT_SMALL_RATE               = 0.00;  // < ₦100M turnover
export const PENALTY_IND_FIRST_MONTH      = 50_000;
export const PENALTY_IND_SUBSEQUENT       = 25_000;
export const PENALTY_CO_FIRST_MONTH       = 250_000;
export const PENALTY_CO_SUBSEQUENT        = 125_000;
export const PENALTY_VAT_CO_MONTH         = 50_000;
// CBN_MPR: NEVER hardcoded. Always: parseFloat(process.env.CBN_MPR ?? '0.2725')

export const PIT_BANDS: ReadonlyArray<{ limit: number; rate: number }> = [
  { limit:   800_000, rate: 0.00 },
  { limit: 2_200_000, rate: 0.15 },
  { limit: 9_000_000, rate: 0.18 },
  { limit:13_000_000, rate: 0.21 },
  { limit:25_000_000, rate: 0.23 },
  { limit: Infinity,  rate: 0.25 },
];

export function calculateRRA(annualRentPaid: number): number {
  if (annualRentPaid <= 0) return 0;
  return Math.min(0.20 * annualRentPaid, 500_000);  // NTA 2025 §34
}
```

### 2.1 Abolished Provisions — Delete All Occurrences on Sight

| Abolished | Replacement | CI Gate |
|---|---|---|
| CRA: `max(₦200k, 1%×gross) + 20%×gross` | `calculateRRA()` | `grep -rn "CRA\|consolidatedRelief"` → 0 |
| Individual minimum tax: `max(PIT, 1%×gross)` | None — liability is ₦0 if Band 1 applies | `grep -rn "minTax\|0\.01.*gross"` → 0 |
| 15% ETR on PIT | Corporate MNE only (NTA 2025 §47) | `grep -rn "ETR.*PIT\|15%.*individual"` → 0 |
| CIT medium band at 20% | Threshold is ₦100M — only 0% or 30% | `grep -rn "0\.20.*[Cc][Ii][Tt]"` → 0 |
| WHT 4% as general/default rate | Non-resident only; never default | `grep -rn "0\.04.*[Ww][Hh][Tt]" backend/src` → 0 |

### 2.2 Tax Accuracy Gates — All Must Pass Before Merge

```bash
# Gate 1: PIT accuracy
npx tsx -e "
  import { calculatePIT } from './packages/contracts/src/index.js';
  const r = calculatePIT({ grossIncome: 5_000_000, rentPaid: 600_000, pension: 200_000 });
  if (Math.abs(r.taxLiability - 632_400) > 1) { process.stderr.write('FAIL ' + r.taxLiability + '\n'); process.exit(1); }
  process.stdout.write('✅ PIT: ' + r.taxLiability + '\n'); // RRA=120k | Taxable=4.68M | Total=632,400
"

# Gate 2: Penalty accuracy
npx tsx -e "
  import { calculatePenalty } from './packages/contracts/src/index.js';
  const r = calculatePenalty({ entityType:'company', daysLate:32, taxAmountDue:0, disclosurePhase:'after_assessment' });
  if (r.netPenalty !== 375_000) { process.stderr.write('FAIL ' + r.netPenalty + '\n'); process.exit(1); }
  process.stdout.write('✅ Penalty: ' + r.netPenalty + '\n');
  // monthsLate=2; lateFiling=250k+(1×125k)=375k; interest=0; waiver=0% → 375,000
"

# Gate 3: CIT large company
npx tsx -e "
  import { calculateCIT } from './packages/contracts/src/index.js';
  const r = calculateCIT({ turnover: 150_000_000, taxableProfit: 15_000_000 });
  if (r.citLiability !== 4_500_000) { process.stderr.write('FAIL ' + r.citLiability + '\n'); process.exit(1); }
  process.stdout.write('✅ CIT large: ' + r.citLiability + '\n');
"

# Gate 4: CIT small company (₦0)
npx tsx -e "
  import { calculateCIT } from './packages/contracts/src/index.js';
  const r = calculateCIT({ turnover: 80_000_000, taxableProfit: 5_000_000 });
  if (r.citLiability !== 0) { process.stderr.write('FAIL ' + r.citLiability + '\n'); process.exit(1); }
  process.stdout.write('✅ CIT small: ' + r.citLiability + '\n');
"

# Gate 5: formatNGN
npx tsx -e "
  import { formatNGN } from './mobile/src/design-system/ngn.js';
  if (formatNGN(632_400) !== '₦632,400') process.exit(1);
  if (formatNGN(5_000_000, { compact: true }) !== '₦5.0M') process.exit(1);
  process.stdout.write('✅ formatNGN gates passed\n');
"
```

### 2.3 WHT Rate Decision Tree

```
Professional / consultancy fees  → 10%  ← ⚠️ Most common dev error (NOT 5%)
Dividends / Interest / Royalties → 10%
Rent (commercial)                → 10%
Agency commissions               → 10%
Construction / contracts only    →  5%  ← only this category
Non-resident (no NRS WHT)        →  4%  flat
```

WHT exemption requires **both conditions simultaneously:**
- (a) Valid counterparty TIN on file
- (b) Total payments to that party ≤ ₦2,000,000 in that calendar month

### 2.4 Penalty Engine Spec

```typescript
// calculatePenalty(input): PenaltyResult
// disclosurePhase: 'before_audit' | 'during_audit' | 'after_assessment'
// waiverRate:      100%              50%               0%
// monthsLate    = Math.ceil(daysLate / 30)
// lateFiling    = firstMonth + Math.max(0, monthsLate - 1) × subsequent
// cbnMpr        = parseFloat(process.env.CBN_MPR ?? '0.2725')  // NEVER hardcode
// interest      = taxAmountDue × (cbnMpr + 0.10) × (daysLate / 365)
// netPenalty    = (lateFiling + interest) × (1 - waiverRate)
// VAT penalty:  PENALTY_VAT_CO_MONTH per month — separate schedule from income tax
// NIL late:     same penalty schedule as substantive late filing
```

---

## §3 MANDATORY SESSION OPENING — 8 STEPS

> Run **all 8** before modifying any file. Steps 3–7 must return 0 results or **stop**.

```bash
# 1 — Platform state
cat docs/CHANGELOG.md && cat docs/PRODUCTION_READY.md

# 2 — Prompt modules loaded
yarn prompts:verify
# Expected: ✅ 12/12 modules loaded (M00–M11)

# 3 — FIRS eradication
grep -rn "FIRS" backend/src mobile/src admin/src packages \
  --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules
# → 0 results

# 4 — Contamination
grep -rn "NRSt\|CRA\b\|CRA_\|ProgressBar" backend/src mobile/src \
  --include="*.ts" --include="*.tsx" | grep -v node_modules
# → 0 results

# 5 — Inline tax math in wrong packages
# Catches numeric rate literals used in multiplication/assignment context (not comments or test assertions)
grep -rn "0\.075\b\|0\.30\b\|0\.04\b\|0\.10\b" backend/src mobile/src admin/src \
  --include="*.ts" --include="*.tsx" | grep -v contracts | grep -v node_modules \
  | grep -v "//.*0\." | grep -v "\.test\.\|\.spec\."
# → 0 results (review any hits carefully before blocking — some valid usages exist in test mocks)

# 6 — Redis singleton integrity
grep -rn "new IORedis\|new Redis" backend/src --include="*.ts" \
  | grep -v "backend/src/lib/redis.ts" \
  | grep -v "backend/src/services/eventBus.ts"   # eventBus.ts: createWorkerConnection() is exempt
# → 0 results

# 7 — No console.log in backend
grep -rn "console\.log" backend/src --include="*.ts"
# → 0 results

# 8 — TypeScript clean
npx tsc --noEmit
# → 0 errors, 0 warnings
```

---

## §4 ABSOLUTE CONSTRAINTS C-01 – C-47

> Every constraint is enforced by CI. Violation blocks merge or deploy — no exceptions, no deferrals.

### C-01 through C-17: Critical — Block Merge

| ID | Rule | CI Gate |
|---|---|---|
| **C-01** | TypeScript strict mode on in all workspaces; zero `any` casts in route handlers | `npx tsc --noEmit` → 0 errors |
| **C-02** | No `FIRS` in source — use `NRS` everywhere | `grep 'FIRS' backend/src mobile/src admin/src` → 0 |
| **C-03** | EAS profiles: `compileSdkVersion:36`, `targetSdkVersion:35` — never change | Checked in Stage 1 |
| **C-04** | `@taxbridge/contracts` is the sole tax-math package — never duplicate logic across workspaces | Import graph audit → 0 duplicate calc functions |
| **C-05** | `npm test --workspaces` → ≥550 passing, 0 failing before any merge | CI Stage 4 |
| **C-06** | Every UI string in both `en.json` AND `pidgin.json`; Pidgin must be natural Lagos Pidgin | `yarn i18n:check` → exit 0 |
| **C-08** | `Math.random()` forbidden in dashboard, chart, analytics, or tax calculation code | `grep 'Math\.random'` → 0 |
| **C-09** | Zero inline tax math in `backend/`, `mobile/`, `admin/` | Inline math grep → 0 |
| **C-10** | All rates from `constants.ts` — no hardcoded numeric rate values elsewhere | Inline rate grep → 0 |
| **C-13** | `TaxHealthGauge` = 230° SVG arc only — `ProgressBar` is never a substitute | `grep 'ProgressBar' DashboardScreen.tsx` → 0 |
| **C-17** | `DashboardScreen` must have exactly 5 `DashboardZone` elements | `grep -c '<DashboardZone' DashboardScreen.tsx` → 5 |

### C-18 through C-46: Critical — Block Deploy

| ID | Rule | CI Gate |
|---|---|---|
| **C-21** | `POST /filings/nil` idempotent; 409 on duplicate; audit awaited | Route + test |
| **C-26** | Pino only — zero `console.log` in `backend/` | `grep 'console\.log' backend/src` → 0 |
| **C-27** | `CBN_MPR` never hardcoded | `grep '0\.2725\b' packages/contracts backend/src` → 0 |
| **C-33** | `SENTRY_DSN` placeholder never committed | `grep 'REPLACE_WITH' mobile/eas.json` → 0 |
| **C-34** | `validate()` preHandler on all POST/PATCH mutation routes — never `schema.parse()` in handler | Route coverage |
| **C-35** | `idempotency` preHandler on nil, vat, wht, cit filings, payroll/run, payments/initiate | Route coverage |
| **C-43** | `global.__prisma` singleton — no `new PrismaClient` in routes or services | `grep 'new PrismaClient' src` → 0 |
| **C-44** | `role_version` incremented in ≥3 paths: role change + TOTP disable + account suspension | `grep role_version` → ≥3 distinct call sites |
| **C-46** | No `new IORedis` outside `lib/redis.ts` **and** `services/eventBus.ts` — `eventBus.ts` may define `createWorkerConnection()` for BullMQ Workers | `grep 'new IORedis\|new Redis' backend/src` → only hits in `lib/redis.ts` and `services/eventBus.ts` |
| **C-47** | No Express imports in backend (`express`, `Router`, `Request`, `Response` from express) | `grep "from 'express'" backend/src` → 0 |

### Behavioral Constraints — Enforced in Code Review

- **C-07** — No route returns 500 on DB/network failure — degrade to `FALLBACK_*` constants + Sentry capture
- **C-11** — Zod validation: `reply.code(400).send({ error:'VALIDATION_ERROR', issues: result.error.issues })` — `.issues` not `.errors`
- **C-12** — Admin cold-start: all dashboard routes return HTTP 200 with `FALLBACK_*` when DB unreachable
- **C-14** — One composite dashboard call — never fire 3+ separate requests on component mount
- **C-15** — Every status indicator: color + icon/shape + text label (WCAG 2.2 AA three-channel)
- **C-16** — Animation tokens only: `withTiming(1, { duration: DURATION.standard, easing: EASE.enter })`
- **C-18** — Every dashboard content section in `<DashboardZone zone="…" visible={!isLoading}>`
- **C-19** — Anomaly empty: `empty={null}` — never render "No anomalies" or equivalent text
- **C-20** — Gesture response ≤100ms: `onPress={() => router.push('/route')}` — never `await` in tap handler
- **C-22** — VAT credit: `vatCreditBalance.findFirst` from DB — never recompute from transactions
- **C-23** — WHT exemption: BOTH (a) valid counterparty TIN AND (b) monthly total ≤ ₦2M simultaneously
- **C-24** — RBAC via preHandler only — no inline `if (request.user.role === ...)` in any handler
- **C-25** — Audit events always `await writeAuditEvent(...)`. Only exception: `ACCESS_DENIED` in requireRole → `.catch(()=>{})`
- **C-28** — Accountant delegation queries always include `revokedAt: null`
- **C-29** — NRS circuit override requires `SUPER_ADMIN` + 2FA — `ADMIN` alone is insufficient
- **C-30** — Docker secrets as files: `fs.readFileSync('/run/secrets/key').trim()` not `process.env`
- **C-31** — `orgId` on all business queries: `where: { orgId: request.orgContext.orgId, ... }`
- **C-32** — NGN formatting via `formatNGN()` only — no `₦${amount.toLocaleString()}`
- **C-36** — Deep link `SAFE_ROUTES` allowlist enforced — no dynamic path construction
- **C-37** — Flutterwave HMAC: raw Buffer via Fastify content-type parser + `timingSafeEqual`
- **C-38** — TOTP backup codes hashed with bcrypt cost 12 before storage
- **C-39** — Push notification registration: `UserDevice` upsert required in DB
- **C-40** — `pdfWorker.ts` R2 upload: **no** `ServerSideEncryption` param (causes R2 error)
- **C-41** — CIT: `calculateCIT()` only. Returns `{ citLiability, band }`. No inline math anywhere.
- **C-42** — `ConfettiAnimation` must have `onError` fallback — local JSON bundle prevents network fail
- **C-45** — Pino redact paths: `req.headers.authorization`, `body.password`, `body.tin`, `body.bvn`, `body.receiptUrl`, `body.documentUrl`

---

## §5 FASTIFY APPLICATION PATTERNS

> **This section replaces all Express-style code patterns.** Fastify 5 is the API framework. Any Express API (`app.use`, `Router`, `res.json`, `req.body` without Fastify context, `next()`) is a build error.

### 5.1 Server Construction — `backend/src/app.ts`

```typescript
// backend/src/app.ts — exports buildApp(); never calls listen() directly
import './validateEnv';                      // ← MUST be absolute first import; hard-crashes on missing env

import Fastify, { FastifyInstance }         from 'fastify';
import fastifyCors                          from '@fastify/cors';
import fastifyHelmet                        from '@fastify/helmet';
import fastifyCompress                      from '@fastify/compress';
import fastifyRateLimit                     from '@fastify/rate-limit';
import fastifyMultipart                     from '@fastify/multipart';
import fastifySwagger                       from '@fastify/swagger';
import fastifySwaggerUI                     from '@fastify/swagger-ui';
import { redis }                            from './lib/redis';

// Static plugin imports — no dynamic import(); Node 20 ESM-safe; tree-shaking friendly
import authenticatePlugin   from './plugins/authenticate';
import resolveOrgCtxPlugin  from './plugins/resolveOrgContext';
import authRoutes           from './routes/v1/auth';
import totpRoutes           from './routes/v1/auth/totp';
import dashboardRoutes      from './routes/v1/dashboard';
import onboardingRoutes     from './routes/v1/onboarding';
import filingsRoutes        from './routes/v1/filings';
import complianceRoutes     from './routes/v1/compliance';
import documentsRoutes      from './routes/v1/documents';
import teamRoutes           from './routes/v1/team';
import accountantRoutes     from './routes/v1/accountant';
import notifRoutes          from './routes/v1/notifications';
import monitoringRoutes     from './routes/v2/monitoring';
import analyticsRoutes      from './routes/v2/analytics';
import dlqRoutes            from './routes/v2/dlq';
import auditRoutes          from './routes/v2/audit';
import flutterwaveWebhook   from './routes/webhooks/flutterwave';
import paystackWebhook      from './routes/webhooks/paystack';
import remitaWebhook        from './routes/webhooks/remita';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    trustProxy: true,                       // Required for Render.com + Vercel proxy headers
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: [
        'req.headers.authorization', 'body.password', 'body.tin',
        'body.bvn', 'body.receiptUrl', 'body.documentUrl',
      ],
      ...(process.env.LOG_FORMAT !== 'json'
        ? { transport: { target: 'pino-pretty' } }
        : {}),
    },
  });

  // ── Security plugins ──────────────────────────────────────────────────────
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:              ["'self'"],
        connectSrc:              [
          "'self'",
          process.env.RENDER_EXTERNAL_URL!,
          // Sentry ingest URL derived dynamically from SENTRY_DSN — never hardcode project ID
          ...(process.env.SENTRY_DSN
            ? [new URL(process.env.SENTRY_DSN).origin]
            : ['https://*.ingest.sentry.io']),
        ],
        frameAncestors:          ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  });

  await fastify.register(fastifyCors, {
    origin:      (process.env.CORS_ORIGIN ?? '').split(','),
    credentials: true,
  });

  // ── Performance plugins ───────────────────────────────────────────────────
  await fastify.register(fastifyCompress, { encodings: ['gzip', 'deflate'], threshold: 1024 });

  await fastify.register(fastifyRateLimit, {
    global:          false,                 // All limits are per-route via route config.rateLimit
    redis,                                  // @fastify/rate-limit ≥9 accepts raw IORedis instance
    nameSpace:       'rl:',
    standardHeaders: true,
    legacyHeaders:   false,
    errorResponseBuilder: (_req, ctx) => ({
      error:   'RATE_LIMITED',
      message: `Rate limit exceeded. Retry after ${ctx.after}`,
    }),
  });

  await fastify.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

  // ── JSON body parser — preserves rawBody for HMAC webhook verification ────
  // Replaces Fastify's default JSON parser globally. STILL parses JSON for all
  // routes AND saves the raw Buffer as req.rawBody for webhook HMAC checks.
  // Routes receive request.body as a parsed object exactly as before.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer', bodyLimit: 1_048_576 },
    (_req, body: Buffer, done) => {
      (_req as any).rawBody = body;         // ← Preserved for Flutterwave/Paystack HMAC (C-37)
      try { done(null, JSON.parse(body.toString('utf8'))); }
      catch (err) { done(err as Error, undefined); }
    }
  );

  // ── OpenAPI spec (non-production) ─────────────────────────────────────────
  await fastify.register(fastifySwagger, {
    openapi: {
      info:       { title: 'TaxBridge API', version: '13.0.0', description: 'Nigerian SME Tax Compliance' },
      servers:    [{ url: process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:3000' }],
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security:   [{ bearerAuth: [] }],
    },
  });
  if (process.env.NODE_ENV !== 'production') {
    await fastify.register(fastifySwaggerUI, { routePrefix: '/docs' });
  }

  // ── Auth decorator plugins ────────────────────────────────────────────────
  await fastify.register(authenticatePlugin);
  await fastify.register(resolveOrgCtxPlugin);

  // ── Route plugins ─────────────────────────────────────────────────────────
  await fastify.register(authRoutes,         { prefix: '/api/v1/auth' });
  await fastify.register(totpRoutes,         { prefix: '/api/v1/auth/totp' });
  await fastify.register(dashboardRoutes,    { prefix: '/api/v1' });
  await fastify.register(onboardingRoutes,   { prefix: '/api/v1/onboarding' });
  await fastify.register(filingsRoutes,      { prefix: '/api/v1/filings' });
  await fastify.register(complianceRoutes,   { prefix: '/api/v1/compliance' });
  await fastify.register(documentsRoutes,    { prefix: '/api/v1' });
  await fastify.register(teamRoutes,         { prefix: '/api/v1' });
  await fastify.register(accountantRoutes,   { prefix: '/api/v1' });
  await fastify.register(notifRoutes,        { prefix: '/api/v1' });
  await fastify.register(monitoringRoutes,   { prefix: '/api/v2/monitoring' });
  await fastify.register(analyticsRoutes,    { prefix: '/api/v2' });
  await fastify.register(dlqRoutes,          { prefix: '/api/v2' });
  await fastify.register(auditRoutes,        { prefix: '/api/v2' });
  await fastify.register(flutterwaveWebhook, { prefix: '/webhooks' });
  await fastify.register(paystackWebhook,    { prefix: '/webhooks' });
  await fastify.register(remitaWebhook,      { prefix: '/webhooks' });

  // ── Global catch-all error handler ────────────────────────────────────────
  // Must be set after all routes. Returns canonical ApiError shape.
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error({ err: error }, 'Unhandled error');
    const status = error.statusCode ?? 500;
    reply.code(status).send({
      error:   status === 500 ? 'INTERNAL_ERROR' : (error.code ?? 'ERROR'),
      message: status === 500 ? 'An unexpected error occurred' : error.message,
    });
  });

  return fastify;
}

// ─────────────────────────────────────────────────────────────────────────────
// backend/src/server.ts — process entry point; never imported by other modules
// ─────────────────────────────────────────────────────────────────────────────
// import { buildApp } from './app';
// async function start() {
//   const app = await buildApp();
//   await app.listen({ port: parseInt(process.env.PORT!, 10), host: '0.0.0.0' });
// }
// start().catch(err => { process.stderr.write(String(err) + '\n'); process.exit(1); });
```

### 5.2 Route Plugin Pattern (Fastify)

```typescript
// Example: backend/src/routes/v1/filings/nil.ts
import { FastifyPluginAsync } from 'fastify';
import { z }                  from 'zod';
import { createId }           from '@paralleldrive/cuid2';  // cuid2 — unpredictable filing refs
import { prisma }             from '../../../lib/prisma';
import { validate }           from '../../../plugins/validate';
import { idempotency }        from '../../../plugins/idempotency';
import { requireRole }        from '../../../plugins/requireRole';
import { writeAuditEvent }    from '../../../services/audit';

const NilSchema = z.object({
  taxType:   z.enum(['VAT', 'WHT', 'PAYE', 'CIT']),
  period:    z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  nilReason: z.enum(['NO_REVENUE_THIS_PERIOD','BUSINESS_INACTIVE','EXEMPT_SUPPLY_ONLY','BELOW_REGISTRATION_THRESHOLD']),
});

const nilFilingRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/nil', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preHandler: [
      fastify.authenticate,
      fastify.resolveOrgContext,
      requireRole('ACCOUNTANT'),
      validate(NilSchema),
      idempotency,
    ],
  }, async (request, reply) => {
    const { orgId } = request.orgContext;
    const { taxType, period, nilReason } = request.body as z.infer<typeof NilSchema>;

    const existing = await prisma.taxReturn.findUnique({
      where: { orgId_taxType_period: { orgId, taxType, period } },
    });
    if (existing) return reply.code(409).send({ error: 'DUPLICATE_FILING', message: 'Filing already submitted for this period' });

    const filing = await prisma.taxReturn.create({
      data: { orgId, taxType, period, isNil: true, nilReason, status: 'SUBMITTED',
              filingReference: `NIL-${taxType}-${period}-${createId()}`,  // createId() prevents enumeration
              submittedAt: new Date() },
    });

    await writeAuditEvent({ orgId, actorId: request.user.userId, actorRole: request.orgContext.role,
      targetType: 'TaxReturn', targetId: filing.id, action: 'FILE',
      ip: request.ip, userAgent: request.headers['user-agent'] });

    return reply.send({ filingReference: filing.filingReference, period, taxType });
  });
};

export default nilFilingRoute;
```

### 5.3 Fastify Plugin Decorator Pattern

```typescript
// backend/src/plugins/authenticate.ts
import fp                                       from 'fastify-plugin';
import { FastifyRequest, FastifyReply }         from 'fastify';
import { jwtVerify, importSPKI }               from 'jose';
import { redis }                                from '../lib/redis';
import { readFileSync }                         from 'fs';

// RS256 public key — cached after first import; `importSPKI` is jose-native (not Node crypto)
let _publicKey: Awaited<ReturnType<typeof importSPKI>> | null = null;
async function getPublicKey() {
  if (_publicKey) return _publicKey;
  const pem = process.env.JWT_PUBLIC_KEY
    ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
    : readFileSync('/run/secrets/jwt_public_key', 'utf8').trim();
  _publicKey = await importSPKI(pem, 'RS256');  // jose-native SPKI import — correct for RS256
  return _publicKey;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: { userId: string; orgId: string; role: string; roleVersion: number };
  }
}

export default fp(async function authenticatePlugin(fastify) {
  fastify.decorate('authenticate', async function authenticate(
    request: FastifyRequest, reply: FastifyReply
  ) {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    try {
      // jwtVerify from jose infers algorithm from key type — no algorithms option needed
      const secret = process.env.NODE_ENV === 'production'
        ? await getPublicKey()                                          // RS256 — KeyLike from importSPKI
        : new TextEncoder().encode(process.env.JWT_SECRET!);           // HS256 — Uint8Array for local dev
      const { payload } = await jwtVerify(token, secret);
      // role_version check: explicit null check — version 0 is a valid value (do NOT use falsy check)
      const storedVersion = await redis.get(`role_version:${payload.sub}`);
      if (storedVersion !== null && Number(storedVersion) !== (payload as any).role_version)
        return reply.code(401).send({ error: 'TOKEN_EXPIRED', message: 'Session invalidated — please log in again' });
      request.user = {
        userId:      payload.sub!,
        orgId:       (payload as any).orgId,
        role:        (payload as any).role,
        roleVersion: (payload as any).role_version,
      };
    } catch {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
  });
});
```

### 5.4 Webhook Raw Body Verification (Fastify)

```typescript
// backend/src/routes/webhooks/flutterwave.ts
import { FastifyPluginAsync } from 'fastify';
import { timingSafeEqual, createHmac } from 'crypto';
import { redis }              from '../../lib/redis';

const flutterwaveWebhook: FastifyPluginAsync = async (fastify) => {
  fastify.post('/flutterwave', async (request, reply) => {
    // rawBody is the raw Buffer preserved by the content-type parser in app.ts
    const rawBody = (request as any).rawBody as Buffer;
    const payload = rawBody.toString('utf8');           // C-37: toString('utf8') only

    const expected = createHmac('sha256', process.env.FLUTTERWAVE_SECRET!)
      .update(payload).digest();
    const received = Buffer.from(request.headers['verif-hash'] as string, 'hex');

    if (expected.length !== received.length || !timingSafeEqual(expected, received))
      return reply.code(403).send({ error: 'INVALID_SIGNATURE' });

    const body = request.body as { data: { tx_ref: string } };
    const txRef = body.data?.tx_ref;
    const idemKey = `webhook:flw:${txRef}`;
    const isNew = await redis.set(idemKey, '1', 'EX', 172_800, 'NX');
    if (!isNew) return reply.send({ status: 'already_processed' });

    // Process payment — fire-and-forget
    processFlutterwavePayment(body).catch(e => fastify.log.error(e));
    return reply.send({ status: 'accepted' });
  });
};
export default flutterwaveWebhook;
```

### 5.5 Rate Limits (per-route Fastify config)

| Route | Limit | Scope |
|---|---|---|
| `POST /api/v1/auth/login` | 5 req/min | per IP |
| `POST /api/v1/auth/refresh` | 10 req/min | per userId |
| `GET /api/v1/dashboard` | 30 req/min | per userId |
| `POST /api/v1/filings/*` | 10 req/min | per orgId |
| `POST /api/v1/filings/nil` | 5 req/min | per orgId |
| `POST /api/v1/onboarding/tin` | 3 req/min | per IP |
| `POST /api/v1/onboarding/cac` | 3 req/min | per IP |
| `GET /api/v2/monitoring/health` | Unlimited | public |
| `GET /api/v2/monitoring/metrics` | 10 req/min | ADMIN only |

All limiters: `standardHeaders: true, legacyHeaders: false`.
Route-level config: `config: { rateLimit: { max: N, timeWindow: '1 minute', keyGenerator: (req) => req.user?.userId ?? req.ip } }`

### 5.6 NRS Circuit Breaker

```typescript
// backend/src/services/nrsService.ts
import CircuitBreaker from 'opossum';
import * as Sentry    from '@sentry/node';
import { logger }     from '../lib/logger';    // ← use logger, not fastify.log (no fastify access in services)
import { eventBus }   from './eventBus';

const breaker = new CircuitBreaker(callNRSAPI, {
  timeout:                  10_000,            // 10s NRS API timeout
  errorThresholdPercentage: 50,                // Open after 50% failure rate
  resetTimeout:             30_000,            // Probe again after 30s
  volumeThreshold:          5,                 // Minimum calls before tripping
});

breaker.on('open', () => {
  logger.warn({ circuit: 'nrs' }, 'NRS circuit opened — submissions paused');
  Sentry.captureMessage('NRS circuit breaker opened', 'warning');
  eventBus.emit('nrs.circuitOpened');
});

breaker.on('halfOpen', () => logger.info({ circuit: 'nrs' }, 'NRS circuit half-open — probing'));
breaker.on('close',    () => logger.info({ circuit: 'nrs' }, 'NRS circuit closed — restored'));

// nrsCircuitState Prometheus Gauge: closed=0 | half-open=1 | open=2
// DIGITAX_MOCK_MODE=true → bypass circuit; return { irn: `MOCK-IRN-${Date.now()}` }
// When open: consumers receive NRS_CIRCUIT_OPEN (503) — never a 500
```

### 5.7 Monitoring Route (Always HTTP 200)

```typescript
// backend/src/routes/v2/monitoring.ts
import { FastifyPluginAsync } from 'fastify';
import { requireRole }        from '../../plugins/requireRole';
import { prisma }             from '../../lib/prisma';
import { redis }              from '../../lib/redis';
import { register }           from '../../metrics';        // prom-client global registry

const monitoringRoutes: FastifyPluginAsync = async (fastify) => {
  // Health — always 200; Render health check must receive 200 within 500ms
  fastify.get('/health', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'degraded'> = {};
    try { await prisma.$queryRaw`SELECT 1`; checks.db = 'ok'; }
    catch { checks.db = 'degraded'; }
    try { await redis.ping();                checks.redis = 'ok'; }
    catch { checks.redis = 'degraded'; }
    const status = Object.values(checks).every(v => v === 'ok') ? 'healthy' : 'degraded';
    return reply.code(200).send({ status, checks, timestamp: new Date().toISOString() });
    // ↑ ALWAYS 200 — never 503; 'degraded' is a valid healthy state for Render
  });

  // Prometheus metrics — ADMIN only; Grafana scrape target
  fastify.get('/metrics', {
    preHandler: [fastify.authenticate, requireRole('ADMIN')],
  }, async (_request, reply) => {
    const metrics = await register.metrics();
    return reply.type('text/plain; version=0.0.4').send(metrics);
  });
};

export default monitoringRoutes;
```

### 5.8 TIN + CAC / Youverify Onboarding

```typescript
// POST /api/v1/onboarding/tin
// Youverify → validate TIN active, not suspended; cross-reference NRS
// Body: { tin: string }  — exactly 8 digits
// → await writeAuditEvent (TIN lookups are PII access events)
// Mobile: IDLE → VALIDATING (800ms debounce) → SUCCESS | FAILED | NETWORK_ERROR

// POST /api/v1/onboarding/cac
// Youverify → entityName, directors, status; format RC-NNNNNN
// → Store: orgProfile.cacRcNumber + orgProfile.entityName (verified)
// Rate limit: 3/min/IP
```

---

## §6 RBAC MODEL

```typescript
// packages/contracts/src/rbac.ts
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OWNER' | 'ACCOUNTANT' | 'EMPLOYEE' | 'VIEWER';
export const ROLE_HIERARCHY: Readonly<Record<UserRole, number>> = {
  SUPER_ADMIN: 6, ADMIN: 5, OWNER: 4, ACCOUNTANT: 3, EMPLOYEE: 2, VIEWER: 1,
} as const;
// requireRole preHandler enforces: actor cannot assign a role ≥ their own level
```

### Permission Matrix

| Resource | SUPER_ADMIN | ADMIN | OWNER | ACCOUNTANT | EMPLOYEE | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Invoice create/edit | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Payroll run | ✓ | ✓ | ✓ | ✓ | — | — |
| Tax filings submit | ✓ | ✓ | ✓ | ✓ | — | — |
| Document vault | ✓ | ✓ | ✓ | ✓ | — | — |
| Team management | ✓ | ✓ | ✓ | — | — | — |
| RBAC assign | ✓ | ✓ | ✓¹ | — | — | — |
| Audit log read | ✓ | ✓ | — | — | — | — |
| DLQ management | ✓ | ✓ | — | — | — | — |
| NRS circuit override | ✓ | — | — | — | — | — |

¹ OWNER may assign roles ≤ OWNER within their own org only.

---

## §7 AUDIT AND LOGGING MODEL

### Immutable AuditEvent Schema

```prisma
model AuditEvent {
  id         String      @id @default(cuid())
  orgId      String
  actorId    String
  actorRole  String
  targetType String
  targetId   String
  action     AuditAction
  before     Json?
  after      Json?
  ip         String
  userAgent  String?
  metadata   Json?
  createdAt  DateTime    @default(now())
  // NO updatedAt field — immutability contract (NDPC §30)
  @@index([orgId, createdAt])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
}
```

### Required Audit Points

| Event | Method | Note |
|---|---|---|
| Tax filing submit (any type) | `await` | Mandatory |
| NIL return file | `await` | Mandatory |
| Role change | `await` | Mandatory |
| Document upload / download | `await` | Mandatory |
| NRS stamp (success or failure) | `await` | Mandatory |
| TIN lookup | `await` | Mandatory (PII access) |
| CAC lookup | `await` | Mandatory |
| Accountant delegation grant / revoke | `await` | Mandatory |
| Penalty estimate generated | `await` | Mandatory |
| `ACCESS_DENIED` in `requireRole` | `.catch(()=>{})` | Exception — 403 must not wait on audit write |

### Structured Logging (Fastify built-in Pino)

```typescript
// backend/src/lib/logger.ts
// Service-layer logger — for code that cannot access a FastifyInstance (workers, services, cron).
// In route handlers: always use request.log (Fastify child logger — reqId automatically bound).
import pino from 'pino';

export const logger = pino({
  level:  process.env.LOG_LEVEL ?? 'info',
  redact: [
    'req.headers.authorization', 'body.password', 'body.tin',
    'body.bvn', 'body.receiptUrl', 'body.documentUrl',
  ],
  ...(process.env.LOG_FORMAT !== 'json'
    ? { transport: { target: 'pino-pretty' } }
    : {}),
});

// Usage guide:
// Route handlers  → request.log.info({ orgId }, 'Filing submitted')
// Services/cron   → logger.info({ orgId }, 'Filing submitted')
// NEVER           → console.log / console.error / console.warn  (C-26)
```

---

## §8 FILING ARTIFACT IMMUTABILITY

- `TaxReturn.status === 'submitted'` → only `receiptUrl` may change
- Amendments: create a **new** `TaxReturn` with `amendedReturnId → original.id`; original status → `'amended'`; never deleted
- All amendments audited with `action: 'AMEND'`, `before`/`after` diff
- NRS-stamped invoices: `amount`, `vatAmount`, `buyerTin`, `sellerTin`, `lineItems` are **locked** — backend rejects PATCH; mobile shows 🔒
  > `Invoice` model (not shown in §14 canonical schema — domain-specific implementation): add `nrsStampedAt DateTime?` field; once set, backend enforces immutability on listed fields
- Document Vault: AES-256-GCM at rest; 5-year minimum retention (NTA 2025); hard delete only via SUPER_ADMIN after 7 years; every access logged

---

## §9 API STANDARDIZATION

### Universal Error Shape

```typescript
interface ApiError {
  error:   string;     // SCREAMING_SNAKE_CASE — never changes between versions
  message: string;     // Human-readable EN; safe to surface in UI
  issues?: ZodIssue[]; // 400 VALIDATION_ERROR only
}
```

### Error Code Registry

| HTTP | Code | Trigger |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod `.issues` present |
| 401 | `UNAUTHORIZED` | Missing/expired token |
| 401 | `TOKEN_EXPIRED` | Refresh required |
| 403 | `ORG_ACCESS_DENIED` | Not a member / org suspended |
| 403 | `INSUFFICIENT_ROLE` | Wrong role for route |
| 403 | `2FA_REQUIRED` | TOTP window expired (SUPER_ADMIN op) |
| 403 | `DELEGATION_NOT_ACTIVE` | Accountant delegation revoked |
| 409 | `DUPLICATE_FILING` | Same (orgId, taxType, period) already filed |
| 409 | `LAST_OWNER` | Cannot demote or remove last OWNER |
| 422 | `NRS_SUBMISSION_FAILED` | NRS returned error |
| 429 | `RATE_LIMITED` | Rate limit triggered |
| 500 | `INTERNAL_ERROR` | Global error handler catch-all |
| 503 | `NRS_CIRCUIT_OPEN` | Circuit open; set `DIGITAX_MOCK_MODE=true` |

### API Versioning Policy

```
/api/v1/  — Stable: auth, filings, dashboard, team, documents, onboarding
/api/v2/  — Ops: /health (public) | /metrics (ADMIN) | /dlq (ADMIN) | /audit (ADMIN)
/api/v3/  — Reserved
v1 routes: ≥6 months deprecation notice before sunset. Version always in path.
```

### Idempotency (C-35)

Client sends `X-Idempotency-Key: <uuid-v4>`. `idempotency` preHandler checks `idem:{key}` in Redis (NX). On hit: return cached response. After success:
```typescript
await redis.setex(`idem:${key}`, 86_400, JSON.stringify(responseBody));
```

---

## §10 NIGERIAN SME WORKFLOW OPTIMIZATION

### Tax Filing Workflows — All ≤ 2 Taps from Dashboard

**VAT Monthly Filing**
- Auto-selects last unfiled period
- Output VAT from NRS-stamped invoices; input VAT from receipted expenses
- Prior credit from `VATCreditBalance` only — never recomputed (C-22)
- Net calculation: `net = outputVAT - inputVAT - creditBalance` (from `calculateVAT`)
- Net > 0 → remit `net`; set `creditBalance = 0`; trigger Flutterwave/Paystack/Remita + NRS → IRN → PDF to Document Vault
- Net ≤ 0 → no remittance; add `|net|` to `creditBalance`; persist updated balance to `VATCreditBalance`
- NIL auto-suggest when no invoices AND no expenses

**WHT Remittance**
- Rate badges: 10% amber | 5% blue | 4% green (non-resident only)
- Inline warning if professional service entered at 5%: "Professional services should be 10%"
- Exemption: C-23 — both TIN + ≤₦2M required simultaneously
- Deadline: 21st of following month

**PAYE Payroll**
- `calculatePIT({ grossIncome, rentPaid, pension })` per employee from contracts
- Batch total → NRS submission → Flutterwave/Paystack bulk payout
- PIT accuracy gate enforced: ₦5M + ₦600k + ₦200k → ₦632,400 ±₦1

**NIL Return**
- Reasons: `NO_REVENUE_THIS_PERIOD | BUSINESS_INACTIVE | EXEMPT_SUPPLY_ONLY | BELOW_REGISTRATION_THRESHOLD`
- Idempotent: 409 on same (orgId, taxType, period)
- Penalty warning shown if filing is late (same schedule as substantive filing)

### Payment Gateway Priority

| Gateway | Use Case |
|---|---|
| Flutterwave | Default; card + bank transfer; webhook `verif-hash` header |
| Paystack | Fallback; bank transfer; webhook `x-paystack-signature` header |
| Remita | Government-to-Government (G2G) payments; RRR-based verification |

All payment webhooks: HMAC-SHA256 + Redis NX idempotency (48h TTL). Never process the same `txRef`/RRR twice.

### Compliance Calendar

```typescript
const COMPLIANCE_EVENTS = [
  { type: 'VAT',  deadline: '21st of each month' },
  { type: 'WHT',  deadline: '21st of each month' },
  { type: 'PAYE', deadline: '10 working days after month-end (excl. public holidays; typically 10th–15th)' },
  { type: 'CIT',  deadline: '6 months after financial year-end' },
  { type: 'PIT',  deadline: '90 days after calendar year-end' },
];
// 0–3 days = RED | 4–7 days = AMBER | 8–14 days = YELLOW | 15+ = GREEN
// Overdue: show formatNGN(calculatePenalty(...).netPenalty) estimate inline
```

### Offline Resilience

| Data | Strategy |
|---|---|
| Tax rates (constants.ts) | Bundled — always available |
| ExplainMyTax (7 concepts) | Bundled — offline-safe; EN + Pidgin |
| Draft filings | AsyncStorage queue — same idempotency key on reconnect |
| Dashboard data | React Query gcTime 5min — stale-while-revalidate with offline banner |
| NRS stamp | BullMQ retry queue — mobile shows "pending NRS stamp" |

```
OfflineSyncStatus (AMBIENT zone):
  EN:     "You're offline — showing cached data"
  Pidgin: "Network no dey — we dey show you wetin we save"
```

---

## §11 AI INTELLIGENCE PIPELINE

### IntelligenceInput Contract

```typescript
// packages/contracts/src/types.ts — consumed by anomalyEngine + riskScoring + admin analytics
interface IntelligenceInput {
  orgId:         string;
  filingHistory: { taxType: string; period: string; daysLate: number; isNil: boolean }[];
  invoiceStats:  { unstampedCount: number; totalValue: number; oldestUnstampedDays: number };
  vatPosition:   { outputVAT: number; inputVAT: number; creditBalance: number };
  authEvents:    { failedAttempts: number; uniqueIPs: number; windowHours: number };
  payrollGrowth: { headcount: number; priorMonthHeadcount: number; payrollChange: number };
}

interface ComplianceEvent {
  taxType:       string;
  period:        string;
  dueDate:       string;    // ISO 8601 date
  daysRemaining: number;    // negative = overdue; required by computeGaugeMode + ComplianceCalendar
  penaltyEstimate?: number; // formatNGN(calculatePenalty(...).netPenalty) if overdue
}

// Built by buildIntelligenceInput(orgId, prisma) in dashboardService.ts
// Cache invalidation: eventBus listeners call redis.del(`dashboard:composite:v1:${orgId}:*`)
//   on 'invoice.created', 'filing.submitted', 'nrs.circuitOpened', 'anomaly.detected'
// If buildIntelligenceInput is missing, admin analytics page is blank — see C-12
```

### Anomaly Engine — 7 Signals, Hard Cap 5

| Signal | Condition | Severity | CTA |
|---|---|---|---|
| `vat_gap` | outputVAT > 0 AND no VAT filing this period | high | `/filings/vat` |
| `nrs_stamp_delay` | unstampedCount > 0 AND oldestUnstampedDays > 7 | medium | `/invoices` |
| `auth_failure_flood` | failedAttempts > 10/1h per IP | critical | `/team` |
| `nil_overuse` | isNil ≥3 consecutive periods | medium | `/filings/vat` |
| `payroll_spike` | payrollChange > 50% MoM | medium | `/filings/paye` |
| `unfiled_period` | any taxType gap > 30 days | high | filing wizard |
| `vat_credit_aging` | creditBalance > 0 AND unused > 90 days | low | `/compliance/vat-credit` |

```typescript
// Return: signals.sort(bySeverityDesc).slice(0, 5)     ← engine hard cap: 5
// Dashboard composite (§13): further slices to top 3 with severity ≥ medium
// MUST be wrapped in try/catch → return [] + Sentry.captureException + logger.error
// Every AnomalySignal.description is an i18n key (EN + Pidgin) citing the specific data point
// AnomalySignal.score guard: Math.max(0, Math.min(100, score ?? 0)) before any comparison
```

### Risk Scoring — 5 Components

```typescript
// backend/src/services/riskScoring.ts
// Each component produces points (0–max); total is summed and clamped 0–100.
// filingScore  = onTimeFilingRatio × 30        // max 30 pts — % obligations filed on time
// anomalyScore = (1 - anomalyRatio) × 25       // max 25 pts — lower anomaly density = better
// nrsScore     = nrsStampSuccessRate × 20       // max 20 pts — NRS stamp pass rate last 30 days
// vatScore     = vatPositionHealth × 10         // max 10 pts — healthy VAT credit position
// dataScore    = accountCompleteness × 10       // max 10 pts — profile completeness + account age
// Total potential: 95 pts → normalise: score = computedTotal / 0.95 to reach 100
// Bands: ≥80=healthy | 60–79=low | 40–59=medium | 20–39=high | <20=critical
// ALWAYS: score = Math.max(0, Math.min(100, Math.round(computedTotal / 0.95))) before any DB write
```

### computeGaugeMode — Single Source

```typescript
// Export from TaxHealthGauge.tsx — import in DashboardScreen; no inline useMemo replication
export function computeGaugeMode(data?: DashboardComposite | null): GaugeMode {
  const deadlines = data?.upcomingDeadlines ?? [];
  const overdue   = deadlines.filter(d => d.daysRemaining < 0).length;
  const urgent    = deadlines.filter(d => d.daysRemaining >= 0 && d.daysRemaining <= 7).length;
  if (overdue > 0) return 'critical';
  if (urgent > 0)  return 'warning';
  return 'healthy';
}
// Mode → gauge size: critical/warning = compact (120px, right-aligned) | healthy = expanded (200px, centered)
```

---

## §12 MOBILE UX SPECIFICATIONS

### Dashboard Structure — DO NOT DEVIATE

```typescript
// DashboardScreen.tsx — C-17, C-18, C-19, C-20 enforced
const { data, isLoading, isRefetching, error, refetch } = useDashboard();
const gaugeMode      = useMemo(() => computeGaugeMode(data), [data]);
const hasHighAnomaly = useMemo(
  () => data?.topAnomalies?.some(a => ['high','critical'].includes(a.severity)) ?? false, [data]);

if (isLoading && !data) return <DashboardSkeleton />;

return (
  <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}>
    <DashboardZone zone="apex" visible={!isLoading}>
      <Greeting userName={data?.stats.userName} />
      <TaxHealthGauge score={data?.stats.taxHealthScore ?? 0} mode={gaugeMode} />
      {gaugeMode !== 'healthy' && <UrgentDeadlineCard deadline={data?.upcomingDeadlines?.[0]} />}
    </DashboardZone>

    <DashboardZone zone="signal" visible={!isLoading}>
      {/* computeMetricCards(data): [{ label, value, trend, icon }] — 3 cards: revenue, tax due, compliance */}
      <MetricsRow cards={computeMetricCards(data)} />
    </DashboardZone>

    <DashboardZone zone="action" visible={!isLoading}>
      {/* computeQuickActions(data): [{label, route, icon, badge?}] — 6 actions from compliance calendar */}
      <QuickActionsGrid actions={computeQuickActions(data)} />
    </DashboardZone>

    <DashboardZone zone="context" visible={!isLoading} urgent={hasHighAnomaly}>
      {/* C-19: anomaly empty={null} — never "No anomalies" text */}
      <SectionState data={data?.topAnomalies} isLoading={isLoading} error={error}
        isEmpty={d => d.length === 0} empty={null}
        errorView={<InlineError icon="🔍" message={t('dashboard.anomaliesLoadError')} onAction={() => refetch()} />}
      >{a => <TopAnomaliesSection anomalies={a} />}</SectionState>
      <SectionState data={data?.upcomingDeadlines} isLoading={isLoading} error={error}
        isEmpty={d => d.length === 0} empty={null}
        errorView={<InlineError icon="📅" message={t('dashboard.calendarLoadError')} onAction={() => refetch()} />}
      >{d => <ComplianceCalendar deadlines={d} />}</SectionState>
    </DashboardZone>

    <DashboardZone zone="ambient" visible={!isLoading}>
      <SectionState data={data?.stats.trend} isLoading={isLoading} error={error}
        isEmpty={d => !d?.length} empty={null}
        errorView={<InlineError icon="📈" message={t('dashboard.chartsLoadError')} onAction={() => refetch()} />}
      >{trend => <TrendCharts data={trend} />}</SectionState>
      <OfflineSyncStatus />
    </DashboardZone>
  </ScrollView>
);
```

### TaxHealthGauge SVG Arc

```typescript
function buildArcPath(score: number, size: number): string {
  'worklet'; // ← MUST be first line — runs on Reanimated UI thread
  const safeScore = Math.max(0, Math.min(100, score ?? 0)); // guard: undefined/null/out-of-range
  const r = size * 0.4, cx = size / 2, cy = size / 2;
  const deg = -205 + 230 * (safeScore / 100);
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(-205)), y1 = cy + r * Math.sin(toRad(-205));
  const x2 = cx + r * Math.cos(toRad(deg)),  y2 = cy + r * Math.sin(toRad(deg));
  return `M ${x1} ${y1} A ${r} ${r} 0 ${230 * (safeScore / 100) > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}
function scoreToStroke(score: number): string {
  'worklet'; // ← MUST be first line
  return score >= 75 ? '#1DB954' : score >= 50 ? '#F59E0B' : '#DC2626';
}
// Animated score usage (Reanimated SharedValue):
//   const animScore = useSharedValue(0);
//   useEffect(() => { animScore.value = withTiming(score, { duration: DURATION.slow, easing: EASE.gauge }); }, [score]);
//   const path = useDerivedValue(() => buildArcPath(animScore.value, 200)); // .value unwrap in worklet
// accessibilityRole="progressbar" + accessibilityLabel={`Tax health: ${score} out of 100`}
```

### Animation Tokens — All Animations Must Use These

```typescript
// mobile/src/design-system/animation.ts
export const DURATION = {
  instant: 100, fast: 200, standard: 400, deliberate: 600, slow: 800, skeleton: 1200,
} as const;
export const EASE = {
  enter:     Easing.out(Easing.cubic),
  exit:      Easing.in(Easing.cubic),
  gauge:     Easing.bezier(0.25, 0.46, 0.45, 0.94),
  celebrate: Easing.bezier(0.34, 1.56, 0.64, 1),
  shimmer:   Easing.linear,
} as const;
export const ZONE_DELAY = { apex: 0, signal: 80, action: 160, context: 240, ambient: 320 } as const;
// C-16: withTiming(1, { duration: DURATION.standard, easing: EASE.enter }) — never literal ms
```

### DashboardSkeleton — 0px CLS Contract

| Zone | Block geometry |
|---|---|
| `apex` | 200×110px semicircle + 60%×24px greeting strip |
| `signal` | 3× (31%×72px) row, 8px gap |
| `action` | 6× (30%×64px) flex-wrap 3-col, 6px gap |
| `context` | 40%×14px header + 2× (100%×52px), 8px gap |
| `ambient` | 2× (48%×80px) row, 8px gap |

### Micro-UX Rules

- **Loading hierarchy:** `DashboardSkeleton` (initial) → `SectionSkeletonRows` (partial reload) → inline CTA spinner (submit). Never `<ActivityIndicator />` replacing content.
- **Empty states:** icon + heading + body + CTA always. Exception: anomaly section → `empty={null}` (C-19).
- **Error states:** icon + message + retry. Single tap → clear error → refetch → optimistic loading.
- **Pressable feedback:** `transform: [{ scale: 0.97 }], opacity: 0.85` on press. Required on all interactive elements.
- **Toast:** Success = 3s green auto-dismiss. Error = 6s red dismissible. Never `Alert.alert()` for business logic.
- **Keyboard:** All filing wizards: `KeyboardAvoidingView` + `ScrollView keyboardShouldPersistTaps="handled"`.
- **WCAG 2.2 AA:** Minimum 44×44px touch targets. 4.5:1 contrast. `accessibilityLabel + accessibilityRole + accessibilityHint` on all interactive elements.
- **Haptics:** `Haptics.impactAsync(Light)` on tap; `notificationAsync(Success)` on filing confirm. Fire **before** any `await`.

### Filing Wizard Requirements

1. `runPreFlight()` completes **before** Submit CTA renders — never after
2. Preflight failures block Submit CTA; warnings render inline
3. `X-Idempotency-Key: uuid-v4` generated client-side before first attempt
4. Network error → queue to AsyncStorage with same key → retry on reconnect
5. Success → `ConfettiAnimation` with `onError` fallback (C-42) → PDF receipt download
6. `AccessibilityInfo.announceForAccessibility` on every wizard step change (WCAG 2.2 AA)

### Onboarding Wizard — 5 Steps

1. **Business setup** — name; TIN inline validation (800ms debounce, Youverify + NRS); CAC/RC number
2. **Obligations** — VAT | PAYE | CIT | WHT with threshold tooltips
3. **TOTP 2FA** — QR → scan → verify → backup codes → "I've saved these" gate
4. **API key** — copy button + SDK quickstart snippet
5. **Celebration** — `ConfettiAnimation` + "Tax Compliant Business" badge

> `router.replace('/dashboard')` on completion — **never** `router.push`. If `OnboardingProgress.completed === false AND step > 1` → show resume prompt on app launch.

### Performance Budget

| Metric | Target |
|---|---|
| Dashboard 2G first meaningful paint | < 2,000 ms |
| Composite API P95 (cache hit) | < 50 ms |
| Composite API P95 (cache miss) | < 800 ms |
| Gesture response | ≤ 100 ms |
| TaxHealthGauge frame rate | 60 fps |
| Skeleton → content CLS | 0 px |
| Mobile crash rate | < 0.1% |
| Lottie JSON files | < 50 KB each |
| Icon PNGs | < 50 KB each |

---

## §13 COMPOSITE DASHBOARD API

```typescript
// GET /api/v1/dashboard
// Cache key: `dashboard:composite:v1:${orgId}:${userId}` TTL 120s
// Invalidated on: new invoice | new expense | NRS status change | anomaly.detected event

interface DashboardComposite {  // packages/contracts/src/types.ts
  stats:             DashboardStats;
  topAnomalies:      AnomalySignal[];        // engine returns ≤5; composite filters to ≤3 severity ≥ medium
  upcomingDeadlines: ComplianceEvent[];      // sorted daysRemaining ASC
  nrsHealth:         NrsHealth;             // circuitState | lastSuccessAt | pendingJobs
  meta:              { cached: boolean; cacheAge?: number };
}

// Route implementation (dashboard.ts):
const [stats, allAnomalies, deadlines, nrs] = await Promise.all([
  getStats(orgId, userId).catch(e => { Sentry.captureException(e); return FALLBACK_STATS; }),
  getAnomalies(orgId).catch(e => { Sentry.captureException(e); return FALLBACK_ANOMALIES; }),
  getDeadlines(orgId).catch(e => { Sentry.captureException(e); return FALLBACK_DEADLINES; }),
  getNrsHealth().catch(e => { Sentry.captureException(e); return FALLBACK_NRS_HEALTH; }),
]);
// Filter anomalies for dashboard: top 3, severity ≥ medium only
const topAnomalies = allAnomalies
  .filter(a => ['medium','high','critical'].includes(a.severity))
  .slice(0, 3);
const response = { stats, topAnomalies, upcomingDeadlines: deadlines, nrsHealth: nrs,
  meta: { cached: false } };
redis.setex(cacheKey, 120, JSON.stringify(response)).catch(() => {}); // non-blocking
```

---

## §14 PRISMA SCHEMA — CANONICAL

```prisma
// Prisma 5.22 — provider: postgresql
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole     { SUPER_ADMIN ADMIN OWNER ACCOUNTANT EMPLOYEE VIEWER }
enum NilReason    { NO_REVENUE_THIS_PERIOD BUSINESS_INACTIVE EXEMPT_SUPPLY_ONLY BELOW_REGISTRATION_THRESHOLD }
enum AuditAction  { CREATE UPDATE DELETE FILE AMEND APPROVE OVERRIDE REVOKE INVITE EXPORT
                    ACCESS_DENIED ROLE_CHANGE LOGIN LOGOUT NRS_STAMP PAYMENT_RECEIVED SECURITY_ALERT AUDIT_EXPORT }
enum RiskBand     { critical high medium low healthy }
enum OrgStatus    { active suspended pending_verification }
enum FilingStatus { DRAFT SUBMITTED ACCEPTED REJECTED }

model Organisation {
  id               String             @id @default(cuid())
  name             String
  tinNumber        String             @unique
  cacRcNumber      String?
  status           OrgStatus          @default(pending_verification)
  plan             String             @default("free")  // 'free' | 'starter' | 'growth' | 'enterprise'
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  members          OrgMember[]
  accountantClients AccountantClient[] @relation("ClientOrg")
  @@index([tinNumber])
}

model OrgMember {
  id        String    @id @default(cuid())
  orgId     String
  userId    String
  role      UserRole
  status    String    @default("active")
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  org       Organisation @relation(fields: [orgId], references: [id])
  @@unique([orgId, userId])
  @@index([userId, status])
}

model TaxReturn {
  id              String        @id @default(cuid())
  orgId           String
  taxType         String
  period          String
  status          FilingStatus
  filingReference String        @unique
  isNil           Boolean       @default(false)
  nilReason       NilReason?
  taxAmountDue    Decimal       @default(0) @db.Decimal(15, 2)  // Decimal — never Float for money
  receiptUrl      String?
  amendedReturnId String?
  submittedAt     DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  @@unique([orgId, taxType, period])
  @@index([orgId, taxType, period])
}

model AuditEvent {
  id         String      @id @default(cuid())
  orgId      String
  actorId    String
  actorRole  String
  targetType String
  targetId   String
  action     AuditAction
  before     Json?
  after      Json?
  ip         String
  userAgent  String?
  metadata   Json?
  createdAt  DateTime    @default(now())
  // NO updatedAt — immutability contract (NDPC §30)
  @@index([orgId, createdAt])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
}

model TaxHealthSnapshot {
  id             String   @id @default(cuid())
  orgId          String
  taxHealthScore Int
  riskBand       RiskBand
  anomalyCount   Int
  snapshotDate   DateTime @default(now())
  // NO updatedAt — insert-only; prune >24 months in snapshotPruneCron
  @@index([orgId, snapshotDate])
}

model UserDevice {
  id        String   @id @default(cuid())
  userId    String
  orgId     String
  token     String   @unique
  platform  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId])
}

model VATCreditBalance {
  id            String   @id @default(cuid())
  orgId         String   @unique           // one record per org; upsert on each VAT period
  creditBalance Decimal  @default(0) @db.Decimal(15, 2)  // Decimal — never Float for money
  lastUpdatedAt DateTime @default(now())
  // C-22: ONLY source of truth for VAT credit — never recompute from transactions
  @@index([orgId])
}

model SMERiskRecord {
  id             String   @id @default(cuid())
  orgId          String   @unique
  taxHealthScore Int
  riskBand       RiskBand
  anomalyCount   Int
  computedAt     DateTime @default(now())
  // Upserted by riskScoringCron (Job 1, 04:00 WAT daily)
  // Math.max(0, Math.min(100, total)) enforced before upsert
  @@index([orgId])
}

model OnboardingProgress {
  id        String   @id @default(cuid())
  orgId     String   @unique
  userId    String
  step      Int      @default(1)           // 1–5
  completed Boolean  @default(false)
  updatedAt DateTime @updatedAt
  // router.replace('/dashboard') fires ONLY when completed = true
  @@index([userId])
}

model DLQJob {
  id          String   @id @default(cuid())
  queue       String                        // bullmq queue name
  jobId       String
  payload     Json
  failReason  String
  retryCount  Int      @default(0)
  resolved    Boolean  @default(false)
  resolvedAt  DateTime?
  resolvedBy  String?                       // actorId who resolved
  createdAt   DateTime @default(now())
  @@index([queue, resolved])
  @@index([createdAt])
}

model AccountantClient {
  id            String       @id @default(cuid())
  accountantId  String                        // userId of the accountant (ACCOUNTANT role)
  clientOrgId   String                        // orgId of the client organisation
  grantedBy     String                        // OWNER userId who created delegation
  revokedAt     DateTime?                     // C-28: all queries must include revokedAt: null
  revokedBy     String?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  organisation  Organisation @relation("ClientOrg", fields: [clientOrgId], references: [id])
  @@unique([accountantId, clientOrgId])
  @@index([accountantId, revokedAt])
  @@index([clientOrgId])
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique               // bcrypt hash — never store raw token
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())
  // sessionCleanupCron (Job 7) deletes where expiresAt < now() AND revokedAt IS NOT NULL
  @@index([userId, expiresAt])
}
```

---

## §15 EVENT BUS & QUEUE ARCHITECTURE

```typescript
// backend/src/services/eventBus.ts
import { EventEmitter } from 'events';
import { Queue, Worker } from 'bullmq';
import { redis }         from '../lib/redis';
import IORedis           from 'ioredis';

const bus = new EventEmitter();
bus.setMaxListeners(30);
export const eventBus = bus;

// BullMQ Queue connections — can reuse the shared IORedis instance (read/write ops)
export const nrsStampQueue  = new Queue('nrs-stamp',     { connection: redis });
export const notifQueue     = new Queue('notifications',  { connection: redis });
export const pdfQueue       = new Queue('pdf-generation', { connection: redis });
export const analyticsQueue = new Queue('analytics',      { connection: redis });

// BullMQ Worker connections — MUST use a DEDICATED IORedis instance per worker
// Workers use BLPOP (blocking) which is incompatible with shared pub/sub connections
// maxRetriesPerRequest: null is REQUIRED for BullMQ 5 workers
// IMPORTANT: Call createWorkerConnection() ONCE per Worker instantiation — each call opens a new TCP connection
export function createWorkerConnection() {
  return new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,    // Required for BullMQ 5 Workers
    enableReadyCheck:     false,
  });
}

// Event contracts:
// 'filing.submitted'   → writeAuditEvent + enqueue pdf-generation + sendFilingConfirmation
// 'invoice.created'    → if amount >= NRS_STAMP_THRESHOLD: enqueue nrs-stamp + bust dashboard cache
// 'anomaly.detected'   → bust dashboard cache + if HIGH|CRITICAL: runSnapshot + sendPushNotification
// 'nrs.circuitOpened'  → logger.warn + Sentry + notify ADMIN
// 'payment.completed'  → verifyHMAC + updateSubscription + writeAuditEvent
```

### BullMQ Queue Configuration (BullMQ 5)

| Queue | Priority | Max Retry | Backoff |
|---|---|---|---|
| `nrs-stamp` | High | 3 | 1s → 10s → 60s exponential |
| `notifications` | Normal | 3 | exponential |
| `pdf-generation` | Low | 3 | exponential |
| `analytics` | Low | 1 | fixed 5s |

---

## §16 DEPLOYMENT ARCHITECTURE

### Dockerfile — Multi-Stage

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
# Copy root manifests + all workspace manifests needed for npm workspaces install
COPY package*.json yarn.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
RUN npm ci
RUN npx prisma generate        # First generate — before TypeScript build (Prisma 5.22)
COPY . .
RUN npm run build

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S taxbridge && adduser -u 1001 -S -G taxbridge taxbridge
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Copy manifests then install production dependencies only (no devDeps)
COPY package*.json yarn.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
RUN npm ci --omit=dev && npx prisma generate   # Second generate — production image (Prisma 5.22)
USER taxbridge
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/v2/monitoring/health || exit 1
CMD ["node", "dist/server.js"]
```

### render.yaml

```yaml
services:
  - type: web
    name: taxbridge-api
    region: fra                                 # MUST be 'fra' — NOT 'frankfurt'
    healthCheckPath: /api/v2/monitoring/health
    envVars:
      - key: CORS_ORIGIN
        sync: false
      - key: CBN_MPR
        sync: false
      - key: DOCUMENT_VAULT_KMS_PROVIDER
        sync: false
      - key: NRS_API_KEY
        sync: false
      - key: JWT_PUBLIC_KEY                     # Base64-encoded RS256 PEM (production)
        sync: false
      - key: FLUTTERWAVE_SECRET
        sync: false
      - key: PAYSTACK_SECRET
        sync: false
      - key: REMITA_MERCHANT_ID
        sync: false
      - key: YOUVERIFY_API_KEY
        sync: false
      - key: AFRICA_TALKING_API_KEY
        sync: false
      - key: SENTRY_DSN
        sync: false
      - key: DIGITAX_MOCK_MODE
        value: "false"                          # Optional; explicitly set false in production
    logDrain:
      destination: grafana-loki
```

### EAS Configuration

```json
// mobile/eas.json  (at the mobile workspace root — Expo EAS reads this from package root)
{
  "cli": { "version": ">= 14.0.0" },
  "build": {
    "development": {
      "android": { "compileSdkVersion": 36, "targetSdkVersion": 35, "buildType": "apk" }
    },
    "preview": {
      "android": { "compileSdkVersion": 36, "targetSdkVersion": 35 }
    },
    "production": {
      "android": { "compileSdkVersion": 36, "targetSdkVersion": 35 },
      "ios":     { "buildConfiguration": "Release" }
    }
  }
}
// SENTRY_DSN: injected via EAS secret — `eas secret:create --scope project --name SENTRY_DSN --value <dsn>`
// NEVER hardcode SENTRY_DSN here or in source code (C-33)
```

### Deployment Protocol

1. Create rollback tag: `git tag v12-stable-$(date +%Y%m%d)` before deploying V13
2. Execute `scripts/create-emergency-rollback-proc.sql` in target DB
3. Deploy green slot; wait for health check → `{ status: 'healthy' }`
4. Canary: route 5% traffic; observe ≥2min; error rate < 0.5%; then full cut-over
5. Rollback trigger: `nrs_circuit_state == 2` + `http_errors_total > 1%` for 5min simultaneously

---

## §17 CI/CD PIPELINE — 5 STAGES

| Stage | Name | Gates | Block |
|---|---|---|---|
| 1 | Contamination | FIRS=0; NRSt=0; CRA=0; ProgressBar in DashboardScreen=0; WHT 0.04 as default=0; SENTRY_DSN placeholder=0; CBN_MPR literal=0; `console.log` in backend=0; `new IORedis` outside lib/redis=0; `from 'express'` in backend/src=0 | Merge |
| 2 | TypeScript | `npx tsc --noEmit` → 0 errors across all workspaces | Merge |
| 3 | Immutability | `awk` confirms `AuditEvent` has no `updatedAt`; `TaxHealthSnapshot` has no `updatedAt` | Merge |
| 4 | Tests | `npm test --workspaces` → ≥550 passing, 0 failing; `contracts/` coverage ≥95% lines/functions | Merge |
| 5 | Build + Deploy | Docker multi-stage builds; staging deploy; all 7 smoke tests pass | Deploy |

### Smoke Tests — 7 Required

```bash
# All must return expected status — never 500 for tests 3–7
# Prerequisites: smokeTestUser seed must create: User + Organisation + OrgMember (status:'active', role:'OWNER')
#   Smoke test #3 fails with 403 if OrgMember.status !== 'active' (resolveOrgContext check)
#   Smoke test #5 needs ADMIN role — seed must also create smokeTestAdminUser or grant OWNER role ADMIN access
1. GET  /api/v2/monitoring/health              → 200 { status: 'healthy'|'degraded' } within 500ms
2. POST /api/v1/auth/login                     → 200 { accessToken }       (smokeTestUser creds)
3. GET  /api/v1/dashboard                      → 200 composite data        (with token from #2)
4. POST /api/v1/filings/nil                    → 200 or 409                (never 500; 409 is valid on repeat)
5. GET  /api/v2/monitoring/metrics             → 200 prom-client text       (ADMIN token required)
6. POST /api/v1/onboarding/tin                 → 200 or 404                (never 500)
7. GET  /api/v1/filings/preflight?taxType=VAT  → 200 { pass, checks[] }
```

---

## §18 OBSERVABILITY

### Prometheus Metrics — 7 Required

| Metric | Type | Labels |
|---|---|---|
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` |
| `http_errors_total` | Counter | `route` |
| `nrs_circuit_state` | Gauge | — (0=closed, 1=half-open, 2=open) |
| `dlq_depth` | Gauge | — |
| `filing_submissions_total` | Counter | `tax_type` |
| `active_users_total` | Gauge | — |
| `penalty_estimate_ngn_total` | Counter | `tax_type` — incremented in `penaltyService.ts` after each estimate; tracks aggregate penalty exposure |

> `global.__taxbridge_prom_registry` guard is required — prevents double-registration crash on hot reload.
> Instrumentation points: `filing_submissions_total` incremented in `writeAuditEvent` on `action:'FILE'`; `penalty_estimate_ngn_total` incremented in `penaltyService.calculatePenalty` after each call.

### Grafana Alerts — 5 Rules

| Alert | Condition | Channel |
|---|---|---|
| `API_Error_Rate` | `http_errors_total` rate > 1% over 5min | Slack + email |
| `Dashboard_P99` | duration P99 > 800ms over 5min | Slack |
| `DLQ_Depth_High` | `dlq_depth` > 10 for 15min | Slack + email |
| `Auth_Flood` | auth failures > 10/min AND > 10/1h | Slack + email |
| `NRS_Circuit_Open` | `nrs_circuit_state == 2` for 5min | Slack + PagerDuty |

---

## §19 PRODUCTION VALIDATION GATES

### Pre-Deploy Checklist — All Items Binary ✓ / ✗

**Foundation**
- [ ] `validateEnv.ts` is first import in `backend/src/app.ts` (before `Fastify()` constructor)
- [ ] Fastify bound to `0.0.0.0` with `trustProxy: true` in constructor options
- [ ] `@fastify/compress` registered before routes
- [ ] Raw body preserved via content-type parser for webhook HMAC verification
- [ ] Flutterwave HMAC: `(request as any).rawBody.toString('utf8')` + `timingSafeEqual`
- [ ] Paystack HMAC: `x-paystack-signature` header + `timingSafeEqual`
- [ ] Sentry PII regex order: BVN(11d) → ACCT(10d) → TIN(8d)
- [ ] `global.__taxbridge_prom_registry` guard present
- [ ] Redis cache write fire-and-forget (`.catch(() => {})`)
- [ ] `AuditEvent` model has **no** `updatedAt`
- [ ] `TaxHealthSnapshot` model has **no** `updatedAt`

**Architecture**
- [ ] Exactly 7 cron jobs in `orchestrator.ts` (node-cron); `setInterval` elsewhere → 0
- [ ] `validate()` preHandler on all POST/PATCH routes
- [ ] `idempotency` preHandler on all exactly-once routes
- [ ] `opossum` circuit breaker wired; `nrsCircuitState` gauge updates on state change
- [ ] `anomalyEngine.ts` wrapped in `try/catch` → `return []`
- [ ] `riskScoring.ts` clamps 0–100 before DB write
- [ ] `buildIntelligenceInput(orgId, prisma)` implemented in `dashboardService.ts`
- [ ] No Express imports anywhere in `backend/src` (`from 'express'` → 0)

**Admin (Next.js 15 App Router)**
- [ ] Admin pages at `admin/src/app/admin/*/page.tsx` — NOT `pages/` directory
- [ ] `/admin/analytics/page.tsx` renders all 5 panels with FALLBACK_* on errors
- [ ] `/admin/dlq/page.tsx` has retry + resolve; 2FA gate for bulk >10
- [ ] `jose` installed (Edge Runtime JWT)
- [ ] `admin/src/middleware.ts`: CSRF check on mutations

**Mobile (Expo SDK 54)**
- [ ] EAS all 3 profiles: `compileSdkVersion:36`, `targetSdkVersion:35`
- [ ] `SENTRY_DSN` via EAS secret — no placeholder in eas.json
- [ ] All `FlatList` → `@shopify/flash-list` (`grep -rn 'FlatList' mobile/src` → 0)
- [ ] `OnboardingWizard`: `router.replace` on completion; resume path via AsyncStorage
- [ ] Pre-flight before Submit CTA in **all** 5 filing wizards
- [ ] `BiometricAuth` always falls through to PIN
- [ ] iOS production: `buildConfiguration: "Release"`
- [ ] `i18n.config.ts`: `initImmediate: false`

**Deployment**
- [ ] GitHub Secrets set: `SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD` (smokeTestUser creds for CI), `RENDER_DEPLOY_HOOK_URL` (Render deploy webhook — not the Render API key), `CBN_MPR` (used by accuracy gates in CI — also set as Render env var)
- [ ] `prisma/seeds/smokeTestUser.ts` exists with deterministic credentials
- [ ] `render.yaml` `logDrain` → Grafana Loki; `region: fra`
- [ ] `CBN_MPR` in Render env (`sync: false`)
- [ ] `.env` files not committed (`git ls-files | grep '.env.' | grep -v example` → 0)
- [ ] Docker: multi-stage; non-root user; `HEALTHCHECK` on `/api/v2/monitoring/health`
- [ ] `CMD ["node", "dist/server.js"]` — NOT `dist/app.js`
- [ ] Rollback tag created; emergency proc SQL executed
- [ ] All 7 smoke tests pass

---

## §20 EMERGENCY PROTOCOLS

| Symptom | Root Cause | Fix |
|---|---|---|
| Dashboard P99 > 800ms | Redis TTL = 0 | Set TTL=120s for `dashboard:composite:v1:*` keys |
| WHT professional shown as 5% | Rate lookup defaulting to construction | `WHT_PROFESSIONAL_RATE = 0.10` — check mapping |
| EAS build fails (AAR incompatibility) | Wrong Android SDK | `compileSdkVersion:36`, `targetSdkVersion:35` |
| NRS circuit stuck open | NRS API down | `DIGITAX_MOCK_MODE=true` in Render env |
| Raw i18n keys on device | `initImmediate: true` | Set `initImmediate: false` → `eas update --branch production` |
| Admin 500 on cold start | Missing `FALLBACK_*` | All admin routes `.catch(() => FALLBACK_*)` |
| Gauge not rendering | `'worklet'` missing | First line of `buildArcPath` + `scoreToStroke` must be `'worklet'` |
| `prom-client` crash on hot reload | Double registration | `global.__taxbridge_prom_registry` singleton guard |
| Flutterwave HMAC always false | Wrong body stringification | `rawBody.toString('utf8')` — never `JSON.stringify(request.body)` |
| Paystack HMAC always false | Wrong header name | Header is `x-paystack-signature` not `verif-hash` |
| Penalty wrong | `CBN_MPR` hardcoded | `parseFloat(process.env.CBN_MPR ?? '0.2725')` always |
| Accountant sees wrong org | `revokedAt` unchecked | Add `revokedAt: null` to `AccountantClient` query |
| Fastify 500 on every request | Express middleware imported | Remove all `from 'express'` — use Fastify plugins |
| 15% ETR on individual PIT | Old code path exists | Delete path — NTA 2025 §47 is corporate MNE only |
| Duplicate filing on retry | Missing idempotency | Apply `idempotency` preHandler; client sends `X-Idempotency-Key` |
| Anomaly engine throws to dashboard | Unwrapped `computeAnomalies` | `try/catch → return []` + Sentry |
| Risk score outside 0–100 | Unclamped | `Math.max(0, Math.min(100, total))` before DB write |
| Onboarding resets to step 1 | No resume path | `PATCH /api/v1/onboarding/progress` + AsyncStorage |
| Health check returns 503 | Degraded state misconfigured | Always HTTP 200 — use `status: 'degraded'` string |
| `TaxHealthSnapshot` grows unbounded | No retention | Snapshot cron prunes entries > 24 months per org |
| Admin analytics blank | `buildIntelligenceInput` missing or wrong boundary | Implement in `dashboardService.ts`; admin fetches via `GET /api/v2/analytics` — never calls service directly |
| Youverify TIN fails silently | Missing error state | IDLE → VALIDATING → SUCCESS \| FAILED \| NETWORK_ERROR — surface all states |
| Prisma migration fails on deploy | Schema conflict / drift | (1) Check migration status: `prisma migrate status`; (2) If unresolvable: run `scripts/create-emergency-rollback-proc.sql`; (3) Roll back to `v12-stable` tag; (4) Apply compensating migration — NEVER rollback existing migrations; (5) Re-deploy with fixed migration |
| BullMQ Worker crashes on start | Shared Redis connection | Workers need dedicated connection: `createWorkerConnection()` from `eventBus.ts` — not the shared `redis` singleton |
| Cron jobs firing at wrong time | UTC cron expressions | With `timezone: 'Africa/Lagos'`, expressions are WAT local time — `'0 4 * * *'` = 04:00 WAT, not 05:00 WAT |
| Role version 0 treated as invalid | Falsy `storedVersion` check | Use `storedVersion !== null &&` not `storedVersion &&` — version 0 is valid |

---

## §21 CODEBASE CLEANUP — ORPHANED FILES & DEAD DOCS

### Step 1: Verification Before Deletion

```bash
grep -rn "v12_master_prompt\|v12_production_architecture\|v12_complementary" \
  backend/src mobile/src admin/src scripts --include="*.ts" --include="*.tsx"
# → 0 results required before proceeding

grep -rn "HomeScreen\|taxHelpers\|event-bus\.ts\|taxCalculator\|filings\.ts" \
  backend/src mobile/src --include="*.ts" --include="*.tsx" | grep -v node_modules
# → review each hit before deleting
```

### Step 2: Superseded Prompts

```bash
git rm -f prompts/v10_master_prompt.md
git rm -f prompts/v11_master_prompt.md
git rm -f prompts/v12_master_prompt.md
git rm -f prompts/TAXBRIDGE_V12_MASTER_PROMPT.md
git rm -f prompts/v12_production_architecture_module.md
git rm -f prompts/v12_complementary_architecture.md
git rm -f prompts/v13_master_prompt_draft.md
```

### Step 3: Legacy Deployment Markers

```bash
git rm -f DEPLOYMENT_v10.3_COMPLETE.md
git rm -f DEPLOYMENT_v11.0_COMPLETE.md
git rm -f DEPLOYMENT_v12_COMPLETE.md
# Keep: docs/CHANGELOG.md, docs/PRODUCTION_READY.md — referenced in §3
```

### Step 4: Superseded Source Files

```bash
git rm -f backend/src/services/event-bus.ts          # camelCase alias — use eventBus.ts only
git rm -f backend/src/services/taxCalculator.ts      # moved to @taxbridge/contracts
git rm -f mobile/src/utils/taxHelpers.ts             # moved to @taxbridge/contracts
git rm -f backend/src/routes/filings.ts              # replaced by filings/ directory
git rm -f mobile/src/screens/HomeScreen.tsx          # replaced by DashboardScreen.tsx
git rm -f scripts/backfill-v12.ts
git rm -f scripts/validate-production-readiness.ps1  # replaced by CI pipeline

# DO NOT delete:
# backend/src/app.ts      — exports buildApp(); server.ts depends on it; it is NOT the same as the old entry point
# backend/src/server.ts   — process entry point; calls buildApp() + fastify.listen()
```

### Step 5: Environment Variable Audit

```bash
# Remove from .env.example if unused:
# FIRS_API_KEY       → replaced by NRS_API_KEY (contamination if present)
# OLD_WEBHOOK_SECRET → rotate and remove

# Confirm .env.example has v13 required keys:
grep -E "NRS_API_KEY|CBN_MPR|CORS_ORIGIN|DOCUMENT_VAULT_KMS_PROVIDER|DIGITAX_MOCK_MODE|AFRICA_TALKING|YOUVERIFY_API_KEY|PAYSTACK_SECRET|REMITA_MERCHANT_ID" .env.example
```

### Step 6: Dependency Audit

```bash
npx depcheck --ignores="@types/*,eslint-*,prettier-*" 2>/dev/null
# Do NOT remove: opossum, pino, prom-client, bullmq, @aws-sdk/client-s3, jose, speakeasy, node-cron
# Remove: express, express-rate-limit, compression (express version), cors (express version)
# Verify Fastify equivalents present: @fastify/rate-limit, @fastify/compress, @fastify/cors, @fastify/helmet, @fastify/multipart
```

### Step 7: Post-Cleanup Verification

```bash
npx tsc --noEmit
npm test --workspaces
yarn prompts:verify
yarn i18n:check
grep -rn "FIRS\|from 'express'" backend/src mobile/src admin/src \
  --include="*.ts" --include="*.tsx" | grep -v node_modules
# → 0 results
```

---

## §22 DOCUMENTATION NORMALIZATION & CONSOLIDATION

> This section governs the canonical state of all documentation in the repository. Stale, duplicated, or conflicting docs create engineering risk equivalent to stale code. Apply the same rigor.

### 22.1 Canonical Document Registry

| File | Purpose | Owner | Update Trigger |
|---|---|---|---|
| `docs/CHANGELOG.md` | Chronological release history (Keep-a-Changelog format) | Engineering | Every merge to `main` |
| `docs/PRODUCTION_READY.md` | Boolean checklist mirroring §19 | Engineering | Every deploy |
| `docs/ARCHITECTURE.md` | Narrative system architecture (generated from §1 + §5) | Engineering | Major structural changes |
| `docs/INCIDENT_RESPONSE.md` | Runbook mirroring §20 | On-call lead | After every incident |
| `docs/api/` | OpenAPI 3.1 specs (auto-generated via `fastify-swagger`) | CI | Every route change |
| `docs/PRD.md` | Current product requirements | Product | Quarterly review |
| `prompts/v13_master_prompt.md` | THIS FILE — engineering source of truth | Senior engineer | Breaking changes only |
| `prompts/v13_implementation_prompt.md` | Cursor execution directive | Senior engineer | Phase completions |

### 22.2 CHANGELOG Format (Keep-a-Changelog)

```markdown
# Changelog

All notable changes to TaxBridge are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

## [13.0.0] — 2026-03-07
### Added
- Fastify 5 migration (replaces Express)
- Youverify integration for TIN/CAC identity verification
- Paystack and Remita webhook handlers
- §22 Documentation Normalization
- Expo SDK 54 upgrade
- Next.js 15 App Router migration for Admin

### Changed
- All middleware converted to Fastify preHandler / plugin patterns
- Admin pages moved from `pages/` to `app/` directory (App Router)
- `server.ts` entry point (was `app.ts` as listen target)

### Removed
- Express and all express-* packages
- pages/ directory in admin (App Router supersedes)
- All V10–V12 prompt files (archived in git history)

### Security
- TOTP backup codes: bcrypt cost 12
- Webhook HMAC: timingSafeEqual on all gateways (FLW, Paystack, Remita)
- role_version check on every authenticated Fastify request
```

### 22.3 OpenAPI Auto-Generation

```typescript
// backend/src/app.ts — add after plugin registrations (already shown in §5.1)
// @fastify/swagger is registered in buildApp(); @fastify/swagger-ui exposed at /docs (non-production only)

// CI: dump spec to docs/api/ — add this script to package.json
// "scripts": {
//   "docs:api": "tsx scripts/dump-swagger.ts"
// }

// scripts/dump-swagger.ts:
// import { buildApp } from '../backend/src/app';
// import { writeFileSync, mkdirSync } from 'fs';
// const app = await buildApp();
// await app.ready();
// mkdirSync('docs/api', { recursive: true });
// writeFileSync('docs/api/openapi.json', JSON.stringify(app.swagger(), null, 2));
// await app.close();
// console.log('✅ OpenAPI spec written to docs/api/openapi.json');
```

### 22.4 README Structure (Root)

```markdown
# TaxBridge — Nigerian SME Tax Compliance Platform

## Quick Start
\`\`\`bash
cp .env.example .env
docker-compose up
\`\`\`

## Architecture
→ See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## API Reference
→ See [docs/api/openapi.json](docs/api/openapi.json) or run dev server and visit /docs

## Development
→ [Contributing Guide](docs/CONTRIBUTING.md)

## Deployment
→ [Production Deployment](docs/PRODUCTION_READY.md)

## Incident Response
→ [Runbook](docs/INCIDENT_RESPONSE.md)
```

### 22.5 Documentation CI Gate

```yaml
# .github/workflows/pipeline.yml — add to Stage 1 (Contamination)
- name: Documentation integrity
  run: |
    set -euo pipefail

    # CHANGELOG must have an entry for current version
    grep -q "## \[13\." docs/CHANGELOG.md \
      || { echo "❌ CHANGELOG missing v13 entry"; exit 1; }

    # No TODO/FIXME in docs/ (documentation debt not allowed)
    if grep -rn "TODO\|FIXME" docs/ --include="*.md" | grep -qv node_modules; then
      echo "❌ TODO/FIXME found in docs/"; exit 1
    fi

    # Prompt files must not reference abolished APIs
    if grep -nE "express|SDK 51|Express 5|Next\.js 14|pages/admin" prompts/v13_master_prompt.md; then
      echo "❌ Abolished API reference in master prompt"; exit 1
    fi

    # OpenAPI spec must be present and non-empty
    [ -s docs/api/openapi.json ] \
      || { echo "❌ docs/api/openapi.json missing or empty — run npm run docs:api"; exit 1; }

    echo "✅ Documentation integrity checks passed"
```

### 22.6 Stale Documentation Deletion Protocol

```bash
# Files confirmed obsolete — delete after verifying no active references
git rm -f docs/PRD_v1.md docs/PRD_v2.md docs/PRD_v3.md 2>/dev/null || true
git rm -f docs/ARCHITECTURE_v1.md docs/ARCHITECTURE_v2.md 2>/dev/null || true

# Normalize: all docs must be in docs/ — not root (except README.md and standard files)
# Root-level .md files allowed: README.md, LICENSE.md, SECURITY.md, CONTRIBUTING.md
# Move anything else: git mv *.md docs/ (then update internal links)
```

### 22.7 Post-Normalization Checklist

- [ ] `docs/CHANGELOG.md` has v13.0.0 entry with Added / Changed / Removed / Security sections
- [ ] `docs/PRODUCTION_READY.md` mirrors §19 checklist exactly — all items binary
- [ ] `docs/ARCHITECTURE.md` reflects Fastify 5 + Expo SDK 54 + Next.js 15 stack
- [ ] `docs/api/openapi.json` generated from Fastify Swagger plugin — not hand-written
- [ ] `docs/INCIDENT_RESPONSE.md` mirrors §20 emergency protocols exactly
- [ ] No `.md` files exist at repo root except: `README.md`, `LICENSE.md`, `SECURITY.md`, `CONTRIBUTING.md`
- [ ] No `DEPLOYMENT_v*.md` files exist anywhere in repo
- [ ] `docs/PRD.md` is the only PRD file — all `PRD_v*.md` deleted
- [ ] All prompt files in `prompts/` — only `v13_master_prompt.md` and `v13_implementation_prompt.md`
- [ ] Documentation CI gate passes (Stage 1)

---

## §23 CRON ORCHESTRATOR — 7 JOBS

```typescript
// backend/src/cron/orchestrator.ts
import cron              from 'node-cron';
import { FastifyInstance } from 'fastify';
// When timezone: 'Africa/Lagos' (WAT = UTC+1) is set, cron expressions are in WAT local time.
// Write the WAT time you want directly — do NOT subtract 1 hour for UTC.

export function registerCronJobs(fastify: FastifyInstance): void {
  const tz = { timezone: 'Africa/Lagos' };

  // Job 1: Risk scoring — 04:00 WAT daily
  cron.schedule('0 4 * * *', async () => {
    // computeRiskScore for all active orgs; upsert SMERiskRecord
    // Math.max(0, Math.min(100, score)) enforced before DB write
  }, tz);

  // Job 2: Tax health snapshot — 04:30 WAT daily
  cron.schedule('30 4 * * *', async () => {
    // Insert TaxHealthSnapshot per org (insert-only; no updatedAt)
  }, tz);

  // Job 3: Snapshot pruning — 03:00 WAT Sunday weekly
  cron.schedule('0 3 * * 0', async () => {
    // DELETE FROM TaxHealthSnapshot WHERE snapshotDate < NOW() - INTERVAL '24 months'
  }, tz);

  // Job 4: Deadline reminders — 07:00 WAT daily
  cron.schedule('0 7 * * *', async () => {
    // Generate ComplianceEvent reminders for deadlines within 7 days
    // Send push notification (Expo) + SMS fallback (Africa's Talking)
  }, tz);

  // Job 5: Queue health monitor — every 5 minutes (no timezone needed; interval-based)
  // BullMQ handles retries automatically via Worker retry config — do NOT manually re-enqueue
  cron.schedule('*/5 * * * *', async () => {
    // Check nrs-stamp queue depth via queue.getJobCounts()
    // If depth > 50: Sentry.captureMessage('nrs-stamp backlog high', 'warning')
    // Update dlq_depth Prometheus gauge
  });

  // Job 6: DLQ depth monitor — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    // Query DLQJob count where resolved=false; emit Grafana alert if > 10
  });

  // Job 7: Session cleanup — 02:00 WAT daily
  cron.schedule('0 2 * * *', async () => {
    // DELETE FROM RefreshToken WHERE expiresAt < NOW() OR revokedAt IS NOT NULL
  }, tz);

  fastify.log.info('Cron orchestrator: 7 jobs registered');
}

// INVARIANT: No setInterval() anywhere else in the codebase — all scheduling through registerCronJobs()
// Lifecycle: call registerCronJobs(fastify) inside fastify.addHook('onReady', ...) in server.ts
```

---

## §24 KNOWN PITFALL QUICK REFERENCE

| Mistake | Correct |
|---|---|
| `app.use(middleware)` | `fastify.register(plugin)` or `preHandler: [hook]` |
| `res.json(data)` / `res.status(403).json(...)` | `reply.send(data)` / `reply.code(403).send(...)` |
| `req.body` without Fastify context | `request.body` (Fastify FastifyRequest) |
| `new PrismaClient()` in service | `import { prisma } from '../lib/prisma'` |
| `new IORedis(...)` in service (queues) | `import { redis } from '../lib/redis'` |
| `new IORedis(...)` in BullMQ Worker | `createWorkerConnection()` from eventBus.ts — Workers need dedicated connection |
| `console.log(...)` | `request.log.info(...)` in routes · `logger.info(...)` in services |
| `Math.random()` in analytics | `crypto.randomUUID()` or deterministic seed |
| `router.push('/dashboard')` on completion | `router.replace('/dashboard')` |
| `FlatList` | `@shopify/flash-list` FlashList |
| `WHT_RATE = 0.05` (professional) | `WHT_PROFESSIONAL_RATE = 0.10` |
| Inline role check in handler | `requireRole('ADMIN')` preHandler |
| `res.json(result.error.errors)` | `reply.code(400).send({ error:'VALIDATION_ERROR', issues: result.error.issues })` |
| `Alert.alert(...)` for business errors | Toast component (3s success / 6s error) |
| Audit event fire-and-forget | `await writeAuditEvent(...)` (except ACCESS_DENIED) |
| Inline `computeGaugeMode` in DashboardScreen | Import from `TaxHealthGauge.tsx` |
| Hardcode CBN_MPR value | `parseFloat(process.env.CBN_MPR ?? '0.2725')` |
| `ServerSideEncryption` on R2 upload | Remove the param entirely (C-40) |
| `initImmediate: true` in i18n | `initImmediate: false` |
| `buildArcPath()` without `'worklet'` | `'worklet';` as first line of function |
| Submit CTA before preflight resolves | `preflight.pass === true` gate required |
| `grep -c 'zone='` for DashboardZone count | `grep -c '<DashboardZone'` → 5 |
| Next.js `pages/admin/` | `app/admin/*/page.tsx` (App Router) |
| `CMD ["node", "dist/app.js"]` | `CMD ["node", "dist/server.js"]` |
| TIN/CAC verified via NRS only | Youverify → NRS cross-reference |
| Paystack webhook `verif-hash` header | `x-paystack-signature` header |
| Cron `'0 3 * * *'` for 04:00 WAT | `'0 4 * * *'` + `timezone: 'Africa/Lagos'` (express WAT directly) |
| `import('./plugins/authenticate')` in register | Static import + `fastify.register(authenticatePlugin)` |
| Copying builder `node_modules` to prod image | `npm ci --omit=dev` in production stage |
| Admin `page.tsx` calling `buildIntelligenceInput()` directly | Fetch from `GET /api/v2/analytics` endpoint |
| `fastify-swagger-generate` in CI | `tsx scripts/dump-swagger.ts` → `app.swagger()` |
| `storedVersion &&` (falsy check) | `storedVersion !== null &&` (explicit null check — version 0 is valid) |

---

**TAXBRIDGE V13 MASTER PROMPT — SOVEREIGN**
`/prompts/v13_master_prompt.md` · v13.1 Stack-corrected · `github.com/Scardubu/taxbridge`

*Build for the first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin.*
