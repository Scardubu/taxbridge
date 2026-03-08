# TAXBRIDGE V13 MASTER PROMPT — SOVEREIGN

**Path:** `/prompts/v13_master_prompt.md`
**Repo:** `github.com/Scardubu/taxbridge`
**Branch:** `upgrade/v13-sovereign-20260307`
**Supersedes:** All prior versions — V10.3, V11.0, V12-FINAL, V13-Draft, V13-FINAL-v5, V13-FINAL-v6, v13.6
**Effective:** 2026-03-07
**Revision:** v13.7 — Final corrections: OrgStatus enum case fix, constraint table completeness (C-07/C-11/C-12/C-14/C-15/C-16), session-opening check #3 Express+FIRS unification, smoke test #6 idempotency/duplicate semantics, §25 pitfall additions (2026-03-08)
**Stack:** Fastify 5 · Node 20 LTS · PostgreSQL 15 · Redis 7 (IORedis) · React Native Expo SDK 54 · Next.js 15 (App Router)
**Deployment:** Backend → Render Docker `fra` · Admin → Vercel · Mobile → EAS (Android + iOS)

> This document is the single immutable source of truth for all engineering decisions in the `Scardubu/taxbridge` monorepo. No deviation is permitted.

<!-- Module markers for yarn prompts:verify (M00–M11) -->
<!-- M00: FOUNDATIONAL IDENTITY CONTRACT -->
<!-- M01: SYSTEM ARCHITECTURE -->
<!-- M02: NTA 2025 TAX CONSTANTS -->
<!-- M03: SESSION OPENING + ABSOLUTE CONSTRAINTS -->
<!-- M04: FASTIFY APPLICATION PATTERNS -->
<!-- M05: RBAC MODEL -->
<!-- M06: AUDIT AND LOGGING MODEL -->
<!-- M07: INTELLIGENCE ENGINE (ANOMALY + RISK) -->
<!-- M08: MOBILE UX SPECIFICATIONS -->
<!-- M09: COMPOSITE DASHBOARD API + PRISMA SCHEMA -->
<!-- M10: CI/CD + PRODUCTION VALIDATION + CRON -->
<!-- M11: CLEANUP + DOCUMENTATION + ADMIN UX -->

---

## §0 FOUNDATIONAL IDENTITY CONTRACT

TaxBridge transforms Nigerian SME tax compliance from an anxiety-inducing obligation into a confident, guided, and delightful experience. Every line of code must honour this mission.

**Design Target:** A first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin. If it works for them, it works for everyone.

**Engineering Target:** Fintech-grade. Zero-trust. Audit-immutable. Deterministic. Production-sovereign from day one.

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
| API Framework | Fastify | 5.x |
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
| Admin framework | Next.js | 15 (App Router) |
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
| Coverage | c8 (V8 native) | devDependency |

> **CRITICAL:** The API framework is **Fastify 5**, not Express. All middleware, routing, request/reply, error handling, and plugin patterns follow Fastify conventions exclusively. Do not introduce Express-style `app.use()`, `router.get/post`, `res.json()`, or `req.body` without the Fastify request context. See §5 for all Fastify-specific patterns.

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
│   ├── app.ts                       # buildApp(): validateEnv FIRST import; plugin registration
│   ├── validateEnv.ts               # Hard-crash on missing required env vars — imported before Fastify()
│   ├── metrics.ts                   # prom-client singleton — global.__taxbridge_prom_registry
│   ├── lib/
│   │   ├── prisma.ts                # global.__prisma singleton (C-43)
│   │   ├── redis.ts                 # global.__taxbridge_redis IORedis singleton (C-46)
│   │   └── logger.ts                # Standalone Pino for services; redact config
│   ├── plugins/
│   │   ├── authenticate.ts          # fastify.decorate('authenticate'); JWT RS256 + role_version
│   │   ├── resolveOrgContext.ts     # fastify.decorate('resolveOrgContext'); tenant isolation
│   │   ├── requireRole.ts           # fastify preHandler factory; fire-and-forget ACCESS_DENIED
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
│   │   ├── documents.ts             # R2 signed URLs 24h; @fastify/multipart; no ServerSideEncryption
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
│   │   ├── anomalyEngine.ts         # 8 signals; cap 5; try/catch → [] (never propagates)
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
│       └── orchestrator.ts          # node-cron; exactly 7 jobs registered — no setInterval anywhere
│
├── backend/prisma/
│   ├── schema.prisma
│   ├── migrations/                  # Append-only; compensating migrations only; never rollback
│   └── seeds/smokeTestUser.ts       # Deterministic credentials for CI smoke tests
│
├── mobile/src/
│   ├── design-system/
│   │   ├── animation.ts             # DURATION | EASE | ENTER_FROM | ZONE_DELAY
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
│   ├── middleware.ts                 # jose Edge JWT + role_version 30s TTL + CSRF token check
│   └── app/admin/                   # Next.js 15 App Router — NOT pages/admin
│       ├── layout.tsx               # Shared shell: sidebar, topbar, theme, notification tray
│       ├── analytics/page.tsx       # 5 panels; FALLBACK_* on all .catch()
│       ├── dlq/page.tsx             # Retry + resolve; require2FA gate for bulk >10
│       ├── audit/page.tsx           # Cursor-paginated viewer + NDJSON export
│       ├── team/page.tsx            # RBAC management; last-OWNER guard enforced
│       └── api-health/page.tsx      # Links to /metrics; circuit state + DLQ depth display
│
├── admin/src/components/ui/
│   ├── Card.tsx                     # bg-white dark:bg-neutral-900 rounded-xl border p-6 shadow-sm
│   ├── Badge.tsx                    # variants: default | success | warning | danger | info
│   ├── Skeleton.tsx                 # shimmer animation; 0px CLS contract
│   ├── EmptyState.tsx               # icon (48px) + heading + body + optional CTA
│   ├── ConfirmModal.tsx             # accessible <dialog>; aria-modal; focus trap; Escape closes
│   └── CommandPalette.tsx           # ⌘K global shortcut; grouped results; keyboard navigable
│
├── infra/
│   ├── grafana/alerts.yml           # 5 alert rules (see §18)
│   ├── grafana/dashboard.json       # 6-panel Grafana dashboard
│   └── k6/load-test.js              # 200 VUs; 10 min; p95 < 2,000ms; error < 1%
│
├── scripts/
│   ├── backfill-v13.ts              # Idempotent; raw SQL for INSERT-ONLY models; --dry-run flag
│   ├── seed-dev.ts                  # Acme Ltd + deterministic smokeTestUser credentials
│   ├── verify-prompts.ts            # yarn prompts:verify → 12/12 (M00–M11)
│   ├── compress-assets.sh           # pngquant + Lottie JSON minify; size gates enforced
│   ├── session-checks.sh            # §3 session-opening 8-step checks
│   ├── run-accuracy-gates.sh        # §2.2 5 tax accuracy gates
│   ├── smoke-test.sh                # 7 smoke tests; expects STAGING_URL
│   ├── dump-swagger.ts              # Auto-generate docs/api/openapi.json (also at scripts/dump-swagger.ts)
│   └── create-emergency-rollback-proc.sql
│
├── prompts/
│   ├── v13_master_prompt.md         # ← THIS FILE (v13.6)
│   └── v13_implementation_prompt.md # Cursor agent execution directive
│
├── docs/
│   ├── PRD.md                       # Current product requirements
│   ├── ARCHITECTURE.md              # Generated from §1 + §5
│   ├── INCIDENT_RESPONSE.md         # Runbook mirroring §20
│   ├── CHANGELOG.md                 # Keep-a-Changelog format (see §22.2)
│   ├── PRODUCTION_READY.md          # Boolean checklist mirroring §19
│   └── api/openapi.json             # Auto-generated via scripts/dump-swagger.ts (npm run docs:api)
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

Cross-boundary rules:
- Tax calculation always flows `mobile → API → contracts`. Never `mobile → contracts` in production runtime.
- `anomalyEngine.ts` and `riskScoring.ts` are pure functions. They consume `IntelligenceInput`. They never call HTTP or touch the event bus.

### 1.4 Multi-Tenant Org Isolation

```typescript
// backend/src/plugins/resolveOrgContext.ts
import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';

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
    if (!org || org.status === 'suspended')
      return reply.code(403).send({ error: 'ORG_SUSPENDED' });
    if (org.status === 'pending_verification')
      return reply.code(403).send({ error: 'ORG_PENDING_VERIFICATION' });
    request.orgContext = { orgId, role: member.role, memberId: member.id };
  });
});
// All route handlers: destructure request.orgContext.orgId — NEVER request.user.id alone for business queries
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
// ✅ formatNGN(632_400)                        → "₦632,400"
// ✅ formatNGN(5_000_000, { compact: true })   → "₦5.0M"
// ❌ `₦${amount.toLocaleString()}`             → OEM-dependent; breaks on some Android
// ❌ `₦1.5K` via toFixed(0)                   → loses decimal precision; use toFixed(1)
```

---

## §2 NTA 2025 TAX CONSTANTS

**Single source of truth: `packages/contracts/src/constants.ts`. Zero inline math anywhere outside this file.**

```typescript
export const NRS_STAMP_THRESHOLD         = 200_000;
export const VAT_RATE                    = 0.075;
export const VAT_REGISTRATION_THRESHOLD  = 25_000_000;  // NTA 2025 §12 — NOT ₦100M
export const VAT_SMALL_CO_EXEMPTION      = 100_000_000;
export const SMALL_CO_CIT_THRESHOLD      = 100_000_000;
export const SMALL_CO_FIXED_ASSETS_MAX   = 250_000_000;
export const WHT_PROFESSIONAL_RATE       = 0.10;  // 10% — NOT 5%; most common dev error
export const WHT_CONSTRUCTION_RATE       = 0.05;  // 5% — construction/contracts ONLY
export const WHT_NONRESIDENT_RATE        = 0.04;  // non-resident ONLY; never a default
export const WHT_MONTHLY_EXEMPTION_CAP   = 2_000_000;
export const DEV_LEVY_RATE               = 0.04;
export const CIT_LARGE_RATE              = 0.30;
export const CIT_SMALL_RATE              = 0.00;  // < ₦100M turnover
export const PENALTY_IND_FIRST_MONTH     = 50_000;
export const PENALTY_IND_SUBSEQUENT      = 25_000;
export const PENALTY_CO_FIRST_MONTH      = 250_000;
export const PENALTY_CO_SUBSEQUENT       = 125_000;
export const PENALTY_VAT_CO_MONTH        = 50_000;
// CBN_MPR: NEVER hardcoded. Always: parseFloat(process.env.CBN_MPR ?? '0.2725')

export const PIT_BANDS: ReadonlyArray<{ limit: number; rate: number }> = [
  { limit:   800_000, rate: 0.00 },
  { limit: 2_200_000, rate: 0.15 },
  { limit: 9_000_000, rate: 0.18 },
  { limit:13_000_000, rate: 0.21 },
  { limit:25_000_000, rate: 0.23 },
  { limit:  Infinity, rate: 0.25 },
];

export function calculateRRA(annualRentPaid: number): number {
  if (annualRentPaid <= 0) return 0;
  return Math.min(0.20 * annualRentPaid, 500_000); // NTA 2025 §34
}
```

### 2.1 Abolished Provisions — Delete All Occurrences on Sight

| Abolished | Replacement | CI Gate |
|---|---|---|
| CRA: max(₦200k, 1%×gross) + 20%×gross | `calculateRRA()` | `grep -rn "CRA\|consolidatedRelief" → 0` |
| Individual minimum tax: max(PIT, 1%×gross) | None — liability is ₦0 if Band 1 applies | `grep -rn "minTax\|0\.01.*gross" → 0` |
| 15% ETR on PIT | Corporate MNE only (NTA 2025 §47) | `grep -rn "ETR.*PIT\|15%.*individual" → 0` |
| CIT medium band at 20% | Threshold is ₦100M — only 0% or 30% | `grep -rn "0\.20.*[Cc][Ii][Tt]" → 0` |
| WHT 4% as general/default rate | Non-resident only; never default | `grep -rn "0\.04.*[Ww][Hh][Tt]" backend/src → 0` |

### 2.2 Tax Accuracy Gates — All Must Pass Before Merge

```bash
# Gate 1: PIT accuracy
npx tsx -e "
  import { calculatePIT } from './packages/contracts/src/index.js';
  const r = calculatePIT({ grossIncome: 5_000_000, rentPaid: 600_000, pension: 200_000 });
  if (Math.abs(r.taxLiability - 632_400) > 1) { process.stderr.write('FAIL ' + r.taxLiability + '\n'); process.exit(1); }
  process.stdout.write('✅ PIT: ' + r.taxLiability + '\n');
"

# Gate 2: Penalty accuracy
npx tsx -e "
  import { calculatePenalty } from './packages/contracts/src/index.js';
  const r = calculatePenalty({ entityType:'company', daysLate:32, taxAmountDue:0, disclosurePhase:'before_audit' });
  if (r.netPenalty !== 375_000) { process.stderr.write('FAIL ' + r.netPenalty + '\n'); process.exit(1); }
  process.stdout.write('✅ Penalty: ' + r.netPenalty + '\n');
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
Construction / contracts only    → 5%   ← only this category
Non-resident (no NRS WHT)        → 4%   flat
```

WHT exemption requires **both** conditions simultaneously:
- (a) Valid counterparty TIN on file
- (b) Total payments to that party ≤ ₦2,000,000 in that calendar month

### 2.4 Penalty Engine Spec

```typescript
// calculatePenalty(input): PenaltyResult
// disclosurePhase: 'before_audit' | 'during_audit' | 'after_assessment'
// waiverRate:      100%             50%               0%
// monthsLate  = Math.ceil(daysLate / 30)
// lateFiling  = firstMonth + Math.max(0, monthsLate - 1) × subsequent
// cbnMpr      = parseFloat(process.env.CBN_MPR ?? '0.2725') // NEVER hardcode
// interest    = taxAmountDue × (cbnMpr + 0.10) × (daysLate / 365)
// netPenalty  = (lateFiling + interest) × (1 - waiverRate)
// VAT penalty: PENALTY_VAT_CO_MONTH per month — separate schedule from income tax
// NIL late:   same penalty schedule as substantive late filing
```

---

## §3 MANDATORY SESSION OPENING — 8 STEPS

Run **all 8** before modifying any file. Steps 3–7 must return 0 results or **stop**.

```bash
# 1 — Platform state
cat docs/CHANGELOG.md && cat docs/PRODUCTION_READY.md

# 2 — Prompt modules loaded
yarn prompts:verify
# Expected: ✅ 12/12 modules loaded (M00–M11)

# 3 — FIRS + Express eradication
grep -rn "FIRS\|from 'express'" backend/src mobile/src admin/src packages \
  --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules
# → 0 results

# 4 — Contamination
grep -rn "NRSt\|CRA\b\|CRA_\|ProgressBar" backend/src mobile/src \
  --include="*.ts" --include="*.tsx" | grep -v node_modules
# → 0 results

# 5 — Inline tax math in wrong packages
grep -rn "0\.075\b\|0\.30\b\|0\.04\b\|0\.10\b" backend/src mobile/src admin/src \
  --include="*.ts" --include="*.tsx" | grep -v contracts | grep -v node_modules \
  | grep -v "//.*0\." | grep -v "\.test\.\|\.spec\."
# → 0 results (review any hits carefully before blocking)

# 6 — Redis singleton integrity
grep -rn "new IORedis\|new Redis" backend/src --include="*.ts" \
  | grep -v "backend/src/lib/redis.ts" \
  | grep -v "backend/src/services/eventBus.ts"
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

Every constraint is enforced by CI. Violation blocks merge or deploy — no exceptions, no deferrals.

### C-01 through C-17: Critical — Block Merge

| ID | Rule | CI Gate |
|---|---|---|
| C01 | TypeScript strict mode on in all workspaces; zero `any` casts in route handlers | `npx tsc --noEmit → 0 errors` |
| C02 | No FIRS in source — use NRS everywhere | `grep 'FIRS' backend/src mobile/src admin/src → 0` |
| C03 | EAS profiles: `compileSdkVersion:36`, `targetSdkVersion:35` — never change | Checked in Stage 1 |
| C04 | `@taxbridge/contracts` is the sole tax-math package — never duplicate logic | Import graph audit → 0 duplicate calc functions |
| C05 | `npm test --workspaces` → ≥550 passing, 0 failing before any merge | CI Stage 4 |
| C06 | Every UI string in both `en.json` AND `pidgin.json`; Pidgin must be natural Lagos Pidgin | `yarn i18n:check → exit 0` |
| C07 | No route returns 500 on DB/network failure — degrade to `FALLBACK_*` constants + Sentry capture | Code review |
| C08 | `Math.random()` forbidden in dashboard, chart, analytics, or tax calculation code | `grep 'Math\.random' → 0` |
| C09 | Zero inline tax math in `backend/`, `mobile/`, `admin/` | Inline math grep → 0 |
| C10 | All rates from `constants.ts` — no hardcoded numeric rate values elsewhere | Inline rate grep → 0 |
| C11 | Zod validation error shape: `reply.code(400).send({ error:'VALIDATION_ERROR', issues: result.error.issues })` — `.issues` not `.errors` | Code review |
| C12 | Admin cold-start: all dashboard routes return HTTP 200 with `FALLBACK_*` when DB unreachable | Code review |
| C13 | `TaxHealthGauge` = 230° SVG arc only — `ProgressBar` is never a substitute | `grep 'ProgressBar' DashboardScreen.tsx → 0` |
| C14 | One composite dashboard call — never fire 3+ separate requests on component mount | Code review |
| C15 | Every status indicator: color + icon/shape + text label (WCAG 2.2 AA three-channel) | Code review |
| C16 | Animation tokens only: `withTiming(1, { duration: DURATION.standard, easing: EASE.enter })` | Code review |
| C17 | `DashboardScreen` must have exactly 5 `DashboardZone` elements | `grep -c '<DashboardZone' DashboardScreen.tsx → 5` |

### C-18 through C-47: Critical — Block Deploy

| ID | Rule | CI Gate |
|---|---|---|
| C18 | Every dashboard content section in `<DashboardZone zone="…" visible={!isLoading}>` | JSX audit |
| C19 | Anomaly empty: `empty={null}` — never render "No anomalies" or equivalent text | Code review |
| C20 | Gesture response ≤100ms: `onPress` handler never `await`s in tap handler body | Code review |
| C21 | `POST /filings/nil` idempotent; 409 on duplicate; audit awaited | Route + test |
| C22 | VAT credit: `vatCreditBalance.findFirst` from DB — never recompute from transactions | Code review |
| C23 | WHT exemption: BOTH (a) valid counterparty TIN AND (b) monthly total ≤ ₦2M simultaneously | Logic test |
| C24 | RBAC via preHandler only — no inline `if (request.user.role === ...)` in any handler | Code review |
| C25 | Audit events always `await writeAuditEvent(...)`. Only exception: `ACCESS_DENIED` → `.catch(()=>{})` | Code review |
| C26 | Pino only — zero `console.log` in `backend/` | `grep 'console\.log' backend/src → 0` |
| C27 | `CBN_MPR` never hardcoded | `grep '0\.2725\b' packages/contracts backend/src --include="*.ts" -rn \| grep -v '//' → 0` |
| C28 | Accountant delegation queries always include `revokedAt: null` | Code review |
| C29 | NRS circuit override requires `SUPER_ADMIN` + 2FA — `ADMIN` alone is insufficient | Route test |
| C30 | Docker secrets as files: `fs.readFileSync('/run/secrets/key').trim()` not `process.env` | Code review |
| C31 | `orgId` on all business queries: `where: { orgId: request.orgContext.orgId, ... }` | Code review |
| C32 | NGN formatting via `formatNGN()` only — no `` ₦${amount.toLocaleString()} `` | Code review |
| C33 | `SENTRY_DSN` placeholder never committed | `grep 'REPLACE_WITH' mobile/eas.json → 0` |
| C34 | `validate()` preHandler on all POST/PATCH mutation routes — never `schema.parse()` in handler | Route coverage |
| C35 | `idempotency` preHandler on nil, vat, wht, cit filings, payroll/run, payments/initiate | Route coverage |
| C36 | Deep link `SAFE_ROUTES` allowlist enforced — no dynamic path construction | Code review |
| C37 | Flutterwave HMAC: raw Buffer via Fastify content-type parser + `timingSafeEqual` | Webhook test |
| C38 | TOTP backup codes hashed with bcrypt cost 12 before storage | Auth test |
| C39 | Push notification registration: `UserDevice` upsert required in DB | Service test |
| C40 | `pdfWorker.ts` R2 upload: no `ServerSideEncryption` param (causes R2 error) | Code review |
| C41 | CIT: `calculateCIT()` only. Returns `{ citLiability, band }`. No inline math anywhere | Logic gate |
| C42 | `ConfettiAnimation` must have `onError` fallback — local JSON bundle prevents network fail | Mobile test |
| C43 | `global.__prisma` singleton — no `new PrismaClient` in routes or services | `grep 'new PrismaClient' src → 0` |
| C44 | `role_version` incremented in ≥3 paths: role change + TOTP disable + account suspension | `grep role_version → ≥3 distinct call sites` |
| C45 | Pino redact paths: `req.headers.authorization`, `body.password`, `body.tin`, `body.bvn`, `body.receiptUrl`, `body.documentUrl` | Logger config |
| C46 | No new IORedis outside `lib/redis.ts` and `services/eventBus.ts` | `grep 'new IORedis\|new Redis' backend/src → only 2 files` |
| C47 | No Express imports in backend (`express`, `Router`, `Request`, `Response` from express) | `grep "from 'express'" backend/src → 0` |

---

## §5 FASTIFY APPLICATION PATTERNS

This section replaces all Express-style code patterns. Fastify 5 is the API framework. Any Express API (`app.use`, `Router`, `res.json`, `req.body` without Fastify context, `next()`) is a build error.

### 5.1 Server Construction — `backend/src/app.ts`

```typescript
// backend/src/app.ts — exports buildApp(); never calls listen() directly
import './validateEnv'; // ← MUST be absolute first import; hard-crashes on missing vars
import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyCompress from '@fastify/compress';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { redis } from './lib/redis';

// Static plugin imports — no dynamic import(); Node 20 ESM-safe; tree-shaking friendly
import authenticatePlugin from './plugins/authenticate';
import resolveOrgCtxPlugin from './plugins/resolveOrgContext';
import authRoutes from './routes/v1/auth';
import totpRoutes from './routes/v1/auth/totp';
import dashboardRoutes from './routes/v1/dashboard';
import onboardingRoutes from './routes/v1/onboarding';
import filingsRoutes from './routes/v1/filings';
import complianceRoutes from './routes/v1/compliance';
import documentsRoutes from './routes/v1/documents';
import teamRoutes from './routes/v1/team';
import accountantRoutes from './routes/v1/accountant';
import notifRoutes from './routes/v1/notifications';
import monitoringRoutes from './routes/v2/monitoring';
import analyticsRoutes from './routes/v2/analytics';
import dlqRoutes from './routes/v2/dlq';
import auditRoutes from './routes/v2/audit';
import flutterwaveWebhook from './routes/webhooks/flutterwave';
import paystackWebhook from './routes/webhooks/paystack';
import remitaWebhook from './routes/webhooks/remita';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    trustProxy: true, // Required for Render.com + Vercel proxy headers
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
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          process.env.RENDER_EXTERNAL_URL!,
          ...(process.env.SENTRY_DSN
            ? [new URL(process.env.SENTRY_DSN).origin]
            : ['https://*.ingest.sentry.io']),
        ],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  });

  await fastify.register(fastifyCors, {
    origin: (process.env.CORS_ORIGIN ?? '').split(','),
    credentials: true,
  });

  // ── Performance plugins ───────────────────────────────────────────────────
  await fastify.register(fastifyCompress, { encodings: ['gzip', 'deflate'], threshold: 1024 });

  await fastify.register(fastifyRateLimit, {
    global: false,
    redis,
    nameSpace: 'rl:',
    standardHeaders: true,
    legacyHeaders: false,
    errorResponseBuilder: (_req, ctx) => ({
      error: 'RATE_LIMITED',
      message: `Rate limit exceeded. Retry after ${ctx.after}`,
    }),
  });
  await fastify.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // ── JSON body parser — preserves rawBody for HMAC webhook verification ────
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer', bodyLimit: 1_048_576 },
    (_req, body: Buffer, done) => {
      (_req as any).rawBody = body;
      try { done(null, JSON.parse(body.toString('utf8'))); }
      catch (err) { done(err as Error, undefined); }
    }
  );

  // ── OpenAPI spec (non-production) ─────────────────────────────────────────
  await fastify.register(fastifySwagger, {
    openapi: {
      info: { title: 'TaxBridge API', version: '13.0.0', description: 'Nigerian SME Tax Compliance' },
      servers: [{ url: process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:3000' }],
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security: [{ bearerAuth: [] }],
    },
  });
  if (process.env.NODE_ENV !== 'production') {
    await fastify.register(fastifySwaggerUI, { routePrefix: '/docs' });
  }

  // ── Auth decorator plugins ────────────────────────────────────────────────
  await fastify.register(authenticatePlugin);
  await fastify.register(resolveOrgCtxPlugin);

  // ── Route plugins ─────────────────────────────────────────────────────────
  await fastify.register(authRoutes,        { prefix: '/api/v1/auth' });
  await fastify.register(totpRoutes,        { prefix: '/api/v1/auth/totp' });
  await fastify.register(dashboardRoutes,   { prefix: '/api/v1' });
  await fastify.register(onboardingRoutes,  { prefix: '/api/v1/onboarding' });
  await fastify.register(filingsRoutes,     { prefix: '/api/v1/filings' });
  await fastify.register(complianceRoutes,  { prefix: '/api/v1/compliance' });
  await fastify.register(documentsRoutes,   { prefix: '/api/v1' });
  await fastify.register(teamRoutes,        { prefix: '/api/v1' });
  await fastify.register(accountantRoutes,  { prefix: '/api/v1' });
  await fastify.register(notifRoutes,       { prefix: '/api/v1' });
  await fastify.register(monitoringRoutes,  { prefix: '/api/v2/monitoring' });
  await fastify.register(analyticsRoutes,   { prefix: '/api/v2' });
  await fastify.register(dlqRoutes,         { prefix: '/api/v2' });
  await fastify.register(auditRoutes,       { prefix: '/api/v2' });
  await fastify.register(flutterwaveWebhook, { prefix: '/webhooks' });
  await fastify.register(paystackWebhook,   { prefix: '/webhooks' });
  await fastify.register(remitaWebhook,     { prefix: '/webhooks' });

  // ── Global catch-all error handler ────────────────────────────────────────
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error({ err: error }, 'Unhandled error');
    const status = error.statusCode ?? 500;
    reply.code(status).send({
      error: status === 500 ? 'INTERNAL_ERROR' : (error.code ?? 'ERROR'),
      message: status === 500 ? 'An unexpected error occurred' : error.message,
    });
  });

  return fastify;
}
```

```typescript
// backend/src/server.ts — process entry point; never imported by other modules
import { buildApp } from './app';
import { registerCronJobs } from './cron/orchestrator';

async function start() {
  const app = await buildApp();
  app.addHook('onReady', () => { registerCronJobs(app); });
  await app.listen({ port: parseInt(process.env.PORT!, 10), host: '0.0.0.0' });
}
start().catch(err => { process.stderr.write(String(err) + '\n'); process.exit(1); });
```

### 5.2 Route Plugin Pattern (Fastify)

```typescript
// Example: backend/src/routes/v1/filings/nil.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../../lib/prisma';
import { validate } from '../../../plugins/validate';
import { idempotency } from '../../../plugins/idempotency';
import { requireRole } from '../../../plugins/requireRole';
import { writeAuditEvent } from '../../../services/audit';

const NilSchema = z.object({
  taxType: z.enum(['VAT', 'WHT', 'PAYE', 'CIT']),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
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
    if (existing) return reply.code(409).send({ error: 'DUPLICATE_FILING', message: 'Filing already exists for this period' });

    const filing = await prisma.taxReturn.create({
      data: {
        orgId, taxType, period, isNil: true, nilReason, status: 'SUBMITTED',
        filingReference: `NIL-${taxType}-${period}-${createId()}`,
        submittedAt: new Date(),
      },
    });

    await writeAuditEvent({
      orgId, actorId: request.user.userId, actorRole: request.orgContext.role,
      targetType: 'TaxReturn', targetId: filing.id, action: 'FILE',
      ip: request.ip, userAgent: request.headers['user-agent'],
    });

    return reply.send({ filingReference: filing.filingReference, period, taxType });
  });
};

export default nilFilingRoute;
```

### 5.3 Fastify Plugin Decorator Pattern

```typescript
// backend/src/plugins/authenticate.ts
import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify, importSPKI } from 'jose';
import { redis } from '../lib/redis';
import { readFileSync } from 'fs';

let _publicKey: Awaited<ReturnType<typeof importSPKI>> | null = null;

async function getPublicKey() {
  if (_publicKey) return _publicKey;
  const pem = process.env.JWT_PUBLIC_KEY
    ? Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8')
    : readFileSync('/run/secrets/jwt_public_key', 'utf8').trim();
  _publicKey = await importSPKI(pem, 'RS256');
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
      const secret = process.env.NODE_ENV === 'production'
        ? await getPublicKey()
        : new TextEncoder().encode(process.env.JWT_SECRET!);
      const { payload } = await jwtVerify(token, secret);
      // role_version: explicit null check — version 0 is a valid value (do NOT use falsy check)
      const storedVersion = await redis.get(`role_version:${payload.sub}`);
      if (storedVersion !== null && Number(storedVersion) !== (payload as any).role_version)
        return reply.code(401).send({ error: 'TOKEN_EXPIRED', message: 'Session invalidated — please log in again' });
      request.user = {
        userId: payload.sub!,
        orgId: (payload as any).orgId,
        role: (payload as any).role,
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
import { redis } from '../../lib/redis';
// processFlutterwavePayment: import from a dedicated payments service (e.g. services/payments.ts)
// Signature: (body: { data: { tx_ref: string } }) => Promise<void>

const flutterwaveWebhook: FastifyPluginAsync = async (fastify) => {
  fastify.post('/flutterwave', async (request, reply) => {
    const rawBody = (request as any).rawBody as Buffer;
    const payload = rawBody.toString('utf8'); // C-37: toString('utf8') only
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

    processFlutterwavePayment(body).catch(e => fastify.log.error(e));
    return reply.send({ status: 'accepted' });
  });
};

export default flutterwaveWebhook;
```

```typescript
// backend/src/routes/webhooks/paystack.ts — header is x-paystack-signature (not verif-hash)
import { FastifyPluginAsync } from 'fastify';
import { timingSafeEqual, createHmac } from 'crypto';
import { redis } from '../../lib/redis';
// processPaystackPayment: import from a dedicated payments service (e.g. services/payments.ts)
// Signature: (body: { data: { reference: string } }) => Promise<void>

const paystackWebhook: FastifyPluginAsync = async (fastify) => {
  fastify.post('/paystack', async (request, reply) => {
    const rawBody = (request as any).rawBody as Buffer;
    const expected = createHmac('sha512', process.env.PAYSTACK_SECRET!)
      .update(rawBody).digest();
    const received = Buffer.from(request.headers['x-paystack-signature'] as string, 'hex');
    if (expected.length !== received.length || !timingSafeEqual(expected, received))
      return reply.code(403).send({ error: 'INVALID_SIGNATURE' });

    const body = request.body as { data: { reference: string } };
    const ref = body.data?.reference;
    const isNew = await redis.set(`webhook:paystack:${ref}`, '1', 'EX', 172_800, 'NX');
    if (!isNew) return reply.send({ status: 'already_processed' });

    processPaystackPayment(body).catch(e => fastify.log.error(e));
    return reply.send({ status: 'accepted' });
  });
};

export default paystackWebhook;
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

All limiters: `standardHeaders: true`, `legacyHeaders: false`. Route-level config: `config: { rateLimit: { max: N, timeWindow: '1 minute', keyGenerator: (req) => req.user?.userId ?? req.ip } }`

### 5.6 NRS Circuit Breaker

```typescript
// backend/src/services/nrsService.ts
import CircuitBreaker from 'opossum';
import * as Sentry from '@sentry/node';
import { logger } from '../lib/logger';
import { eventBus } from './eventBus';

const breaker = new CircuitBreaker(callNRSAPI, {
  timeout: 10_000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
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
import { requireRole } from '../../plugins/requireRole';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { register } from '../../metrics';

const monitoringRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'degraded'> = {};
    try { await prisma.$queryRaw`SELECT 1`; checks.db = 'ok'; }
    catch { checks.db = 'degraded'; }
    try { await redis.ping(); checks.redis = 'ok'; }
    catch { checks.redis = 'degraded'; }
    const status = Object.values(checks).every(v => v === 'ok') ? 'healthy' : 'degraded';
    return reply.code(200).send({ status, checks, timestamp: new Date().toISOString() });
    // ↑ ALWAYS 200 — never 503; 'degraded' is a valid healthy state for Render
  });

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

```
// POST /api/v1/onboarding/tin
// Youverify → validate TIN active, not suspended; cross-reference NRS
// Body: { tin: string } — exactly 8 digits
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
|---|---|---|---|---|---|---|
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

```typescript
// AuditEvent has NO updatedAt — immutability contract (NDPC §30)
// writeAuditEvent() must ALWAYS be awaited, except ACCESS_DENIED (fire-and-forget .catch(()=>{}))
// PII in AuditEvent: ip, userAgent only — NO tin, bvn, or document URLs in metadata
// Retention: no deletion policy; NDJSON streaming export for compliance

// Sentry scrubber PII regex order (MUST be this order):
// BVN: /\b\d{11}\b/g → '[BVN_REDACTED]'
// ACCT: /\b\d{10}\b/g → '[ACCT_REDACTED]'
// TIN: /\b\d{8}\b/g → '[TIN_REDACTED]'
```

### Pino Redact Configuration (C-45)

```typescript
// All 6 paths must be present in both backend/src/lib/logger.ts AND Fastify constructor:
redact: [
  'req.headers.authorization',
  'body.password',
  'body.tin',
  'body.bvn',
  'body.receiptUrl',
  'body.documentUrl',
]
```

---

## §8 SINGLETONS & ENVIRONMENT

### validateEnv.ts — Hard Crash Guard

```typescript
// backend/src/validateEnv.ts — FIRST import in app.ts, before Fastify() constructor
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

### Prisma Singleton (C-43)

```typescript
import { PrismaClient } from '@prisma/client';
declare global { var __prisma: PrismaClient | undefined; }
export const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query','error'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;
```

### Redis Singleton (C-46)

```typescript
import IORedis from 'ioredis';
declare global { var __taxbridge_redis: IORedis | undefined; }
export const redis: IORedis = globalThis.__taxbridge_redis ?? new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,  // REQUIRED by BullMQ 5 — do not remove
  enableReadyCheck: false,
});
if (process.env.NODE_ENV !== 'production') globalThis.__taxbridge_redis = redis;
```

### Prometheus Registry Guard

```typescript
import { Registry, Histogram, Counter, Gauge } from 'prom-client';
declare global { var __taxbridge_prom_registry: Registry | undefined; }
if (!globalThis.__taxbridge_prom_registry) {
  globalThis.__taxbridge_prom_registry = new Registry();
}
export const register = globalThis.__taxbridge_prom_registry!;
// 7 metrics: http_request_duration_seconds | http_errors_total | nrs_circuit_state
// dlq_depth | filing_submissions_total | active_users_total | penalty_estimate_ngn_total
```

### EventBus

```typescript
// backend/src/services/eventBus.ts
import { EventEmitter } from 'events';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(30);

// BullMQ Workers need a dedicated connection — never share the main redis singleton
export function createWorkerConnection(): IORedis {
  return new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const nrsStampQueue = new Queue('nrs-stamp', { connection: redis });
export const pdfQueue = new Queue('pdf-generation', { connection: redis });
```

---

## §9 COMPLIANCE PREFLIGHT

```typescript
// backend/src/services/compliancePreFlight.ts
// runPreFlight() — C-07: NEVER throws; always returns PreFlightResult
// 4 checks run as Promise.allSettled — all must settle independently

interface PreFlightCheck {
  name: string;
  pass: boolean;
  severity: 'blocking' | 'warning';
  message: string;
  actionPath?: string;
}

interface PreFlightResult {
  pass: boolean;        // true only if ALL blocking checks pass
  checks: PreFlightCheck[];
}

// Blocking checks: active TIN, no overdue filings, no SUSPENDED org status, NRS circuit not open
// Warning checks: penalty estimate > 0, VAT credit aging > 90 days
// Submit CTA in mobile: disabled until preflight.pass === true
// Warnings render inline — do NOT block Submit
```

---

## §10 DOCUMENT VAULT

```typescript
// backend/src/routes/v1/documents.ts
// Upload: @fastify/multipart → validate MIME (pdf/jpg/png/xlsx) → pdfQueue.add() → R2
// Download: prisma.document.findFirst({ where: { orgId, id } }) → R2.getSignedUrl({ expiresIn: 86400 })
// R2 upload: NO ServerSideEncryption param — causes R2 error (C-40)
// Signed URLs: 24h TTL; never expose permanent R2 URLs
// File size limit: 10MB (set in fastifyMultipart config)
// MIME allowlist: ['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
```

---

## §11 INTELLIGENCE ENGINE

### Anomaly Engine — 8 Signals

| Signal | Condition | Severity | Action Path |
|---|---|---|---|
| `vat_gap` | VAT unfiled > 2 periods | high | /filings/vat |
| `revenue_spike` | month-on-month > 40% | medium | /filings/vat |
| `wht_exposure` | unremitted WHT > 30 days | high | /filings/wht |
| `nrs_pending` | pendingJobs > 5 AND > 7 days | medium | /compliance/nrs |
| `cit_approaching` | CIT deadline < 30 days AND no CIT for year | high | /filings/cit |
| `payroll_spike` | payrollChange > 50% MoM | medium | /filings/paye |
| `unfiled_period` | any taxType gap > 30 days | high | filing wizard |
| `vat_credit_aging` | creditBalance > 0 AND unused > 90 days | low | /compliance/vatcredit |

```
// Return: signals.sort(bySeverityDesc).slice(0, 5) ← engine hard cap: 5
// Dashboard composite: further slices to top 3 with severity ≥ medium
// MUST be wrapped in try/catch → return [] + Sentry.captureException + logger.error
// Every AnomalySignal.description is an i18n key (EN + Pidgin) citing the specific data point
// AnomalySignal.score guard: Math.max(0, Math.min(100, score ?? 0)) before any comparison
```

### Risk Scoring — 5 Components

```typescript
// backend/src/services/riskScoring.ts
// filingScore   = onTimeFilingRatio × 30     // max 30 pts
// anomalyScore  = (1 - anomalyRatio) × 25    // max 25 pts
// nrsScore      = nrsStampSuccessRate × 20   // max 20 pts
// vatScore      = vatPositionHealth × 10     // max 10 pts
// dataScore     = accountCompleteness × 10   // max 10 pts
// Total potential: 95 pts → normalise: score = computedTotal / 0.95 to reach 100
// Bands: ≥80=healthy | 60–79=low | 40–59=medium | 20–39=high | <20=critical
// ALWAYS: score = Math.max(0, Math.min(100, Math.round(computedTotal / 0.95))) before any DB write
```

### computeGaugeMode — Single Source

```typescript
// Export from TaxHealthGauge.tsx — import in DashboardScreen; no inline useMemo replication
export function computeGaugeMode(data?: DashboardComposite | null): GaugeMode {
  const deadlines = data?.upcomingDeadlines ?? [];
  const overdue = deadlines.filter(d => d.daysRemaining < 0).length;
  const urgent  = deadlines.filter(d => d.daysRemaining >= 0 && d.daysRemaining <= 7).length;
  if (overdue > 0) return 'critical';
  if (urgent  > 0) return 'warning';
  return 'healthy';
}
// Mode → gauge size: critical/warning = compact (120px, right-aligned) | healthy = expanded (200px, centered)
```

---

## §12 MOBILE UX SPECIFICATIONS

### Dashboard Structure — DO NOT DEVIATE

```tsx
// mobile/src/screens/DashboardScreen.tsx — C-17, C-18, C-19, C-20 enforced
const { data, isLoading, isRefetching, error, refetch } = useDashboard();
const gaugeMode    = useMemo(() => computeGaugeMode(data), [data]);
const hasHighAnomaly = useMemo(
  () => data?.topAnomalies?.some(a => ['high','critical'].includes(a.severity)) ?? false, [data]
);

if (isLoading && !data) return <DashboardSkeleton />;

return (
  <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}>
    <DashboardZone zone="apex" visible={!isLoading}>
      <Greeting userName={data?.stats.userName} />
      <TaxHealthGauge score={data?.stats.taxHealthScore ?? 0} mode={gaugeMode} />
      {gaugeMode !== 'healthy' && <UrgentDeadlineCard deadline={data?.upcomingDeadlines?.[0]} />}
    </DashboardZone>

    <DashboardZone zone="signal" visible={!isLoading}>
      <MetricsRow cards={computeMetricCards(data)} />
    </DashboardZone>

    <DashboardZone zone="action" visible={!isLoading}>
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
  const safeScore = Math.max(0, Math.min(100, score ?? 0));
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
| apex | 200×110px semicircle + 60%×24px greeting strip |
| signal | 3× (31%×72px) row, 8px gap |
| action | 6× (30%×64px) flex-wrap 3-col, 6px gap |
| context | 40%×14px header + 2× (100%×52px), 8px gap |
| ambient | 2× (48%×80px) row, 8px gap |

### Micro-UX Rules

- **Loading hierarchy:** `DashboardSkeleton` (initial) → `SectionSkeletonRows` (partial reload) → inline CTA spinner (submit). Never `<ActivityIndicator />` replacing content.
- **Empty states:** icon + heading + body + CTA always. Exception: anomaly section → `empty={null}` (C-19).
- **Error states:** icon + message + retry. Single tap → clear error → refetch → optimistic loading.
- **Pressable feedback:** `transform: [{ scale: 0.97 }]`, `opacity: 0.85` on press. Required on all interactive elements.
- **Toast:** Success = 3s green auto-dismiss. Error = 6s red dismissible. Never `Alert.alert()` for business logic.
- **Keyboard:** All filing wizards: `KeyboardAvoidingView` + `ScrollView keyboardShouldPersistTaps="handled"`.
- **WCAG 2.2 AA:** Minimum 44×44px touch targets. 4.5:1 contrast. `accessibilityLabel` + `accessibilityRole` + `accessibilityHint` on all interactive elements.
- **Haptics:** `Haptics.impactAsync(Light)` on tap; `notificationAsync(Success)` on filing confirm. Fire **before** any `await`.

### Filing Wizard Requirements

1. `runPreFlight()` completes before Submit CTA renders — never after
2. Preflight failures block Submit CTA; warnings render inline
3. `X-Idempotency-Key: crypto.randomUUID()` generated client-side before first attempt
4. Network error → queue to AsyncStorage with same key → retry on reconnect
5. Success → `ConfettiAnimation` with `onError` fallback (C-42) → PDF receipt download
6. `AccessibilityInfo.announceForAccessibility` on every wizard step change (WCAG 2.2 AA)

### Onboarding Wizard — 5 Steps

1. Business setup — name; TIN inline validation (800ms debounce, Youverify + NRS); CAC/RC number
2. Obligations — VAT | PAYE | CIT | WHT with threshold tooltips
3. TOTP 2FA — QR → scan → verify → backup codes → "I've saved these" gate
4. API key — copy button + SDK quickstart snippet
5. Celebration — `ConfettiAnimation` + "Tax Compliant Business" badge

`router.replace('/dashboard')` on completion — never `router.push`. If `OnboardingProgress.completed === false` AND `step > 1` → show resume prompt on app launch.

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

interface DashboardComposite {
  stats:             DashboardStats;
  topAnomalies:      AnomalySignal[];   // engine returns ≤5; composite filters to ≤3 severity ≥ medium
  upcomingDeadlines: ComplianceEvent[]; // sorted daysRemaining ASC
  nrsHealth:         NrsHealth;         // circuitState | lastSuccessAt | pendingJobs
  meta:              { cached: boolean; cacheAge?: number };
}

// Route implementation (dashboard.ts):
const [stats, allAnomalies, deadlines, nrs] = await Promise.all([
  getStats(orgId, userId).catch(e  => { Sentry.captureException(e); return FALLBACK_STATS; }),
  getAnomalies(orgId).catch(e     => { Sentry.captureException(e); return FALLBACK_ANOMALIES; }),
  getDeadlines(orgId).catch(e     => { Sentry.captureException(e); return FALLBACK_DEADLINES; }),
  getNrsHealth().catch(e          => { Sentry.captureException(e); return FALLBACK_NRS_HEALTH; }),
]);

const topAnomalies = allAnomalies
  .filter(a => ['medium','high','critical'].includes(a.severity))
  .slice(0, 3);

const response = { stats, topAnomalies, upcomingDeadlines: deadlines, nrsHealth: nrs, meta: { cached: false } };
redis.setex(cacheKey, 120, JSON.stringify(response)).catch(() => {}); // fire-and-forget — NEVER await
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

enum UserRole      { SUPER_ADMIN ADMIN OWNER ACCOUNTANT EMPLOYEE VIEWER }
enum NilReason     { NO_REVENUE_THIS_PERIOD BUSINESS_INACTIVE EXEMPT_SUPPLY_ONLY BELOW_REGISTRATION_THRESHOLD }
enum AuditAction   { CREATE UPDATE DELETE FILE AMEND APPROVE OVERRIDE REVOKE INVITE EXPORT ACCESS_DENIED ROLE_CHANGE LOGIN LOGOUT NRS_STAMP PAYMENT_RECEIVED SECURITY_ALERT }
enum RiskBand      { critical high medium low healthy }
enum OrgStatus     { active suspended pending_verification }
enum FilingStatus  { DRAFT SUBMITTED ACCEPTED REJECTED }

model Organisation {
  id            String    @id @default(cuid())
  name          String
  tinNumber     String    @unique
  cacRcNumber   String?
  status        OrgStatus @default(pending_verification)
  plan          String    @default("free")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  members       OrgMember[]
  accountantClients AccountantClient[] @relation("ClientOrg")
  @@index([tinNumber])
}

model OrgMember {
  id         String    @id @default(cuid())
  orgId      String
  userId     String
  role       UserRole
  status     String    @default("active")
  deletedAt  DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  org        Organisation @relation(fields: [orgId], references: [id])
  @@unique([orgId, userId])
  @@index([userId, status])
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  totpSecret    String?
  totpEnabled   Boolean   @default(false)
  roleVersion   Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  @@index([email])
}

model RefreshToken {
  id         String    @id @default(cuid())
  userId     String
  tokenHash  String    @unique
  family     String
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  @@index([userId, revokedAt])
  @@index([expiresAt])
}

model AccountantClient {
  id           String    @id @default(cuid())
  accountantId String
  orgId        String
  grantedAt    DateTime  @default(now())
  revokedAt    DateTime?           // ALWAYS filter revokedAt: null in queries (C-28)
  org          Organisation @relation("ClientOrg", fields: [orgId], references: [id])
  @@index([accountantId, revokedAt])
}

model TaxReturn {
  id               String        @id @default(cuid())
  orgId            String
  taxType          String
  period           String
  status           FilingStatus
  filingReference  String        @unique
  isNil            Boolean       @default(false)
  nilReason        NilReason?
  taxAmountDue     Decimal       @default(0) @db.Decimal(15, 2)
  receiptUrl       String?
  amendedReturnId  String?
  submittedAt      DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  @@unique([orgId, taxType, period])
  @@index([orgId, taxType, period])
}

model AuditEvent {
  id          String      @id @default(cuid())
  orgId       String
  actorId     String
  actorRole   String
  targetType  String
  targetId    String
  action      AuditAction
  before      Json?
  after       Json?
  ip          String
  userAgent   String?
  metadata    Json?
  createdAt   DateTime    @default(now())
  // NO updatedAt — immutability contract (NDPC §30)
  @@index([orgId, createdAt])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
}

model TaxHealthSnapshot {
  id             String    @id @default(cuid())
  orgId          String
  taxHealthScore Int
  riskBand       RiskBand
  anomalyCount   Int
  snapshotDate   DateTime  @default(now())
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
  orgId         String   @unique
  creditBalance Decimal  @default(0) @db.Decimal(15, 2)
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
  @@index([orgId])
}

model OnboardingProgress {
  id        String   @id @default(cuid())
  orgId     String   @unique
  userId    String
  step      Int      @default(1)
  completed Boolean  @default(false)
  updatedAt DateTime @updatedAt
  @@index([userId])
}

model DLQJob {
  id         String    @id @default(cuid())
  queue      String
  jobId      String
  payload    Json
  failReason String
  retryCount Int       @default(0)
  resolved   Boolean   @default(false)
  resolvedAt DateTime?
  resolvedBy String?
  createdAt  DateTime  @default(now())
  @@index([queue, resolved])
  @@index([createdAt])
}

model ComplianceEvent {
  id            String   @id @default(cuid())
  orgId         String
  taxType       String
  dueDate       DateTime
  period        String
  daysRemaining Int
  notifiedAt    DateTime?
  createdAt     DateTime @default(now())
  @@index([orgId, dueDate])
}
```

---

## §15 TESTING STRATEGY

### Framework Rules

- **Backend:** `fastify.inject()` for all HTTP route tests — never `supertest`
- **Contracts:** `npx c8` (V8 native coverage) — not Istanbul/nyc; required for ESM TypeScript
- **Redis in tests:** `ioredis-mock` or dedicated DB index 15 — never the production singleton
- **Response body:** `JSON.parse(response.payload)` — never `response.body`

### Priority Test Matrix

| File | Key assertions |
|---|---|
| `contracts/pit.test.ts` | All 6 bands + RRA + accuracy gate ±₦1 |
| `contracts/wht.test.ts` | All 5 categories + dual exemption |
| `contracts/cit.test.ts` | Small (₦0) + large (₦4.5M) + boundary |
| `contracts/penalties.test.ts` | All 3 disclosure phases + interest |
| `contracts/vat.test.ts` | Net payable + credit carryforward |
| `backend/dashboard.test.ts` | Cache hit/miss + `FALLBACK_*` on each failure |
| `backend/nil-filing.test.ts` | 201 success + 409 idempotency + audit event |
| `backend/anomalyEngine.test.ts` | 8 signals + cap 5 + throw → `[]` |
| `backend/riskScoring.test.ts` | Clamp at 0 and 100 + all 5 components |
| `backend/authenticate.test.ts` | `role_version` stale rejection; version 0 valid |
| `backend/preflight.test.ts` | pass + fail + partial (warnings not blocking) |
| `backend/webhook-flw.test.ts` | HMAC valid + invalid + Redis idempotency |
| `backend/webhook-paystack.test.ts` | `x-paystack-signature` HMAC + idempotency |

---

## §16 EAS CONFIGURATION

```json
// mobile/eas.json — all 3 profiles must have these exact SDK versions
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk", "compileSdkVersion": 36, "targetSdkVersion": 35 },
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk", "compileSdkVersion": 36, "targetSdkVersion": 35 },
      "ios": { "buildConfiguration": "Release" }
    },
    "production": {
      "android": { "compileSdkVersion": 36, "targetSdkVersion": 35 },
      "ios": { "buildConfiguration": "Release" }
    }
  }
}
// SENTRY_DSN: set via `eas secret:create --name SENTRY_DSN` — NEVER in this file (C-33)
```

---

## §17 SMOKE TESTS — 7 REQUIRED

```bash
# scripts/smoke-test.sh — all 7 must pass; expects STAGING_URL env var

# 1. Health check
curl -sf "$STAGING_URL/api/v2/monitoring/health" | jq -e '.status == "healthy" or .status == "degraded"'

# 2. Auth login
TOKENS=$(curl -sf -X POST "$STAGING_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"'$SMOKE_TEST_EMAIL'","password":"'$SMOKE_TEST_PASSWORD'"}')
ACCESS_TOKEN=$(echo $TOKENS | jq -r '.accessToken')

# 3. Dashboard composite
curl -sf "$STAGING_URL/api/v1/dashboard" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq -e '.stats and .topAnomalies and .upcomingDeadlines and .nrsHealth'

# 4. Preflight check
curl -sf -X POST "$STAGING_URL/api/v1/compliance/preflight" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"taxType":"VAT","period":"2026-01"}' | jq -e '.checks | length > 0'

# 5. NIL return idempotency
KEY=$(uuidgen)
curl -sf -X POST "$STAGING_URL/api/v1/filings/nil" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -H "X-Idempotency-Key: $KEY" \
  -d '{"taxType":"VAT","period":"2026-01","nilReason":"NO_REVENUE_THIS_PERIOD"}' | jq -e '.filingReference'

# 6. Idempotency replay — same key returns 200 (cached response); a truly duplicate filing (new key, same orgId+taxType+period) returns 409
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$STAGING_URL/api/v1/filings/nil" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -H "X-Idempotency-Key: $KEY" \
  -d '{"taxType":"VAT","period":"2026-01","nilReason":"NO_REVENUE_THIS_PERIOD"}')
[ "$STATUS" = "200" ]  # same key → idempotency replay → 200

# 6b. 409 on duplicate with a new idempotency key (same org, same taxType+period)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$STAGING_URL/api/v1/filings/nil" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{"taxType":"VAT","period":"2026-01","nilReason":"NO_REVENUE_THIS_PERIOD"}')
[ "$STATUS" = "409" ]  # new key, same period → DUPLICATE_FILING → 409

# 7. Rate limit enforcement (6th login attempt = 429)
for i in $(seq 1 6); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$STAGING_URL/api/v1/auth/login" \
    -H 'Content-Type: application/json' -d '{"email":"x@x.com","password":"wrong"}')
  echo "Attempt $i: $STATUS"
done
[ "$STATUS" = "429" ] || { echo "❌ Rate limit not enforced — expected 429 on 6th attempt, got $STATUS"; exit 1; }

echo "✅ All smoke tests passed (7 required + 1 duplicate-detection check)"
```

---

## §18 GRAFANA ALERTS — 5 RULES

| Alert | Metric | Threshold | Notification |
|---|---|---|---|
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
- [ ] `AuditEvent` model has no `updatedAt`
- [ ] `TaxHealthSnapshot` model has no `updatedAt`

**Architecture**
- [ ] Exactly 7 cron jobs in `orchestrator.ts` (node-cron); `setInterval` elsewhere → 0
- [ ] `validate()` preHandler on all POST/PATCH routes
- [ ] `idempotency` preHandler on all exactly-once routes
- [ ] opossum circuit breaker wired; `nrsCircuitState` gauge updates on state change
- [ ] `anomalyEngine.ts` wrapped in try/catch → return `[]`
- [ ] `riskScoring.ts` clamps 0–100 before DB write
- [ ] `buildIntelligenceInput(orgId, prisma)` implemented in `dashboardService.ts`
- [ ] No Express imports anywhere in `backend/src` (`from 'express'` → 0)

**Admin (Next.js 15 App Router)**
- [ ] Admin pages at `admin/src/app/admin/*/page.tsx` — NOT `pages/` directory
- [ ] `admin/src/app/admin/layout.tsx` implements shared shell (sidebar, topbar, theme, notification tray)
- [ ] `/admin/analytics/page.tsx` renders all 5 panels with `FALLBACK_*` on errors
- [ ] `/admin/dlq/page.tsx` has retry + resolve; 2FA gate for bulk >10
- [ ] `/admin/api-health/page.tsx` exists and displays circuit state + DLQ depth
- [ ] `jose` installed (Edge Runtime JWT)
- [ ] `admin/src/middleware.ts`: CSRF check on mutations

**Mobile (Expo SDK 54)**
- [ ] EAS all 3 profiles: `compileSdkVersion:36`, `targetSdkVersion:35`
- [ ] `SENTRY_DSN` via EAS secret — no placeholder in `eas.json`
- [ ] All `FlatList` → `@shopify/flash-list FlashList` (`grep -rn '<FlatList' mobile/src → 0`)
- [ ] `OnboardingWizard`: `router.replace` on completion; resume path via AsyncStorage
- [ ] Pre-flight before Submit CTA in all 5 filing wizards
- [ ] BiometricAuth always falls through to PIN
- [ ] iOS production: `buildConfiguration: "Release"`
- [ ] `i18n.config.ts`: `initImmediate: false`

**Deployment**
- [ ] GitHub Secrets set: `SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD`, `RENDER_DEPLOY_HOOK_URL`, `CBN_MPR`
- [ ] `prisma/seeds/smokeTestUser.ts` exists with deterministic credentials; seeds both `smokeTestUser` (OWNER) and `smokeTestAdminUser` (ADMIN)
- [ ] `render.yaml` logDrain → Grafana Loki; `region: fra`
- [ ] `CBN_MPR` in Render env (`sync: false`)
- [ ] `.env` files not committed
- [ ] Docker: multi-stage; non-root user; HEALTHCHECK on `/api/v2/monitoring/health`; `prisma generate --schema=./backend/prisma/schema.prisma` in both stages; `package.json` copied to runner stage
- [ ] `CMD ["node", "dist/server.js"]` — NOT `dist/app.js`
- [ ] Rollback tag created; emergency proc SQL executed
- [ ] All 7 smoke tests pass

**Documentation**
- [ ] `docs/CHANGELOG.md` has a `## [13.` entry with Added / Changed / Removed / Security sections
- [ ] `docs/PRODUCTION_READY.md` mirrors §19 checklist — all items binary ✓ / ✗
- [ ] `docs/api/openapi.json` exists and is non-empty (run `npm run docs:api` via `scripts/dump-swagger.ts`)
- [ ] `docs/INCIDENT_RESPONSE.md` mirrors §20 protocols
- [ ] `prompts/` contains only `v13_master_prompt.md` and `v13_implementation_prompt.md` — no versioned `_FINAL_v*.md` files

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
| prom-client crash on hot reload | Double registration | `global.__taxbridge_prom_registry` singleton guard |
| Flutterwave HMAC always false | Wrong body stringification | `rawBody.toString('utf8')` — never `JSON.stringify(request.body)` |
| Paystack HMAC always false | Wrong header name | Header is `x-paystack-signature` not `verif-hash` |
| Penalty wrong | `CBN_MPR` hardcoded | `parseFloat(process.env.CBN_MPR ?? '0.2725')` always |
| Accountant sees wrong org | `revokedAt` unchecked | Add `revokedAt: null` to `AccountantClient` query |
| Fastify 500 on every request | Express middleware imported | Remove all `from 'express'` — use Fastify plugins |
| 15% ETR on individual PIT | Old code path exists | Delete path — NTA 2025 §47 is corporate MNE only |
| Duplicate filing on retry | Missing idempotency | Apply `idempotency` preHandler; client sends `X-Idempotency-Key` |
| Anomaly engine throws to dashboard | Unwrapped `computeAnomalies` | `try/catch → return [] + Sentry` |
| Risk score outside 0–100 | Unclamped | `Math.max(0, Math.min(100, total))` before DB write |
| Onboarding resets to step 1 | No resume path | `PATCH /api/v1/onboarding/progress` + AsyncStorage |
| Health check returns 503 | Degraded state misconfigured | Always HTTP 200 — use `status: 'degraded'` string |
| `TaxHealthSnapshot` grows unbounded | No retention | Snapshot cron prunes entries > 24 months per org |
| Admin analytics blank | `buildIntelligenceInput` missing or wrong boundary | Implement in `dashboardService.ts`; admin fetches via `GET /api/v2/analytics` |
| Youverify TIN fails silently | Missing error state | IDLE → VALIDATING → SUCCESS \| FAILED \| NETWORK_ERROR — surface all states |
| Prisma migration fails on deploy | Schema conflict / drift | (1) `prisma migrate status` (2) Run rollback proc SQL (3) Roll back to tag (4) Compensating migration — NEVER rollback existing migrations |
| BullMQ Worker crashes on start | Shared Redis connection | Workers need dedicated connection: `createWorkerConnection()` from `eventBus.ts` |
| Cron jobs firing at wrong time | UTC cron expressions | With `timezone: 'Africa/Lagos'`, expressions are WAT local time |
| Role version 0 treated as invalid | Falsy `storedVersion` check | Use `storedVersion !== null &&` not `storedVersion &&` — version 0 is valid |
| Admin api-health page missing | New page not created | Create `admin/src/app/admin/api-health/page.tsx` per §23.6 spec |
| Smoke test #3 returns 403 | `OrgMember.status` not `'active'` | Set `OrgMember.status = 'active'` for `smokeTestUser` in `prisma/seeds/smokeTestUser.ts` |
| Smoke test #5 returns 403 | No ADMIN user seeded | Ensure `smokeTestAdminUser` with `ADMIN` role is upserted in `prisma/seeds/smokeTestUser.ts` |
| `resolveOrgContext` always returns 403 | `OrgStatus` enum case mismatch | Prisma enum is lowercase (`suspended`, `pending_verification`) — never uppercase in code comparisons |

---

## §21 CODEBASE CLEANUP — ORPHANED FILES & DEAD DOCS

### Step 1: Verification Before Deletion

```bash
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
git rm -f prompts/v13_master_prompt_FINAL_v5.md
git rm -f prompts/v13_master_prompt_FINAL_v6.md
git rm -f prompts/v13_implementation_prompt_FINAL_v5.md
git rm -f prompts/v13_implementation_prompt_FINAL_v6.md
# After cleanup: only prompts/v13_master_prompt.md + prompts/v13_implementation_prompt.md remain
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
git rm -f backend/src/services/event-bus.ts        # camelCase alias — use eventBus.ts only
git rm -f backend/src/services/taxCalculator.ts    # moved to @taxbridge/contracts
git rm -f mobile/src/utils/taxHelpers.ts           # moved to @taxbridge/contracts
git rm -f backend/src/routes/filings.ts            # replaced by filings/ directory
git rm -f mobile/src/screens/HomeScreen.tsx        # replaced by DashboardScreen.tsx
git rm -f scripts/backfill-v12.ts
git rm -f scripts/validate-production-readiness.ps1
# DO NOT delete: backend/src/app.ts — exports buildApp()
# DO NOT delete: backend/src/server.ts — process entry point
```

### Step 5: Environment Variable Audit

```bash
grep -E "NRS_API_KEY|CBN_MPR|CORS_ORIGIN|DOCUMENT_VAULT_KMS_PROVIDER|DIGITAX_MOCK_MODE|AFRICA_TALKING_API_KEY" .env.example
# Remove from .env.example if unused: FIRS_API_KEY → replaced by NRS_API_KEY
```

### Step 6: Dependency Audit

```bash
npx depcheck --ignores="@types/*,eslint-*,prettier-*" 2>/dev/null
# Do NOT remove: opossum, pino, prom-client, bullmq, @aws-sdk/client-s3, jose, speakeasy, node-cron
# Remove: express, express-rate-limit, compression (express version), cors (express version)
# Verify Fastify equivalents present: @fastify/rate-limit, @fastify/compress, @fastify/cors, @fastify/helmet
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

### 22.1 Canonical Document Registry

| File | Purpose | Owner | Update Trigger |
|---|---|---|---|
| `docs/CHANGELOG.md` | Chronological release history (Keep-a-Changelog format) | Engineering | Every merge to main |
| `docs/PRODUCTION_READY.md` | Boolean checklist mirroring §19 | Engineering | Every deploy |
| `docs/ARCHITECTURE.md` | Narrative system architecture (generated from §1 + §5) | Engineering | Major structural changes |
| `docs/INCIDENT_RESPONSE.md` | Runbook mirroring §20 | On-call lead | After every incident |
| `docs/api/openapi.json` | OpenAPI 3.1 specs (auto-generated via `scripts/dump-swagger.ts`) | CI | Every route change |
| `docs/PRD.md` | Current product requirements (only PRD file — all `PRD_v*.md` deleted) | Product | Quarterly review |
| `prompts/v13_master_prompt.md` | THIS FILE — engineering source of truth | Senior engineer | Breaking changes only |
| `prompts/v13_implementation_prompt.md` | Cursor execution directive | Senior engineer | Phase completions |

### 22.2 CHANGELOG Format (Keep-a-Changelog)

```markdown
# Changelog

## [13.0.0] — 2026-03-07
### Added
- Fastify 5 migration (replaces Express)
- Youverify integration for TIN/CAC identity verification
- Paystack and Remita webhook handlers with HMAC verification
- §22 Documentation Normalization & Consolidation
- §23 Admin Dashboard UX Redesign Spec (Stripe/Linear/Vercel/Notion quality)
- Expo SDK 54 upgrade
- Next.js 15 App Router migration for Admin
- `admin/src/app/admin/api-health/page.tsx` (circuit state + DLQ depth display)
- `scripts/dump-swagger.ts` for OpenAPI spec auto-generation
- User and RefreshToken models added to Prisma schema
- AccountantClient model with revokedAt filter enforcement
- `smokeTestAdminUser` (ADMIN role) seeded alongside `smokeTestUser`
- 8th anomaly signal: `vat_credit_aging`
### Changed
- All middleware converted to Fastify preHandler / plugin patterns
- Admin pages moved from `pages/` to `app/` directory (App Router)
- `server.ts` entry point (was `app.ts` as listen target)
- Admin shell: sidebar, topbar, notification tray added to layout.tsx
### Removed
- Express and all express-* packages
- `pages/` directory in admin (App Router supersedes)
- All V10–V12 prompt files (archived in git history)
### Security
- TOTP backup codes: bcrypt cost 12
- Webhook HMAC: timingSafeEqual on all gateways (FLW, Paystack, Remita)
- role_version check on every authenticated Fastify request
- Pino redact on 6 PII paths
```

### 22.3 OpenAPI Auto-Generation

```typescript
// scripts/dump-swagger.ts
import { buildApp } from '../backend/src/app';
import { writeFileSync, mkdirSync } from 'fs';

const app = await buildApp();
await app.ready();
mkdirSync('docs/api', { recursive: true });
writeFileSync('docs/api/openapi.json', JSON.stringify(app.swagger(), null, 2));
await app.close();
console.log('✅ OpenAPI spec written to docs/api/openapi.json');

// package.json:
// "scripts": { "docs:api": "tsx scripts/dump-swagger.ts" }
```

### 22.4 README Structure (Root)

```markdown
# TaxBridge — Nigerian SME Tax Compliance Platform

## Quick Start
cp .env.example .env && docker-compose up

## Architecture   → docs/ARCHITECTURE.md
## API Reference  → docs/api/openapi.json (or /docs on dev server)
## Development    → docs/CONTRIBUTING.md
## Deployment     → docs/PRODUCTION_READY.md
## Incident       → docs/INCIDENT_RESPONSE.md
```

### 22.5 Documentation CI Gate (Stage 1)

```bash
# CHANGELOG must have an entry for current version
grep -q "## \[13\." docs/CHANGELOG.md \
  || { echo "❌ CHANGELOG missing v13 entry"; exit 1; }

# No TODO/FIXME in docs/
if grep -rn "TODO\|FIXME" docs/ --include="*.md" | grep -qv node_modules; then
  echo "❌ TODO/FIXME found in docs/"; exit 1
fi

# Prompt files must not reference abolished APIs
if grep -nE "express|SDK 51|Express 5|Next\.js 14|pages/admin" prompts/v13_master_prompt.md; then
  echo "❌ Abolished API reference in master prompt"; exit 1
fi

# OpenAPI spec must be present and non-empty
[ -s docs/api/openapi.json ] \
  || { echo "❌ docs/api/openapi.json missing — run npm run docs:api"; exit 1; }

echo "✅ Documentation integrity checks passed"
```

### 22.6 Stale Documentation Deletion Protocol

```bash
git rm -f docs/PRD_v1.md docs/PRD_v2.md docs/PRD_v3.md 2>/dev/null || true
git rm -f docs/ARCHITECTURE_v1.md docs/ARCHITECTURE_v2.md 2>/dev/null || true
# Root-level .md files allowed: README.md, LICENSE.md, SECURITY.md, CONTRIBUTING.md
find . -maxdepth 1 -name "*.md" | grep -vE "README|LICENSE|SECURITY|CONTRIBUTING" \
  | xargs -I{} git mv {} docs/ 2>/dev/null || true
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

## §23 ADMIN DASHBOARD — UX REDESIGN SPEC

This section governs the world-class admin interface standard. Every admin page must meet Stripe/Linear/Vercel/Notion design quality. All changes use Next.js 15 App Router, Tailwind CSS, and Recharts only — no new frameworks.

### 23.1 Shell Architecture — `admin/src/app/admin/layout.tsx`

The admin shell is a persistent layout wrapping all admin pages. It must be implemented as a single `layout.tsx` and never duplicated per-page.

**Shell Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ TOPBAR: Logo | Org switcher | Search | Notif | Avatar   │
├───────────┬─────────────────────────────────────────────┤
│           │                                             │
│ SIDEBAR   │  PAGE CONTENT (scrollable)                  │
│ 240px     │                                             │
│           │                                             │
└───────────┴─────────────────────────────────────────────┘
```

**Sidebar Navigation Items (ordered):**
```
[ChartBarIcon]    Analytics          /admin/analytics
[ClipboardIcon]   Audit Log          /admin/audit
[ExclamationIcon] DLQ               /admin/dlq
[UsersIcon]       Team               /admin/team
[ServerIcon]      API Health         /admin/api-health
```

> Use Heroicons SVG components in production code — never emoji literals in JSX.

**Sidebar visual spec:**
- Width: 240px fixed, collapsible to 64px icon-rail on mobile (`md:` breakpoint)
- Active item: `bg-neutral-100 dark:bg-neutral-800` left-bordered `border-l-2 border-indigo-500`
- Hover: `bg-neutral-50 dark:bg-neutral-900` transition 150ms ease
- Icons: 20px Heroicons outline
- Font: `text-sm font-medium text-neutral-700 dark:text-neutral-300`
- Bottom: version badge + user avatar + logout button

**Topbar visual spec:**
- Height: 56px, `border-b border-neutral-200 dark:border-neutral-800`
- Background: `bg-white dark:bg-neutral-950`
- Org switcher: dropdown showing org name + plan badge; keyboard accessible
- Search: `⌘K` — opens `<CommandPalette>` (§23.7)
- Notification bell: badge count from DLQ depth + unread audit events; opens slide-over tray
- Avatar: dropdown with profile, settings, dark mode toggle, logout

### 23.2 Analytics Page — `admin/src/app/admin/analytics/page.tsx`

**Layout:** 2-column responsive grid (1-col on mobile). Each panel is a `<Card>` with `p-6`, `rounded-xl border border-neutral-200 dark:border-neutral-800`, `bg-white dark:bg-neutral-900`.

**5 Required Panels:**

```
┌──────────────────┬──────────────────┐
│  Revenue Trend   │  Compliance Rate │
│  (Area chart)    │  (Donut + stat)  │
├──────────────────┼──────────────────┤
│  Risk Dist.      │  NRS Stamp Health│
│  (Stacked bar)   │  (Gauge + stats) │
├──────────────────┴──────────────────┤
│       Platform Growth (line)        │
└─────────────────────────────────────┘
```

**Panel spec:**
- Header: `text-xs font-semibold uppercase tracking-wider text-neutral-500` + timeframe selector (7d / 30d / 90d)
- Chart: `<ResponsiveContainer width="100%" height={200}>`
- Footer: delta indicator `↑ 12%` (green) / `↓ 4%` (red), `text-sm`; trend icon
- Empty: dashed border `border-2 border-dashed border-neutral-200` + icon + "No data for this period"
- Error: `FALLBACK_*` constants displayed as `—` — never throw to UI
- Loading: skeleton shimmer matching chart area exactly (0px CLS)

**Chart color palette (accessible, dark-mode aware):**
```
primary:   #6366F1  (indigo-500)
success:   #10B981  (emerald-500)
warning:   #F59E0B  (amber-500)
danger:    #EF4444  (red-500)
neutral:   #94A3B8  (slate-400)
```

**All charts must implement:**
- `<Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg)' }}>` — no default Recharts tooltip
- `<Legend iconType="circle" iconSize={8}>`
- `aria-label` on chart container
- Pattern fill fallback for colorblind accessibility

**Data source:** All panels fetch from `GET /api/v2/analytics/*` — never call `buildIntelligenceInput()` directly from admin.

### 23.3 DLQ Page — `admin/src/app/admin/dlq/page.tsx`

**Layout:** Full-width table with sticky header. Toolbar above.

**Toolbar (left to right):**
- Status filter dropdown: pending | resolved | all
- Queue name filter
- Search: job ID / error message, 300ms debounce
- Bulk actions: "Retry selected" / "Resolve selected" — disabled until ≥1 row selected
- Count badge: `{n} jobs` with red dot if `n > 10`

**Table columns:**
```
[ ] │ Queue │ Job ID │ Fail Reason (truncated 60ch) │ Retries │ Age │ Actions
```

**Row spec:**
- `hover:bg-neutral-50 dark:hover:bg-neutral-800/50`
- Age: relative time (`2h ago`) with absolute ISO timestamp tooltip on hover
- Fail reason: `font-mono text-xs text-red-600 dark:text-red-400` truncated; click to expand full error
- Actions: "Retry" + "Resolve" buttons; Retry disabled if `retryCount ≥ 3`
- Bulk retry > 10 jobs: trigger `<ConfirmModal>` + `require2FA` modal (C-29 enforcement)

**Empty state:** Illustration + "No failed jobs — queue is healthy" + green badge.

**Pagination:** Cursor-based, 25 rows per page. "Load more" button — not page numbers.

### 23.4 Audit Log Page — `admin/src/app/admin/audit/page.tsx`

**Layout:** Full-width timeline + collapsible filter sidebar (240px).

**Filter sidebar:**
- Date range: last 7d / 30d / 90d / custom date picker
- Actor filter: email autocomplete search
- Action filter: multi-select checkboxes (FILE | ROLE_CHANGE | LOGIN | ACCESS_DENIED | etc.)
- Org filter: visible to SUPER_ADMIN only

**Timeline entry spec:**
```
● FILE         by owner@acme.com      in Acme Ltd        2h ago
  ├ Target: TaxReturn #NIL-VAT-2026-01-abc123
  ├ IP: 105.x.x.x  │  UA: Mozilla/5.0 (Linux; Android 13)
  └ [View diff ▾]  — expands before/after JSON diff inline
```

- Action icon: colour-coded — FILE=indigo, ROLE_CHANGE=amber, ACCESS_DENIED=red, LOGIN=green
- Diff viewer: inline `<pre>` with added lines `bg-green-50 text-green-800` / removed lines `bg-red-50 text-red-800` — no new dependencies
- Keyboard: `j/k` to navigate entries; `Enter` to expand diff

**Export:** `GET /api/v2/audit/export` → `Content-Type: application/x-ndjson`. Button shows download progress with byte count.

**Pagination:** Cursor-based infinite scroll via `IntersectionObserver` on last entry.

### 23.5 Team Page — `admin/src/app/admin/team/page.tsx`

**Layout:** Two-panel — member list (left, 360px) + member detail (right, remaining width).

**Member list:**
- Search by name/email, 300ms debounce
- Role filter chips: All | SUPER_ADMIN | ADMIN | OWNER | ACCOUNTANT | EMPLOYEE | VIEWER
- Each row: avatar initial (40px, coloured bg) + name + email + role badge + status dot
- Click row → opens detail panel (SPA behaviour, no navigation)

**Member detail panel:**
- Header: avatar (48px) + name + email + "Member since" date
- Role section: current role badge + role selector dropdown + "Save" button (appears on change)
  - Role selector: shows only roles ≤ actor's own level (RBAC enforcement, C-24)
  - Save: `PATCH /api/v1/team/:memberId/role` → `role_version` increment (C-44)
- Last-OWNER guard: "Save" disabled with tooltip "Cannot remove last owner" when applicable
- Danger zone: "Suspend member" / "Remove member" — `<ConfirmModal>` with `type DELETE to confirm`
- Activity: last 5 audit events for this member (mini timeline)

**Role badge colours:**
```
SUPER_ADMIN: bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400
ADMIN:       bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400
OWNER:       bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400
ACCOUNTANT:  bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400
EMPLOYEE:    bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400
VIEWER:      bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400
```

### 23.6 API Health Page — `admin/src/app/admin/api-health/page.tsx`

**Layout:** 3-column stat cards + live feed panel.

**Required stats:**
- NRS Circuit State: green Closed / amber Half-Open / red Open — auto-refreshes every 30s
- DLQ Depth: count of unresolved jobs; red if > 10
- Last NRS Stamp: relative time of last successful NRS stamp
- P99 Latency: dashboard composite endpoint; sourced from `GET /api/v2/monitoring/metrics`

**Live feed:** last 10 error-level Pino log entries (via polling `/api/v2/monitoring/metrics`). Displayed as `font-mono text-xs`.

**Status indicators** must always show: coloured dot + text label + icon (C-15 three-channel rule).

### 23.7 Shared Admin Components

**`<Card>`**
```tsx
// admin/src/components/ui/Card.tsx
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200
      dark:border-neutral-800 p-6 shadow-sm ${className ?? ''}`}>
      {children}
    </div>
  );
}
```

**`<Badge>`** — variants: `default | success | warning | danger | info`

**`<Skeleton>`** — shimmer animation matching exact dimensions of target content (0px CLS)
```tsx
// Shimmer: bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200
// dark: from-neutral-800 via-neutral-700 to-neutral-800
// animate-[shimmer_1.5s_infinite] — custom keyframe in tailwind.config
```

**`<EmptyState>`** — icon (48px) + heading + body + optional CTA button

**`<ConfirmModal>`** — accessible `<dialog>` element; `aria-modal`; focus trap via `tabIndex`; `Escape` to close; destructive actions: red confirm button; mutations requiring explicit text: `type DELETE to confirm` validation before enabling confirm

**`<CommandPalette>`** — `⌘K` global shortcut (`Ctrl+K` Windows); searches org members, audit events, DLQ jobs; results grouped by type with section headers; keyboard navigable (`↑/↓` to navigate, `Enter` to select, `Esc` to close); opens with 150ms fade-in; result item: icon + label + subtitle + keyboard shortcut hint

### 23.8 Admin Dark Mode

Dark mode via Tailwind `dark:` variants. Theme stored in `localStorage` (admin browser context only — never in server components). System `prefers-color-scheme` as default. Toggle in topbar avatar dropdown. Apply `'dark'` class on `<html>` based on `localStorage('theme')` before React hydration via inline script in `<head>` to prevent flash of wrong theme.

### 23.9 Admin Performance Budget

| Metric | Target |
|---|---|
| Analytics page LCP | < 1,200ms (Vercel edge + CDN) |
| Table render (1000 rows) | < 100ms (windowed if needed) |
| Chart render (all 5 panels) | < 200ms |
| `⌘K` palette open | < 50ms |
| Filter/search debounce | 300ms |
| All `FALLBACK_*` on network error | < 16ms (synchronous constant) |

### 23.10 Admin WCAG 2.2 AA Compliance

- All interactive elements: minimum 44×44px touch target
- All colour combinations: 4.5:1 contrast ratio minimum
- Focus indicators: `ring-2 ring-indigo-500 ring-offset-2` visible on all interactive elements
- Screen reader: `aria-live="polite"` on loading states; `role="status"` on toast notifications
- No colour as sole status indicator: always pair with icon + text label (C-15)
- Keyboard navigation: full tab order; no keyboard traps except modals; `Escape` closes all overlays
- Charts: `aria-label` on container; pattern + colour differentiation for colorblind users

---

## §24 CRON ORCHESTRATOR — 7 JOBS

```typescript
// backend/src/cron/orchestrator.ts
import cron from 'node-cron';
import { FastifyInstance } from 'fastify';

// timezone: 'Africa/Lagos' (WAT = UTC+1) — expressions are WAT local time
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

  // Job 5: Queue health monitor — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    // Check nrs-stamp queue depth; if depth > 50: Sentry.captureMessage
    // Update dlq_depth Prometheus gauge
    // BullMQ handles retries automatically — NEVER manually re-enqueue here
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
// INVARIANT: No setInterval() anywhere else in the codebase
// Lifecycle: called from server.ts onReady hook
```

---

## §25 KNOWN PITFALL QUICK REFERENCE

| Mistake | Correct |
|---|---|
| `app.use(middleware)` | `fastify.register(plugin)` or `preHandler: [hook]` |
| `res.json(data)` / `res.status(403).json(...)` | `reply.send(data)` / `reply.code(403).send(...)` |
| `req.body` in route | `request.body` (Fastify `FastifyRequest`) |
| `new PrismaClient()` in service | `import { prisma } from '../lib/prisma'` |
| `new IORedis(...)` in service | `import { redis } from '../lib/redis'` |
| `new IORedis(...)` in BullMQ Worker | `createWorkerConnection()` from `eventBus.ts` |
| `console.log(...)` | `request.log.info(...)` in routes · `logger.info(...)` in services |
| `Math.random()` in analytics | `crypto.randomUUID()` or deterministic seed |
| `router.push('/dashboard')` on completion | `router.replace('/dashboard')` |
| `FlatList` | `@shopify/flash-list FlashList` |
| `WHT_RATE = 0.05` (professional) | `WHT_PROFESSIONAL_RATE = 0.10` |
| Inline role check in handler | `requireRole('ADMIN')` preHandler |
| `reply.send({ error: result.error.errors })` | `reply.code(400).send({ error:'VALIDATION_ERROR', issues: result.error.issues })` |
| `Alert.alert(...)` for business errors | Toast component (3s success / 6s error) |
| Audit event fire-and-forget | `await writeAuditEvent(...)` (except `ACCESS_DENIED`) |
| Inline `computeGaugeMode` in DashboardScreen | Import from `TaxHealthGauge.tsx` |
| Hardcode `CBN_MPR` value | `parseFloat(process.env.CBN_MPR ?? '0.2725')` |
| `ServerSideEncryption` on R2 upload | Remove the param entirely (C-40) |
| `initImmediate: true` in i18n | `initImmediate: false` |
| `buildArcPath()` without `'worklet'` | `'worklet';` as first line of function |
| Submit CTA before preflight resolves | `preflight.pass === true` gate required |
| `grep -c 'zone='` for DashboardZone count | `grep -c '<DashboardZone'` → 5 |
| `pages/admin/` in Next.js admin | `app/admin/*/page.tsx` (App Router) |
| `CMD ["node", "dist/app.js"]` | `CMD ["node", "dist/server.js"]` |
| TIN/CAC verified via NRS only | Youverify → NRS cross-reference |
| Paystack webhook `verif-hash` header | `x-paystack-signature` header |
| Cron `'0 3 * * *'` for 04:00 WAT | `'0 4 * * *'` + `timezone: 'Africa/Lagos'` |
| `import('./plugins/authenticate')` dynamic | Static import + `fastify.register(authenticatePlugin)` |
| `storedVersion &&` (falsy check) | `storedVersion !== null &&` (explicit null check — version 0 is valid) |
| Admin analytics calling `buildIntelligenceInput()` directly | Fetch from `GET /api/v2/analytics` endpoint |
| `supertest` for backend route tests | `fastify.inject()` — framework-native |
| `response.body` in inject tests | `JSON.parse(response.payload)` |
| `istanbul`/`nyc` for contracts coverage | `c8` (V8 native — required for ESM TypeScript) |
| Emoji in sidebar nav (production JSX) | Heroicons SVG components |
| Admin api-health page missing | Create `admin/src/app/admin/api-health/page.tsx` per §23.6 spec |
| Per-page sidebar/topbar duplication | Single `layout.tsx` — never repeat shell per page |
| Plain Recharts tooltip (default) | Custom `<Tooltip contentStyle={{ borderRadius: '8px', ... }}>` |
| Missing `User` model in Prisma schema | Add `model User` with `roleVersion Int @default(0)` |
| Missing `RefreshToken` model in schema | Add `model RefreshToken` with `family String` for rotation |
| `AccountantClient` without `revokedAt` filter | Always include `revokedAt: null` (C-28) |
| `scripts/dump-swagger.ts` missing | Create script; add `"docs:api": "tsx scripts/dump-swagger.ts"` to root `package.json` |
| `docs/api/openapi.json` empty or absent | Run `npm run docs:api`; CI Stage 1 checks `[ -s docs/api/openapi.json ]` |
| `queueHealthCron` calling `queue.add()` or `job.retry()` | Monitor only — BullMQ handles retries; never manually re-enqueue in cron |
| `smokeTestAdminUser` not seeded | Add ADMIN user upsert to `prisma/seeds/smokeTestUser.ts`; required for smoke test #5 |
| `localStorage` in Next.js server components | `localStorage` is browser-only — only use in client components; never in server components or API routes |
| `org.status === 'SUSPENDED'` in resolveOrgContext | `OrgStatus` Prisma enum is lowercase — use `org.status === 'suspended'` and `org.status === 'pending_verification'` |
| `npx prisma generate` in Dockerfile (no schema flag) | Use `--schema=./backend/prisma/schema.prisma` in both builder and runner stages; copy `package.json` to runner |

---

> **TAXBRIDGE V13 MASTER PROMPT — SOVEREIGN** · `/prompts/v13_master_prompt.md` · v13.7
> Stack-corrected · UX-audited · Schema-complete · Documentation-normalized · `github.com/Scardubu/taxbridge`
> Build for the first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin.
