# TAXBRIDGE AI OPERATING SYSTEM
## Implementation-Ready Engineering Document
**Classification:** Engineering Execution Authority | **Version:** 1.0.0
**Repository:** github.com/Scardubu/taxbridge | **Date:** 2026-02-20
**Audience:** AI coding agents, senior engineers, technical leads

---

## EXECUTIVE SUMMARY

The TaxBridge Master Prompt V8 (7,629 lines, ~32,000 words) is too large to inject as a
single AI context unit. This document architects it into an **AI Operating System (AIOS)**:
8 injectable context modules, a TypeScript loader, a RAG embedding pipeline, and a phased
execution plan — all living in `/prompts` inside the TaxBridge repository.

**Outcome:** Any AI coding agent can receive precisely the right context for any task,
consuming 800–3,000 tokens instead of 32,000, while retaining full access to all
knowledge via RAG query.

---

## PART 1 — STRATEGIC BLUEPRINT

### 1.1 System Vision

TaxBridge is a Nigerian-first, offline-resilient, AI-augmented tax compliance platform.
It embeds compliance into daily business operations rather than treating tax as a
separate year-end event. The platform serves SMEs, sole proprietors, accountants, and
enterprises across Nigeria, with a foundation for West Africa expansion.

**North Star Metric:** Time-to-first-compliance-action < 5 minutes from install.

### 1.2 Core Objectives (Ranked by Business Impact)

```
1. Zero tax filing errors          → 100% NTA 2025 calculation accuracy
2. NRS submission ≥ 97% success    → Real-time IRN stamp monitoring
3. Offline-first reliability        → 100% core features in airplane mode
4. First value < 60 seconds        → Tax insight before onboarding exits
5. Bilingual compliance            → English + Nigerian Pidgin throughout
6. West Africa readiness           → Country config system (NG live, GH/KE stubbed)
```

### 1.3 Governance Rules (Engineering Law)

```
RULE-01  Offline first, sync second. No feature may block on network.
RULE-02  NRS terminology is canonical. Zero FIRS references anywhere.
RULE-03  Prisma types are `any`. Never restore Prisma.XxxWhereInput namespace.
RULE-04  423+ backend tests pass before any commit merges.
RULE-05  Tax calculations live only in packages/contracts. Never inline.
RULE-06  Graceful degradation over hard failures at every integration point.
RULE-07  Bilingual or bust. Missing translations are bugs, not tech debt.
RULE-08  Secrets in environment variables only. Validated at startup.
```

### 1.4 Compliance Alignment Map

```
NTA 2025         → packages/contracts/src/tax-engine/
NRS 2026         → backend/src/services/nrs-submission.ts
NDPC 2023        → backend/src/middleware/encryption.ts + routes/vault.ts
Payment regs     → backend/src/services/payments/ (Paystack + Flutterwave + Remita)
USSD regulation  → backend/src/routes/ussd.ts (*347*123# shortcode)
```

### 1.5 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                     │
│  Mobile (Expo SDK 54)  │  Admin (Next.js 15)  │  USSD *347*123#  │
└──────────────┬─────────────────┬──────────────────────┬──────────┘
               │                 │                      │
               ▼                 ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│  API GATEWAY — Fastify 5 + JWT + Rate Limiting (Render.com)       │
├────────────┬────────────┬────────────┬───────────────────────────┤
│ Tax Engine │ AI Layer   │ Compliance │ Communication              │
│ /tax/*     │ /insights/*│ /nrs/*     │ /sms/* /ussd/*            │
│ /file/*    │ /anomalies*│ /vault/*   │ /notifications/*          │
├────────────┴────────────┴────────────┴───────────────────────────┤
│  SERVICES — anomaly-detection, ocr-enhanced, compliance-calendar  │
│  QUEUES   — 6 BullMQ queues + DLQ per queue                      │
│  PAYMENTS — Paystack → Flutterwave → Remita (circuit breaker)     │
├───────────────────────────┬──────────────────────────────────────┤
│  PostgreSQL + Prisma 5.22  │  Redis 7 (queues + cache)            │
├───────────────────────────┴──────────────────────────────────────┤
│  EXTERNAL — DigiTax/NRS │ Youverify │ Google Vision │ Africa's    │
│            Talking │ Infobip │ Paystack │ Flutterwave │ Sentry     │
└──────────────────────────────────────────────────────────────────┘

  /prompts/ (AI Operating Context — THIS SYSTEM)
  ├─ M00 always injected (identity + rules)
  ├─ M01–M07 injected per task type
  └─ RAG index for complex/cross-cutting queries
```

### 1.6 Monetization Strategy

```
Free     ₦0/mo    3 invoices, basic PIT, USSD, TaxAcademy read
Starter  ₦2,500   Unlimited invoices, 50 OCR, VAT wizard, 2 team members
Pro      ₦7,500   Unlimited OCR, payroll, vault 5GB, AI anomaly, 5 team
Enterprise ₦25,000 Multi-entity, accountant portal, revenue-share referral

Referral tiers: Ambassador (10% discount) → Champion (20% + 1 free month) →
Partner (15% revenue share on referred accounts)
```

### 1.7 Scalability Roadmap

```
v3.0 (Now)    Nigeria only, 10k users, EAS + Render + Vercel
v3.5 (Q3'26)  Multi-entity, accountant portal GA, 50k users
v4.0 (Q4'26)  Ghana activation (GH config), 5k GH users
v4.5 (Q1'27)  Kenya activation, M-Pesa payments, 15k KE users
v5.0 (Q2'27)  Enterprise SaaS, AWS ECS migration, multi-tenant
```

---

## PART 2 — MODULAR CONTEXT LIBRARY

### 2.1 Module Inventory

Each module is a standalone markdown file in `/prompts/`. M00 is always injected.
All others are task-specific.

```
┌──────┬─────────────────────────────────────┬────────┬─────────────────────────────┐
│ ID   │ Module Name                         │ Tokens │ Inject For                  │
├──────┼─────────────────────────────────────┼────────┼─────────────────────────────┤
│ M00  │ Core Identity & System Rules        │   800  │ ALWAYS — every session      │
│ M01  │ Backend Architecture                │ 1,200  │ API, services, queues       │
│ M02  │ Mobile UX/UI                        │ 1,100  │ React Native, Expo, i18n   │
│ M03  │ AI Intelligence Layer               │ 1,000  │ OCR, anomaly, health score  │
│ M04  │ Payments & Compliance               │   900  │ Paystack, NRS, USSD, SMS   │
│ M05  │ Data Layer & Tax Engine             │ 1,000  │ Tax calcs, DB schema        │
│ M06  │ Deployment & DevOps                 │   800  │ CI/CD, Render, EAS          │
│ M07  │ Monetization & Analytics            │   700  │ Billing, referrals, events  │
├──────┼─────────────────────────────────────┼────────┼─────────────────────────────┤
│      │ TOTAL (all modules)                 │ 7,500  │ vs. 32,000 original (76%↓)  │
└──────┴─────────────────────────────────────┴────────┴─────────────────────────────┘
```

### 2.2 Module Definitions

#### M00 — Core Identity & System Rules
- **Purpose:** Establishes AI agent identity, absolute constraints, known landmines, production endpoints, and pre-commit checklist. Injected in every session to ensure no fundamental rule is ever violated.
- **Scope:** Applies to entire codebase — not layer-specific.
- **Inputs:** None (static reference).
- **Outputs:** AI agent behavioral constraints.
- **Token strategy:** Kept at ≤ 800 tokens. If it grows beyond 1,000, audit and compress.

#### M01 — Backend Architecture
- **Purpose:** API conventions, service directory map, BullMQ queue configuration, payment failover, health endpoint requirements, NRS submission rules.
- **Scope:** `backend/` directory only.
- **Inputs:** Task involves an API endpoint, background job, or service integration.
- **Outputs:** Correct Fastify route structure, service implementation patterns.
- **Token strategy:** Heavy on directory maps (scannable, low token density). Implementation examples kept concise.

#### M02 — Mobile UX/UI
- **Purpose:** Confirmed bugs with exact fix instructions, navigation structure, i18n initialization pattern, theme tokens, component standards, offline pattern, EAS build rules.
- **Scope:** `mobile/` directory.
- **Inputs:** Task involves React Native screen, component, or i18n.
- **Outputs:** Correct Expo/React Native patterns, bug-aware implementations.
- **Token strategy:** Bug fixes listed first (highest leverage). Code examples kept to critical patterns only.

#### M03 — AI Intelligence Layer
- **Purpose:** OCR decision tree, 13 expense categories, anomaly detection 9-signal spec with severity matrix, Tax Health Score 5-component model, compliance calendar deadlines and penalties.
- **Scope:** `backend/src/services/anomaly-detection.ts`, `ocr-enhanced.ts`, `tax-health-score.ts`, `compliance-calendar.ts`.
- **Inputs:** Task involves OCR, anomaly detection, or health scoring.
- **Outputs:** Correct signal implementations, category classifiers, scoring formulas.
- **Token strategy:** Tables for severity matrix and category list (dense, scannable). Prose avoided.

#### M04 — Payments & Compliance
- **Purpose:** Payment gateway circuit breaker architecture, NRS e-invoicing flow, Youverify integration, SMS provider failover, USSD menu tree.
- **Scope:** `backend/src/services/payments/`, `nrs-submission.ts`, `sms.ts`, `routes/ussd.ts`.
- **Inputs:** Task involves payment processing, NRS submission, or communication channels.
- **Outputs:** Correct failover logic, NRS idempotency patterns, USSD response formatting.
- **Token strategy:** Flow diagrams over prose. Environment variable lists dense but necessary.

#### M05 — Data Layer & Tax Engine
- **Purpose:** NTA 2025 tax calculation rules (PIT bands, VAT rate, CIT tiers, PAYE formulas), Prisma schema key models, migration rules, mobile SQLite patterns, country config system.
- **Scope:** `packages/contracts/`, PostgreSQL schema, `mobile/` SQLite.
- **Inputs:** Task involves tax calculations, database changes, or country expansion.
- **Outputs:** Correct tax formulas with statute citations, safe migration patterns.
- **Token strategy:** Tax tables use exact numbers (critical accuracy). Migration rules short and imperative.

#### M06 — Deployment & DevOps
- **Purpose:** CI pipeline (4 jobs), environment variables, Prometheus metrics + alert thresholds, Render cold-start handling, EAS build checklist, rollback triggers.
- **Scope:** `.github/workflows/`, `scripts/`, Render, Vercel, EAS CLI.
- **Inputs:** Task involves CI, deployment, monitoring, or build configuration.
- **Outputs:** Correct GitHub Actions steps, monitoring configuration, deploy sequences.
- **Token strategy:** CI steps as bash (copy-paste ready). Alert thresholds as table.

#### M07 — Monetization & Analytics
- **Purpose:** Subscription tier definitions and limits, referral program tiers and rewards, analytics event taxonomy, admin analytics panels.
- **Scope:** `backend/src/services/referral.ts`, `routes/billing.ts`, analytics instrumentation.
- **Inputs:** Task involves billing, referrals, or event tracking.
- **Outputs:** Correct tier gating logic, referral state machine, event schemas.
- **Token strategy:** Tiers as tables. Event list as dense table (name + required properties only).

### 2.3 Task → Module Mapping

```typescript
// prompts/loaders/prompt-loader.ts

const TASK_MODULE_MAP = {
  'backend-api':        ['M00', 'M01'],
  'backend-queue':      ['M00', 'M01'],
  'backend-tax-calc':   ['M00', 'M01', 'M05'],
  'mobile-ui':          ['M00', 'M02'],
  'mobile-i18n':        ['M00', 'M02'],
  'mobile-offline':     ['M00', 'M02'],
  'ai-ocr':             ['M00', 'M01', 'M03'],
  'ai-anomaly':         ['M00', 'M01', 'M03', 'M05'],
  'payment-integration':['M00', 'M01', 'M04'],
  'nrs-filing':         ['M00', 'M01', 'M04', 'M05'],
  'devops-ci':          ['M00', 'M06'],
  'devops-deploy':      ['M00', 'M06'],
  'analytics-growth':   ['M00', 'M07'],
  'db-schema':          ['M00', 'M01', 'M05'],
  'full-stack':         ['M00', 'M01', 'M02', 'M03', 'M04', 'M05', 'M06'],
};
// Max tokens for full-stack: 7,500 (76% reduction from 32,000 original)
// Max tokens for single-task: 2,000 (94% reduction)
```

---

## PART 3 — CODEBASE IMPLEMENTATION STRATEGY

### 3.1 Repository Structure

```
taxbridge/                          ← Existing repo root
├─ backend/                         ← Existing (Fastify + Prisma)
├─ mobile/                          ← Existing (Expo SDK 54)
├─ admin-dashboard/                 ← Existing (Next.js 15)
├─ packages/contracts/              ← Existing (shared types + tax engine)
├─ ml/ocr_service/                  ← Existing (Python OCR)
├─ scripts/                         ← Existing (PowerShell validation)
├─ infra/                           ← Existing (Docker compose)
└─ prompts/                         ← NEW — AI Operating Context System
   ├─ MASTER_PROMPT.md              ← Entry point for AI agents
   ├─ STRATEGIC_BLUEPRINT.md        ← Vision + architecture authority doc
   ├─ package.json                  ← Loader dependencies + scripts
   ├─ tsconfig.json                 ← TypeScript config for loaders
   ├─ .gitignore                    ← Excludes embeddings/index.json
   ├─ core/
   │   └─ M00-identity-rules.md
   ├─ backend/
   │   └─ M01-backend-architecture.md
   ├─ mobile/
   │   └─ M02-mobile-ux.md
   ├─ ai/
   │   └─ M03-ai-intelligence.md
   ├─ payments/
   │   └─ M04-payments-compliance.md
   ├─ data/
   │   └─ M05-data-tax-engine.md
   ├─ devops/
   │   └─ M06-deployment-devops.md
   ├─ monetization/
   │   └─ M07-monetization-analytics.md
   ├─ loaders/
   │   ├─ prompt-loader.ts          ← Static module injection
   │   └─ embedding-pipeline.ts     ← RAG build + query
   └─ embeddings/
       └─ index.json                ← Generated (git-optional)
```

### 3.2 Setup Commands

```bash
# 1. Create the directory structure
mkdir -p prompts/{core,backend,mobile,ai,payments,data,devops,monetization,loaders,embeddings}

# 2. Copy module files (from this deliverable package)
# cp all M00-M07 .md files to their respective directories

# 3. Initialize the prompts package
cd prompts && npm install

# 4. Build embeddings index (first time — takes 5-10 minutes)
npm run prompts:build

# 5. Verify all modules indexed
npm run prompts:verify
# Expected output: "All modules indexed ✓"

# 6. Test loading for a specific task
npm run prompts:load backend-api
# Expected: M00 + M01 concatenated context output

# 7. Test RAG query
npm run prompts:query "how do I implement the NRS circuit breaker"
# Expected: Relevant chunks from M01 + M04

# 8. Commit
git add prompts/
git commit -m "feat(prompts): initialize TaxBridge AI operating context system"
```

### 3.3 Context Injection Strategy

#### For AI Coding Agents (Claude, Cursor, Copilot, GPT-4)

```typescript
// In your AI workflow / agent harness:
import { loadContextForTask, getRAGContext } from './prompts/loaders/prompt-loader';

// Pattern 1: Task-based injection (recommended for known task types)
const context = await loadContextForTask('ai-anomaly');
const systemPrompt = context.text;
// → Injects M00 + M01 + M03 + M05 (~4,000 tokens)

// Pattern 2: RAG-based injection (recommended for complex/cross-cutting queries)
const context = await getRAGContext(
  'implement the PAYE computation with CRA deduction per NTA 2025 §33',
  4000 // token budget
);
// → Returns top-5 most relevant chunks across all modules

// Pattern 3: Manual selection (when you know exactly what's needed)
const context = await loadContext(['M00', 'M04'], { includeModuleHeaders: true });

// Inject as system prompt:
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: context.text,
  messages: [{ role: 'user', content: userRequest }],
  max_tokens: 8000,
});
```

#### For Cursor IDE

```json
// .cursor/rules — Cursor project rules file
// Add to your Cursor rules to auto-inject M00 on every session:
// (Paste contents of prompts/core/M00-identity-rules.md here)
```

#### For GitHub Copilot

```markdown
<!-- .github/copilot-instructions.md -->
<!-- Paste M00 contents here for Copilot workspace context -->
```

### 3.4 Versioning Approach

```
Module versioning: Each module has a header:
  **Version:** X.Y | **Last updated:** YYYY-MM-DD

Version increment rules:
  Patch (X.Y → X.Y+1): Content correction or addition within existing structure
  Minor (X.Y → X+1.0):  New section added or significant restructure

Git tagging for prompt releases:
  git tag prompts-v3.0.0  (aligns with app version)
  git tag prompts-v3.1.0  (prompt-only update)

Embedding index rebuild required after any module change:
  npm run prompts:build  (run in CI if index is committed)
```

---

## PART 4 — SCALABILITY & OPTIMIZATION

### 4.1 Evolution: Static → RAG

```
PHASE A (Now): Static module loading
  ├─ loadContextForTask('backend-api') → concatenates M00 + M01
  ├─ Token usage: 800–7,500 per session
  └─ No infrastructure required beyond Node.js

PHASE B (v3.5): Chunk-level RAG
  ├─ buildEmbeddingsIndex() splits modules into ~300-token chunks
  ├─ queryContext(userQuery) → returns top-K relevant chunks
  ├─ Token usage: 800–2,500 per session (M00 always + top-K results)
  └─ Infrastructure: local @xenova/transformers (no API cost)

PHASE C (v4.0): External vector DB
  ├─ Migrate index.json to Pinecone or pgvector (PostgreSQL extension)
  ├─ Enable persistent, multi-user context management
  ├─ Add: conversation history embedding for context continuity
  └─ Add: feedback loop (thumbs up/down on AI suggestions → rerank)
```

### 4.2 Token Efficiency Plan

```
Current V8 master prompt:   32,000 words / ~128,000 tokens (GPT-4 estimate)
After modularization:
  Typical single-task:      800–2,000 tokens (M00 + 1 module)     = 98.5% reduction
  Typical multi-task:       2,000–4,000 tokens (M00 + 2-3 modules) = 97% reduction
  Full-stack (all modules): ~7,500 tokens                          = 94% reduction
  RAG query (top-5 chunks): ~2,500 tokens                         = 98% reduction

Optimization rules:
  1. Never inject BLUEPRINT in a coding session (design reference only)
  2. M00 is 800 tokens — do not let it grow above 1,000
  3. Each module: tables > prose, code > explanation
  4. Remove examples once pattern is established (DRY principle for prompts)
  5. Quarterly audit: remove any module content that hasn't been referenced
```

### 4.3 Context Ranking Algorithm

```typescript
// In queryContext() — current ranking approach:
// 1. Cosine similarity against all-MiniLM-L6-v2 embeddings
// 2. M00 always scores 1.0 (injected regardless of query)
// 3. Top-K from remaining chunks (default K=5)
// 4. Token budget enforced: stop adding chunks when budget exceeded

// Future enhancement (Phase C): Re-ranking with cross-encoder
// install: npm install @xenova/transformers
// model:   cross-encoder/ms-marco-MiniLM-L-6-v2
// Apply after initial retrieval to re-score top-20 → take top-5
```

---

## PART 5 — EXECUTION FRAMEWORK

### Phase 1: Structural Refactor

**Duration:** Days 1–2
**Goal:** Zero confirmed bugs, zero broken tests, /prompts initialized

```
Completion criteria:
  □ npm test (backend): 423+ passing, 0 failures
  □ npx tsc --noEmit (all layers): 0 errors
  □ grep "FIRS" (all source files): 0 results
  □ grep "NRSt" (all i18n files): 0 results
  □ Offline onboarding: 0 raw i18n keys visible
  □ Bottom nav icons: visible when app starts offline
  □ /prompts directory: created, all module files in place
  □ npm run prompts:verify: "All modules indexed ✓"
  □ Commit: "fix: resolve 4 P0 production bugs + initialize prompt system"
```

### Phase 2: Context Modularization

**Duration:** Days 3–4
**Goal:** Full prompt system operational and integrated into developer workflow

```
Completion criteria:
  □ npm run prompts:load mobile-ui: outputs M00 + M02 (≤2,300 tokens)
  □ npm run prompts:load full-stack: outputs all 8 modules (≤7,500 tokens)
  □ npm run prompts:query "anomaly detection": returns M03 chunks
  □ npm run prompts:build: completes without errors, index.json created
  □ .cursor/rules or equivalent: M00 content injected for IDE
  □ Team documentation: README in /prompts explains the system
  □ Commit: "feat(prompts): AI operating context system operational"
```

### Phase 3: AI Integration

**Duration:** Days 5–14
**Goal:** All P1 features implemented using the modular context system

```
Completion criteria:
  □ VAT filing wizard: full 5-step flow → NRS IRN stamp received in staging
  □ PIT filing wizard: computation matches hand-calculation per NTA 2025
  □ Payroll/PAYE: CRA formula (₦200k + 20% gross) verified with boundary test
  □ Anomaly detection: all 9 signals return AnomalyResult[] with EN + Pidgin explanation
  □ OCR pipeline: Sharp enhance → Vision → Tesseract → 13-category classifier
  □ Tax Health Score: daily compute, persisted in TaxHealthSnapshot, shown on dashboard
  □ Document vault: upload → AES-256-GCM encrypt → 5yr retention date computed
  □ Reconciliation: 3-pass engine returns exact/fuzzy/unmatched results
  □ For each feature: loadContextForTask() used before implementation
  □ After each feature: npm test must not regress
```

### Phase 4: Production Hardening

**Duration:** Days 15–20
**Goal:** All metrics meet v3.0.0 targets, system deployed and monitored

```
Completion criteria:
  □ Backend tests:         ≥ 480 passing
  □ Tax engine coverage:   ≥ 98.5%
  □ Mobile tests:          ≥ 200 passing
  □ i18n keys:             ≥ 1,400 (EN + Pidgin)
  □ API P95:               < 350ms (100 concurrent users)
  □ NRS success rate:      > 97% over 24-hour staging window
  □ Mobile crash rate:     < 0.1% (Sentry, 48-hour post-deploy)
  □ Payment success:       > 98% across all 3 gateways tested
  □ Admin cold-start:      All 3 health routes return 200 on first request
  □ All v2.0.0 features:  Working (regression checklist signed off)
  □ CHANGELOG.md:          v3.0.0 entry complete
  □ PRODUCTION_READY.md:   All metrics updated
  □ Prompt system:         npm run prompts:verify green after all changes
  □ Deployed:              Render + Vercel + EAS all showing green
```

---

## DELIVERABLES SUMMARY

```
Files created in this engineering document package:

prompts/
├─ MASTER_PROMPT.md              ← Concise entry-point for AI agents
├─ STRATEGIC_BLUEPRINT.md        ← Vision, architecture, governance
├─ TAXBRIDGE_AI_OS.md            ← This document (engineering authority)
├─ package.json                  ← prompts:load, prompts:build, prompts:verify scripts
├─ .gitignore                    ← Excludes embeddings/index.json
├─ core/M00-identity-rules.md    ← Always-inject rules (800 tokens)
├─ backend/M01-*.md              ← Backend context (1,200 tokens)
├─ mobile/M02-*.md               ← Mobile context (1,100 tokens)
├─ ai/M03-*.md                   ← AI layer context (1,000 tokens)
├─ payments/M04-*.md             ← Payments context (900 tokens)
├─ data/M05-*.md                 ← Data/tax engine (1,000 tokens)
├─ devops/M06-*.md               ← DevOps context (800 tokens)
├─ monetization/M07-*.md         ← Monetization context (700 tokens)
└─ loaders/
   ├─ prompt-loader.ts           ← Static loader + task mapping
   └─ embedding-pipeline.ts      ← RAG build + cosine query

Total: 12 files | Static: 94% token reduction | RAG: 98% token reduction
```

---

*TaxBridge AI Operating System — Engineering Document*
*Authored: February 20, 2026 | Valid for: v3.0.0 development cycle*
*Review: Quarterly or when any architectural constraint changes*
