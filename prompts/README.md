# TaxBridge AI Operating Context System

**Location in repo:** `taxbridge/prompts/`
**Purpose:** Modular prompt library that gives AI coding agents precise, token-efficient
context for working on the TaxBridge codebase.

---

## The Problem This Solves

The TaxBridge Master Prompt V8 is 7,629 lines and ~128,000 tokens. No AI model can
ingest it as a single context window, and doing so would be wasteful even if they could —
an engineer fixing an i18n bug doesn't need payment gateway circuit breaker documentation.

This system decomposes V8 into **8 focused modules** (800–1,200 tokens each) that load
in ~2 seconds, give the AI exactly what it needs, and nothing more.

---

## Quick Start

```bash
cd prompts

# Install dependencies (one-time)
npm install

# Test the loader system
npx ts-node loaders/prompt-loader.test.ts

# Load context for a specific task type
npm run prompts:load backend-api      # API endpoint work → M00 + M01
npm run prompts:load mobile-ui        # React Native work → M00 + M02
npm run prompts:load ai-anomaly       # AI/ML work → M00 + M01 + M03 + M05
npm run prompts:load nrs-filing       # NRS/compliance → M00 + M01 + M04 + M05
npm run prompts:load full-stack       # All modules

# Build RAG embedding index (enables semantic search across modules)
npm run prompts:build

# Query semantically (after build)
npm run prompts:query "how to implement PAYE with CRA deduction"
npm run prompts:query "NRS submission circuit breaker"
npm run prompts:query "offline i18n raw key fix"

# Validate all modules
npm run prompts:verify
npm run prompts:lint
```

---

## Module Map

| Module | File | Token Budget | Use For |
|--------|------|-------------|---------|
| **M00** | `core/M00-identity-rules.md` | 800 | **Always inject** — rules, constraints, endpoints |
| M01 | `backend/M01-backend-architecture.md` | 1,200 | API routes, services, queues, health endpoints |
| M02 | `mobile/M02-mobile-ux.md` | 1,100 | React Native, Expo, i18n, confirmed bugs, EAS |
| M03 | `ai/M03-ai-intelligence.md` | 1,000 | OCR pipeline, anomaly detection, health score |
| M04 | `payments/M04-payments-compliance.md` | 900 | Paystack, NRS e-invoicing, USSD, SMS |
| M05 | `data/M05-data-tax-engine.md` | 1,000 | NTA 2025 tax rules, Prisma schema, country config |
| M06 | `devops/M06-deployment-devops.md` | 800 | CI/CD, Render deploy, EAS builds, monitoring |
| M07 | `monetization/M07-monetization-analytics.md` | 700 | Billing tiers, referrals, analytics events |

---

## Task → Module Mapping

```
backend-api          → M00, M01
backend-queue        → M00, M01
backend-tax-calc     → M00, M01, M05
mobile-ui            → M00, M02
mobile-i18n          → M00, M02
mobile-offline       → M00, M02
ai-ocr               → M00, M01, M03
ai-anomaly           → M00, M01, M03, M05
payment-integration  → M00, M01, M04
nrs-filing           → M00, M01, M04, M05
devops-ci            → M00, M06
devops-deploy        → M00, M06
analytics-growth     → M00, M07
db-schema            → M00, M01, M05
full-stack           → M00–M07 (all)
```

---

## Integrating with AI Tools

### Claude / Claude.ai
Copy the output of `npm run prompts:load <task>` into the system prompt of your
Claude conversation before asking implementation questions.

### Cursor IDE
Add M00 content to `.cursor/rules` in the repo root. This injects the core system
rules into every Cursor session automatically.

### GitHub Copilot
Add M00 content to `.github/copilot-instructions.md` for workspace-level context.

### Custom Agent Harness (TypeScript)
```typescript
import { loadContextForTask } from './prompts/loaders/prompt-loader';

const ctx = await loadContextForTask('ai-anomaly');

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: ctx.text,
  messages: [{ role: 'user', content: 'Implement the phantom_vendor anomaly signal' }],
  max_tokens: 8000,
});
```

### RAG-Based Retrieval (Semantic Search)
```typescript
import { getRAGContext } from './prompts/loaders/embedding-pipeline';

// Must run `npm run prompts:build` first to create embeddings/index.json
const ctx = await getRAGContext(
  'implement PAYE computation with pension and NHF deductions',
  3000 // token budget
);
// Returns M00 + top-5 most semantically relevant chunks
```

---

## Updating Modules

When a production constraint changes (new API, new tax rule, bug discovery):

1. Edit the relevant module file (`core/M00*.md`, `backend/M01*.md`, etc.)
2. Run `npm run prompts:lint` — must pass before committing
3. Run `npm run prompts:build` — rebuild embedding index
4. Run `npx ts-node loaders/prompt-loader.test.ts` — integration tests must pass
5. Commit: `docs(prompts): update M01 — new BullMQ queue configuration`

**Versioning:** Each module has a `**Version:**` header. Increment the minor version
for content changes. Tag the repo: `git tag prompts-v3.x.0`.

---

## File Structure

```
prompts/
├─ README.md                      ← You are here
├─ MASTER_PROMPT.md               ← Concise entry-point for AI agents
├─ STRATEGIC_BLUEPRINT.md         ← System vision + architecture reference
├─ TAXBRIDGE_AI_OS.md             ← Full engineering document (5 parts)
├─ package.json                   ← npm scripts for loader system
├─ tsconfig.json                  ← TypeScript config for loaders
├─ .gitignore                     ← Excludes embeddings/index.json
├─ core/
│   └─ M00-identity-rules.md      ← Always inject (800 tokens)
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
│   ├─ prompt-loader.ts           ← Static module loader + task mapping
│   ├─ prompt-loader.test.ts      ← Integration tests (41 assertions)
│   ├─ embedding-pipeline.ts      ← RAG: build index + cosine query
│   └─ prompt-linter.js           ← Module validation (10 check categories)
└─ embeddings/
    ├─ README.md                  ← Schema documentation
    └─ index.json                 ← Generated (git-ignored, rebuild with npm run prompts:build)
```

---

## Token Efficiency

```
Original V8 Master Prompt:    ~128,000 tokens (unloadable as single context)
After modularization:
  Single-task context:        800–2,000 tokens  → 98.5% reduction
  Multi-task context:         2,000–4,000 tokens → 97% reduction
  Full-stack (all modules):   ~7,500 tokens      → 94% reduction
  RAG query (top-5 chunks):   ~2,500 tokens      → 98% reduction
```

---

## CI Integration

The GitHub Actions workflow at `.github/workflows/prompts-ci.yml` runs on every
PR that touches `prompts/**` and validates:
- All 8 module files exist and load correctly
- Required sections present in each module
- No forbidden strings (FIRS, NRSt, COMMON.*) in any module
- Token budgets not exceeded
- Integration tests pass (41 assertions)
- Token budget report published to GitHub Actions summary

---

*TaxBridge AI Operating Context System*
*v3.0.0 | February 2026 | github.com/Scardubu/taxbridge*
