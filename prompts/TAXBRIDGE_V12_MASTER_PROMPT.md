# TAXBRIDGE V12 MASTER PROMPT

**Path:** `/prompts/v12_master_prompt.md`
**Repo:** `github.com/Scardubu/taxbridge` | **Branch:** `feat/v12-final-elevation`
**Supersedes:** V10.3 + V11.0 | **Effective:** 2026-03-01
**Deployment:** Backend → Render | Admin → Vercel | Mobile → EAS (Android + iOS)

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
│   └── index.ts                   # Public API surface
├── backend/
│   └── src/
│       ├── app.ts                 # Entry — validateEnv FIRST import, 0.0.0.0 bind
│       ├── validateEnv.ts         # Hard-crash on missing env vars
│       ├── lib/
│       │   └── logger.ts          # Pino structured logger (NO console.log anywhere)
│       ├── middleware/
│       │   ├── auth.ts            # JWT verify (authenticate)
│       │   ├── requireRole.ts     # RBAC gate (C-24) — fire-and-forget ACCESS_DENIED audit
│       │   ├── rateLimit.ts       # Per-route rate limits (§6.6)
│       │   └── tenant.ts          # Org isolation — resolveOrgContext()
│       ├── routes/
│       │   ├── v1/
│       │   │   ├── dashboard.ts   # GET /api/v1/dashboard — ONE composite endpoint
│       │   │   ├── filings/
│       │   │   │   ├── nil.ts     # POST /api/v1/filings/nil (C-21, idempotent)
│       │   │   │   ├── vat.ts     # POST /api/v1/filings/vat + IRN
│       │   │   │   ├── wht.ts     # POST /api/v1/filings/wht
│       │   │   │   └── paye.ts    # POST /api/v1/payroll/run
│       │   │   ├── compliance/
│       │   │   │   ├── penalty-estimate.ts
│       │   │   │   └── vat-credit.ts
│       │   │   ├── onboarding/
│       │   │   │   ├── tin.ts     # TIN validation + NRS lookup
│       │   │   │   └── cac.ts     # CAC/RC validation
│       │   │   ├── documents.ts   # Vault: upload, get (signed URL), soft-delete
│       │   │   ├── team.ts        # OrgMember CRUD + session invalidation
│       │   │   └── accountant.ts  # AccountantClient delegation (C-28)
│       │   ├── v2/
│       │   │   └── monitoring.ts  # /health (public) + /metrics (ADMIN only)
│       │   └── webhooks/
│       │       └── flutterwave.ts # rawBody HMAC verify then process
│       ├── services/
│       │   ├── audit.ts           # writeAuditEvent() — always awaited (C-25)
│       │   ├── dashboardService.ts
│       │   ├── penaltyService.ts
│       │   ├── vatCredit.service.ts
│       │   ├── riskScoring.ts
│       │   ├── anomalyEngine.ts
│       │   ├── eventBus.ts        # EventEmitter, setMaxListeners(30)
│       │   ├── nrsService.ts      # Circuit breaker pattern
│       │   ├── redis.ts           # Singleton client
│       │   └── notifications.ts   # Push + SMS
│       ├── cron/
│       │   ├── orchestrator.ts    # Exactly 7 jobs — central registry
│       │   ├── taxHealthSnapshot.ts
│       │   ├── riskScoringCron.ts
│       │   └── keepAlive.ts
│       ├── metrics.ts             # prom-client singleton (§17.1)
│       └── workers/
│           └── nrsStampWorker.ts  # BullMQ NRS stamp worker
├── backend/prisma/                # Prisma lives at backend/ root, not inside src/
│   ├── schema.prisma
│   ├── migrations/                # Append-only, timestamped — never rollback in prod
│   └── seeds/
│       └── smokeTestUser.ts       # Deterministic smoke-test credentials
├── mobile/
│   └── src/
│       ├── design-system/
│       │   ├── animation.ts       # DURATION, EASE, ENTER_FROM, ZONE_DELAY
│       │   ├── tokens.ts          # Color, spacing, typography
│       │   └── ngn.ts             # formatNGN() — C-32
│       ├── contexts/
│       │   └── ThemeContext.tsx   # useTheme(), dark mode provider
│       ├── components/
│       │   ├── dashboard/         # DashboardZone, Skeleton, Gauge, QuickActions
│       │   ├── education/         # ExplainMyTax, TaxAcademy
│       │   └── shared/            # SectionState, InlineError
│       ├── screens/
│       │   ├── DashboardScreen.tsx
│       │   ├── OnboardingWizard.tsx
│       │   └── filings/           # VAT, WHT, PAYE, NIL
│       ├── hooks/
│       │   ├── useDashboard.ts    # @tanstack/react-query composite
│       │   ├── useTenant.ts       # Org context hook
│       │   └── useBiometric.ts    # expo-local-authentication
│       ├── i18n/
│       │   ├── en.json
│       │   └── pidgin.json        # Natural Lagos Pidgin — not literal
│       └── services/
│           └── apiClient.ts       # Axios + offline interceptor
│   ├── eas.json
│   └── metro.config.js            # blockList: backend/, admin/, *.test.*
├── admin/
│   └── src/
│       ├── middleware.ts          # Edge JWT (jose), RBAC route guard
│       ├── pages/admin/           # Dashboard, audit, DLQ, analytics, team
│       └── components/            # Mirrors mobile design-system tokens
│   └── vercel.json
├── infra/
│   ├── terraform/                 # Render + Cloudflare IaC
│   └── grafana/alerts.yml
├── scripts/
│   ├── check-i18n.ts              # Flatten + diff en vs pidgin keys; exit 1 on mismatch
│   └── compress-assets.sh         # pngquant pre-build
├── .husky/pre-commit              # 4 gates enforced locally
├── .github/workflows/pipeline.yml # 5-stage CI/CD
├── render.yaml                    # IaC — committed to repo root
└── CHANGELOG.md
```

### 1.2 Service Boundaries

| Service | Owns | Cannot Touch |
|---|---|---|
| `packages/contracts/` | All tax math, RBAC types | No DB, no HTTP |
| `backend/` | API, auth, filing, queues | No inline tax math |
| `mobile/` | UX, offline, filing UX | No tax math, no admin logic |
| `admin/` | Ops dashboard, RBAC mgmt | No mobile-only logic |
| `infra/` | IaC, Grafana configs | No application code |

**Cross-boundary rule:** Tax calculation always flows `mobile → API → contracts`. Never `mobile → contracts` directly in production runtime (bundle size + audit trail requirements).

### 1.3 Multi-Tenant Org Isolation

Every database query scoped by `orgId`. Never `userId` alone for business data.

```typescript
// backend/src/middleware/tenant.ts
export async function resolveOrgContext(req: AuthRequest, res: Response, next: NextFunction) {
  const { userId, orgId } = req.user;
  const member = await (prisma as any).orgMember.findFirst({
    where: { userId, orgId, status: 'active', deletedAt: null },
  });
  if (!member) return res.status(403).json({ error: 'ORG_ACCESS_DENIED' });
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
// ✅ formatNGN(632_400)                      → "₦632,400"
// ✅ formatNGN(5_000_000, { compact: true }) → "₦5.0M"
// ❌ `₦${amount.toLocaleString()}`           → OEM-dependent, breaks on some Android
```

---

## 2. NTA 2025 TAX CONSTANTS

**Single source of truth:** `packages/contracts/src/constants.ts`
**Rule:** Every downstream consumer imports from `@taxbridge/contracts`. Zero inline math anywhere.

```typescript
export const NRS_STAMP_THRESHOLD          = 200_000;
export const VAT_RATE                     = 0.075;
export const VAT_REGISTRATION_THRESHOLD   = 25_000_000;   // mandatory reg ≥ ₦25M
export const VAT_SMALL_CO_EXEMPTION       = 100_000_000;  // exempt if turnover < ₦100M
export const SMALL_CO_CIT_THRESHOLD       = 100_000_000;
export const SMALL_CO_FIXED_ASSETS_MAX    = 250_000_000;
export const WHT_DEFAULT_RATE             = 0.10;
export const WHT_PROFESSIONAL_RATE        = 0.10;  // 10% — NOT 5%
export const WHT_CONSTRUCTION_RATE        = 0.05;  // ONLY construction/contracts
export const WHT_NONRESIDENT_RATE         = 0.04;
export const WHT_MONTHLY_EXEMPTION_CAP    = 2_000_000;  // BOTH TIN + ≤₦2M required
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
| CIT medium band 20% (₦25M–₦100M) | ₦100M threshold, 0% or 30% only | `grep -rn "0\.20.*CIT\|CIT.*20%"` → 0 |

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

### 2.3 WHT Rate Decision — Surface in Wizard

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
// packages/contracts/src/penalties.ts
// calculatePenalty(input): PenaltyResult
// disclosurePhase: 'before_audit' | 'during_audit' | 'after_assessment'
// waiverRate:      before=100%,    during=50%,       after=0%
// monthsLate   = Math.ceil(daysLate / 30)
// lateFiling   = firstMonth + Math.max(0, monthsLate - 1) × subsequent
// cbnMpr       = parseFloat(process.env.CBN_MPR ?? '0.2725')  // NEVER hardcoded (C-27)
// interest     = taxAmountDue × (cbnMpr + 0.10) × (daysLate / 365)
// netPenalty   = (lateFiling + interest) × (1 - waiverRate)
// NIL return late: same penalty schedule as substantive late filing
// VAT penalty: PENALTY_VAT_CO_MONTH per month (not PENALTY_CO_FIRST_MONTH) — separate schedule
```

**Penalty accuracy gate:**
```
Company, 32 days late, ₦0 tax due:
  lateFiling = 250,000 + 125,000 = 375,000 | interest = 0 | netPenalty = 375,000
Individual, 1 day late, ₦100,000 due, before_audit:
  lateFiling = 50,000 | interest = 100,000 × (CBN_MPR + 0.10) × (1/365) | netPenalty = 0
```

---

## 3. MANDATORY SESSION OPENING — 8 STEPS

Execute all 8 before modifying any file. Steps 4–7 must return 0 results or STOP.

```bash
# Step 1 — Baseline
cat CHANGELOG.md && cat PRODUCTION_READY.md

# Step 2 — Last deployment
cat DEPLOYMENT_v11.0_COMPLETE.md 2>/dev/null || cat DEPLOYMENT_v10.3_COMPLETE.md

# Step 3 — Module integrity
yarn prompts:verify
# → must report: "✅ 11/11 modules loaded (M00–M10)"

# Step 4 — FIRS eradication gate
grep -rn "FIRS" backend/src mobile/src admin/src packages \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" \
  | grep -v node_modules | grep -v .git
# → MUST return 0 results

# Step 5 — NRSt typo gate
grep -rn "NRSt" mobile/src --include="*.json"
# → MUST return 0 results

# Step 6 — CRA abolition gate
grep -rn "CRA\b\|consolidatedRelief\|minTax\|0\.01.*gross\|ETR.*PIT" \
  packages/contracts/src backend/src mobile/src --include="*.ts" --include="*.tsx"
# → MUST return 0 results

# Step 7 — Animation token gate
grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src --include="*.ts" --include="*.tsx" \
  | grep -v "animation.ts"
# → MUST return 0 results

# Step 8 — Render warm-up
curl -s -o /dev/null -w "Render: %{http_code} in %{time_total}s\n" \
  https://taxbridge-api-ker8.onrender.com/api/v2/monitoring/health
```

---

## 4. AGENT ROLES

| Agent | Files Owned | Cannot Modify |
|---|---|---|
| **Architect** | `packages/contracts/`, `prisma/schema.prisma`, architecture docs | App logic files |
| **Security** | `middleware/auth.ts`, `middleware/requireRole.ts`, `middleware/tenant.ts`, `validateEnv.ts` | Business logic |
| **DevOps** | `render.yaml`, `eas.json`, `.github/workflows/`, `infra/terraform/`, `Dockerfile` | Source code |
| **UI** | `mobile/src/`, `admin/src/`, `mobile/src/design-system/` | Backend services |
| **QA** | `**/*.test.ts`, `**/*.spec.ts`, `scripts/check-i18n.ts` | Source implementation |
| **AI Coding Agent** | All files, guided by this prompt | Must not deviate from constraints |

**AI Coding Agent rules:**
1. Load task context via `loadContextForTask()` before writing any code.
2. Read the target file completely before modifying it.
3. After every file write, run the applicable CI gate for that file's domain.
4. Never combine unrelated concerns in a single commit.
5. Comply with C-01 through C-32 without exception.

---

## 5. ABSOLUTE CONSTRAINTS — C-01 through C-32

Format: Rule | ✅ correct | ❌ wrong | CI gate where applicable.

**C-01 — Prisma Types**
```typescript
// ✅ (prisma as any).taxHealthSnapshot.findMany({ where: { orgId, userId } })
// ❌ prisma.taxHealthSnapshot.findMany({ where } as Prisma.TaxHealthSnapshotWhereInput)
```

**C-02 — No FIRS**
`FIRS` must not appear in any file. CI: `grep -rn "FIRS" . --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules` → 0

**C-03 — Android SDK (Fixed)**
`compileSdkVersion: 36`, `targetSdkVersion: 35`. Never change these values.

**C-04 — EAS Config Canonical**
`mobile/eas.json` is the single build config. No build settings elsewhere.

**C-05 — Test Gate**
`npm test --workspaces` → ≥ 550 passing, 0 failing before any merge.

**C-06 — Bilingual i18n**
Every user-visible string in both `en.json` AND `pidgin.json`. Pidgin must be natural Lagos Pidgin, not literal translation. CI: `yarn i18n:check` → exit 0.

**C-07 — Graceful Degradation**
No route returns 500 on DB or network failure. Degrade to `FALLBACK_*` constants or inline error response.

**C-08 — No Fabricated Data**
`Math.random()` is forbidden in dashboard, chart, analytics, or tax calculation code.

**C-09 — Tax Math in contracts/ Only**
Zero inline tax math in `backend/`, `mobile/`, or `admin/`. All calculations via `@taxbridge/contracts`.

**C-10 — Constants from contracts/constants.ts Only**
Never hardcode VAT rates, PIT bands, WHT rates, or penalty amounts anywhere outside `constants.ts`.

**C-11 — Zod: .issues Not .errors**
```typescript
// ✅ res.status(400).json({ errors: result.error.issues });
// ❌ res.status(400).json({ errors: result.error.errors }); // TypeError
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
// ✅ onPress={() => router.push('/route')}       // synchronous — visual ack immediate
// ❌ onPress={async () => { await fetch(); router.push('/route'); }} // blocks ack
```
CI: `grep -rn "await.*router\|router.*await" mobile/src/screens/DashboardScreen.tsx` → 0

**C-21 — NIL Return Required**
`POST /api/v1/filings/nil` with `NilReason` enum. Idempotent (409 on duplicate). Audit event awaited.

**C-22 — VAT Credit from DB**
```typescript
// ✅ (prisma as any).vatCreditBalance.findFirst({ where: { orgId, period, usedInPeriod: null } })
// ❌ recomputeVATFromTransactions() // double-counts, produces stale results
```

**C-23 — WHT Exemption: Both Conditions Required**
WHT exemption only when: (a) counterparty TIN validated AND (b) monthly total ≤ ₦2M.

**C-24 — RBAC via Middleware Only**
```typescript
// ✅ router.post('/payroll', authenticate, resolveOrgContext, requireRole('accountant'), handler)
// ❌ if (req.user.role === 'admin') { ... } // inline bypass — forbidden
```

**C-25 — Audit Events Always Awaited**
```typescript
// ✅ await writeAuditEvent({ ... }, prisma);
// ❌ writeAuditEvent({ ... }).catch(() => {}); // EXCEPTION: ACCESS_DENIED in requireRole only
```

**C-26 — Pino Logger (No console.log in Backend)**
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
// ❌ process.env.DB_PASSWORD // Docker Swarm mounts secrets as files, not env vars
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

---

## 6. SECURITY CONTROLS

### 6.1 Authentication

```typescript
// JWT: RS256 preferred in production; HS256 acceptable in dev
// Access token TTL:  15 minutes
// Refresh token TTL: 7 days, rotated on every use, single-use
// Token storage: expo-secure-store (mobile); httpOnly cookie (admin)
// Never: localStorage, AsyncStorage for tokens

// Refresh flow:
// 1. Mobile sends expired access token → 401
// 2. Mobile sends refresh token → POST /api/v1/auth/refresh
// 3. Backend: verify refresh, check role_version in Redis, issue new pair
// 4. Old refresh token invalidated immediately

// Role-version invalidation on role change:
await redis.setex(`role_version:${userId}`, 60 * 60 * 24 * 7, Date.now().toString());
// TTL = 7 days — matches refresh token lifetime; stale tokens rejected on every request
```

### 6.2 Biometric Authentication (MOD-41)

```typescript
// mobile/src/hooks/useBiometric.ts
import * as LocalAuthentication from 'expo-local-authentication';

export async function authenticateWithBiometric(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) return false; // fall through to PIN — never block login
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access TaxBridge',
    cancelLabel: 'Use PIN',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: false,
  });
  return result.success;
}
// Biometric consent stored in expo-secure-store, not AsyncStorage
// Re-prompt after 5min inactivity (configurable per org settings)
```

### 6.3 PII Scrubbing (Sentry)

```typescript
// Order matters — longest pattern first prevents partial masking of longer numbers
beforeSend(event) {
  const raw    = JSON.stringify(event);
  const masked = raw
    .replace(/\b\d{11}\b/g, '[BVN_REDACTED]')   // BVN: exactly 11 digits
    .replace(/\b\d{10}\b/g, '[ACCT_REDACTED]')  // Account: exactly 10 digits
    .replace(/\b\d{8}\b/g,  '[TIN_REDACTED]');  // TIN: exactly 8 digits
  // \b word-boundary ensures 4-digit years (2025, 2026) are NOT matched
  try { return JSON.parse(masked); } catch { return event; }
}
```

### 6.4 Transport Security

```typescript
// backend/src/app.ts — exact middleware order required
// NOTE: Helmet CSP below applies to the backend API server.
// Admin panel (Next.js/Vercel) has its own CSP in admin/vercel.json headers config.
import './validateEnv';                            // MUST be first import

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:              ["'self'"],
      scriptSrc:               ["'self'"],
      styleSrc:                ["'self'", "'unsafe-inline'"],
      connectSrc:              ["'self'", "https://taxbridge-api-ker8.onrender.com",
                                "https://o*.ingest.sentry.io"],   // Sentry error reporting
      frameAncestors:          ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin:      ['https://taxbridge.vercel.app', 'https://app.taxbridge.ng'],
  credentials: true,
}));

// express.raw BEFORE express.json — rawBody preserved for Flutterwave HMAC
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1); // Cloudflare + Render in front

// Bind — Render requires 0.0.0.0 (not localhost)
app.listen(parseInt(process.env.PORT!), '0.0.0.0', () => {
  logger.info({ port: process.env.PORT }, 'Server started');
});
```

### 6.5 Flutterwave HMAC

```typescript
// Only correct implementation — rawBody.toString('utf8'), never JSON.stringify(req.body)
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
| `GET /api/v2/monitoring/health` | Unlimited (public) |
| `GET /api/v2/monitoring/metrics` | 10 req/min, ADMIN only |

### 6.7 TIN + CAC/RC Validation (Onboarding)

```typescript
// POST /api/v1/onboarding/tin
// Body: { tin: string } — exactly 8 digits
// Action: NRS TIN lookup → validate active, not suspended
// Response: { valid, tin, entityName, entityType, registrationDate }
// Rate limit: 3 req/min per IP (prevents brute-force TIN enumeration)
// Audit: await writeAuditEvent — TIN lookups are sensitive PII access

// POST /api/v1/onboarding/cac
// Body: { rcNumber: string } — format: RC-NNNNNN
// Action: CAC API lookup → entity name, directors, status
// Store: orgProfile.cacRcNumber, orgProfile.entityName (verified)
// Rate limit: 3 req/min per IP
// Audit: await writeAuditEvent
```

---

## 7. RBAC MODEL

### 7.1 Role Hierarchy

```typescript
// packages/contracts/src/rbac.ts
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OWNER' | 'ACCOUNTANT' | 'EMPLOYEE' | 'VIEWER';

export const ROLE_HIERARCHY: Readonly<Record<UserRole, number>> = {
  SUPER_ADMIN: 6,
  ADMIN:       5,
  OWNER:       4,
  ACCOUNTANT:  3,
  EMPLOYEE:    2,
  VIEWER:      1,
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
| RBAC assign | ✓ | ✓ | ✓ | — | — | — |
| Audit log read | ✓ | ✓ | — | — | — | — |
| System / admin panel | ✓ | ✓ | — | — | — | — |
| DLQ management | ✓ | ✓ | — | — | — | — |
| NRS circuit override | ✓ | — | — | — | — | — |

### 7.3 Accountant Delegation

```typescript
// Every delegation query must check revokedAt: null (C-28)
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
// On any role change or delegation revocation:
await redis.del(`sessions:${userId}`);
await redis.setex(`role_version:${userId}`, 60 * 60 * 24 * 7, Date.now().toString());
// TTL = 7 days — matches refresh token lifetime
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

`writeAuditEvent()` call signature:

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
// EXCEPTION: ACCESS_DENIED events in requireRole() are fire-and-forget
// (.catch(() => {})) — 403 response must not be delayed by audit write latency
```

### 8.2 Structured Logging (Pino)

```typescript
// backend/src/lib/logger.ts
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.LOG_FORMAT === 'json'
    ? {}
    : { transport: { target: 'pino-pretty' } }),
  redact: ['req.headers.authorization', 'body.password', 'body.tin', 'body.bvn'],
});
// Always include orgId + userId for traceability:
// logger.info({ orgId, userId, filingRef }, 'NIL return filed');
// logger.error({ orgId, err }, 'VAT submission failed');
// logger.warn({ orgId, circuitState }, 'NRS circuit open');
```

### 8.3 Required Audit Points

| Action | Audit Method | C-25 |
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
| ACCESS_DENIED | `.catch(()=>{})` fire-and-forget | Exception |

---

## 9. FILING ARTIFACT IMMUTABILITY

### 9.1 Filed Return Invariants

Once a `TaxReturn` record reaches `status: 'submitted'`:
- No field may be updated except `receiptUrl` (NRS receipt attachment)
- Amendments create a NEW `TaxReturn` with `amendedReturnId` pointing to original
- Original return `status` changes to `'amended'` (not deleted)
- All amendments audited with `action: 'AMEND'` and `before`/`after` diff

### 9.2 NRS Stamp Immutability

```prisma
model Invoice {
  // After nrsStampedAt is set, these fields are locked:
  // amount, vatAmount, buyerTin, sellerTin, lineItems
  // Backend rejects PATCH on stamped invoices
  // UI: stamped invoices show 🔒 indicator, all edit controls disabled
  nrsStampedAt  DateTime? // null = unstamped, non-null = immutable
  nrsIRN        String?   // Invoice Reference Number from NRS
  stampAttempts Int       @default(0)
}
```

### 9.3 Document Vault

- Encrypted at rest: AES-256-GCM, key from AWS KMS, annual rotation
- Retention: 5 years minimum (NTA 2025 requirement)
- Deletion: soft-delete only; hard delete only via SUPER_ADMIN after 7-year retention
- Access: logged to `AuditEvent`; shared links expire in 24h
- Storage: Cloudflare R2 (preferred for Nigerian latency)

---

## 10. EVENT-DRIVEN FLOWS

### 10.1 Event Bus

```typescript
// backend/src/services/eventBus.ts
import EventEmitter from 'events';
const bus = new EventEmitter();
bus.setMaxListeners(30);
export const eventBus = bus;
```

### 10.2 Event Flows

```
anomaly.detected →
  1. redis.del(`dashboard:composite:v1:${orgId}:${userId}`)  [cache invalidate]
  2. if severity HIGH|CRITICAL: runTaxHealthSnapshot(orgId, userId)  [immediate recompute]
  3. if severity HIGH|CRITICAL: sendAnomalyNotification(orgId, userId) [push + SMS]
  4. await writeAuditEvent(...)                               [immutable record]

invoice.created (amount >= NRS_STAMP_THRESHOLD) →
  1. Enqueue NRS stamp job to BullMQ (priority: high)
  2. redis.del(`dashboard:composite:v1:${orgId}:${userId}`)

filing.submitted →
  1. await writeAuditEvent(...)
  2. Enqueue receipt PDF generation to BullMQ (priority: normal)
  3. sendFilingConfirmation(orgId, filing)
  4. Update SMERiskRecord.filingConsistency

nrs.circuitOpened →
  1. logger.warn + Sentry alert
  2. Enqueue retry at circuit half-open (30min)
  3. Notify ADMIN via push + Slack webhook

payment.completed →
  1. Verify HMAC (Flutterwave rawBody — §6.5)
  2. Update SubscriptionPlan.status
  3. await writeAuditEvent(action: 'PAYMENT_RECEIVED')
  4. Unlock premium features for orgId
```

### 10.3 BullMQ Queue Configuration

```
Queue: 'nrs-stamp'       priority: high   — blocks filing completion
Queue: 'notifications'   priority: normal — push/SMS delivery
Queue: 'pdf-generation'  priority: low    — receipt PDF, non-blocking
Queue: 'analytics'       priority: low    — health snapshot, risk scoring
DLQ: any job failing 3 attempts → DLQJob model → admin alert if depth > 10
Retry: exponential backoff 1s → 10s → 60s
```

### 10.4 Error Handling Standards

**API error response shape — always use this structure:**
```typescript
// All error responses must return this shape. Never naked strings or unstructured objects.
interface ApiError {
  error:   string;   // machine-readable code  e.g. 'ORG_ACCESS_DENIED', 'INSUFFICIENT_ROLE'
  message: string;   // human-readable (EN)    e.g. 'You do not have access to this organisation'
  code?:   number;   // optional HTTP status echo for client convenience
}

// ✅ res.status(403).json({ error: 'ORG_ACCESS_DENIED', message: 'You do not have access to this organisation' })
// ❌ res.status(403).json('Forbidden')
// ❌ res.status(403).json({ message: 'Access denied' })   // missing machine-readable 'error' field
```

**Zod validation errors — always use .issues:**
```typescript
const result = schema.safeParse(req.body);
if (!result.success) return res.status(400).json({ error: 'VALIDATION_ERROR', issues: result.error.issues });
// ❌ result.error.errors  — TypeError; Zod v3 uses .issues not .errors (C-11)
```

**FALLBACK_* constants — define at top of each service file that owns dashboard data:**
```typescript
// backend/src/services/dashboardService.ts
const FALLBACK_STATS:      DashboardStats     = { taxHealthScore: 0, userName: '', vatLiability: 0, trend: [], outstandingPAYE: 0, unfiledPeriods: 0 };
const FALLBACK_ANOMALIES:  AnomalySignal[]    = [];
const FALLBACK_DEADLINES:  ComplianceEvent[]  = [];
const FALLBACK_NRS_HEALTH: NrsHealth          = { circuitState: 'open', lastSuccessAt: null, pendingJobs: 0 };
// Any .catch() in Promise.all MUST return the appropriate FALLBACK_* — never undefined or null
```

**Sentry capture — required in every .catch() that returns a FALLBACK:**
```typescript
getDashboardStats(orgId, userId).catch(e => {
  Sentry.captureException(e, { extra: { orgId, userId, service: 'getDashboardStats' } });
  logger.error({ orgId, userId, err: e }, 'getDashboardStats failed — returning FALLBACK');
  return FALLBACK_STATS;
})
```

**Global error handler (backend/src/app.ts) — must be last middleware:**
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
Entry points:
  QuickActionsGrid "File VAT" → urgent badge if ≤7 days to 21st
  ComplianceCalendar "File Now" CTA
  Anomaly signal 7 (VAT gap) "Fix Now" → pre-fills flagged period

Wizard steps:
  1. Period selection (auto-selects last unfiled month)
  2. Output VAT: pulled from NRS-stamped invoices for period
  3. Input VAT: pulled from receipted expenses for period
  4. Prior-period credit: read from VATCreditBalance (C-22, never recomputed)
  5. Net calculation via calculateVAT from @taxbridge/contracts
  6. Net > 0: remittance instructions + Flutterwave payment
  7. Net < 0: credit carryforward persisted to VATCreditBalance
  8. NRS submission → IRN returned
  9. Filing artifact: PDF receipt stored in Document Vault

NIL condition: no invoices AND no expenses → auto-suggest NIL return
Deadline display: "Due {{date}} — {{daysRemaining}} days"
```

**WHT Remittance (MOD-23)**
```
Entry points:
  QuickActionsGrid "Remit WHT"
  Invoice detail (≥₦200k with WHT-applicable category)

Wizard steps:
  1. Select payment(s) for WHT period
  2. Display rate per category: 10% amber, 5% blue, 4% green
  3. Warn if professional fee miscategorized at 5% → should be 10%
  4. Exemption eligibility check (TIN + monthly total — C-23)
  5. Calculated WHT payable (formatNGN)
  6. Remittance to NRS → WHT credit note
  7. Filing artifact: PDF stored in Document Vault

Deadline: 21st of following month — red badge if ≤5 days
```

**PAYE Payroll (MOD-25)**
```
Entry: QuickActionsGrid "Run PAYE"

Per employee:
  Input:  grossSalary, basicPay, housingAllowance, transportAllowance, rentPaid, pension
  Calc:   calculatePIT({ grossIncome, rentPaid, pension }) from @taxbridge/contracts
  Output: formatNGN(taxLiability) displayed per employee

Batch:
  Total PAYE liability summed across all active employees
  Generate payroll schedule PDF
  Submit to NRS → PAYE credit note
  Fund disbursement via Flutterwave (bulk payout)

Accuracy gate: ₦5M gross + ₦600k rent + ₦200k pension → must produce ₦632,400 ±₦1
```

**NIL Return (MOD-21)**
```
Entry:
  ComplianceCalendar "File NIL Return"
  Anomaly: "No activity detected — NIL return required"

Fields: taxType, period (YYYY-MM), reason (NilReason enum)
Reasons (displayed in UI):
  NO_REVENUE_THIS_PERIOD         → "No revenue this period"
  BUSINESS_INACTIVE              → "Business temporarily inactive"
  EXEMPT_SUPPLY_ONLY             → "Exempt supply only"
  BELOW_REGISTRATION_THRESHOLD   → "Below registration threshold"

Idempotency: 409 if same (orgId, taxType, period) already filed
Audit: await writeAuditEvent (C-25)
Penalty warning: displayed if filing late (same schedule as substantive late)
```

### 11.2 Compliance Calendar (Multi-Deadline)

```typescript
const COMPLIANCE_EVENTS = [
  { type: 'VAT',  label: 'VAT Return',       deadline: '21st of each month' },
  { type: 'WHT',  label: 'WHT Remittance',   deadline: '21st of each month' },
  { type: 'PAYE', label: 'PAYE Filing',       deadline: '10th of each month' },
  { type: 'CIT',  label: 'CIT Assessment',    deadline: '6 months after year-end' },
  { type: 'PIT',  label: 'Annual PIT Return', deadline: '90 days after year-end' },
];
// Color coding: 0-3 days = RED | 4-7 days = AMBER | 8-14 days = YELLOW | 15+ = GREEN
// Each deadline: "File Now" CTA → routes to correct wizard
// Overdue deadlines: show formatNGN(calculatePenalty(...).netPenalty) estimate
```

### 11.3 Offline Resilience

```
Tax rates (constants.ts):       bundled — always available
EXPLAIN_COPY:                   bundled — always available
Draft filings:                  AsyncStorage — queue for sync on reconnect
Dashboard data:                 React Query cache (gcTime: 5min) — stale with offline banner
Invoice list:                   AsyncStorage with last-sync timestamp
NRS stamp:                      BullMQ retry queue on backend — mobile shows "pending"

OfflineSyncStatus component (AMBIENT zone):
  Shows: last sync time, pending actions count, connection quality indicator
  Retry: pull-to-refresh OR automatic on reconnect (NetInfo listener)
  Display: t('common.offline') EN:     "You're offline — showing cached data"
                                Pidgin: "Network no dey — we dey show you wetin we save"
```

---

## 12. MOBILE UX — DASHBOARD ARCHITECTURE

### 12.1 Animation Vocabulary (CREATE FIRST — All Components Import This)

```typescript
// mobile/src/design-system/animation.ts
import { Easing } from 'react-native-reanimated';

export const DURATION = {
  instant:    100,  // tap feedback (C-20 visual ack)
  fast:       200,  // urgent overrides, mode switches
  standard:   400,  // content entrance, layout changes
  deliberate: 600,  // chart arc, sparkline draw-in
  slow:       800,  // TaxHealthGauge arc (emotional weight)
  skeleton:   1200, // shimmer — DO NOT CHANGE (2G patience tuned)
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
  context: 240,  // overridden to 0ms when urgent=true (HIGH/CRITICAL anomaly)
  ambient: 320,
} as const;
```

### 12.2 DashboardZone Component

```typescript
// mobile/src/components/dashboard/DashboardZone.tsx
// Exhaustive useEffect deps enforced — no stale closure violations
export type DashboardZoneName = 'apex' | 'signal' | 'action' | 'context' | 'ambient';

export function DashboardZone({ zone, visible, urgent = false, children }: DashboardZoneProps) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(ENTER_FROM.below.translateY);
  const scale      = useSharedValue(zone === 'apex' ? ENTER_FROM.scale.scale : 1);
  const delay      = urgent && zone === 'context' ? 0 : ZONE_DELAY[zone];

  useEffect(() => {
    if (!visible) return;
    const cfg = { duration: DURATION.standard, easing: EASE.enter };
    opacity.value = withDelay(delay, withTiming(1, cfg));
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

Skeleton block dimensions must match rendered content ±0px. Verify with RN Profiler.

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
// WORKLET — both functions must be marked 'worklet' (runs on UI thread)
function buildArcPath(score: number, size: number): string {
  'worklet';
  const r = size * 0.4; const cx = size / 2; const cy = size / 2;
  const deg = -205 + 230 * (score / 100);
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(-205)); const y1 = cy + r * Math.sin(toRad(-205));
  const x2 = cx + r * Math.cos(toRad(deg));  const y2 = cy + r * Math.sin(toRad(deg));
  return `M ${x1} ${y1} A ${r} ${r} 0 ${230 * (score / 100) > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

function scoreToStroke(score: number): string {
  'worklet';
  if (score >= 75) return '#1DB954';
  if (score >= 50) return '#F59E0B';
  return '#DC2626';
}
// Animate: withTiming(score, { duration: DURATION.slow, easing: EASE.gauge })
// Modes:   expanded=200px centered | compact=120px right-aligned
// Compact: any upcomingDeadline.daysRemaining ≤ 7 OR < 0
// accessibilityRole="progressbar" + accessibilityLabel={t('a11y.taxHealthGauge', { score, label })}
```

### 12.5 Canonical DashboardScreen

```typescript
// DO NOT DEVIATE from this structure (C-17, C-18, C-19, C-20)
const { data, isLoading, isRefetching, error, refetch } = useDashboard();
const gaugeMode       = useMemo(() => computeGaugeMode(data), [data]);
const hasHighAnomaly  = useMemo(
  () => data?.topAnomalies?.some(a => ['high', 'critical'].includes(a.severity)) ?? false,
  [data],
);
const handleRefetch   = useCallback(() => refetch(), [refetch]);

// Single skeleton gate — no other isLoading checks below this line
if (isLoading && !data) return <DashboardSkeleton />;

return (
  <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefetch} />}>
    <DashboardZone zone="apex" visible={!isLoading}>
      <Greeting userName={data?.stats.userName} />
      <TaxHealthGauge score={data?.stats.taxHealthScore ?? 0} mode={gaugeMode}
        accessibilityLabel={t('a11y.taxHealthGauge', { score: data?.stats.taxHealthScore, label: gaugeMode })} />
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
FIRST SCROLL (812px+):   Quick Actions (always visible) | Anomalies (≥1, ≥ medium)
                          Compliance Calendar strip
SECOND SCROLL (1600px+): Trend sparklines | OfflineSyncStatus
```

### 12.8 Haptic Feedback (MOD-42)

```typescript
import * as Haptics from 'expo-haptics';
// Tap:          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
// Success:      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
// Error:        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
// Warning:      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
// Fire BEFORE any await — visual + haptic ack within DURATION.instant (100ms)
```

---

## 13. COMPOSITE DASHBOARD API

```typescript
// GET /api/v1/dashboard
// Auth:  authenticate + resolveOrgContext
// Rate:  30 req/min per userId
// Cache: Redis key `dashboard:composite:v1:${orgId}:${userId}` TTL 120s

interface DashboardStats {
  taxHealthScore:    number;          // 0–100
  userName:          string;
  vatLiability:      number;          // current period net VAT due (NGN)
  trend:             TrendPoint[];    // last 6 months health score snapshots
  outstandingPAYE:   number;          // NGN, 0 if none
  unfiledPeriods:    number;          // count of unfiled months
}

interface AnomalySignal {
  id:          string;
  signal:      string;            // e.g. 'vat_gap', 'auth_failure', 'nrs_stamp_delay'
  severity:    'low'|'medium'|'high'|'critical';
  description: string;
  detectedAt:  string;            // ISO 8601
  ctaRoute?:   string;            // deep-link to resolution wizard
}

interface ComplianceEvent {
  type:           'VAT'|'WHT'|'PAYE'|'CIT'|'PIT';
  label:          string;
  deadline:       string;         // ISO 8601 date
  daysRemaining:  number;         // negative = overdue
  penaltyEstimate?: number;       // NGN — shown if overdue
}

interface NrsHealth {
  circuitState:   'closed'|'half-open'|'open';
  lastSuccessAt:  string | null;  // ISO 8601
  pendingJobs:    number;
}

interface DashboardComposite {
  stats:              DashboardStats;
  topAnomalies:       AnomalySignal[];      // max 3, severity ≥ medium
  upcomingDeadlines:  ComplianceEvent[];    // sorted by daysRemaining ASC
  nrsHealth:          NrsHealth;
  meta:               { cached: boolean; cacheAge?: number };
}

// Internal implementation:
// const [stats, anomalies, deadlines, nrs] = await Promise.all([
//   getDashboardStats(orgId, userId),
//   getTopAnomalies(orgId, userId),
//   getUpcomingDeadlines(orgId),
//   getNrsHealth(),
// ]);
// Each: .catch(e => { Sentry.captureException(e); logger.error({ orgId, err: e }, '...'); return FALLBACK_* })
// Cache write: non-blocking fire-and-forget .catch() with corrupt-entry guard
// Invalidated by: new invoice, new expense, NRS status change, anomaly.detected event
```

---

## 14. PRISMA SCHEMA — V12.0 ADDITIONS

### 14.1 New Enums

```prisma
enum UserRole      { SUPER_ADMIN ADMIN OWNER ACCOUNTANT EMPLOYEE VIEWER }
enum NilReason     { NO_REVENUE_THIS_PERIOD BUSINESS_INACTIVE EXEMPT_SUPPLY_ONLY BELOW_REGISTRATION_THRESHOLD }
enum AuditAction   { CREATE UPDATE DELETE FILE AMEND APPROVE OVERRIDE REVOKE INVITE EXPORT
                     ACCESS_DENIED ROLE_CHANGE LOGIN LOGOUT NRS_STAMP PAYMENT_RECEIVED }
enum RiskBand      { critical high medium low healthy }
enum OrgStatus     { active suspended pending_verification }
```

### 14.2 Multi-Tenant Org Model

```prisma
model Organisation {
  id          String    @id @default(cuid())
  name        String
  tinNumber   String    @unique   // 8-digit NRS TIN — validated at onboarding
  cacRcNumber String?             // CAC RC number — validated at onboarding
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
  org       Organisation @relation(fields: [orgId], references: [id])
  @@unique([orgId, userId])
  @@index([userId, status])
}
```

### 14.3 V12.0 Models (Append to schema.prisma)

```prisma
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
  id                 String    @id @default(cuid())
  orgId              String
  period             String    // YYYY-MM
  inputVAT           Float
  outputVAT          Float
  netCredit          Float
  carriedFromPeriod  String?   // null when this is the originating credit (no prior period)
  usedInPeriod       String?
  refundClaimed      Boolean   @default(false)
  refundClaimDate    DateTime?
  createdAt          DateTime  @default(now())
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
  computedAt   DateTime @default(now())
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
  id          String   @id @default(cuid())
  queueName   String
  jobId       String
  payload     Json
  failReason  String
  attempts    Int
  lastAttempt DateTime
  resolved    Boolean  @default(false)
  resolvedAt  DateTime?
  createdAt   DateTime @default(now())
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
```

### 14.4 Zero-Downtime Migration Pattern

```bash
# Step 1: New columns as NULLABLE (backward-compatible — deploy with no downtime)
npx prisma migrate dev --name "v12_step1_nullable"

# Step 2: Deploy app code handling both old and new schema

# Step 3: Backfill via BullMQ background job — NOT in migration
yarn workspace backend ts-node scripts/backfill-v12.ts

# Step 4: Add NOT NULL constraints + performance indexes in separate migration
npx prisma migrate dev --name "v12_step2_constraints"

# ⚠️ Never run prisma migrate deploy between 08:00–20:00 WAT
# Schedule at 02:00–04:00 WAT with rollback migration ready
# Never use prisma migrate rollback in production — apply forward migration only
```

---

## 15. INFRASTRUCTURE AS CODE

### 15.1 render.yaml

```yaml
services:
  - type: web
    name: taxbridge-api
    runtime: node
    region: frankfurt
    plan: starter
    buildCommand: yarn workspace backend build
    startCommand: node backend/dist/app.js
    healthCheckPath: /api/v2/monitoring/health
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
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "http://localhost:3000", "DIGITAX_MOCK_MODE": "true" }
    },
    "staging": {
      "extends": "base",
      "distribution": "internal",
      "android": { "buildType": "apk", "compileSdkVersion": 36, "targetSdkVersion": 35 },
      "cache": { "key": "taxbridge-v12-staging-{{ hashFiles('yarn.lock') }}" },
      "env": { "EXPO_PUBLIC_API_URL": "https://taxbridge-api-ker8.onrender.com", "SENTRY_DSN": "REPLACE" }
    },
    "production": {
      "extends": "base",
      "distribution": "store",
      "autoIncrement": true,
      "android": { "buildType": "app-bundle", "compileSdkVersion": 36, "targetSdkVersion": 35 },
      "ios": { "buildConfiguration": "Release" },
      "cache": { "key": "taxbridge-v12-prod-{{ hashFiles('yarn.lock') }}" },
      "env": { "EXPO_PUBLIC_API_URL": "https://taxbridge-api-ker8.onrender.com", "SENTRY_DSN": "REPLACE" }
    }
  },
  "submit": {
    "production": {
      "android": { "serviceAccountKeyPath": "./infra/google-play-service-account.json", "track": "internal" },
      "ios": { "appleId": "REPLACE", "ascAppId": "REPLACE" }
    }
  }
}
```

### 15.3 validateEnv.ts — First Import in app.ts

```typescript
// backend/src/validateEnv.ts
const REQUIRED_ALWAYS = [
  'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET',
  'NRS_API_KEY', 'PORT', 'NODE_ENV',
];
const REQUIRED_PRODUCTION = [
  'SENTRY_DSN', 'RENDER_EXTERNAL_URL', 'FLUTTERWAVE_SECRET', 'CBN_MPR',
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

### 16.1 Five-Stage Pipeline

**Stage 1 — Quality Gates (parallel, blocks all downstream)**

```yaml
lint-typecheck:
  gates:
    - yarn workspaces foreach -A run lint
    - yarn workspaces foreach -A run type-check             # 0 TypeScript errors
    - grep -rn "FIRS" . | grep -v node_modules             # → 0 (C-02)
    - grep -rn "withTiming.*[0-9]{3,4}" mobile/src | grep -v animation.ts  # → 0 (C-16)
    - grep -rn "CRA\b|consolidatedRelief|minTax" packages/contracts/src     # → 0
    - grep -rn "console\.log" backend/src                  # → 0 (C-26)
    - grep -rn "0\.2725\b" packages/contracts/src backend/src  # → 0 (C-27, both scopes)
    - grep '"compileSdkVersion": 36' mobile/eas.json | wc -l  # → ≥ 2
    - yarn i18n:check                                       # → exit 0
    - yarn prompts:verify                                   # → "11/11 modules"
    # PIT accuracy gate — must exit 0
    - npx ts-node -e "const {calculatePIT}=require('./packages/contracts/src');const r=calculatePIT({grossIncome:5000000,rentPaid:600000,pension:200000});if(Math.abs(r.taxLiability-632400)>1)process.exit(1)"
    # Penalty accuracy gate — must exit 0
    - npx ts-node -e "const {calculatePenalty}=require('./packages/contracts/src');const r=calculatePenalty({entityType:'company',daysLate:32,taxAmountDue:0,disclosurePhase:'after_assessment'});if(r.netPenalty!==375000)process.exit(1)"
```

**Stage 2 — Tests (requires Stage 1)**

```yaml
test:
  services: [postgres:16-alpine, redis:7-alpine]
  steps:
    - npx prisma migrate deploy
    - yarn workspace backend ts-node prisma/seeds/smokeTestUser.ts
    - yarn workspaces foreach -A run test -- --coverage --ci --runInBand
    - npx nyc check-coverage --lines 95 --functions 95 --branches 90
```

**Stage 3 — Security (parallel with Stage 2)**

```yaml
security:
  steps:
    - npx snyk test --all-projects --severity-threshold=high   # 0 HIGH/CRITICAL
    - head -5 backend/src/app.ts | grep -q "validateEnv"       # validateEnv.ts is first import
    - git ls-files | grep -E '\.env\.' | grep -v example       # → 0 (no .env committed)
    - grep -q "updatedAt" backend/prisma/schema.prisma && grep -B5 "updatedAt" backend/prisma/schema.prisma | grep -q "AuditEvent" && exit 1 || exit 0  # AuditEvent must have no updatedAt
    - grep -q '@@unique(\[orgId, userId\])' backend/prisma/schema.prisma  # OrgMember constraint present
    - grep -rn "0\.2725\b" backend/src packages/contracts/src  # → 0 (CBN_MPR never hardcoded)
```

**Stage 4 — Builds (requires Stages 2 + 3)**

```yaml
builds:
  build-backend: yarn workspace backend build
  build-admin:   yarn workspace admin build
  build-mobile:  eas build --platform android --profile staging --non-interactive
```

**Stage 5 — Deploy + Smoke (requires Stage 4)**

```yaml
deploy-backend:
  if: github.ref == 'refs/heads/main'
  environment: production
  steps:
    - Validate all production secrets present (CBN_MPR required)
    - Deploy to green slot (Render blue-green)
    - Health check green: GET /api/v2/monitoring/health → {"status":"healthy"}
    - Canary: 5% traffic → monitor 2min (error rate < 0.5%)
    - Canary: 25% traffic → monitor 3min
    - Swap: green → production 100%
    - Rollback trigger: error rate > 1% at any stage → swap back immediately

smoke-test:
  steps:
    - GET  /api/v2/monitoring/health                          → {"status":"healthy"}
    - POST /api/v1/auth/login (smoke credentials)            → accessToken present
    - GET  /api/v1/dashboard                                 → stats.taxHealthScore is integer
    - POST /api/v1/filings/nil                               → 200 + filingReference
    - GET  /api/v1/compliance/penalty-estimate               → netPenalty is number
    - VIEWER role → PATCH /api/v2/rbac/assign                → 403
    - Admin panel GET taxbridge.vercel.app                   → HTTP 200

release (idempotent):
  - git tag v12.0.0 2>/dev/null || echo "tag exists"
  - gh release create v12.0.0 --skip-if-exists
```

### 16.2 Husky Pre-Commit Gates

```bash
#!/usr/bin/env sh
# .husky/pre-commit
set -e

FAIL=0
check() {
  local count=$(grep -rn "$1" $2 --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | wc -l)
  [ "$count" -gt "0" ] && echo "❌ $3 ($count occurrences)" && FAIL=1
}

check "FIRS"          "backend/src mobile/src admin/src packages" "FIRS found — use NRS (C-02)"
check "NRSt"          "mobile/src/i18n"                            "NRSt typo — use NRS"
check "console\.log"  "backend/src"                                "console.log in backend — use Pino (C-26)"

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

export const httpDuration    = safeMetric(() => new Histogram({ name: 'taxbridge_api_request_duration_seconds',
  labelNames: ['route', 'method', 'status'], buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5] }), 'taxbridge_api_request_duration_seconds');
export const nrsStampSuccess = safeMetric(() => new Counter({ name: 'taxbridge_nrs_stamp_success_total', labelNames: ['orgId'] }), 'taxbridge_nrs_stamp_success_total');
export const nrsStampFailure = safeMetric(() => new Counter({ name: 'taxbridge_nrs_stamp_failure_total', labelNames: ['reason'] }), 'taxbridge_nrs_stamp_failure_total');
export const anomalyDetected = safeMetric(() => new Counter({ name: 'taxbridge_anomaly_detected_total', labelNames: ['signal', 'severity'] }), 'taxbridge_anomaly_detected_total');
export const dlqDepth        = safeMetric(() => new Gauge({ name: 'taxbridge_dlq_depth', labelNames: ['queue_name'] }), 'taxbridge_dlq_depth');
export const penaltyEstimate = safeMetric(() => new Counter({ name: 'taxbridge_penalty_estimate_total', labelNames: ['taxType'] }), 'taxbridge_penalty_estimate_total');
// Circuit state: 0 = closed (healthy), 1 = half-open, 2 = open (NRS unreachable)
// Referenced by Grafana alert in §17.3 — must be exported from this file
export const nrsCircuitState = safeMetric(() => new Gauge({ name: 'taxbridge_nrs_circuit_state' }), 'taxbridge_nrs_circuit_state');
// nrsService.ts must call nrsCircuitState.set(0|1|2) on every circuit transition
export { register };
```

### 17.2 Endpoints

```
GET /api/v2/monitoring/health  — PUBLIC — no auth required — Render health check
  Response: { status: 'healthy', version, ts, env, nrs: { state } }

GET /api/v2/monitoring/metrics — ADMIN only — Prometheus text format
  Auth: authenticate + requireRole('ADMIN')
  Content-Type: text/plain; version=0.0.4
```

### 17.3 Grafana Alert Thresholds

```yaml
# infra/grafana/alerts.yml
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
// backend/src/cron/orchestrator.ts — single registry, no scattered setInterval
const CRON_JOBS = [
  { name: 'taxHealthSnapshot',  schedule: '0 */6 * * *',   handler: runTaxHealthSnapshotAll },
  { name: 'riskScoring',        schedule: '0 3 * * *',      handler: runRiskScoringCron },    // 04:00 WAT
  { name: 'nrsQueueDrain',      schedule: '*/30 * * * *',   handler: drainNrsQueue },
  { name: 'complianceReminder', schedule: '0 8 * * *',      handler: sendComplianceReminders }, // 09:00 WAT
  { name: 'anomalyDigest',      schedule: '0 7 * * 1',      handler: sendWeeklyAnomalyDigest }, // Mon 08:00 WAT
  { name: 'sessionCleanup',     schedule: '0 1 * * *',      handler: expireOldSessions },    // 02:00 WAT
  { name: 'keepAlive',          schedule: '*/14 * * * *',   handler: pingKeepAlive },          // prevent Render cold-start
];
```

---

## 18. ROLLBACK MECHANISMS

```bash
# Backend — Render blue-green (execute within 60s of smoke failure)
render traffic swap --from prod --to blue --api-key "$RENDER_API_KEY"
# Blue slot holds previous release. Never delete until next successful deploy.

# Admin — Vercel
npx vercel rollback --token="$VERCEL_TOKEN" --cwd admin

# Mobile — OTA (JS-only regressions; no native, no SDK, no schema changes)
eas update --branch production --message "revert: rollback" \
  --git-commit-hash $(git rev-parse HEAD~1)

# Database — NEVER prisma migrate rollback in production
# Apply a forward migration that undoes the change:
# Step 1: Write a new migration reversing the schema change
npx prisma migrate dev --name "v12_hotfix_$(date +%Y%m%d)"   # LOCAL dev only — generates SQL
# Step 2: Deploy that new migration to production
npx prisma migrate deploy                                       # PRODUCTION — applies committed migrations only

# Rollback decision matrix:
# Error rate > 1%      → blue-green swap within 60s
# P99 latency > 5s     → blue-green swap within 60s
# DB migration panic   → forward migration only — no rollback
# Mobile crash > 1%    → OTA if JS-only; full EAS build if native
```

---

## 19. TESTING THRESHOLDS

### 19.1 Coverage Requirements

```
Lines:      ≥ 95%
Functions:  ≥ 95%
Branches:   ≥ 90%
Passing:    ≥ 550 tests, 0 failures
```

### 19.2 Mandatory Test Cases

```typescript
// contracts/penalties.test.ts
// Company, 32 days late, ₦0 tax due:
//   lateFiling = 250,000 + 125,000 = 375,000 | interest = 0 | netPenalty = 375,000
// Individual, 1 day late, ₦100,000 due, before_audit waiver → netPenalty = 0

// contracts/pit.test.ts
// ₦5M gross + ₦600k rent + ₦200k pension → taxLiability === 632,400 (±₦1)

// routes/filings/nil.test.ts
// POST → 200 with filingReference on first call
// POST (duplicate) → 409 with existing filingReference
// AuditEvent created: orgId, action='FILE', after.isNil=true

// middleware/requireRole.test.ts
// VIEWER → admin route → 403 + error: 'INSUFFICIENT_ROLE'
// OWNER  → owner route → passes through

// middleware/tenant.test.ts
// orgA user → orgB data → 403 + error: 'ORG_ACCESS_DENIED'

// services/vatCredit.test.ts
// getVATCreditPosition never recomputes — reads VATCreditBalance from DB (C-22)

// routes/dashboard.test.ts
// DB failure → 200 with FALLBACK_* (not 500) (C-07, C-12)
// Cache hit: second call within 120s → meta.cached === true
```

### 19.3 Performance Gates

```
k6 / Artillery:
  2000 concurrent users × 60 seconds
  GET /api/v1/dashboard P95 < 200ms | P99 < 800ms
  POST /api/v1/filings/nil P95 < 500ms

2G simulation (Chrome DevTools throttling):
  Dashboard initial paint:  < 800ms first meaningful paint
  Dashboard data visible:   < 2000ms on simulated 2G (RTT 400ms, 750kbps)

Lighthouse (admin panel):
  Performance: ≥ 98 | Accessibility: ≥ 98 | Best Practices: ≥ 100 | SEO: ≥ 90

React Native Profiler:
  Skeleton → content transition:  0 dropped frames
  Layout shift on data arrival:   0px
  Dashboard zone reveal:          ≥ 55fps sustained
```

---

## 20. MODULE CONTEXT LOADING

```typescript
// prompts/loaders/prompt-loader.ts
// yarn prompts:verify → "✅ 11/11 modules loaded (M00–M10)"

const TASK_MODULES: Record<string, string[]> = {
  'backend-api':              ['M00', 'M01'],
  'mobile-ui':                ['M00', 'M02', 'M08'],
  'dashboard-ux':             ['M00', 'M02', 'M08'],
  'mobile-enhancements':      ['M00', 'M02', 'M08', 'M09'],
  'ai-features':              ['M00', 'M01', 'M03', 'M05'],
  'nrs-compliance':           ['M00', 'M01', 'M04', 'M05'],
  'compliance-intelligence':  ['M00', 'M01', 'M05', 'M10'],
  'devops':                   ['M00', 'M06'],
  'growth':                   ['M00', 'M07'],
  'education':                ['M00', 'M02', 'M09', 'M10'],
  'full-audit':               ['M00','M01','M02','M03','M04','M05','M06','M07','M08','M09','M10'],
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

### P0 — Session 1 (Blocking — Must Complete Before Any Feature Work)

```
1.  Run 8-step session opening (§3). Stop immediately on any gate failure.
2.  yarn prompts:verify → "11/11 modules"
3.  Fix BUG-S01: @expo-google-fonts/inter + useFonts in App.tsx
4.  Fix BUG-S02: sed -i 's/NRSt/NRS/g' mobile/src/i18n/en.json mobile/src/i18n/pidgin.json
5.  Fix BUG-S03/S04: initImmediate: false in i18n config; add common.offline to both locales
6.  CREATE: mobile/src/design-system/animation.ts (§12.1) ← ALL subsequent files import this
7.  CREATE: mobile/src/design-system/ngn.ts (§1.4)
8.  CREATE: mobile/src/design-system/tokens.ts
9.  CREATE: mobile/src/contexts/ThemeContext.tsx
10. CREATE: mobile/src/components/dashboard/DashboardZone.tsx (§12.2)
11. CREATE: mobile/src/components/dashboard/DashboardSkeleton.tsx (§12.3)
12. REPLACE: TaxHealthGauge → SVG arc (§12.4). buildArcPath + scoreToStroke marked 'worklet'.
13. CREATE: mobile/src/components/shared/SectionState.tsx
14. CREATE: mobile/src/components/shared/InlineError.tsx
15. VERIFY/CREATE: backend/src/validateEnv.ts (§15.3) — first import in app.ts
16. VERIFY/UPDATE: backend/src/app.ts — express.raw before express.json; 0.0.0.0; PORT from env
17. VERIFY/CREATE: backend/src/lib/logger.ts (Pino, PII redact)
18. VERIFY/CREATE: backend/src/metrics.ts (prom-client singleton §17.1)
19. VERIFY/CREATE: backend/src/middleware/requireRole.ts
20. VERIFY/CREATE: backend/src/middleware/tenant.ts (resolveOrgContext §1.3)
21. VERIFY/CREATE: backend/src/services/audit.ts (writeAuditEvent §8.1)
22. CREATE: backend/src/services/dashboardService.ts (each fn: .catch → FALLBACK_*)
23. CREATE: backend/src/routes/v1/dashboard.ts — Promise.all, Redis 120s TTL
24. CREATE: mobile/src/hooks/useDashboard.ts
25. UPDATE: mobile/src/screens/DashboardScreen.tsx → canonical zone structure (§12.5)
26. VERIFY: POST /api/v1/filings/nil (MOD-21/C-21)
27. VERIFY: prom-client singleton + /api/v2/monitoring/health
28. VERIFY: resolveOrgContext on all business routes (C-31)
29. UPDATE: prisma/schema.prisma — all enums + models (§14.1-14.3)
30. RUN: npx prisma migrate dev --name "v12_foundation"    # LOCAL only; CI/CD uses prisma migrate deploy
```

CI gate after P0: all Phase 1 Validation commands in §22.1 must pass.

### P1 — Sprint 1

```
A. SectionState on all conditional dashboard sections
B. ThemeContext + useTheme() across all components
C. TaxHealthSnapshot model + /trends endpoint + sparklines
D. Multi-deadline ComplianceCalendar with "File Now" CTAs
E. computeQuickActions() urgency sort (§12.6)
F. OfflineSyncStatus in AMBIENT zone + NetInfo listener
G. Pidgin error text in useNrsHealth
H. gaugeMode useMemo + compact/expanded (§12.4)
I. scale(0.97) Pressable on all 6 interactive dashboard elements (C-20)
J. ExplainMyTax component — 7 keys, offline-safe, bundled
K. SME risk scoring cron (03:00 WAT daily)
L. @shopify/flash-list — replace ALL FlatList instances
M. Biometric login — expo-local-authentication (§6.2)
N. Haptic feedback on all interactions (§12.8)
```

### P1 — Feature Build

```
MOD-22: VAT filing wizard (IRN generation + VATCreditBalance carryforward)
MOD-23: WHT remittance (rate decision tree + exemption check C-23)
MOD-25: PAYE payroll (calculatePIT per employee; gate: ₦5M → ₦632,400 ±₦1)
MOD-21: NIL return screen (if not production-verified)
MOD-26: Document vault (AES-256-GCM, Cloudflare R2, 5-year retention)
MOD-27: Multi-org team management (5 roles, OrgMember)
MOD-40: TaxAcademy Lessons 1–12 + quizzes + Lottie confetti
TIN + CAC onboarding validation routes (§6.7)
```

### P2 — Scale + AI

```
MOD-35: calculateTaxOptimizer() — AI deduction suggestions
MOD-37: Stripe billing (subscription plans, feature gating by orgId)
MOD-43: Lottie confetti on milestone events
V12-04: /api/v3 versioned gateway (backward-compatible)
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
grep -rn "0\.2725\b" packages/contracts/src backend/src                                          # → 0 (C-27)
grep 'zone="' mobile/src/screens/DashboardScreen.tsx | wc -l                                    # → 5
grep -rn "No anomal\|noAnomal" mobile/src                                                        # → 0
grep -rn "await.*router\|router.*await" mobile/src/screens/DashboardScreen.tsx                  # → 0
grep '"compileSdkVersion": 36' mobile/eas.json | wc -l                                          # → ≥ 2
yarn prompts:verify                                                                              # → "11/11 modules"
yarn i18n:check                                                                                  # → exit 0
npm test --workspaces -- --coverage                                                              # → ≥ 550 passing, 0 failing
npx nyc check-coverage --lines 95 --functions 95 --branches 90                                  # → pass
npx snyk test --all-projects --severity-threshold=high                                          # → 0 HIGH/CRITICAL
# PIT accuracy gate (must exit 0):
npx ts-node -e "const {calculatePIT}=require('./packages/contracts/src');const r=calculatePIT({grossIncome:5000000,rentPaid:600000,pension:200000});if(Math.abs(r.taxLiability-632400)>1)process.exit(1)"
# Penalty accuracy gate (must exit 0):
npx ts-node -e "const {calculatePenalty}=require('./packages/contracts/src');const r=calculatePenalty({entityType:'company',daysLate:32,taxAmountDue:0,disclosurePhase:'after_assessment'});if(r.netPenalty!==375000)process.exit(1)"
```

### 22.2 Production Health Criteria

```
GET /api/v2/monitoring/health → {"status":"healthy"} within 500ms
GET /api/v1/dashboard (cache hit) P95 < 50ms
GET /api/v1/dashboard (cache miss) P95 < 800ms
POST /api/v1/filings/nil P95 < 500ms
Admin panel Lighthouse performance ≥ 98
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
□ express.raw('/webhooks') precedes express.json() in app.ts
□ Flutterwave HMAC uses rawBody.toString('utf8') + timingSafeEqual
□ Sentry PII regex order: BVN(11d) → ACCT(10d) → TIN(8d)
□ prom-client singleton: global.__taxbridge_prom_registry guard present
□ Redis cache write is non-blocking (.catch() fire-and-forget)
□ AuditEvent model has no updatedAt field
□ All 7 cron jobs registered in orchestrator (including keepAlive */14)
□ render.yaml committed to repo root
□ CBN_MPR in Render environment variables (sync: false)
□ EAS staging + production: compileSdkVersion=36, targetSdkVersion=35
□ SENTRY_DSN in EAS staging + production env blocks
□ .env files not committed (git ls-files | grep '\.env\.' | grep -v example → 0)
□ Blue-green green slot passes health check before traffic swap
□ Canary at 5% observed for ≥ 2min with error rate < 0.5%
□ iOS eas.json production entry has buildConfiguration: "Release"
□ jose installed in admin workspace (Edge Runtime JWT)
□ All 7 smoke-test checks pass post-deploy
□ SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, RENDER_API_KEY, CBN_MPR in GitHub Secrets
□ OrgMember.orgId present in all business model queries
□ resolveOrgContext applied to all business routes
□ requireRole applied to all non-public routes
□ BiometricAuth falls through to PIN — never blocks login
□ All FlatList instances replaced with @shopify/flash-list (grep -rn "FlatList" mobile/src → 0)
□ prisma/seeds/smokeTestUser.ts exists and SMOKE_TEST_EMAIL credentials are deterministic
```

---

## 23. EMERGENCY PROTOCOLS

| Symptom | Root Cause | Remediation |
|---|---|---|
| TypeScript errors after Prisma change | Generated types referenced | Replace with `(prisma as any)` (C-01) |
| WHT professional fee shown as 5% | Rate lookup defaulting to construction rate | Check category mapping — only construction/contracts is 5%; professional fees are 10% (C-10, §2.3) |
| EAS build fails (AAR incompatibility) | Wrong SDK version | Verify `compileSdkVersion: 36, targetSdkVersion: 35` in eas.json |
| NRS circuit stuck open | NRS API down | Set `DIGITAX_MOCK_MODE=true` in Render env → unblocks filing |
| Raw i18n keys on device | `initImmediate: true` | Set `initImmediate: false` → `eas update --branch production` |
| Admin 500 on cold start | Missing FALLBACK_* | All 3 admin routes must `.catch(() => FALLBACK_*)` (C-12) |
| Gauge not rendering | worklet missing or wrong SVG version | Verify `'worklet'` on `buildArcPath` + `scoreToStroke` |
| Composite API > 800ms P99 | Redis miss or sequential await | Verify TTL=120s; verify Promise.all not sequential |
| prom-client crash on hot reload | Double registration | Verify `global.__taxbridge_prom_registry` singleton guard |
| Flutterwave HMAC always false | Buffer stringification | Use `rawBody.toString('utf8')` not `JSON.stringify(req.body)` |
| Sentry masking years (2025/2026) | Regex order wrong | BVN(11d) must precede ACCT(10d) must precede TIN(8d) |
| Penalty calculation wrong | CBN_MPR hardcoded | Read from `process.env.CBN_MPR` — never literal value |
| Accountant sees wrong org data | revokedAt unchecked | Add `revokedAt: null` to AccountantClient query (C-28) |
| Zone animation not playing | visible prop false | Verify `data !== undefined` before setting `visible={true}` |
| Skeleton layout shift | Geometry mismatch | Measure SkeletonBlock height vs real component height |
| OTA update not applying | Native code changed | Full EAS build required |
| 15% ETR on individual PIT | Old code path | Delete — NTA 2025 §47 scope is corporate MNE only |
| "No anomalies" text visible | empty prop not null | Set `empty={null}` on SectionState for anomaly section (C-19) |

---

## 24. TAXBRIDGE STANDARD

| Principle | Enforcement |
|---|---|
| Tax numbers are defensible | Every calculation from `@taxbridge/contracts`, cites NTA 2025 §XX |
| Offline is invisible | React Query cache + AsyncStorage queue; OfflineSyncStatus in AMBIENT |
| Pidgin is first-class | Natural Lagos Pidgin; CI blocks raw keys and literal translations |
| Performance is trust | Single composite call; FlashList; 60fps gauge; 2G < 2s |
| Multi-tenant always | `orgId` on every business query; `resolveOrgContext` on every business route |
| Audit trail is immutable | AuditEvent has no `updatedAt`; all writes awaited (C-25) |
| Gestures are instant | Visual ack + haptic ≤ 100ms; `router.push()` never awaited |
| Empty states help | Never blank; silence on no anomalies (C-19); errors = InlineError + retry |
| WCAG 2.2 AA everywhere | 3-channel status indicators; SVG gauge with accessibilityLabel |
| Compliance is proactive | NIL returns required; penalty estimates before deadlines; ExplainMyTax inline |

> **Build for:** A first-time filer on a Tecno Spark, on 2G in Lagos, with a PAYE deadline in 3 days, who speaks Pidgin. If it works for them, it works for everyone.

---

**TAXBRIDGE V12 MASTER PROMPT**
Path: `/prompts/v12_master_prompt.md` | Repo: `github.com/Scardubu/taxbridge`
Effective: 2026-03-01 | Supersedes: V10.3 + V11.0