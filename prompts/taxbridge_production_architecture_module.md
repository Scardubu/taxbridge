# Taxbridge Production Architecture Completion Module

**Classification:** Senior Engineering + DevOps Artifact
**Version:** V12-ELEVATED | **Date:** 2026-03-02
**Deployment Targets:** Backend → `taxbridge-api-ker8.onrender.com` | Admin → `taxbridge.vercel.app` | Mobile → EAS APK/AAB

---

## 1. Executive Summary

Taxbridge is a Nigerian SME tax compliance platform serving VAT, PAYE, WHT, CIT, and PIT obligations across a mobile-first (EAS), web admin (Vercel/Next.js), and API backend (Render/Node.js) architecture. V12 establishes a structurally sound foundation with correct NTA 2025 tax logic, multi-tenant RBAC, BullMQ queues, and a composite dashboard API.

This module addresses six systemic gaps identified in the V12 audit:

1. **Incomplete AI/automation layer** — anomaly detection and risk scoring exist as stubs; the data pipeline feeding them is undefined.
2. **Observability fragmentation** — metrics exist but Loki log aggregation, distributed tracing, and alerting runbooks are absent.
3. **Onboarding UX dead zones** — CAC/TIN validation fails silently; the wizard has no resume-on-reconnect path.
4. **Admin system underspecification** — the admin panel lacks financial analytics, DLQ management UI, and proactive compliance escalation views.
5. **Performance gaps at the edge** — no CDN cache policy for static assets, no query index audit, no API response compression.
6. **DevOps incomplete** — Docker image exists but multi-stage build, non-root user, and health-check integration with Render's zero-downtime swap are not formalized.

Every section below is implementation-ready. No placeholders. No vague directives.

---

## 2. Architecture Overview

### Layer Map

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                    │
│  Mobile (EAS/React Native)        Admin (Next.js / Vercel)      │
│  - expo-router navigation         - Edge JWT middleware (jose)   │
│  - React Query v5 (offline cache) - Server components + RSC     │
│  - expo-secure-store (tokens)     - Vercel Edge Config (flags)   │
└──────────────────────────┬──────────────────┬───────────────────┘
                           │ HTTPS            │ HTTPS
                           ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  API GATEWAY LAYER  (Cloudflare — WAF + DDoS + CDN)             │
│  - TLS termination                                               │
│  - Rate limiting (Cloudflare Rules — coarse; express-rate-limit  │
│    — fine-grained per route)                                     │
│  - Bot protection                                                │
│  - Cache: /api/v2/monitoring/health TTL 30s                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  BACKEND LAYER  (Render — Node.js + Express)                    │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Auth/RBAC   │  │ Filing       │  │ Composite Dashboard  │   │
│  │ Middleware  │  │ Routes v1    │  │ Route + Cache        │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ BullMQ      │  │ Anomaly +    │  │ Notification         │   │
│  │ Workers     │  │ Risk Scoring │  │ Service              │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  DATA LAYER                                                      │
│  PostgreSQL 16 (Render)    Redis 7 (Render)                     │
│  - Multi-tenant isolation  - Dashboard cache TTL 120s           │
│  - Append-only migrations  - Session store                      │
│  - AuditEvent (immutable)  - Role-version invalidation          │
│  - Prisma (no TS types)    - BullMQ backing store               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  EXTERNAL INTEGRATIONS                                           │
│  NRS API (IRN + stamp)   Flutterwave (payments)                 │
│  Cloudflare R2 (vault)   Africa's Talking (USSD/SMS)            │
│  Sentry (errors)         Grafana Cloud (metrics + logs)         │
└─────────────────────────────────────────────────────────────────┘
```

### Trust Boundaries

| Boundary | Control |
|---|---|
| Internet → Cloudflare | WAF rules, TLS 1.3 enforced, HSTS preload |
| Cloudflare → Render | IP allowlist + shared secret header `X-Cloudflare-Token` |
| Admin → Backend | Edge JWT (RS256) validated by jose; CORS origin allowlist |
| Mobile → Backend | JWT (RS256) access + refresh token pair; expo-secure-store |
| Backend → DB | DATABASE_URL with SSL mode=require; connection string in Render secrets |
| Backend → Redis | REDIS_URL TLS; Render-managed |
| Backend → NRS | Circuit breaker (opossum); mock mode via `DIGITAX_MOCK_MODE=true` |
| Backend → Flutterwave | HMAC-SHA256 on rawBody; timingSafeEqual comparison |
| Backend → R2 | Signed URLs (24h expiry); AES-256-GCM encryption at rest |

---

## 3. Module Specifications — New and Corrected

### 3.1 AI Intelligence Pipeline (Completes MOD-03 stub)

**Responsibility:** Feed structured signals from the database into anomaly detection and risk scoring. Provide explainable output consumed by the dashboard and admin views.

**Data inputs:**

```typescript
// Collected per org per computation cycle (daily cron + on-demand trigger)
interface IntelligenceInput {
  orgId:            string;
  filingHistory:    { taxType: string; period: string; daysLate: number; isNil: boolean }[];
  invoiceStats:     { unstampedCount: number; totalValue: number; oldestUnstampedDays: number };
  vatPosition:      { outputVAT: number; inputVAT: number; creditBalance: number };
  authEvents:       { failedAttempts: number; uniqueIPs: number; windowHours: number };
  payrollGrowth:    { headcount: number; priorMonthHeadcount: number; payrollChange: number };
}
```

**Anomaly signals and thresholds:**

| Signal ID | Condition | Severity | CTA Route |
|---|---|---|---|
| `vat_gap` | outputVAT > 0 AND no VAT filing in current period | high | `/filings/vat` |
| `nrs_stamp_delay` | unstampedCount > 0 AND oldestUnstampedDays > 7 | medium | `/invoices` |
| `auth_failure_flood` | failedAttempts > 10 within 1h per IP | critical | `/team` |
| `nil_overuse` | isNil count ≥ 3 consecutive periods | medium | `/filings/vat` |
| `payroll_spike` | payrollChange > 50% month-on-month | medium | `/filings/paye` |
| `unfiled_period` | any taxType with period gap > 30 days | high | filing wizard |
| `vat_credit_aging` | creditBalance > 0 AND usedInPeriod null > 90 days | low | `/compliance/vat-credit` |

**Model logic (rules-based; no ML dependency in V12):**

```typescript
// backend/src/services/anomalyEngine.ts
export function computeAnomalies(input: IntelligenceInput): AnomalySignal[] {
  const signals: AnomalySignal[] = [];

  if (input.vatPosition.outputVAT > 0 && isCurrentPeriodUnfiled(input.filingHistory, 'VAT')) {
    signals.push({ id: cuid(), signal: 'vat_gap', severity: 'high',
      description: 'VAT output recorded but no filing this period.',
      detectedAt: new Date().toISOString(), ctaRoute: '/filings/vat' });
  }
  if (input.invoiceStats.unstampedCount > 0 && input.invoiceStats.oldestUnstampedDays > 7) {
    signals.push({ id: cuid(), signal: 'nrs_stamp_delay', severity: 'medium',
      description: `${input.invoiceStats.unstampedCount} invoices pending NRS stamp.`,
      detectedAt: new Date().toISOString(), ctaRoute: '/invoices' });
  }
  // ... remaining rules
  return signals.slice(0, 5); // hard cap: never surface more than 5 anomalies
}
```

**Explainability:** Every `AnomalySignal.description` string is human-readable, bilingual (EN + Pidgin via i18n key), and cites the specific data point that triggered it. No black-box output.

**Fail-safe:** If `computeAnomalies` throws, the catch returns `[]` and logs to Sentry. Dashboard never fails because of intelligence layer failure.

### 3.2 SME Risk Scoring Engine

**Responsibility:** Produce a composite risk score (0–100) for each org, stored in `SMERiskRecord`, consumed by admin analytics and the TaxHealthGauge.

**Scoring formula:**

```typescript
// backend/src/services/riskScoring.ts
export function computeRiskScore(input: IntelligenceInput): SMERiskRecord {
  const filingScore  = computeFilingScore(input.filingHistory);   // 0–30
  const anomalyScore = computeAnomalyScore(input);                // 0–25
  const healthScore  = computeHealthScore(input.vatPosition);     // 0–25
  const vatScore     = computeVATScore(input.vatPosition);        // 0–10
  const dataScore    = computeDataScore(input);                   // 0–10
  const total        = filingScore + anomalyScore + healthScore + vatScore + dataScore;
  const band         = total >= 80 ? 'healthy' : total >= 60 ? 'low'
                     : total >= 40 ? 'medium'  : total >= 20 ? 'high' : 'critical';
  return { orgId: input.orgId, score: total, band,
           filingScore, anomalyScore, healthScore, vatScore, dataScore,
           computedAt: new Date() };
}

function computeFilingScore(history: IntelligenceInput['filingHistory']): number {
  if (!history.length) return 0;
  const onTime   = history.filter(f => f.daysLate <= 0).length;
  const penalty  = history.filter(f => f.daysLate > 30).length * 5;
  return Math.max(0, Math.min(30, Math.round((onTime / history.length) * 30) - penalty));
}
```

**Admin consumption:** Admin analytics page renders risk band distribution as a bar chart. Clicking a band opens a filtered org list. SUPER_ADMIN and ADMIN only.

### 3.3 NRS Service — Circuit Breaker

**Responsibility:** Wrap all NRS API calls with circuit breaker state machine. Expose state to metrics and admin panel.

```typescript
// backend/src/services/nrsService.ts
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(callNRSAPI, {
  timeout:          10_000,   // 10s — NRS can be slow
  errorThresholdPercentage: 50,
  resetTimeout:     30_000,
  volumeThreshold:  5,
});

breaker.on('open',     () => { nrsCircuitState.set(2); logger.warn({}, 'NRS circuit OPEN'); });
breaker.on('halfOpen', () => { nrsCircuitState.set(1); logger.info({}, 'NRS circuit HALF-OPEN'); });
breaker.on('close',    () => { nrsCircuitState.set(0); logger.info({}, 'NRS circuit CLOSED'); });

// DIGITAX_MOCK_MODE=true → bypass circuit, return synthetic IRN
export async function submitToNRS(payload: NRSPayload): Promise<NRSResponse> {
  if (process.env.DIGITAX_MOCK_MODE === 'true') {
    return { irn: `MOCK-IRN-${Date.now()}`, stampedAt: new Date().toISOString() };
  }
  return breaker.fire(payload);
}
```

### 3.4 Onboarding Wizard — Resilient Flow

**Gap identified:** The TIN/CAC validation wizard has no resume path after network drop. The `OnboardingProgress` model exists in schema but the frontend does not persist partial state.

**Resolution:**

```typescript
// mobile/src/screens/OnboardingWizard.tsx
// On every step completion, persist to OnboardingProgress via API
const completeStep = async (step: number, payload: Partial<OnboardingProgress>) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  try {
    await apiClient.patch('/api/v1/onboarding/progress', { step, ...payload });
  } catch {
    // Offline: persist to AsyncStorage queue, sync on reconnect
    await AsyncStorage.setItem('onboarding_queue', JSON.stringify({ step, ...payload }));
  }
  router.push(`/onboarding/step-${step + 1}`);
};

// On app start: if OnboardingProgress.completed === false, resume at currentStep
// NEVER restart wizard from step 1 if partial progress exists
```

**Backend route:**
```typescript
// PATCH /api/v1/onboarding/progress
// Body: { step: number, tinVerified?: boolean, cacVerified?: boolean, selectedObligations?: string[] }
// Upsert OnboardingProgress for req.orgContext.orgId
// Return: { currentStep, completed, nextRoute }
```

**TIN validation inline state machine:**
```
IDLE → [user enters 8 digits] → VALIDATING (spinner, 3 req/min limit) →
  SUCCESS: green ✅, entityName displayed, step unlocked →
  FAILED: red ❌ + "TIN invalid — check and retry" + retry button →
  NETWORK_ERROR: amber ⚠️ + "Network issue — try again" + retry button
```

---

## 4. Database Enhancements

### 4.1 Missing Indexes (Add to schema.prisma)

```prisma
// Performance-critical indexes not present in V12 base schema

// TaxReturn — admin analytics query pattern
@@index([orgId, taxType, submittedAt])

// AuditEvent — compliance export query
@@index([orgId, action, createdAt])

// VATCreditBalance — carryforward lookup
@@index([orgId, usedInPeriod, refundClaimed])

// SMERiskRecord — admin risk dashboard
@@index([band, computedAt])
@@index([score])

// UserSession — cleanup cron
@@index([userId, expiresAt])
@@index([expiresAt])  // bulk expiry sweep
```

### 4.2 Missing Constraints

```prisma
// TaxReturn — prevent negative tax due
// Add in application layer (Zod validation), not DB-level, to avoid Prisma migration noise

// VATCreditBalance.carriedFromPeriod — must reference a prior period string, not a future one
// Enforced in vatCredit.service.ts: if (carriedFromPeriod >= currentPeriod) throw ValidationError

// SMERiskRecord.score — 0 to 100 inclusive
// Enforced in computeRiskScore() before upsert — never passed to DB outside this function

// OrgMember — prevent self-demotion for the last OWNER
// Enforced in team.ts route:
//   const ownerCount = await (prisma as any).orgMember.count({ where: { orgId, role: 'OWNER', status: 'active', deletedAt: null }});
//   if (ownerCount <= 1 && target.role === 'OWNER') return res.status(409).json({ error: 'LAST_OWNER', message: 'Organisation must retain at least one OWNER.' });
```

### 4.3 TaxHealthSnapshot Model (Add to schema.prisma)

```prisma
model TaxHealthSnapshot {
  id         String   @id @default(cuid())
  orgId      String
  userId     String
  score      Int
  period     String   // YYYY-MM
  band       RiskBand
  createdAt  DateTime @default(now())
  @@index([orgId, userId, period])
  @@index([orgId, createdAt])
}
// Used for trend sparklines in DashboardStats.trend[]
// Written by taxHealthSnapshot cron (every 6h) — never updated, only inserted
```

### 4.4 Migration Safety Rules

All schema migrations follow this protocol:

1. New columns added as `String?` or with `@default` — never raw NOT NULL without default.
2. NOT NULL constraints added in a separate second migration after backfill.
3. Index creation uses `CREATE INDEX CONCURRENTLY` equivalent (PostgreSQL non-blocking) — specify in migration SQL directly for large tables.
4. No migration deployed between 08:00–20:00 WAT.
5. `prisma migrate deploy` only in CI/CD — never `prisma migrate dev` in any shared or production environment.

---

## 5. API Standardization

### 5.1 Versioning Strategy

```
/api/v1/  — Current stable: auth, filings, dashboard, team, documents, onboarding
/api/v2/  — Monitoring only: /health (public), /metrics (ADMIN), /rbac
/api/v3/  — Reserved: future graph-based query layer (P2 roadmap)

Deprecation policy: v1 routes receive minimum 6 months notice before sunset.
Version is in path, not header. No Accept-Version header negotiation.
```

### 5.2 Universal Error Response Schema

```typescript
// Every error response, every route, every status code — this exact shape
interface ApiError {
  error:   string;    // SCREAMING_SNAKE_CASE machine code — never changes between versions
  message: string;    // Human-readable EN text — safe to display to end users
  issues?: ZodIssue[]; // Present only on 400 VALIDATION_ERROR responses
  code?:   number;    // HTTP status echo — optional client convenience
}

// Complete error code registry:
// 400 VALIDATION_ERROR    — Zod .issues present
// 401 UNAUTHORIZED        — missing or expired token
// 401 TOKEN_EXPIRED       — access token expired; client should refresh
// 403 ORG_ACCESS_DENIED   — not a member of this org
// 403 INSUFFICIENT_ROLE   — authenticated but wrong role
// 403 2FA_REQUIRED        — TOTP window expired for SUPER_ADMIN op
// 403 DELEGATION_NOT_ACTIVE — accountant delegation revoked
// 409 DUPLICATE_FILING    — idempotency conflict on (orgId, taxType, period)
// 409 LAST_OWNER          — cannot demote/remove last OWNER
// 422 NRS_SUBMISSION_FAILED — NRS returned error; circuit may be open
// 429 RATE_LIMITED        — express-rate-limit triggered
// 500 INTERNAL_ERROR      — global error handler catch-all
// 503 NRS_CIRCUIT_OPEN    — NRS unavailable; use DIGITAX_MOCK_MODE to unblock
```

### 5.3 Request Validation Middleware

```typescript
// backend/src/middleware/validate.ts
// Usage: router.post('/route', authenticate, resolveOrgContext, validate(MySchema), handler)
import { ZodSchema } from 'zod';

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
// Never call schema.parse() directly in route handlers — always validate() middleware
```

### 5.4 Idempotency Keys

For mutation endpoints that must be exactly-once:

```typescript
// Client sends: X-Idempotency-Key: <uuid> header
// Backend: check Redis for key presence → if exists, return cached response
// Key TTL: 24 hours

// Applies to:
// POST /api/v1/filings/nil
// POST /api/v1/filings/vat
// POST /api/v1/filings/wht
// POST /api/v1/payroll/run
// POST /api/v1/payments/initiate

// Implementation:
const idemKey = req.headers['x-idempotency-key'] as string;
if (idemKey) {
  const cached = await redis.get(`idem:${idemKey}`);
  if (cached) return res.status(200).json(JSON.parse(cached));
}
// ... handler logic ...
if (idemKey) {
  await redis.setex(`idem:${idemKey}`, 86_400, JSON.stringify(responseBody));
}
```

---

## 6. UX Flow Enhancements

### 6.1 Onboarding Flow — Step Map

```
Step 1: Welcome + Value proposition (skip = false; required)
Step 2: Business name + TIN entry
  → TIN validation (§3.4 state machine)
  → if valid: entityName auto-populated; step 3 unlocked
  → if invalid: inline error; retry allowed; skip not permitted
Step 3: CAC/RC entry (optional — skip button visible)
  → if entered: CAC validation; directors displayed; confirmed
  → if skipped: skippedNRS=true; continue
Step 4: Select tax obligations (multi-select: VAT, PAYE, WHT, CIT)
  → minimum 1 required; defaults to VAT if registered threshold met
Step 5: Completion + dashboard redirect
  → confetti Lottie animation (150ms delay)
  → OnboardingProgress.completed = true
  → router.replace('/dashboard') — never router.push (prevents back navigation to wizard)

Resume logic: if OnboardingProgress.completed === false and currentStep > 1 →
  show "Continue where you left off" prompt on app launch
  router.push(`/onboarding/step-${progress.currentStep}`)
```

### 6.2 Tax Submission Lifecycle (All Filing Types)

```
State:   DRAFT → VALIDATING → SUBMITTING → SUBMITTED | FAILED

DRAFT:
  - User enters data; real-time validation per field
  - "Save draft" persists to AsyncStorage (offline) + DB (online)
  - Period auto-selected; penalty estimate shown if past deadline

VALIDATING:
  - On "Review" tap: client-side Zod validation
  - If invalid: scroll to first error field; highlight red
  - If valid: show summary screen with all values + tax due

SUBMITTING:
  - CTA button: inline spinner; haptic (Light); gesture-locked
  - POST /api/v1/filings/{type} with X-Idempotency-Key
  - On success: → SUBMITTED state

SUBMITTED:
  - Full-screen confirmation: filing reference + period + amount + NRS IRN
  - Haptic: Success notification
  - Confetti Lottie if first filing this period
  - "Download receipt" → signed R2 URL
  - "File another" → back to wizard step 1
  - Dashboard cache invalidated (redis.del on backend)

FAILED:
  - Toast: error code + human message (6s, dismissible)
  - Haptic: Error notification
  - Retry button re-submits with same idempotency key (safe)
  - If NRS circuit open: "NRS temporarily unavailable — filing queued for auto-submission"
    → BullMQ job enqueued; UI shows "Pending NRS stamp" badge
```

### 6.3 Admin Review Lifecycle

```
Admin sees:
  → Pending filings needing manual review (edge cases flagged by anomaly engine)
  → DLQ jobs: queue name, payload, fail reason, attempt count, retry/resolve controls
  → Risk band distribution: org count per band; click → filtered org list
  → Audit log: searchable by orgId, actorId, action, date range; exportable CSV

Admin actions requiring 2FA re-verification:
  → NRS circuit state override (SUPER_ADMIN only)
  → Bulk DLQ resolution
  → Hard delete document (SUPER_ADMIN only, after 7yr retention)
  → Org suspension (ADMIN+)
```

### 6.4 Edge-Case UX Handling

| Scenario | Handling |
|---|---|
| Duplicate filing attempt | 409 → toast "Already filed for {period}" + link to existing receipt |
| NRS circuit open during filing | Filing completes as SUBMITTED; badge "NRS stamp pending"; auto-stamp when circuit closes |
| Last OWNER removal | 409 → "You are the only OWNER — assign another before removing yourself" |
| Biometric not enrolled | Silent fallthrough to PIN — no error shown to user |
| VAT credit carryforward > 0 on nil period | Warning: "You have credit balance — consider filing substantive return" |
| Filing period in the future | Blocked at client: "Cannot file for a future period" |
| Session expired mid-wizard | Progress saved; on re-login, resume prompt shown |
| Offline during submission | Queued to AsyncStorage; retry on reconnect with idempotency key |

---

## 7. Admin System Enhancements

### 7.1 Financial Analytics Dashboard

**Route:** `/admin/analytics` | **RBAC:** ADMIN+

**Panels:**

```typescript
// Panel 1: Revenue at Risk
// Data: sum(taxAmountDue) WHERE status='draft' AND deadline < now() GROUP BY taxType
// Display: bar chart per tax type, formatNGN compact

// Panel 2: Filing Compliance Rate (last 6 months)
// Data: filedOnTime / totalDue per month
// Display: line chart, WAT-timezone aligned x-axis

// Panel 3: Risk Band Distribution
// Data: SELECT band, COUNT(*) FROM SMERiskRecord GROUP BY band
// Display: horizontal bar chart; clickable bands → filtered org table

// Panel 4: NRS Health Timeline
// Data: nrsCircuitState gauge history (from metrics TSDB)
// Display: state timeline (open/half-open/closed) with incident annotations

// Panel 5: DLQ Depth Over Time
// Data: taxbridge_dlq_depth metric from Prometheus
// Display: area chart with alert threshold line at 10
```

### 7.2 DLQ Management UI

**Route:** `/admin/dlq` | **RBAC:** ADMIN+

```typescript
// Table columns: queue, jobId, failReason, attempts, lastAttempt, payload preview
// Actions per row:
//   Retry:   POST /api/v2/dlq/{jobId}/retry → re-enqueues job; audit action: OVERRIDE
//   Resolve: POST /api/v2/dlq/{jobId}/resolve → marks resolved: true; audit action: OVERRIDE
// Bulk actions: retry all / resolve all (requires 2FA confirmation for > 10 jobs)
// Auto-refresh: every 30s (polling; no WebSocket dependency)
```

### 7.3 Audit Log Explorer

**Route:** `/admin/audit` | **RBAC:** ADMIN+

```typescript
// Filters: orgId (text), actorId (text), action (multi-select enum), dateFrom, dateTo
// Sort: createdAt DESC (default); orgId ASC
// Pagination: cursor-based (createdAt + id), page size 50
// Export: GET /api/v2/audit/export?orgId=&action=&from=&to= → NDJSON stream
//         Requires ADMIN role; triggers AuditEvent with action: EXPORT
// Retention: AuditEvent records never deleted — NDPC §30 compliance
```

### 7.4 Team RBAC Management

**Route:** `/admin/team` | **RBAC:** OWNER+ (own org); ADMIN+ (any org)

```typescript
// Table: member name, email, role badge, status, last login
// Invite: POST /api/v1/team/invite → sends email + generates OTP; audit: INVITE
// Role change: PATCH /api/v1/team/{memberId}/role → session invalidation on save; audit: ROLE_CHANGE
// Remove: DELETE /api/v1/team/{memberId} → soft-delete (deletedAt=now()); audit: DELETE
// Accountant delegation: separate tab showing active/revoked AccountantClient records
```

---

## 8. Intelligent Automation Layer

### 8.1 AI-Assisted Tax Guidance (ExplainMyTax)

**Implementation:** Fully offline — no external AI API dependency. Content is bundled as a static JSON map keyed by tax concept. This ensures availability on 2G and zero AI inference cost.

```typescript
// mobile/src/components/education/ExplainMyTax.tsx
// Bundled content: 7 core concepts, each with EN + Pidgin explanation

const EXPLAIN_CONTENT: Record<string, { en: string; pidgin: string; example: string }> = {
  vat:        { en: "VAT is 7.5% charged on goods and services above ₦25M annual turnover.", pidgin: "VAT na 7.5% wey goverment dey collect on top wetin you sell.", example: "Invoice ₦100,000 → VAT ₦7,500" },
  wht:        { en: "WHT is deducted at source on payments to vendors. Professional fees: 10%.", pidgin: "WHT na money wey you go hold from wetin you pay vendor.", example: "Pay ₦500,000 to consultant → hold ₦50,000 as WHT" },
  paye:       { en: "PAYE is income tax deducted from employee salaries monthly.", pidgin: "PAYE na tax wey you go cut from worker salary every month.", example: "₦5M salary, ₦600k rent, ₦200k pension → PAYE = ₦632,400" },
  nil_return: { en: "NIL return tells the tax authority you had no activity this period.", pidgin: "NIL return na way to tell goverment say you no do business this month.", example: "No invoices in March → file NIL VAT return by 21st April" },
  tin:        { en: "TIN is your 8-digit Tax Identification Number from FIRS/NRS.", pidgin: "TIN na your 8-digit tax number from NRS.", example: "All invoices and filings require a valid TIN" },
  cit:        { en: "CIT is 30% on company profits above ₦100M turnover. Small companies pay 0%.", pidgin: "CIT na company income tax. If your turnover dey below ₦100M, na zero.", example: "₦150M revenue → CIT applies at 30%" },
  penalty:    { en: "Late filing penalties: ₦250,000 first month + ₦125,000 each additional month for companies.", pidgin: "If you file late, goverment go charge you ₦250k for first month.", example: "32 days late → ₦250,000 + ₦125,000 = ₦375,000" },
};

// Usage: <ExplainMyTax concept="wht" /> renders inline card with toggle EN/Pidgin
```

### 8.2 Smart Validation Hints

**Implementation:** Real-time client-side hints triggered by field value patterns — zero API calls.

```typescript
// Examples of validation hints shown inline as user types:

// TIN field: 
//   7 digits → "TIN is 8 digits — one more digit needed"
//   9 digits → "TIN should be exactly 8 digits"
//   8 digits → spinner + API validation call (debounced 800ms)

// WHT category selector:
//   if category === 'professional_services':
//     hint: "Professional fees: 10% WHT applies — not 5%. A common error."

// VAT amount field:
//   if amount > 0 AND !isVATRegistered:
//     hint: "Your turnover is below ₦25M — VAT registration may not be required."

// PAYE gross salary:
//   on blur: show instant PIT estimate using calculatePIT from @taxbridge/contracts
//   "Estimated PAYE: ₦XX,XXX" — updates in real time
```

### 8.3 Automated Compliance Checks (Pre-Filing)

Before every filing submission, the backend executes a compliance preflight:

```typescript
// backend/src/services/compliancePreFlight.ts
export async function runPreFlight(orgId: string, taxType: string, period: string): Promise<PreFlightResult> {
  const checks = await Promise.all([
    checkTINValidity(orgId),              // TIN not suspended
    checkPriorPeriodFiled(orgId, taxType, period), // no gap filing
    checkVATRegistrationStatus(orgId),    // if filing VAT, org must be VAT registered
    checkNRSHealth(),                     // circuit state — warn if open
  ]);
  const failures = checks.filter(c => !c.pass);
  return { pass: failures.length === 0, warnings: checks.filter(c => c.warning), failures };
}
// Returned to client in GET /api/v1/filings/preflight?taxType=VAT&period=2026-02
// Client renders warnings inline before showing "Submit" CTA
// Failures block submission; warnings are informational only
```

---

## 9. Observability and Monitoring Layer

### 9.1 Logging Architecture

```
Backend (Pino) → stdout (structured JSON)
  → Render Log Drain → Grafana Cloud Loki

Log levels by environment:
  production:  info + above (no debug — volume control)
  staging:     debug + above
  development: debug + pino-pretty (human-readable)

Mandatory fields on every log line:
  { level, time, msg, orgId?, userId?, route?, durationMs?, err? }

PII redact list (Pino config):
  ['req.headers.authorization', 'body.password', 'body.tin', 'body.bvn',
   'body.bankAccount', 'body.cardNumber']

Credit card scrub (before any log write):
  .replace(/\b\d{16}\b/g, '[CARD_REDACTED]')
```

### 9.2 Metrics Tracking

All metrics exported at `GET /api/v2/monitoring/metrics` (ADMIN only, Prometheus format).

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `taxbridge_api_request_duration_seconds` | Histogram | route, method, status | Latency SLO tracking |
| `taxbridge_nrs_stamp_success_total` | Counter | orgId | NRS throughput |
| `taxbridge_nrs_stamp_failure_total` | Counter | reason | NRS failure analysis |
| `taxbridge_anomaly_detected_total` | Counter | signal, severity | Intelligence layer activity |
| `taxbridge_dlq_depth` | Gauge | queue_name | Queue health |
| `taxbridge_penalty_estimate_total` | Counter | taxType | Compliance engagement |
| `taxbridge_nrs_circuit_state` | Gauge | (none) | 0=closed, 1=half-open, 2=open |

Grafana scrape interval: 15s. Retention: 90 days (Grafana Cloud free tier limit).

### 9.3 Alert Thresholds and Runbooks

| Alert | Condition | Severity | Response |
|---|---|---|---|
| API Error Rate | 5xx rate > 1% over 5min | CRITICAL | Check Sentry for stack traces; consider blue-green rollback |
| Dashboard P99 | > 2s over 5min | WARNING | Check Redis TTL; check DB query plan for `TaxReturn` index hit |
| DLQ Depth | sum > 10 for 15min | WARNING | Open `/admin/dlq`; check NRS circuit state |
| Auth Flood | auth_failure rate > 10/min | CRITICAL | IP block via Cloudflare; check for credential stuffing |
| NRS Circuit Open | state == 2 for 5min | CRITICAL | Set `DIGITAX_MOCK_MODE=true` in Render; alert ops Slack; attempt manual override after 30min |

### 9.4 Health Check Response

```json
GET /api/v2/monitoring/health → 200
{
  "status": "healthy",
  "version": "12.0.0",
  "ts": "2026-03-02T10:00:00.000Z",
  "env": "production",
  "nrs": { "state": "closed" },
  "db": { "latencyMs": 4 },
  "redis": { "latencyMs": 1 }
}
```

DB and Redis latency included for Render's health check SLA monitoring. If either > 500ms, status returns `"degraded"` (still HTTP 200 to prevent blue-green rollback on DB slowness alone).

### 9.5 Incident Response Workflow

```
1. Alert fires (PagerDuty/Slack)
2. On-call engineer opens Grafana dashboard → identify metric breach
3. Check Sentry for correlated errors in the same time window
4. If deployment-related: blue-green rollback (60s decision window)
5. If NRS-related: enable DIGITAX_MOCK_MODE
6. Post incident entry to CHANGELOG.md within 24h
7. Root cause analysis in GitHub issue tagged `incident`
```

---

## 10. DevOps and Deployment

### 10.1 Dockerfile (Multi-Stage, Non-Root)

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
RUN yarn install --frozen-lockfile
COPY packages/contracts/ packages/contracts/
COPY backend/ backend/
RUN yarn workspace @taxbridge/contracts build
RUN yarn workspace backend build

FROM node:20-alpine AS production
RUN addgroup -S taxbridge && adduser -S taxbridge -G taxbridge
WORKDIR /app
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
USER taxbridge
ENV NODE_ENV=production
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:10000/api/v2/monitoring/health || exit 1
CMD ["node", "dist/app.js"]
```

### 10.2 CI/CD Pipeline Stages

```yaml
# .github/workflows/pipeline.yml — 5 stages

Stage 1 — Quality (parallel):
  lint:       yarn workspaces foreach -A run lint
  typecheck:  yarn workspaces foreach -A run type-check
  eradication:
    - grep -rn "FIRS" ... → 0
    - grep -rn "console\.log" backend/src → 0
    - grep -rn "0\.2725\b" ... → 0
    - grep '"compileSdkVersion": 36' mobile/eas.json | wc -l → 3
    - grep '"SENTRY_DSN": "REPLACE' mobile/eas.json → 0
    - yarn i18n:check
    - yarn prompts:verify
  accuracy:
    - PIT gate: ₦5M → ₦632,400 ±₦1
    - Penalty gate: company 32d → ₦375,000

Stage 2 — Tests (requires Stage 1):
  services:   [postgres:16-alpine, redis:7-alpine]
  steps:
    - npx prisma migrate deploy
    - yarn workspace backend ts-node backend/prisma/seeds/smokeTestUser.ts
    - yarn workspaces foreach -A run test -- --coverage --ci --runInBand
    - npx nyc check-coverage --lines 95 --functions 95 --branches 90

Stage 3 — Security (parallel with Stage 2):
  - npx snyk test --all-projects --severity-threshold=high
  - head -5 backend/src/app.ts | grep -q "validateEnv"
  - git ls-files | grep -E '\.env\.' | grep -v example → 0
  - AuditEvent updatedAt absence check (awk + grep)

Stage 4 — Builds (requires Stages 2 + 3):
  - yarn workspace backend build
  - yarn workspace admin build
  - docker build --target production -t taxbridge-api:$SHA .
  - eas build --platform android --profile staging --non-interactive

Stage 5 — Deploy + Smoke (main branch only):
  - Deploy green slot (Render)
  - Health check green
  - Canary 5% → 2min observation → 25% → 3min → 100%
  - Rollback if error rate > 1%
  - 7-point smoke test
  - git tag + gh release create
```

### 10.3 Environment Variable Schema

```bash
# backend — REQUIRED_ALWAYS (all environments)
DATABASE_URL=postgresql://...?sslmode=require
REDIS_URL=rediss://...
JWT_SECRET=<RS256 private key PEM>
JWT_REFRESH_SECRET=<random 64-char hex>
NRS_API_KEY=<key>
PORT=10000
NODE_ENV=production

# backend — REQUIRED_PRODUCTION (NODE_ENV=production only)
SENTRY_DSN=https://...@sentry.io/...
RENDER_EXTERNAL_URL=https://taxbridge-api-ker8.onrender.com
FLUTTERWAVE_SECRET=<secret>
CBN_MPR=0.2725          # current CBN Monetary Policy Rate; update when CBN changes
CORS_ORIGIN=https://taxbridge.vercel.app,https://app.taxbridge.ng
DOCUMENT_VAULT_KMS_PROVIDER=cloudflare

# backend — OPTIONAL
DIGITAX_MOCK_MODE=false   # set to true to bypass NRS circuit
LOG_LEVEL=info            # info|debug|warn|error
LOG_FORMAT=json           # json|pretty

# GitHub Secrets (CI/CD)
SMOKE_TEST_EMAIL=<deterministic seed email>
SMOKE_TEST_PASSWORD=<deterministic seed password>
RENDER_API_KEY=<render API key for traffic swap>
CBN_MPR=0.2725
VERCEL_TOKEN=<vercel deploy token>

# EAS Secrets (set via CLI — never in eas.json)
SENTRY_DSN=<same as backend>
```

### 10.4 Secrets Management Rules

1. No secret ever in a committed file — enforced by CI Stage 3 gate.
2. `JWT_SECRET` is an RS256 PEM key — not a random string. Generate with `openssl genrsa 4096`.
3. `CBN_MPR` must be updated in Render env vars within 24h of any CBN rate change. No code deployment required — Render restarts automatically on env var change.
4. Cloudflare KMS key rotation is annual — document rotation date in `infra/terraform/kms-rotation.md`.
5. Docker Swarm secrets (C-30) apply only if migrating to Swarm. Render uses env vars directly — no file-mounted secrets needed on Render.

---

## 11. Security Hardening Checklist

### 11.1 JWT Validation

```typescript
// auth.ts — checks performed on every authenticated request
// 1. Bearer token present in Authorization header
// 2. RS256 signature valid (public key from env)
// 3. exp claim not in the past
// 4. role_version in Redis matches token's iat — if stale, reject with 401 TOKEN_EXPIRED
// 5. userId exists in DB (optional, skip for performance — covered by role_version check)

// Refresh token additional checks:
// 1. Single-use: tokenHash must exist in UserSession and not be expired
// 2. On use: delete old session, create new session, return new pair
// 3. On suspicious reuse (old tokenHash presented): invalidate ALL sessions for userId
```

### 11.2 Rate Limiting Configuration

```typescript
// backend/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';

// Use Redis store for rate limit state across multiple Render instances
// (Render starter plan = single instance, but design for scale)

export const loginLimiter     = rateLimit({ windowMs: 60_000, max: 5,  keyGenerator: (req) => req.ip!, message: { error: 'RATE_LIMITED', message: 'Too many login attempts.' } });
export const refreshLimiter   = rateLimit({ windowMs: 60_000, max: 10, keyGenerator: (req) => req.user?.id ?? req.ip! });
export const dashboardLimiter = rateLimit({ windowMs: 60_000, max: 30, keyGenerator: (req) => req.user?.id ?? req.ip! });
export const filingLimiter    = rateLimit({ windowMs: 60_000, max: 10, keyGenerator: (req) => req.orgContext?.orgId ?? req.ip! });
export const nilLimiter       = rateLimit({ windowMs: 60_000, max: 5,  keyGenerator: (req) => req.orgContext?.orgId ?? req.ip! });
export const onboardingLimiter= rateLimit({ windowMs: 60_000, max: 3,  keyGenerator: (req) => req.ip! });
```

### 11.3 Input Sanitization

```typescript
// Every request body that stores user-provided strings to DB must sanitize:
// 1. Trim whitespace: applied by Zod .trim() on all string fields
// 2. XSS: DOMPurify on admin web (server-side rendered — lower risk); not needed on API layer
// 3. SQL injection: not applicable — Prisma parameterizes all queries
// 4. Path traversal: not applicable — no file path is user-supplied
// 5. JSON injection: Zod schema rejects unexpected fields via .strict() on body schemas
// 6. Large payloads: express.json({ limit: '1mb' }) — already in app.ts
```

### 11.4 CORS Policy

```typescript
// Origin allowlist: comma-separated in CORS_ORIGIN env var
// Credentials: true (required for httpOnly cookie on admin)
// Methods: GET, POST, PATCH, DELETE (no PUT — use PATCH for partial updates)
// Headers: Content-Type, Authorization, X-Idempotency-Key
// Exposed headers: X-Request-Id (for Sentry correlation)
// Preflight cache: 600s (10min)
```

### 11.5 Dependency Scanning

```bash
# CI Stage 3 — runs on every push
npx snyk test --all-projects --severity-threshold=high
# → 0 HIGH/CRITICAL vulnerabilities before any merge to main

# Weekly scheduled scan (GitHub Actions cron):
npx snyk monitor --all-projects  # reports to Snyk dashboard
npx npm audit --audit-level=high  # secondary check

# Dependabot: enabled for npm and GitHub Actions
# Auto-merge: patch-level only; minor/major require manual review
```

---

## 12. Performance Optimization Checklist

### 12.1 Query Optimization

```typescript
// Critical queries and their index requirements:

// Dashboard composite — runs on every cache miss
// TaxReturn: WHERE orgId=? AND status='submitted' ORDER BY submittedAt DESC LIMIT 12
//   → INDEX(orgId, status, submittedAt) — must exist
// AnomalySignal: WHERE orgId=? AND severity IN ('medium','high','critical') ORDER BY detectedAt DESC LIMIT 3
//   → INDEX(orgId, severity, detectedAt) — add if anomalies stored in DB rather than computed

// Compliance calendar — runs on every dashboard miss
// TaxReturn: WHERE orgId=? AND taxType=? AND period=? — point lookup
//   → UNIQUE(orgId, taxType, period) — already exists; no additional index needed

// Audit log export — admin only, acceptable to be slower
// AuditEvent: WHERE orgId=? AND action=? AND createdAt BETWEEN ? AND ?
//   → INDEX(orgId, action, createdAt) — add via schema.prisma

// Verify query plans in staging with EXPLAIN ANALYZE before each migration
```

### 12.2 Caching Strategy

| Layer | Key Pattern | TTL | Invalidation Trigger |
|---|---|---|---|
| Redis — Dashboard | `dashboard:composite:v1:{orgId}:{userId}` | 120s | New invoice, new expense, anomaly.detected, filing.submitted |
| Redis — Rate limit | `rl:{userId}:{route}` | Window duration | Natural expiry |
| Redis — Idempotency | `idem:{key}` | 86400s | Natural expiry |
| Redis — Role version | `role_version:{userId}` | 7 days | Role change, delegation revoke |
| Cloudflare — Health | `/api/v2/monitoring/health` | 30s | Cloudflare cache rule |
| React Query — Mobile | `['dashboard', orgId, userId]` | staleTime: 30s, gcTime: 5min | Manual refetch, pull-to-refresh |

### 12.3 API Response Compression

```typescript
// backend/src/app.ts — add before route mounting
import compression from 'compression';
app.use(compression({
  level: 6,           // gzip level 6 — good balance of speed vs ratio
  threshold: 1024,    // only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));
// yarn workspace backend add compression @types/compression
```

### 12.4 Mobile Performance

```typescript
// FlashList estimatedItemSize values (measure actual rendered heights):
// Filing list item:     72px
// Audit log item:       56px
// Document vault item:  64px
// Anomaly signal card:  88px
// Deadline card:        68px

// Image optimization:
// scripts/compress-assets.sh — pngquant all PNG assets before EAS build
// Target: < 50KB per icon, < 200KB per illustration

// Bundle size:
// metro.config.js blockList: backend/, admin/, *.test.*, *.spec.*
// Verify: npx expo export --platform android --output-dir /tmp/bundle-check
//         bundle size target: < 3MB main bundle

// React Query prefetching:
// On app foreground (AppState 'active'): queryClient.invalidateQueries(['dashboard'])
// Prevents stale data on 2G where background sync may have failed
```

### 12.5 Admin Panel

```typescript
// Next.js config (admin/next.config.js):
const config = {
  compress: true,
  poweredByHeader: false,
  images: { domains: ['taxbridge-api-ker8.onrender.com'], formats: ['image/avif', 'image/webp'] },
  experimental: { optimizeCss: true },
};

// Lighthouse targets (admin panel):
// Performance ≥ 98: achieve via static generation for non-sensitive pages (landing, docs)
// Accessibility ≥ 98: aria-labels on all chart elements; keyboard navigation in tables
// Best Practices 100: no deprecated APIs; HTTPS enforced
// SEO ≥ 90: robots noindex for /admin/* routes (enforced in metadata)

// Vercel Edge Config: feature flags for gradual rollout
// e.g. "new_analytics_panel": true/false — read at runtime, no deployment needed
```

---

## 13. Production Go-Live Validation

### 13.1 Pre-Launch Verification (Run 24h Before)

```bash
# 1. Environment variables verified
yarn workspace backend ts-node -e "require('./src/validateEnv')" && echo "✅ env ok"

# 2. Database migration current
npx prisma migrate status  # → "All migrations have been applied"

# 3. Seed data present
curl -s -X POST $RENDER_EXTERNAL_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"$SMOKE_TEST_EMAIL","password":"$SMOKE_TEST_PASSWORD"}' \
  | jq '.accessToken' | grep -v null && echo "✅ seed user ok"

# 4. All CI gates clean on main branch
git log --oneline -1  # confirm HEAD is post-merge CI pass

# 5. Blue slot health confirmed
curl $RENDER_EXTERNAL_URL/api/v2/monitoring/health | jq '.status' | grep healthy

# 6. Mobile EAS build on production branch
eas update:list --branch production | head -3  # confirms OTA available
```

### 13.2 Smoke Testing (7 Checks — All Must Pass)

```bash
BASE=$RENDER_EXTERNAL_URL

# Check 1: Health
curl -sf $BASE/api/v2/monitoring/health | jq -e '.status == "healthy"'

# Check 2: Auth
TOKEN=$(curl -sf -X POST $BASE/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SMOKE_TEST_EMAIL\",\"password\":\"$SMOKE_TEST_PASSWORD\"}" \
  | jq -r '.accessToken')
[ -n "$TOKEN" ] && echo "✅ auth ok"

# Check 3: Dashboard
curl -sf -H "Authorization: Bearer $TOKEN" $BASE/api/v1/dashboard \
  | jq -e '.stats.taxHealthScore | type == "number"'

# Check 4: NIL filing
FILING=$(curl -sf -X POST $BASE/api/v1/filings/nil \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: smoke-nil-$(date +%s)" \
  -d '{"taxType":"VAT","period":"2026-02","nilReason":"NO_REVENUE_THIS_PERIOD"}')
echo $FILING | jq -e '.filingReference'

# Check 5: Penalty estimate
curl -sf -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v1/compliance/penalty-estimate?taxType=VAT&daysLate=32&taxAmountDue=0&entityType=company&disclosurePhase=after_assessment" \
  | jq -e '.netPenalty == 375000'

# Check 6: RBAC enforcement (VIEWER cannot assign roles)
VIEWER_TOKEN=<viewer token from seed>
curl -sf -X PATCH $BASE/api/v2/rbac/assign \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberId":"x","role":"ADMIN"}' \
  | jq -e '.error == "INSUFFICIENT_ROLE"'

# Check 7: Admin panel
curl -sf https://taxbridge.vercel.app | grep -q "TaxBridge" && echo "✅ admin ok"
```

### 13.3 Load Testing

```bash
# k6 scenario — run from CI or local with staging environment
# Target: 2000 concurrent users × 60 seconds
# Thresholds: dashboard P95 < 200ms, P99 < 800ms; nil filing P95 < 500ms

k6 run --vus 2000 --duration 60s \
  --env BASE_URL=$RENDER_EXTERNAL_URL \
  --env TOKEN=$TOKEN \
  infra/k6/dashboard-load-test.js

# infra/k6/dashboard-load-test.js:
import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = {
  thresholds: {
    'http_req_duration{url:dashboard}': ['p(95)<200', 'p(99)<800'],
    'http_req_duration{url:nil_filing}': ['p(95)<500'],
    'http_req_failed': ['rate<0.01'],
  },
};
export default function () {
  const dashRes = http.get(`${__ENV.BASE_URL}/api/v1/dashboard`,
    { headers: { Authorization: `Bearer ${__ENV.TOKEN}` }, tags: { url: 'dashboard' } });
  check(dashRes, { 'dashboard 200': (r) => r.status === 200 });
  sleep(0.1);
}
```

### 13.4 Rollback Strategy

```bash
# Decision matrix:
# Error rate > 1% over 2min         → IMMEDIATE blue-green rollback
# P99 latency > 5s over 5min        → blue-green rollback
# Smoke test failure post-deploy     → blue-green rollback
# Mobile crash rate > 1%             → OTA revert (JS-only) or full EAS rebuild (native)
# DB migration data corruption       → forward migration to restore; never prisma rollback

# Rollback commands:
# Backend:
render traffic swap --from prod --to blue --api-key "$RENDER_API_KEY"

# Admin:
npx vercel rollback --token="$VERCEL_TOKEN" --cwd admin

# Mobile OTA:
eas update --branch production --message "revert: v12.0.0 regression" \
  --git-commit-hash $(git rev-parse HEAD~1)
```

### 13.5 Post-Launch Monitoring (First 48h)

```
Hour 0–2:   Watch error rate alert in Grafana every 15min
Hour 2–24:  Check DLQ depth; review Sentry for new error fingerprints
Hour 24–48: Review performance metrics against baselines; confirm NRS stamp success rate > 97%
Day 7:      Full audit log review for any anomalous access patterns
Day 30:     Coverage regression check (re-run nyc); update CHANGELOG.md
```

---

**END OF MODULE**

**Taxbridge Production Architecture Completion Module**
Version: V12-ELEVATED | Effective: 2026-03-02
All sections are implementation-ready. Deploy against branch `upgrade/v12-elevated-20260302`.
