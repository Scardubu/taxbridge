# TAXBRIDGE V12 MASTER PROMPT — ELEVATED
**Path:** `/prompts/v12_master_prompt.md`
**Repo:** `github.com/Scardubu/taxbridge` | **Branch:** `upgrade/v12-elevated-20260302`
**Supersedes:** V10.3 + V11.0 + V12 FINAL | **Effective:** 2026-03-02
**Deployment:** Backend → Render | Admin → Vercel | Mobile → EAS (Android + iOS)
**Architecture Module:** `/prompts/v12_production_architecture_module.md` — companion artifact; read alongside this prompt for AI pipeline, admin analytics, UX flows, Docker, load testing, and security hardening specifications.
**Authority:** This document is the single, immutable source of truth for all engineering decisions. No deviation is permitted.

---

## 0. FOUNDATIONAL IDENTITY CONTRACT

TaxBridge transforms Nigerian SME tax compliance from an anxiety-inducing obligation into a confident, guided, and even delightful experience. Every line of code must honour this mission.

**The Design Target:** A first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin. If it works for them, it works for everyone.

**The Engineering Target:** Fintech-grade. Zero-trust. Audit-immutable. Deterministic. Production-sovereign from day one.

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Monorepo Structure

```
taxbridge/
├── packages/contracts/src/        # SINGLE SOURCE OF TRUTH — all tax math
│   ├── constants.ts               # NTA 2025 canonical rates + thresholds
│   ├── pit.ts                     # PIT bands + RRA calculation
│   ├── vat.ts                     # VAT rate, registration, credit logic
│   ├── wht.ts                     # WHT rates by transaction type
│   ├── cit.ts                     # CIT bands, Dev Levy
│   ├── cgt.ts                     # CGT rates
│   ├── penalties.ts               # NTA 2025 §§153-180 penalty engine
│   ├── rbac.ts                    # UserRole enum, ROLE_HIERARCHY
│   ├── types.ts                   # All shared interfaces (DashboardComposite, etc.)
│   └── index.ts                   # Public API — re-exports everything
├── backend/
│   ├── src/
│   │   ├── app.ts                 # Entry — validateEnv FIRST import, 0.0.0.0 bind
│   │   ├── validateEnv.ts         # Hard-crash on missing env vars
│   │   ├── lib/
│   │   │   └── logger.ts          # Pino structured logger (NO console.log anywhere)
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT verify — checks role_version every request
│   │   │   ├── requireRole.ts     # RBAC gate — fire-and-forget ACCESS_DENIED audit
│   │   │   ├── require2FA.ts      # 2FA gate for SUPER_ADMIN critical ops
│   │   │   ├── rateLimit.ts       # Per-route rate limits (§6.6)
│   │   │   ├── requestLogger.ts   # Structured request log (method, route, status, ms, orgId)
│   │   │   └── tenant.ts          # Org isolation — resolveOrgContext()
│   │   ├── routes/
│   │   │   ├── v1/
│   │   │   │   ├── dashboard.ts
│   │   │   │   ├── filings/
│   │   │   │   │   ├── nil.ts
│   │   │   │   │   ├── vat.ts
│   │   │   │   │   ├── wht.ts
│   │   │   │   │   └── paye.ts
│   │   │   │   ├── compliance/
│   │   │   │   │   ├── penalty-estimate.ts
│   │   │   │   │   ├── preflight.ts           # runPreFlight() — called before every filing submit
│   │   │   │   │   └── vat-credit.ts
│   │   │   │   ├── onboarding/
│   │   │   │   │   ├── tin.ts
│   │   │   │   │   ├── cac.ts
│   │   │   │   │   └── progress.ts            # PATCH /api/v1/onboarding/progress — resume wizard
│   │   │   │   ├── documents.ts
│   │   │   │   ├── team.ts
│   │   │   │   └── accountant.ts
│   │   │   ├── v2/
│   │   │   │   ├── monitoring.ts              # health + metrics; health includes db/redis latency
│   │   │   │   ├── dlq.ts                     # DLQ management: list, retry, resolve (ADMIN+)
│   │   │   │   └── audit.ts                   # Audit log explorer + NDJSON export (ADMIN+)
│   │   │   └── webhooks/
│   │   │       └── flutterwave.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT verify — checks role_version every request
│   │   │   ├── requireRole.ts     # RBAC gate — fire-and-forget ACCESS_DENIED audit
│   │   │   ├── require2FA.ts      # 2FA gate for SUPER_ADMIN critical ops
│   │   │   ├── rateLimit.ts       # Per-route rate limits (§6.6)
│   │   │   ├── requestLogger.ts   # Structured request log
│   │   │   ├── tenant.ts          # Org isolation — resolveOrgContext()
│   │   │   ├── validate.ts        # Zod schema validation middleware (arch §5.3)
│   │   │   └── idempotency.ts     # X-Idempotency-Key Redis check (arch §5.4)
│   │   ├── services/
│   │   │   ├── audit.ts
│   │   │   ├── dashboardService.ts
│   │   │   ├── penaltyService.ts
│   │   │   ├── vatCredit.service.ts
│   │   │   ├── riskScoring.ts       # computeRiskScore() — 5-component scoring (arch §3.2)
│   │   │   ├── anomalyEngine.ts     # computeAnomalies() — 7 signals, capped at 5 (arch §3.1)
│   │   │   ├── compliancePreFlight.ts  # runPreFlight() — pre-submission checks (arch §8.3)
│   │   │   ├── eventBus.ts
│   │   │   ├── nrsService.ts        # Circuit breaker via opossum (arch §3.3)
│   │   │   ├── redis.ts
│   │   │   └── notifications.ts
│   │   ├── cron/
│   │   │   ├── orchestrator.ts    # Exactly 7 jobs — central registry; no scattered setInterval
│   │   │   ├── taxHealthSnapshot.ts
│   │   │   ├── riskScoringCron.ts
│   │   │   └── keepAlive.ts
│   │   ├── metrics.ts             # prom-client singleton
│   │   └── workers/
│   │       └── nrsStampWorker.ts
│   └── prisma/
│       ├── schema.prisma
│       ├── migrations/            # Append-only, timestamped — never rollback in prod
│       └── seeds/
│           └── smokeTestUser.ts
├── mobile/
│   └── src/
│       ├── design-system/
│       │   ├── animation.ts
│       │   ├── tokens.ts
│       │   └── ngn.ts
│       ├── contexts/
│       │   └── ThemeContext.tsx
│       ├── components/
│       │   ├── dashboard/
│       │   └── shared/
│       ├── screens/
│       │   ├── DashboardScreen.tsx
│       │   ├── OnboardingWizard.tsx
│       │   └── filings/
│       ├── hooks/
│       │   ├── useDashboard.ts
│       │   ├── useTenant.ts
│       │   └── useBiometric.ts
│       ├── i18n/
│       │   ├── en.json
│       │   └── pidgin.json
│       └── services/
│           └── apiClient.ts
│   ├── eas.json
│   └── metro.config.js
├── admin/
│   └── src/
│       ├── middleware.ts
│       ├── pages/admin/
│       │   ├── analytics/     # 5-panel financial analytics (arch §7.1)
│       │   ├── dlq/           # DLQ management UI — retry/resolve (arch §7.2)
│       │   ├── audit/         # Audit log explorer + NDJSON export (arch §7.3)
│       │   └── team/          # Team RBAC + last-OWNER guard (arch §7.4)
│       └── components/
│   └── vercel.json
├── infra/
│   ├── terraform/
│   └── grafana/alerts.yml
├── scripts/
│   ├── check-i18n.ts
│   └── compress-assets.sh
├── .husky/pre-commit
├── .github/workflows/pipeline.yml
├── render.yaml
└── CHANGELOG.md
```

### 1.2 Service Boundaries

| Service | Owns | Cannot Touch |
|---|---|---|
| `packages/contracts/` | All tax math, RBAC types, shared interfaces, `IntelligenceInput` type | No DB, no HTTP |
| `backend/` | API, auth, filing, queues, anomaly engine, risk scoring | No inline tax math |
| `mobile/` | UX, offline, filing UX, onboarding wizard | No tax math, no admin logic |
| `admin/` | Ops dashboard, RBAC mgmt, DLQ, audit explorer, analytics | No mobile-only logic |
| `infra/` | IaC, Grafana configs, Dockerfile | No application code |

**Cross-boundary rule:** Tax calculation always flows `mobile → API → contracts`. Never `mobile → contracts` directly in production runtime (bundle size + audit trail requirements).

**Intelligence boundary rule:** `anomalyEngine.ts` and `riskScoring.ts` live in `backend/src/services/`. They consume `IntelligenceInput` from `packages/contracts/src/types.ts`. They never call HTTP or touch the event bus — pure functions called by `dashboardService.ts` and the risk scoring cron.

### 1.3 Multi-Tenant Org Isolation

Every database query scoped by `orgId`. Never `userId` alone for business data.

```typescript
// backend/src/middleware/tenant.ts
export async function resolveOrgContext(req: AuthRequest, res: Response, next: NextFunction) {
  const { userId, orgId } = req.user;
  const member = await (prisma as any).orgMember.findFirst({
    where: { userId, orgId, status: 'active', deletedAt: null },
  });
  if (!member) return res.status(403).json({ error: 'ORG_ACCESS_DENIED', message: 'You do not have access to this organisation' });
  req.orgContext = { orgId, role: member.role, memberId: member.id };
  next();
}
```

All route handlers destructure `req.orgContext.orgId` — never `req.user.id` alone for business-scoped queries.

### 1.4 NGN Currency Formatting

```typescript
// mobile/src/design-system/ngn.ts
export function formatNGN(amount: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (amount >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000)     return `₦${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000)         return `₦${(amount / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}
// ✅ formatNGN(632_400)                       → "₦632,400"
// ✅ formatNGN(5_000_000, { compact: true }) → "₦5.0M"
// ❌ `₦${amount.toLocaleString()}`           → OEM-dependent; breaks on some Android
```

---

## 2. NTA 2025 TAX CONSTANTS

**Single source of truth:** `packages/contracts/src/constants.ts`
**Rule:** Every downstream consumer imports from `@taxbridge/contracts`. Zero inline math anywhere.

```typescript
export const NRS_STAMP_THRESHOLD          = 200_000;
export const VAT_RATE                     = 0.075;
export const VAT_REGISTRATION_THRESHOLD   = 25_000_000;
export const VAT_SMALL_CO_EXEMPTION       = 100_000_000;
export const SMALL_CO_CIT_THRESHOLD       = 100_000_000;
export const SMALL_CO_FIXED_ASSETS_MAX    = 250_000_000;
export const WHT_DEFAULT_RATE             = 0.10;
export const WHT_PROFESSIONAL_RATE        = 0.10;  // 10% — NOT 5%
export const WHT_CONSTRUCTION_RATE        = 0.05;  // ONLY construction/contracts
export const WHT_NONRESIDENT_RATE         = 0.04;
export const WHT_MONTHLY_EXEMPTION_CAP    = 2_000_000;
export const DEV_LEVY_RATE                = 0.04;
export const CIT_LARGE_RATE               = 0.30;
export const CIT_SMALL_RATE               = 0.00;
export const CGT_COMPANY_RATE             = 0.30;
export const CGT_SHARE_DISPOSAL_EXEMPTION = 150_000_000;
export const CGT_GAIN_EXEMPTION_CAP       = 10_000_000;
export const CGT_LOSS_OFFICE_EXEMPTION    = 50_000_000;
export const PENALTY_IND_FIRST_MONTH      = 50_000;
export const PENALTY_IND_SUBSEQUENT       = 25_000;
export const PENALTY_CO_FIRST_MONTH       = 250_000;
export const PENALTY_CO_SUBSEQUENT        = 125_000;
export const PENALTY_VAT_IND_MONTH        = 10_000;
export const PENALTY_VAT_CO_MONTH         = 50_000;
// CBN_MPR: NEVER hardcoded. Read from process.env.CBN_MPR at runtime only.

export const PIT_BANDS: ReadonlyArray<{ limit: number; rate: number }> = [
  { limit: 800_000,    rate: 0.00 },
  { limit: 2_200_000,  rate: 0.15 },
  { limit: 9_000_000,  rate: 0.18 },
  { limit: 13_000_000, rate: 0.21 },
  { limit: 25_000_000, rate: 0.23 },
  { limit: Infinity,   rate: 0.25 },
];

export function calculateRRA(annualRentPaid: number): number {
  if (annualRentPaid <= 0) return 0;
  return Math.min(0.20 * annualRentPaid, 500_000);
}
```

### 2.1 Abolished Provisions — Delete All Occurrences on Sight

| Abolished | Replacement | CI Gate |
|---|---|---|
| CRA formula: `max(₦200k, 1%×gross) + 20%×gross` | `calculateRRA()` | `grep -rn "CRA\|consolidatedRelief"` → 0 |
| Individual minimum tax: `max(PIT, 1%×gross)` | None — liability = ₦0 if Band 1 | `grep -rn "minTax\|0\.01.*gross"` → 0 |
| 15% ETR on PIT paths | Corporate MNE only (NTA 2025 §47) | `grep -rn "ETR.*PIT\|15%.*individual"` → 0 |
| CIT medium band 20% | ₦100M threshold, 0% or 30% only | `grep -rn "0\.20.*CIT\|CIT.*medium"` → 0 |

### 2.2 PIT Accuracy Gate

```bash
npx ts-node -e "
  const { calculatePIT } = require('./packages/contracts/src');
  const r = calculatePIT({ grossIncome: 5_000_000, rentPaid: 600_000, pension: 200_000 });
  const diff = Math.abs(r.taxLiability - 632_400);
  if (diff > 1) throw new Error('PIT GATE FAILED: got ' + r.taxLiability);
  console.log('✅ PIT gate passed:', r.taxLiability);
"
# RRA=120,000 | Taxable=4,680,000 | Band1=0 | Band2=330,000 | Band3=302,400 | Total=632,400
```

### 2.3 WHT Rate Decision Tree

```
Professional / consultancy fees  → 10%  ⚠️ Common error: users expect 5%
Dividends / Interest / Royalties → 10%
Rent (commercial)                → 10%
Agency commissions               → 10%
Construction / contracts         → 5%   ← ONLY category at 5%
Non-resident (no NRS WHT)        → 4%   flat
```

Exemption requires BOTH conditions simultaneously:
- (a) Valid TIN on file for counterparty
- (b) Total payments to that party ≤ ₦2,000,000 in that calendar month

### 2.4 Penalty Engine — NTA 2025 §§153-180

```typescript
// calculatePenalty(input): PenaltyResult
// disclosurePhase: 'before_audit' | 'during_audit' | 'after_assessment'
// waiverRate:      before=100%,    during=50%,       after=0%
// monthsLate   = Math.ceil(daysLate / 30)
// lateFiling   = firstMonth + Math.max(0, monthsLate - 1) × subsequent
// cbnMpr       = parseFloat(process.env.CBN_MPR ?? '0.2725')  // NEVER hardcoded
// interest     = taxAmountDue × (cbnMpr + 0.10) × (daysLate / 365)
// netPenalty   = (lateFiling + interest) × (1 - waiverRate)
// NIL return late: same schedule as substantive late filing
// VAT penalty: PENALTY_VAT_CO_MONTH per month — separate schedule
```

**Accuracy gates:**
```
Company, 32 days late, ₦0 tax due → lateFiling=375,000 | interest=0 | netPenalty=375,000
Individual, 1 day late, ₦100k due, before_audit → netPenalty=0
```

---

## 3. MANDATORY SESSION OPENING — 8 STEPS

Execute all 8 before modifying any file. Steps 4–7 must return 0 results or STOP.

```bash
# Step 1
cat CHANGELOG.md && cat PRODUCTION_READY.md

# Step 2
cat DEPLOYMENT_v11.0_COMPLETE.md 2>/dev/null || cat DEPLOYMENT_v10.3_COMPLETE.md

# Step 3
yarn prompts:verify
# → must report: "✅ 11/11 modules loaded (M00–M10)"

# Step 4 — FIRS eradication
grep -rn "FIRS" backend/src mobile/src admin/src packages \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" | grep -v node_modules
# → 0 results

# Step 5 — NRSt typo
grep -rn "NRSt" mobile/src --include="*.json"
# → 0 results

# Step 6 — Abolished provisions
grep -rn "CRA\b\|consolidatedRelief\|minTax\|0\.01.*gross\|ETR.*PIT" \
  packages/contracts/src backend/src mobile/src --include="*.ts" --include="*.tsx"
# → 0 results

# Step 7 — Animation token
grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src --include="*.ts" --include="*.tsx" \
  | grep -v "animation.ts"
# → 0 results

# Step 8 — Render warm-up
curl -s -o /dev/null -w "Render: %{http_code} in %{time_total}s\n" \
  "${RENDER_EXTERNAL_URL:-https://taxbridge-api-ker8.onrender.com}/api/v2/monitoring/health"
```

---

## 4. AGENT ROLES & COLLABORATION PROTOCOL

| Agent | Files Owned | Cannot Modify | Responsibility |
|---|---|---|---|
| **Architect** | `packages/contracts/`, `prisma/schema.prisma`, architecture docs | App logic | Tax math correctness, schema integrity, service boundary enforcement |
| **Security Guardian** | `middleware/auth.ts`, `requireRole.ts`, `tenant.ts`, `validateEnv.ts` | Business logic | Zero-trust posture, PII controls, NDPR/CBN compliance |
| **DevOps Maestro** | `render.yaml`, `eas.json`, `.github/workflows/`, `infra/terraform/` | Source code | CI/CD gates, IaC, blue-green deployments, rollback readiness |
| **Product & UX Visionary** | `mobile/src/`, `admin/src/`, design-system | Backend services | Mobile-first UX, Pidgin quality, animation, WCAG 2.2 AA |
| **QA Sentinel** | `**/*.test.ts`, `**/*.spec.ts`, `scripts/check-i18n.ts` | Source implementation | Coverage enforcement, accuracy gates, performance thresholds |
| **AI Coding Artisan** | All files, guided by this prompt | Must not deviate from constraints | Autonomous execution within prompt boundaries only |

**AI Coding Artisan rules — non-negotiable:**
1. Load task context via `loadContextForTask()` before writing any code.
2. Read the target file completely before modifying it.
3. After every file write, run the applicable CI gate for that file's domain.
4. Never combine unrelated concerns in a single commit.
5. Comply with C-01 through C-33 without exception.
6. On any gate failure: stop, fix, re-gate, only then continue.

---

## 5. ABSOLUTE CONSTRAINTS — C-01 through C-33

Format: Rule | ✅ correct | ❌ wrong | CI gate where applicable.

**C-01 — Prisma Types**
```typescript
// ✅ (prisma as any).taxHealthSnapshot.findMany({ where: { orgId, userId } })
// ❌ prisma.taxHealthSnapshot.findMany({ where } as Prisma.TaxHealthSnapshotWhereInput)
```

**C-02 — No FIRS**
`FIRS` must not appear in any file.
CI: `grep -rn "FIRS" . --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules` → 0

**C-03 — Android SDK Fixed**
`compileSdkVersion: 36`, `targetSdkVersion: 35`. Never change these values.

**C-04 — EAS Config Canonical**
`mobile/eas.json` is the single build config. No build settings elsewhere.

**C-05 — Test Gate**
`npm test --workspaces` → ≥ 550 passing, 0 failing before any merge.

**C-06 — Bilingual i18n**
Every user-visible string in both `en.json` AND `pidgin.json`. Pidgin must be natural Lagos Pidgin, not literal translation.
CI: `yarn i18n:check` → exit 0

**C-07 — Graceful Degradation**
No route returns 500 on DB or network failure. Degrade to `FALLBACK_*` constants.

**C-08 — No Fabricated Data**
`Math.random()` is forbidden in dashboard, chart, analytics, or tax calculation code.

**C-09 — Tax Math in contracts/ Only**
Zero inline tax math in `backend/`, `mobile/`, or `admin/`.

**C-10 — Constants from contracts/constants.ts Only**
Never hardcode VAT rates, PIT bands, WHT rates, or penalty amounts outside `constants.ts`.

**C-11 — Zod: .issues Not .errors**
```typescript
// ✅ res.status(400).json({ error: 'VALIDATION_ERROR', issues: result.error.issues });
// ❌ res.status(400).json({ errors: result.error.errors }); // TypeError — Zod v3 uses .issues
```

**C-12 — Admin Cold-Start Fallbacks**
All admin dashboard routes return HTTP 200 with `FALLBACK_*` when DB is unreachable.

**C-13 — SVG Gauge Only**
`TaxHealthGauge` renders 230° SVG arc. `ProgressBar` is never a substitute.

**C-14 — One Composite Dashboard Call**
`GET /api/v1/dashboard` returns all dashboard data. Never fire 3+ separate requests on mount.

**C-15 — Three-Channel Status Indicators**
Every status indicator: color + icon/shape + text label. WCAG 2.2 AA required.

**C-16 — Animation Tokens Only**
```typescript
// ✅ withTiming(1, { duration: DURATION.standard, easing: EASE.enter })
// ❌ withTiming(1, { duration: 350 })
```
CI: `grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src | grep -v animation.ts` → 0

**C-17 — All 5 Dashboard Zones Required**
`DashboardScreen` must contain exactly: `apex`, `signal`, `action`, `context`, `ambient`.
CI: `grep 'zone="' mobile/src/screens/DashboardScreen.tsx | wc -l` → 5

**C-18 — Zone Wrapper Required**
Every dashboard content section wrapped in `<DashboardZone zone="…" visible={!isLoading}>`.

**C-19 — Silent Anomaly Empty State**
No anomalies → `empty={null}`. Never render "No anomalies" text.
CI: `grep -rn "No anomal\|noAnomal" mobile/src` → 0

**C-20 — Gesture Response ≤ 100ms**
```typescript
// ✅ onPress={() => router.push('/route')}
// ❌ onPress={async () => { await fetch(); router.push('/route'); }}
```
CI: `grep -rn "await.*router\|router.*await" mobile/src/screens/DashboardScreen.tsx` → 0

**C-21 — NIL Return Required**
`POST /api/v1/filings/nil` with `NilReason` enum. Idempotent (409 on duplicate). Audit event awaited.

**C-22 — VAT Credit from DB**
```typescript
// ✅ (prisma as any).vatCreditBalance.findFirst({ where: { orgId, period, usedInPeriod: null } })
// ❌ recomputeVATFromTransactions() // double-counts, stale results
```

**C-23 — WHT Exemption: Both Conditions Required**
WHT exemption only when: (a) counterparty TIN validated AND (b) monthly total ≤ ₦2M.

**C-24 — RBAC via Middleware Only**
```typescript
// ✅ router.post('/payroll', authenticate, resolveOrgContext, requireRole('ACCOUNTANT'), handler)
// ❌ if (req.user.role === 'admin') { ... } // inline bypass — forbidden
```

**C-25 — Audit Events Always Awaited**
```typescript
// ✅ await writeAuditEvent({ ... }, prisma);
// Exception: ACCESS_DENIED in requireRole() → fire-and-forget .catch(() => {})
```

**C-26 — Pino Logger Only**
```typescript
// ✅ logger.info({ orgId, userId }, 'NIL return filed')
// ❌ console.log('NIL return filed')
```
CI: `grep -rn "console\.log" backend/src --include="*.ts"` → 0

**C-27 — CBN_MPR Never Hardcoded**
```typescript
// ✅ const cbnMpr = parseFloat(process.env.CBN_MPR ?? '0.2725');
// ❌ const cbnMpr = 0.2725;
```
CI: `grep -rn "0\.2725\b" packages/contracts/src backend/src` → 0

**C-28 — Accountant Delegation Checks revokedAt**
```typescript
// ✅ where: { accountantId, clientOrgId, revokedAt: null }
// ❌ where: { accountantId, clientOrgId } // includes revoked delegations
```

**C-29 — NRS Circuit Override: SUPER_ADMIN + 2FA**
```typescript
// ✅ requireRole('SUPER_ADMIN'), require2FA, then override
// ❌ requireRole('ADMIN') // insufficient for critical infrastructure override
```

**C-30 — Docker Secrets as Files**
```typescript
// ✅ fs.readFileSync('/run/secrets/db_password', 'utf8').trim()
// ❌ process.env.DB_PASSWORD // Docker Swarm mounts secrets as files
```

**C-31 — Org Isolation on All Business Queries**
```typescript
// ✅ where: { orgId: req.orgContext.orgId, userId }
// ❌ where: { userId } // leaks data across orgs
```

**C-32 — NGN Formatting via formatNGN()**
```typescript
// ✅ formatNGN(amount) → "₦632,400"
// ❌ `₦${amount.toLocaleString()}` // OEM-dependent locale behavior
```

**C-33 — SENTRY_DSN Placeholder Gate**
`REPLACE_WITH_ACTUAL_DSN_SECRET` must never appear in committed code.
CI: `grep '"SENTRY_DSN": "REPLACE' mobile/eas.json` → 0

**C-34 — validate() Middleware on All Mutation Routes**
```typescript
// ✅ router.post('/filings/nil', authenticate, resolveOrgContext, validate(NilSchema), handler)
// ❌ const data = nilSchema.parse(req.body); // inside handler — no middleware protection
```
Every POST/PATCH handler with a body schema must use the `validate()` middleware.
Never call `schema.parse()` directly inside a route handler.

**C-35 — Idempotency on Exactly-Once Operations**
```typescript
// ✅ router.post('/filings/nil', authenticate, resolveOrgContext, idempotency, validate(NilSchema), handler)
// ❌ POST /api/v1/filings/nil with no idempotency → duplicate filing risk on network retry
```
Applies to: `POST /api/v1/filings/nil`, `POST /api/v1/filings/vat`, `POST /api/v1/filings/wht`, `POST /api/v1/payroll/run`, `POST /api/v1/payments/initiate`.
Client sends `X-Idempotency-Key: <uuid>`. Backend caches response in Redis 24h.

---

## 6. SECURITY CONTROLS

### 6.1 Authentication

```typescript
// JWT: RS256 in production; HS256 acceptable in dev
// Access token TTL:  15 minutes
// Refresh token TTL: 7 days, rotated on every use, single-use
// Token storage: expo-secure-store (mobile); httpOnly cookie (admin)
// Never: localStorage, AsyncStorage for tokens

// Role-version invalidation on role change:
await redis.setex(`role_version:${userId}`, 60 * 60 * 24 * 7, Date.now().toString());
// Middleware checks role_version on EVERY authenticated request — stale tokens rejected immediately
```

### 6.2 Biometric Authentication

```typescript
// mobile/src/hooks/useBiometric.ts
export async function authenticateWithBiometric(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) return false; // fall through to PIN — never block login
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access TaxBridge',
    cancelLabel: 'Use PIN', fallbackLabel: 'Use PIN', disableDeviceFallback: false,
  });
  return result.success;
}
// Re-prompt after 5min inactivity. Consent in expo-secure-store, not AsyncStorage.
```

### 6.3 PII Scrubbing (Sentry)

```typescript
// Order matters — longest pattern first prevents partial masking
beforeSend(event) {
  const raw    = JSON.stringify(event);
  const masked = raw
    .replace(/\b\d{11}\b/g, '[BVN_REDACTED]')   // BVN: 11 digits
    .replace(/\b\d{10}\b/g, '[ACCT_REDACTED]')  // Account: 10 digits
    .replace(/\b\d{8}\b/g,  '[TIN_REDACTED]');  // TIN: 8 digits
  try { return JSON.parse(masked); } catch { return event; }
}
```

### 6.4 Transport Security

```typescript
// backend/src/app.ts — exact middleware order required
import './validateEnv'; // MUST be first import

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", process.env.RENDER_EXTERNAL_URL ?? 'https://taxbridge-api-ker8.onrender.com',
                   "https://o4506000000000000.ingest.sentry.io"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: (process.env.CORS_ORIGIN ?? 'https://taxbridge.vercel.app').split(','),
  credentials: true,
}));

// Gzip compression — reduce payload size on slow connections
app.use(compression({ level: 6, threshold: 1024 }));

// express.raw BEFORE express.json — rawBody preserved for Flutterwave HMAC
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);

app.listen(parseInt(process.env.PORT!, 10), '0.0.0.0', () => {
  logger.info({ port: process.env.PORT }, 'Server started');
});
```

### 6.5 Flutterwave HMAC

```typescript
const hmac = crypto
  .createHmac('sha256', process.env.FLUTTERWAVE_SECRET!)
  .update((req.body as Buffer).toString('utf8'))
  .digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(received))) {
  return res.status(401).json({ error: 'INVALID_SIGNATURE' });
}
```

### 6.6 Rate Limiting

| Route | Limit |
|---|---|
| `POST /api/v1/auth/login` | 5 req/min per IP |
| `POST /api/v1/auth/refresh` | 10 req/min per userId |
| `GET /api/v1/dashboard` | 30 req/min per userId |
| `POST /api/v1/filings/*` | 10 req/min per orgId |
| `POST /api/v1/filings/nil` | 5 req/min per orgId |
| `POST /api/v1/onboarding/tin` | 3 req/min per IP |
| `POST /api/v1/onboarding/cac` | 3 req/min per IP |
| `GET /api/v2/monitoring/health` | Unlimited (public) |
| `GET /api/v2/monitoring/metrics` | 10 req/min, ADMIN only |

### 6.7 TIN + CAC/RC Onboarding Validation

```typescript
// POST /api/v1/onboarding/tin — Body: { tin: string } — exactly 8 digits
// NRS TIN lookup → validate active, not suspended
// Response: { valid, tin, entityName, entityType, registrationDate }
// Audit: await writeAuditEvent — TIN lookups are sensitive PII access
// TIN inline state machine (mobile):
//   IDLE → VALIDATING (8 digits entered, debounced 800ms) →
//     SUCCESS: green ✅, entityName displayed, step unlocked
//     FAILED:  red ❌ + "TIN invalid — check and retry" + retry button
//     NETWORK_ERROR: amber ⚠️ + "Network issue — try again" + retry button

// POST /api/v1/onboarding/cac — Body: { rcNumber: string } — format: RC-NNNNNN
// CAC API → entity name, directors, status
// Store: orgProfile.cacRcNumber, orgProfile.entityName (verified)
// Audit: await writeAuditEvent

// PATCH /api/v1/onboarding/progress — Body: { step, tinVerified?, cacVerified?, selectedObligations? }
// Upsert OnboardingProgress for req.orgContext.orgId
// Return: { currentStep, completed, nextRoute }
// Offline resilience: mobile queues to AsyncStorage on network error, syncs on reconnect
// Resume: if OnboardingProgress.completed===false AND currentStep>1 → show resume prompt on launch
// Completion: router.replace('/dashboard') — never router.push (prevents back navigation to wizard)
```

### 6.8 NRS Service — Circuit Breaker

```typescript
// backend/src/services/nrsService.ts
// Dependencies: opossum + @types/opossum
const breaker = new CircuitBreaker(callNRSAPI, {
  timeout:                  10_000,  // 10s — NRS API can be slow
  errorThresholdPercentage: 50,
  resetTimeout:             30_000,  // retry at half-open after 30min
  volumeThreshold:          5,
});
// State transitions update the nrsCircuitState prom-client Gauge:
// closed=0 (healthy) | half-open=1 | open=2 (unreachable)
// DIGITAX_MOCK_MODE=true → bypass circuit, return { irn: `MOCK-IRN-${Date.now()}` }
// On open: logger.warn + Sentry.captureException + notify ADMIN (eventBus: nrs.circuitOpened)
```

### 6.9 Pre-Filing Compliance Check

```typescript
// backend/src/services/compliancePreFlight.ts
// Called via GET /api/v1/filings/preflight?taxType=&period=
// Returns: { pass: boolean, warnings: Check[], failures: Check[] }
// Checks performed in parallel:
//   1. TIN validity (not suspended in NRS)
//   2. Prior period filing gap (no gap > 30 days for this taxType)
//   3. VAT registration status (if taxType=VAT, org must be VAT-registered)
//   4. NRS circuit health (warn if open — filing will queue, not block)
// Failures block submission client-side (client renders them before showing Submit CTA)
// Warnings are shown inline as informational notices
// Client mobile: call preflight BEFORE showing "Submit" CTA on all filing wizards
```

---

## 7. RBAC MODEL

### 7.1 Role Hierarchy

```typescript
// packages/contracts/src/rbac.ts
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OWNER' | 'ACCOUNTANT' | 'EMPLOYEE' | 'VIEWER';

export const ROLE_HIERARCHY: Readonly<Record<UserRole, number>> = {
  SUPER_ADMIN: 6, ADMIN: 5, OWNER: 4, ACCOUNTANT: 3, EMPLOYEE: 2, VIEWER: 1,
} as const;
```

### 7.2 Permission Matrix

| Resource | SUPER_ADMIN | ADMIN | OWNER | ACCOUNTANT | EMPLOYEE | VIEWER |
|---|---|---|---|---|---|---|
| Dashboard read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Invoice read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Invoice create/edit | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Expense create/edit | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Payroll run | ✓ | ✓ | ✓ | ✓ | — | — |
| Tax filings submit | ✓ | ✓ | ✓ | ✓ | — | — |
| Document vault | ✓ | ✓ | ✓ | ✓ | — | — |
| Team management | ✓ | ✓ | ✓ | — | — | — |
| RBAC assign | ✓ | ✓ | ✓¹ | — | — | — |
| Audit log read | ✓ | ✓ | — | — | — | — |
| System / admin panel | ✓ | ✓ | — | — | — | — |
| DLQ management | ✓ | ✓ | — | — | — | — |
| NRS circuit override | ✓ | — | — | — | — | — |

¹ OWNER may assign roles up to OWNER level within own org only. Backend `requireRole` enforces upper-bound — an actor can never assign a role ≥ their own level.

### 7.3 Accountant Delegation

```typescript
// Every delegation query must check revokedAt: null
async function resolveAccountantScope(accountantUserId: string, targetOrgId: string) {
  const delegation = await (prisma as any).accountantClient.findFirst({
    where: { accountantId: accountantUserId, clientOrgId: targetOrgId, revokedAt: null },
  });
  if (!delegation) throw new ForbiddenError('DELEGATION_NOT_ACTIVE');
  return delegation.permissions;
}
```

### 7.4 Session Invalidation on Role Change

```typescript
await redis.del(`sessions:${userId}`);
await redis.setex(`role_version:${userId}`, 60 * 60 * 24 * 7, Date.now().toString());
// JWT middleware checks role_version on every authenticated request; stale tokens rejected immediately
```

---

## 8. AUDIT AND LOGGING MODEL

### 8.1 AuditEvent Schema (Immutable — No updatedAt)

```prisma
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
  @@index([targetType, targetId])
  @@index([action, createdAt])
}
```

```typescript
await writeAuditEvent({
  orgId:      req.orgContext.orgId,
  actorId:    req.user.id,
  actorRole:  req.user.role,
  targetType: 'TaxReturn',
  targetId:   filing.id,
  action:     'FILE',
  after:      { filingReference, period, isNil },
  ip:         req.ip ?? '0.0.0.0',
  userAgent:  req.headers['user-agent'],
}, prisma);
// EXCEPTION: ACCESS_DENIED in requireRole() → .catch(() => {}) — 403 must not wait on audit write
```

### 8.2 Structured Logging (Pino)

```typescript
// backend/src/lib/logger.ts
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.LOG_FORMAT === 'json' ? {} : { transport: { target: 'pino-pretty' } }),
  redact: ['req.headers.authorization', 'body.password', 'body.tin', 'body.bvn'],
});
// production: LOG_LEVEL=info | staging: LOG_LEVEL=debug | dev: LOG_LEVEL=debug + pino-pretty
```

### 8.3 Required Audit Points

| Action | Method | Requirement |
|---|---|---|
| Tax filing submit (any type) | `await` | Mandatory |
| NIL return file | `await` | Mandatory |
| Role change | `await` | Mandatory |
| Document upload/download | `await` | Mandatory |
| NRS stamp (success or failure) | `await` | Mandatory |
| Penalty estimate generated | `await` | Mandatory |
| TIN lookup | `await` | Mandatory |
| CAC lookup | `await` | Mandatory |
| Accountant delegation grant/revoke | `await` | Mandatory |
| ACCESS_DENIED | `.catch(()=>{})` | Exception only |

---

## 9. FILING ARTIFACT IMMUTABILITY

### 9.1 Filed Return Invariants

Once `TaxReturn.status === 'submitted'`:
- No field may be updated except `receiptUrl`
- Amendments create a NEW `TaxReturn` with `amendedReturnId` pointing to original
- Original return `status` changes to `'amended'` — never deleted
- All amendments audited with `action: 'AMEND'` and `before`/`after` diff

### 9.2 NRS Stamp Immutability

```prisma
model Invoice {
  nrsStampedAt  DateTime? // null = unstamped; non-null = fields below are locked
  nrsIRN        String?   // Invoice Reference Number
  stampAttempts Int       @default(0)
  // After nrsStampedAt: amount, vatAmount, buyerTin, sellerTin, lineItems LOCKED
  // Backend rejects PATCH on stamped invoices
  // UI: 🔒 indicator; all edit controls disabled
}
```

### 9.3 Document Vault

- Encrypted at rest: AES-256-GCM; KMS rotation annual
- KMS provider set via `DOCUMENT_VAULT_KMS_PROVIDER` env var (Cloudflare preferred for NG latency)
- Retention: 5 years minimum (NTA 2025); hard delete only via SUPER_ADMIN after 7 years
- Access: signed URL expiry 24h; every access logged to `AuditEvent`
- Storage: Cloudflare R2

---

## 9A. API STANDARDIZATION

### 9A.1 Error Response Schema — Universal

```typescript
// Every error response, every route, every status code — this exact shape:
interface ApiError {
  error:   string;     // SCREAMING_SNAKE_CASE — never changes between versions
  message: string;     // Human-readable EN — safe to display to users
  issues?: ZodIssue[]; // Present only on 400 VALIDATION_ERROR
  code?:   number;     // HTTP status echo — optional client convenience
}

// Complete error code registry (add new codes here, never invent ad-hoc strings):
// 400 VALIDATION_ERROR        — Zod .issues present
// 401 UNAUTHORIZED            — missing or expired token
// 401 TOKEN_EXPIRED           — access token expired; client should refresh
// 403 ORG_ACCESS_DENIED       — not a member of this org
// 403 INSUFFICIENT_ROLE       — authenticated but wrong role
// 403 2FA_REQUIRED            — TOTP window expired for SUPER_ADMIN op
// 403 DELEGATION_NOT_ACTIVE   — accountant delegation revoked
// 409 DUPLICATE_FILING        — idempotency conflict on (orgId, taxType, period)
// 409 LAST_OWNER              — cannot demote/remove last OWNER
// 422 NRS_SUBMISSION_FAILED   — NRS returned error; circuit may be open
// 429 RATE_LIMITED            — express-rate-limit triggered
// 500 INTERNAL_ERROR          — global error handler catch-all
// 503 NRS_CIRCUIT_OPEN        — NRS unavailable; set DIGITAX_MOCK_MODE=true to unblock
```

### 9A.2 API Versioning

```
/api/v1/  — Stable: auth, filings, dashboard, team, documents, onboarding
/api/v2/  — Ops: /health (public), /metrics (ADMIN), /dlq (ADMIN), /audit (ADMIN)
/api/v3/  — Reserved (P2 roadmap: graph-based query layer)

Policy: v1 routes receive ≥ 6 months notice before sunset.
Version is always in path — never in Accept-Version header.
```

### 9A.3 validate() Middleware — Mandatory on All Mutation Routes (C-34)

```typescript
// Usage: router.post('/route', authenticate, resolveOrgContext, idempotency, validate(MySchema), handler)
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', issues: result.error.issues });
    }
    req.body = result.data; // replace with coerced, typed data
    next();
  };
}
// Never call schema.parse() directly in a route handler (C-34)
```

### 9A.4 Idempotency Middleware — Exactly-Once Operations (C-35)

```typescript
// Client sends: X-Idempotency-Key: <uuid> header on mutation requests
// Backend: check Redis `idem:${key}` — if hit, return cached response immediately
// After handler success: redis.setex(`idem:${key}`, 86_400, JSON.stringify(responseBody))
// Required on: POST filings/nil, filings/vat, filings/wht, payroll/run, payments/initiate
```

---

### 10.1 Event Bus

```typescript
// backend/src/services/eventBus.ts
const bus = new EventEmitter();
bus.setMaxListeners(30);
export const eventBus = bus;
```

### 10.2 Event Flows

```
anomaly.detected →
  1. redis.del(`dashboard:composite:v1:${orgId}:${userId}`)
  2. if severity HIGH|CRITICAL: runTaxHealthSnapshot(orgId, userId)
  3. if severity HIGH|CRITICAL: sendAnomalyNotification(orgId, userId)
  4. await writeAuditEvent(...)

invoice.created (amount >= NRS_STAMP_THRESHOLD) →
  1. Enqueue NRS stamp job to BullMQ (priority: high)
  2. redis.del(`dashboard:composite:v1:${orgId}:${userId}`)

filing.submitted →
  1. await writeAuditEvent(...)
  2. Enqueue receipt PDF generation (priority: normal)
  3. sendFilingConfirmation(orgId, filing)
  4. Update SMERiskRecord.filingScore

nrs.circuitOpened →
  1. logger.warn + Sentry alert
  2. Enqueue retry at circuit half-open (30min)
  3. Notify ADMIN via push + Slack webhook

payment.completed →
  1. Verify HMAC (Flutterwave rawBody)
  2. Update SubscriptionPlan.status
  3. await writeAuditEvent(action: 'PAYMENT_RECEIVED')
  4. Unlock premium features for orgId
```

### 10.3 BullMQ Queue Configuration

```
Queue: 'nrs-stamp'       priority: high   — blocks filing completion
Queue: 'notifications'   priority: normal
Queue: 'pdf-generation'  priority: low
Queue: 'analytics'       priority: low
DLQ: job failing 3 attempts → DLQJob model → admin alert if depth > 10
Retry: exponential backoff 1s → 10s → 60s
```

### 10.4 Error Handling Standards

**API error response shape — always:**
```typescript
interface ApiError {
  error:   string;  // machine-readable: 'ORG_ACCESS_DENIED'
  message: string;  // human-readable: 'You do not have access to this organisation'
  code?:   number;
}
// ✅ res.status(403).json({ error: 'ORG_ACCESS_DENIED', message: '...' })
// ❌ res.status(403).json('Forbidden')
```

**FALLBACK_* constants — define at top of dashboardService.ts:**
```typescript
const FALLBACK_STATS:      DashboardStats    = { taxHealthScore: 0, userName: '', vatLiability: 0, trend: [], outstandingPAYE: 0, unfiledPeriods: 0 };
const FALLBACK_ANOMALIES:  AnomalySignal[]   = [];
const FALLBACK_DEADLINES:  ComplianceEvent[] = [];
const FALLBACK_NRS_HEALTH: NrsHealth         = { circuitState: 'open', lastSuccessAt: null, pendingJobs: 0 };
// Any .catch() must return FALLBACK_* + Sentry.captureException + logger.error
```

**Global error handler (last middleware in app.ts):**
```typescript
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  Sentry.captureException(err);
  logger.error({ err, route: req.path, orgId: (req as any).orgContext?.orgId }, 'Unhandled error');
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please retry.' });
});
```

---

## 11. NIGERIAN SME WORKFLOW OPTIMIZATION

### 11.1 Core Tax Workflows — All Reachable in ≤ 2 Taps from Dashboard

**VAT Monthly Filing (MOD-22)**
```
Wizard steps:
  1. Period selection (auto-selects last unfiled month)
  2. Output VAT: pulled from NRS-stamped invoices for period
  3. Input VAT: pulled from receipted expenses
  4. Prior-period credit: read from VATCreditBalance (C-22 — never recomputed)
  5. Net calculation via calculateVAT from @taxbridge/contracts
  6. Net > 0: Flutterwave remittance + NRS submission → IRN
  7. Net < 0: credit carryforward → VATCreditBalance persist
  8. Filing artifact: PDF stored in Document Vault

NIL condition: no invoices AND no expenses → auto-suggest NIL return
Deadline: "Due {{date}} — {{daysRemaining}} days" + red badge ≤ 5 days
```

**WHT Remittance (MOD-23)**
```
Rate display: 10% amber | 5% blue | 4% green
Warn: professional fee at 5% → inline warning (should be 10%)
Exemption: C-23 — both TIN + ≤₦2M required simultaneously
Deadline: 21st of following month
```

**PAYE Payroll (MOD-25)**
```
Per employee: calculatePIT({ grossIncome, rentPaid, pension }) from @taxbridge/contracts
Accuracy gate: ₦5M + ₦600k + ₦200k → ₦632,400 ±₦1
Batch: total PAYE summed → NRS submission → Flutterwave bulk payout
```

**NIL Return (MOD-21)**
```
NilReason enum (UI display):
  NO_REVENUE_THIS_PERIOD       → "No revenue this period"
  BUSINESS_INACTIVE            → "Business temporarily inactive"
  EXEMPT_SUPPLY_ONLY           → "Exempt supply only"
  BELOW_REGISTRATION_THRESHOLD → "Below registration threshold"

Idempotency: 409 if same (orgId, taxType, period) already filed
Penalty warning: displayed if late — same schedule as substantive filing
```

### 11.2 Compliance Calendar (Multi-Deadline)

```typescript
const COMPLIANCE_EVENTS = [
  { type: 'VAT',  label: 'VAT Return',       deadline: '21st of each month' },
  { type: 'WHT',  label: 'WHT Remittance',   deadline: '21st of each month' },
  { type: 'PAYE', label: 'PAYE Filing',       deadline: '10 working days after month-end' },
  { type: 'CIT',  label: 'CIT Assessment',    deadline: '6 months after year-end' },
  { type: 'PIT',  label: 'Annual PIT Return', deadline: '90 days after year-end' },
];
// 0-3 days = RED | 4-7 days = AMBER | 8-14 days = YELLOW | 15+ = GREEN
// Each deadline: "File Now" CTA → routes to wizard
// Overdue: show formatNGN(calculatePenalty(...).netPenalty) estimate
```

### 11.3 Offline Resilience

```
Tax rates (constants.ts):  bundled — always available
EXPLAIN_COPY:              bundled — always available
Draft filings:             AsyncStorage — queued for sync on reconnect
Dashboard data:            React Query cache (gcTime: 5min) — stale + offline banner
Invoice list:              AsyncStorage + last-sync timestamp
NRS stamp:                 BullMQ retry queue on backend — mobile shows "pending"

OfflineSyncStatus (AMBIENT zone):
  EN:     "You're offline — showing cached data"
  Pidgin: "Network no dey — we dey show you wetin we save"
```

---

## 11A. AI INTELLIGENCE PIPELINE

### 11A.1 IntelligenceInput — Canonical Data Contract

```typescript
// packages/contracts/src/types.ts — shared by anomalyEngine + riskScoring
interface IntelligenceInput {
  orgId:          string;
  filingHistory:  { taxType: string; period: string; daysLate: number; isNil: boolean }[];
  invoiceStats:   { unstampedCount: number; totalValue: number; oldestUnstampedDays: number };
  vatPosition:    { outputVAT: number; inputVAT: number; creditBalance: number };
  authEvents:     { failedAttempts: number; uniqueIPs: number; windowHours: number };
  payrollGrowth:  { headcount: number; priorMonthHeadcount: number; payrollChange: number };
}
// Built by buildIntelligenceInput(orgId, prisma) in dashboardService.ts
// Consumed by: computeAnomalies(), computeRiskScore(), and admin analytics panels
```

### 11A.2 Anomaly Engine — 7 Signals

```typescript
// backend/src/services/anomalyEngine.ts
// Pure function — no HTTP, no event bus, no side effects
// Fail-safe: wrapped in try/catch → on throw, return [] + Sentry.captureException + logger.error
```

| Signal | Condition | Severity | CTA Route |
|---|---|---|---|
| `vat_gap` | outputVAT > 0 AND no VAT filing in current period | high | `/filings/vat` |
| `nrs_stamp_delay` | unstampedCount > 0 AND oldestUnstampedDays > 7 | medium | `/invoices` |
| `auth_failure_flood` | failedAttempts > 10 within 1h per IP | critical | `/team` |
| `nil_overuse` | isNil count ≥ 3 consecutive periods | medium | `/filings/vat` |
| `payroll_spike` | payrollChange > 50% month-on-month | medium | `/filings/paye` |
| `unfiled_period` | any taxType with period gap > 30 days | high | filing wizard |
| `vat_credit_aging` | creditBalance > 0 AND usedInPeriod null > 90 days | low | `/compliance/vat-credit` |

Hard cap: `return signals.slice(0, 5)` — never surface more than 5 anomalies to the dashboard.

Every `AnomalySignal.description` is an i18n key (bilingual EN + Pidgin), not inline text. Cites the specific data point that triggered it (e.g. "3 unstamped invoices — oldest 9 days").

### 11A.3 Risk Scoring Engine — 5-Component Score

```typescript
// backend/src/services/riskScoring.ts
// Called by: riskScoringCron (daily 04:00 WAT) + filing.submitted event
// Output: upserted to SMERiskRecord; consumed by TaxHealthGauge (taxHealthScore) + admin analytics
// Score components: filingScore(0-30) + anomalyScore(0-25) + healthScore(0-25)
//                   + vatScore(0-10) + dataScore(0-10) = total 0-100
// Bands: ≥80=healthy | ≥60=low | ≥40=medium | ≥20=high | <20=critical
// ENFORCE: score = Math.max(0, Math.min(100, computedTotal)) before any DB write
```

### 11A.4 ExplainMyTax — 7 Bundled Concepts (Offline-Safe)

```typescript
// mobile/src/components/education/ExplainMyTax.tsx
// Content bundled in mobile app — zero API calls, works on 2G and offline
// 7 keys: vat, wht, paye, nil_return, tin, cit, penalty
// Each entry: { en: string, pidgin: string, example: string }
// Pidgin must be natural Lagos Pidgin — not literal translation
// Component: <ExplainMyTax concept="wht" /> → toggleable inline card EN/Pidgin
```

---

### 12.1 Animation Vocabulary (CREATE FIRST)

```typescript
// mobile/src/design-system/animation.ts
export const DURATION = {
  instant:    100,
  fast:       200,
  standard:   400,
  deliberate: 600,
  slow:       800,
  skeleton:   1200, // shimmer — DO NOT CHANGE
} as const;

export const EASE = {
  enter:     Easing.out(Easing.cubic),
  exit:      Easing.in(Easing.cubic),
  gauge:     Easing.bezier(0.25, 0.46, 0.45, 0.94),
  urgent:    Easing.bezier(0.36, 0.07, 0.19, 0.97),
  shimmer:   Easing.linear,
  celebrate: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export const ENTER_FROM = {
  below: { translateY: 12, opacity: 0 },
  scale: { scale: 0.92, opacity: 0 },
  above: { translateY: -8, opacity: 0 },
  fade:  { opacity: 0 },
} as const;

export const ZONE_DELAY = {
  apex:    0,
  signal:  80,
  action:  160,
  context: 240,  // overridden to 0 when urgent=true
  ambient: 320,
} as const;
```

### 12.2 DashboardZone Component

```typescript
// Exhaustive useEffect deps — no stale closures
export function DashboardZone({ zone, visible, urgent = false, children }: DashboardZoneProps) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(ENTER_FROM.below.translateY);
  const scale      = useSharedValue(zone === 'apex' ? ENTER_FROM.scale.scale : 1);
  const delay      = urgent && zone === 'context' ? 0 : ZONE_DELAY[zone];

  useEffect(() => {
    if (!visible) return;
    const cfg = { duration: DURATION.standard, easing: EASE.enter };
    opacity.value    = withDelay(delay, withTiming(1, cfg));
    if (zone === 'apex')          scale.value      = withDelay(delay, withTiming(1, cfg));
    else if (zone !== 'ambient')  translateY.value = withDelay(delay, withTiming(0, cfg));
  }, [visible, delay, zone, opacity, scale, translateY]);

  const animStyle = useAnimatedStyle(() => {
    if (zone === 'apex')    return { opacity: opacity.value, transform: [{ scale: scale.value }] };
    if (zone === 'ambient') return { opacity: opacity.value };
    return { opacity: opacity.value, transform: [{ translateY: translateY.value }] };
  });
  return <Animated.View style={animStyle}>{children}</Animated.View>;
}
```

### 12.3 DashboardSkeleton — 0px Layout Shift Contract

| Zone | Block Specification |
|---|---|
| `apex` | 200×110px semicircle + 60%×24px greeting |
| `signal` | 3× (31% × 72px), row, 8px gap |
| `action` | 6× (30% × 64px), flex-wrap 3-col, 6px gap |
| `context` | 40%×14px header + 2× (100%×52px), 8px gap |
| `ambient` | 2× (48% × 80px), row, 8px gap |

```typescript
// shimmer: withRepeat(withTiming(1, { duration: DURATION.skeleton, easing: EASE.shimmer }), -1, true)
// color:   interpolateColor(shimmer.value, [0,1], isDark ? ['#1F2937','#374151'] : ['#F3F4F6','#E5E7EB'])
// all blocks: accessibilityElementsHidden={true}
```

### 12.4 TaxHealthGauge SVG Arc

```typescript
function buildArcPath(score: number, size: number): string {
  'worklet'; // MUST be first line
  const r = size * 0.4; const cx = size / 2; const cy = size / 2;
  const deg = -205 + 230 * (score / 100);
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(-205)); const y1 = cy + r * Math.sin(toRad(-205));
  const x2 = cx + r * Math.cos(toRad(deg));  const y2 = cy + r * Math.sin(toRad(deg));
  return `M ${x1} ${y1} A ${r} ${r} 0 ${230 * (score / 100) > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

function scoreToStroke(score: number): string {
  'worklet'; // MUST be first line
  if (score >= 75) return '#1DB954';
  if (score >= 50) return '#F59E0B';
  return '#DC2626';
}
// Animate: withTiming(score, { duration: DURATION.slow, easing: EASE.gauge })
// Modes:   expanded=200px centered | compact=120px right-aligned
// Compact trigger: any upcomingDeadline.daysRemaining ≤ 7 OR < 0
// accessibilityRole="progressbar" + accessibilityLabel required
```

### 12.5 Canonical DashboardScreen Structure

```typescript
// DO NOT DEVIATE — enforced by C-17, C-18, C-19, C-20
const { data, isLoading, isRefetching, error, refetch } = useDashboard();
const gaugeMode      = useMemo(() => computeGaugeMode(data), [data]);
const hasHighAnomaly = useMemo(
  () => data?.topAnomalies?.some(a => ['high','critical'].includes(a.severity)) ?? false,
  [data],
);
const handleRefetch  = useCallback(() => refetch(), [refetch]);

if (isLoading && !data) return <DashboardSkeleton />;

return (
  <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefetch} />}>
    <DashboardZone zone="apex" visible={!isLoading}>
      <Greeting userName={data?.stats.userName} />
      <TaxHealthGauge score={data?.stats.taxHealthScore ?? 0} mode={gaugeMode} />
      {gaugeMode === 'compact' && <UrgentDeadlineCard deadline={data?.upcomingDeadlines?.[0]} />}
    </DashboardZone>

    <DashboardZone zone="signal" visible={!isLoading}>
      <MetricsRow cards={computeMetricCards(data)} />
    </DashboardZone>

    <DashboardZone zone="action" visible={!isLoading}>
      <QuickActionsGrid actions={computeQuickActions(data)} />
    </DashboardZone>

    <DashboardZone zone="context" visible={!isLoading} urgent={hasHighAnomaly}>
      <SectionState data={data?.topAnomalies} isLoading={isLoading} error={error}
        isEmpty={(d) => d.length === 0}
        loading={<SectionSkeletonRows count={2} />}
        empty={null}  {/* C-19: NEVER show "no anomalies" text */}
        errorView={<InlineError icon="🔍" message={t('dashboard.anomaliesLoadError')} onAction={handleRefetch} />}
      >{(a) => <TopAnomaliesSection anomalies={a} />}</SectionState>
      <SectionState data={data?.upcomingDeadlines} isLoading={isLoading} error={error}
        isEmpty={(d) => d.length === 0}
        loading={<SectionSkeletonRows count={1} />}
        empty={null}
        errorView={<InlineError icon="📅" message={t('dashboard.calendarLoadError')} onAction={handleRefetch} />}
      >{(d) => <ComplianceCalendar deadlines={d} />}</SectionState>
    </DashboardZone>

    <DashboardZone zone="ambient" visible={!isLoading}>
      <SectionState data={data?.stats.trend} isLoading={isLoading} error={error}
        isEmpty={(d) => !d?.length}
        loading={<SectionSkeletonRows count={1} />}
        empty={null}
        errorView={<InlineError icon="📈" message={t('dashboard.chartsLoadError')} onAction={handleRefetch} />}
      >{(trend) => <TrendCharts data={trend} />}</SectionState>
      <OfflineSyncStatus />
    </DashboardZone>
  </ScrollView>
);
```

### 12.6 Quick Actions — Context-Aware Sort

```typescript
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'vat-filing',   label: 'File VAT',    pidgin: 'Pay VAT',      icon: '📋', route: '/filings/vat' },
  { id: 'wht-remit',    label: 'Remit WHT',   pidgin: 'Pay WHT',      icon: '🏛️', route: '/filings/wht' },
  { id: 'paye-payroll', label: 'Run PAYE',    pidgin: 'Pay Workers',  icon: '👥', route: '/filings/paye' },
  { id: 'add-expense',  label: 'Add Expense', pidgin: 'Add Expense',  icon: '➕', route: '/expenses/new' },
  { id: 'nrs-invoice',  label: 'New Invoice', pidgin: 'New Invoice',  icon: '📄', route: '/invoices/new' },
  { id: 'tax-report',   label: 'Tax Report',  pidgin: 'See Report',   icon: '📊', route: '/reports' },
];
// computeQuickActions(data): urgent (deadline ≤7 days or payroll due) floats to top
```

### 12.7 Progressive Disclosure Architecture

```
ABOVE FOLD  (0–812px):    Gauge, greeting, VAT liability if > ₦0, deadline if ≤14 days
                          HIGH anomaly → promoted above fold | Overdue → compact gauge
FIRST SCROLL (812px+):   Quick Actions | Anomalies (≥1, severity ≥ medium)
                          Compliance Calendar strip
SECOND SCROLL (1600px+): Trend sparklines | OfflineSyncStatus
```

### 12.8 Haptic Feedback

```typescript
import * as Haptics from 'expo-haptics';
// Tap:     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
// Success: Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
// Error:   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
// Warning: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
// Fire BEFORE any await — visual + haptic ack within DURATION.instant (100ms)
```

### 12.9 Micro-UX Standards

**Loading hierarchy:** DashboardSkeleton (initial) → SectionSkeletonRows (partial) → inline CTA spinner (submit). Never `<ActivityIndicator />` in place of content.

**Empty states:** Always icon + heading + body + CTA button. Exception: anomaly section → `empty={null}` (C-19).

**Error states:** Always icon + message + retry tap. Single tap → clear error → refetch → optimistic loading.

**Pressable feedback:** `transform: [{ scale: 0.97 }], opacity: 0.85` on press. Required on all interactive elements.

**Toast pattern:** Success = 3s auto-dismiss green. Error = 6s dismissible red. Never `Alert.alert()` for business logic.

**Keyboard avoiding:** All filing wizards: `KeyboardAvoidingView + ScrollView keyboardShouldPersistTaps="handled"`.

**Accessibility (WCAG 2.2 AA):** Minimum 44×44px touch targets. 4.5:1 contrast for normal text. `accessibilityLabel + accessibilityRole + accessibilityHint` on all interactive elements.

---

## 13. COMPOSITE DASHBOARD API

```typescript
// GET /api/v1/dashboard
// Cache: Redis key `dashboard:composite:v1:${orgId}:${userId}` TTL 120s
// Invalidated by: new invoice, new expense, NRS status change, anomaly.detected

// packages/contracts/src/types.ts — single source of truth for all interfaces

interface DashboardStats {
  taxHealthScore:  number;      // 0–100
  userName:        string;
  vatLiability:    number;      // NGN
  trend:           TrendPoint[];
  outstandingPAYE: number;
  unfiledPeriods:  number;
}

interface TrendPoint    { period: string; score: number; label: string; }
interface AnomalySignal { id: string; signal: string; severity: 'low'|'medium'|'high'|'critical'; description: string; detectedAt: string; ctaRoute?: string; }
interface ComplianceEvent { type: 'VAT'|'WHT'|'PAYE'|'CIT'|'PIT'; label: string; deadline: string; daysRemaining: number; penaltyEstimate?: number; }
interface NrsHealth     { circuitState: 'closed'|'half-open'|'open'; lastSuccessAt: string | null; pendingJobs: number; }

interface DashboardComposite {
  stats:             DashboardStats;
  topAnomalies:      AnomalySignal[];   // max 3, severity ≥ medium
  upcomingDeadlines: ComplianceEvent[]; // sorted by daysRemaining ASC
  nrsHealth:         NrsHealth;
  meta:              { cached: boolean; cacheAge?: number };
}

// Implementation:
// const [stats, anomalies, deadlines, nrs] = await Promise.all([...])
// each .catch: Sentry.captureException + logger.error + return FALLBACK_*
// Cache write: non-blocking fire-and-forget .catch()
```

---

## 14. PRISMA SCHEMA — V12 ADDITIONS

### 14.1 New Enums

```prisma
enum UserRole    { SUPER_ADMIN ADMIN OWNER ACCOUNTANT EMPLOYEE VIEWER }
enum NilReason   { NO_REVENUE_THIS_PERIOD BUSINESS_INACTIVE EXEMPT_SUPPLY_ONLY BELOW_REGISTRATION_THRESHOLD }
enum AuditAction { CREATE UPDATE DELETE FILE AMEND APPROVE OVERRIDE REVOKE INVITE EXPORT
                   ACCESS_DENIED ROLE_CHANGE LOGIN LOGOUT NRS_STAMP PAYMENT_RECEIVED }
enum RiskBand    { critical high medium low healthy }
enum OrgStatus   { active suspended pending_verification }
```

### 14.2 Multi-Tenant Org Model

```prisma
model Organisation {
  id          String    @id @default(cuid())
  name        String
  tinNumber   String    @unique
  cacRcNumber String?
  status      OrgStatus @default(pending_verification)
  plan        String    @default("free")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  members     OrgMember[]
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
```

### 14.3 V12 Models

```prisma
model TaxReturn {
  id              String     @id @default(cuid())
  orgId           String
  taxType         String
  period          String
  status          String
  filingReference String     @unique
  isNil           Boolean    @default(false)
  nilReason       NilReason?
  taxAmountDue    Float      @default(0)
  receiptUrl      String?
  amendedReturnId String?
  submittedAt     DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  @@unique([orgId, taxType, period])
  @@index([orgId, status, period])
}

model AccountantClient {
  id           String    @id @default(cuid())
  accountantId String
  clientOrgId  String
  permissions  Json
  grantedBy    String
  grantedAt    DateTime  @default(now())
  revokedAt    DateTime?
  @@unique([accountantId, clientOrgId])
  @@index([accountantId, revokedAt])
  @@index([clientOrgId, revokedAt])
}

model VATCreditBalance {
  id                String    @id @default(cuid())
  orgId             String
  period            String
  inputVAT          Float
  outputVAT         Float
  netCredit         Float
  carriedFromPeriod String?
  usedInPeriod      String?
  refundClaimed     Boolean   @default(false)
  refundClaimDate   DateTime?
  createdAt         DateTime  @default(now())
  @@index([orgId, period])
  @@index([orgId, refundClaimed])
}

model TaxLossCarryforward {
  id            String   @id @default(cuid())
  orgId         String
  taxYear       Int
  lossAmount    Float
  usedAmount    Float    @default(0)
  remainingLoss Float
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([orgId, taxYear])
}

model SMERiskRecord {
  id           String   @id @default(cuid())
  orgId        String   @unique
  score        Int
  band         RiskBand
  filingScore  Int
  anomalyScore Int
  healthScore  Int
  vatScore     Int
  dataScore    Int
  computedAt   DateTime @updatedAt  // auto-updates on upsert
  createdAt    DateTime @default(now())
  @@index([band, computedAt])
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
  // NO updatedAt — immutability contract
  @@index([orgId, createdAt])
  @@index([actorId, createdAt])
  @@index([targetType, targetId])
  @@index([action, createdAt])
}

model DLQJob {
  id          String    @id @default(cuid())
  queueName   String
  jobId       String
  payload     Json
  failReason  String
  attempts    Int
  lastAttempt DateTime
  resolved    Boolean   @default(false)
  resolvedAt  DateTime?
  createdAt   DateTime  @default(now())
  @@index([queueName, resolved, createdAt])
}

model OnboardingProgress {
  id                   String    @id @default(cuid())
  orgId                String    @unique
  currentStep          Int       @default(1)
  completed            Boolean   @default(false)
  skippedNRS           Boolean   @default(false)
  tinVerified          Boolean   @default(false)
  cacVerified          Boolean   @default(false)
  selectedObligations  String[]  @default([])
  completedAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
}

model UserSession {
  id          String   @id @default(cuid())
  userId      String
  tokenHash   String   @unique
  roleVersion Int
  device      String?
  ipAddress   String?
  lastSeen    DateTime @default(now())
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  @@index([userId, expiresAt])
}

model TaxHealthSnapshot {
  id        String   @id @default(cuid())
  orgId     String
  userId    String
  score     Int
  period    String   // YYYY-MM — written by taxHealthSnapshot cron every 6h
  band      RiskBand
  createdAt DateTime @default(now())
  // NO updatedAt — insert-only; used for trend sparklines in DashboardStats.trend[]
  @@index([orgId, userId, period])
  @@index([orgId, createdAt])
}
// ADDITIONAL PERFORMANCE INDEXES — add to existing models:
// TaxReturn:        @@index([orgId, taxType, submittedAt])         ← admin analytics
// AuditEvent:       @@index([orgId, action, createdAt])            ← compliance export
// VATCreditBalance: @@index([orgId, usedInPeriod, refundClaimed])  ← carryforward lookup
// SMERiskRecord:    @@index([band, computedAt]), @@index([score])  ← risk dashboard
// UserSession:      @@index([expiresAt])                           ← cleanup cron sweep
```

### 14.4 Zero-Downtime Migration Pattern

```bash
# Step 1: Nullable columns (backward-compatible)
npx prisma migrate dev --name "v12_step1_nullable"
# Step 2: Deploy code handling both old + new schema
# Step 3: Backfill via BullMQ background job
yarn workspace backend ts-node scripts/backfill-v12.ts
# Step 4: NOT NULL + indexes
npx prisma migrate dev --name "v12_step2_constraints"
# Production CI/CD only: npx prisma migrate deploy
# ⚠️ Never run between 08:00–20:00 WAT
# Never use prisma migrate rollback in production — forward migrations only
```

---

## 15. INFRASTRUCTURE AS CODE

### 15.1 render.yaml

```yaml
services:
  - type: web
    name: taxbridge-api
    runtime: node
    region: frankfurt  # benchmark vs ohio for Nigerian latency
    plan: starter
    buildCommand: yarn workspace backend build
    startCommand: node backend/dist/app.js
    healthCheckPath: /api/v2/monitoring/health
    logDrain:
      destination: "https://logs.grafana.net/loki/api/v1/push"
    envVars:
      - { key: NODE_ENV,            value: production }
      - { key: PORT,                value: 10000 }
      - { key: LOG_LEVEL,           value: info }
      - { key: LOG_FORMAT,          value: json }
      - { key: DATABASE_URL,        fromDatabase: { name: taxbridge-db, property: connectionString } }
      - { key: REDIS_URL,           fromService: { name: taxbridge-redis, type: redis, property: connectionString } }
      - { key: RENDER_EXTERNAL_URL, fromService: { name: taxbridge-api, type: web, property: host } }
      - { key: JWT_SECRET,          sync: false }
      - { key: JWT_REFRESH_SECRET,  sync: false }
      - { key: NRS_API_KEY,         sync: false }
      - { key: FLUTTERWAVE_SECRET,  sync: false }
      - { key: SENTRY_DSN,          sync: false }
      - { key: CBN_MPR,             sync: false }
      - { key: CORS_ORIGIN,         sync: false }
      - { key: DOCUMENT_VAULT_KMS_PROVIDER, sync: false }

  - type: redis
    name: taxbridge-redis
    plan: free
    maxmemoryPolicy: allkeys-lru

databases:
  - name: taxbridge-db
    plan: free
    databaseName: taxbridge
    user: taxbridge
```

### 15.2 eas.json

```json
{
  "cli": { "version": ">= 7.0.0", "requireCommit": true },
  "build": {
    "base": { "env": { "EXPO_PUBLIC_APP_VERSION": "12.0.0" } },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk", "compileSdkVersion": 36, "targetSdkVersion": 35 },
      "env": { "EXPO_PUBLIC_API_URL": "http://localhost:3000", "DIGITAX_MOCK_MODE": "true" }
    },
    "staging": {
      "extends": "base",
      "distribution": "internal",
      "android": { "buildType": "apk", "compileSdkVersion": 36, "targetSdkVersion": 35 },
      "cache": { "key": "taxbridge-v12-staging-{{ hashFiles('yarn.lock') }}" },
      "env": { "EXPO_PUBLIC_API_URL": "https://taxbridge-api-ker8.onrender.com", "SENTRY_DSN": "SET_VIA_EAS_SECRET" }
    },
    "production": {
      "extends": "base",
      "distribution": "store",
      "autoIncrement": true,
      "android": { "buildType": "app-bundle", "compileSdkVersion": 36, "targetSdkVersion": 35 },
      "ios": { "buildConfiguration": "Release" },
      "cache": { "key": "taxbridge-v12-prod-{{ hashFiles('yarn.lock') }}" },
      "env": { "EXPO_PUBLIC_API_URL": "https://taxbridge-api-ker8.onrender.com", "SENTRY_DSN": "SET_VIA_EAS_SECRET" }
    }
  },
  "submit": {
    "production": {
      "android": { "serviceAccountKeyPath": "./infra/google-play-service-account.json", "track": "internal" },
      "ios": { "appleId": "REPLACE", "ascAppId": "REPLACE" }
    }
  }
}
// SENTRY_DSN set via: eas secret:create --scope project --name SENTRY_DSN --value <dsn>
// C-33 gate: grep '"SENTRY_DSN": "REPLACE' mobile/eas.json → 0
```

### 15.3 validateEnv.ts — First Import in app.ts

```typescript
const REQUIRED_ALWAYS = [
  'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET',
  'NRS_API_KEY', 'PORT', 'NODE_ENV',
];
const REQUIRED_PRODUCTION = [
  'SENTRY_DSN', 'RENDER_EXTERNAL_URL', 'FLUTTERWAVE_SECRET',
  'CBN_MPR', 'CORS_ORIGIN', 'DOCUMENT_VAULT_KMS_PROVIDER',
];
const missing = [
  ...REQUIRED_ALWAYS,
  ...(process.env.NODE_ENV === 'production' ? REQUIRED_PRODUCTION : []),
].filter(v => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`❌ MISSING ENV VARS: ${missing.join(', ')}\nApp cannot start.`);
}
```

---

## 16. CI/CD ENFORCEMENT GATES

### 16.1 Five-Stage Pipeline (.github/workflows/pipeline.yml)

**Stage 1 — Quality Gates (parallel, blocks all downstream)**
```yaml
gates:
  - yarn workspaces foreach -A run lint
  - yarn workspaces foreach -A run type-check
  - grep -rn "FIRS" . | grep -v node_modules                                               # → 0
  - grep -rn "withTiming.*[0-9]{3,4}" mobile/src | grep -v animation.ts                   # → 0
  - grep -rn "CRA\b|consolidatedRelief|minTax" packages/contracts/src                      # → 0
  - grep -rn "console\.log" backend/src                                                    # → 0
  - grep -rn "0\.2725\b" packages/contracts/src backend/src                                # → 0
  - grep '"compileSdkVersion": 36' mobile/eas.json | wc -l                                # → 3
  - grep '"SENTRY_DSN": "REPLACE' mobile/eas.json                                         # → 0 (C-33)
  - grep -rn "schema\.parse(" backend/src/routes --include="*.ts"                         # → 0 (C-34: use validate() middleware)
  - yarn i18n:check
  - yarn prompts:verify
  - npx ts-node -e "const {calculatePIT}=require('./packages/contracts/src');const r=calculatePIT({grossIncome:5000000,rentPaid:600000,pension:200000});if(Math.abs(r.taxLiability-632400)>1)process.exit(1)"
  - npx ts-node -e "const {calculatePenalty}=require('./packages/contracts/src');const r=calculatePenalty({entityType:'company',daysLate:32,taxAmountDue:0,disclosurePhase:'after_assessment'});if(r.netPenalty!==375000)process.exit(1)"
```

**Stage 2 — Tests (requires Stage 1)**
```yaml
services: [postgres:16-alpine, redis:7-alpine]
steps:
  - npx prisma migrate deploy
  - yarn workspace backend ts-node backend/prisma/seeds/smokeTestUser.ts
  - yarn workspaces foreach -A run test -- --coverage --ci --runInBand
  - npx nyc check-coverage --lines 95 --functions 95 --branches 90
```

**Stage 3 — Security (parallel with Stage 2)**
```yaml
steps:
  - npx snyk test --all-projects --severity-threshold=high
  - head -5 backend/src/app.ts | grep -q "validateEnv"
  - git ls-files | grep -E '\.env\.' | grep -v example                                    # → 0
  - awk '/^model AuditEvent/,/^}/' backend/prisma/schema.prisma | grep -q "updatedAt" && exit 1 || exit 0
  - awk '/^model TaxHealthSnapshot/,/^}/' backend/prisma/schema.prisma | grep -q "updatedAt" && exit 1 || exit 0
  - grep -q '@@unique(\[orgId, userId\])' backend/prisma/schema.prisma
  - grep -rn "0\.2725\b" backend/src packages/contracts/src                                # → 0
  - grep -rn "schema\.parse(" backend/src/routes --include="*.ts"                         # → 0 (C-34)
  - grep -q "opossum" backend/src/services/nrsService.ts                                  # circuit breaker present
```

**Stage 4 — Builds (requires Stages 2 + 3)**
```yaml
build-backend: yarn workspace backend build
build-admin:   yarn workspace admin build
build-mobile:  eas build --platform android --profile staging --non-interactive
```

**Stage 5 — Deploy + Smoke (requires Stage 4, main branch only)**
```yaml
deploy-backend:
  - Validate all production secrets present (CBN_MPR required)
  - Deploy to green slot (Render blue-green)
  - Health check green: GET /api/v2/monitoring/health → {"status":"healthy"}
  - Canary 5% → monitor 2min (error rate < 0.5%) → rollback if > 1%
  - Canary 25% → monitor 3min
  - Swap green → production 100%
  - Rollback trigger: error rate > 1% at any stage → swap back immediately

smoke-test:
  - GET  /api/v2/monitoring/health                → {"status":"healthy"}
  - POST /api/v1/auth/login (smoke credentials)  → accessToken present
  - GET  /api/v1/dashboard                       → stats.taxHealthScore is integer
  - POST /api/v1/filings/nil                     → 200 + filingReference
  - GET  /api/v1/compliance/penalty-estimate     → netPenalty is number
  - VIEWER role → PATCH /api/v2/rbac/assign      → 403
  - Admin panel GET taxbridge.vercel.app         → HTTP 200

release (idempotent):
  - git tag v12.0.0 2>/dev/null || echo "tag exists"
  - gh release create v12.0.0 --skip-if-exists
```

### 16.2 Husky Pre-Commit Gates

```bash
#!/usr/bin/env sh
set -e; FAIL=0
check() {
  local count=$(grep -rn "$1" $2 --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | wc -l)
  [ "$count" -gt "0" ] && echo "❌ $3 ($count occurrences)" && FAIL=1
}
check "FIRS"         "backend/src mobile/src admin/src packages" "FIRS found — use NRS (C-02)"
check "NRSt"         "mobile/src/i18n"                           "NRSt typo — use NRS"
check "console\.log" "backend/src"                               "console.log in backend — use Pino (C-26)"

RAW_ANIM=$(grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "animation.ts" | wc -l)
[ "$RAW_ANIM" -gt "0" ] && echo "❌ Raw animation durations — use DURATION.* (C-16)" && FAIL=1

[ "$FAIL" -eq "1" ] && exit 1
echo "✅ Pre-commit gates passed"
npx lint-staged
```

---

## 17. OBSERVABILITY

### 17.1 prom-client Singleton

```typescript
// backend/src/metrics.ts
declare global { var __taxbridge_prom_registry: Registry | undefined; }
const register = global.__taxbridge_prom_registry ?? new Registry();
if (!global.__taxbridge_prom_registry) {
  global.__taxbridge_prom_registry = register;
  register.setDefaultLabels({ app: 'taxbridge', version: process.env.npm_package_version ?? '12.0.0' });
}
function safeMetric<T>(factory: () => T, name: string): T {
  return (register.getSingleMetric(name) ?? factory()) as T;
}

export const httpDuration    = safeMetric(() => new Histogram({ name: 'taxbridge_api_request_duration_seconds', labelNames: ['route','method','status'], buckets: [0.05,0.1,0.2,0.5,1,2,5] }), 'taxbridge_api_request_duration_seconds');
export const nrsStampSuccess = safeMetric(() => new Counter({ name: 'taxbridge_nrs_stamp_success_total', labelNames: ['orgId'] }), 'taxbridge_nrs_stamp_success_total');
export const nrsStampFailure = safeMetric(() => new Counter({ name: 'taxbridge_nrs_stamp_failure_total', labelNames: ['reason'] }), 'taxbridge_nrs_stamp_failure_total');
export const anomalyDetected = safeMetric(() => new Counter({ name: 'taxbridge_anomaly_detected_total', labelNames: ['signal','severity'] }), 'taxbridge_anomaly_detected_total');
export const dlqDepth        = safeMetric(() => new Gauge({ name: 'taxbridge_dlq_depth', labelNames: ['queue_name'] }), 'taxbridge_dlq_depth');
export const penaltyEstimate = safeMetric(() => new Counter({ name: 'taxbridge_penalty_estimate_total', labelNames: ['taxType'] }), 'taxbridge_penalty_estimate_total');
// 0 = closed (healthy) | 1 = half-open | 2 = open (NRS unreachable)
export const nrsCircuitState = safeMetric(() => new Gauge({ name: 'taxbridge_nrs_circuit_state' }), 'taxbridge_nrs_circuit_state');
// nrsService.ts calls nrsCircuitState.set(0|1|2) on every circuit transition
export { register };
```

### 17.2 Monitoring Endpoints

```
GET /api/v2/monitoring/health  — PUBLIC — {
  status: 'healthy' | 'degraded',
  version, ts, env,
  nrs: { state: 'closed'|'half-open'|'open' },
  db:    { latencyMs: number },    // > 500ms → status becomes 'degraded' (still HTTP 200)
  redis: { latencyMs: number },    // > 500ms → status becomes 'degraded' (still HTTP 200)
}
// NEVER returns 503 from health check — Render blue-green swap uses this endpoint
// 'degraded' is HTTP 200 — allows Render to keep routing traffic while alerting ops

GET /api/v2/monitoring/metrics — ADMIN only — Prometheus text format (register.metrics())
```

### 17.3 Grafana Alert Thresholds

```yaml
- name: API Error Rate
  expr: rate(taxbridge_api_request_duration_seconds_count{status=~"5.."}[5m]) > 0.01
  for: 2m | severity: critical | action: PagerDuty

- name: Dashboard P99 Latency
  expr: histogram_quantile(0.99, taxbridge_api_request_duration_seconds_bucket{route="/api/v1/dashboard"}[5m]) > 2
  for: 5m | severity: warning | action: Slack #ops

- name: DLQ Depth
  expr: sum(taxbridge_dlq_depth) > 10
  for: 15m | severity: warning | action: Slack #ops

- name: Auth Failure Flood
  expr: rate(taxbridge_anomaly_detected_total{signal="auth_failure"}[1m]) > 10
  for: 1m | severity: critical | action: PagerDuty

- name: NRS Circuit Open
  expr: taxbridge_nrs_circuit_state == 2
  for: 5m | severity: critical | action: PagerDuty
```

### 17.4 Cron Orchestrator — All 7 Jobs

```typescript
// backend/src/cron/orchestrator.ts
const CRON_JOBS = [
  { name: 'taxHealthSnapshot',  schedule: '0 */6 * * *',  handler: runTaxHealthSnapshotAll },
  { name: 'riskScoring',        schedule: '0 3 * * *',    handler: runRiskScoringCron },      // 04:00 WAT
  { name: 'nrsQueueDrain',      schedule: '*/30 * * * *', handler: drainNrsQueue },
  { name: 'complianceReminder', schedule: '0 8 * * *',    handler: sendComplianceReminders }, // 09:00 WAT
  { name: 'anomalyDigest',      schedule: '0 7 * * 1',    handler: sendWeeklyAnomalyDigest }, // Mon 08:00 WAT
  { name: 'sessionCleanup',     schedule: '0 1 * * *',    handler: expireOldSessions },       // 02:00 WAT
  { name: 'keepAlive',          schedule: '*/14 * * * *', handler: pingKeepAlive },
];
// No scattered setInterval() calls anywhere else in the codebase
```

### 17.5 Request Logger Middleware

```typescript
app.use((req, res, next) => {
  const startAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startAt) / 1_000_000;
    logger.info({
      method: req.method, route: req.route?.path ?? req.path,
      status: res.statusCode, durationMs: durationMs.toFixed(2),
      orgId: (req as any).orgContext?.orgId, userId: (req as any).user?.id, ip: req.ip,
    }, 'request completed');
  });
  next();
});
```

---

## 18. ROLLBACK MECHANISMS

```bash
# Backend — blue-green swap (60s decision window)
render traffic swap --from prod --to blue --api-key "$RENDER_API_KEY"
# Blue slot: never delete until next successful deploy

# Admin — Vercel
npx vercel rollback --token="$VERCEL_TOKEN" --cwd admin

# Mobile — OTA (JS-only; no native/SDK/schema changes)
eas update --branch production --message "revert: rollback" \
  --git-commit-hash $(git rev-parse HEAD~1)

# Database — NEVER prisma migrate rollback
# Write forward migration to undo change; deploy via prisma migrate deploy

# Decision matrix:
# Error rate > 1%      → blue-green swap within 60s
# P99 latency > 5s     → blue-green swap within 60s
# DB migration panic   → forward migration only
# Mobile crash > 1%    → OTA if JS-only; full EAS build if native change
```

---

## 19. TESTING THRESHOLDS

### 19.1 Coverage Requirements

```
Lines:     ≥ 95% | Functions: ≥ 95% | Branches: ≥ 90%
Passing:   ≥ 550 tests, 0 failures
```

### 19.2 Mandatory Test Cases

```typescript
// packages/contracts/src/penalties.test.ts
// Company, 32d late, ₦0 due → netPenalty === 375,000
// Individual, 1d late, ₦100k, before_audit → netPenalty === 0

// packages/contracts/src/pit.test.ts
// ₦5M + ₦600k rent + ₦200k pension → taxLiability === 632,400 (±₦1)

// backend/src/routes/v1/filings/nil.test.ts
// POST → 200 + filingReference | duplicate → 409 + existing reference
// AuditEvent created: action='FILE', after.isNil=true

// backend/src/middleware/requireRole.test.ts
// VIEWER → admin route → 403 + error:'INSUFFICIENT_ROLE'
// OWNER → owner route → passes

// backend/src/middleware/tenant.test.ts
// orgA user → orgB data → 403 + error:'ORG_ACCESS_DENIED'

// backend/src/services/vatCredit.test.ts
// getVATCreditPosition reads VATCreditBalance from DB — never recomputes (C-22)

// backend/src/routes/v1/dashboard.test.ts
// DB failure → 200 with FALLBACK_* (not 500)
// Cache hit: second call within 120s → meta.cached === true
```

### 19.3 Performance Gates

```
k6/Artillery:
  2000 concurrent × 60s
  GET /api/v1/dashboard P95 < 200ms | P99 < 800ms
  POST /api/v1/filings/nil P95 < 500ms

2G simulation:
  Dashboard initial paint:  < 800ms
  Dashboard data visible:   < 2000ms (RTT 400ms, 750kbps)

Lighthouse (admin):
  Performance ≥ 98 | Accessibility ≥ 98 | Best Practices ≥ 100 | SEO ≥ 90

React Native Profiler:
  Skeleton → content transition: 0 dropped frames, 0px layout shift
  Dashboard zone reveal: ≥ 55fps sustained
```

---

## 20. MODULE CONTEXT LOADING

```typescript
// yarn prompts:verify → "✅ 11/11 modules loaded (M00–M10)"
const TASK_MODULES: Record<string, string[]> = {
  'backend-api':             ['M00', 'M01'],
  'mobile-ui':               ['M00', 'M02', 'M08'],
  'dashboard-ux':            ['M00', 'M02', 'M08'],
  'mobile-enhancements':     ['M00', 'M02', 'M08', 'M09'],
  'ai-features':             ['M00', 'M01', 'M03', 'M05'],
  'nrs-compliance':          ['M00', 'M01', 'M04', 'M05'],
  'compliance-intelligence': ['M00', 'M01', 'M05', 'M10'],
  'devops':                  ['M00', 'M06'],
  'growth':                  ['M00', 'M07'],
  'education':               ['M00', 'M02', 'M09', 'M10'],
  'full-audit':              ['M00','M01','M02','M03','M04','M05','M06','M07','M08','M09','M10'],
};
```

| ID | File | Load When |
|---|---|---|
| M00 | `core/M00-identity-rules.md` | Always |
| M01 | `backend/M01-backend-architecture.md` | API, queues, services |
| M02 | `mobile/M02-mobile-ux.md` | Expo, screens, offline |
| M03 | `ai/M03-ai-intelligence.md` | OCR, anomaly, health score |
| M04 | `payments/M04-payments-compliance.md` | Payments, NRS, USSD |
| M05 | `data/M05-data-tax-engine.md` | NTA 2025, schema, contracts |
| M06 | `devops/M06-deployment-devops.md` | CI/CD, EAS, Render |
| M07 | `monetization/M07-monetization-analytics.md` | Growth, billing |
| M08 | `mobile/M08-dashboard-ux-patterns.md` | Dashboard zones, animation |
| M09 | `mobile/M09-enhancement-integration.md` | TaxAcademy, education |
| M10 | `mobile/M10-compliance-intelligence.md` | Penalty, NIL, RBAC, risk |

---

## 21. WORK QUEUE — SEQUENCED BY DEPENDENCY

### P0 — Blocking Foundation

```
1.  Run 8-step session opening (§3). Gate failure = STOP.
2.  yarn prompts:verify → "11/11 modules"
3.  Fix BUG-S01: @expo-google-fonts/inter + useFonts in App.tsx
4.  Fix BUG-S02: sed -i 's/NRSt/NRS/g' mobile/src/i18n/*.json
5.  Fix BUG-S03/S04: initImmediate: false; add common.offline to both locales
6.  CREATE: mobile/src/design-system/animation.ts (§12.1)
7.  CREATE: mobile/src/design-system/ngn.ts (§1.4)
8.  CREATE: mobile/src/design-system/tokens.ts
9.  CREATE: mobile/src/contexts/ThemeContext.tsx
10. CREATE: mobile/src/components/dashboard/DashboardZone.tsx (§12.2)
11. CREATE: mobile/src/components/dashboard/DashboardSkeleton.tsx (§12.3)
12. REPLACE: TaxHealthGauge → SVG arc (§12.4). Both worklet functions marked 'worklet'.
13. CREATE: mobile/src/components/shared/SectionState.tsx
14. CREATE: mobile/src/components/shared/InlineError.tsx
15. CREATE: packages/contracts/src/types.ts — including IntelligenceInput interface (§11A.1)
16. VERIFY/CREATE: backend/src/validateEnv.ts (§15.3)
17. CREATE: backend/src/middleware/validate.ts (§9A.3, C-34)
18. CREATE: backend/src/middleware/idempotency.ts (§9A.4, C-35)
19. VERIFY/UPDATE: backend/src/app.ts — compression + express.raw order + 0.0.0.0 + PORT
20. VERIFY/CREATE: backend/src/lib/logger.ts
21. VERIFY/CREATE: backend/src/metrics.ts (§17.1)
22. VERIFY/CREATE: backend/src/middleware/requireRole.ts
23. VERIFY/CREATE: backend/src/middleware/tenant.ts
24. VERIFY/CREATE: backend/src/services/audit.ts
25. CREATE: backend/src/services/anomalyEngine.ts — 7 signals, capped 5, fail→[] (§11A.2)
26. CREATE: backend/src/services/riskScoring.ts — 5-component, clamp 0-100 (§11A.3)
27. VERIFY/UPDATE: backend/src/services/nrsService.ts — opossum circuit breaker (§6.8)
28. CREATE: backend/src/services/compliancePreFlight.ts (§6.9)
29. CREATE: backend/src/services/dashboardService.ts (FALLBACK_* on every .catch)
30. CREATE: backend/src/routes/v1/dashboard.ts (Promise.all, Redis 120s TTL)
31. CREATE: backend/src/routes/v1/compliance/preflight.ts
32. CREATE: backend/src/routes/v1/onboarding/progress.ts (PATCH — resume wizard)
33. CREATE: mobile/src/hooks/useDashboard.ts + AppState 'active' invalidation
34. REPLACE: mobile/src/screens/DashboardScreen.tsx → canonical zone structure (§12.5)
35. CREATE: mobile/src/screens/OnboardingWizard.tsx — resilient with AsyncStorage resume (§6.7)
36. VERIFY: POST /api/v1/filings/nil with idempotency middleware (C-21, C-35)
37. VERIFY: prom-client singleton + /api/v2/monitoring/health (db + redis latency in response)
38. VERIFY: resolveOrgContext on all business routes (C-31)
39. UPDATE: backend/prisma/schema.prisma — all enums + models + TaxHealthSnapshot + indexes (§14)
40. RUN: npx prisma migrate dev --name "v12_foundation"
```

### P1 — Sprint 1

```
A. SectionState wrapping all conditional dashboard sections
B. ThemeContext + useTheme() across all components; no raw hex in components
C. TaxHealthSnapshot model + /trends endpoint + sparklines
D. Multi-deadline ComplianceCalendar with "File Now" CTAs
E. computeQuickActions() urgency sort
F. OfflineSyncStatus in AMBIENT zone + NetInfo listener
G. Pidgin natural language pass + i18n:check
H. gaugeMode useMemo + compact/expanded
I. scale(0.97) Pressable on all 6 QuickAction tiles
J. ExplainMyTax — 7 keys, offline-safe, bundled
K. SME risk scoring cron (04:00 WAT daily)
L. @shopify/flash-list — replace ALL FlatList instances
M. Biometric login — expo-local-authentication
N. Haptic feedback on all interactions
```

### P1 — Feature Build

```
MOD-22: VAT filing wizard (IRN + VATCreditBalance carryforward)
MOD-23: WHT remittance (rate decision tree + exemption check)
MOD-25: PAYE payroll (calculatePIT per employee; ₦5M → ₦632,400 gate)
MOD-21: NIL return screen
MOD-26: Document vault (AES-256-GCM, Cloudflare R2, 5yr retention)
MOD-27: Multi-org team management (5 roles, OrgMember)
MOD-40: TaxAcademy Lessons 1–12 + quizzes + Lottie confetti
TIN + CAC onboarding validation routes (§6.7)
```

### P2 — Scale + AI

```
MOD-35: calculateTaxOptimizer() — AI deduction suggestions
MOD-37: Stripe billing (subscription plans, feature gating)
MOD-43: Lottie confetti on milestone events
V12-04: /api/v3 versioned gateway
V12-05: PgBouncer connection pooling
V12-06: BullMQ priority queue separation
V12-07: iOS TestFlight submission
V12-08: Terraform IaC (Render + Cloudflare)
V12-09: Canary rollout automation (5% → 25% → 100%)
```

### P3 — Platform Extension

```
MOD-24: USSD *347*123# (Africa's Talking)
MF-02:  Invoice PDF generation + share link
MF-04:  NDPC §30 data export
MF-05:  CSV bulk expense import
MF-06:  Multi-period tax comparison
```

---

## 22. MEASURABLE ACCEPTANCE CRITERIA

### 22.1 CI Enforcement Gates — All Must Pass Before Merge

```bash
grep -rn "FIRS" . --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules  # → 0
grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src | grep -v animation.ts                           # → 0
grep -rn "CRA\b\|consolidatedRelief\|minTax\|0\.01.*gross\|ETR.*PIT" packages/contracts/src     # → 0
grep -rn "console\.log" backend/src --include="*.ts"                                             # → 0
grep -rn "0\.2725\b" packages/contracts/src backend/src                                          # → 0
grep 'zone="' mobile/src/screens/DashboardScreen.tsx | wc -l                                    # → 5
grep -rn "No anomal\|noAnomal" mobile/src                                                        # → 0
grep -rn "await.*router\|router.*await" mobile/src/screens/DashboardScreen.tsx                  # → 0
grep '"compileSdkVersion": 36' mobile/eas.json | wc -l                                          # → 3
grep '"SENTRY_DSN": "REPLACE' mobile/eas.json                                                   # → 0
grep -rn "schema\.parse(" backend/src/routes --include="*.ts"                                   # → 0 (C-34)
grep -rn "FlatList" mobile/src --include="*.tsx" | grep -v node_modules                         # → 0
yarn prompts:verify                                                                              # → "11/11 modules"
yarn i18n:check                                                                                  # → exit 0
npm test --workspaces -- --coverage                                                              # → ≥ 550 passing, 0 failing
npx nyc check-coverage --lines 95 --functions 95 --branches 90                                  # → pass
npx snyk test --all-projects --severity-threshold=high                                          # → 0 HIGH/CRITICAL
npx ts-node -e "const {calculatePIT}=require('./packages/contracts/src');const r=calculatePIT({grossIncome:5000000,rentPaid:600000,pension:200000});if(Math.abs(r.taxLiability-632400)>1)process.exit(1)"
npx ts-node -e "const {calculatePenalty}=require('./packages/contracts/src');const r=calculatePenalty({entityType:'company',daysLate:32,taxAmountDue:0,disclosurePhase:'after_assessment'});if(r.netPenalty!==375000)process.exit(1)"
```

### 22.2 Production Health Criteria

```
GET /api/v2/monitoring/health → {"status":"healthy"} within 500ms
GET /api/v1/dashboard (cache hit) P95 < 50ms
GET /api/v1/dashboard (cache miss) P95 < 800ms
POST /api/v1/filings/nil P95 < 500ms
Admin Lighthouse performance ≥ 98
Dashboard 2G load < 2000ms first meaningful paint
Mobile crash rate (Sentry) < 0.1%
NRS stamp success rate > 97%
DLQ depth < 10 at all times
API error rate (5xx) < 0.5% over any 5-minute window
```

### 22.3 Deployment Verification Checklist

```
□ validateEnv.ts is first import in backend/src/app.ts
□ Express bound to 0.0.0.0, PORT from process.env.PORT
□ compression middleware active before routes (gzip level 6, threshold 1024)
□ express.raw('/webhooks') precedes express.json() in app.ts
□ Flutterwave HMAC uses rawBody.toString('utf8') + timingSafeEqual
□ Sentry PII regex order: BVN(11d) → ACCT(10d) → TIN(8d)
□ prom-client singleton: global.__taxbridge_prom_registry guard present
□ Redis cache write is non-blocking (.catch() fire-and-forget)
□ AuditEvent model has no updatedAt field
□ TaxHealthSnapshot model has no updatedAt field (insert-only)
□ All 7 cron jobs registered in orchestrator — no scattered setInterval
□ validate() middleware applied to all POST/PATCH mutation routes (C-34)
□ idempotency middleware applied to all exactly-once mutation routes (C-35)
□ opossum circuit breaker wired in nrsService.ts; nrsCircuitState metric updates
□ anomalyEngine.ts wrapped in try/catch — returns [] on throw
□ riskScoring.ts clamps score 0-100 before DB write
□ OnboardingWizard: router.replace on completion, AsyncStorage resume path
□ compliancePreFlight.ts called before Submit CTA in all filing wizards
□ DLQ admin UI at /admin/dlq with retry + resolve controls
□ Admin analytics at /admin/analytics with all 5 panels
□ TaxHealthSnapshot model present in schema
□ render.yaml committed to repo root
□ render.yaml logDrain destination set to Grafana Loki
□ CBN_MPR in Render environment variables (sync: false)
□ CORS_ORIGIN in Render environment variables (sync: false)
□ DOCUMENT_VAULT_KMS_PROVIDER in Render environment variables (sync: false)
□ EAS all 3 profiles: compileSdkVersion=36, targetSdkVersion=35
□ SENTRY_DSN set via EAS secret — not placeholder
□ .env files not committed (git ls-files | grep '\.env\.' | grep -v example → 0)
□ Docker: multi-stage build, non-root user, HEALTHCHECK directive
□ Blue-green green slot passes health check before traffic swap
□ Canary at 5% observed ≥ 2min with error rate < 0.5%
□ iOS eas.json production: buildConfiguration: "Release"
□ jose installed in admin workspace (Edge Runtime JWT)
□ All 7 smoke-test checks pass post-deploy
□ SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, RENDER_API_KEY, CBN_MPR in GitHub Secrets
□ OrgMember.orgId present in all business model queries
□ resolveOrgContext applied to all business routes
□ requireRole applied to all non-public routes
□ BiometricAuth falls through to PIN — never blocks login
□ All FlatList replaced with @shopify/flash-list (grep -rn "FlatList" mobile/src → 0)
□ prisma/seeds/smokeTestUser.ts exists with deterministic credentials
```

---

## 23. EMERGENCY PROTOCOLS

| Symptom | Root Cause | Remediation |
|---|---|---|
| TypeScript errors after Prisma change | Generated types referenced | Replace with `(prisma as any)` (C-01) |
| Dashboard P99 > 800ms under load | Redis TTL inadvertently 0 | Verify `dashboard:composite:v1:${orgId}:${userId}` TTL is 120s |
| WHT professional fee shown as 5% | Rate lookup defaulting to construction | Check category mapping — professional is 10% (C-10, §2.3) |
| EAS build fails (AAR incompatibility) | Wrong SDK version | Verify `compileSdkVersion: 36, targetSdkVersion: 35` (C-03) |
| NRS circuit stuck open | NRS API down | Set `DIGITAX_MOCK_MODE=true` in Render env |
| Raw i18n keys on device | `initImmediate: true` | Set `initImmediate: false` → `eas update --branch production` |
| Admin 500 on cold start | Missing FALLBACK_* | All 3 admin routes must `.catch(() => FALLBACK_*)` (C-12) |
| Gauge not rendering | worklet missing | Verify `'worklet'` on `buildArcPath` + `scoreToStroke` (§12.4) |
| Composite API > 800ms P99 | Sequential await | Verify Promise.all not sequential; TTL=120s |
| prom-client crash on hot reload | Double registration | Verify `global.__taxbridge_prom_registry` singleton guard |
| Flutterwave HMAC always false | Buffer stringification | Use `rawBody.toString('utf8')` not `JSON.stringify(req.body)` (§6.5) |
| Sentry masking years | Regex order wrong | BVN(11d) → ACCT(10d) → TIN(8d) — order is mandatory (§6.3) |
| Penalty calculation wrong | CBN_MPR hardcoded | Read from `process.env.CBN_MPR` — never literal (C-27) |
| Accountant sees wrong org data | revokedAt unchecked | Add `revokedAt: null` to AccountantClient query (C-28) |
| Zone animation not playing | visible prop false | Verify `data !== undefined` before `visible={true}` |
| Skeleton layout shift | Geometry mismatch | Measure SkeletonBlock vs real component height (§12.3) |
| 15% ETR on individual PIT | Old code path | Delete — NTA 2025 §47 is corporate MNE only (§2.1) |
| "No anomalies" text visible | empty not null | Set `empty={null}` on SectionState for anomaly section (C-19) |
| SENTRY_DSN placeholder in build | Unconfigured secret | `eas secret:create --scope project --name SENTRY_DSN --value <dsn>` (C-33) |
| validate() not a middleware | schema.parse() in handler | Move to `validate(MySchema)` in route chain (C-34) |
| Duplicate filing on network retry | Missing idempotency key | Apply `idempotency` middleware; client must send `X-Idempotency-Key` (C-35) |
| Anomaly engine throws → dashboard fails | computeAnomalies not wrapped | Ensure try/catch → return [] + Sentry in anomalyEngine.ts |
| Risk score outside 0-100 | Unclamped computation | Add `Math.max(0, Math.min(100, total))` in computeRiskScore before upsert |
| NRS circuit opens repeatedly | Mock mode not enabled | Set `DIGITAX_MOCK_MODE=true` in Render env; circuit resets on toggle |
| Onboarding resets to step 1 | No resume path | Implement PATCH /api/v1/onboarding/progress + AsyncStorage fallback |
| Admin analytics page blank | Missing intelligence input build | Verify buildIntelligenceInput(orgId, prisma) is implemented in dashboardService.ts |
| Health check returns 503 | degraded state misconfigured | Health endpoint must always return 200 — use 'degraded' status string, not HTTP 503 |
| TaxHealthSnapshot growing unbounded | No retention policy | Snapshot cron prunes entries older than 24 months per org — add to riskScoringCron |

---

## 24. TAXBRIDGE STANDARD

| Principle | Enforcement |
|---|---|
| Tax numbers are defensible | Every calculation from `@taxbridge/contracts`, cites NTA 2025 §XX |
| Offline is invisible | React Query cache + AsyncStorage queue; OfflineSyncStatus in AMBIENT |
| Pidgin is first-class | Natural Lagos Pidgin; CI blocks raw keys and literal translations |
| Performance is trust | Single composite call; FlashList; 60fps gauge; gzip compression; 2G < 2s |
| Multi-tenant always | `orgId` on every business query; `resolveOrgContext` on every business route |
| Audit trail is immutable | AuditEvent + TaxHealthSnapshot have no `updatedAt`; all filing writes awaited (C-25) |
| Gestures are instant | Visual ack + haptic ≤ 100ms; `router.push()` never awaited (C-20) |
| Empty states help | Never blank; silence on no anomalies (C-19); errors = InlineError + retry |
| WCAG 2.2 AA everywhere | 3-channel status indicators; SVG gauge with accessibilityLabel |
| Compliance is proactive | NIL returns required; preflight checks before submission; penalty estimates before deadlines |
| Intelligence is explainable | Anomaly descriptions cite specific data points; no black-box output; fail → [] not exception |
| Validation is layered | validate() middleware on routes; Zod in contracts; idempotency on mutations (C-34, C-35) |
| Security is zero-trust | Every route: authenticate + resolveOrgContext + requireRole. No exceptions. |
| Secrets are never literals | CBN_MPR, CORS, KMS, SENTRY_DSN — always from env. Never hardcoded. |

> **Build for:** A first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin. If it works for them, it works for everyone.

---

**TAXBRIDGE V12 MASTER PROMPT — ELEVATED + FINAL**
Path: `/prompts/v12_master_prompt.md` | Repo: `github.com/Scardubu/taxbridge`
Effective: 2026-03-02 | Branch: `upgrade/v12-elevated-20260302` | Supersedes: V10.3 + V11.0 + V12 FINAL
Architecture Module: `/prompts/v12_production_architecture_module.md` — read alongside for AI pipeline (§11A), admin analytics (§7.x), Docker (§10.1), UX flows (§6.x), performance hardening (§12.x), and security hardening (§11.x).