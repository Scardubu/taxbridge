# 🧠 TAXBRIDGE MASTER PROMPT V8.0
### *The Definitive Engineering Brief for Scardubu/taxbridge.git*

**Version:** 8.0  
**Based on:** CHANGELOG v2.0.0 (Feb 20 2026), PRODUCTION_READY v1.0.2, DEPLOYMENT_v1.0.3  
**Branch:** `master`  
**Status:** Active Production System — Incremental Enhancement Mode  

---

## 🎯 PRIME DIRECTIVE

You are a **senior full-stack AI engineer** with deep expertise in Nigerian tax law, fintech architecture, and React Native/Node.js ecosystems. Your mission is to evolve `Scardubu/taxbridge.git` from its current **v2.0.0 production state** into a **category-defining, world-class tax intelligence platform** for Nigerian SMEs — without breaking the live production system.

**Non-negotiable constraint:** Every change must be backward-compatible, regression-safe, and deployable via the existing CI/CD chain (Render → Vercel → EAS).

---

## 📍 PHASE 0 — GROUND TRUTH ACQUISITION (DO THIS FIRST)

Before writing a single line of code, execute this exact sequence:

```bash
# 1. Clone and orient
git clone https://github.com/Scardubu/taxbridge.git
cd taxbridge
git checkout master
git log --oneline -20  # Absorb the 10-release history

# 2. Internalize all production documentation
cat CHANGELOG.md                          # Full v1.0.0 → v2.0.0 history
cat PRODUCTION_READY.md                   # Go/No-Go criteria and metrics
cat DEPLOYMENT_v1.0.3_COMPLETE.md         # Latest build fix context
cat docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md # Deployment procedures
cat docs/INCIDENT_RESPONSE.md             # Rollback procedures
cat docs/EAS_BUILD_VALIDATION.md          # Mobile build context

# 3. Understand the known-broken areas (from CHANGELOG v2.0.0)
# - Android compileSdkVersion 36 fix applied — verify it holds
# - Admin cold-start resilience added — test it
# - Prisma stub workarounds in place — do NOT reintroduce typed Prisma namespaces
# - 52 TypeScript errors were fixed by using `any` — respect this constraint

# 4. Map the full structure
find . -type f -name "*.ts" | wc -l      # Understand LOC scope
find . -type f -name "*.test.ts" | wc -l # Test footprint
ls backend/src/routes/                    # 60+ API endpoints
ls mobile/src/screens/                    # 15+ screens
ls admin-dashboard/src/app/               # Admin route segments
```

**Commit nothing until you have completed Phase 0.**

---

## 🏗️ SYSTEM ARCHITECTURE REFERENCE

### Current Stack (DO NOT CHANGE without explicit justification)

| Layer | Technology | Version | Deployment |
|-------|-----------|---------|-----------|
| Mobile | React Native + Expo | SDK 54 (compileSdk 36) | EAS Build → Google Play |
| Backend | Node.js + Fastify + Prisma | Node 20.19.4, Prisma 5.22.0 | Render.com |
| Database | PostgreSQL | Latest | Render managed |
| Cache/Queue | Redis + BullMQ | Latest | Render Redis |
| Admin | Next.js 15 + shadcn/ui + Tailwind | Next 15 | Vercel |
| OCR | Google Cloud Vision + Tesseract fallback + Sharp | v2.0.0 | Backend |
| i18n | i18next | 1,080+ keys | en.json + pidgin.json |
| Auth | JWT (24h access + refresh) | — | Backend middleware |
| Payments | Paystack + Flutterwave + Remita | Failover chain | Backend webhooks |
| Monitoring | Sentry + Prometheus | — | All layers |

### Critical Known Constraints (from deployment history)
- **Prisma types are stubbed as `any`** — Never use `Prisma.XxxWhereInput` or namespace types. This was a deliberate fix (commit `218972e`) to unblock Render builds. Work with `any` and add JSDoc comments instead.
- **EAS cache key is `v7-*`** — If you change native dependencies, bump to `v8-*` in `mobile/eas.json`
- **NRS terminology is canonical** — Zero FIRS references anywhere. NRS/DigiTax only.
- **`ALLOWED_ORIGINS` must never be wildcard in production** — Security-critical.
- **Admin cold-start**: Routes `/api/admin/stats`, `/api/admin/launch-metrics`, `/api/admin/health/integrations` return graceful 200 fallbacks during Render warm-up. Preserve this behavior.

---

## 🔥 PHASE 1 — STABILIZATION & DEBT CLEARANCE

*Before adding features, harden what exists.*

### 1.1 Test Suite Health Check
```bash
cd backend
npm test -- --coverage --verbose
# TARGET: 423 passing (current baseline), 0 new failures
# If any tests are red, fix them BEFORE proceeding

cd mobile  
npx jest --coverage
# TARGET: All suites green

cd admin-dashboard
npx jest --coverage 2>/dev/null || echo "No jest config — add one"
```

### 1.2 TypeScript Compilation Verification
```bash
cd backend && npx tsc --noEmit
# Must produce: zero errors (baseline from commit 218972e)

cd mobile && npx tsc --noEmit
# Fix any new errors introduced since last commit

cd admin-dashboard && npx tsc --noEmit
```

### 1.3 Dependency Audit
```bash
# Check for vulnerabilities
npm audit --audit-level=high  # In each package directory

# Verify Expo SDK compatibility (critical — bumped to SDK 54 in v2.0.0)
cd mobile && npx expo-doctor
# Must show zero critical warnings
```

### 1.4 Environment Variable Validation
```bash
pwsh scripts/validate-production-readiness.ps1
# All checks must pass before any feature work begins
```

---

## ✨ PHASE 2 — HIGH-IMPACT FEATURE ENHANCEMENTS

*Ordered by business value vs. implementation risk.*

### 2.1 🤖 AI Tax Intelligence Layer (HIGHEST PRIORITY)

**Context:** v2.0.0 introduced anomaly detection and prediction endpoints at `/api/v1/insights/*`. These need production-hardening and deeper ML integration.

**Implementation targets:**

#### 2.1.1 Enhanced OCR Pipeline (`backend/src/routes/ocr.ts` + `ml/ocr_service/`)
```
Current state: Vision-first with Tesseract fallback + Sharp image enhancement
Target state: 13-category classification with ≥90% confidence threshold
```
- Expand Nigerian receipt parsing to handle: handwritten receipts, thermal fades, multi-currency (NGN/USD/GBP), market receipts, POS terminal slips
- Add merchant database for auto-vendor-matching (top 500 Nigerian businesses)
- Implement confidence cascading: Vision API (primary) → Tesseract (fallback) → Human review queue (< 70% confidence)
- Categories to support: `fuel` | `meals` | `office_supplies` | `transport` | `utilities` | `rent` | `professional_fees` | `advertising` | `repairs` | `insurance` | `medical` | `education` | `other`
- Store OCR training signals: every human correction becomes a training data point

#### 2.1.2 Anomaly Detection Service (`backend/src/services/anomaly-detection.ts`)
```
Current state: duplicate amount, z-score spike, VAT mismatch
Target state: 8-signal anomaly engine with severity scoring
```
Add these signals:
- `round_number_clustering`: Flag when >60% of expenses are suspiciously round numbers
- `weekend_business_expense`: Flag business expenses on Sundays (Nigerian context)
- `rapid_succession_invoices`: Same vendor, same amount, <48h apart
- `vat_registration_mismatch`: Vendor claims VAT but isn't registered with NRS
- `phantom_vendor`: Vendor TIN doesn't match any Youverify CAC record
- `cashflow_cliff`: 30-day projection shows NGN shortfall for upcoming tax deadline

Each anomaly must include: `severity` (low/medium/high/critical), `explanation` (plain English + Pidgin), `recommended_action`, `regulatory_reference`

#### 2.1.3 Predictive Tax Calendar (`backend/src/services/compliance.ts`)
```
Current state: Static deadline reminders
Target state: AI-predicted liability forecasting
```
- Compute projected quarterly VAT liability based on trailing 90-day revenue
- Forecast annual PIT/CIT based on YTD income trajectory
- Surface "tax savings opportunities" (e.g., deductible expenses before year-end)
- Push notifications 30 days, 14 days, 7 days, 3 days, 1 day before deadlines
- Implement `smartReminder` that adjusts frequency based on user's historical on-time filing rate

### 2.2 📱 Mobile UX Elevation

**Context:** 15+ screens exist. Several had TODO placeholders replaced in v1.0.2. Time to make them excellent, not just functional.

#### 2.2.1 Dashboard Intelligence (`mobile/src/screens/DashboardScreen.tsx`)
- Add animated "Tax Health Score" (0-100) derived from: filing timeliness, expense categorization completeness, outstanding liabilities, compliance calendar completion
- Implement swipeable insight cards with actionable next steps
- Add a "Quick Actions" dock: Scan Receipt → Raise Invoice → Pay Tax → Check Compliance
- Real-time sync status with animated pulse indicator (not just text)
- Dark mode support using React Native's `useColorScheme()` with themed design tokens

#### 2.2.2 Receipt Scanning Flow (`mobile/src/screens/ScanReceiptScreen.tsx`)
```
Current state: Full editing UI replacing TODO (added v1.0.2) 
Target state: Camera-native intelligent capture
```
- Add live camera feed with auto-edge-detection overlay (rectangle guide)
- Implement "Smart Capture" mode: auto-shoots when receipt fills 80% of frame
- Gallery import with multi-page support (stapled receipts)
- Animated confidence meter during OCR processing
- One-tap correction mode for OCR errors with keyboard-aware layout
- Add haptic feedback on successful capture (Expo Haptics)

#### 2.2.3 Tax Calculator Suite (`mobile/src/screens/TaxCalculatorScreen.tsx`)
- Add a "What If" scenario builder: slider-based income adjustment to see tax impact
- Implement tax bracket visualizer — animated bar chart showing which bands apply
- Add "Compare Business Types" mode: see PIT vs CIT implications side-by-side
- Crypto CGT calculator improvements: add portfolio import from CSV, FIFO vs average cost comparison
- Export calculation as PDF (use existing PDF generator service)

#### 2.2.4 Invoice Creation (`mobile/src/screens/InvoiceScreen.tsx`)
- Add NRS QR code preview before submission
- Implement template gallery (4 existing templates) with thumbnail preview
- Add line-item duplication gesture (long press → duplicate)
- Recurring invoice setup with frequency selector (weekly/monthly/quarterly)
- Bulk invoice status update via swipe gestures
- IRN stamp animation on successful NRS submission

### 2.3 🖥️ Admin Dashboard Upgrades

**Context:** Vercel-hosted Next.js 15 with shadcn/ui. Cold-start resilience added in v2.0.0. Recharts integrated.

#### 2.3.1 Intelligence Command Center (`admin-dashboard/src/app/dashboard/`)
- Add real-time activity feed: live stream of invoice submissions, payments, NRS stamps
- Implement anomaly alert panel with severity-ranked list and one-click investigation
- Add cohort analysis: NRS compliance rates segmented by business type/size
- Tax revenue heatmap: choropleth of Nigeria states showing filing density
- Top-at-risk users widget: users with upcoming deadlines and incomplete data

#### 2.3.2 Analytics Depth (`admin-dashboard/src/app/analytics/`)
```
Current state: InvoiceChart, PaymentChart, UserGrowth, SyncHealth (all i18n'd, no mock data)
Target state: 8-panel analytics suite
```
Add panels:
- OCR confidence distribution histogram
- Expense category breakdown (Recharts PieChart with Nigerian color palette)
- Tax type utilization (which calculators are used most)
- Anomaly detection effectiveness (false positive rate over time)
- Payment gateway success rates (Paystack vs Flutterwave vs Remita)
- Sync latency percentile chart (P50, P95, P99)

#### 2.3.3 NRS Operations Center (`admin-dashboard/src/app/compliance/`)
- Live NRS submission queue status (pending/processing/stamped/failed)
- IRN generation success rate with retry controls
- DigiTax API health monitor with latency graph
- Bulk re-submission for failed NRS jobs
- Export NRS audit trail as CSV/Excel

### 2.4 🔧 Backend Performance & Reliability

#### 2.4.1 BullMQ Queue Architecture (`backend/src/queues/`)
```
Current state: NRS queue with exponential backoff (added v2.0.0)
Target state: Full async task orchestration
```
Define these queues with priorities and DLQ:
- `nrs-submission` (priority: critical, max retries: 5, backoff: exponential)
- `ocr-processing` (priority: high, max retries: 3, timeout: 30s)
- `payroll-calculation` (priority: medium, max retries: 2)
- `device-sync` (priority: low, max retries: 10, rate: 100/min)
- `notification-dispatch` (priority: medium, rate: 50/min)
- `compliance-digest` (priority: low, cron: `0 8 * * *`)

Each queue must have:
- DLQ with Slack/email alert on DLQ overflow
- Queue health endpoint feeding admin dashboard
- Prometheus metrics: `queue_depth`, `processing_time_ms`, `failure_rate`

#### 2.4.2 Database Query Optimization
```
Current state: Prisma queries with `any` type workarounds
Target state: Indexed, paginated, cached critical paths
```
- Audit N+1 queries in `/routes/invoices.ts` and `/routes/expenses.ts`
- Add database indexes: `(userId, createdAt)` on invoices/expenses/transactions
- Implement cursor-based pagination for list endpoints (replace offset pagination)
- Add Redis read-through cache for: tax rate tables, user profile, exchange rates
- Cache TTL strategy: rates (24h), profiles (1h), transactional data (5min)

#### 2.4.3 Payment Gateway Reliability
```
Current state: Paystack + Flutterwave + Remita with failover
Target state: Intelligent routing with circuit breakers
```
- Implement circuit breaker pattern: if gateway fails 3/5 attempts → open circuit → route to next
- Add payment idempotency keys to prevent double-charges
- Webhook signature verification for all three gateways
- Payment reconciliation job: daily cross-check of gateway records vs DB records
- Retry failed webhooks with exponential backoff (max 24h)

---

## 🔐 PHASE 3 — SECURITY HARDENING

### 3.1 Encryption Audit
```bash
# Verify AES-256-GCM coverage — from PRODUCTION_READY.md:
# TIN/BVN/NIN must be encrypted. Audit for any new fields added in v2.0.0
grep -r "encryption" backend/src/services/ --include="*.ts" -l
```
- Ensure all new AI insight data containing financial projections is encrypted at rest
- Add field-level encryption for OCR results that contain TIN/BVN data
- Verify `TAX_ID_ENCRYPTION_KEY` rotation procedure is documented

### 3.2 API Security
- Add request signing for webhook endpoints (HMAC-SHA256)
- Implement API versioning guard: deprecate v0 routes if any exist
- Add suspicious activity detection: >10 failed auth attempts from same IP → temporary block + alert
- Audit CORS configuration: ensure `ALLOWED_ORIGINS` never allows wildcard in production

### 3.3 Mobile Security
- Implement certificate pinning for API calls (Expo's `expo-crypto`)
- Add biometric authentication option (Expo LocalAuthentication)
- Secure SQLite database with SQLCipher for offline data at rest
- Add session timeout: auto-logout after 30min inactivity with warning

---

## 🌐 PHASE 4 — COMPLIANCE & LOCALIZATION

### 4.1 Nigeria Tax Act 2025 — Full Implementation Verification

Reference: `backend/config/nta2025-rules.json` and `packages/contracts/src/tax-rules.ts`

Verify and fix if needed:
```
PIT Bands (NTA 2025):
  0 - 800,000     → 7%
  800,001 - 2,200,000 → 11%  
  2,200,001 - 4,200,000 → 15%
  4,200,001 - 6,600,000 → 19%
  6,600,001 - 16,600,000 → 21%
  > 16,600,000    → 24%

Development Levy: 4% (added in v1.0.x)
EDT (Electronic Development Tax): 2%
Minimum ETR (Effective Tax Rate): 15%
VAT: 7.5% (standard rate)
CIT: 0% (<25M turnover), 20% (25M-100M), 30% (>100M)
WHT: 5-10% depending on transaction type
PAYE: PIT rates applied to employment income
```

- Add crypto CGT improvements: NFT disposal tracking, DeFi yield classification
- Implement Development Levy calculator prominently in mobile UI
- Add EDT computation for qualifying digital transactions

### 4.2 NRS 2026 E-Invoicing Compliance

Current: DigiTax/FIRS integration, IRN stamping, 4 PDF templates, QR codes, bulk operations.

Enhance:
- Implement UBL 2.1 schema validation before submission (not just after)
- Add invoice amendment flow (credit notes, debit notes) per NRS spec
- Support B2G invoicing (Government procurement invoices)
- Add QR code deep-link: scanning QR opens invoice verification on NRS portal
- Implement e-receipt for retail transactions (simplified invoice)

### 4.3 Nigerian Pidgin i18n Deepening

```
Current: 1,080+ keys, English + Pidgin
Target: Cultural fluency, not just translation
```
- Audit all Pidgin keys for authenticity (use native speaker review checklist)
- Add Yoruba and Hausa as optional third languages (structure only, translations can be empty stubs)
- Implement dynamic number formatting: `₦1,500,000` → `₦1.5M` in compact contexts
- Add Nigerian cultural calendar overlays: Ramadan tax deferral reminders, Christmas/New Year filing windows

---

## 🧪 PHASE 5 — TEST COVERAGE EXPANSION

### 5.1 Backend Test Targets
```
Current: 423 tests, 97.29% tax engine coverage, 12.18% overall
Target: 460+ tests, >98% tax engine, >40% overall
```

New test suites to add:
```typescript
// backend/src/__tests__/ai/anomaly-detection.test.ts
describe('AnomalyDetectionService', () => {
  it('detects duplicate amounts within 48h window')
  it('flags z-score spikes above 3 standard deviations')  
  it('identifies VAT mismatch on registered vendors')
  it('correctly scores severity: low/medium/high/critical')
  it('generates explanations in both English and Pidgin')
})

// backend/src/__tests__/queues/nrs-queue.test.ts
describe('NRSQueue', () => {
  it('retries failed submissions with exponential backoff')
  it('routes to DLQ after max retries exceeded')
  it('emits Prometheus metrics on job completion')
  it('handles idempotent resubmission safely')
})

// backend/src/__tests__/services/ocr-enhanced.test.ts
describe('EnhancedOCRService', () => {
  it('classifies receipts into 13 categories correctly')
  it('falls back to Tesseract when Vision API unavailable')
  it('rejects images > 5MB before API call')
  it('extracts NGN amounts with comma separators')
  it('handles handwritten amounts with confidence < 70%')
})
```

### 5.2 Mobile Test Expansion
```
Current: 139 tests (v5.0.0 baseline), 100% pass rate
Target: 180+ tests
```
- Add Detox E2E tests for critical user journeys: onboarding → invoice → NRS submission → payment
- Add offline/online transition tests
- Test biometric auth (mock Expo LocalAuthentication)
- Test dark mode rendering for all 15 screens

### 5.3 Admin Dashboard Tests
```
Current: No jest config confirmed
Target: Jest + Testing Library setup with >60% coverage
```
- Add component tests for all Recharts panels
- Test cold-start fallback responses
- Test authentication flow and RBAC

---

## 🚀 PHASE 6 — DEPLOYMENT & OBSERVABILITY

### 6.1 Deployment Pipeline Hardening

#### Backend (Render)
```yaml
# render.yaml — verify these settings
services:
  - type: web
    name: taxbridge-api
    env: node
    buildCommand: cd backend && npm ci && npm run build
    startCommand: node backend/dist/backend/src/server.js
    healthCheckPath: /health
    autoDeploy: true
```
- Add pre-deploy hook: run `npx tsc --noEmit` — fail build if TypeScript errors
- Add post-deploy smoke test: hit `/health`, `/health/db`, `/health/queues`
- Configure auto-rollback: if health check fails 3x in 5min → rollback to previous

#### Admin Dashboard (Vercel)
```json
// vercel.json — verify these settings
{
  "builds": [{ "src": "admin-dashboard/package.json", "use": "@vercel/next" }],
  "env": {
    "BACKEND_API_URL": "@taxbridge_backend_url",
    "NEXT_PUBLIC_API_URL": "@taxbridge_public_api_url"
  }
}
```
- Add Vercel preview deployments for every PR
- Configure Edge Middleware for auth protection on admin routes
- Add Core Web Vitals monitoring (LCP < 2.5s, FID < 100ms, CLS < 0.1)

#### Mobile (EAS)
```json
// mobile/eas.json — current state after v2.0.0
{
  "build": {
    "production": {
      "cache": { "key": "v7-production", "disabled": false },
      "android": { "buildType": "apk", "gradleCommand": ":app:bundleRelease" }
    }
  }
}
```
- If native deps change: bump cache key to `v8-*`
- Set up EAS Update for OTA patches (no store submission needed for JS changes)
- Configure Sentry source maps upload in EAS build hooks

### 6.2 Monitoring & Alerting

#### Prometheus Metrics to Add
```typescript
// New metrics for v3.0 target
const metrics = {
  // OCR Performance
  'ocr_confidence_score_histogram': Histogram (buckets: [0.5, 0.7, 0.8, 0.9, 0.95, 1.0]),
  'ocr_category_classification_total': Counter (labels: category, correct/incorrect),
  
  // Tax Engine
  'tax_calculation_duration_ms': Histogram,
  'tax_calculation_errors_total': Counter (labels: tax_type, error_type),
  
  // Anomaly Detection
  'anomaly_detected_total': Counter (labels: signal_type, severity),
  'anomaly_false_positive_rate': Gauge,
  
  // Queue Health
  'queue_depth_gauge': Gauge (labels: queue_name),
  'queue_processing_time_ms': Histogram (labels: queue_name),
  'queue_failure_rate': Gauge (labels: queue_name),
  
  // NRS Compliance
  'nrs_submission_total': Counter (labels: status: success/failed/retrying),
  'nrs_submission_duration_ms': Histogram,
  'irn_generation_total': Counter (labels: status),
}
```

#### Alerting Rules (Prometheus → Alertmanager → Slack/Email)
```yaml
# Alert thresholds from PRODUCTION_READY.md success metrics
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
  
- alert: NRSSubmissionFailures  
  expr: rate(nrs_submission_total{status="failed"}[10m]) > 0.05
  
- alert: QueueDepthCritical
  expr: queue_depth_gauge{queue="nrs-submission"} > 100
  
- alert: OCRConfidenceDropping
  expr: avg(ocr_confidence_score_histogram) < 0.7
```

---

## 📝 PHASE 7 — DOCUMENTATION & PROTOCOLS

### 7.1 Update These Files (REQUIRED after changes)
```
CHANGELOG.md           → Add v3.0.0 entry with complete change log
PRODUCTION_READY.md    → Update metrics, test counts, new features
docs/DEVELOPER_GUIDE.md → Document new AI services and queue architecture
docs/API_REFERENCE.md  → Document new /api/v1/insights/* endpoints
docs/INCIDENT_RESPONSE.md → Add AI anomaly investigation runbook
backend/config/nta2025-rules.json → If any tax rules change
```

### 7.2 New Documentation Required
```
docs/AI_INTELLIGENCE_GUIDE.md     → OCR, anomaly detection, tax forecasting
docs/QUEUE_ARCHITECTURE.md        → BullMQ queue design, DLQ handling, monitoring
docs/SECURITY_PROTOCOLS_V2.md     → Updated encryption, biometric auth, cert pinning
docs/NIGERIAN_TAX_COMPLIANCE.md   → Human-readable NTA 2025 implementation guide
mobile/DARK_MODE_GUIDE.md         → Color tokens, theming, testing dark mode
```

---

## 💻 COMMIT STRATEGY

Use **atomic commits** mapped to phases. Never mix phases in a single commit.

```bash
# Phase 1 — Stabilization
git commit -m "fix(deps): resolve Expo SDK 54 native compatibility warnings"
git commit -m "test(backend): fix 3 flaky integration tests in compliance suite"

# Phase 2 — Features
git commit -m "feat(ocr): expand to 13-category Nigerian receipt classification"
git commit -m "feat(ai): add 6 new anomaly detection signals with severity scoring"
git commit -m "feat(mobile): implement Tax Health Score with animated dashboard"
git commit -m "feat(mobile): camera-native smart capture for receipt scanning"
git commit -m "feat(admin): add NRS operations center with live queue monitoring"
git commit -m "feat(queues): implement full BullMQ task orchestration with DLQs"

# Phase 3 — Security
git commit -m "security: add biometric auth and SQLite encryption (SQLCipher)"
git commit -m "security: implement certificate pinning for API calls"

# Phase 4 — Compliance
git commit -m "compliance: verify and document full NTA 2025 tax band accuracy"
git commit -m "i18n: add Yoruba/Hausa language stubs + Pidgin authenticity audit"

# Phase 5 — Tests
git commit -m "test: add 37 new tests for AI services (anomaly, OCR, queues)"

# Phase 6 — DevOps
git commit -m "devops: add Prometheus metrics for OCR, anomaly, and NRS queues"
git commit -m "devops: configure EAS Update for OTA mobile patches"

# Phase 7 — Docs
git commit -m "docs: update CHANGELOG v3.0.0 and all production documentation"

# Deploy
git push origin master
# → Auto-triggers Render (backend) and Vercel (admin) deployments
# → Manually trigger: eas build --platform all --profile production
```

---

## ✅ PRE-PUSH VALIDATION CHECKLIST

Run this exact sequence before every push to `master`:

```powershell
# 1. TypeScript — must be zero errors
cd backend && npx tsc --noEmit
cd mobile && npx tsc --noEmit  
cd admin-dashboard && npx tsc --noEmit

# 2. Tests — must not regress from baseline
cd backend && npm test
# Expect: ≥423 passing, 0 new failures

# 3. Tax compliance verification
pwsh scripts/verify-tax-compliance.ps1
# Must show all tax rates verified

# 4. Production readiness
pwsh scripts/validate-production-readiness.ps1
# All checks must pass

# 5. Build verification
cd backend && npm run build
# Must produce dist/ without errors

# 6. NRS terminology audit
grep -rn "FIRS" mobile/src admin-dashboard/src backend/src --include="*.ts" --include="*.tsx" --include="*.json"
# Must return ZERO results (NRS only)
```

---

## 🎨 DESIGN SYSTEM PRINCIPLES

### Color Palette (Nigerian Fintech — Trust + Energy)
```
Primary:     #1B4F72  (Deep Navy — Trust, authority)
Secondary:   #27AE60  (Emerald — Growth, compliance)  
Accent:      #F39C12  (Amber — Alerts, deadlines)
Danger:      #E74C3C  (Red — Overdue, failures)
Surface:     #F8F9FA  (Light mode background)
SurfaceDark: #1A1A2E  (Dark mode background)
```

### Typography Scale
```
Display: 32px, weight 700 (headers, hero numbers)
Title:   24px, weight 600 (section headers)  
Body:    16px, weight 400 (content)
Caption: 12px, weight 400 (labels, metadata)
Mono:    14px (amounts, IRN codes)
```

### Component Principles
- Every interactive element: loading state + error state + empty state
- All amounts: `₦` prefix, comma-separated thousands, 2 decimal places
- All dates: Nigerian format `DD/MM/YYYY` with relative time for recent items
- Animations: 200ms ease-in-out for micro-interactions, 350ms for page transitions
- Touch targets: minimum 44×44px (accessibility)

---

## ⚠️ KNOWN LANDMINES — DO NOT TOUCH

These areas are deliberately implemented a certain way. Changing them without understanding the context will break production:

| Area | Why It's Like This | What You Must Not Do |
|------|------------------|---------------------|
| `Prisma.XxxWhereInput` → `any` | Network timeout prevented engine download on Render | Don't restore Prisma namespace types |
| `FIRS` references | Fully migrated to `NRS` per regulatory requirement | Don't reintroduce FIRS anywhere |
| `mobile/eas.json` is canonical | Root `eas.json` is different and deprecated | Don't modify root `eas.json` |
| `scripts/deploy-production.ps1` | Deprecated, archived version exists | Use root `deploy-production.ps1` only |
| Admin cold-start 200 fallbacks | Render free tier has warm-up delay | Don't remove graceful fallback responses |
| `compileSdkVersion: 36` | Required for `androidx.camera:1.5.0-rc01` | Don't downgrade to 35 |
| OCR confidence threshold: 70% | Calibrated against Nigerian receipt quality | Don't raise above 85% without A/B test |

---

## 📊 SUCCESS METRICS FOR V3.0

| Metric | v2.0.0 Baseline | V3.0 Target |
|--------|----------------|-------------|
| Backend tests | 423 passing | ≥460 passing |
| Tax engine coverage | 97.29% | ≥98.5% |
| Overall backend coverage | 12.18% | ≥40% |
| OCR accuracy (13 categories) | Unmeasured | ≥90% |
| Anomaly detection precision | N/A | ≥85% |
| API P95 response time | <500ms | <350ms |
| Admin dashboard LCP | Unmeasured | <2.5s |
| i18n key coverage | 1,080+ | 1,200+ |
| NRS submission success rate | >90% | >97% |
| Mobile crash rate | Unmeasured | <0.1% |
| Payment success rate | >95% | >98% |

---

## 🔚 FINAL OUTPUT DEFINITION

When all phases are complete, the production system must deliver:

1. **Backend**: Live at `https://taxbridge-api-ker8.onrender.com` with:
   - All 460+ tests passing
   - AI insights endpoints operational (`/api/v1/insights/*`)
   - BullMQ queues healthy (`/health/queues`)
   - Prometheus metrics streaming (`/metrics`)

2. **Admin Dashboard**: Live at `https://taxbridge.vercel.app` with:
   - 8-panel analytics suite rendering real data
   - NRS Operations Center showing live queue status
   - Anomaly alert panel populated
   - Zero cold-start errors

3. **Mobile App**: EAS build ready with:
   - Tax Health Score on dashboard
   - Smart camera receipt capture
   - Biometric auth option
   - Dark mode support
   - 180+ tests passing

4. **Documentation**: All markdown files updated, no stale references.

5. **Zero regressions**: Every existing feature from v2.0.0 works exactly as before.

---

## 🛠️ PART II — IMPLEMENTATION EXECUTION LAYER

*This section contains the actual reference code, file-by-file implementation targets, and decision trees that an AI coding agent must follow. Read Part I for the strategy; use Part II to execute.*

---

## ⚙️ MODULE 1 — AI ANOMALY DETECTION ENGINE

### File: `backend/src/services/anomaly-detection.ts`

This service is new in v2.0.0 but only has 3 signals. Expand to 9. Below is the full target implementation contract:

```typescript
// ============================================================
// IMPLEMENTATION CONTRACT — DO NOT DEVIATE FROM THESE TYPES
// ============================================================

export type AnomalySignal =
  | 'duplicate_amount'          // Same amount from same vendor < 48h
  | 'zscore_spike'              // Amount > 3 std-devs from user mean
  | 'vat_mismatch'              // VAT claimed but vendor not NRS-registered
  | 'round_number_clustering'   // >60% of last 30 expenses are round numbers
  | 'weekend_business_expense'  // Nigerian Sunday business expense
  | 'rapid_succession'          // Same vendor, same amount, < 48h apart
  | 'phantom_vendor'            // TIN not in Youverify CAC registry
  | 'cashflow_cliff'            // 30-day projection shows tax deadline shortfall
  | 'vat_threshold_approach';   // Revenue approaching ₦100M VAT registration threshold

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyResult {
  signal: AnomalySignal;
  severity: AnomalySeverity;
  affectedRecordId: string;
  affectedRecordType: 'expense' | 'invoice' | 'payment' | 'tax_liability';
  explanation: {
    en: string;   // Plain English, max 2 sentences
    pidgin: string; // Nigerian Pidgin, culturally authentic
  };
  recommendedAction: {
    en: string;
    pidgin: string;
  };
  regulatoryReference?: string; // e.g., "NTA 2025 §47(2)(b)"
  confidence: number; // 0.0 - 1.0
  detectedAt: Date;
  metadata: Record<string, any>; // Signal-specific context
}

// Severity matrix — use this table, do not invent your own:
// +-------------------------+----------+--------+-------+----------+
// | Signal                  | Min Sev  | Triggers High   | Triggers Critical |
// +-------------------------+----------+-----------------+------------------+
// | duplicate_amount        | low      | >₦500k          | >₦5M             |
// | zscore_spike            | medium   | z > 4           | z > 6            |
// | vat_mismatch            | high     | always high     | claim > ₦1M      |
// | round_number_clustering | low      | >75%            | N/A              |
// | weekend_business_expense| low      | >₦200k          | N/A              |
// | rapid_succession        | medium   | >₦1M total      | >₦10M total      |
// | phantom_vendor          | high     | always high     | claim > ₦500k    |
// | cashflow_cliff          | high     | <30 days runway | deadline < 7 days|
// | vat_threshold_approach  | medium   | >₦80M revenue   | >₦95M revenue    |
// +-------------------------+----------+-----------------+------------------+
```

### Implementation Rules for Anomaly Service
1. **Never throw** — always return `AnomalyResult[]`, empty array if clean
2. **Idempotent** — running the same check twice must produce the same result
3. **Async-safe** — all DB queries use `Promise.all()` for parallelism
4. **Cached** — results cached in Redis for 15 minutes with key `anomaly:{userId}:{recordId}`
5. **Prisma constraint** — use `any` for all Prisma where/input types (inherited constraint from commit `218972e`)

### New API Endpoints Required
```
POST /api/v1/insights/anomalies/scan          — Trigger full scan for userId
GET  /api/v1/insights/anomalies               — List anomalies (paginated, cursor-based)
GET  /api/v1/insights/anomalies/:id           — Single anomaly detail
POST /api/v1/insights/anomalies/:id/dismiss   — Mark false positive
GET  /api/v1/insights/anomalies/summary       — Severity counts for dashboard widget
```

---

## ⚙️ MODULE 2 — ENHANCED OCR PIPELINE

### File: `backend/src/routes/ocr.ts` + `backend/src/services/ocr-enhanced.ts`

#### Decision Tree for OCR Processing
```
INCOMING IMAGE
    │
    ├─► Size check: > 5MB? → Reject 413 immediately (existing)
    │
    ├─► Enhancement: Sharp pipeline
    │       ├─ Grayscale conversion
    │       ├─ Contrast normalization (Nigerian thermal receipt compensation)
    │       ├─ Deskew (up to 15° rotation correction)
    │       └─ Sharpening kernel for faded receipts
    │
    ├─► PRIMARY: Google Cloud Vision (if GOOGLE_CLOUD_KEY_FILE set)
    │       └─ confidence ≥ 0.70? → Proceed to parsing
    │                              → confidence < 0.70? → FALLBACK
    │
    ├─► FALLBACK: Tesseract
    │       └─ confidence ≥ 0.60? → Proceed with review_required=true
    │                              → confidence < 0.60? → Return review_required, raw_text only
    │
    └─► PARSING: Nigerian Receipt Parser
            ├─ Extract: merchant_name, tin (if present), amount, vat_amount, date
            ├─ Classify: 13 expense categories (ML classifier)
            ├─ Validate: amount format (₦X,XXX.XX), date range (not future, not > 5 years old)
            └─ Enrich: look up merchant in vendor database → pre-fill vendor details
```

#### 13-Category Classifier Implementation
```typescript
// backend/src/services/ocr-category-classifier.ts

// Training signal keywords — these are Nigerian-market specific
// IMPORTANT: Keep these in sync with mobile/src/types/expense.ts ExpenseCategory enum
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  fuel:              ['petrol', 'diesel', 'filling station', 'nnpc', 'conoil', 'oando', 'mobil', 'total', 'ardova', 'litres', 'liters'],
  meals:             ['restaurant', 'food', 'eatery', 'mr biggs', 'chicken republic', 'dominos', 'cafe', 'canteen', 'lunch', 'dinner', 'breakfast', 'suya', 'amala'],
  office_supplies:   ['stationery', 'paper', 'ink', 'toner', 'printer', 'staple', 'binder', 'file', 'pen', 'notebook', 'computer'],
  transport:         ['uber', 'bolt', 'taxify', 'keke', 'bus', 'danfo', 'brt', 'flight', 'airline', 'airpeace', 'arik', 'dana', 'ticket', 'fare', 'toll'],
  utilities:         ['nepa', 'phcn', 'ikeja electric', 'eko electric', 'kedco', 'phedc', 'aedc', 'electricity', 'prepaid meter', 'water board', 'lawma'],
  rent:              ['rent', 'lease', 'tenancy', 'landlord', 'property', 'office space', 'warehouse', 'shop rent'],
  professional_fees: ['legal', 'lawyer', 'accountant', 'audit', 'consulting', 'retainer', 'professional service', 'ican', 'nba'],
  advertising:       ['advertising', 'marketing', 'billboard', 'radio', 'tv', 'social media', 'google ads', 'facebook ads', 'flyer', 'banner', 'promotion'],
  repairs:           ['repair', 'maintenance', 'service', 'technician', 'mechanic', 'plumber', 'electrician', 'generator', 'ac service'],
  insurance:         ['insurance', 'premium', 'aiico', 'leadway', 'nicon', 'custodian', 'staco', 'policy', 'claim'],
  medical:           ['hospital', 'clinic', 'pharmacy', 'drug', 'medicine', 'doctor', 'nurse', 'lab', 'test', 'hmo', 'health'],
  education:         ['school', 'university', 'training', 'seminar', 'workshop', 'course', 'tuition', 'certification', 'book', 'library'],
  other:             []  // Catch-all — always last
};

// Scoring: keyword hit = 1 point, TIN presence bonus = 2 points
// Highest score wins. Ties broken by keyword specificity (longer keyword = more specific)
// Minimum score for non-'other' classification: 2 points
```

#### Vendor Database Structure
```typescript
// backend/src/data/nigerian-vendors.ts
// Seed with top 500 Nigerian businesses for auto-fill
export interface VendorRecord {
  name: string;
  aliases: string[];         // Common receipt abbreviations
  tin?: string;              // Known TIN (NRS-verified)
  vatRegistered: boolean;
  category: ExpenseCategory;
  city?: string;
  state?: NigerianState;
}

// Examples to include in seed data:
// { name: 'NNPC Retail', aliases: ['NNPC', 'NNPC Ltd'], tin: '0000000000', vatRegistered: true, category: 'fuel' }
// { name: 'Shoprite', aliases: ['Shoprite Nigeria'], vatRegistered: true, category: 'other' }
// { name: 'MTN Nigeria', aliases: ['MTN', 'MTN Plc'], tin: '0123456789', vatRegistered: true, category: 'utilities' }
// ... (expand to 500 records)
```

---

## ⚙️ MODULE 3 — TAX HEALTH SCORE ENGINE

### Files: `backend/src/services/tax-health-score.ts` + mobile widget

The Tax Health Score (0–100) is the flagship new UX feature. It must be deterministic, explainable, and motivating.

#### Scoring Algorithm (Total: 100 points)
```typescript
export interface TaxHealthComponents {
  filingTimeliness: number;      // Max 30 pts — weighted by tax type severity
  dataCompleteness: number;      // Max 25 pts — % of expenses categorized
  complianceCalendar: number;    // Max 20 pts — upcoming deadlines prepped
  nrsSubmissions: number;        // Max 15 pts — invoice NRS stamp rate
  paymentHistory: number;        // Max 10 pts — on-time payment rate
}

// Filing timeliness scoring:
// Filed on time (all types): 30/30
// 1 late filing (minor): 22/30
// 1 late filing (VAT/CIT): 15/30
// 2+ late filings: 5/30
// Outstanding liability: 0/30

// Grade thresholds:
// 90-100: 🟢 "Excellent — Tax Champion"
// 75-89:  🟡 "Good — Minor gaps to close"
// 50-74:  🟠 "Fair — Action needed"
// 25-49:  🔴 "Poor — Compliance risk"
// 0-24:   ⚠️  "Critical — Immediate attention"

// Pidgin grade names:
// 90-100: "Tax Champion — You sabi am!"
// 75-89:  "E good — small-small improve"
// 50-74:  "E dey go — do better"
// 25-49:  "E no good — fix am now"
// 0-24:   "WAHALA — do am now-now!"
```

#### API Endpoint
```
GET /api/v1/insights/tax-health-score
Response: {
  score: number,           // 0-100
  grade: string,           // 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  components: TaxHealthComponents,
  trend: 'improving' | 'stable' | 'declining',
  trendDelta: number,      // Score change vs 30 days ago
  topRecommendation: { en: string, pidgin: string },
  computedAt: string       // ISO timestamp
}
```

#### Mobile Widget (`mobile/src/components/TaxHealthScoreWidget.tsx`)
```typescript
// Visual spec:
// - Circular progress ring (SVG-based, no third-party lib dependency)
// - Score animates from 0 to actual value on mount (1.2s ease-out)
// - Ring color: green (#27AE60) for ≥75, amber (#F39C12) for ≥50, red (#E74C3C) below
// - Tap → navigates to full breakdown screen
// - Shows trend arrow (↑↓→) with delta in smaller text
// - Grade label in both English and Pidgin (toggle-able with tap)
// - Skeleton placeholder while loading (no layout shift)
```

---

## ⚙️ MODULE 4 — BULLMQ QUEUE ORCHESTRATION

### File: `backend/src/queues/index.ts` (new file, consolidating v2.0.0's NRS queue)

#### Queue Configuration Reference
```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';
import { redisConnection } from '../lib/redis';

// RULE: All queues must use the same Redis connection from lib/redis
// RULE: Never create Queue instances inside route handlers — import from here

export const QUEUE_NAMES = {
  NRS_SUBMISSION:       'nrs-submission',
  OCR_PROCESSING:       'ocr-processing',
  PAYROLL_CALCULATION:  'payroll-calculation',
  DEVICE_SYNC:          'device-sync',
  NOTIFICATION_DISPATCH:'notification-dispatch',
  COMPLIANCE_DIGEST:    'compliance-digest',
} as const;

// Queue-specific retry strategies (use exponential backoff formulas below)
// nrs-submission:       attempts=5, backoff=exponential(2000ms)  — NRS can be slow
// ocr-processing:       attempts=3, backoff=exponential(1000ms)  — Vision API transient
// payroll-calculation:  attempts=2, backoff=fixed(5000ms)        — Idempotent, safe to retry
// device-sync:          attempts=10, backoff=exponential(500ms)  — Mobile network flaky
// notification-dispatch:attempts=3, backoff=exponential(3000ms) — Delivery must succeed
// compliance-digest:    attempts=1, backoff=none, cron='0 8 * * *' — Daily digest

// DLQ: All failed-after-max-retries jobs move to 'dlq:{queue-name}'
// DLQ alert: Trigger Sentry alert when DLQ depth > 10
// DLQ retention: 7 days before automatic cleanup
```

#### Prometheus Integration for Queues
```typescript
// backend/src/monitoring/queue-metrics.ts
// Collect these metrics every 30 seconds via setInterval

const metrics = {
  // Gauge: current queue depth
  queueDepth: new Gauge({
    name: 'taxbridge_queue_depth',
    help: 'Current number of jobs in queue',
    labelNames: ['queue_name', 'status'] // status: waiting|active|delayed|failed
  }),
  
  // Histogram: job processing duration
  jobDuration: new Histogram({
    name: 'taxbridge_job_duration_ms',
    help: 'Job processing time in milliseconds',
    labelNames: ['queue_name'],
    buckets: [100, 500, 1000, 3000, 10000, 30000]
  }),
  
  // Counter: job outcomes
  jobOutcome: new Counter({
    name: 'taxbridge_job_total',
    help: 'Total jobs processed',
    labelNames: ['queue_name', 'outcome'] // outcome: completed|failed|stalled
  })
};
```

#### Health Endpoint Integration
```typescript
// Add to existing /health/queues endpoint in backend/src/routes/health.ts
// Must return graceful 200 even if Redis is cold-starting (admin resilience pattern)

export async function getQueueHealth(): Promise<QueueHealthStatus> {
  try {
    const stats = await Promise.all(
      Object.values(QUEUE_NAMES).map(async (name) => {
        const queue = getQueue(name);
        const [waiting, active, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);
        return { name, waiting, active, failed, delayed };
      })
    );
    return { status: 'healthy', queues: stats, timestamp: new Date().toISOString() };
  } catch (error) {
    // IMPORTANT: Return graceful 200 for admin cold-start resilience
    // This pattern was established in v2.0.0 — preserve it
    return { status: 'degraded', queues: [], timestamp: new Date().toISOString(), error: 'Redis unavailable' };
  }
}
```

---

## ⚙️ MODULE 5 — MOBILE DARK MODE SYSTEM

### Design Token File: `mobile/src/theme/tokens.ts` (new file)

Dark mode must be implemented via a token system, not hardcoded color overrides. This prevents the "one-off patch" anti-pattern seen in v1.x.

```typescript
export const lightTokens = {
  // Surfaces
  bg:            '#F8F9FA',
  surface:       '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border:        '#E9ECEF',
  
  // Text
  textPrimary:   '#1B2631',
  textSecondary: '#566573',
  textTertiary:  '#ABB2B9',
  textInverse:   '#FFFFFF',
  
  // Brand
  brandPrimary:  '#1B4F72',
  brandSuccess:  '#27AE60',
  brandWarning:  '#F39C12',
  brandDanger:   '#E74C3C',
  brandInfo:     '#2980B9',
  
  // Nigerian cultural
  nairaGreen:    '#008751', // Nigerian flag green
  nairaSandstone:'#E8B84B', // NGN coin color
  
  // Interactive
  pressedOverlay:'rgba(0,0,0,0.06)',
  skeletonBase:  '#E9ECEF',
  skeletonShimmer:'#F8F9FA',
};

export const darkTokens: typeof lightTokens = {
  bg:            '#0D1117',
  surface:       '#161B22',
  surfaceRaised: '#1C2128',
  border:        '#30363D',
  textPrimary:   '#E6EDF3',
  textSecondary: '#8B949E',
  textTertiary:  '#484F58',
  textInverse:   '#0D1117',
  brandPrimary:  '#58A6FF',
  brandSuccess:  '#3FB950',
  brandWarning:  '#D29922',
  brandDanger:   '#F85149',
  brandInfo:     '#388BFD',
  nairaGreen:    '#2EA043',
  nairaSandstone:'#BB8009',
  pressedOverlay:'rgba(255,255,255,0.06)',
  skeletonBase:  '#21262D',
  skeletonShimmer:'#30363D',
};

// Usage hook — wraps useColorScheme and memoizes
// export function useTheme(): typeof lightTokens
// All screens and components MUST use this hook, not raw colors
```

#### Migration Strategy for Existing Screens
```
Priority 1 (user-facing, high-traffic):
  DashboardScreen.tsx, InvoiceScreen.tsx, ScanReceiptScreen.tsx, TaxCalculatorScreen.tsx

Priority 2 (onboarding):
  All screens in mobile/src/screens/onboarding/

Priority 3 (secondary):
  SettingsScreen.tsx, ProfileScreen.tsx, ComplianceScreen.tsx

Pattern for migration:
  BEFORE: color: '#1B2631'
  AFTER:  color: theme.textPrimary
  
DO NOT change: archive/ components (deprecated, flagged in v1.0.3)
```

---

## ⚙️ MODULE 6 — NRS OPERATIONS CENTER (ADMIN)

### File: `admin-dashboard/src/app/compliance/nrs-operations/page.tsx` (new page)

This is the most operationally critical new admin screen. It gives admins visibility into the NRS submission pipeline.

#### Component Architecture
```
NRSOperationsPage
├── NRSHealthBanner          — DigiTax API status (green/amber/red)
├── QueueStatusGrid          — 3-column: Pending | Processing | Failed
│   ├── QueueDepthGauge      — Animated circular gauge
│   ├── ThroughputChart      — Submissions/hour line chart (Recharts)
│   └── FailureRateGauge
├── LiveSubmissionFeed       — Real-time list, polling every 10s
│   └── SubmissionRow        — IRN | BusinessName | Status | Timestamp | Actions
├── FailedSubmissionsTable   — Sortable/filterable DataTable
│   ├── Filters: date range, error type, business size
│   ├── Actions: Retry Single | Retry Selected | Export CSV
│   └── ErrorDetailDrawer    — Slide-in panel with full error context
└── IRNAuditExport           — Date range picker + Download button
```

#### Data Fetching Pattern
```typescript
// Use SWR with the cold-start resilience pattern from v2.0.0
// DO NOT use React Query (not in current deps)
// DO NOT use useEffect + fetch directly (established pattern is SWR)

import useSWR from 'swr';

function useNRSQueueStatus() {
  const { data, error, isLoading } = useSWR(
    '/api/admin/nrs/queue-status',
    fetcher,
    {
      refreshInterval: 10_000,     // Poll every 10s
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // Stop retrying after 3 attempts (cold-start resilience)
        if (retryCount >= 3) return;
        setTimeout(() => revalidate({ retryCount }), 5000);
      },
      fallbackData: {              // Graceful fallback for cold-start
        pending: 0, processing: 0, failed: 0,
        throughput: [], status: 'unknown'
      }
    }
  );
  return { data, isLoading, isError: !!error };
}
```

---

## ⚙️ MODULE 7 — PAYMENT CIRCUIT BREAKER

### File: `backend/src/services/payment-gateway.ts`

The existing Paystack → Flutterwave → Remita failover chain needs a proper circuit breaker pattern, not just try/catch chains.

#### Circuit Breaker State Machine
```
CLOSED (normal)
    │
    ├─► 3 failures in 60s window?
    │       └─► OPEN (bypass gateway, try next)
    │
OPEN (bypassing)
    │
    ├─► 30s cooldown elapsed?
    │       └─► HALF-OPEN (probe with single request)
    │
HALF-OPEN (probing)
    │
    ├─► Probe succeeds? → CLOSED
    └─► Probe fails?   → OPEN (restart cooldown)
```

```typescript
// backend/src/services/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly name: string,           // e.g. 'paystack'
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 30_000,
    private readonly windowMs = 60_000
  ) {}

  // Returns true if the gateway should be attempted
  canAttempt(): boolean { ... }

  // Call after each attempt  
  recordSuccess(): void { ... }
  recordFailure(): void { ... }

  // Expose state for monitoring
  getState(): CircuitBreakerState { ... }
}

// Shared instances — one per gateway, singleton pattern
export const paystackBreaker     = new CircuitBreaker('paystack');
export const flutterwaveBreaker  = new CircuitBreaker('flutterwave');
export const remitaBreaker       = new CircuitBreaker('remita');
```

#### Gateway Selection Logic
```typescript
// Priority order: Paystack → Flutterwave → Remita
// Skip if circuit is OPEN
// On all OPEN: throw PaymentGatewayUnavailableError (don't silently fail)

async function selectGateway(): Promise<PaymentGateway> {
  const candidates = [
    { gateway: paystackGateway, breaker: paystackBreaker },
    { gateway: flutterwaveGateway, breaker: flutterwaveBreaker },
    { gateway: remitaGateway, breaker: remitaBreaker },
  ];
  
  for (const { gateway, breaker } of candidates) {
    if (breaker.canAttempt()) return gateway;
  }
  
  throw new PaymentGatewayUnavailableError(
    'All payment gateways are temporarily unavailable. Please retry in 30 seconds.'
  );
}
```

---

## ⚙️ MODULE 8 — SMART COMPLIANCE CALENDAR

### File: `backend/src/services/compliance-calendar.ts` (enhance existing)

#### Current state: Static deadline list
#### Target: Predictive + personalized deadline engine

```typescript
// The Nigerian tax calendar — these dates are LAW (NTA 2025)
// CRITICAL: Do not change these without citing the specific NTA 2025 section
export const NTA2025_DEADLINES = {
  VAT: {
    frequency: 'monthly',
    dueDay: 21,    // 21st of following month
    filingType: 'VAT Return (Form 002)',
    latepenalty: { fixed: 10_000, dailyRate: 0.005 }, // ₦10k + 0.5%/day
    statute: 'NTA 2025 §11(1)'
  },
  PIT: {
    frequency: 'annual',
    dueDate: { month: 3, day: 31 }, // March 31
    filingType: 'Personal Income Tax Return',
    latepenalty: { fixed: 50_000, interestRate: 0.21 },
    statute: 'NTA 2025 §41'
  },
  CIT: {
    frequency: 'annual',
    dueOffset: 'six-months-after-year-end',
    filingType: 'Company Income Tax Return',
    latepenalty: { percentOfTax: 0.10, interestRate: 0.21 },
    statute: 'NTA 2025 §55'
  },
  WHT: {
    frequency: 'monthly',
    dueDay: 21, // 21st of following month
    filingType: 'Withholding Tax Remittance',
    statute: 'NTA 2025 §78'
  },
  PAYE: {
    frequency: 'monthly',
    dueDay: 10, // 10th of following month
    filingType: 'PAYE Remittance',
    statute: 'NTA 2025 §82'
  },
  CGT: {
    frequency: 'on-disposal',
    dueOffset: '30-days-after-disposal',
    filingType: 'Capital Gains Tax Return',
    statute: 'NTA 2025 §32'
  }
};

// Predictive features to implement:
// 1. computeProjectedLiability(taxType, userId): uses trailing 90-day data
// 2. generateSmartReminders(userId): personalizes reminder frequency from filing history
// 3. identifySavingsWindow(userId): finds deductible expense opportunities pre-year-end
// 4. computePenaltyAccrual(dueDate, outstandingAmount): real-time penalty calculation
```

#### Push Notification Schedule
```typescript
// Reminder cadence — adaptive based on user's on-time rate
// On-time rate > 90%: remind at T-14, T-7, T-1
// On-time rate 70-90%: remind at T-30, T-14, T-7, T-3, T-1
// On-time rate < 70%: remind at T-30, T-21, T-14, T-7, T-3, T-1, T+1(overdue!)

// Notification templates must be i18n'd — add these keys to en.json and pidgin.json:
// compliance.reminder.subject: "{{taxType}} deadline in {{days}} days"
// compliance.reminder.body: "Your {{taxType}} return is due on {{date}}. Projected liability: ₦{{amount}}"
// compliance.reminder.pidgin.subject: "{{taxType}} due date dey {{days}} days"
// compliance.reminder.overdue: "⚠️ {{taxType}} payment is {{days}} days overdue"
// compliance.reminder.penalty: "Late penalty accruing: ₦{{amount}} so far"
```

---

## ⚙️ MODULE 9 — CRYPTO TAX ENHANCEMENTS (CGT)

### File: `backend/src/services/crypto-tax.ts` (enhance existing)

#### New CGT Features Required by NTA 2025

```typescript
// NTA 2025 treats crypto as capital assets — CGT applies at 10% on disposal gains
// FIFO method is mandatory per NTA 2025 §32 (already implemented in v2.0.0)
// New requirements:

// 1. NFT Disposal Tracking
export interface NFTDisposal {
  tokenId: string;
  collectionName: string;
  acquisitionDate: Date;
  acquisitionCostNGN: number;   // Convert from USD/ETH at historical rate
  disposalDate: Date;
  disposalProceedsNGN: number;
  gainOrLoss: number;           // Computed field
  cgtLiability: number;         // gainOrLoss * 0.10 if gain
}

// 2. DeFi Yield Classification
// DeFi yields are treated as income (PIT-applicable) not capital gains
// Exception: LP token disposal = CGT event
export type DefiTransactionType = 
  | 'staking_reward'     // PIT income — not CGT
  | 'yield_farming'      // PIT income — not CGT
  | 'lp_token_disposal'  // CGT event
  | 'swap'               // CGT event (if gain)
  | 'airdrop'            // PIT income at FMV on receipt date

// 3. Historical Exchange Rate Service
// Use CBN (Central Bank of Nigeria) official rates for NGN conversion
// Fallback: use CoinGecko historical data for USD price, then multiply by CBN USD/NGN rate
// Cache CBN rates in Redis: key='cbn-rate:{date}:{currency}', TTL=7days

// 4. CSV Portfolio Import
// Accept columns: date, type, amount, currency, usd_value, notes
// Auto-detect exchange formats: Binance, Coinbase, Kraken, Bybit, Quidax (Nigerian)
// Quidax-specific: handle NGN-direct trades without USD intermediate step
```

---

## ⚙️ MODULE 10 — i18n COMPLETENESS AUDIT

### Files: `mobile/src/i18n/en.json` + `mobile/src/i18n/pidgin.json`

Current key count: 1,080+. Target: 1,200+.

#### New Key Blocks Required (add to BOTH language files)

```jsonc
// Add these key blocks — Pidgin translations must be culturally authentic,
// NOT machine-translated English. Use these reference translations:

{
  "taxHealth": {
    "score": "Tax Health Score",
    "grade": {
      "excellent": "Tax Champion",
      "good": "Doing Well",
      "fair": "Needs Attention",
      "poor": "Action Required",
      "critical": "Urgent: Tax Risk"
    },
    "trend": {
      "improving": "↑ Improving",
      "stable": "→ Stable",
      "declining": "↓ Declining"
    }
  },

  "anomaly": {
    "title": "Smart Alerts",
    "severity": {
      "low": "Low",
      "medium": "Medium",
      "high": "High",
      "critical": "Critical"
    },
    "signals": {
      "duplicate_amount": "Possible duplicate expense detected",
      "zscore_spike": "Unusually large expense detected",
      "vat_mismatch": "VAT claim may be invalid",
      "phantom_vendor": "Vendor not found in NRS registry",
      "cashflow_cliff": "Tax deadline approaching — funds may be insufficient",
      "vat_threshold_approach": "Approaching VAT registration threshold"
    },
    "dismiss": "Dismiss",
    "investigate": "Investigate"
  },

  "cryptoTax": {
    "nft": {
      "title": "NFT Disposals",
      "tokenId": "Token ID",
      "collection": "Collection",
      "gain": "Capital Gain",
      "loss": "Capital Loss"
    },
    "defi": {
      "title": "DeFi Income",
      "stakingReward": "Staking Reward (Income)",
      "yieldFarming": "Yield Farming (Income)",
      "lpDisposal": "LP Token Disposal (CGT)"
    },
    "import": {
      "title": "Import Portfolio",
      "supported": "Supported: Binance, Coinbase, Quidax, Kraken",
      "dropzone": "Drop CSV file here or tap to browse"
    }
  }
}
```

```jsonc
// pidgin.json equivalents — CULTURALLY AUTHENTIC translations:
{
  "taxHealth": {
    "score": "Wetin Your Tax Score Be",
    "grade": {
      "excellent": "Tax Champion — You sabi am!",
      "good": "E good — small-small improve",
      "fair": "E dey go — do better",
      "poor": "E no good — fix am now",
      "critical": "WAHALA — do am now-now!"
    },
    "trend": {
      "improving": "↑ E dey go up",
      "stable": "→ E stand still",
      "declining": "↓ E dey go down"
    }
  },

  "anomaly": {
    "title": "Alert Alert!",
    "severity": {
      "low": "Small Issue",
      "medium": "Moderate Issue",
      "high": "Big Problem",
      "critical": "Serious Wahala"
    },
    "signals": {
      "duplicate_amount": "Abi you pay this thing twice?",
      "zscore_spike": "This expense too much — make you check am",
      "vat_mismatch": "VAT claim no correct — verify am",
      "phantom_vendor": "We no find this vendor for NRS — double-check",
      "cashflow_cliff": "Tax deadline dey near — your money fit no reach",
      "vat_threshold_approach": "Your revenue dey near ₦100M — VAT registration dey come"
    }
  }
}
```

---

## 🔄 MODULE 11 — GITHUB ACTIONS CI/CD PIPELINE

### File: `.github/workflows/ci.yml` (enhance existing)

The current GitHub Actions workflows need these additions to enforce quality gates before auto-deploy:

```yaml
name: TaxBridge CI — Quality Gate

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  # ── Job 1: Backend ──────────────────────────────────────────
  backend-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node 20
        uses: actions/setup-node@v4
        with: { node-version: '20.19.4' }
      
      - name: Install dependencies
        run: cd backend && npm ci
        
      - name: TypeScript compilation check
        run: cd backend && npx tsc --noEmit
        # FAIL FAST: Must produce zero errors (enforces commit 218972e standard)
        
      - name: Run tests with coverage
        run: cd backend && npm test -- --coverage --ci
        env:
          NODE_ENV: test
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          REDIS_URL: ${{ secrets.TEST_REDIS_URL }}
          
      - name: Coverage threshold check
        run: |
          # Tax engine must stay above 97%
          COVERAGE=$(cat backend/coverage/coverage-summary.json | jq '.total.statements.pct')
          echo "Tax engine coverage: $COVERAGE%"
          # Check specific tax engine file
          
      - name: NRS terminology audit
        run: |
          FIRS_COUNT=$(grep -rn "FIRS" backend/src --include="*.ts" | wc -l)
          if [ "$FIRS_COUNT" -gt "0" ]; then
            echo "ERROR: Found $FIRS_COUNT FIRS references — use NRS only"
            grep -rn "FIRS" backend/src --include="*.ts"
            exit 1
          fi
          echo "✅ NRS terminology audit passed"

  # ── Job 2: Admin Dashboard ──────────────────────────────────
  admin-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.19.4' }
      - run: cd admin-dashboard && npm ci
      - name: TypeScript check
        run: cd admin-dashboard && npx tsc --noEmit
      - name: Build verification
        run: cd admin-dashboard && npm run build
        env:
          NEXT_PUBLIC_API_URL: https://taxbridge-api-ker8.onrender.com
          BACKEND_API_URL: https://taxbridge-api-ker8.onrender.com

  # ── Job 3: Mobile ────────────────────────────────────────────
  mobile-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.19.4' }
      - run: cd mobile && npm ci
      - name: TypeScript check
        run: cd mobile && npx tsc --noEmit
      - name: Expo doctor
        run: cd mobile && npx expo-doctor@latest
      - name: Run mobile tests
        run: cd mobile && npx jest --ci
      - name: NRS terminology audit (mobile)
        run: |
          FIRS_COUNT=$(grep -rn "FIRS" mobile/src --include="*.ts" --include="*.tsx" | grep -v ".deprecated" | wc -l)
          if [ "$FIRS_COUNT" -gt "0" ]; then
            echo "ERROR: FIRS references found in active mobile code"
            exit 1
          fi

  # ── Job 4: Tax Compliance Verification ──────────────────────
  tax-compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify tax rules
        shell: pwsh
        run: pwsh scripts/verify-tax-compliance.ps1
        # Uses dynamic pattern — will not break on test count changes (v1.0.3 fix)
```

---

## 📐 MODULE 12 — DATABASE MIGRATION GUIDE

### New Schema Additions Required

All schema changes must follow this protocol:
1. Write migration in `backend/prisma/migrations/`
2. Test against staging DB first
3. Ensure rollback script exists
4. Never drop columns in production migrations — only ADD, RENAME (with deprecation), or soft-delete

```prisma
// New models to add to backend/prisma/schema.prisma

model AnomalyRecord {
  id                String         @id @default(cuid())
  userId            String
  user              User           @relation(fields: [userId], references: [id])
  signal            String         // AnomalySignal enum value
  severity          String         // AnomalySeverity enum value
  affectedRecordId  String
  affectedRecordType String
  explanationEn     String
  explanationPidgin String
  confidence        Float
  dismissed         Boolean        @default(false)
  dismissedAt       DateTime?
  metadata          Json           @default("{}")
  createdAt         DateTime       @default(now())
  
  @@index([userId, createdAt])    // For paginated user queries
  @@index([severity, dismissed])  // For admin dashboard queries
  @@map("anomaly_records")
}

model TaxHealthSnapshot {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id])
  score               Int      // 0-100
  grade               String
  filingTimeliness    Int
  dataCompleteness    Int
  complianceCalendar  Int
  nrsSubmissions      Int
  paymentHistory      Int
  trend               String   // 'improving' | 'stable' | 'declining'
  trendDelta          Int      // Score delta vs 30 days ago
  computedAt          DateTime @default(now())
  
  @@index([userId, computedAt])
  @@map("tax_health_snapshots")
}

model VendorRecord {
  id             String   @id @default(cuid())
  name           String
  aliases        String[] // PostgreSQL array type
  tin            String?
  vatRegistered  Boolean  @default(false)
  category       String
  city           String?
  state          String?
  verified       Boolean  @default(false)
  verifiedAt     DateTime?
  createdAt      DateTime @default(now())
  
  @@unique([tin])  // One record per TIN
  @@index([name])  // For fast vendor lookup
  @@map("vendor_records")
}
```

---

## 🔍 MODULE 13 — INTEGRATION TEST SCENARIOS

These are the critical E2E paths that MUST pass before any release:

```typescript
// backend/src/__tests__/e2e/full-journey.test.ts

describe('Nigerian SME Full Compliance Journey', () => {
  
  it('onboards, raises NRS-compliant invoice, receives payment, files VAT', async () => {
    // 1. Register business (TIN verification via Youverify mock)
    // 2. Create NRS invoice with line items (including 7.5% VAT)
    // 3. Submit to NRS → receive IRN stamp
    // 4. Process payment via Paystack
    // 5. Record as expense with OCR mock
    // 6. Generate VAT return for the month
    // 7. Verify: VAT output - VAT input = net VAT payable
    // 8. Verify: Tax Health Score updated
  });

  it('handles NRS submission failure with graceful retry and DLQ fallback', async () => {
    // 1. Mock DigiTax API to return 503 for 5 attempts
    // 2. Submit invoice → should enter queue
    // 3. Verify: 5 retry attempts with exponential backoff
    // 4. Verify: After 5 failures, job moves to DLQ
    // 5. Verify: DLQ alert triggered (mock Sentry)
    // 6. Verify: Invoice status = 'submission_failed' in DB
  });

  it('detects anomaly, notifies user, user dismisses as false positive', async () => {
    // 1. Create 5 identical expenses (₦50,000 fuel) in 24h
    // 2. Run anomaly scan → should detect duplicate_amount
    // 3. Verify: anomaly persisted to DB with correct severity
    // 4. GET /api/v1/insights/anomalies → verify in response
    // 5. POST /api/v1/insights/anomalies/:id/dismiss
    // 6. GET anomalies again → verify dismissed=true, not in active list
  });

  it('crypto CGT: import Quidax CSV, compute FIFO gains, generate NTA 2025 return', async () => {
    // 1. Upload sample Quidax CSV with 10 trades (mix of buys/sells)
    // 2. System uses CBN historical rates for NGN conversion
    // 3. Apply FIFO method → compute gains/losses per disposal
    // 4. Verify: total CGT = sum of gains * 10%
    // 5. Verify: DeFi staking rewards classified as PIT income, not CGT
    // 6. Generate CGT return document
  });

  it('payment circuit breaker: Paystack fails, auto-routes to Flutterwave', async () => {
    // 1. Mock Paystack to return 503 3 times in 60s window
    // 2. Circuit breaker should OPEN for Paystack
    // 3. Next payment attempt → auto-selects Flutterwave
    // 4. Verify: CircuitBreaker.getState() === 'OPEN' for paystack
    // 5. Wait 30s → circuit transitions to HALF_OPEN
    // 6. Mock Paystack to return 200 → transitions to CLOSED
  });
});
```

---

## 🎯 IMPLEMENTATION EXECUTION ORDER

This is the exact order to implement changes. Do not skip or reorder steps.

```
╔══════════════════════════════════════════════════════════════════╗
║  WEEK 1: FOUNDATION                                              ║
╠══════════════════════════════════════════════════════════════════╣
║  Day 1:  Phase 0 ground truth + Phase 1 stabilization            ║
║          → Run all tests, fix any failures, verify TypeScript    ║
║                                                                  ║
║  Day 2:  Module 4 (BullMQ queues) — backend foundation          ║
║          → All queues running, DLQ configured, metrics emitting  ║
║                                                                  ║
║  Day 3:  Module 7 (Payment circuit breaker)                      ║
║          → Tests passing, Paystack→Flutterwave→Remita chain safe ║
║                                                                  ║
║  Day 4:  Module 2 (Enhanced OCR — 13 categories + vendor DB)     ║
║          → Category classifier tested, vendor DB seeded          ║
║                                                                  ║
║  Day 5:  Module 1 (Anomaly detection — 9 signals)                ║
║          → All signals tested, API endpoints live                ║
╠══════════════════════════════════════════════════════════════════╣
║  WEEK 2: INTELLIGENCE                                            ║
╠══════════════════════════════════════════════════════════════════╣
║  Day 6:  Module 3 (Tax Health Score engine + API)                ║
║          → Score computation correct, caching working            ║
║                                                                  ║
║  Day 7:  Module 8 (Smart Compliance Calendar)                    ║
║          → Predictive reminders, adaptive cadence, push notifs   ║
║                                                                  ║
║  Day 8:  Module 5 (Mobile dark mode system)                      ║
║          → Tokens defined, Priority 1 screens migrated           ║
║                                                                  ║
║  Day 9:  Mobile: Tax Health Score widget + Dashboard upgrade      ║
║          → Animated ring, grade display, trend arrow             ║
║                                                                  ║
║  Day 10: Mobile: Smart camera receipt capture                     ║
║          → Edge detection overlay, auto-capture, haptics         ║
╠══════════════════════════════════════════════════════════════════╣
║  WEEK 3: ADMIN + COMPLIANCE                                      ║
╠══════════════════════════════════════════════════════════════════╣
║  Day 11: Module 6 (NRS Operations Center admin page)             ║
║          → Live feed, failed table, retry actions                ║
║                                                                  ║
║  Day 12: Admin: 8-panel analytics suite                          ║
║          → All Recharts panels with real data                    ║
║                                                                  ║
║  Day 13: Module 9 (Crypto CGT — NFT + DeFi + Quidax import)     ║
║          → Full NTA 2025 crypto compliance                       ║
║                                                                  ║
║  Day 14: Module 10 (i18n audit + new keys) + Module 12 (DB)     ║
║          → 1,200+ keys, new schema migrated                      ║
║                                                                  ║
║  Day 15: Module 13 (Integration tests) + Phase 3 security        ║
║          → All E2E journeys passing, biometric auth added        ║
╠══════════════════════════════════════════════════════════════════╣
║  WEEK 4: PRODUCTION HARDENING                                    ║
╠══════════════════════════════════════════════════════════════════╣
║  Day 16: Module 11 (CI/CD pipeline upgrade)                      ║
║          → Quality gates enforced on every PR                    ║
║                                                                  ║
║  Day 17: Phase 6 monitoring (Prometheus metrics + alerting)      ║
║          → All dashboards showing real data                      ║
║                                                                  ║
║  Day 18: Phase 7 documentation update                            ║
║          → CHANGELOG v3.0.0, all docs current                   ║
║                                                                  ║
║  Day 19: Full regression run + production validation             ║
║          → pwsh scripts/validate-production-readiness.ps1        ║
║          → All 460+ tests passing                                ║
║                                                                  ║
║  Day 20: Deploy + 24h monitoring watch                           ║
║          → git push origin master → verify all endpoints         ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 🚨 EMERGENCY PROTOCOLS

### If TypeScript compilation breaks during implementation:
```bash
# Identify the specific error
cd backend && npx tsc --noEmit 2>&1 | head -50

# Most likely cause: Prisma namespace type reintroduced
# Fix: Replace Prisma.XxxWhereInput with `any`
# Do NOT generate Prisma client locally — the stub issue recurs
# Reference: DEPLOYMENT_v1.0.3_COMPLETE.md, commit 218972e
```

### If EAS build fails:
```bash
# Step 1: Verify compileSdkVersion is 36 in app.json / build.gradle
# Step 2: Clear EAS cache
eas build --platform android --profile production --clear-cache

# Step 3: If still failing, bump cache key
# Edit mobile/eas.json: change "v7-*" to "v8-*"
# Reference: CHANGELOG v2.0.0 (compileSdkVersion fix)
```

### If NRS submissions are failing in production:
```bash
# Step 1: Check queue depth
curl https://taxbridge-api-ker8.onrender.com/health/queues

# Step 2: Check DigiTax API status
curl https://taxbridge-api-ker8.onrender.com/api/v1/nrs/health

# Step 3: If DigiTax is down, enable mock mode temporarily
# Set DIGITAX_MOCK_MODE=true in Render environment
# WARNING: This means IRNs are not real — only use as last resort

# Step 4: Drain DLQ manually
# Admin dashboard → NRS Operations Center → Failed → Retry All
```

### If admin dashboard shows cold-start errors:
```bash
# This is expected behavior on Render free tier (warm-up delay)
# The v2.0.0 graceful fallbacks handle this — do NOT remove them

# Verify the fallback is working:
curl https://taxbridge-api-ker8.onrender.com/api/admin/stats
# Should return 200 with fallback data, not 503
```

---

---

## 📱 PART III — SCREENSHOT-DRIVEN DEBUG & UI ENHANCEMENT REPORT

*This section was generated by direct visual analysis of three live production screenshots from TaxBridge v1.0.3 (February 20, 2026). Every bug and enhancement listed here is traceable to a specific UI element observed in the images. No speculation — only evidence.*

---

## 🔬 SCREENSHOT FORENSICS — WHAT THE IMAGES REVEAL

### Screenshot 1 — Welcome/Onboarding (v1.0.3, Device A — Online)
**Time:** 18:46 | **Battery:** 60% | **Status:** Sync Ready ✅

**Observed (working correctly):**
- TaxBridge logo renders cleanly
- "NDPC Compliant" + "NRS Ready" compliance badges visible
- Progress bar at 25% (1 of 4 steps)
- "Let's Start →" CTA button renders
- "Why complete onboarding?" blue panel with Compliance tips / WhatsApp support / SME insights chips
- Bottom bar shows `onboarding.trustLocalFirst` — partial i18n key exposure (minor)

**Bugs visible:**
- `onboarding.trustLocalFirst` is showing as a raw key in the bottom status bar, not translated text
- The bottom status bar reads literally `onboarding.trustLocalFirst • Works without internet` — the first segment is an untranslated i18n key leaking into the UI

---

### Screenshot 2 — Profile Setup Step (v1.0.3, Device B — OFFLINE)
**Time:** 06:49 | **Status:** No Connection ❌ | **Mode:** Offline Mode (amber pill)

**Observed (working correctly):**
- "30s AVG SETUP" badge renders
- English + Pidgin language chip visible
- Offline Sync chip visible
- NDPR Secure chip visible
- Progress bar at 25% (1 of 4)
- Annual income field shows ₦ prefix with placeholder `1,000,000`
- Annual turnover field shows ₦ prefix with placeholder `50,000,000`

**Bugs visible — CRITICAL:**
1. **`COMMON.OFFLINE` untranslated key** — The yellow pill in top-right reads `COMMON.OFFLINE` in ALL-CAPS, which is a raw i18n key being rendered verbatim. This is a production-visible bug.
2. **`onboarding.profile.annualTurnover` untranslated key** — The label above the turnover input renders the raw key string `onboarding.profile.annualTurnover` instead of human-readable text like "Annual Business Turnover"
3. **`onboarding.profile.soleProp` untranslated key** — The Business Status dropdown shows `onboarding.profile.soleProp` as the selected value label instead of "Sole Proprietor" or its Pidgin equivalent
4. **Red "No Connection" status bar** — The system status bar at top shows red "No Connection" text, but the app's own offline indicator (amber pill "Offline Mode") uses a different visual treatment — these two signals conflict and create UX confusion
5. **The `1 OF 4` label lacks Pidgin localization** — It renders in English even when Pidgin chip is shown as active

---

### Screenshot 3 — Settings Screen (v1.0.3, Device A — Online)
**Time:** 18:47 | **Battery:** 60% | **Version:** TaxBridge v1.0.3

**Observed (working correctly):**
- "Online & Syncing" with green dot renders correctly
- "Last sync: Never synced" is honest (not fabricated — this aligns with v1.0.2 fix)
- 0 Total / 0 Synced / 0 Pending stats are accurate for fresh install
- English 🇬🇧 / Pidgin 🇳🇬 toggle renders with flag emojis
- Menu items: Data & Storage, Network & Sync, Account & Sync, Community, Security & Compliance
- Version footer: "TaxBridge v1.0.3 | Simplify Your Taxes, Bridge Your Future | © 2026 TaxBridge. All rights reserved."

**Bugs visible:**
1. **`Data & Storage` has a blue arrow icon (►) but other menu items do not** — inconsistent chevron/arrow pattern; Security & Compliance also has ► but Network & Sync, Account & Sync, Community do not. This is a rendering inconsistency — either all rows should have chevrons or none should
2. **Settings gear icon is plain gray system icon** — inconsistent with the TaxBridge branded icon style seen on the welcome screen
3. **"Last sync: Never synced"** — While honest, this is a cold UX moment for a new user. The copy could be warmer: "Set up sync to get started" with a CTA link

---

## 🐛 BUG REGISTRY — PRIORITIZED FIX LIST

### P0 — Production-Breaking (Fix Before Next Release)

#### BUG-001: `COMMON.OFFLINE` i18n Key Leak
**File:** `mobile/src/i18n/en.json` + `mobile/src/i18n/pidgin.json`  
**Symptom:** Yellow offline pill renders raw key text `COMMON.OFFLINE`  
**Root Cause:** The key `common.offline` (case-sensitive lookup failure) or the key simply doesn't exist in the JSON files, causing i18next to fall back to the key name itself  
**Reproduction:** Put device in airplane mode → navigate to onboarding → observe yellow pill  

```bash
# Verify the key exists:
grep -n "offline" mobile/src/i18n/en.json
# If missing, add it. If present, check capitalization.
# i18next is case-sensitive: 'common.offline' ≠ 'COMMON.OFFLINE'
```

**Fix:**
```jsonc
// mobile/src/i18n/en.json — ensure this exact key path exists:
{
  "common": {
    "offline": "Offline Mode",
    "online": "Online",
    "syncing": "Syncing...",
    "syncReady": "Sync Ready",
    "noConnection": "No Connection",
    "offlineMode": "Offline Mode",
    "trustLocalFirst": "Works offline · syncs when online"
  }
}

// mobile/src/i18n/pidgin.json — matching Pidgin keys:
{
  "common": {
    "offline": "Offline Mode",
    "online": "You don connect",
    "syncing": "E dey sync...",
    "syncReady": "Ready to sync",
    "noConnection": "Network no dey",
    "offlineMode": "No network mode",
    "trustLocalFirst": "E work offline · go sync when network come"
  }
}
```

**Component fix** — find the offline pill component and ensure it uses the correct key path:
```typescript
// WRONG (causes BUG-001):
const label = t('COMMON.OFFLINE');  // uppercase key — won't match
const label = t('common_offline');  // underscore — won't match

// CORRECT:
const label = t('common.offline');  // dot-notation, lowercase
```

---

#### BUG-002: `onboarding.profile.annualTurnover` Key Leak
**File:** `mobile/src/i18n/en.json` + the profile step component  
**Symptom:** Label above turnover input shows raw key instead of "Annual Business Turnover"  
**Root Cause:** Key exists in component call but is missing from the JSON translation file  

```bash
# Audit all onboarding.profile.* keys:
grep -n "onboarding.profile" mobile/src/i18n/en.json
# Every key used in components must exist here
```

**Fix — add these keys if missing:**
```jsonc
// mobile/src/i18n/en.json
{
  "onboarding": {
    "profile": {
      "title": "Your Business Profile",
      "subtitle": "Help us personalize your tax experience",
      "annualIncome": "Annual Personal Income",
      "annualIncomePlaceholder": "e.g. 1,000,000",
      "annualIncomeHelper": "Enter your estimated annual income in Naira",
      "annualTurnover": "Annual Business Turnover",
      "annualTurnoverPlaceholder": "e.g. 50,000,000",
      "annualTurnoverHelper": "Enter your estimated annual business turnover",
      "businessStatus": "Business Status",
      "businessStatusHelper": "Select your business registration type",
      "soleProp": "Sole Proprietor",
      "partnership": "Partnership",
      "limitedCompany": "Limited Liability Company",
      "ngo": "NGO / Non-Profit",
      "trustLocalFirst": "Works offline · syncs when online",
      "stepOf": "{{current}} of {{total}}"
    }
  }
}

// mobile/src/i18n/pidgin.json
{
  "onboarding": {
    "profile": {
      "title": "Your Business Profile",
      "subtitle": "Help us know your tax situation",
      "annualIncome": "Your Yearly Income",
      "annualIncomePlaceholder": "e.g. 1,000,000",
      "annualIncomeHelper": "Enter how much you earn per year for Naira",
      "annualTurnover": "Your Business Turnover Per Year",
      "annualTurnoverPlaceholder": "e.g. 50,000,000",
      "annualTurnoverHelper": "Enter your business money wey come in per year",
      "businessStatus": "Your Business Type",
      "businessStatusHelper": "Choose how you register your business",
      "soleProp": "Sole Proprietor (One-man business)",
      "partnership": "Partnership",
      "limitedCompany": "Limited Company (LLC)",
      "ngo": "NGO / Non-Profit",
      "trustLocalFirst": "E work offline · go sync when network come",
      "stepOf": "{{current}} of {{total}}"
    }
  }
}
```

---

#### BUG-003: `onboarding.profile.soleProp` Key Leak in Business Status Dropdown
**File:** Business status selector component  
**Symptom:** Dropdown selected value shows raw key `onboarding.profile.soleProp`  
**Root Cause:** Same as BUG-002 — key missing from JSON, OR the component is passing the key as the display value instead of calling `t(key)`  

**Component audit — find this pattern:**
```typescript
// WRONG — renders raw key as display text:
<Text>{businessTypeKey}</Text>
// where businessTypeKey = 'onboarding.profile.soleProp'

// CORRECT — translate before rendering:
<Text>{t(businessTypeKey)}</Text>
// OR if the options array holds translation keys:
const options = [
  { value: 'sole_prop', labelKey: 'onboarding.profile.soleProp' },
  { value: 'partnership', labelKey: 'onboarding.profile.partnership' },
  ...
];
// Render: <Text>{t(option.labelKey)}</Text>
```

**Search command to find the bug location:**
```bash
grep -rn "soleProp\|annualTurnover\|annualIncome" mobile/src/components/ mobile/src/screens/ --include="*.tsx" --include="*.ts"
# Find every place these keys are used and verify t() wraps them
```

---

#### BUG-004: `onboarding.trustLocalFirst` Raw Key in Bottom Status Bar
**File:** Onboarding layout or navigator component  
**Symptom:** Bottom status bar shows `onboarding.trustLocalFirst • Works without internet` — first token is raw key  
**Root Cause:** The bottom bar constructs its text by concatenating `t('onboarding.trustLocalFirst')` with a hardcoded string `" • Works without internet"` — but the first call returns the raw key, suggesting the key is missing OR the wrong namespace is being accessed  

**Fix:** Unify into one i18n key:
```typescript
// WRONG:
<Text>{t('onboarding.trustLocalFirst')} • Works without internet</Text>

// CORRECT:
<Text>{t('common.trustLocalFirst')}</Text>
// where common.trustLocalFirst = "Local-first · syncs when online • Works without internet"

// OR if you want the dot separator:
<Text>{t('common.localFirst')} • {t('common.worksOffline')}</Text>
```

---

### P1 — High Priority UX Regressions (Fix in Next Sprint)

#### BUG-005: Inconsistent Chevron Icons in Settings Menu
**File:** `mobile/src/screens/SettingsScreen.tsx`  
**Symptom:** `Data & Storage` and `Security & Compliance` have `►` icons; `Network & Sync`, `Account & Sync`, `Community` do not  
**Root Cause:** Some menu items were rendered with a `ListItem` component that auto-appends chevron, others use a raw `TouchableOpacity` without one  

**Fix — standardize all settings rows:**
```typescript
// Create a reusable SettingsRow component if not already existing:
interface SettingsRowProps {
  icon: string;          // emoji or icon component
  label: string;         // i18n key
  onPress: () => void;
  hasChevron?: boolean;  // default: true
  rightElement?: React.ReactNode; // for toggle switches, badges etc.
}

// ALL rows in SettingsScreen must use this component
// ALL rows get a chevron unless rightElement is provided (e.g., toggle)
// This eliminates the inconsistency entirely
```

---

#### BUG-006: "Let's Start" Crash on Offline Devices (Commit e013f6b referenced)
**Context:** Documented in task brief — clicking "Let's Start" on offline devices causes crash  
**Root Cause Analysis from screenshots:** Image 2 shows the app successfully reaches step 1 of 4 in offline mode, suggesting the crash was partially fixed in e013f6b. However the `COMMON.OFFLINE` key leak and missing profile keys suggest the fix was incomplete — the navigation succeeds but the profile step renders broken keys which may cause rendering failures in strict mode  

**Verification steps:**
```bash
# 1. Reproduce: put device offline, tap "Let's Start"
# 2. Check Sentry for crash events with stack trace pointing to:
#    - ProfileAssessmentStep.tsx (missing translation causing null render)
#    - OnboardingContext.tsx (state initialization in offline mode)
#    - navigation stack transition

# 3. Check if the crash is a silent JS exception swallowed by ErrorBoundary:
grep -n "ErrorBoundary\|try.*catch\|Sentry.captureException" mobile/src/components/onboarding/ -r
```

**Preventive fix — add explicit null guards in ProfileAssessmentStep:**
```typescript
// Every t() call that could return undefined must have a fallback:
const label = t('onboarding.profile.annualTurnover', { defaultValue: 'Annual Business Turnover' });

// Better: use i18next's built-in fallback:
// In i18n initialization, set:
i18n.init({
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: { en: { translation: enJSON }, pidgin: { translation: pidginJSON } },
  // CRITICAL: This prevents raw key display:
  saveMissing: true,
  missingKeyHandler: (lngs, ns, key) => {
    if (__DEV__) console.warn(`Missing i18n key: ${key}`);
    Sentry.addBreadcrumb({ message: `Missing i18n key: ${key}`, level: 'warning' });
  }
});
```

---

#### BUG-007: Double Splash Screen (Commits e24bfa7 and e013f6b referenced)
**Root Cause:** Expo's native splash screen + React Native's in-app branded splash rendered simultaneously or in rapid sequence  
**Verification — check if still occurring:**
```typescript
// mobile/app/_layout.tsx or mobile/App.tsx — look for:
SplashScreen.preventAutoHideAsync();
// This must be called ONCE, at the very top, before any async operations

// Then hidden ONCE after fonts/assets are loaded:
await Font.loadAsync({...});
await Asset.loadAsync([...]);
SplashScreen.hideAsync(); // Called exactly once

// WRONG — causes double flash:
// Calling hideAsync() twice, or calling it before hideAsync() in a child component
// Check: is BrandedHero or LivingBridgeHeader calling any splash-related code?
grep -rn "SplashScreen\|hideAsync\|preventAutoHideAsync" mobile/src/ mobile/app/ --include="*.tsx" --include="*.ts"
// Must find exactly 1 preventAutoHideAsync call and 1 hideAsync call
```

---

### P2 — Polish & Enhancement (Current Sprint Opportunities)

#### ENHANCEMENT-001: Offline Status Visual Unification
**Observation:** Image 2 shows two competing offline signals: the Android system bar ("No Connection" in red) and the app's own amber "Offline Mode" pill. These are visually inconsistent.

**Improvement:** The app cannot control the system bar, but it CAN make its own offline indicator more prominent and informative to reduce cognitive load:

```typescript
// mobile/src/components/OfflineStatusBanner.tsx (enhance existing or create)

// Design spec from screenshots analysis:
// Current: Small amber pill "○ Offline Mode" — easy to miss
// Target: Full-width soft banner when offline with sync status

const OfflineStatusBanner = () => {
  const { isOnline, pendingSync } = useNetworkStatus();
  const { t } = useTranslation();
  
  if (isOnline) return null; // Don't show when online
  
  return (
    <Animated.View 
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={styles.banner}
    >
      {/* Left: offline icon + text */}
      <View style={styles.left}>
        <View style={styles.dot} /> {/* Amber pulsing dot */}
        <Text style={styles.text}>{t('common.offlineMode')}</Text>
      </View>
      
      {/* Right: pending count if any */}
      {pendingSync > 0 && (
        <Text style={styles.pending}>
          {t('common.pendingSync', { count: pendingSync })}
        </Text>
      )}
    </Animated.View>
  );
};

// Color: background #FFF3CD (warm amber), text #856404, dot #F39C12 pulsing
// This matches Nigerian fintech conventions (not alarming red — amber is "aware but calm")
```

---

#### ENHANCEMENT-002: Onboarding Progress Bar Polish
**Observation:** Both Images 1 and 2 show the green progress bar at exactly 25% (1 of 4). The bar itself is clean but lacks a completion label that's culturally warm.

```typescript
// Current: "25% complete" (Image 1) / "25% complete" (Image 2)
// Enhancement: Add step label alongside percentage

// Before:
<Text>25% complete</Text>

// After (with i18n + animated counter):
<View style={styles.progressRow}>
  <Text style={styles.stepLabel}>
    {t('onboarding.profile.stepOf', { current: currentStep, total: totalSteps })}
  </Text>
  <AnimatedText style={styles.percentLabel}>
    {Math.round(progress * 100)}%
  </AnimatedText>
</View>

// Pidgin: "Step 1 of 4" → "Step 1 of 4 — e dey go!"
// Add a subtle confetti burst at 100% completion (Expo Haptics medium impact)
```

---

#### ENHANCEMENT-003: Settings "Never Synced" Cold UX Fix
**Observation:** Image 3 shows "Last sync: Never synced" with 0/0/0 stats — functionally correct but emotionally cold for a new user who just installed the app.

```typescript
// mobile/src/screens/SettingsScreen.tsx

// Current render:
<Text>Last sync: Never synced</Text>

// Enhanced render — context-aware copy:
const getSyncStatusCopy = (lastSync: Date | null, pendingCount: number) => {
  if (lastSync === null && pendingCount === 0) {
    return {
      primary: t('settings.sync.neverSynced'),    // "Not synced yet"
      secondary: t('settings.sync.neverSyncedHint'), // "Create your first invoice to get started"
      cta: t('settings.sync.setupSyncCTA'),         // "Set up sync →"
    };
  }
  if (lastSync === null && pendingCount > 0) {
    return {
      primary: t('settings.sync.pendingFirstSync'),
      secondary: t('settings.sync.pendingFirstSyncHint', { count: pendingCount }),
      cta: null
    };
  }
  return {
    primary: t('settings.sync.lastSync', { time: formatRelativeTime(lastSync) }),
    secondary: null,
    cta: null
  };
};
```

---

#### ENHANCEMENT-004: Language Selector Accessibility
**Observation:** Image 3 shows the English/Pidgin toggle with flag emojis (🇬🇧/🇳🇬). The selected state (English has blue border/background) is visually clear, but there's no `accessibilityLabel`.

```typescript
// Add accessibility to language toggle:
<TouchableOpacity
  style={[styles.langButton, isSelected && styles.langButtonSelected]}
  onPress={() => changeLanguage('en')}
  accessibilityRole="radio"
  accessibilityState={{ selected: isSelected }}
  accessibilityLabel={t('settings.language.englishLabel')} // "English language option"
  accessibilityHint={t('settings.language.englishHint')}   // "Tap to switch app to English"
>
  <Text>🇬🇧 English</Text>
</TouchableOpacity>

// Add these i18n keys:
// settings.language.englishLabel: "English"
// settings.language.englishHint: "Switch app to English"
// settings.language.pidginLabel: "Nigerian Pidgin"
// settings.language.pidginHint: "Switch app to Nigerian Pidgin"
```

---

#### ENHANCEMENT-005: "Let's Start" Button Micro-interaction
**Observation:** Image 1 shows a solid blue CTA button. It's functional but static. The Reanimated 2 library is available — use it.

```typescript
// mobile/src/components/onboarding/WelcomeScreen.tsx

const StartButton = ({ onPress }: { onPress: () => void }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  
  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15 });
    opacity.value = withTiming(0.9, { duration: 80 });
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12 });
    opacity.value = withTiming(1, { duration: 100 });
  };
  
  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.ctaButton}
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.welcome.letsStart')}
      >
        <Text style={styles.ctaText}>{t('onboarding.welcome.letsStart')} →</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Also add: Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) on press
```

---

#### ENHANCEMENT-006: Naira Input Field UX
**Observation:** Images 1 and 2 show ₦-prefixed input fields. The `₦` prefix is visible but the input formatting behavior isn't observable from screenshots. Based on CHANGELOG v5.0.0 mention of "number formatting with auto-formatting and comma separator support" — verify this is working on the profile screen specifically.

```typescript
// mobile/src/components/NairaInput.tsx (verify or create)

// Required behavior:
// 1. User types: 1000000
// 2. Display shows: ₦ 1,000,000 (comma-formatted in real time)
// 3. Value stored: 1000000 (raw number, no commas)
// 4. On paste: strip non-numeric chars, reformat

const NairaInput = ({ value, onChange, placeholder, ...props }) => {
  const formatForDisplay = (raw: string) => {
    const numeric = raw.replace(/[^0-9]/g, '');
    return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  
  const [displayValue, setDisplayValue] = useState(
    value ? formatForDisplay(String(value)) : ''
  );
  
  const handleChange = (text: string) => {
    const formatted = formatForDisplay(text);
    setDisplayValue(formatted);
    const raw = parseInt(text.replace(/[^0-9]/g, '') || '0', 10);
    onChange(raw);
  };
  
  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.currencyPrefix}>₦</Text>
      <TextInput
        value={displayValue}
        onChangeText={handleChange}
        placeholder={placeholder || '0'}
        keyboardType="numeric"
        style={styles.input}
        accessibilityLabel={props.accessibilityLabel}
        // IMPORTANT: Nigerian keyboards sometimes default to non-numeric
        // Add explicit numeric keyboard for all ₦ inputs
      />
    </View>
  );
};
```

---

## 🎨 COMPREHENSIVE UI COLOR AUDIT

Based on screenshot analysis, here is the current color usage vs. recommended tokens:

| Element | Screenshot Color | Token Name | Hex | Issue |
|---------|-----------------|-----------|-----|-------|
| "Let's Start" button | Solid blue | `brandPrimary` | `#1B4F72` | ✅ Consistent |
| Progress bar fill | Green | `brandSuccess` | `#27AE60` | ✅ Consistent |
| "Offline Mode" pill | Amber/yellow | `brandWarning` | `#F39C12` | ⚠️ Slightly dark on pill |
| `COMMON.OFFLINE` pill bg | Yellow/amber | — | — | 🔴 BUG (raw key) |
| "NDPC Compliant" badge | Green outline | `brandSuccess` | `#27AE60` | ✅ Consistent |
| "NRS Ready" badge | Green outline | `brandSuccess` | `#27AE60` | ✅ Consistent |
| Settings "Online" dot | Green | `brandSuccess` | `#27AE60` | ✅ Consistent |
| Settings "Data & Storage" ► | Blue `#2980B9` | `brandInfo` | `#2980B9` | ⚠️ Inconsistent with other rows |
| Language toggle selected | Blue bg | `brandPrimary` | `#1B4F72` | ✅ Consistent |
| Language toggle unselected | White | `surface` | `#FFFFFF` | ✅ Consistent |
| Bottom nav active | Blue | `brandPrimary` | `#1B4F72` | ✅ Consistent |
| Bottom nav inactive | Gray | `textTertiary` | `#ABB2B9` | ✅ Consistent |

**Action required:** The only color inconsistency is the `►` arrow icon on some (not all) Settings rows using `brandInfo` blue. Standardize to `textTertiary` gray (chevrons should be subdued, not actionable-blue).

---

## ✅ I18N COMPLETENESS AUDIT — MISSING KEYS TRACKER

Based on screenshot evidence, these keys are confirmed missing or broken:

```bash
# Run this audit script after applying fixes:
node -e "
const en = require('./mobile/src/i18n/en.json');
const pidgin = require('./mobile/src/i18n/pidgin.json');

const requiredKeys = [
  'common.offline',
  'common.online', 
  'common.syncing',
  'common.syncReady',
  'common.noConnection',
  'common.offlineMode',
  'common.trustLocalFirst',
  'common.pendingSync',
  'onboarding.profile.annualTurnover',
  'onboarding.profile.annualTurnoverPlaceholder',
  'onboarding.profile.annualTurnoverHelper',
  'onboarding.profile.soleProp',
  'onboarding.profile.partnership',
  'onboarding.profile.limitedCompany',
  'onboarding.profile.stepOf',
  'onboarding.trustLocalFirst',
  'settings.sync.neverSynced',
  'settings.sync.neverSyncedHint',
  'settings.sync.setupSyncCTA',
  'settings.language.englishLabel',
  'settings.language.pidginLabel',
];

const getNestedValue = (obj, path) => 
  path.split('.').reduce((acc, key) => acc?.[key], obj);

requiredKeys.forEach(key => {
  const enVal = getNestedValue(en, key);
  const pidginVal = getNestedValue(pidgin, key);
  if (!enVal) console.log('MISSING EN:', key);
  if (!pidginVal) console.log('MISSING PIDGIN:', key);
});
console.log('Audit complete.');
"
```

**Expected output after fixes:** `Audit complete.` with zero MISSING lines.

---

## 📋 BUG FIX VERIFICATION CHECKLIST

After implementing all fixes, run this manual QA sequence on a real device:

```
OFFLINE MODE TEST (airplane mode ON):
  [ ] Tap "Let's Start" → should navigate to step 2 without crash
  [ ] "Offline Mode" pill shows translated text (NOT "COMMON.OFFLINE")
  [ ] All profile field labels render in English (or Pidgin if Pidgin selected)
  [ ] "Annual Business Turnover" label shows correctly (NOT raw key)
  [ ] Business Status dropdown shows "Sole Proprietor" (NOT raw key)
  [ ] Bottom status bar shows human-readable offline message
  [ ] ₦ inputs accept numbers with comma formatting in real time

ONLINE MODE TEST:
  [ ] "Sync Ready" pill shows correctly
  [ ] Settings shows "Online & Syncing" with green dot
  [ ] All settings rows have consistent chevron icons
  [ ] Language toggle switches from English to Pidgin cleanly
  [ ] After switching to Pidgin: all visible text updates (no raw keys visible)

ANIMATION TEST:
  [ ] "Let's Start" button has subtle press animation (scale down on tap)
  [ ] Progress bar animates smoothly between steps
  [ ] No double splash screen on cold launch
  [ ] Offline banner fades in/out smoothly when toggling airplane mode

ACCESSIBILITY TEST:
  [ ] VoiceOver/TalkBack reads "Let's Start" button correctly
  [ ] Language toggle buttons announce selection state
  [ ] ₦ input fields announce currency prefix to screen readers
```

---

## 🔧 COMMIT SEQUENCE FOR BUG FIXES

Execute in this exact order to minimize regression risk:

```bash
# Fix 1: i18n missing keys (safest change — no logic, data only)
git add mobile/src/i18n/en.json mobile/src/i18n/pidgin.json
git commit -m "fix(i18n): add 22 missing keys — COMMON.OFFLINE, profile labels, settings copy"

# Fix 2: i18n initialization — add missing key handler + fallback
git add mobile/src/i18n/index.ts
git commit -m "fix(i18n): add missingKeyHandler with Sentry breadcrumb to prevent raw key display"

# Fix 3: ProfileAssessmentStep — wrap all label renders in t()
git add mobile/src/components/onboarding/ProfileAssessmentStep.tsx
git commit -m "fix(onboarding): wrap business status labels in t() — resolves raw key display"

# Fix 4: Settings chevron consistency
git add mobile/src/screens/SettingsScreen.tsx
git commit -m "fix(settings): standardize chevron icons across all menu rows"

# Fix 5: Offline banner enhancement
git add mobile/src/components/OfflineStatusBanner.tsx
git commit -m "feat(offline): redesign offline banner with full-width layout and pending count"

# Fix 6: Naira input formatter verification/fix
git add mobile/src/components/NairaInput.tsx
git commit -m "fix(input): ensure real-time comma formatting on all ₦ input fields"

# Fix 7: Button micro-interactions
git add mobile/src/components/onboarding/WelcomeScreen.tsx
git commit -m "feat(ux): add Reanimated spring press animation to Let's Start CTA"

# Fix 8: Settings cold UX copy
git add mobile/src/screens/SettingsScreen.tsx mobile/src/i18n/en.json mobile/src/i18n/pidgin.json
git commit -m "feat(settings): improve never-synced empty state with contextual CTA"

# Push all fixes
git push origin master
```

---

## 📈 BEFORE/AFTER IMPACT SUMMARY

| Screen | Before | After |
|--------|--------|-------|
| Onboarding offline pill | `COMMON.OFFLINE` (raw key) | "Offline Mode" (translated) |
| Profile turnover label | `onboarding.profile.annualTurnover` | "Annual Business Turnover" |
| Profile business status | `onboarding.profile.soleProp` | "Sole Proprietor" |
| Bottom status bar | `onboarding.trustLocalFirst • Works without internet` | "Works offline · syncs when online" |
| Settings chevrons | Inconsistent (2 of 5 rows) | Consistent (all 5 rows) |
| Settings empty sync | "Last sync: Never synced" (cold) | "Not synced yet — create your first invoice to start" + CTA |
| Let's Start button | Static | Spring press + haptic feedback |
| Offline banner | Small amber pill, easy to miss | Full-width contextual banner |

---

## 🔮 FURTHER RECOMMENDATIONS (POST-FIX)

### Performance
- **Metro bundler cache**: Run `npx expo start --clear` after i18n JSON changes — Metro may cache old JSON
- **SQLite query optimization**: Add indexes on `invoices(userId, createdAt)` for faster offline list renders
- **Image assets**: Compress the TaxBridge logo asset — it loads on every onboarding screen

### Features  
- **Biometric unlock**: Add `expo-local-authentication` — when user returns to offline app, require Face/Fingerprint instead of full PIN
- **Offline receipt queue**: Let users photograph receipts offline → queue for OCR processing when back online → display "3 receipts pending OCR" indicator in dashboard
- **Pidgin AI insights**: When anomaly detection surface messages, deliver them in Pidgin if language is set to Pidgin — the Pidgin explanations in Module 1 already support this

### Infrastructure
- **Docker Compose for local dev**: Add `infra/docker-compose.yml` with Postgres + Redis containers so developers can run the full stack locally without Render/Vercel accounts
- **EAS Update OTA**: Configure `eas update` for the i18n JSON files specifically — these are pure JS changes that don't require a full store build, meaning BUG-001 through BUG-004 could be hot-patched to production in minutes

---

---

## 📱 PART IV — LIVE APP AUDIT: 5-SCREENSHOT FORENSIC ANALYSIS
### *Visual Evidence Captured February 20, 2026 — Device: Android (Samsung), v1.0.3*

> This section supersedes any speculative UI guidance from Parts I–III. These are confirmed bugs visible in production screenshots. Fix these **before** implementing any new features. Evidence is king.

---

### 🔬 SCREENSHOT INVENTORY & EVIDENCE LOG

| # | File | Screen | Device State | Time | Critical Findings |
|---|------|--------|-------------|------|------------------|
| S1 | IMG_1068.jpeg | Welcome / Onboarding Step 1 | Online, 60% battery | 18:46 | Clean onboarding card — good baseline |
| S2 | IMG_1076.jpeg | Onboarding Step 1 (Profile) | **OFFLINE**, No Connection | 06:49 | **3 raw i18n keys exposed**, `COMMON.OFFLINE` badge |
| S3 | IMG_1067.jpeg | Settings | Online, 60% battery | 18:47 | Version shows `v1.0.3`, sync never run — clean state |
| S4 | IMG_1072.jpeg | Create Invoice (Step 1) | Online, 60% battery | 18:45 | **"NRSt Invoice" typo in modal title** |
| S5 | IMG_1071.jpeg | Home / Dashboard | **OFFLINE**, No Connection | 06:50 | **Bottom nav icons completely broken (□ squares)** |

---

### 🐛 CONFIRMED BUG REGISTER — FROM LIVE SCREENSHOTS

---

#### BUG-S01 🔴 CRITICAL — Bottom Navigation Icons Rendering as Empty Squares
**Evidence:** IMG_1071.jpeg — Home screen offline, all 4 bottom tab icons show as `□ □ □ □` placeholder squares  
**Affected screen:** `HomeScreen.tsx` (and all screens sharing the tab navigator)  
**Affected build:** v1.0.3, Android (Samsung device, MIUI-adjacent ROM or Android 13+)  
**Not visible in:** IMG_1067 (Settings) where icons render correctly at 18:47 — suggesting this is **state-dependent or device-specific**

**Root cause analysis:**
The discrepancy between S3 (icons working at 18:47, online) and S5 (icons broken at 06:50, offline) points to one of three causes:

```
Hypothesis A: Icon font not loaded when offline
  → @expo/vector-icons uses CDN for font files in some configurations
  → If font hasn't cached locally, offline mode = no glyphs = □

Hypothesis B: Reanimated v4 / New Architecture conflict
  → CHANGELOG v2.0.0 mentions Reanimated v4 with worklets
  → New Architecture (Fabric) can cause icon rendering issues on older Samsung devices

Hypothesis C: Tab navigator re-mount race condition
  → Offline mode triggers re-render of navigation state
  → Icon components unmount/remount mid-render, failing to resolve asset
```

**Fix — address all three hypotheses:**

```typescript
// mobile/src/navigation/TabNavigator.tsx (or equivalent)

// FIX A: Pre-load icon fonts before navigator renders
import * as Font from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// In app/_layout.tsx or App.tsx — add font preloading to SplashScreen hold
const [fontsLoaded] = useFonts({
  ...Ionicons.font,
  ...MaterialIcons.font,
  // Add every icon font family used across the app
});

// DO NOT release splash screen until fonts are loaded
useEffect(() => {
  if (fontsLoaded) {
    SplashScreen.hideAsync();
  }
}, [fontsLoaded]);

// FIX B: Bundle icon fonts as local assets (eliminates CDN dependency entirely)
// In metro.config.js — ensure font files are in assetExts
// In app.json — add to expo.assetBundlePatterns:
// "assetBundlePatterns": ["assets/**/*", "node_modules/@expo/vector-icons/build/vendor/**"]

// FIX C: Add fallback text icons for the offline broken-icon case
// In TabNavigator, wrap each icon with error boundary:

function TabIcon({ 
  name, 
  focused, 
  color, 
  size 
}: { name: string; focused: boolean; color: string; size: number }) {
  const [iconError, setIconError] = React.useState(false);
  
  if (iconError) {
    // Fallback: use Unicode symbols that don't require font loading
    const fallbacks: Record<string, string> = {
      'home':     '⌂',
      'create':   '+',
      'invoices': '≡',
      'settings': '⚙',
    };
    return <Text style={{ color, fontSize: size - 4 }}>{fallbacks[name] ?? '●'}</Text>;
  }
  
  return (
    <Ionicons
      name={name as any}
      size={size}
      color={color}
      onError={() => setIconError(true)}
    />
  );
}
```

**Verification:**
```bash
# Test specifically with network disabled before app launch
# 1. Enable airplane mode
# 2. Force-close app
# 3. Reopen — icons must render from cached fonts
# 4. Navigate between all 4 tabs — all must show icons, not squares
```

---

#### BUG-S02 🔴 CRITICAL — "NRSt Invoice" String Concatenation Typo
**Evidence:** IMG_1072.jpeg — Invoice creation modal shows title "Create Your **NRSt** Invoice"  
**Affected component:** Modal in `InvoiceScreen.tsx` or `CreateInvoiceModal.tsx`  
**Impact:** Displayed to every user creating an invoice — the core revenue-generating action

**Root cause:**
```typescript
// WHAT IS HAPPENING IN CODE (reconstructed from the screenshot):
// Likely a string interpolation where 't' from a variable bled into the literal:

// BAD — this produces "NRSt Invoice":
const title = `Create Your NRS${t('invoice.modal.title')}`;
// If t('invoice.modal.title') returns 't Invoice', you get 'NRSt Invoice'

// OR: i18n key value has a lowercase 't' prefix accidentally
// en.json: "invoice.createNRS": "t Invoice"  ← the 't' is an artifact
// Used as: `Create Your NRS${t('invoice.createNRS')}`

// OR: Direct string with typo in i18n value:
// en.json: "invoice.createTitle": "Create Your NRSt Invoice"  ← raw typo
```

**Fix:**

```typescript
// Step 1: Find the exact key
grep -rn "NRS" mobile/src/i18n/en.json
grep -rn "NRSt" mobile/src --include="*.tsx" --include="*.ts"

// Step 2: Fix in en.json
// BEFORE (broken):
"invoice": {
  "createNRSTitle": "Create Your NRSt Invoice"   // ← typo
}

// AFTER (correct):
"invoice": {
  "createNRSTitle": "Create Your NRS Invoice"    // ← fixed
}

// ALSO fix in pidgin.json:
// BEFORE: "Create Your NRSt Invoice"  
// AFTER:  "Create Your NRS Invoice"   (same fix — Pidgin version)

// Step 3: If it's concatenation, fix the component:
// BEFORE:
<Text>{`Create Your NRS${t('invoice.suffix')}`}</Text>

// AFTER:
<Text>{t('invoice.createNRSTitle')}</Text>
// Move entire string into i18n, don't concatenate around translated fragments
```

**Rule to add to CI (prevent recurrence):**
```bash
# .github/workflows/ci.yml — add to i18n audit step
NRST_COUNT=$(grep -rn "NRSt" mobile/src --include="*.json" --include="*.tsx" | wc -l)
if [ "$NRST_COUNT" -gt "0" ]; then
  echo "ERROR: 'NRSt' typo found — check invoice i18n strings"
  exit 1
fi
```

---

#### BUG-S03 🔴 CRITICAL — Raw i18n Keys Displayed on Offline Onboarding Screen
**Evidence:** IMG_1076.jpeg — Three raw untranslated keys visible simultaneously:
1. **`COMMON.OFFLINE`** — shown as a yellow badge top-right (should be "Offline Mode")
2. **`onboarding.profile.annualTurnover`** — shown as field label (should be "Annual Turnover")
3. **`onboarding.profile.soleProp`** — shown in the Business Status picker (should be "Sole Proprietor")

**Context:** This device is offline (status bar shows "No Connection"). The ONLINE device (S1/S3/S4 at 18:45–18:47) shows correct translations. This confirms the bug is **triggered specifically by offline mode**, not a general missing translation.

**Root cause analysis:**
```
Scenario A (most likely): i18next lazy-loads translation files from the backend
  → When offline, the fetch fails silently
  → i18next falls back to showing raw keys instead of loaded local translations
  → Fix: Bundle translations as static assets (not fetched from API)

Scenario B: i18next is initialized AFTER the offline state is set
  → Component renders before i18next is ready
  → Translation function t() returns the key itself (i18next default behavior)
  → Fix: Gate component render until i18next.isInitialized === true

Scenario C: Offline mode triggers a React state update that causes re-mount
  → Re-mounted components re-read translations before i18next re-initializes
  → Fix: Memoize translation namespace loading
```

**Fix:**

```typescript
// mobile/src/i18n/index.ts — CRITICAL: translations must be bundled locally

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

// ✅ CORRECT: Import JSON directly — no network fetch, works 100% offline
import enTranslations from './en.json';
import pidginTranslations from './pidgin.json';

// ❌ WRONG (what might be happening):
// const response = await fetch(`${API_URL}/i18n/${language}.json`);

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en:     { translation: enTranslations },
      pidgin: { translation: pidginTranslations },
    },
    lng: await getStoredLanguage() ?? Localization.locale,
    fallbackLng: 'en',
    
    // CRITICAL: These prevent raw keys from showing during init
    returnNull: false,
    returnEmptyString: false,
    returnedValue: undefined,   // Show key if missing (i18next default) — acceptable
    
    interpolation: { escapeValue: false },
    
    // CRITICAL: i18next must be synchronously initialized before any component renders
    initImmediate: false,  // ← synchronous init — prevents the timing race
  });

export default i18n;
```

```typescript
// mobile/src/app/_layout.tsx or App.tsx
// Gate ALL rendering until i18next is ready

import './i18n'; // import side-effect runs init synchronously

export default function RootLayout() {
  // i18n is now sync-initialized before first render
  // No need for isReady guard if initImmediate: false
  return <NavigationContainer>...</NavigationContainer>;
}
```

```json
// Fix missing keys in mobile/src/i18n/en.json
// Audit for ALL keys that appear raw in IMG_1076:
{
  "common": {
    "offline": "Offline Mode",
    "offlineBadge": "● Offline Mode",
    "OFFLINE": "Offline Mode"       // ← add uppercase variant used as badge
  },
  "onboarding": {
    "profile": {
      "annualTurnover": "Annual Business Turnover",
      "annualTurnoverHelper": "Enter your estimated annual business turnover",
      "soleProp": "Sole Proprietor",
      "solePropDesc": "Individual business owner",
      "partnership": "Partnership",
      "limitedCompany": "Limited Company",
      "ngo": "NGO / Non-Profit"
    }
  }
}
```

```json
// pidgin.json equivalents:
{
  "common": {
    "offline": "Offline Mode",
    "OFFLINE": "No Network"
  },
  "onboarding": {
    "profile": {
      "annualTurnover": "How Much Your Business Make Per Year",
      "soleProp": "Just Me (Sole Proprietor)",
      "partnership": "Me and My Partner(s)",
      "limitedCompany": "Registered Company"
    }
  }
}
```

**Verify fix:**
```bash
# Test protocol for BUG-S03:
# 1. Enable airplane mode BEFORE launching app
# 2. Launch app fresh (force-close first)
# 3. Navigate through entire onboarding flow
# 4. Every single label must show English text, never raw key format
# 5. Switch language to Pidgin → repeat steps 1-4 in Pidgin
```

---

#### BUG-S04 🟡 HIGH — "COMMON.OFFLINE" Badge Format (Cousin of BUG-S03)
**Evidence:** IMG_1076.jpeg — The offline status badge renders as `COMMON.OFFLINE` in uppercase dot-separated format  
**Expected:** Should render as `● Offline Mode` matching the online equivalent `● Sync Ready`

This is subtly different from BUG-S03 — the key format `COMMON.OFFLINE` (uppercase, dot-separated) suggests this badge is using a **different key format** than the rest of the i18n system (which uses camelCase like `common.offline`).

```typescript
// Find the badge component
// In IMG_1068 (online), the badge shows: "● Sync Ready"  
// In IMG_1076 (offline), the badge shows: "COMMON.OFFLINE"

// The online badge likely uses a hardcoded string or a working key
// The offline badge uses a missing/mismatched key

// LOCATE: Search for the badge component
grep -rn "COMMON.OFFLINE\|Sync Ready\|Offline Mode\|syncReady\|offlineBadge" mobile/src --include="*.tsx"

// FIX PATTERN — make both badges use the same i18n pattern:
// SyncStatusBadge.tsx
const label = isOnline 
  ? t('common.syncReady')    // "● Sync Ready"
  : t('common.offlineMode'); // "● Offline Mode"

// en.json additions:
// "common": {
//   "syncReady": "Sync Ready",
//   "offlineMode": "Offline Mode",   // NOT "COMMON.OFFLINE"
// }
```

---

#### BUG-S05 🟡 HIGH — Onboarding Profile Form (S2) Shows Incorrect Step Context
**Evidence:** IMG_1076.jpeg — Screen shows "1 OF 4 / Let's Get Started!" with income + turnover fields, yet S1 (IMG_1068) also shows "1 OF 4 / Welcome to TaxBridge"

Both are labeled "1 OF 4" but contain completely different content. One of these is wrong, or the step counter logic doesn't account for the welcome screen being step 0.

**Fix options:**
```typescript
// Option A: Welcome screen is Step 0 (not counted in progress)
// Profile screen is Step 1 of 4
// Progress: welcome=0%, profile=25%, business=50%, completion=75%, done=100%

// Option B: Welcome is Step 1, Profile is Step 2
// Update counter: "2 OF 5" for the profile screen

// RECOMMENDED: Option A — welcome is a gateway, not a numbered step
// Update progress calculation:
const STEPS = ['profile', 'business', 'taxPreview', 'complete']; // 4 real steps
const stepNumber = STEPS.indexOf(currentStep) + 1; // 1-indexed
// Welcome screen: show "Let's Begin" not "1 OF 4"
```

---

#### BUG-S06 🟡 HIGH — Invoice Creation Modal UX: Missing NRS Explanation
**Evidence:** IMG_1072.jpeg — The coaching modal says "Create Your NRSt Invoice / Add Customer" but gives no context about what NRS means for a new user  
**UX problem:** A new SME user sees "NRS" with no explanation — this creates anxiety, not confidence

```typescript
// InvoiceCoachingModal.tsx — enhance the modal content:

// CURRENT (too sparse):
// Step 1 of 3
// Create Your NRS Invoice
// Add Customer
// Enter customer details or skip for walk-in

// ENHANCED:
// Step 1 of 3
// 🏛️ NRS-Compliant Invoice
// NRS = Nigeria Revenue Service. This invoice will be
// digitally stamped with a unique IRN code, making it
// legally valid for tax purposes.
// 
// Add Customer
// Enter customer details or skip for walk-in customers.
// [Skip this step]  [Next →]

// Add i18n keys:
// "invoice.nrsExplainer": "NRS = Nigeria Revenue Service. Your invoice gets a legally valid IRN stamp.",
// "invoice.nrsExplainerPidgin": "NRS na Nigeria Revenue Service. Dem go stamp your invoice make e valid for tax."
```

---

#### BUG-S07 🟢 MEDIUM — Settings Screen Sync Block Shows "Last sync: Never synced" on Fresh Install
**Evidence:** IMG_1067.jpeg — Sync section shows: `0 Total / 0 Synced / 0 Pending / Last sync: Never synced`  
**Assessment:** This is technically **correct behavior** for a fresh install with zero data — NOT a bug. However, the UX is discouraging for a new user.

**Enhancement (not a bug fix):**
```typescript
// SettingsSyncBlock.tsx
// CURRENT: Shows zeros and "Never synced" — looks broken to new users
// ENHANCED: Show encouraging empty state for new users

const isNewUser = totalInvoices === 0 && totalExpenses === 0;

if (isNewUser) {
  return (
    <View style={styles.newUserSyncBlock}>
      <Text style={styles.newUserTitle}>✨ Ready to sync!</Text>
      <Text style={styles.newUserSubtitle}>
        Create your first invoice and it will automatically sync
        when you're connected to the internet.
      </Text>
    </View>
  );
}

// Only show the counter grid (0/0/0) once user has actual data
```

---

### 🎨 PART IV — SECTION B: PREMIUM UI/UX UPGRADE SPECIFICATION
#### *Based on visual analysis of all 5 screenshots vs. Paystack/Flutterwave standard*

---

#### UI-01: Unified Design Token System

The screenshots reveal **visual inconsistency** across screens:
- S1 (Welcome): Clean card with rounded corners, white surface — looks polished
- S2 (Offline Profile): Wavy header decoration, different layout language — looks different app
- S3 (Settings): Flat list sections, smaller typography — feels utilitarian
- S4 (Invoice): Dark overlay modal pattern — professional
- S5 (Home offline): Completely empty, broken icons — worst first impression for offline users

**Root cause:** No shared design token system. Each screen was styled independently.

```typescript
// mobile/src/theme/index.ts — MASTER DESIGN TOKEN FILE
// Every color, spacing, radius, and shadow must come from here
// No hardcoded values anywhere in the codebase

export const tokens = {
  // ── Color Palette ─────────────────────────────────────────
  color: {
    // Brand
    primary:      '#1565C0',  // Deep blue — trust, authority (slightly darker than current #007BFF)
    primaryLight: '#1976D2',  // Hover/pressed state
    primaryDark:  '#0D47A1',  // Active/focused state
    primaryFaint: '#E3F2FD',  // Background tint for primary elements

    // Status
    success:      '#2E7D32',  // Nigerian green — compliance achieved
    successLight: '#4CAF50',
    successFaint: '#E8F5E9',
    warning:      '#E65100',  // Amber-orange — deadlines approaching
    warningLight: '#FF6D00',
    warningFaint: '#FFF3E0',
    danger:       '#B71C1C',  // Red — overdue, errors, critical
    dangerLight:  '#D32F2F',
    dangerFaint:  '#FFEBEE',
    info:         '#01579B',  // Blue-grey — neutral information

    // Nigerian cultural palette
    nairaGreen:   '#008751',  // Nigerian flag green
    nairaBronze:  '#C8860A',  // NGN coin gold

    // Surfaces (light mode)
    background:   '#F4F6F9',  // Slightly warmer than pure white
    surface:      '#FFFFFF',
    surfaceRaised:'#FFFFFF',
    border:       '#E0E7EF',
    borderLight:  '#F0F4F8',

    // Text
    textPrimary:  '#0D1B2A',  // Near-black with warmth
    textSecondary:'#546E7A',
    textTertiary: '#90A4AE',
    textOnDark:   '#FFFFFF',
    textLink:     '#1565C0',

    // Dark mode surfaces
    dark: {
      background:   '#0A0F1E',
      surface:      '#111827',
      surfaceRaised:'#1A2233',
      border:       '#2D3748',
      textPrimary:  '#F1F5F9',
      textSecondary:'#94A3B8',
    }
  },

  // ── Spacing (8pt grid) ────────────────────────────────────
  space: {
    xs:   4,
    sm:   8,
    md:   16,
    lg:   24,
    xl:   32,
    xxl:  48,
    xxxl: 64,
  },

  // ── Border Radius ─────────────────────────────────────────
  radius: {
    sm:   6,
    md:   12,
    lg:   16,
    xl:   24,
    full: 9999,
  },

  // ── Typography ────────────────────────────────────────────
  font: {
    size: {
      xs:      11,
      sm:      13,
      body:    15,
      md:      16,
      lg:      18,
      xl:      22,
      xxl:     28,
      display: 34,
    },
    weight: {
      regular:   '400' as const,
      medium:    '500' as const,
      semibold:  '600' as const,
      bold:      '700' as const,
      extrabold: '800' as const,
    },
    lineHeight: {
      tight:   1.2,
      normal:  1.5,
      relaxed: 1.75,
    }
  },

  // ── Shadows ───────────────────────────────────────────────
  // Use boxShadow (React Native 0.73+) not deprecated shadow* props
  shadow: {
    sm:  'rgba(0,0,0,0.06) 0px 1px 3px',
    md:  'rgba(0,0,0,0.10) 0px 4px 12px',
    lg:  'rgba(0,0,0,0.15) 0px 8px 24px',
    xl:  'rgba(21,101,192,0.20) 0px 12px 32px',  // Brand-tinted for primary CTAs
  },

  // ── Animation Durations ───────────────────────────────────
  animation: {
    fast:   150,
    normal: 250,
    slow:   400,
    page:   350,
  },

  // ── Touch Targets (WCAG AA minimum: 44×44) ───────────────
  touch: {
    min: 44,
    comfortable: 52,
    large: 64,
  }
} as const;

// Theme hook — respects system dark mode
export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return { tokens, isDark, color: isDark ? tokens.color.dark : tokens.color };
}
```

---

#### UI-02: Onboarding Screen Polish

**From S1 (IMG_1068) analysis — what's working:**
- Clean card with good elevation
- Feature list icons (cloud, camera, shield) — appropriate
- NDPC Compliant + NRS Ready badges — trust-building
- "Takes only 2 minutes" — good micro-copy
- Blue "Let's Start →" CTA — high contrast

**What needs improvement:**
```typescript
// mobile/src/screens/onboarding/WelcomeScreen.tsx

// ENHANCEMENT 1: Animated entrance sequence
// Current: static card
// Target: staggered fade-in for each feature row
// Implementation:
import Animated, { 
  FadeInDown, 
  FadeInUp,
  withSpring,
  useSharedValue 
} from 'react-native-reanimated';

// Each feature row enters with delay:
// Logo: delay 0ms
// Headline: delay 150ms
// Feature rows: delay 300ms, 450ms, 600ms (staggered)
// Badges: delay 750ms
// CTA: delay 900ms

// ENHANCEMENT 2: Progress dots → step indicator
// Current: ● ○ ○ ○ (dots only)
// Target: Animated pill that slides between positions
// Use Reanimated shared value for smooth indicator motion

// ENHANCEMENT 3: "Why complete onboarding?" footer
// Currently shown in IMG_1068 — GOOD. Keep it.
// But fix: "Compliance tips | WhatsApp support | SME insights" chips
// → Add haptic feedback on tap (Expo Haptics.selectionAsync())
// → Make WhatsApp chip actually open wa.me/... deeplink

// ENHANCEMENT 4: Lottie animation for the logo area
// Replace static TaxBridge logo with subtle loop animation:
// → A small bridge graphic that "builds" itself over 2 seconds
// → Or: Nigerian flag colors pulsing gently in logo
// → File: assets/animations/taxbridge-logo.json
```

**From S2 (IMG_1076) analysis — Profile form offline:**
```typescript
// mobile/src/screens/onboarding/ProfileAssessmentStep.tsx

// CURRENT ISSUES (visible in screenshot):
// 1. Wavy background decoration is visually inconsistent with other screens
// 2. "30s AVG SETUP" badge in top-right — good UX, keep it
// 3. Language/Offline Sync/NDPR chips row — good trust signals
// 4. Form fields use correct ₦ prefix — good

// ENHANCEMENT: Real-time tax preview as user types
// When annual income field changes → compute PIT estimate inline
// When annual turnover changes → check VAT threshold
// Show as a floating insight card below the form:

function TaxInsightPreview({ income, turnover }: { income: number; turnover: number }) {
  const pitEstimate = computePIT(income);           // From @taxbridge/contracts
  const vatRequired = turnover >= 100_000_000;       // ₦100M threshold
  const citRate = turnover < 25_000_000 ? 0         // From NTA 2025
                : turnover < 100_000_000 ? 0.20
                : 0.30;

  if (income < 1000) return null; // Don't show for empty/invalid input

  return (
    <Animated.View entering={FadeInDown.delay(200)} style={styles.insightCard}>
      <Text style={styles.insightTitle}>📊 Your Tax Preview</Text>
      <View style={styles.insightRow}>
        <Text style={styles.insightLabel}>Est. Annual PIT</Text>
        <Text style={styles.insightValue}>₦{formatNaira(pitEstimate)}</Text>
      </View>
      {vatRequired && (
        <View style={[styles.insightRow, styles.warningRow]}>
          <Text style={styles.insightLabel}>⚠️ VAT Registration</Text>
          <Text style={styles.insightValue}>Required (₦100M+)</Text>
        </View>
      )}
      <Text style={styles.insightFooter}>
        Based on Nigeria Tax Act 2025 • Exact figures calculated at filing
      </Text>
    </Animated.View>
  );
}

// ENHANCEMENT: Business Status selector
// Current: Shows "onboarding.profile.soleProp" raw key (BUG-S03)
// After fix: Show radio-card selector, not a dropdown picker:

const BUSINESS_TYPES = [
  { id: 'sole_prop',    icon: '👤', en: 'Sole Proprietor',  pidgin: 'Just Me Alone' },
  { id: 'partnership',  icon: '🤝', en: 'Partnership',       pidgin: 'Me and My Partner(s)' },
  { id: 'limited',      icon: '🏢', en: 'Limited Company',   pidgin: 'Registered Company' },
  { id: 'ngo',          icon: '🌍', en: 'NGO / Non-Profit',  pidgin: 'NGO / Non-Profit' },
];

// Radio cards with icon + label, selected state highlighted in brand blue
// Much better UX than a modal picker for this 4-option choice
```

---

#### UI-03: Home Screen Empty State (Offline)

**From S5 (IMG_1071) analysis:**
The empty home screen is the **first impression for a new offline user**. Currently shows:
- "Welcome back" + moon emoji — correct time-of-day greeting (6:50 = Good Evening)
- Large empty card with document icon + "No Invoices Yet" — acceptable
- "Create First Invoice" blue button — good CTA
- **Broken bottom nav icons** — (fixed in BUG-S01)

**What's missing entirely:**
```typescript
// mobile/src/screens/HomeScreen.tsx — empty state enhancements

// CURRENT: Just the invoice empty state card
// ENHANCED: Full empty state with onboarding nudges

function HomeScreenEmptyState() {
  return (
    <ScrollView>
      {/* 1. Tax Health Score teaser (locked state for new users) */}
      <TaxHealthScoreTeaserCard />

      {/* 2. Empty invoice card (existing — keep) */}
      <NoInvoicesCard onPress={navigateToCreate} />

      {/* 3. Quick-action suggestion cards (new) */}
      <Text style={styles.sectionTitle}>Get started in 3 steps</Text>
      <QuickStartCard
        icon="📄"
        step={1}
        title="Create your first invoice"
        subtitle="NRS-compliant, works offline"
        onPress={navigateToCreate}
      />
      <QuickStartCard
        icon="📷"
        step={2}
        title="Scan a business receipt"
        subtitle="AI categorizes it automatically"
        onPress={navigateToScanReceipt}
      />
      <QuickStartCard
        icon="🧮"
        step={3}
        title="Calculate your tax liability"
        subtitle="PIT, VAT, CIT — powered by NTA 2025"
        onPress={navigateToTaxCalc}
      />

      {/* 4. Compliance calendar teaser */}
      <ComplianceReminderBanner />
    </ScrollView>
  );
}

// TaxHealthScoreTeaserCard — shows locked score for new users
function TaxHealthScoreTeaserCard() {
  return (
    <View style={styles.healthCard}>
      <View style={styles.healthScoreCircle}>
        <Text style={styles.healthLockIcon}>🔒</Text>
      </View>
      <Text style={styles.healthTitle}>Tax Health Score</Text>
      <Text style={styles.healthSubtitle}>
        Create your first invoice to unlock your score
      </Text>
      <View style={styles.healthProgressPreview}>
        {/* Show 5 greyed-out progress segments */}
      </View>
    </View>
  );
}
```

---

#### UI-04: Settings Screen Refinements

**From S3 (IMG_1067) — what's working:**
- English/Pidgin toggle buttons — clean, intuitive
- Section menu items with icons — acceptable
- Version number at bottom — good

**What needs improvement:**
```typescript
// mobile/src/screens/SettingsScreen.tsx

// ENHANCEMENT 1: Expand accordion sections (currently collapsed)
// "Data & Storage", "Network & Sync", "Account & Sync" show ► arrow
// but no content. Add expandable content with actual settings:

const DATA_STORAGE_OPTIONS = [
  { label: 'Storage used', value: `${storageUsedMB} MB`, type: 'info' },
  { label: 'Clear OCR cache', value: null, type: 'action', onPress: clearOCRCache },
  { label: 'Export all data', value: null, type: 'action', onPress: exportData },
  { label: 'Delete all data', value: null, type: 'danger', onPress: confirmDeleteData },
];

// ENHANCEMENT 2: Language switch feedback
// Current: Tap "Pidgin" → language changes silently
// Enhanced: Show a brief toast confirmation IN the new language:
//   → "Language don change! App go use Pidgin from now"
//   → (Appears for 2s then auto-dismisses)

// ENHANCEMENT 3: Security & Compliance section
// Currently shows 🔒 Security & Compliance with ► arrow
// Expand to show:
//   - Biometric Auth toggle (coming soon, greyed out with "v2.0" badge)
//   - Data encryption: AES-256 ✓
//   - NDPC compliance: ✓
//   - Last security audit: Feb 2026
//   - Privacy policy link
//   - Data export (GDPR-equivalent right)

// ENHANCEMENT 4: Sync block for users with data
// After BUG-S07 fix (show encouraging state for new users),
// once user has data, show detailed sync breakdown:
function SyncStatusBlock({ syncData }: { syncData: SyncData }) {
  const { total, synced, pending, lastSync } = syncData;
  const syncHealth = pending === 0 ? 'healthy' : pending < 5 ? 'good' : 'attention';
  
  return (
    <View style={[styles.syncBlock, styles[`syncBlock_${syncHealth}`]]}>
      <View style={styles.syncHeader}>
        <View style={[styles.syncDot, styles[`dot_${syncHealth}`]]} />
        <Text style={styles.syncStatus}>
          {syncHealth === 'healthy' ? 'Online & Synced' : 
           syncHealth === 'good' ? 'Online & Syncing' : 
           'Sync Attention Needed'}
        </Text>
        <TouchableOpacity onPress={forceSync} style={styles.forceSyncBtn}>
          <Text style={styles.forceSyncLabel}>Force Sync</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.lastSyncTime}>
        Last sync: {lastSync ? formatRelativeTime(lastSync) : 'Never (create your first invoice!)'}
      </Text>
      <View style={styles.syncCountRow}>
        <SyncStat label="Total" value={total} />
        <SyncStat label="Synced" value={synced} color={tokens.color.success} />
        <SyncStat label="Pending" value={pending} 
          color={pending > 0 ? tokens.color.warning : tokens.color.success} />
      </View>
    </View>
  );
}
```

---

### 🧪 PART IV — SECTION C: TESTING PROTOCOLS FOR SCREENSHOT-CONFIRMED BUGS

Each confirmed bug requires a specific test to prevent regression:

```typescript
// mobile/src/__tests__/bugs/screenshot-confirmed.test.ts
// These tests were written DIRECTLY from evidence in the 5 screenshots

describe('BUG-S01: Icon font offline rendering', () => {
  it('renders tab icons when network is unavailable on launch', async () => {
    // Mock: NetInfo returns not-connected BEFORE app launches
    jest.mock('@react-native-community/netinfo', () => ({
      fetch: () => Promise.resolve({ isConnected: false }),
    }));
    
    const { getAllByTestId } = render(<TabNavigator />);
    const icons = getAllByTestId('tab-icon');
    
    // None should show empty/square placeholder
    icons.forEach(icon => {
      expect(icon).not.toHaveTextContent('□');
      expect(icon).not.toHaveTextContent('');
    });
  });
});

describe('BUG-S02: NRSt Invoice typo', () => {
  it('invoice modal title does not contain "NRSt" (lowercase t)', () => {
    const { queryByText } = render(<CreateInvoiceModal visible />);
    
    // Must not find the typo
    expect(queryByText(/NRSt/)).toBeNull();
    
    // Must find the correct title
    expect(queryByText(/NRS Invoice/)).not.toBeNull();
  });
});

describe('BUG-S03: i18n keys show raw when offline', () => {
  beforeEach(() => {
    // Simulate offline — important: set BEFORE i18n init
    jest.mock('@react-native-community/netinfo', () => ({
      fetch: () => Promise.resolve({ isConnected: false }),
    }));
  });

  it('shows translated label for annualTurnover, never raw key', () => {
    const { queryByText } = render(<ProfileAssessmentStep />);
    
    // Must not show raw key
    expect(queryByText('onboarding.profile.annualTurnover')).toBeNull();
    
    // Must show actual translated label (English or Pidgin)
    const label = queryByText(/Annual/i) ?? queryByText(/Business Make/i);
    expect(label).not.toBeNull();
  });

  it('shows "Offline Mode" not "COMMON.OFFLINE" for offline badge', () => {
    const { queryByText } = render(<SyncStatusBadge isOnline={false} />);
    
    expect(queryByText('COMMON.OFFLINE')).toBeNull();
    expect(queryByText(/Offline Mode/i) ?? queryByText(/No Network/i)).not.toBeNull();
  });

  it('shows "Sole Proprietor" not raw key for business type', () => {
    const { queryByText } = render(<BusinessTypeSelector value="sole_prop" />);
    expect(queryByText('onboarding.profile.soleProp')).toBeNull();
    expect(queryByText(/Sole Proprietor/i) ?? queryByText(/Just Me/i)).not.toBeNull();
  });
});

describe('BUG-S04: COMMON.OFFLINE badge format', () => {
  it('offline badge uses dot-prefixed "● Offline Mode" format matching online badge style', () => {
    const { getByTestId } = render(<SyncStatusBadge isOnline={false} />);
    const badge = getByTestId('sync-status-badge');
    // Should match style of "● Sync Ready" (online version)
    expect(badge.props.style).toMatchObject(expect.objectContaining({
      // Same container style as online badge
    }));
  });
});
```

---

### 📋 PART IV — SECTION D: MOBILE HARDENING IMPLEMENTATION CHECKLIST

This is the **definitive execution checklist** for the mobile app hardening task. Check off in order:

```
╔════════════════════════════════════════════════════════════════════╗
║  MOBILE HARDENING EXECUTION CHECKLIST                             ║
║  Target: v3.0.0 | Verified against 5 production screenshots       ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  🔴 P0 — FIX BEFORE ANY COMMIT                                    ║
║                                                                    ║
║  [ ] BUG-S01: Bundle icon fonts as local assets                   ║
║      File: app.json (assetBundlePatterns)                         ║
║      File: app/_layout.tsx (useFonts + SplashScreen gate)         ║
║      Test: Launch with airplane mode active                        ║
║                                                                    ║
║  [ ] BUG-S02: Fix "NRSt" → "NRS" in invoice i18n                  ║
║      File: mobile/src/i18n/en.json                                ║
║      File: mobile/src/i18n/pidgin.json                            ║
║      Test: Render CreateInvoiceModal, check title                  ║
║                                                                    ║
║  [ ] BUG-S03: Fix 3 raw i18n keys exposed offline                 ║
║      File: mobile/src/i18n/index.ts (initImmediate: false)        ║
║      File: mobile/src/i18n/en.json (add missing keys)             ║
║      File: mobile/src/i18n/pidgin.json (add Pidgin equivalents)   ║
║      Test: Full onboarding flow in airplane mode                   ║
║                                                                    ║
║  [ ] BUG-S04: Fix "COMMON.OFFLINE" badge key                      ║
║      File: wherever SyncStatusBadge renders the offline label      ║
║      Test: Offline badge shows "● Offline Mode"                    ║
║                                                                    ║
║  🟡 P1 — FIX IN SAME PR AS P0 BUGS                               ║
║                                                                    ║
║  [ ] BUG-S05: Reconcile "1 OF 4" step counter duplication         ║
║      File: OnboardingNavigator.tsx or step counter logic           ║
║      Decision: Welcome = gateway (not counted), Profile = Step 1   ║
║                                                                    ║
║  [ ] BUG-S06: Invoice modal — add NRS explainer text              ║
║      File: InvoiceCoachingModal.tsx                               ║
║      Add: Brief NRS explanation, i18n both languages               ║
║                                                                    ║
║  [ ] BUG-S07: Settings sync block — new user empty state          ║
║      File: SettingsSyncBlock.tsx                                   ║
║      Add: Encouraging message instead of 0/0/0/Never               ║
║                                                                    ║
║  🎨 P2 — UI/UX ELEVATIONS (post-bug-fix)                          ║
║                                                                    ║
║  [ ] UI-01: Implement unified design token system                  ║
║      File: mobile/src/theme/index.ts (new file)                   ║
║      Migrate: DashboardScreen, OnboardingScreens (P1 screens)      ║
║                                                                    ║
║  [ ] UI-02: Welcome screen animated entrance (Reanimated)          ║
║      File: WelcomeScreen.tsx                                      ║
║      Staggered FadeInDown for features, animated progress dots     ║
║                                                                    ║
║  [ ] UI-02b: Profile form real-time tax preview                    ║
║      File: ProfileAssessmentStep.tsx                              ║
║      Show: PIT estimate, VAT threshold warning as user types       ║
║                                                                    ║
║  [ ] UI-02c: Business type radio-cards                             ║
║      File: ProfileAssessmentStep.tsx                              ║
║      Replace picker with 4 icon-radio-cards                        ║
║                                                                    ║
║  [ ] UI-03: Home empty state with Tax Health Score teaser          ║
║      File: HomeScreen.tsx                                         ║
║      Add: 3-step quick-start cards, locked score card              ║
║                                                                    ║
║  [ ] UI-04: Settings — expand accordion sections                   ║
║      File: SettingsScreen.tsx                                     ║
║      Add: Force Sync button, language toast feedback               ║
║                                                                    ║
║  🧠 P3 — AI & INTELLIGENCE (after UI stable)                      ║
║                                                                    ║
║  [ ] OCR onboarding demo (receipt scan preview in onboarding)     ║
║      File: OnboardingOCRDemo.tsx (new component)                  ║
║                                                                    ║
║  [ ] Tax Health Score widget on dashboard                          ║
║      File: TaxHealthScoreWidget.tsx (new — see Module 3)           ║
║                                                                    ║
║  [ ] Smart compliance calendar reminders                           ║
║      File: ComplianceReminderBanner.tsx (new)                     ║
║                                                                    ║
║  🔐 P4 — PRODUCTION HARDENING                                     ║
║                                                                    ║
║  [ ] Sentry offline queue (capture errors even without network)    ║
║  [ ] CI: NRSt typo audit added to GitHub Actions                  ║
║  [ ] CI: COMMON.OFFLINE raw key audit added                        ║
║  [ ] EAS build with airplane mode smoke test script                ║
║  [ ] Update CHANGELOG.md: v3.0.0 entry                            ║
║  [ ] Update PRODUCTION_READY.md: v3.0 metrics                     ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

---

### 🚀 PART IV — SECTION E: MONOREPO AUDIT DIRECTIVES

Based on the task spec and screenshot evidence, audit these specific areas:

#### Metro Config Verification
```javascript
// mobile/metro.config.js — verify these settings exist
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// CRITICAL: @taxbridge/contracts must resolve to src/index.ts for Metro
// (dist/index.js is for Node.js backend/admin only)
config.resolver.extraNodeModules = {
  '@taxbridge/contracts': path.resolve(__dirname, '../packages/contracts/src/index.ts'),
};

// CRITICAL: blockList migration (not blacklistRE — deprecated)
// If the codebase uses blacklistRE, this will warn in Expo SDK 54
const { exclusionList } = require('metro-config');
config.resolver.blockList = exclusionList([
  /node_modules\/.*\/node_modules\/react-native\/.*/,
]);

// Verify: NOT using the old API
// config.resolver.blacklistRE = ...  ← WRONG, remove if present
```

#### EAS Configuration Verification
```json
// mobile/eas.json — verify these EXACT settings for v3.0
{
  "cli": { "version": ">= 5.9.1" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "cache": { "key": "v7-dev", "disabled": false },
      "env": { "EXPO_NO_FINGERPRINT": "1" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "cache": { "key": "v7-preview", "disabled": true },
      "env": { "EXPO_NO_FINGERPRINT": "1", "EAS_SKIP_AUTO_FINGERPRINT": "1" }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "cache": { "key": "v7-production", "disabled": false },
      "env": { "EXPO_NO_FINGERPRINT": "1" }
    }
  }
}
// NOTE: If native deps change in v3.0, bump ALL cache keys to v8-*
```

#### app.json Critical Fields
```json
// mobile/app.json — verify or add these production-critical fields
{
  "expo": {
    "name": "TaxBridge",
    "slug": "taxbridge",
    "version": "3.0.0",
    "sdkVersion": "54.0.0",

    "assetBundlePatterns": [
      "assets/**/*",
      "node_modules/@expo/vector-icons/build/vendor/**"
    ],

    "android": {
      "compileSdkVersion": 36,
      "targetSdkVersion": 35,
      "buildToolsVersion": "35.0.0",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1565C0"
      },
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT"
      ]
    },

    "plugins": [
      "expo-localization",
      "expo-sqlite",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#1565C0",
          "image": "./assets/splash.png",
          "resizeMode": "contain"
        }
      ],
      [
        "expo-camera",
        { "cameraPermission": "TaxBridge needs camera access to scan receipts." }
      ],
      [
        "expo-local-authentication",
        { "faceIDPermission": "TaxBridge uses Face ID for secure login." }
      ]
    ]
  }
}
```

#### Reanimated v4 Compatibility Check
```typescript
// CHANGELOG v2.0.0 mentions "Reanimated v4 with worklets"
// Verify all animations use the v4 API correctly:

// ✅ v4 CORRECT:
import Animated, { useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
const opacity = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

// ❌ v3/v2 PATTERNS to find and upgrade:
// useAnimatedGestureHandler → replaced by Gesture API in v4
// Animated.event → use gesture handlers
// 'use worklet' directive → now implicit in useAnimatedStyle callbacks

// Search for stale patterns:
grep -rn "useAnimatedGestureHandler\|Animated.event\|'use worklet'" mobile/src --include="*.tsx"
```

---

### 🔐 PART IV — SECTION F: SENTRY OFFLINE QUEUE IMPLEMENTATION

The screenshots show offline mode is a primary use case. Sentry must capture errors even when offline.

```typescript
// mobile/src/lib/sentry-config.ts

import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  
  // CRITICAL for offline use:
  // Sentry SDK buffers events in memory and flushes on reconnect
  // But with SQLite, we can persist the queue to survive app kills
  
  integrations: [
    new Sentry.ReactNativeTracing({
      routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
      tracingOrigins: ['taxbridge-api-ker8.onrender.com'],
    }),
  ],

  // Environment-aware settings
  environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
  enabled: !__DEV__,  // Disable Sentry in dev (reduces noise)
  
  // Offline event persistence — custom transport
  transport: createOfflineTransport({
    // Store failed events in SQLite offline queue table
    // Flush when connectivity restored via NetInfo listener
  }),
  
  beforeSend(event) {
    // Strip sensitive Nigerian financial data from error reports
    if (event.extra) {
      delete event.extra.tin;
      delete event.extra.bvn;
      delete event.extra.bankAccount;
    }
    return event;
  },

  tracesSampleRate: __DEV__ ? 0 : 0.2,  // 20% in production
});

// Offline event queue using SQLite
export async function createOfflineTransport() {
  return {
    send: async (envelope: Sentry.Envelope) => {
      const isConnected = (await NetInfo.fetch()).isConnected;
      
      if (!isConnected) {
        // Persist to SQLite for later flush
        await db.runAsync(
          'INSERT INTO sentry_queue (envelope, created_at) VALUES (?, ?)',
          [JSON.stringify(envelope), Date.now()]
        );
        return { statusCode: 200 }; // Tell Sentry "ok" to prevent retry storm
      }
      
      // Online: flush any queued events first, then send current
      await flushSentryQueue();
      return sendToSentry(envelope);
    }
  };
}

export async function flushSentryQueue() {
  const queued = await db.getAllAsync<{ id: number; envelope: string }>(
    'SELECT id, envelope FROM sentry_queue ORDER BY created_at ASC LIMIT 50'
  );
  
  for (const item of queued) {
    try {
      await sendToSentry(JSON.parse(item.envelope));
      await db.runAsync('DELETE FROM sentry_queue WHERE id = ?', [item.id]);
    } catch {
      break; // Stop if network fails mid-flush
    }
  }
}

// Call this when NetInfo reports reconnection:
NetInfo.addEventListener(state => {
  if (state.isConnected) flushSentryQueue();
});
```

---

---

## 🌟 PART V — PREMIUM PRODUCT LAYER: UX, EDUCATION, VISUAL EXCELLENCE & ADMIN POWER
### *The "5-Star App Store Review" Upgrade — From Functional to Beloved*

> **Scope declaration:** Parts I–IV covered architecture, bugs, queues, AI services, and screenshot forensics. Part V covers the *human* layer: how users feel using TaxBridge, how they learn from it, how it looks on every screen, and how the support/admin team operates it at scale. No repetition of previously covered ground.

---

## 🎓 MODULE 14 — TAX EDUCATION SYSTEM
### *"Learn While You File" — Nigeria's First Embedded Tax Literacy Engine*

The single biggest reason Nigerian SMEs avoid tax compliance is not dishonesty — it's confusion. TaxBridge's education system must eliminate confusion at the moment of maximum relevance: *right when the user is doing the thing the knowledge explains.*

### 14.1 Contextual Tooltip Architecture

```typescript
// mobile/src/components/education/TaxTooltip.tsx
// A lightweight, dismissible, knowledge card that appears next to any field

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight } from 'react-native-reanimated';
import { tokens } from '../theme';

export interface TaxTooltipContent {
  term: string;            // e.g. "VAT"
  plain: string;           // Plain English explanation (max 2 sentences)
  pidgin?: string;         // Pidgin equivalent
  example?: string;        // Concrete Nigerian example
  statute?: string;        // e.g. "NTA 2025 §11"
  learnMoreScreen?: string; // Deep-link to full TaxAcademy lesson
}

// Curated tooltip library — these are the 40 most-asked-about terms
// by Nigerian SMEs (based on support ticket analysis patterns)
export const TAX_TOOLTIPS: Record<string, TaxTooltipContent> = {
  vat: {
    term: 'VAT (Value Added Tax)',
    plain: 'A 7.5% tax added to goods and services you sell. If you earn over ₦100M/year, you must register and collect it.',
    pidgin: 'VAT na 7.5% wey you go add on top wetin you dey sell. If your business make ₦100M or more per year, you must register.',
    example: 'You sell a laptop for ₦200,000. Add 7.5% VAT = ₦215,000 total. The ₦15,000 goes to NRS.',
    statute: 'NTA 2025 §11',
    learnMoreScreen: 'TaxAcademy/vat-basics',
  },
  pit: {
    term: 'PIT (Personal Income Tax)',
    plain: 'Tax on income earned by individuals and sole proprietors. Nigeria uses a 6-band progressive system from 7% to 24%.',
    pidgin: 'PIT na tax wey person go pay on money wey dem earn. E dey go from 7% to 24% depending on how much you earn.',
    example: 'Annual income ₦2M → first ₦800k taxed at 7% = ₦56k, next ₦1.2M at 11% = ₦132k. Total PIT ≈ ₦188k.',
    statute: 'NTA 2025 §1-40',
    learnMoreScreen: 'TaxAcademy/pit-guide',
  },
  cit: {
    term: 'CIT (Company Income Tax)',
    plain: 'Tax on company profits. 0% for small companies (under ₦25M turnover), 20% for medium, 30% for large.',
    pidgin: 'CIT na tax on company profit. Small company (under ₦25M) no pay, medium pay 20%, big company pay 30%.',
    example: 'Your company earns ₦40M turnover. You qualify for the 20% CIT rate on taxable profits.',
    statute: 'NTA 2025 §55',
    learnMoreScreen: 'TaxAcademy/cit-guide',
  },
  paye: {
    term: 'PAYE (Pay As You Earn)',
    plain: 'Employers deduct income tax from employee salaries each month and remit to the state tax authority by the 10th.',
    pidgin: 'PAYE na tax wey employer go cut from worker salary every month and send to state tax office before 10th.',
    example: 'You have 3 staff. Each earns ₦150k/month. You compute PIT for each, deduct it, and send to LIRS/SIRS by 10th.',
    statute: 'NTA 2025 §82',
    learnMoreScreen: 'TaxAcademy/paye-guide',
  },
  wht: {
    term: 'WHT (Withholding Tax)',
    plain: 'A prepayment of tax deducted at source when making certain payments (rent, professional fees, dividends). Rate: 5–10%.',
    pidgin: 'WHT na tax wey you go cut from money you pay for rent, professional service, or dividend. Rate na 5-10%.',
    example: 'You pay a consultant ₦500,000. Deduct 5% WHT = ₦25,000. Send ₦475k to consultant, ₦25k to NRS.',
    statute: 'NTA 2025 §78',
    learnMoreScreen: 'TaxAcademy/wht-guide',
  },
  irn: {
    term: 'IRN (Invoice Reference Number)',
    plain: 'A unique code assigned by NRS to verify your invoice is legally valid. Required for B2B and government invoices.',
    pidgin: 'IRN na unique code wey NRS go give your invoice to show say e valid. You need am for business-to-business invoice.',
    example: 'After you create an invoice in TaxBridge, we submit it to NRS and they stamp it with an IRN like: TXB-2026-0042891.',
    statute: 'NRS 2026 E-Invoicing Standard §3',
    learnMoreScreen: 'TaxAcademy/e-invoicing',
  },
  tin: {
    term: 'TIN (Tax Identification Number)',
    plain: 'Your unique 10-digit number from the Joint Tax Board (JTB). Required for filing taxes, opening business accounts, and contracts.',
    pidgin: 'TIN na your 10-digit number from JTB. You need am to file tax, open business account, or sign contract.',
    example: 'Example TIN: 1234567890. Get yours free at any FIRS office or jtb.gov.ng.',
    learnMoreScreen: 'TaxAcademy/tin-guide',
  },
  devLevy: {
    term: 'Development Levy (4%)',
    plain: 'A 4% levy on company profits introduced in NTA 2025 to fund national infrastructure development.',
    pidgin: '4% levy on company profit wey NTA 2025 add to fund infrastructure. E dey on top of CIT.',
    statute: 'NTA 2025 §60A',
    learnMoreScreen: 'TaxAcademy/development-levy',
  },
  // ... 32 more entries covering: CGT, NDPR, e-filing, tax clearance,
  // BVN verification, CAC registration, annual returns, etc.
};

// The tooltip component itself
export function TaxTooltip({ 
  tooltipKey, 
  children,
  position = 'below'
}: {
  tooltipKey: keyof typeof TAX_TOOLTIPS;
  children: React.ReactNode;
  position?: 'above' | 'below' | 'right';
}) {
  const [visible, setVisible] = useState(false);
  const { i18n } = useTranslation();
  const isPidgin = i18n.language === 'pidgin';
  const content = TAX_TOOLTIPS[tooltipKey];
  const { tokens } = useTheme();

  return (
    <View>
      <TouchableOpacity 
        onPress={() => setVisible(true)}
        accessibilityLabel={`Learn about ${content.term}`}
        accessibilityRole="button"
      >
        {children}
        <View style={styles.infoIcon}>
          <Text style={styles.infoIconText}>ⓘ</Text>
        </View>
      </TouchableOpacity>

      {visible && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.tooltipCard, styles[`tooltip_${position}`]]}
        >
          {/* Header */}
          <View style={styles.tooltipHeader}>
            <Text style={styles.tooltipTerm}>{content.term}</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Explanation */}
          <Text style={styles.tooltipBody}>
            {isPidgin && content.pidgin ? content.pidgin : content.plain}
          </Text>

          {/* Concrete example */}
          {content.example && (
            <View style={styles.exampleBlock}>
              <Text style={styles.exampleLabel}>📌 Example</Text>
              <Text style={styles.exampleText}>{content.example}</Text>
            </View>
          )}

          {/* Statute reference */}
          {content.statute && (
            <Text style={styles.statute}>⚖️ {content.statute}</Text>
          )}

          {/* Deep link to TaxAcademy */}
          {content.learnMoreScreen && (
            <TouchableOpacity 
              style={styles.learnMoreBtn}
              onPress={() => {
                setVisible(false);
                router.push(`/(tabs)/learn/${content.learnMoreScreen}`);
              }}
            >
              <Text style={styles.learnMoreText}>Learn more in TaxAcademy →</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </View>
  );
}
```

**Usage pattern across the app:**
```tsx
// In VAT field on invoice creation:
<TaxTooltip tooltipKey="vat">
  <Text style={styles.fieldLabel}>VAT (7.5%)</Text>
</TaxTooltip>

// In PIT calculator:
<TaxTooltip tooltipKey="pit">
  <Text style={styles.sectionTitle}>Personal Income Tax</Text>
</TaxTooltip>

// In WHT payment form:
<TaxTooltip tooltipKey="wht">
  <Text style={styles.fieldLabel}>Withholding Tax Rate</Text>
</TaxTooltip>
```

---

### 14.2 TaxAcademy — In-App Learning Center

```typescript
// mobile/src/app/(tabs)/learn/index.tsx
// A dedicated learning tab with structured Nigerian tax content

// NAVIGATION STRUCTURE:
// /(tabs)/learn/
//   index.tsx          — Learning home with featured lessons + progress
//   pit-guide.tsx      — Personal Income Tax full guide
//   vat-basics.tsx     — VAT registration, filing, and claims
//   cit-guide.tsx      — Company Income Tax guide
//   paye-guide.tsx     — PAYE for employers
//   wht-guide.tsx      — Withholding Tax guide
//   e-invoicing.tsx    — NRS e-invoicing and IRN guide
//   tin-guide.tsx      — Getting your TIN
//   development-levy.tsx — New 4% Development Levy explained
//   crypto-cgt.tsx     — Crypto & CGT under NTA 2025
//   glossary.tsx       — Full A-Z tax glossary (40+ terms)
//   quiz/[topic].tsx   — Interactive quizzes per topic

// LEARNING HOME SCREEN LAYOUT:
export default function LearnHome() {
  const { progress } = useLearningProgress(); // Persisted in SQLite
  
  return (
    <ScrollView>
      {/* Progress Hero */}
      <LearningProgressHero
        lessonsCompleted={progress.completed}
        totalLessons={progress.total}         // 12 lessons
        streakDays={progress.streak}
        xpEarned={progress.xp}
      />

      {/* Featured: "Lesson of the Day" */}
      <LessonOfTheDayCard />

      {/* Learning Paths */}
      <Section title="Start Here" subtitle="For first-time taxpayers">
        <LessonCard 
          icon="🧾" topic="tin-guide"
          title="Getting Your TIN"
          duration="3 min" completed={progress['tin-guide']} />
        <LessonCard
          icon="💼" topic="pit-guide"
          title="How Personal Income Tax Works"
          duration="8 min" completed={progress['pit-guide']} />
        <LessonCard
          icon="🏢" topic="vat-basics"
          title="Do I Need to Register for VAT?"
          duration="5 min" completed={progress['vat-basics']} />
      </Section>

      <Section title="For Business Owners" subtitle="If you run a company or SME">
        <LessonCard icon="📊" topic="cit-guide" title="Company Income Tax" duration="10 min" />
        <LessonCard icon="👥" topic="paye-guide" title="PAYE for Employers" duration="7 min" />
        <LessonCard icon="🤝" topic="wht-guide" title="Withholding Tax" duration="6 min" />
        <LessonCard icon="🏛️" topic="e-invoicing" title="NRS E-Invoicing & IRN" duration="5 min" />
      </Section>

      <Section title="Advanced Topics">
        <LessonCard icon="💰" topic="development-levy" title="New: Development Levy (4%)" duration="4 min" badge="NTA 2025" />
        <LessonCard icon="₿" topic="crypto-cgt" title="Crypto Taxes in Nigeria" duration="9 min" badge="New" />
      </Section>

      {/* Glossary Quick Access */}
      <GlossaryQuickAccess popularTerms={['VAT', 'PIT', 'TIN', 'IRN', 'PAYE', 'WHT']} />
    </ScrollView>
  );
}
```

### 14.3 Lesson Format — Interactive Article + Quiz Pattern

```typescript
// mobile/src/app/(tabs)/learn/vat-basics.tsx
// Template for all lesson screens — consistent reading experience

export default function VATBasicsLesson() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [quizUnlocked, setQuizUnlocked] = useState(false);
  const { completeLesson } = useLearningProgress();

  return (
    <View style={styles.container}>
      {/* Reading progress bar at top */}
      <LinearGradient
        colors={['#1565C0', '#27AE60']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[styles.readingBar, { width: `${scrollProgress * 100}%` }]}
      />

      <ScrollView
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          const progress = contentOffset.y / (contentSize.height - layoutMeasurement.height);
          setScrollProgress(Math.min(progress, 1));
          if (progress > 0.85) setQuizUnlocked(true);
        }}
        scrollEventThrottle={16}
      >
        {/* Hero */}
        <View style={styles.lessonHero}>
          <Text style={styles.lessonEmoji}>🧮</Text>
          <Text style={styles.lessonTitle}>Do I Need to Register for VAT?</Text>
          <View style={styles.lessonMeta}>
            <Text style={styles.metaChip}>5 min read</Text>
            <Text style={styles.metaChip}>NTA 2025</Text>
            <Text style={styles.metaChip}>+50 XP</Text>
          </View>
        </View>

        {/* Key takeaway box — shown at top to give context */}
        <KeyTakeawayBox>
          If your business earns ₦100 million or more per year, you MUST register
          for VAT. Below that threshold, registration is optional but can be advantageous.
        </KeyTakeawayBox>

        {/* Article body — structured with visual breaks */}
        <LessonSection title="What is VAT?">
          <LessonParagraph>
            VAT (Value Added Tax) is a 7.5% tax collected on the value added at each 
            stage of production or distribution of goods and services in Nigeria.
          </LessonParagraph>
          <LessonCallout icon="💡" type="insight">
            Unlike income tax (which you pay on what you earn), VAT is ultimately paid 
            by the end consumer. You collect it on behalf of NRS and remit it monthly.
          </LessonCallout>
        </LessonSection>

        {/* Interactive example — users can toggle their turnover */}
        <LessonSection title="Am I Required to Register?">
          <VATThresholdCalculator />
          {/* User inputs their turnover → instantly sees "required" or "optional" */}
        </LessonSection>

        <LessonSection title="How to File Monthly VAT Returns">
          <NumberedStep step={1} title="Calculate Output VAT">
            Sum all VAT you collected from customers this month (7.5% × taxable sales).
          </NumberedStep>
          <NumberedStep step={2} title="Calculate Input VAT">
            Sum VAT you paid on business purchases (only from VAT-registered vendors).
          </NumberedStep>
          <NumberedStep step={3} title="Compute Net VAT">
            Net VAT = Output VAT − Input VAT. This is what you remit to NRS.
          </NumberedStep>
          <NumberedStep step={4} title="File by the 21st">
            Submit your VAT return and pay by the 21st of the following month.
            TaxBridge can auto-generate this return for you.
          </NumberedStep>
          <LessonCallout icon="⚠️" type="warning">
            Late filing penalty: ₦10,000 flat + 0.5% per day on unpaid tax.
            TaxBridge will remind you 7 days before the deadline.
          </LessonCallout>
        </LessonSection>

        {/* Frequently asked questions — collapsible */}
        <FAQSection topic="vat" questions={VAT_FAQS} />

        {/* Quiz unlock trigger */}
        {quizUnlocked && (
          <Animated.View entering={FadeIn.delay(300)}>
            <QuizUnlockCard
              topic="vat-basics"
              title="Test Your VAT Knowledge"
              xpReward={50}
              questionsCount={5}
              onStart={() => router.push('/(tabs)/learn/quiz/vat-basics')}
            />
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// Interactive VAT threshold calculator embedded in lesson
function VATThresholdCalculator() {
  const [turnover, setTurnover] = useState('');
  const numericTurnover = parseNaira(turnover);
  const required = numericTurnover >= 100_000_000;
  const approaching = numericTurnover >= 75_000_000 && numericTurnover < 100_000_000;

  return (
    <View style={styles.interactiveCalc}>
      <Text style={styles.calcLabel}>Enter your annual turnover:</Text>
      <NairaInput value={turnover} onChangeText={setTurnover} placeholder="e.g. 80,000,000" />
      
      {numericTurnover > 0 && (
        <Animated.View entering={FadeIn} style={[
          styles.calcResult,
          required ? styles.resultRequired : 
          approaching ? styles.resultWarning : 
          styles.resultOptional
        ]}>
          <Text style={styles.calcResultIcon}>
            {required ? '🔴' : approaching ? '🟡' : '🟢'}
          </Text>
          <Text style={styles.calcResultText}>
            {required
              ? 'VAT registration is MANDATORY for your business.'
              : approaching
              ? 'Approaching the ₦100M threshold — start preparing now.'
              : 'VAT registration is optional at your current turnover level.'}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
```

### 14.4 Gamification & Learning Streaks

```typescript
// mobile/src/services/learning-progress.ts
// Persisted to SQLite for offline access

export interface LearningProgress {
  lessonsCompleted: string[];     // Array of lesson IDs
  quizScores: Record<string, number>; // lesson → score (0-100)
  xpTotal: number;
  streakDays: number;
  lastActivityDate: string;       // ISO date string
  badges: Badge[];
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export const BADGE_DEFINITIONS: Badge[] = [
  { id: 'first_lesson',    icon: '📖', name: 'First Step',      condition: 'Complete 1 lesson',          xp: 25  },
  { id: 'vat_master',      icon: '🧮', name: 'VAT Master',      condition: 'Score 80%+ on VAT quiz',      xp: 100 },
  { id: 'pit_pro',         icon: '💼', name: 'PIT Pro',         condition: 'Score 80%+ on PIT quiz',      xp: 100 },
  { id: 'tax_streak_7',    icon: '🔥', name: '7-Day Streak',    condition: 'Use TaxBridge 7 days in a row',xp: 75  },
  { id: 'full_curriculum', icon: '🎓', name: 'Tax Graduate',    condition: 'Complete all 12 lessons',      xp: 500 },
  { id: 'quiz_perfect',    icon: '⭐', name: 'Perfect Score',   condition: 'Score 100% on any quiz',       xp: 150 },
  { id: 'nrs_ready',       icon: '🏛️', name: 'NRS Ready',       condition: 'Complete e-invoicing lesson',  xp: 50  },
  { id: 'crypto_tax_pro',  icon: '₿',  name: 'Crypto Tax Pro', condition: 'Complete crypto CGT lesson',   xp: 125 },
];

// XP levels — displayed as progress in the learning hub
export const LEVEL_THRESHOLDS = {
  beginner:     { min: 0,    max: 199,  color: '#78909C', label: 'Beginner'     },
  intermediate: { min: 200,  max: 599,  color: '#1565C0', label: 'Intermediate' },
  advanced:     { min: 600,  max: 1199, color: '#6A1B9A', label: 'Advanced'     },
  expert:       { min: 1200, max: Infinity, color: '#E65100', label: 'Tax Expert' },
};
```

---

## 🚀 MODULE 15 — FIRST-RUN EXPERIENCE & ONBOARDING WIZARD

### 15.1 "First Tax Insight" in Under 60 Seconds

The North Star metric for onboarding: **every user must see a personally relevant tax insight within 60 seconds of completing the profile step.** This is the "aha moment" that converts curious downloads into committed users.

```typescript
// mobile/src/screens/onboarding/TaxInsightRevealScreen.tsx
// Step 4 of 4 — the payoff screen that makes onboarding feel worth it

export default function TaxInsightRevealScreen() {
  const { profile } = useOnboarding();
  const insight = computeFirstInsight(profile); // Pure function from @taxbridge/contracts
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Dramatic reveal: 1.5s delay then animate in
    setTimeout(() => setRevealed(true), 1500);
  }, []);

  return (
    <View style={styles.container}>
      {/* Celebratory header */}
      <Animated.View entering={FadeInDown.delay(200)}>
        <Text style={styles.congratsEmoji}>🎉</Text>
        <Text style={styles.congratsTitle}>Your Tax Picture</Text>
        <Text style={styles.congratsSub}>Based on what you told us</Text>
      </Animated.View>

      {/* Primary insight card — the "aha moment" */}
      {!revealed ? (
        <InsightRevealSkeleton /> // Shimmer while computing
      ) : (
        <Animated.View entering={FadeIn.springify().damping(14)}>
          <PrimaryInsightCard insight={insight} />
        </Animated.View>
      )}

      {/* Secondary insights grid */}
      <Animated.View entering={FadeInUp.delay(800)}>
        <InsightGrid insights={insight.secondary} />
      </Animated.View>

      {/* Single CTA */}
      <Animated.View entering={FadeInUp.delay(1200)}>
        <TaxBridgePrimaryButton
          label="Take Me to My Dashboard"
          onPress={() => router.replace('/(tabs)/home')}
        />
        <Text style={styles.reassurance}>
          Your data is encrypted and stored only on this device until you sync.
        </Text>
      </Animated.View>
    </View>
  );
}

// The insight computation — pure function, no network needed
function computeFirstInsight(profile: OnboardingProfile): FirstInsight {
  const { annualIncome, annualTurnover, businessType } = profile;

  // PIT computation
  const pitLiability = computePIT(annualIncome);
  const monthlyPIT = pitLiability / 12;

  // VAT status
  const vatRequired = annualTurnover >= 100_000_000;
  const vatApproaching = annualTurnover >= 75_000_000;

  // CIT rate
  const citRate = annualTurnover < 25_000_000 ? 0
                : annualTurnover < 100_000_000 ? 0.20 : 0.30;

  // Primary insight — the most actionable single number for this user
  const primary: InsightCard = businessType === 'sole_prop'
    ? {
        icon: '📊',
        headline: `₦${formatNaira(pitLiability)} estimated annual PIT`,
        subline: `That's ₦${formatNaira(monthlyPIT)}/month to set aside`,
        color: pitLiability > 500_000 ? 'warning' : 'success',
        action: 'See full PIT breakdown',
        actionRoute: '/(tabs)/calculate/pit',
      }
    : {
        icon: citRate === 0 ? '✅' : '📈',
        headline: citRate === 0 
          ? 'Your company pays 0% CIT'
          : `${citRate * 100}% CIT applies to your company`,
        subline: citRate === 0
          ? 'Small companies under ₦25M are CIT-exempt under NTA 2025'
          : `Estimated quarterly payment: ₦${formatNaira(annualTurnover * citRate * 0.25)}`,
        color: citRate === 0 ? 'success' : 'info',
      };

  return {
    primary,
    secondary: [
      vatRequired
        ? { icon: '⚠️', label: 'VAT Registration', value: 'Required', color: 'warning' }
        : vatApproaching
        ? { icon: '👀', label: 'VAT Threshold', value: 'Watch', color: 'info' }
        : { icon: '✅', label: 'VAT Registration', value: 'Optional', color: 'success' },
      { icon: '📅', label: 'Next Tax Deadline', value: computeNextDeadline(businessType), color: 'neutral' },
      { icon: '🎯', label: 'Tax Health Score', value: '—', color: 'neutral', locked: true },
    ],
  };
}
```

### 15.2 Smart Onboarding Navigation Guard

```typescript
// mobile/src/hooks/useOnboardingGuard.ts
// Prevents users from skipping onboarding AND prevents re-showing to users who completed it

export function useOnboardingGuard() {
  const [status, setStatus] = useState<'loading' | 'needs-onboarding' | 'completed'>('loading');

  useEffect(() => {
    async function checkOnboardingState() {
      try {
        // Check SQLite first (offline-safe)
        const completed = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM app_settings WHERE key = 'onboarding_completed'"
        );
        
        if (completed?.value === 'true') {
          setStatus('completed');
        } else {
          setStatus('needs-onboarding');
        }
      } catch (error) {
        // If DB isn't ready yet, default to showing onboarding (safer)
        Sentry.captureException(error, { tags: { context: 'onboarding-guard' } });
        setStatus('needs-onboarding');
      }
    }
    checkOnboardingState();
  }, []);

  const completeOnboarding = useCallback(async () => {
    await db.runAsync(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('onboarding_completed', 'true')"
    );
    setStatus('completed');
  }, []);

  const resetOnboarding = useCallback(async () => {
    // Dev/debug tool only — never expose in production UI
    if (!__DEV__) return;
    await db.runAsync("DELETE FROM app_settings WHERE key = 'onboarding_completed'");
    setStatus('needs-onboarding');
  }, []);

  return { status, completeOnboarding, resetOnboarding };
}
```

---

## 💅 MODULE 16 — FINTECH-GRADE VISUAL SYSTEM IMPLEMENTATION

### 16.1 Typography System

```typescript
// mobile/src/theme/typography.ts
// Consistent type scale — every text element in the app uses one of these presets

import { Platform, TextStyle } from 'react-native';

// Font stack — uses system fonts for performance (no font loading)
// iOS: San Francisco (system default) — premium, legible
// Android: Roboto (system default) — clean, material
// This eliminates the font-loading issue that causes blank screens offline
const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography: Record<string, TextStyle> = {
  // Display — hero numbers, score reveals
  displayLarge: {
    fontFamily, fontSize: 40, fontWeight: '800', lineHeight: 48, letterSpacing: -1.5,
  },
  displayMedium: {
    fontFamily, fontSize: 32, fontWeight: '700', lineHeight: 40, letterSpacing: -1,
  },
  
  // Headlines — screen titles, section headers
  h1: { fontFamily, fontSize: 26, fontWeight: '700', lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily, fontSize: 22, fontWeight: '700', lineHeight: 30, letterSpacing: -0.3 },
  h3: { fontFamily, fontSize: 18, fontWeight: '600', lineHeight: 26, letterSpacing: -0.2 },
  h4: { fontFamily, fontSize: 16, fontWeight: '600', lineHeight: 24, letterSpacing: 0   },
  
  // Body — article text, descriptions
  bodyLarge:  { fontFamily, fontSize: 16, fontWeight: '400', lineHeight: 26, letterSpacing: 0.1 },
  bodyMedium: { fontFamily, fontSize: 14, fontWeight: '400', lineHeight: 22, letterSpacing: 0.1 },
  bodySmall:  { fontFamily, fontSize: 12, fontWeight: '400', lineHeight: 18, letterSpacing: 0.2 },
  
  // Labels — form labels, button text, chips
  labelLarge:  { fontFamily, fontSize: 15, fontWeight: '600', lineHeight: 20, letterSpacing: 0.3 },
  labelMedium: { fontFamily, fontSize: 13, fontWeight: '600', lineHeight: 18, letterSpacing: 0.4 },
  labelSmall:  { fontFamily, fontSize: 11, fontWeight: '500', lineHeight: 16, letterSpacing: 0.5 },
  
  // Financial — amounts, numbers, codes (monospace feel)
  nairaAmount: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 28, fontWeight: '700', lineHeight: 36, letterSpacing: -0.5,
  },
  nairaAmountSmall: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 18, fontWeight: '600', lineHeight: 24, letterSpacing: 0,
  },
  irnCode: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13, fontWeight: '400', lineHeight: 18, letterSpacing: 1.5,
  },
  
  // Caption — metadata, timestamps, legal text
  caption:     { fontFamily, fontSize: 11, fontWeight: '400', lineHeight: 16, letterSpacing: 0.3 },
  overline:    { fontFamily, fontSize: 10, fontWeight: '600', lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' as const },
};
```

### 16.2 Component Library — Premium Primitives

```typescript
// mobile/src/components/ui/Button.tsx
// The single Button component used everywhere — not per-screen custom buttons

import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, useAnimatedStyle, withSpring, withTiming 
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { tokens, typography } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;      // Left icon
  trailingIcon?: React.ReactNode; // Right icon (e.g. →)
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  accessibilityHint?: string;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function TaxBridgeButton({
  label, onPress, variant = 'primary', size = 'md',
  icon, trailingIcon, loading = false, disabled = false,
  fullWidth = false, haptic = 'light', accessibilityHint,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(0.85, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 250 });
    opacity.value = withTiming(1, { duration: 150 });
  };

  const handlePress = async () => {
    if (disabled || loading) return;
    if (haptic !== 'none') {
      await Haptics.impactAsync(
        haptic === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy
        : haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
      );
    }
    onPress();
  };

  const variantStyles = {
    primary:   { bg: tokens.color.primary,    text: '#FFFFFF', border: 'transparent' },
    secondary: { bg: tokens.color.primaryFaint, text: tokens.color.primary, border: tokens.color.primary },
    ghost:     { bg: 'transparent',           text: tokens.color.primary, border: 'transparent' },
    danger:    { bg: tokens.color.danger,     text: '#FFFFFF', border: 'transparent' },
    success:   { bg: tokens.color.success,    text: '#FFFFFF', border: 'transparent' },
  }[variant];

  const sizeStyles = {
    sm: { paddingVertical: 8,  paddingHorizontal: 16, borderRadius: tokens.radius.sm, fontSize: 13 },
    md: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: tokens.radius.md, fontSize: 15 },
    lg: { paddingVertical: 18, paddingHorizontal: 32, borderRadius: tokens.radius.lg, fontSize: 16 },
    xl: { paddingVertical: 20, paddingHorizontal: 40, borderRadius: tokens.radius.xl, fontSize: 18 },
  }[size];

  return (
    <AnimatedTouchable
      style={[
        styles.base,
        {
          backgroundColor: variantStyles.bg,
          borderColor: variantStyles.border,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderRadius: sizeStyles.borderRadius,
          width: fullWidth ? '100%' : undefined,
          opacity: disabled ? 0.45 : 1,
          boxShadow: variant === 'primary' && !disabled 
            ? `${tokens.color.primary}40 0px 4px 16px` 
            : undefined,
        },
        animatedStyle,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1} // We handle opacity in Reanimated
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.text} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[
            typography.labelLarge,
            { color: variantStyles.text, fontSize: sizeStyles.fontSize }
          ]}>
            {label}
          </Text>
          {trailingIcon && <View style={styles.iconRight}>{trailingIcon}</View>}
        </View>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', minHeight: tokens.touch.comfortable,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconLeft: { marginRight: 4 },
  iconRight: { marginLeft: 4 },
});
```

### 16.3 NairaInput — The Financial Input Component

```typescript
// mobile/src/components/ui/NairaInput.tsx
// Used on every monetary input field in the app — format as user types

import React, { useRef } from 'react';
import { TextInput, View, Text, StyleSheet, TextInputProps } from 'react-native';
import { tokens, typography } from '../../theme';

interface NairaInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;              // Always formatted string: "1,500,000"
  onChangeText: (formatted: string, numeric: number) => void;
  label?: string;
  hint?: string;
  error?: string;
  size?: 'md' | 'lg';
  tooltipKey?: string;        // Renders ⓘ tooltip next to label if provided
}

export function NairaInput({
  value, onChangeText, label, hint, error, size = 'md', tooltipKey, ...rest
}: NairaInputProps) {
  const inputRef = useRef<TextInput>(null);

  const handleChange = (raw: string) => {
    // Strip non-numeric characters (allow digits only)
    const digits = raw.replace(/[^0-9]/g, '');
    
    // Format with commas
    const numeric = parseInt(digits || '0', 10);
    const formatted = numeric === 0 ? '' : numeric.toLocaleString('en-NG');
    
    onChangeText(formatted, numeric);
  };

  const isLarge = size === 'lg';

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[typography.labelMedium, { color: tokens.color.textSecondary }]}>
            {label}
          </Text>
          {/* Tooltip rendered here if tooltipKey provided */}
        </View>
      )}

      <View style={[
        styles.inputWrapper,
        isLarge && styles.inputWrapperLarge,
        error ? styles.inputWrapperError : styles.inputWrapperDefault,
      ]}>
        {/* ₦ prefix — prominent, always visible */}
        <Text style={[
          styles.prefix,
          isLarge && styles.prefixLarge,
          { color: value ? tokens.color.textPrimary : tokens.color.textTertiary }
        ]}
          accessibilityElementsHidden // Screen readers read the label, not this symbol
        >
          ₦
        </Text>

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          keyboardType="numeric"
          returnKeyType="done"
          style={[
            styles.input,
            isLarge && styles.inputLarge,
            typography.nairaAmount,
            { color: tokens.color.textPrimary },
          ]}
          placeholderTextColor={tokens.color.textTertiary}
          accessibilityLabel={label ? `${label} amount in naira` : 'Amount in naira'}
          {...rest}
        />
      </View>

      {/* Helper or error text */}
      {(hint || error) && (
        <Text style={[
          typography.caption,
          { color: error ? tokens.color.danger : tokens.color.textTertiary, marginTop: 4 }
        ]}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}
```

### 16.4 Card Component System

```typescript
// mobile/src/components/ui/Card.tsx
// Consistent card surface — used for dashboard widgets, insights, lesson cards

export function Card({
  children, elevation = 'md', padding = 'md',
  onPress, accent, style,
}: {
  children: React.ReactNode;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  accent?: 'primary' | 'success' | 'warning' | 'danger'; // Left border accent
  style?: ViewStyle;
}) {
  const { tokens } = useTheme();

  const cardContent = (
    <View style={[
      styles.card,
      {
        backgroundColor: tokens.surface,
        borderRadius: tokens.radius.lg,
        padding: { none: 0, sm: 12, md: 16, lg: 24 }[padding],
        boxShadow: {
          none: undefined,
          sm: tokens.shadow.sm,
          md: tokens.shadow.md,
          lg: tokens.shadow.lg,
        }[elevation],
        borderLeftWidth: accent ? 4 : 0,
        borderLeftColor: accent ? {
          primary: tokens.color.primary,
          success: tokens.color.success,
          warning: tokens.color.warning,
          danger:  tokens.color.danger,
        }[accent] : undefined,
      },
      style,
    ]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {cardContent}
      </TouchableOpacity>
    );
  }
  return cardContent;
}
```

---

## 🖥️ MODULE 17 — ADMIN DASHBOARD POWER FEATURES

### 17.1 Super-Admin Command Center

The admin dashboard at `taxbridge.vercel.app` currently has a basic layout. These are the power features the support team and accountants need most.

```typescript
// admin-dashboard/src/app/(admin)/users/[userId]/page.tsx
// Deep user profile for support team — everything about one user in one view

export default function UserDetailPage({ params }: { params: { userId: string } }) {
  const { data: user } = useSWR(`/api/admin/users/${params.userId}/profile`);
  const { data: activity } = useSWR(`/api/admin/users/${params.userId}/activity`);
  const { data: anomalies } = useSWR(`/api/admin/users/${params.userId}/anomalies`);

  return (
    <AdminLayout title={`User: ${user?.businessName ?? '...'}`} breadcrumbs={['Users', user?.businessName]}>
      <div className="grid grid-cols-12 gap-6">
        
        {/* LEFT: Identity & Status panel */}
        <div className="col-span-3">
          <UserIdentityPanel user={user} />
          <TaxHealthPanel score={user?.taxHealthScore} />
          <ComplianceStatusPanel user={user} />
        </div>

        {/* CENTER: Activity timeline */}
        <div className="col-span-6">
          <TabBar tabs={['Activity', 'Invoices', 'Expenses', 'Anomalies', 'Sync Logs']} />
          <ActivityTimeline events={activity?.events} />
        </div>

        {/* RIGHT: Quick actions for support */}
        <div className="col-span-3">
          <SupportActionsPanel userId={params.userId} />
          <AnomalyAlertPanel anomalies={anomalies} />
          <NRSSubmissionPanel userId={params.userId} />
        </div>

      </div>
    </AdminLayout>
  );
}

// Support actions the team can take directly from the admin panel
function SupportActionsPanel({ userId }: { userId: string }) {
  return (
    <Card title="Support Actions" icon="🛠️">
      <ActionButton
        label="Force Sync"
        icon="🔄"
        description="Trigger immediate sync for this user's device"
        variant="primary"
        onConfirm={() => api.post(`/admin/users/${userId}/force-sync`)}
      />
      <ActionButton
        label="Resubmit Failed NRS"
        icon="🏛️"
        description="Retry all failed NRS submissions for this user"
        variant="warning"
        onConfirm={() => api.post(`/admin/users/${userId}/nrs-resubmit-all`)}
      />
      <ActionButton
        label="Regenerate Tax Report"
        icon="📊"
        description="Regenerate the user's annual tax summary PDF"
        variant="secondary"
        onConfirm={() => api.post(`/admin/users/${userId}/regenerate-report`)}
      />
      <ActionButton
        label="Clear OCR Queue"
        icon="📷"
        description="Clear stuck OCR jobs for this user"
        variant="ghost"
        onConfirm={() => api.post(`/admin/users/${userId}/clear-ocr-queue`)}
      />
      <ActionButton
        label="Suspend Account"
        icon="⛔"
        description="Temporarily suspend this account"
        variant="danger"
        requireDoubleConfirm
        doubleConfirmText="Type the user's TIN to confirm suspension"
        onConfirm={(tin) => api.post(`/admin/users/${userId}/suspend`, { confirmTin: tin })}
      />
    </Card>
  );
}
```

### 17.2 Accountant Mode — Multi-Client Dashboard

```typescript
// admin-dashboard/src/app/(accountant)/clients/page.tsx
// For professional accountants managing multiple SME clients

// ACCOUNTANT PORTAL FEATURES:
// 1. Client roster with compliance status at a glance
// 2. Bulk filing deadline tracker (all clients in one view)
// 3. Cross-client anomaly feed
// 4. One-click filing on behalf of client (with explicit delegation recorded)
// 5. Client comparison analytics

export default function AccountantClientsPage() {
  const { data: clients, isLoading } = useSWR('/api/accountant/clients');
  const [filter, setFilter] = useState<'all' | 'overdue' | 'upcoming' | 'compliant'>('all');

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients.filter(c => {
      if (filter === 'overdue')   return c.hasOverdueFilings;
      if (filter === 'upcoming')  return c.hasUpcomingDeadlines;
      if (filter === 'compliant') return c.taxHealthScore >= 80;
      return true;
    });
  }, [clients, filter]);

  return (
    <AccountantLayout>
      {/* Summary header */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Clients"    value={clients?.length ?? 0}                                 icon="👥" />
        <MetricCard label="Overdue Filings"  value={clients?.filter(c => c.hasOverdueFilings).length ?? 0} icon="⚠️" color="danger" />
        <MetricCard label="Due This Week"    value={clients?.filter(c => c.deadlineThisWeek).length ?? 0}  icon="📅" color="warning" />
        <MetricCard label="Fully Compliant"  value={clients?.filter(c => c.taxHealthScore >= 80).length ?? 0} icon="✅" color="success" />
      </div>

      {/* Filter tabs */}
      <TabFilter
        options={[
          { key: 'all',       label: 'All Clients',  count: clients?.length },
          { key: 'overdue',   label: '⚠️ Overdue',   count: clients?.filter(c => c.hasOverdueFilings).length },
          { key: 'upcoming',  label: '📅 Due Soon',  count: clients?.filter(c => c.deadlineThisWeek).length },
          { key: 'compliant', label: '✅ Compliant', count: clients?.filter(c => c.taxHealthScore >= 80).length },
        ]}
        active={filter}
        onChange={setFilter}
      />

      {/* Client roster table */}
      <ClientRosterTable clients={filtered} isLoading={isLoading} />

      {/* Bulk actions toolbar */}
      <BulkActionsBar
        actions={[
          { label: 'Send Deadline Reminders', icon: '📬', onExecute: bulkSendReminders },
          { label: 'Export Compliance Report', icon: '📊', onExecute: bulkExportReport },
          { label: 'Generate VAT Returns', icon: '🧮', onExecute: bulkGenerateVAT },
        ]}
      />
    </AccountantLayout>
  );
}

// Client roster table — the core accountant work surface
function ClientRosterTable({ clients, isLoading }: { clients: Client[]; isLoading: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left p-4 font-semibold text-slate-600">Business</th>
            <th className="text-left p-4 font-semibold text-slate-600">Tax Type</th>
            <th className="text-left p-4 font-semibold text-slate-600">Next Deadline</th>
            <th className="text-center p-4 font-semibold text-slate-600">Health Score</th>
            <th className="text-center p-4 font-semibold text-slate-600">Status</th>
            <th className="text-left p-4 font-semibold text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <ClientRowSkeleton key={i} />)
            : clients.map(client => <ClientRow key={client.id} client={client} />)
          }
        </tbody>
      </table>
    </div>
  );
}

function ClientRow({ client }: { client: Client }) {
  const deadlineDays = differenceInDays(new Date(client.nextDeadline), new Date());
  const urgency = deadlineDays < 0 ? 'overdue' : deadlineDays <= 3 ? 'critical' : deadlineDays <= 7 ? 'warning' : 'normal';

  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="p-4">
        <div className="font-medium text-slate-900">{client.businessName}</div>
        <div className="text-slate-500 text-xs">{client.tin} · {client.businessType}</div>
      </td>
      <td className="p-4">
        <div className="flex gap-1 flex-wrap">
          {client.taxTypes.map(t => (
            <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
              {t}
            </span>
          ))}
        </div>
      </td>
      <td className="p-4">
        <div className={cn(
          'font-medium',
          urgency === 'overdue'  && 'text-red-600',
          urgency === 'critical' && 'text-orange-600',
          urgency === 'warning'  && 'text-amber-600',
          urgency === 'normal'   && 'text-slate-700',
        )}>
          {urgency === 'overdue' ? `${Math.abs(deadlineDays)}d overdue` : `${deadlineDays}d remaining`}
        </div>
        <div className="text-slate-500 text-xs">{format(new Date(client.nextDeadline), 'dd MMM yyyy')}</div>
      </td>
      <td className="p-4 text-center">
        <TaxHealthBadge score={client.taxHealthScore} size="sm" />
      </td>
      <td className="p-4 text-center">
        <ComplianceStatusBadge status={client.complianceStatus} />
      </td>
      <td className="p-4">
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionIconButton icon="👁️" label="View" href={`/clients/${client.id}`} />
          <ActionIconButton icon="📝" label="File" onPress={() => openFilingModal(client)} />
          <ActionIconButton icon="📬" label="Remind" onPress={() => sendReminder(client.id)} />
        </div>
      </td>
    </tr>
  );
}
```

### 17.3 Real-Time System Monitor

```typescript
// admin-dashboard/src/app/(admin)/system/page.tsx
// Operations team view — live platform health

export default function SystemMonitorPage() {
  // Poll critical metrics every 15s (production) or 5s (incidents)
  const pollingInterval = useIncidentMode() ? 5000 : 15000;
  
  const { data: health }   = useSWR('/api/admin/health/full', { refreshInterval: pollingInterval });
  const { data: queues }   = useSWR('/api/admin/health/queues', { refreshInterval: pollingInterval });
  const { data: payments } = useSWR('/api/admin/health/payments', { refreshInterval: pollingInterval });
  const { data: nrs }      = useSWR('/api/admin/nrs/health', { refreshInterval: pollingInterval });

  return (
    <AdminLayout title="System Monitor" showLastUpdated>
      {/* Traffic light header — most important signal at a glance */}
      <SystemStatusBanner 
        overall={deriveOverallStatus(health, queues, payments, nrs)}
      />

      <div className="grid grid-cols-3 gap-6 mt-6">
        {/* Col 1: Infrastructure */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Infrastructure</h2>
          <ServiceHealthCard label="API Server"    status={health?.api}      latency={health?.apiLatencyMs} />
          <ServiceHealthCard label="Database"      status={health?.database} connections={health?.dbConnections} />
          <ServiceHealthCard label="Redis Cache"   status={health?.redis}    hitRate={health?.cacheHitRate} />
          <ServiceHealthCard label="BullMQ Worker" status={health?.worker}   processed={health?.jobsProcessed24h} />
        </div>

        {/* Col 2: Queues */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Job Queues</h2>
          {queues?.map(q => (
            <QueueHealthCard
              key={q.name}
              name={q.name}
              waiting={q.waiting}
              active={q.active}
              failed={q.failed}
              dlqDepth={q.dlqDepth}
              throughput={q.jobsPerHour}
            />
          ))}
        </div>

        {/* Col 3: External Services */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Integrations</h2>
          <IntegrationCard label="NRS / DigiTax"   status={nrs?.status}       latency={nrs?.latencyMs} successRate={nrs?.successRate24h} />
          <IntegrationCard label="Paystack"         status={payments?.paystack}   successRate={payments?.paystackRate24h} />
          <IntegrationCard label="Flutterwave"      status={payments?.flutterwave} successRate={payments?.flutterwaveRate24h} />
          <IntegrationCard label="Remita"           status={payments?.remita}      successRate={payments?.remitaRate24h} />
          <IntegrationCard label="Youverify"        status={health?.youverify}     latency={health?.youverifyLatencyMs} />
          <IntegrationCard label="Google Vision"    status={health?.vision}        successRate={health?.ocrSuccessRate24h} />
        </div>
      </div>

      {/* Bottom: Recent incidents / errors */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Recent Errors</h2>
        <ErrorEventFeed events={health?.recentErrors} />
      </div>
    </AdminLayout>
  );
}
```

---

## 🌍 MODULE 18 — WEST AFRICA EXPANSION FOUNDATION

TaxBridge is built for Nigeria but the architecture should accommodate Ghana, Kenya, and Senegal without a full rebuild. This module lays the structural groundwork.

### 18.1 Country Configuration System

```typescript
// packages/contracts/src/countries/index.ts
// Country-aware configuration — each country is a plugin

export interface CountryConfig {
  code: 'NG' | 'GH' | 'KE' | 'SN';
  name: string;
  currency: {
    code: string;       // 'NGN', 'GHS', 'KES', 'XOF'
    symbol: string;     // '₦', 'GH₵', 'KSh', 'CFA'
    decimals: number;   // 2 for NGN, 2 for GHS
    locale: string;     // 'en-NG', 'en-GH', 'en-KE', 'fr-SN'
  };
  taxAuthority: {
    name: string;       // 'NRS', 'GRA', 'KRA', 'DGID'
    filingPortal: string;
    eInvoicingStandard?: string; // 'NRS 2026', 'GRA e-VAT', etc.
  };
  taxRules: CountryTaxRules;
  languages: string[];   // ['en', 'pidgin'] for NG, ['en', 'tw'] for GH
  phoneFormat: RegExp;
  tinFormat: RegExp;
}

// Nigeria (active)
export const NG_CONFIG: CountryConfig = {
  code: 'NG',
  name: 'Nigeria',
  currency: { code: 'NGN', symbol: '₦', decimals: 2, locale: 'en-NG' },
  taxAuthority: {
    name: 'NRS',
    filingPortal: 'https://taxpromax.gov.ng',
    eInvoicingStandard: 'NRS 2026',
  },
  taxRules: NTA_2025_RULES,
  languages: ['en', 'pidgin'],
  phoneFormat: /^(\+234|0)[789]\d{9}$/,
  tinFormat: /^\d{10}$/,
};

// Ghana (foundation only — activate when ready)
export const GH_CONFIG: CountryConfig = {
  code: 'GH',
  name: 'Ghana',
  currency: { code: 'GHS', symbol: 'GH₵', decimals: 2, locale: 'en-GH' },
  taxAuthority: {
    name: 'GRA',
    filingPortal: 'https://gra.gov.gh',
  },
  taxRules: GRA_2024_RULES, // Stub — populate when expanding
  languages: ['en'],
  phoneFormat: /^(\+233|0)[25]\d{8}$/,
  tinFormat: /^[A-Z]\d{10}$/,
};

// Feature flag — only NG is active in production
export const ACTIVE_COUNTRIES = ['NG'] as const;
export function isCountryActive(code: string): boolean {
  return ACTIVE_COUNTRIES.includes(code as any);
}
```

### 18.2 Currency Formatting — Country-Aware

```typescript
// packages/contracts/src/utils/currency.ts

export function formatMoney(
  amount: number,
  countryCode: string = 'NG',
  compact: boolean = false
): string {
  const config = getCountryConfig(countryCode);
  const { currency } = config;

  if (compact) {
    // Nigerian compact format: ₦1.5M, ₦250K
    if (amount >= 1_000_000_000) return `${currency.symbol}${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000)     return `${currency.symbol}${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000)         return `${currency.symbol}${(amount / 1_000).toFixed(0)}K`;
    return `${currency.symbol}${amount}`;
  }

  // Full format: ₦1,500,000.00
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amount);
}
```

---

## 🔔 MODULE 19 — NOTIFICATION & COMMUNICATION SYSTEM

### 19.1 Push Notification Taxonomy

```typescript
// mobile/src/notifications/types.ts
// Every notification the app sends — categorized and templated

export type NotificationCategory =
  | 'tax_deadline'        // Compliance deadlines approaching
  | 'anomaly_alert'       // AI detected suspicious activity
  | 'sync_complete'       // Background sync finished
  | 'nrs_stamped'         // Invoice got IRN stamp
  | 'payment_received'    // Payment webhook processed
  | 'health_score_change' // Tax health score changed significantly
  | 'learning_streak'     // Learning streak reminder
  | 'weekly_summary'      // Weekly tax activity digest
  | 'system_alert';       // Platform announcements

// Notification templates — all i18n'd, both English and Pidgin
export const NOTIFICATION_TEMPLATES: Record<NotificationCategory, NotificationTemplate> = {
  tax_deadline: {
    en: {
      title: (data) => `${data.taxType} filing due in ${data.daysUntil} days`,
      body: (data) => `Your ${data.taxType} return for ${data.period} must be filed by ${data.dueDate}. Estimated liability: ₦${data.estimatedAmount}.`,
    },
    pidgin: {
      title: (data) => `${data.taxType} due date dey ${data.daysUntil} days — prepare!`,
      body: (data) => `File your ${data.taxType} for ${data.period} before ${data.dueDate}. You go pay around ₦${data.estimatedAmount}.`,
    },
    icon: '📅',
    sound: 'default',
    priority: 'high',
  },
  anomaly_alert: {
    en: {
      title: () => '⚠️ Unusual activity detected',
      body: (data) => `We noticed ${data.signalDescription}. Tap to review.`,
    },
    pidgin: {
      title: () => '⚠️ Something no look right',
      body: (data) => `We see ${data.signalDescription}. Tap to check am.`,
    },
    icon: '⚠️',
    sound: 'alert',
    priority: 'max',
  },
  nrs_stamped: {
    en: {
      title: () => '✅ Invoice stamped by NRS',
      body: (data) => `Invoice #${data.invoiceNumber} to ${data.customerName} received IRN: ${data.irn}`,
    },
    pidgin: {
      title: () => '✅ NRS don stamp your invoice',
      body: (data) => `Invoice #${data.invoiceNumber} for ${data.customerName} get IRN: ${data.irn}`,
    },
    icon: '🏛️',
    sound: 'success',
    priority: 'normal',
  },
  weekly_summary: {
    en: {
      title: (data) => `Your week in taxes: ${data.weekOf}`,
      body: (data) => `${data.invoicesCreated} invoices · ₦${data.revenueFormatted} revenue · Tax Health: ${data.healthScore}/100`,
    },
    pidgin: {
      title: (data) => `Your tax week: ${data.weekOf}`,
      body: (data) => `${data.invoicesCreated} invoice · ₦${data.revenueFormatted} revenue · Health Score: ${data.healthScore}/100`,
    },
    icon: '📊',
    sound: 'default',
    priority: 'low',
    scheduledTime: 'sunday_8am',
  },
  // ... other categories
};
```

### 19.2 In-App Notification Center

```typescript
// mobile/src/screens/NotificationsScreen.tsx
// Full notification inbox — not just a list of alerts

export default function NotificationsScreen() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const unread = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.h2}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {['All', '⚠️ Alerts', '📅 Deadlines', '✅ Confirmations', '📊 Summaries'].map(cat => (
          <FilterChip key={cat} label={cat} />
        ))}
      </ScrollView>

      <FlashList
        data={notifications}
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onPress={() => handleNotificationTap(item)}
            onDismiss={() => dismissNotification(item.id)}
          />
        )}
        estimatedItemSize={80}
        ListEmptyComponent={<EmptyNotifications />}
      />
    </View>
  );
}
```

---

## 📊 MODULE 20 — MOBILE DASHBOARD FINAL STATE

### 20.1 The Dashboard Every User Sees Daily

This is the most important screen in the app. It must load in under 1 second offline and show immediately useful information.

```typescript
// mobile/src/screens/DashboardScreen.tsx — complete reimplementation target

export default function DashboardScreen() {
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: stats } = useDashboardStats(); // From SQLite — instant offline
  const greeting = useTimeGreeting();           // Good morning/afternoon/evening

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl onRefresh={syncNow} />}
      stickyHeaderIndices={[0]}
    >
      {/* Sticky offline banner (animates in/out) */}
      <OfflineStatusBanner isOnline={isOnline} pendingCount={stats?.pendingSync ?? 0} />

      {/* Personalized header */}
      <DashboardHeader
        greeting={greeting}
        businessName={profile?.businessName}
        avatarInitials={profile?.businessName?.slice(0, 2).toUpperCase()}
        notificationCount={stats?.unreadNotifications}
        onNotificationsPress={() => router.push('/notifications')}
      />

      {/* TAX HEALTH SCORE — flagship widget */}
      <TaxHealthScoreWidget
        score={stats?.taxHealthScore}
        grade={stats?.taxHealthGrade}
        trend={stats?.healthTrend}
        trendDelta={stats?.healthTrendDelta}
        isLoading={!stats}
        onPress={() => router.push('/insights/tax-health')}
      />

      {/* QUICK STATS ROW */}
      <View style={styles.statsRow}>
        <QuickStatCard
          icon="📄" label="Invoices" value={stats?.invoicesThisMonth ?? 0}
          subValue={`₦${formatCompact(stats?.revenueThisMonth ?? 0)}`}
          onPress={() => router.push('/invoices')}
        />
        <QuickStatCard
          icon="💸" label="Expenses" value={stats?.expensesThisMonth ?? 0}
          subValue={`₦${formatCompact(stats?.expenseTotalThisMonth ?? 0)}`}
          onPress={() => router.push('/expenses')}
        />
        <QuickStatCard
          icon="🧮" label="Tax Due" value={null}
          subValue={`₦${formatCompact(stats?.projectedTaxLiability ?? 0)}`}
          accent="warning"
          onPress={() => router.push('/calculate')}
        />
      </View>

      {/* NEXT DEADLINE CARD */}
      <NextDeadlineCard deadline={stats?.nextDeadline} />

      {/* AI ANOMALY ALERTS — only if any active */}
      {stats?.activeAnomalies?.length > 0 && (
        <AnomalyAlertSection
          anomalies={stats.activeAnomalies}
          onViewAll={() => router.push('/insights/anomalies')}
        />
      )}

      {/* RECENT ACTIVITY */}
      <Section title="Recent Activity" action={{ label: 'See all', route: '/activity' }}>
        {stats?.recentActivity?.map(item => (
          <ActivityRow key={item.id} item={item} />
        )) ?? <ActivityRowSkeleton count={3} />}
      </Section>

      {/* LEARNING NUDGE — contextual based on user's weakest area */}
      <LearningNudgeCard
        lessonKey={stats?.recommendedLesson}
        reason={stats?.recommendedLessonReason}
      />

      {/* COMPLIANCE CALENDAR PEEK */}
      <ComplianceCalendarPeek
        upcomingDeadlines={stats?.upcomingDeadlines?.slice(0, 3)}
        onViewFull={() => router.push('/compliance')}
      />
    </ScrollView>
  );
}
```

### 20.2 Next Deadline Card — The Single Most Actionable Widget

```typescript
// mobile/src/components/dashboard/NextDeadlineCard.tsx

export function NextDeadlineCard({ deadline }: { deadline: TaxDeadline | null }) {
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();

  if (!deadline) return null;

  const daysUntil = differenceInDays(new Date(deadline.dueDate), new Date());
  const urgency = daysUntil < 0 ? 'overdue' 
                : daysUntil <= 3 ? 'critical'
                : daysUntil <= 7 ? 'warning'
                : 'normal';

  const urgencyConfig = {
    overdue:  { color: tokens.color.danger,  icon: '🚨', label: `${Math.abs(daysUntil)}d overdue` },
    critical: { color: tokens.color.warning, icon: '⚠️', label: `${daysUntil}d left` },
    warning:  { color: tokens.color.warning, icon: '📅', label: `${daysUntil}d left` },
    normal:   { color: tokens.color.primary, icon: '📅', label: `${daysUntil}d left` },
  }[urgency];

  return (
    <Card accent={urgency === 'overdue' ? 'danger' : urgency === 'critical' ? 'warning' : 'primary'}>
      <View style={styles.deadlineHeader}>
        <Text style={styles.deadlineIcon}>{urgencyConfig.icon}</Text>
        <View style={styles.deadlineInfo}>
          <Text style={[typography.h4, { color: urgencyConfig.color }]}>
            {deadline.taxType} {t('compliance.deadline')}
          </Text>
          <Text style={typography.bodyMedium}>
            {format(new Date(deadline.dueDate), 'EEEE, dd MMMM yyyy')}
          </Text>
        </View>
        <View style={[styles.countdownBadge, { backgroundColor: urgencyConfig.color }]}>
          <Text style={styles.countdownText}>{urgencyConfig.label}</Text>
        </View>
      </View>

      {/* Estimated liability */}
      {deadline.estimatedLiability > 0 && (
        <View style={styles.liabilityRow}>
          <Text style={[typography.bodySmall, { color: tokens.color.textSecondary }]}>
            Estimated amount due:
          </Text>
          <Text style={[typography.nairaAmountSmall, { color: tokens.color.textPrimary }]}>
            ₦{deadline.estimatedLiability.toLocaleString('en-NG')}
          </Text>
        </View>
      )}

      {/* CTA */}
      <TaxBridgeButton
        label={urgency === 'overdue' ? 'File Now — Avoid More Penalties' : 'Prepare Filing'}
        variant={urgency === 'overdue' ? 'danger' : 'primary'}
        size="md"
        fullWidth
        onPress={() => router.push(`/file/${deadline.taxType.toLowerCase()}`)}
        haptic={urgency === 'overdue' ? 'heavy' : 'light'}
        style={{ marginTop: 12 }}
      />

      {/* Penalty calculator for overdue */}
      {urgency === 'overdue' && (
        <TouchableOpacity onPress={() => router.push('/calculate/penalty')}>
          <Text style={[typography.caption, { color: tokens.color.danger, textAlign: 'center', marginTop: 8 }]}>
            See accrued penalties →
          </Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}
```

---

## 📐 MODULE 21 — RESPONSIVE WEB & PWA CONFIGURATION

The admin dashboard and any web-facing components must work perfectly on mobile browsers (many Nigerian users access web on their phones).

### 21.1 PWA Configuration for Admin Dashboard

```typescript
// admin-dashboard/next.config.ts — PWA additions
import withPWA from 'next-pwa';

const nextConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Cache API responses for offline admin viewing
      urlPattern: /^https:\/\/taxbridge-api-ker8\.onrender\.com\/api\/admin\/.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'taxbridge-admin-api',
        expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 }, // 5 minutes
      },
    },
    {
      // Cache static assets aggressively
      urlPattern: /\.(js|css|png|jpg|jpeg|svg|ico|woff2)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'taxbridge-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
      },
    },
  ],
})({
  // ... rest of next config
});
```

### 21.2 Mobile-First Admin Layout

```typescript
// admin-dashboard/src/components/layout/AdminShell.tsx
// Responsive layout that works on phone, tablet, and desktop

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Mobile: Slide-over sidebar */}
      {isMobile && (
        <>
          <MobileHeader onMenuPress={() => setSidebarOpen(true)} />
          <SlideOverSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
            <SidebarContent />
          </SlideOverSidebar>
        </>
      )}

      {/* Tablet: Collapsed icon sidebar */}
      {isTablet && !isMobile && (
        <div className="flex h-screen">
          <IconSidebar />
          <main className="flex-1 overflow-auto p-4">{children}</main>
        </div>
      )}

      {/* Desktop: Full sidebar */}
      {!isTablet && (
        <div className="flex h-screen">
          <FullSidebar />
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-6">{children}</div>
          </main>
        </div>
      )}
    </div>
  );
}
```

---

## ✅ MASTER EXECUTION PRIORITY MATRIX

*The complete stack-ranked backlog for v3.0.0 — use this as the single source of truth for sprint planning.*

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  TAXBRIDGE V3.0.0 MASTER BACKLOG — STACK RANKED BY IMPACT/EFFORT RATIO       ║
╠════╦═══════════════════════════════════════════════╦════════╦═══════╦═════════╣
║ #  ║ Item                                          ║ Impact ║ Effort║ Part    ║
╠════╬═══════════════════════════════════════════════╬════════╬═══════╬═════════╣
║ 1  ║ BUG-S01: Bundle icon fonts (fix □ squares)    ║ 🔴 P0  ║  XS   ║ IV      ║
║ 2  ║ BUG-S02: Fix "NRSt" → "NRS" typo             ║ 🔴 P0  ║  XS   ║ IV      ║
║ 3  ║ BUG-S03: i18n offline raw key fix             ║ 🔴 P0  ║  S    ║ IV      ║
║ 4  ║ BUG-S04: COMMON.OFFLINE badge                 ║ 🔴 P0  ║  XS   ║ IV      ║
║ 5  ║ Design token system (theme/index.ts)           ║ 🟡 P1  ║  M    ║ V·UI-01 ║
║ 6  ║ TaxBridgeButton + NairaInput components        ║ 🟡 P1  ║  S    ║ V·16.2  ║
║ 7  ║ First Tax Insight reveal screen (onboarding)  ║ 🟡 P1  ║  M    ║ V·15.1  ║
║ 8  ║ Tax Tooltip system (40 terms)                 ║ 🟡 P1  ║  M    ║ V·14.1  ║
║ 9  ║ Dashboard final state (Module 20)             ║ 🟡 P1  ║  L    ║ V·20.1  ║
║ 10 ║ Next Deadline Card widget                     ║ 🟡 P1  ║  S    ║ V·20.2  ║
║ 11 ║ BUG-S05: Step counter reconciliation          ║ 🟡 P1  ║  XS   ║ IV      ║
║ 12 ║ BUG-S06: NRS explainer in invoice modal       ║ 🟡 P1  ║  XS   ║ IV      ║
║ 13 ║ TaxAcademy lesson infrastructure              ║ 🟢 P2  ║  L    ║ V·14.2  ║
║ 14 ║ VAT Basics interactive lesson                 ║ 🟢 P2  ║  M    ║ V·14.3  ║
║ 15 ║ Gamification & XP system                     ║ 🟢 P2  ║  M    ║ V·14.4  ║
║ 16 ║ Onboarding guard hook                         ║ 🟢 P2  ║  S    ║ V·15.2  ║
║ 17 ║ Typography system                             ║ 🟢 P2  ║  S    ║ V·16.1  ║
║ 18 ║ Card component system                         ║ 🟢 P2  ║  S    ║ V·16.4  ║
║ 19 ║ Admin user detail power page                  ║ 🟢 P2  ║  L    ║ V·17.1  ║
║ 20 ║ Accountant multi-client dashboard             ║ 🟢 P2  ║  L    ║ V·17.2  ║
║ 21 ║ Admin system monitor                          ║ 🟢 P2  ║  M    ║ V·17.3  ║
║ 22 ║ Notification taxonomy + templates             ║ 🟢 P2  ║  M    ║ V·19.1  ║
║ 23 ║ In-app notification center                    ║ 🟢 P2  ║  M    ║ V·19.2  ║
║ 24 ║ West Africa country config system             ║ 🔵 P3  ║  M    ║ V·18.1  ║
║ 25 ║ PWA configuration for admin                   ║ 🔵 P3  ║  S    ║ V·21.1  ║
║ 26 ║ Responsive admin shell                        ║ 🔵 P3  ║  M    ║ V·21.2  ║
║ 27 ║ BullMQ queue orchestration                    ║ 🔵 P3  ║  L    ║ II·M4   ║
║ 28 ║ Payment circuit breaker                       ║ 🔵 P3  ║  M    ║ II·M7   ║
║ 29 ║ Tax Health Score engine                       ║ 🔵 P3  ║  L    ║ II·M3   ║
║ 30 ║ Enhanced OCR 13-category classifier           ║ 🔵 P3  ║  XL   ║ II·M2   ║
╚════╩═══════════════════════════════════════════════╩════════╩═══════╩═════════╝

Effort scale: XS=<2h  S=2-4h  M=4-8h  L=8-16h  XL=16+h
```

---

---

## 🗂️ PART VI — CORE PRODUCT COMPLETION: FILING, PAYROLL, VAULT, GROWTH & OPERATIONS
### *The Remaining 40%: What Makes TaxBridge a Platform, Not Just an App*

> **Scope declaration:** Parts I–V built the foundation, infrastructure, bugs, AI intelligence, UX/education layer, and admin tools. Part VI completes the **core product surface** that turns first-time users into paying long-term subscribers: the full tax filing wizard, expense reconciliation engine, USSD/SMS accessibility channel, payroll and PAYE module, document vault, multi-user team accounts, referral growth engine, and the operational runbook for going live. These modules are not extensions — they are the product.

---

## 📋 MODULE 22 — GUIDED TAX FILING WIZARD
### *The Core Revenue-Generating Feature — From "I owe tax" to "Filed and stamped"*

The filing wizard is the single most important screen sequence in TaxBridge. It is where compliance actually happens. It must be designed for a first-time filer who has never touched a government tax portal.

### 22.1 Filing Wizard Architecture

```typescript
// mobile/src/app/(tabs)/file/index.tsx
// Entry point — shows which tax types are due and their status

// FILING WIZARD NAVIGATION TREE:
// /(tabs)/file/
//   index.tsx                — Filing hub: all tax types + status
//   vat/
//     index.tsx              — VAT wizard entry (period selector)
//     step-1-sales.tsx       — Step 1: Total taxable sales
//     step-2-purchases.tsx   — Step 2: Input VAT on purchases
//     step-3-adjustments.tsx — Step 3: Prior credits/adjustments
//     step-4-review.tsx      — Step 4: Compute & review
//     step-5-submit.tsx      — Step 5: Submit to NRS + payment
//     success.tsx            — IRN stamp + payment receipt
//   pit/
//     index.tsx              — PIT wizard (annual return)
//     step-1-income.tsx      — All income sources
//     step-2-deductions.tsx  — Allowable deductions
//     step-3-reliefs.tsx     — Personal reliefs (NTA 2025 §33)
//     step-4-compute.tsx     — Tax liability computation
//     step-5-review.tsx      — Review and certify
//     step-6-pay.tsx         — Pay via Remita/Paystack
//   paye/
//     index.tsx              — PAYE entry (monthly)
//     step-1-employees.tsx   — Employee payroll data
//     step-2-compute.tsx     — Compute PAYE per employee
//     step-3-review.tsx      — Review payroll summary
//     step-4-remit.tsx       — Remit to state tax authority
//   cit/
//     index.tsx              — CIT (annual, 6mo after year-end)
//     [similar 5-step pattern]
//   wht/
//     index.tsx              — WHT (monthly)
//     [3-step: transactions → compute → remit]

// Filing hub screen — shows all tax obligations at a glance
export default function FilingHub() {
  const { profile } = useAuth();
  const { data: obligations } = useFilingObligations(); // From backend

  const taxTypes = [
    { key: 'vat',  label: 'VAT',  icon: '🧮', frequency: 'Monthly',  required: obligations?.vatRequired },
    { key: 'paye', label: 'PAYE', icon: '👥', frequency: 'Monthly',  required: obligations?.hasEmployees },
    { key: 'wht',  label: 'WHT',  icon: '✂️', frequency: 'Monthly',  required: obligations?.hasWHT },
    { key: 'pit',  label: 'PIT',  icon: '💼', frequency: 'Annual',   required: true },
    { key: 'cit',  label: 'CIT',  icon: '🏢', frequency: 'Annual',   required: obligations?.isCompany },
    { key: 'cgt',  label: 'CGT',  icon: '📈', frequency: 'On event', required: obligations?.hasDisposals },
  ].filter(t => t.required !== false);

  return (
    <ScrollView style={styles.container}>
      <Text style={typography.h2}>File Taxes</Text>
      <Text style={[typography.bodyMedium, { color: tokens.color.textSecondary }]}>
        Select a tax type to begin your filing
      </Text>

      {taxTypes.map(tax => (
        <FilingTypeCard
          key={tax.key}
          icon={tax.icon}
          label={tax.label}
          frequency={tax.frequency}
          status={obligations?.[`${tax.key}Status`]}
          deadline={obligations?.[`${tax.key}Deadline`]}
          estimatedAmount={obligations?.[`${tax.key}Estimate`]}
          onPress={() => router.push(`/(tabs)/file/${tax.key}`)}
        />
      ))}

      {/* History */}
      <Section title="Filing History">
        <FilingHistoryList />
      </Section>
    </ScrollView>
  );
}
```

### 22.2 VAT Filing Wizard — Complete Implementation

```typescript
// mobile/src/app/(tabs)/file/vat/step-1-sales.tsx
// Step 1 of 5: Capture total taxable sales for the period

export default function VATStep1Sales() {
  const { period, updateVAT } = useVATFiling();
  const [standardSales, setStandardSales] = useState('');
  const [zeroRatedSales, setZeroRatedSales] = useState('');
  const [exemptSales, setExemptSales] = useState('');

  // Auto-populate from invoices created in TaxBridge for this period
  const { data: autoPopulated } = useAutoPopulatedSales(period);

  useEffect(() => {
    if (autoPopulated && !standardSales) {
      setStandardSales(formatNaira(autoPopulated.standardRated));
      setZeroRatedSales(formatNaira(autoPopulated.zeroRated));
    }
  }, [autoPopulated]);

  const totalTaxableSales = parseNaira(standardSales);
  const outputVAT = totalTaxableSales * 0.075;

  return (
    <WizardStep
      stepNumber={1}
      totalSteps={5}
      title="Your Sales This Month"
      subtitle={`Period: ${formatPeriod(period)}`}
    >
      {/* Auto-populate banner — key trust builder */}
      {autoPopulated && (
        <AutoPopulateBanner
          invoiceCount={autoPopulated.invoiceCount}
          message={`We found ${autoPopulated.invoiceCount} invoices worth ₦${formatCompact(autoPopulated.total)} for this period.`}
          onAccept={() => {/* already applied */}}
          onEdit={() => {/* clear and manual entry */}}
        />
      )}

      <NairaInput
        label="Standard-Rated Sales (7.5% VAT)"
        value={standardSales}
        onChangeText={(formatted, numeric) => {
          setStandardSales(formatted);
          updateVAT({ standardSales: numeric });
        }}
        hint="Sales of regular goods and services — most businesses"
        tooltipKey="vat"
      />

      <NairaInput
        label="Zero-Rated Sales (0% VAT)"
        value={zeroRatedSales}
        onChangeText={(formatted, numeric) => {
          setZeroRatedSales(formatted);
          updateVAT({ zeroRatedSales: numeric });
        }}
        hint="Exports, basic foodstuffs — see NTA 2025 Schedule 1"
      />

      <NairaInput
        label="Exempt Sales (No VAT)"
        value={exemptSales}
        onChangeText={(formatted, numeric) => {
          setExemptSales(formatted);
          updateVAT({ exemptSales: numeric });
        }}
        hint="Medical services, educational services, financial services"
      />

      {/* Live computation preview */}
      {totalTaxableSales > 0 && (
        <ComputationPreviewCard
          rows={[
            { label: 'Standard-rated sales', value: `₦${standardSales}` },
            { label: 'Output VAT (7.5%)', value: `₦${formatNaira(outputVAT)}`, highlight: true },
          ]}
        />
      )}

      <WizardNavigation
        onBack={() => router.back()}
        onNext={() => {
          if (!standardSales && !zeroRatedSales && !exemptSales) {
            showAlert('Please enter at least one sales figure');
            return;
          }
          router.push('/(tabs)/file/vat/step-2-purchases');
        }}
        nextLabel="Next: Your Purchases →"
      />
    </WizardStep>
  );
}
```

```typescript
// mobile/src/app/(tabs)/file/vat/step-4-review.tsx
// The key computational review step — shows exactly how the number was reached

export default function VATStep4Review() {
  const { vatData } = useVATFiling();
  const computation = computeVATLiability(vatData);

  return (
    <WizardStep stepNumber={4} totalSteps={5} title="Review Your VAT Return">

      {/* Computation breakdown — this is the "trust-building" moment */}
      <Card elevation="lg" padding="lg">
        <Text style={typography.h3}>VAT Computation</Text>
        <Text style={[typography.caption, { color: tokens.color.textTertiary }]}>
          Period: {formatPeriod(vatData.period)} · Form 002
        </Text>

        <Divider style={{ marginVertical: 12 }} />

        <ComputationRow label="Output VAT (Sales)" value={computation.outputVAT} />
        <ComputationRow label="Less: Input VAT (Purchases)" value={-computation.inputVAT} negative />
        <ComputationRow label="Less: Prior Period Credit" value={-computation.priorCredit} negative />

        <Divider style={{ marginVertical: 8, borderStyle: 'dashed' }} />

        <ComputationRow
          label="NET VAT PAYABLE"
          value={computation.netPayable}
          large
          color={computation.netPayable > 0 ? tokens.color.danger : tokens.color.success}
        />

        {computation.netPayable < 0 && (
          <InfoBox type="success" icon="🎉">
            You have a VAT credit of ₦{formatNaira(Math.abs(computation.netPayable))}.
            This will be carried forward to next month.
          </InfoBox>
        )}
      </Card>

      {/* Penalty calculator — only show if filing date passed */}
      {isLate(vatData.period) && (
        <PenaltyCard
          daysLate={computation.daysLate}
          fixedPenalty={10_000}
          dailyRate={0.005}
          principal={computation.netPayable}
          totalPenalty={computation.latePenalty}
          statute="NTA 2025 §11(1)"
        />
      )}

      {/* Legal certification */}
      <CertificationCheckbox
        label="I certify that the information provided is true and correct to the best of my knowledge."
        pidginLabel="I swear say everything wey I put here na true true."
        required
      />

      <WizardNavigation
        onBack={() => router.back()}
        onNext={() => router.push('/(tabs)/file/vat/step-5-submit')}
        nextLabel="Submit & Pay →"
        nextVariant="success"
      />
    </WizardStep>
  );
}

// The core VAT computation — pure function, 100% testable
export function computeVATLiability(data: VATFilingData): VATComputation {
  const outputVAT = data.standardSales * 0.075;
  const inputVAT = Math.min(data.purchaseVAT, outputVAT); // Can't claim more than output
  const priorCredit = data.priorPeriodCredit ?? 0;
  const netPayable = Math.max(0, outputVAT - inputVAT - priorCredit);
  const creditCarryForward = Math.max(0, inputVAT + priorCredit - outputVAT);

  const dueDate = getVATDueDate(data.period);
  const daysLate = Math.max(0, differenceInDays(new Date(), dueDate));
  const latePenalty = daysLate > 0
    ? 10_000 + (netPayable * 0.005 * daysLate)
    : 0;

  return {
    outputVAT,
    inputVAT,
    priorCredit,
    netPayable,
    creditCarryForward,
    daysLate,
    latePenalty,
    totalDue: netPayable + latePenalty,
    dueDate: format(dueDate, 'dd MMM yyyy'),
  };
}
```

### 22.3 Reusable Wizard Infrastructure

```typescript
// mobile/src/components/filing/WizardStep.tsx
// The shared wrapper for every step in every filing wizard

interface WizardStepProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSaveDraft?: () => void; // Auto-save on every step
}

export function WizardStep({
  stepNumber, totalSteps, title, subtitle, children, onSaveDraft
}: WizardStepProps) {
  const progress = stepNumber / totalSteps;

  // Auto-save draft every 30 seconds
  useInterval(() => onSaveDraft?.(), 30_000);

  // Save draft on navigation away
  useFocusEffect(useCallback(() => {
    return () => onSaveDraft?.();
  }, [onSaveDraft]));

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      {/* Progress header */}
      <View style={styles.progressHeader}>
        <View style={styles.progressMeta}>
          <Text style={styles.stepLabel}>Step {stepNumber} of {totalSteps}</Text>
          <TouchableOpacity onPress={saveDraft} style={styles.saveDraftBtn}>
            <Text style={styles.saveDraftText}>💾 Save draft</Text>
          </TouchableOpacity>
        </View>
        <ProgressBar progress={progress} animated />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={typography.h2}>{title}</Text>
        {subtitle && <Text style={[typography.bodyMedium, styles.subtitle]}>{subtitle}</Text>}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// mobile/src/components/filing/WizardNavigation.tsx
// Consistent bottom nav for all wizard steps
export function WizardNavigation({
  onBack, onNext, nextLabel = 'Next →', nextVariant = 'primary',
  backLabel = '← Back', disabled = false,
}: WizardNavigationProps) {
  return (
    <View style={styles.navContainer}>
      <TaxBridgeButton
        label={backLabel}
        onPress={onBack}
        variant="ghost"
        size="md"
        style={styles.backBtn}
      />
      <TaxBridgeButton
        label={nextLabel}
        onPress={onNext}
        variant={nextVariant}
        size="md"
        disabled={disabled}
        fullWidth={false}
        style={styles.nextBtn}
        haptic="medium"
      />
    </View>
  );
}
```

---

## 💳 MODULE 23 — EXPENSE RECONCILIATION ENGINE
### *Three-Pass Matching: Auto-Match → Fuzzy → Manual Review*

The reconciliation engine was mentioned in PRODUCTION_READY.md ("3-pass matching") but never fully specified. This is the complete implementation target.

### 23.1 Reconciliation Service

```typescript
// backend/src/services/reconciliation.ts

export type MatchStatus = 'exact' | 'fuzzy' | 'unmatched' | 'manual';

export interface ReconciliationResult {
  bankTransactionId: string;
  matchedExpenseId: string | null;
  matchStatus: MatchStatus;
  confidence: number;       // 0.0 – 1.0
  matchReasons: string[];   // Human-readable: "Amount exact match", "Date ±2 days", etc.
  discrepancy?: {
    field: 'amount' | 'date' | 'vendor';
    bankValue: string;
    expenseValue: string;
    delta: string;
  };
  requiresUserReview: boolean;
}

export class ReconciliationEngine {

  // PASS 1: Exact matching — amount + date + partial vendor name
  async exactMatch(
    bankTxns: BankTransaction[],
    expenses: Expense[]
  ): Promise<Map<string, ReconciliationResult>> {
    const results = new Map<string, ReconciliationResult>();
    const usedExpenseIds = new Set<string>();

    for (const txn of bankTxns) {
      const exactMatch = expenses.find(exp =>
        !usedExpenseIds.has(exp.id) &&
        Math.abs(exp.amount - txn.amount) < 0.01 &&       // Penny-exact amount
        Math.abs(differenceInDays(exp.date, txn.date)) <= 1 && // Same day or +1
        this.vendorSimilarity(exp.vendorName, txn.description) > 0.8
      );

      if (exactMatch) {
        usedExpenseIds.add(exactMatch.id);
        results.set(txn.id, {
          bankTransactionId: txn.id,
          matchedExpenseId: exactMatch.id,
          matchStatus: 'exact',
          confidence: 1.0,
          matchReasons: ['Amount exact', 'Date within 1 day', 'Vendor name match'],
          requiresUserReview: false,
        });
      }
    }
    return results;
  }

  // PASS 2: Fuzzy matching — amount ±2%, date ±3 days, vendor similarity >0.6
  async fuzzyMatch(
    unmatched: BankTransaction[],
    expenses: Expense[],
    usedExpenseIds: Set<string>
  ): Promise<Map<string, ReconciliationResult>> {
    const results = new Map<string, ReconciliationResult>();

    for (const txn of unmatched) {
      // Score every candidate expense
      const candidates = expenses
        .filter(exp => !usedExpenseIds.has(exp.id))
        .map(exp => {
          const amountDelta = Math.abs(exp.amount - txn.amount) / txn.amount;
          const dateDelta = Math.abs(differenceInDays(exp.date, txn.date));
          const vendorSim = this.vendorSimilarity(exp.vendorName, txn.description);

          // Weighted score (amount most important, then date, then vendor)
          const score =
            (1 - Math.min(amountDelta / 0.02, 1)) * 0.5 +   // 50% weight on amount
            (1 - Math.min(dateDelta / 3, 1)) * 0.3 +          // 30% weight on date
            vendorSim * 0.2;                                    // 20% weight on vendor

          return { exp, score, amountDelta, dateDelta, vendorSim };
        })
        .filter(c => c.score > 0.5)
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0) {
        const best = candidates[0];
        usedExpenseIds.add(best.exp.id);

        const reasons: string[] = [];
        if (best.amountDelta < 0.005) reasons.push('Amount exact');
        else reasons.push(`Amount ±${(best.amountDelta * 100).toFixed(1)}%`);
        if (best.dateDelta <= 1) reasons.push('Date within 1 day');
        else reasons.push(`Date ±${best.dateDelta} days`);
        if (best.vendorSim > 0.8) reasons.push('Vendor name match');

        results.set(txn.id, {
          bankTransactionId: txn.id,
          matchedExpenseId: best.exp.id,
          matchStatus: 'fuzzy',
          confidence: best.score,
          matchReasons: reasons,
          requiresUserReview: best.score < 0.8,
          discrepancy: best.amountDelta > 0.005 ? {
            field: 'amount',
            bankValue: formatNaira(txn.amount),
            expenseValue: formatNaira(best.exp.amount),
            delta: `₦${formatNaira(Math.abs(txn.amount - best.exp.amount))}`,
          } : undefined,
        });
      }
    }
    return results;
  }

  // PASS 3: All remaining unmatched → flag for manual review
  markUnmatched(remaining: BankTransaction[]): Map<string, ReconciliationResult> {
    const results = new Map<string, ReconciliationResult>();
    for (const txn of remaining) {
      results.set(txn.id, {
        bankTransactionId: txn.id,
        matchedExpenseId: null,
        matchStatus: 'unmatched',
        confidence: 0,
        matchReasons: ['No expense record found'],
        requiresUserReview: true,
      });
    }
    return results;
  }

  // Vendor name similarity using Levenshtein distance (normalised)
  private vendorSimilarity(a: string, b: string): number {
    const normalize = (s: string) =>
      s.toLowerCase()
        .replace(/\b(limited|ltd|nigeria|plc|nig)\b/g, '') // Strip common suffixes
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1.0;
    if (nb.includes(na) || na.includes(nb)) return 0.9;
    return this.levenshteinSimilarity(na, nb);
  }

  private levenshteinSimilarity(a: string, b: string): number {
    const matrix: number[][] = Array.from({ length: b.length + 1 },
      (_, i) => [i, ...new Array(a.length).fill(0)]);
    matrix[0] = Array.from({ length: a.length + 1 }, (_, i) => i);

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
      }
    }
    const distance = matrix[b.length][a.length];
    return 1 - distance / Math.max(a.length, b.length);
  }
}
```

### 23.2 Reconciliation API Endpoints

```typescript
// backend/src/routes/reconciliation.ts

// POST /api/v1/reconciliation/run
// Triggers full 3-pass reconciliation for a given period
fastify.post('/api/v1/reconciliation/run', {
  preHandler: fastify.authenticate,
}, async (request, reply) => {
  const { period, bankStatementId } = z.object({
    period: z.string().regex(/^\d{4}-\d{2}$/), // e.g. "2026-01"
    bankStatementId: z.string().optional(),
  }).parse(request.body);

  const engine = new ReconciliationEngine();

  // Fetch bank transactions and expenses for the period
  const [bankTxns, expenses] = await Promise.all([
    getBankTransactions(fastify.prisma, request.user.id, period),
    getExpenses(fastify.prisma, request.user.id, period),
  ]);

  // Run all 3 passes
  const exactResults = await engine.exactMatch(bankTxns, expenses);
  const usedIds = new Set([...exactResults.values()]
    .filter(r => r.matchedExpenseId).map(r => r.matchedExpenseId!));

  const unmatched1 = bankTxns.filter(t => !exactResults.has(t.id));
  const fuzzyResults = await engine.fuzzyMatch(unmatched1, expenses, usedIds);

  const unmatched2 = unmatched1.filter(t => !fuzzyResults.has(t.id));
  const unmatchedResults = engine.markUnmatched(unmatched2);

  // Persist results
  const allResults = [
    ...exactResults.values(),
    ...fuzzyResults.values(),
    ...unmatchedResults.values(),
  ];

  await saveReconciliationResults(fastify.prisma, request.user.id, period, allResults);

  const summary = {
    total: allResults.length,
    exact: [...exactResults.values()].length,
    fuzzy: [...fuzzyResults.values()].length,
    unmatched: [...unmatchedResults.values()].length,
    requiresReview: allResults.filter(r => r.requiresUserReview).length,
  };

  return reply.send({ success: true, summary, results: allResults });
});

// GET /api/v1/reconciliation/pending-review
// Returns all fuzzy + unmatched items for user review
fastify.get('/api/v1/reconciliation/pending-review', {
  preHandler: fastify.authenticate,
}, async (request, reply) => {
  const pending = await getPendingReview(fastify.prisma, request.user.id);
  return reply.send({ count: pending.length, items: pending });
});

// POST /api/v1/reconciliation/:id/confirm
// User confirms a fuzzy match or manually links an unmatched transaction
fastify.post('/api/v1/reconciliation/:id/confirm', {
  preHandler: fastify.authenticate,
}, async (request, reply) => {
  const { expenseId } = z.object({ expenseId: z.string() }).parse(request.body);
  await confirmMatch(fastify.prisma, request.params.id, expenseId, request.user.id);
  return reply.send({ success: true });
});
```

### 23.3 Bank Statement Import

```typescript
// backend/src/services/bank-statement-parser.ts
// Parse Nigerian bank statement formats — CSV exports from major banks

// Supported formats (tested against actual statements):
// - GTBank: Date | Narration | Ref | Value Date | Withdrawal | Deposit | Balance
// - First Bank: Transaction Date | Narration | Reference | Debit | Credit | Balance
// - Zenith: Post Date | Val Date | Description | Debit | Credit | Balance
// - UBA: Date | Details | Debit | Credit | Balance
// - Access Bank: Transaction Date | Narration | Debit | Credit | Balance

export const BANK_PARSERS: Record<string, BankStatementParser> = {
  gtbank: {
    detect: (headers: string[]) => headers.includes('Narration') && headers.includes('Ref'),
    parse: (row) => ({
      date: parseDate(row['Date'], 'dd/MM/yyyy'),
      description: row['Narration'],
      reference: row['Ref'],
      debit: parseAmount(row['Withdrawal']),
      credit: parseAmount(row['Deposit']),
    }),
  },
  firstbank: {
    detect: (headers) => headers.includes('Transaction Date') && headers.includes('Reference'),
    parse: (row) => ({
      date: parseDate(row['Transaction Date'], 'yyyy-MM-dd'),
      description: row['Narration'],
      reference: row['Reference'],
      debit: parseAmount(row['Debit']),
      credit: parseAmount(row['Credit']),
    }),
  },
  zenith: {
    detect: (headers) => headers.includes('Post Date') && headers.includes('Val Date'),
    parse: (row) => ({
      date: parseDate(row['Post Date'], 'dd-MMM-yyyy'),
      description: row['Description'],
      reference: '',
      debit: parseAmount(row['Debit']),
      credit: parseAmount(row['Credit']),
    }),
  },
  // ... UBA, Access, Stanbic, FCMB, Sterling
};

export function parseNigerianBankStatement(csvContent: string): BankTransaction[] {
  const rows = parseCsv(csvContent);
  const headers = Object.keys(rows[0] ?? {});

  const parser = Object.values(BANK_PARSERS).find(p => p.detect(headers));
  if (!parser) {
    throw new Error(
      `Unrecognised bank statement format. Supported: ${Object.keys(BANK_PARSERS).join(', ')}`
    );
  }

  return rows
    .map(row => parser.parse(row))
    .filter(txn => txn.debit > 0 || txn.credit > 0) // Skip balance rows
    .map((txn, i) => ({
      ...txn,
      id: `import-${Date.now()}-${i}`,
      amount: txn.debit > 0 ? txn.debit : txn.credit,
      type: txn.debit > 0 ? 'debit' : 'credit',
    }));
}
```

---

## 📱 MODULE 24 — USSD & SMS ACCESSIBILITY CHANNEL
### *"Tax Compliance for Every Phone, Not Just Smartphones"*

Nigeria has 220M mobile subscribers but only ~45M smartphone users. USSD ensures TaxBridge reaches feature-phone users — market vendors, artisans, and rural SMEs — who represent the majority of the informal economy.

### 24.1 USSD Menu Architecture

```typescript
// backend/src/services/ussd.ts
// Africa's Talking USSD integration — confirmed in PRODUCTION_READY.md

// USSD menu tree:
// *347*123# (register shortcode with telcos: MTN, Airtel, GLo, 9mobile)
//
// Main Menu:
//   1. File Tax Return
//   2. Check Deadline
//   3. Calculate Tax
//   4. My Balance
//   5. Get TaxBridge PIN
//
// 1 → File Tax:
//   1. VAT Return (Monthly)
//   2. WHT Remittance
//   3. PAYE Remittance
//   Enter amount or type 0 to go back
//
// 2 → Check Deadline:
//   "Your next VAT return is due 21 Jan 2026
//    Outstanding: ₦45,230
//    To pay, dial *737*# or visit TaxBridge app"
//
// 3 → Calculate:
//   "Enter annual income: _____"
//   → "Your est. PIT = ₦88,000/yr (₦7,333/mo)"
//   → "Reply 1 to get detailed breakdown via SMS"

export interface USSDSession {
  sessionId: string;
  phoneNumber: string;
  text: string;         // Accumulated menu path e.g. "1*3*45000"
  networkCode: string;
}

export interface USSDResponse {
  response: string;
  action: 'CON' | 'END'; // CON = continue (show more menus), END = terminate session
}

export async function handleUSSD(
  session: USSDSession,
  prisma: PrismaClient,
  redis: Redis
): Promise<USSDResponse> {
  const levels = session.text.split('*').filter(Boolean);
  const depth = levels.length;

  // Level 0: Main menu
  if (depth === 0) {
    return {
      action: 'CON',
      response: [
        'Welcome to TaxBridge 🇳🇬',
        '1. File Tax Return',
        '2. Check Next Deadline',
        '3. Calculate My Tax',
        '4. My Account Balance',
        '5. Get Help via SMS',
      ].join('\n'),
    };
  }

  const choice1 = levels[0];

  // Branch: File Tax Return
  if (choice1 === '1') {
    if (depth === 1) {
      return {
        action: 'CON',
        response: 'File which tax?\n1. VAT (Monthly)\n2. WHT Remittance\n3. PAYE Remittance\n0. Back',
      };
    }
    if (depth === 2 && levels[1] === '1') {
      // VAT filing — simplified USSD flow
      return {
        action: 'CON',
        response: 'Enter total sales for this month (₦):\n(Numbers only, no commas)',
      };
    }
    if (depth === 3 && levels[1] === '1') {
      const sales = parseFloat(levels[2]);
      if (isNaN(sales)) {
        return { action: 'END', response: 'Invalid amount. Please try again. *347*123#' };
      }
      const vatPayable = sales * 0.075;
      // Save to DB for later full submission in app
      await saveUSSDDraft(prisma, session.phoneNumber, 'VAT', { sales, vatPayable });
      return {
        action: 'END',
        response: [
          `VAT Estimate:`,
          `Sales: ₦${sales.toLocaleString()}`,
          `VAT Due: ₦${vatPayable.toLocaleString()}`,
          ``,
          `Open TaxBridge app to complete & submit.`,
          `SMS sent with details.`,
        ].join('\n'),
      };
    }
  }

  // Branch: Check Next Deadline
  if (choice1 === '2') {
    const user = await getUserByPhone(prisma, session.phoneNumber);
    if (!user) {
      return {
        action: 'END',
        response: 'Phone not registered. Download TaxBridge app to get started.',
      };
    }
    const deadline = await getNextDeadline(prisma, user.id);
    return {
      action: 'END',
      response: [
        `Next deadline: ${deadline.taxType}`,
        `Due: ${format(deadline.dueDate, 'dd MMM yyyy')}`,
        deadline.estimatedAmount > 0
          ? `Est. amount: ₦${deadline.estimatedAmount.toLocaleString()}`
          : '',
        ``,
        `TaxBridge: taxbridge.ng`,
      ].filter(Boolean).join('\n'),
    };
  }

  // Branch: Calculate Tax (PIT estimator)
  if (choice1 === '3') {
    if (depth === 1) {
      return {
        action: 'CON',
        response: 'Enter your annual income (₦):\n(Numbers only)',
      };
    }
    if (depth === 2) {
      const income = parseFloat(levels[1]);
      if (isNaN(income) || income < 0) {
        return { action: 'END', response: 'Invalid amount. Dial *347*123# to try again.' };
      }
      const pit = computePIT(income);
      const monthly = pit / 12;
      return {
        action: 'CON',
        response: [
          `Income: ₦${income.toLocaleString()}`,
          `Est. Annual PIT: ₦${pit.toLocaleString()}`,
          `Monthly: ₦${Math.round(monthly).toLocaleString()}`,
          ``,
          `1. Get full breakdown via SMS`,
          `2. Main Menu`,
        ].join('\n'),
      };
    }
    if (depth === 3 && levels[2] === '1') {
      const income = parseFloat(levels[1]);
      await sendPITBreakdownSMS(session.phoneNumber, income);
      return { action: 'END', response: 'SMS sent with full PIT breakdown. Check your messages!' };
    }
  }

  return {
    action: 'END',
    response: 'Session expired. Dial *347*123# to start again.',
  };
}
```

### 24.2 SMS Notification Service

```typescript
// backend/src/services/sms.ts
// Africa's Talking + Infobip + Termii — confirmed in PRODUCTION_READY.md

// Failover chain: Africa's Talking → Infobip → Termii
// Same circuit breaker pattern as payment gateways

export class SMSService {
  private providers = [
    new AfricasTalkingProvider(),
    new InfobipProvider(),
    new TermiiProvider(),
  ];

  async send(to: string, message: string, options: SMSOptions = {}): Promise<SMSResult> {
    // Normalize Nigerian phone numbers to E.164 format
    const normalized = normalizeNigerianPhone(to); // 08012345678 → +2348012345678

    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      try {
        const result = await provider.send(normalized, message);
        await this.logSMS(normalized, message, result, provider.name);
        return result;
      } catch (err) {
        provider.recordFailure();
        continue;
      }
    }
    throw new Error('All SMS providers unavailable');
  }

  // Pre-built message templates — NTA 2025 compliant, bilingual
  async sendDeadlineReminder(phone: string, data: DeadlineReminderData) {
    const message = data.language === 'pidgin'
      ? `TaxBridge: ${data.taxType} due date dey ${data.daysUntil} days (${data.dueDate}). Amount: ₦${data.estimatedAmount}. Open app make you file. Tax na must!`
      : `TaxBridge: Your ${data.taxType} return is due in ${data.daysUntil} days (${data.dueDate}). Est. amount: ₦${data.estimatedAmount}. Open TaxBridge to file.`;

    return this.send(phone, message.slice(0, 160)); // SMS 160-char limit
  }

  async sendIRNConfirmation(phone: string, data: IRNConfirmationData) {
    const message = `TaxBridge: Invoice #${data.invoiceNumber} stamped by NRS. IRN: ${data.irn}. Customer: ${data.customerName}. Amount: ₦${data.amount}.`;
    return this.send(phone, message.slice(0, 160));
  }

  async sendPITBreakdown(phone: string, income: number) {
    const pit = computePIT(income);
    const bands = getPITBands(income);
    // Send multi-part SMS (up to 3 parts for detailed breakdown)
    const parts = [
      `TaxBridge PIT Breakdown for ₦${income.toLocaleString()} income:`,
      bands.map(b => `${b.rate}% on ₦${b.amount.toLocaleString()} = ₦${b.tax.toLocaleString()}`).join(' | '),
      `Total PIT: ₦${pit.toLocaleString()} | Monthly: ₦${Math.round(pit/12).toLocaleString()} | TaxBridge: taxbridge.ng`,
    ];
    for (const part of parts) {
      await this.send(phone, part);
      await sleep(500); // Avoid rate limiting
    }
  }
}

// Nigerian phone number normalisation
function normalizeNigerianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) return `+${digits}`;
  if (digits.startsWith('0'))   return `+234${digits.slice(1)}`;
  if (digits.length === 10)     return `+234${digits}`;
  throw new Error(`Invalid Nigerian phone number: ${phone}`);
}
```

---

## 👥 MODULE 25 — PAYROLL & PAYE COMPLETE IMPLEMENTATION
### *For SMEs with employees — the most complex and highest-stakes compliance requirement*

PAYE is the #1 source of tax audits for Nigerian SMEs. Getting it wrong exposes the employer, not just the employee.

### 25.1 Payroll Data Model

```typescript
// packages/contracts/src/payroll.ts

export interface Employee {
  id: string;
  userId: string;          // Business owner
  fullName: string;
  tin?: string;            // Employee TIN (required for remittance)
  stateOfResidence: NigerianState; // PAYE remitted to state of residence
  taxAuthority: string;    // LIRS, SIRS, KIRS, etc.
  
  // Compensation structure
  basicSalary: number;
  housing: number;         // Housing allowance
  transport: number;       // Transport allowance
  medical: number;         // Medical allowance
  otherAllowances: number;
  
  // Deductions
  pensionRate: number;     // Default 8% employee, 10% employer (PRA 2014)
  nhfRate: number;         // National Housing Fund: 2.5%
  
  employmentType: 'full-time' | 'part-time' | 'contract';
  startDate: string;
  active: boolean;
}

// NTA 2025 §33 — Consolidated Relief Allowance
// CRA = ₦200,000 + 20% of gross income
// Pension (employee portion, 8%) is deductible
// NHF (2.5%) is deductible
// NHIS contributions are deductible

export function computeEmployeePAYE(employee: Employee): PAYEComputation {
  const grossIncome = employee.basicSalary
    + employee.housing
    + employee.transport
    + employee.medical
    + employee.otherAllowances;

  // Step 1: Compute statutory deductions
  const pensionEmployee = grossIncome * employee.pensionRate;   // 8% default
  const nhf             = employee.basicSalary * employee.nhfRate; // 2.5% of basic only
  const totalDeductions = pensionEmployee + nhf;

  // Step 2: Compute Consolidated Relief Allowance (NTA 2025 §33)
  const cra = Math.max(200_000, grossIncome * 0.20) + 200_000;
  // Note: CRA = Higher of ₦200,000 OR 1% gross, PLUS 20% of gross
  // NTA 2025 updated: flat ₦200,000 + 20% of gross

  // Step 3: Taxable Income
  const taxableIncome = Math.max(0, grossIncome - totalDeductions - cra);

  // Step 4: Apply PIT bands (NTA 2025)
  const annualPIT = computePIT(taxableIncome);
  const monthlyPIT = annualPIT / 12;

  // Step 5: Employer contributions
  const pensionEmployer = grossIncome * 0.10; // 10% employer

  return {
    grossIncome,
    pensionEmployee,
    pensionEmployer,
    nhf,
    cra,
    taxableIncome,
    annualPIT,
    monthlyPIT,
    netPay: grossIncome - pensionEmployee - nhf - monthlyPIT,
    employerCost: grossIncome + pensionEmployer,
    effectiveRate: taxableIncome > 0 ? annualPIT / grossIncome : 0,
  };
}
```

### 25.2 Monthly Payroll Run

```typescript
// backend/src/services/payroll.ts

export async function runMonthlyPayroll(
  userId: string,
  period: string, // "2026-01"
  prisma: any,
  bullmq: Queue
): Promise<PayrollRunResult> {
  // Fetch all active employees
  const employees: Employee[] = await prisma.employee.findMany({
    where: { userId, active: true },
  });

  if (employees.length === 0) {
    throw new Error('No active employees found');
  }

  // Compute PAYE for each employee
  const computations = employees.map(emp => ({
    employee: emp,
    paye: computeEmployeePAYE(emp),
  }));

  // Aggregate PAYE by state (each state's tax authority is different)
  const byState = computations.reduce<Record<string, PAYEByState>>((acc, { employee, paye }) => {
    const state = employee.stateOfResidence;
    if (!acc[state]) {
      acc[state] = {
        state,
        authority: employee.taxAuthority,
        employees: [],
        totalPAYE: 0,
      };
    }
    acc[state].employees.push({ employee, paye });
    acc[state].totalPAYE += paye.monthlyPIT;
    return acc;
  }, {});

  // Save payroll run to DB
  const payrollRun: any = await prisma.payrollRun.create({
    data: {
      userId,
      period,
      employeeCount: employees.length,
      totalGross: computations.reduce((s, c) => s + c.paye.grossIncome, 0),
      totalPAYE: computations.reduce((s, c) => s + c.paye.monthlyPIT, 0),
      totalNetPay: computations.reduce((s, c) => s + c.paye.netPay, 0),
      totalPension: computations.reduce((s, c) => s + c.paye.pensionEmployee + c.paye.pensionEmployer, 0),
      status: 'computed',
      details: computations as any,
    },
  });

  // Queue PAYE remittance jobs (one per state authority)
  for (const stateData of Object.values(byState)) {
    await bullmq.add('payroll-paye-remittance', {
      payrollRunId: payrollRun.id,
      userId,
      period,
      stateData,
    }, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5_000 },
    });
  }

  return {
    runId: payrollRun.id,
    employeeCount: employees.length,
    totalGross: payrollRun.totalGross,
    totalPAYE: payrollRun.totalPAYE,
    totalNetPay: payrollRun.totalNetPay,
    byState: Object.values(byState),
    dueDate: getPAYEDueDate(period), // 10th of following month
  };
}
```

### 25.3 Payroll Mobile Screen

```typescript
// mobile/src/screens/PayrollScreen.tsx
// Monthly payroll run — the SME employer's workflow

export default function PayrollScreen() {
  const { data: employees } = useEmployees();
  const { runPayroll, isRunning } = usePayrollRun();
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth());

  return (
    <ScrollView style={styles.container}>
      <Text style={typography.h2}>Payroll & PAYE</Text>

      {/* Period selector */}
      <MonthPicker value={selectedPeriod} onChange={setSelectedPeriod} />

      {/* Employee roster summary */}
      <Card elevation="md">
        <Text style={typography.h4}>{employees?.length ?? 0} Active Employees</Text>
        <EmployeeRosterMini employees={employees?.slice(0, 3)} />
        {employees?.length > 3 && (
          <TouchableOpacity onPress={() => router.push('/employees')}>
            <Text style={styles.viewAllLink}>View all {employees.length} employees →</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* PAYE computation preview */}
      <PAYEComputationPreview period={selectedPeriod} employees={employees} />

      {/* PAYE due date reminder */}
      <InfoBox type="warning" icon="📅">
        PAYE must be remitted by the 10th of {getFollowingMonth(selectedPeriod)}.
        Late remittance: 10% penalty + 21% interest per annum.
      </InfoBox>

      {/* Run payroll button */}
      <TaxBridgeButton
        label={isRunning ? 'Running Payroll...' : `Run ${formatMonth(selectedPeriod)} Payroll`}
        onPress={() => runPayroll(selectedPeriod)}
        variant="primary"
        size="xl"
        fullWidth
        loading={isRunning}
        haptic="heavy"
      />

      {/* Payroll history */}
      <Section title="Payroll History">
        <PayrollHistoryList />
      </Section>
    </ScrollView>
  );
}
```

---

## 🗄️ MODULE 26 — DOCUMENT VAULT
### *"Every Tax Document, One Secure Place"*

Nigerian tax compliance requires retaining documents for 5 years (NTA 2025 §67). TaxBridge becomes the trusted document custodian.

### 26.1 Document Vault Architecture

```typescript
// Document categories supported by the vault
export type DocumentCategory =
  | 'tax_return'          // Filed returns (VAT, PIT, CIT, PAYE, WHT)
  | 'payment_receipt'     // Proof of tax payment
  | 'invoice'             // Sales invoices (NRS-stamped)
  | 'expense_receipt'     // Purchase receipts (OCR-processed)
  | 'bank_statement'      // Monthly bank statements
  | 'tin_certificate'     // TIN certificate from JTB
  | 'cac_document'        // CAC registration documents
  | 'tax_clearance'       // Tax Clearance Certificate
  | 'audit_report'        // External audit reports
  | 'payroll_schedule'    // Monthly payroll records
  | 'contract'            // Business contracts (WHT applicable)
  | 'other';              // Catch-all

export interface VaultDocument {
  id: string;
  userId: string;
  category: DocumentCategory;
  name: string;              // User-facing name
  fileName: string;          // Original file name
  mimeType: string;
  sizeBytes: number;
  url: string;               // Encrypted storage URL (S3/R2)
  thumbnailUrl?: string;     // For PDFs and images
  tags: string[];            // User-defined tags
  taxPeriod?: string;        // "2025-Q4", "2026-01", "2025" etc.
  expiresAt?: string;        // For tax clearance certs (auto-remind before expiry)
  retentionUntil: string;    // 5 years from document date (NTA 2025 §67)
  encrypted: boolean;        // AES-256-GCM encrypted at rest
  checksum: string;          // SHA-256 for integrity verification
  uploadedAt: string;
  metadata: Record<string, any>; // Extracted metadata (IRN for invoices, etc.)
}

// Retention policy — computed at upload time
export function computeRetentionDate(
  category: DocumentCategory,
  documentDate: Date
): Date {
  const retentionYears: Record<DocumentCategory, number> = {
    tax_return:      6,  // 5yr statutory + 1yr buffer (NTA 2025 §67)
    payment_receipt: 6,
    invoice:         6,
    expense_receipt: 6,
    bank_statement:  7,  // Banks require 7yr retention
    tin_certificate: 50, // Effectively forever
    cac_document:    50,
    tax_clearance:   3,  // Replaced annually
    audit_report:    7,
    payroll_schedule:6,
    contract:        6,
    other:           5,
  };
  return addYears(documentDate, retentionYears[category]);
}
```

### 26.2 Document Vault API

```typescript
// backend/src/routes/vault.ts

// POST /api/v1/vault/upload
// Secure document upload with server-side encryption
fastify.post('/api/v1/vault/upload', {
  preHandler: [fastify.authenticate, fastify.rateLimit({ max: 20, timeWindow: '1 hour' })],
}, async (request, reply) => {
  const data = await request.file({ limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB limit
  if (!data) return reply.code(400).send({ error: 'No file uploaded' });

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(data.mimetype)) {
    return reply.code(415).send({ error: 'Only PDF and images are accepted' });
  }

  // Read and encrypt file content
  const buffer = await data.toBuffer();
  const { encrypted, iv, authTag } = encryptAES256GCM(buffer, process.env.ENCRYPTION_KEY!);

  // Upload to R2/S3 with server-side encryption
  const storageKey = `vault/${request.user.id}/${generateId()}/${data.filename}`;
  const url = await uploadToStorage(storageKey, encrypted, data.mimetype);

  // Compute checksum on original
  const checksum = createHash('sha256').update(buffer).digest('hex');

  // Extract metadata based on file type
  let metadata: Record<string, any> = {};
  if (data.mimetype === 'application/pdf') {
    // Extract text from PDF for search indexing
    metadata = await extractPDFMetadata(buffer);
  } else if (data.mimetype.startsWith('image/')) {
    // Run OCR on receipt images
    metadata = await runQuickOCR(buffer);
  }

  const { category, name, taxPeriod, tags } = VaultUploadSchema.parse(request.body);
  const retentionUntil = computeRetentionDate(category, new Date());

  const doc: any = await fastify.prisma.vaultDocument.create({
    data: {
      userId: request.user.id,
      category,
      name,
      fileName: data.filename,
      mimeType: data.mimetype,
      sizeBytes: buffer.length,
      storageKey,
      url, // Signed URL generated at access time, not stored
      tags: tags ?? [],
      taxPeriod: taxPeriod ?? null,
      retentionUntil: retentionUntil.toISOString(),
      encrypted: true,
      checksum,
      metadata: metadata as any,
      iv,
      authTag,
    },
  });

  return reply.code(201).send({
    success: true,
    documentId: doc.id,
    name: doc.name,
    retentionUntil: doc.retentionUntil,
  });
});

// GET /api/v1/vault/:id/download
// Returns a time-limited signed URL (never exposes raw storage URL)
fastify.get('/api/v1/vault/:id/download', {
  preHandler: fastify.authenticate,
}, async (request, reply) => {
  const doc: any = await fastify.prisma.vaultDocument.findFirst({
    where: { id: request.params.id, userId: request.user.id },
  });
  if (!doc) return reply.code(404).send({ error: 'Document not found' });

  // Generate signed URL valid for 5 minutes
  const signedUrl = await generateSignedUrl(doc.storageKey, { expiresIn: 300 });

  // Audit log: document accessed
  await logAuditEvent(fastify.prisma, {
    userId: request.user.id,
    action: 'VAULT_DOCUMENT_ACCESSED',
    resourceId: doc.id,
    ip: request.ip,
  });

  return reply.send({ url: signedUrl, expiresAt: addMinutes(new Date(), 5) });
});
```

### 26.3 Vault Mobile Screen

```typescript
// mobile/src/screens/VaultScreen.tsx
export default function VaultScreen() {
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: documents, isLoading } = useVaultDocuments({ category, searchQuery });

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <SearchBar
        placeholder="Search documents..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        icon="🔍"
      />

      {/* Category filter horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {DOCUMENT_CATEGORIES.map(cat => (
          <FilterChip
            key={cat.key}
            label={cat.label}
            icon={cat.icon}
            active={category === cat.key}
            onPress={() => setCategory(cat.key)}
          />
        ))}
      </ScrollView>

      {/* Storage usage indicator */}
      <StorageUsageBar used={documents?.totalSizeBytes} limit={5 * 1024 * 1024 * 1024} />

      {/* Document list */}
      {isLoading ? (
        <DocumentListSkeleton count={5} />
      ) : (
        <FlashList
          data={documents?.items}
          renderItem={({ item }) => (
            <DocumentCard
              document={item}
              onPress={() => openDocument(item)}
              onLongPress={() => showDocumentActions(item)}
            />
          )}
          estimatedItemSize={72}
          ListEmptyComponent={<VaultEmptyState category={category} />}
        />
      )}

      {/* Upload FAB */}
      <FloatingActionButton
        icon="+"
        label="Upload Document"
        onPress={() => router.push('/vault/upload')}
      />
    </View>
  );
}
```

---

## 👤 MODULE 27 — MULTI-USER & TEAM ACCOUNTS
### *For accountants, bookkeepers, and business partners sharing a TaxBridge account*

### 27.1 Role System

```typescript
// packages/contracts/src/roles.ts

export type TeamRole =
  | 'owner'        // Full access, billing control, can delete account
  | 'admin'        // Full access except billing and account deletion
  | 'accountant'   // Full access to filings, expenses, invoices — no billing
  | 'bookkeeper'   // Create/edit expenses and invoices — no filing or billing
  | 'viewer';      // Read-only access to all data

export const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: ['*'],
  admin: ['invoices.*', 'expenses.*', 'filing.*', 'payroll.*', 'vault.*', 'settings.*', 'team.*'],
  accountant: ['invoices.*', 'expenses.*', 'filing.*', 'payroll.*', 'vault.*'],
  bookkeeper: ['invoices.create', 'invoices.edit', 'expenses.create', 'expenses.edit', 'vault.upload'],
  viewer: ['invoices.read', 'expenses.read', 'filing.read', 'payroll.read', 'vault.read'],
};

export function hasPermission(role: TeamRole, action: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms.includes('*')) return true;
  if (perms.includes(action)) return true;
  // Check wildcard namespace: 'invoices.*' matches 'invoices.create'
  const namespace = action.split('.')[0];
  return perms.includes(`${namespace}.*`);
}
```

### 27.2 Team Invitation Flow

```typescript
// backend/src/routes/team.ts

// POST /api/v1/team/invite
fastify.post('/api/v1/team/invite', {
  preHandler: [fastify.authenticate, requirePermission('team.invite')],
}, async (request, reply) => {
  const { email, role, message } = TeamInviteSchema.parse(request.body);

  // Check if already a team member
  const existing: any = await fastify.prisma.teamMember.findFirst({
    where: { businessId: request.user.businessId, email },
  });
  if (existing) {
    return reply.code(409).send({ error: 'This email is already a team member' });
  }

  // Generate secure invitation token
  const token = generateSecureToken(32);
  const expiresAt = addDays(new Date(), 7);

  await fastify.prisma.teamInvitation.create({
    data: {
      businessId: request.user.businessId,
      email,
      role,
      token,
      expiresAt,
      invitedBy: request.user.id,
      message: message ?? null,
    },
  });

  // Send invitation email
  await sendTeamInvitationEmail({
    to: email,
    businessName: request.user.businessName,
    inviterName: request.user.fullName,
    role,
    message,
    acceptUrl: `https://app.taxbridge.ng/team/accept?token=${token}`,
    expiresAt,
  });

  return reply.code(201).send({
    success: true,
    message: `Invitation sent to ${email}. Link expires in 7 days.`,
  });
});
```

---

## 📈 MODULE 28 — REFERRAL & GROWTH ENGINE
### *Structured Growth: SME-to-SME Viral Loop*

Nigeria's SME economy runs on trust networks — market associations, church groups, alumni networks. The referral engine is designed for this social context.

### 28.1 Referral System

```typescript
// backend/src/services/referral.ts

// Referral tiers — progressive rewards for sustained referrals
export const REFERRAL_TIERS = [
  {
    id: 'starter',
    name: 'Tax Ambassador',
    pidginName: 'Tax Rep',
    minReferrals: 1,
    rewardPerReferral: { type: 'discount', value: 0.10, duration: 'monthly' },
    description: '10% off your monthly plan for each active referral',
  },
  {
    id: 'pro',
    name: 'Tax Champion',
    pidginName: 'Tax Champion',
    minReferrals: 5,
    rewardPerReferral: { type: 'discount', value: 0.20, duration: 'monthly' },
    bonus: { type: 'free_months', value: 1 },
    description: '20% off + 1 free month when you reach 5 referrals',
  },
  {
    id: 'elite',
    name: 'TaxBridge Partner',
    pidginName: 'TaxBridge Partner',
    minReferrals: 10,
    rewardPerReferral: { type: 'revenue_share', value: 0.15 }, // 15% revenue share!
    description: '15% revenue share on all referred accounts (paid monthly)',
  },
] as const;

// Referral tracking
export async function trackReferral(
  referralCode: string,
  newUserId: string,
  prisma: any
): Promise<void> {
  const referrer: any = await prisma.user.findFirst({
    where: { referralCode },
  });
  if (!referrer) return;

  await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      referredUserId: newUserId,
      status: 'pending', // Becomes 'active' when referred user pays first month
    },
  });

  // Notify referrer
  await sendPushNotification(referrer.id, {
    title: '🎉 New Referral!',
    body: 'Someone just joined TaxBridge using your referral code!',
    category: 'referral',
  });
}

// Shareable referral content — Nigerian-context copy
export function generateReferralShareContent(
  user: User,
  language: 'en' | 'pidgin'
): { text: string; url: string; whatsapp: string } {
  const url = `https://app.taxbridge.ng/join?ref=${user.referralCode}`;

  const text = language === 'pidgin'
    ? `Omo! I dey use TaxBridge for my business taxes and e dey do the work well well. No more wahala with PAYE, VAT, and invoice. Join with my link and get 1 month free: ${url}`
    : `I've been using TaxBridge to handle my Nigerian taxes (VAT, PAYE, invoices) and it's been a game-changer for my SME. Join with my referral link and get your first month free: ${url}`;

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return { text, url, whatsapp };
}
```

---

## 📦 MODULE 29 — DATA EXPORT & AUDIT PACKAGE
### *"Your Data, Your Rights" — NDPC-Compliant Export*

### 29.1 Full Data Export

```typescript
// backend/src/services/data-export.ts
// Generates a complete, portable export of all user data
// Required by NDPC 2023 (Nigeria's data protection framework)

export async function generateUserDataExport(
  userId: string,
  prisma: any
): Promise<DataExportPackage> {

  // Gather all user data in parallel
  const [
    profile, invoices, expenses, payroll,
    taxReturns, vaultDocuments, auditLog,
    anomalies, syncHistory,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.expense.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.payrollRun.findMany({ where: { userId }, orderBy: { period: 'desc' } }),
    prisma.taxReturn.findMany({ where: { userId } }),
    prisma.vaultDocument.findMany({ where: { userId } }),
    prisma.auditLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 1000 }),
    prisma.anomalyRecord.findMany({ where: { userId } }),
    prisma.syncEvent.findMany({ where: { userId }, take: 100 }),
  ]);

  // Sanitize sensitive encrypted fields for export
  const sanitizedProfile = {
    ...profile,
    tin: profile?.tin ? '[ENCRYPTED — decrypt with your TaxBridge account]' : null,
    bvn: profile?.bvn ? '[REDACTED — BVN not included in export for security]' : null,
    password: '[NOT INCLUDED]',
  };

  // Build export package
  const exportPackage: DataExportPackage = {
    metadata: {
      exportedAt: new Date().toISOString(),
      userId,
      exportVersion: '1.0',
      dataRetentionPolicy: 'Documents retained for 5-6 years per NTA 2025 §67',
      ndpcReference: 'NDPC 2023 §30 — Right to Data Portability',
    },
    profile: sanitizedProfile,
    businessData: {
      invoices: invoices.length,
      expenses: expenses.length,
      payrollRuns: payroll.length,
      taxReturnsFiled: taxReturns.length,
      vaultDocuments: vaultDocuments.length,
    },
    invoices,
    expenses,
    payrollHistory: payroll,
    taxReturns,
    vaultDocumentsList: vaultDocuments.map(d => ({
      id: d.id,
      name: d.name,
      category: d.category,
      uploadedAt: d.uploadedAt,
      sizeBytes: d.sizeBytes,
      note: 'Download via TaxBridge app or contact support@taxbridge.ng',
    })),
    auditLog: auditLog.slice(0, 200), // Last 200 events
    systemData: {
      anomaliesDetected: anomalies.length,
      syncEvents: syncHistory.length,
    },
  };

  return exportPackage;
}

// Generate PDF audit report for accountants / tax auditors
export async function generateAuditPDF(
  userId: string,
  period: string,
  prisma: any
): Promise<Buffer> {
  const data = await getAuditData(userId, period, prisma);

  return generatePDF({
    template: 'audit-report',
    data: {
      businessName: data.businessName,
      tin: data.tin,
      period,
      summary: {
        totalRevenue: data.totalRevenue,
        totalExpenses: data.totalExpenses,
        vatCollected: data.vatCollected,
        vatPaid: data.vatPaid,
        netVAT: data.netVAT,
        pitLiability: data.pitLiability,
        payeRemitted: data.payeRemitted,
      },
      invoices: data.invoices,
      expenses: data.expenses,
      nrsSubmissions: data.nrsSubmissions,
      certificationStatement: 'Generated by TaxBridge — NTA 2025 compliant tax management platform',
      generatedAt: new Date().toISOString(),
    },
  });
}
```

---

## 🚀 MODULE 30 — GO-TO-MARKET OPERATIONAL RUNBOOK
### *The Last Mile: From "Deployed" to "Growing"*

### 30.1 Launch Day Operations Protocol

```markdown
# TAXBRIDGE LAUNCH DAY RUNBOOK
# Date: [Set by team] | Coordinator: On-call engineer + Growth lead

## T-48 HOURS
[ ] Verify all environment variables in Render and Vercel (run validate-production-readiness.ps1)
[ ] Run full backend test suite: 423+ passing
[ ] Smoke test all 6 tax calculators with known-correct inputs
[ ] Test payment flow end-to-end: Paystack → invoice → NRS submission → IRN receipt
[ ] Test USSD flow: *347*123# → deadline check → SMS confirmation
[ ] Load test with 100 concurrent users (k6 or Artillery)
[ ] Verify Sentry DSN configured and receiving test events
[ ] Confirm Prometheus alerts routing to correct Slack channels
[ ] Brief support team on top 10 expected user questions (FAQ doc)
[ ] Stage app store listings (Google Play + Apple App Store)

## T-24 HOURS
[ ] Database backup: pg_dump → verify restoration works
[ ] Redis snapshot: confirm persistence mode is AOF (not RDB)
[ ] Announce maintenance window (if any): 11pm–1am
[ ] DLQ depth check: must be 0 before launch
[ ] Pre-warm Render instance (send health check requests every 30s)
[ ] Activate EAS Update channel for mobile (OTA patches ready)

## T-0: LAUNCH
[ ] Post in team Slack: "🚀 TaxBridge is live"
[ ] Monitor error rate: must stay < 1% for first 30 minutes
[ ] Watch NRS submission queue: must not exceed 50 pending
[ ] Confirm first 10 real user registrations in DB
[ ] Confirm first real invoice with IRN stamp (proof the full chain works)

## T+2 HOURS
[ ] Review: any P0/P1 errors in Sentry?
[ ] Check: Payment gateway success rates > 95%?
[ ] Check: OCR queue processed, no stuck jobs
[ ] Check: USSD endpoint responding to test call
[ ] Update stakeholders: first 2-hour metrics report

## ROLLBACK TRIGGERS (Go to rollback if any of these):
[ ] Error rate > 5% sustained for 5 minutes
[ ] NRS submission failure rate > 20%
[ ] Any database connection failures
[ ] Any payment double-charge reports
[ ] Any data breach indicators in audit logs
```

### 30.2 Customer Success Playbook

```markdown
# FIRST 30 DAYS USER SUCCESS PROTOCOL

## Day 0: Welcome (Automated)
- Push notification: "Welcome to TaxBridge! Complete your profile to see your tax picture."
- SMS: "Welcome to TaxBridge. Your tax compliance starts here. Need help? Reply HELP."
- In-app: Onboarding wizard triggered automatically

## Day 1: First Value (Automated)
- If user hasn't completed onboarding: reminder push + SMS
- If onboarding complete: "📊 Your Tax Health Score is ready. Tap to see it."

## Day 3: Engagement (Automated)
- If no invoice created: "Create your first NRS-compliant invoice in 2 minutes →"
- If invoice created: "🎉 Invoice created! Submit to NRS for your IRN stamp →"

## Day 7: Retention Check (Human + Automated)
- If user not logged in for 3+ days: "We noticed you haven't filed yet.
  Your next VAT deadline is in X days. Need help? WhatsApp: +234..."
- WhatsApp support agent: reach out proactively to first 100 users

## Day 14: Upsell Trigger (Automated)
- If user has > 5 invoices and 0 payroll runs: "Did you know TaxBridge handles PAYE too?
  Save hours every month. Tap to add your employees."

## Day 30: Review Request (Automated)
- iOS/Android: Native review prompt (using expo-store-review)
- Push: "You've been using TaxBridge for 30 days! We'd love your feedback. Rate us ⭐⭐⭐⭐⭐"
```

### 30.3 Support Escalation Matrix

```typescript
// admin-dashboard/src/data/support-matrix.ts
// Used by the support team to resolve user issues quickly

export const SUPPORT_ESCALATION_MATRIX = [
  {
    issue: 'NRS submission failing / IRN not received',
    tier: 1,
    steps: [
      'Check /health/queues for queue depth',
      'Check /api/v1/nrs/health for circuit breaker state',
      'If circuit open: DIGITAX_MOCK_MODE=true as temporary measure',
      'Admin: NRS Operations Center → Failed Submissions → Retry All',
    ],
    escalateTo: 'Backend engineer if unresolved in 30min',
  },
  {
    issue: 'User cannot pay — payment gateway error',
    tier: 1,
    steps: [
      'Check circuit breaker state for all 3 gateways',
      'Ask user to retry (triggers auto-failover to next gateway)',
      'If all gateways open: check Render environment for expired API keys',
    ],
    escalateTo: 'Lead engineer + payment provider support line',
  },
  {
    issue: 'Raw i18n keys showing on screen (e.g. COMMON.OFFLINE)',
    tier: 1,
    steps: [
      'Confirm which device (Android/iOS) and version number',
      'Check if reproducible offline',
      'If offline: BUG-S03 may have regressed — check CHANGELOG',
      'Hotfix via EAS Update (OTA — no store submission needed)',
    ],
    escalateTo: 'Mobile engineer — OTA patch within 2h',
  },
  {
    issue: 'Tax calculation seems wrong',
    tier: 2,
    steps: [
      'Ask for: tax type, income amount, business type, period',
      'Verify against NTA2025_RULES in packages/contracts',
      'Run the specific calculator via API: POST /api/v1/tax/calculate',
      'If confirmed wrong: critical — escalate immediately',
    ],
    escalateTo: 'Tax compliance lead + Engineering — P0 if calculation error confirmed',
  },
  {
    issue: 'User wants to delete their data',
    tier: 1,
    steps: [
      'Verify identity (ask for registered email + TIN)',
      'Admin: User Detail → Support Actions → initiate NDPC deletion',
      'Confirm retention obligations: tax records kept 5yr per NTA 2025 §67',
      'Process deletion of personal data, anonymize financial records',
      'Send NDPC deletion confirmation email within 30 days',
    ],
    escalateTo: 'Legal/Compliance if user contests retention policy',
  },
];
```

---

## 🔁 MODULE 31 — COMPLETE CHANGELOG ENTRY FOR V3.0.0

When all modules are implemented, add this entry to `CHANGELOG.md`:

```markdown
## [3.0.0] - 2026-Q1 - "The Complete Platform" 🏆

### 💎 Major New Features

#### Tax Filing Wizard (Module 22)
- Complete guided filing wizards for: VAT, PIT, CIT, PAYE, WHT, CGT
- Auto-populate sales figures from existing TaxBridge invoices
- Real-time computation preview at every step
- Draft auto-save every 30 seconds (never lose progress)
- Late penalty calculator with statute references (NTA 2025)
- Legal certification checkbox with bilingual copy (EN + Pidgin)

#### Expense Reconciliation Engine (Module 23)
- 3-pass matching: Exact → Fuzzy → Manual review
- Levenshtein vendor name similarity with Nigerian suffix normalisation
- Bank statement import: GTBank, First Bank, Zenith, UBA, Access
- Confidence scoring with human-readable match reasons
- Admin review queue for unmatched transactions

#### USSD & SMS Channel (Module 24)
- *347*123# USSD shortcode for feature phones
- VAT estimate, deadline check, PIT calculator over USSD
- SMS notification templates: EN + Pidgin, 160-char compliant
- Africa's Talking → Infobip → Termii SMS failover chain
- Nigerian phone number normalisation (all formats → E.164)

#### Payroll & PAYE (Module 25)
- Complete employee payroll management
- NTA 2025 §33 CRA computation (₦200,000 + 20% of gross)
- Pension (8% employee / 10% employer) + NHF (2.5%) deductions
- Multi-state PAYE remittance (LIRS, SIRS, KIRS, etc.)
- Payslip generation with full statutory breakdown
- PAYE due date tracking (10th of following month)

#### Document Vault (Module 26)
- AES-256-GCM encrypted document storage
- 12 document categories (tax returns, receipts, TIN, CAC, etc.)
- NTA 2025 §67 retention policy auto-computed at upload
- SHA-256 integrity verification
- Time-limited signed download URLs (5-minute expiry)
- NDPC-compliant access audit log

#### Multi-User Team Accounts (Module 27)
- 5 roles: owner, admin, accountant, bookkeeper, viewer
- Email invitation workflow with 7-day expiry tokens
- Granular permission system (namespace.action format)
- Full audit trail of team member actions

#### Referral & Growth Engine (Module 28)
- 3-tier referral program: Ambassador → Champion → Partner
- Revenue share tier (15%) for top referrers
- Nigeria-context share copy (WhatsApp-optimised)
- Pidgin referral messages for viral sharing

#### Data Export & Audit Package (Module 29)
- NDPC 2023 §30 compliant full data export
- PDF audit report for accountants/tax auditors
- Sanitized export (BVN redacted, TIN noted as encrypted)
- 200-event audit log included

### 🎓 Education System (Module 14)
- TaxAcademy with 12 structured lessons (3 min to 10 min reads)
- Interactive calculators embedded in lessons (VAT threshold, PIT estimator)
- 40-term tax glossary with EN + Pidgin definitions
- Quiz system with XP rewards (5 questions per lesson)
- Learning streaks and 8 achievement badges
- Lesson of the Day feature

### ✨ UX/Design System (Modules 15-16)
- Unified design token system (tokens.ts)
- TaxBridgeButton: Reanimated spring press + haptics + a11y
- NairaInput: Live comma formatting + screen reader support
- Card component system with elevation and accent variants
- Typography scale using system fonts (eliminates font-loading offline bug)
- "First Tax Insight" in < 60 seconds of completing onboarding

### 🖥️ Admin Power Features (Module 17)
- User detail command center with support action panel
- Accountant portal: multi-client dashboard with urgency ranking
- Real-time system monitor: infrastructure + queues + integrations
- Bulk actions: retry NRS, regenerate reports, clear OCR queue

### 🔔 Notification System (Module 19)
- 9 notification categories with EN + Pidgin templates
- In-app notification inbox with category filtering
- Adaptive reminder cadence based on historical on-time rate

### 🌍 West Africa Foundation (Module 18)
- Country configuration system (NG active, GH/KE/SN stubbed)
- Country-aware currency formatting (₦/GH₵/KSh/CFA)
- Compact number format: ₦1.5M, ₦250K

### 🚀 Operations (Module 30)
- Full launch day runbook (T-48h to T+2h)
- 30-day customer success protocol
- Support escalation matrix for top 5 issue categories
- NDPC data deletion procedure

### 📊 Metrics (v3.0.0 targets)
- Backend tests: ≥ 480 (up from 423)
- Tax engine coverage: ≥ 98.5%
- Mobile tests: ≥ 200 (up from 139)
- i18n keys: ≥ 1,400 (up from 1,080)
- API endpoints: ≥ 80 (up from 60)
- Mobile screens: ≥ 22 (up from 15)
- Document vault capacity: 25MB per document, 5GB per account
```

---

*"Built for Nigerian SMEs. Compliant with NTA 2025. Powered by AI. Loved by users. Ready for West Africa."*

**TaxBridge V8.0 Master Prompt — COMPLETE**

| Part | Focus | Modules | Lines |
|------|-------|---------|-------|
| I | Strategy, Architecture, Phases 0–7 | — | ~500 |
| II | Implementation Execution Layer | 1–13 | ~1,200 |
| III | Screenshot Debug (first 3) | — | ~400 |
| IV | Forensic Live Audit (5 screenshots) | — | ~1,100 |
| V | Premium Product: Education, Visual, Admin | 14–21 | ~1,800 |
| VI | Core Completion: Filing, Payroll, Vault, Growth, Ops | 22–31 | ~1,600 |
| **Total** | | **31 modules** | **~6,600 lines** |

**Coverage:** 5 live production screenshots · CHANGELOG v2.0.0 · PRODUCTION_READY v1.0.2 · DEPLOYMENT_v1.0.3 · V7 master prompt · Full product brief · 7 forensically confirmed bugs · 30-item stack-ranked backlog · 20-day execution plan · Complete go-to-market runbook

*Last updated: February 20, 2026*
