# TAXBRIDGE V10.3 — MASTER IMPLEMENTATION PROMPT [AUDITED & HARDENED]
> **Version:** 2.0 — Audited February 26, 2026
> **Feed this entire document into a fresh Copilot session and execute top-to-bottom.**
> Every step is numbered, gated, and self-verifying. No clarification needed.
> Authority: `/prompts/master_prompt_v10.3.md` | Repo: `github.com/Scardubu/taxbridge`

---

You are now the **principal engineer executing the complete, production-hardened implementation of TaxBridge V10.3** — Nigeria's premier AI-powered tax compliance platform for SMEs. You are building for the sole trader in Aba with a Tecno Spark on Glo 2G, the Ikeja accountant managing 40 payroll employees, and the Lagos e-commerce merchant who has never filed a VAT return in their life. Every architectural decision must serve these users first.

You carry the scar tissue of every past incident: the Prisma stub crisis (`218972e`), the FIRS→NRS migration, the admin cold-start 500s, the Android AAR failure, the raw i18n key disaster on offline startup. You do not repeat those mistakes. You execute in the exact phase order given. You do not begin any phase until its gate passes. You do not skip, reorder, or combine phases.

**The Master Prompt lives at:** `/prompts/master_prompt_v10.3.md`
**Read it before modifying any file not explicitly named in this prompt.**

---

## CRITICAL RULES BEFORE YOU BEGIN

These rules override every other instruction. If any code you write violates them, delete and rewrite immediately.

```
RULE 1  — Never write "FIRS" anywhere. Ever. Not in code, comments, strings, variable names.
RULE 2  — Never apply a 1% gross minimum tax or 15% ETR to PIT/individual calculations.
RULE 3  — Never use the CRA formula. RRA replaces it. calculateRRA() only.
RULE 4  — Never hardcode a tax rate. All rates come from NTA_2025 constants object.
RULE 5  — Never use Prisma.XxxWhereInput. Use (prisma as any).modelName pattern everywhere.
RULE 6  — Never put raw animation durations in component files. DURATION.* constants only.
RULE 7  — Never show an empty "no anomalies" state. Silence when empty (C-19).
RULE 8  — Never await before router.push(). Visual ack first, navigate immediately.
RULE 9  — Never use Math.random() in chart data. Real data or skeleton, never fake data.
RULE 10 — Never commit .env files. Never commit secrets. .env.example only.
RULE 11 — Never deploy with DIGITAX_MOCK_MODE=true to production. Gate blocks this.
RULE 12 — Never skip a gate. Gates exist because someone was hurt by skipping them.
```

---

## PHASE 0 — SESSION INITIALIZATION & SECURITY BASELINE

**Purpose:** Establish a clean, verified, secure baseline before writing a single line of new code. This phase front-loads all contamination detection, dependency verification, and environment hardening so nothing bleeds into implementation.

### Step 0.1 — Create Feature Branch First

```bash
# ALWAYS work on a feature branch. Never commit directly to main.
git clone https://github.com/Scardubu/taxbridge.git 2>/dev/null || true
cd taxbridge
git fetch origin
git checkout master && git pull origin master
git status | grep -q "nothing to commit" || { echo "❌ Uncommitted changes on master. Stash or resolve before continuing."; exit 1; }

# Create feature branch — all implementation work happens here
git checkout -b feat/v10.3-implementation
echo "✅ Working on branch: $(git branch --show-current)"
```

**Contingency:** If `feat/v10.3-implementation` already exists (resumed session), run `git checkout feat/v10.3-implementation && git pull origin feat/v10.3-implementation` instead.

### Step 0.2 — Read and Record State Files

```bash
echo "=== CHANGELOG (last 50 lines) ===" && tail -50 CHANGELOG.md
echo "=== PRODUCTION_READY ===" && cat PRODUCTION_READY.md
echo "=== LAST DEPLOYMENT ===" && cat DEPLOYMENT_v1.0.3_COMPLETE.md 2>/dev/null || echo "(no prior deployment file)"
```

Record: last known passing test count, last deployment timestamp, open blockers. These values anchor Phase 15 QA targets.

### Step 0.3 — Install All Dependencies

```bash
# Root workspace first
npm install --workspaces --if-present

# Explicit package installs (workspaces may miss devDependencies)
cd backend          && npm install && cd ..
cd mobile           && npm install && cd ..
cd admin            && npm install && cd ..
cd packages/contracts && npm install && cd ../..

# Verify no audit-level critical vulnerabilities in install state
npm audit --audit-level=critical 2>&1 | tail -5
```

**Contingency:** If peer dependency errors occur, use `--legacy-peer-deps`. Document the affected package in a `DEPENDENCY_NOTES.md` file. Never use `--force`.

### Step 0.4 — Create `.env.example` Files (if missing)

These files must exist and be committed. They document required variables without exposing values.

```bash
# backend/.env.example
cat > backend/.env.example << 'EOF'
# ── Database ─────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/taxbridge
REDIS_URL=redis://default:password@host:6379

# ── Auth ─────────────────────────────────────────────────────────
JWT_SECRET=replace-with-32-char-minimum-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace-with-different-32-char-secret
JWT_REFRESH_EXPIRES_IN=7d

# ── NRS / DIGITAX ─────────────────────────────────────────────────
DIGITAX_API_KEY=replace-with-nrs-api-key
DIGITAX_API_URL=https://api.digitax.gov.ng
DIGITAX_MOCK_MODE=false

# ── Storage (AWS S3 or Cloudflare R2) ─────────────────────────────
AWS_ACCESS_KEY=replace-with-access-key
AWS_SECRET_KEY=replace-with-secret-key
AWS_BUCKET=taxbridge-documents
AWS_REGION=af-south-1
AWS_ENDPOINT=https://your-r2-endpoint (only for Cloudflare R2)

# ── Notifications ─────────────────────────────────────────────────
EXPO_ACCESS_TOKEN=replace-with-expo-access-token

# ── Monitoring ─────────────────────────────────────────────────────
SENTRY_DSN=https://key@sentry.io/project-id
SENTRY_ENVIRONMENT=development

# ── App ─────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,https://taxbridge.vercel.app
ALLOWED_ADMIN_EMAILS=admin@taxbridge.ng

# ── Email (NDPC export notifications) ────────────────────────────
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_USER=noreply@taxbridge.ng
SMTP_PASS=replace-with-smtp-password
FROM_EMAIL=TaxBridge <noreply@taxbridge.ng>
EOF

# mobile/.env.example
cat > mobile/.env.example << 'EOF'
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_SENTRY_DSN=https://key@sentry.io/mobile-project-id
EXPO_PUBLIC_APP_VERSION=3.0.0
EOF

# admin/.env.example
cat > admin/.env.example << 'EOF'
DATABASE_URL=postgresql://user:password@host:5432/taxbridge
NEXTAUTH_SECRET=replace-with-32-char-minimum-secret
NEXTAUTH_URL=http://localhost:3000
SENTRY_DSN=https://key@sentry.io/admin-project-id
ALLOWED_ADMIN_EMAILS=admin@taxbridge.ng
EOF

git add backend/.env.example mobile/.env.example admin/.env.example
git commit -m "chore(env): add .env.example files with all required variables"
```

### Step 0.5 — Verify Runtime Environment Variables

```bash
# Function to check required vars — exits 1 if any missing
check_env() {
  local file=$1; shift; local missing=0
  for var in "$@"; do
    grep -q "^${var}=" "$file" 2>/dev/null || { echo "❌ Missing $var in $file"; missing=1; }
  done
  [ $missing -eq 0 ] && echo "✅ $file — all required vars present"
  return $missing
}

check_env backend/.env \
  DATABASE_URL REDIS_URL JWT_SECRET JWT_REFRESH_SECRET \
  DIGITAX_API_KEY DIGITAX_MOCK_MODE AWS_ACCESS_KEY AWS_SECRET_KEY \
  AWS_BUCKET EXPO_ACCESS_TOKEN SENTRY_DSN CORS_ALLOWED_ORIGINS NODE_ENV

check_env mobile/.env \
  EXPO_PUBLIC_API_URL EXPO_PUBLIC_SENTRY_DSN

check_env admin/.env.local \
  DATABASE_URL NEXTAUTH_SECRET NEXTAUTH_URL SENTRY_DSN
```

**Gate 0.5:** All three checks must print `✅`. Do not proceed with missing variables.

### Step 0.6 — Validate `DIGITAX_MOCK_MODE` is NOT `true` in production config

```bash
# This check prevents the most dangerous silent failure: shipping mock NRS to production
grep "DIGITAX_MOCK_MODE=true" backend/.env && \
  echo "⚠️  WARNING: Mock mode is ON. Confirm this is intentional for local dev only." || \
  echo "✅ DIGITAX_MOCK_MODE is not 'true' (correct for production)"
```

Add this check permanently to the CI pipeline (Phase 0.9).

### Step 0.7 — Run Contamination Scans

All five scans must return zero results before continuing. Each uses `|| true` so the script does not exit — read the output instead.

```bash
echo "=== SCAN 1: FIRS ===" && \
  grep -rn "FIRS" backend/src mobile/src packages/contracts/src admin/src \
    --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null && \
  echo "❌ FIRS found — fix before continuing" || echo "✅ No FIRS"

echo "=== SCAN 2: NRSt typo ===" && \
  grep -rn "NRSt" mobile/src --include="*.json" 2>/dev/null && \
  echo "❌ NRSt found" || echo "✅ No NRSt"

echo "=== SCAN 3: CRA formula ===" && \
  grep -rn "CRA\|consolidatedRelief\|max.*200.*gross" \
    packages/contracts/src --include="*.ts" 2>/dev/null && \
  echo "❌ CRA found" || echo "✅ No CRA"

echo "=== SCAN 4: Abolished minimum tax ===" && \
  grep -rn "minTax\|minimumTax\|0\.01.*gross\|1%.*gross" \
    packages/contracts/src --include="*.ts" 2>/dev/null && \
  echo "❌ Min tax found" || echo "✅ No abolished min tax"

echo "=== SCAN 5: Raw animation durations ===" && \
  grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src \
    --include="*.ts" --include="*.tsx" 2>/dev/null | \
  grep -v "design-system/animation.ts" && \
  echo "❌ Raw durations found" || echo "✅ No raw durations"
```

**Gate 0.7:** Fix every contamination result before proceeding. Commit fixes as:
```bash
git commit -m "fix(compliance): pre-V10.3 contamination removal — [describe what was removed]"
```

### Step 0.8 — Baseline Test Run

```bash
npm test --workspaces 2>&1 | grep -E "Tests:|passing|failing|✓|✗" | tail -10
```

Record the number. Target is ≥ 423 at end of Phase 15.

### Step 0.9 — Create CI/CD Pipeline

**File:** `.github/workflows/ci.yml`

```yaml
name: TaxBridge CI

on:
  push:
    branches: [master, 'feat/**', 'fix/**']
  pull_request:
    branches: [master]

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: taxbridge_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: --health-cmd "redis-cli ping" --health-interval 10s

    env:
      DATABASE_URL: postgresql://postgres:testpassword@localhost:5432/taxbridge_test
      REDIS_URL: redis://localhost:6379
      JWT_SECRET: ci-test-secret-minimum-32-characters-long
      JWT_REFRESH_SECRET: ci-refresh-secret-minimum-32-characters
      DIGITAX_MOCK_MODE: true
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --workspaces --if-present

      - name: Security audit (block on HIGH+)
        run: npm audit --audit-level=high

      - name: Mock mode production guard
        run: |
          # Fail if any .env file sets MOCK_MODE=true (not .env.example)
          if grep -r "DIGITAX_MOCK_MODE=true" backend/.env 2>/dev/null; then
            echo "❌ DIGITAX_MOCK_MODE=true in .env — remove before merge"
            exit 1
          fi

      - name: FIRS contamination scan
        run: |
          COUNT=$(grep -rn "FIRS" backend/src mobile/src packages/contracts/src \
            --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | wc -l)
          [ "$COUNT" -eq 0 ] || (echo "❌ FIRS found: $COUNT occurrences" && exit 1)

      - name: CRA/abolished formula scan
        run: |
          COUNT=$(grep -rn "CRA\|consolidatedRelief\|minimumTax\|minTax\|0\.01.*gross" \
            packages/contracts/src --include="*.ts" 2>/dev/null | wc -l)
          [ "$COUNT" -eq 0 ] || (echo "❌ Abolished formula found" && exit 1)

      - name: Raw animation duration scan
        run: |
          COUNT=$(grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src \
            --include="*.ts" --include="*.tsx" 2>/dev/null | \
            grep -v "design-system/animation.ts" | wc -l)
          [ "$COUNT" -eq 0 ] || (echo "❌ Raw animation durations found" && exit 1)

      - name: i18n parity check
        run: npm run i18n:check

      - name: Prisma migrate + generate
        run: cd backend && npx prisma migrate deploy && npx prisma generate

      - name: TypeScript check — all packages
        run: |
          npx tsc --noEmit --project backend/tsconfig.json
          npx tsc --noEmit --project admin/tsconfig.json
          npx tsc --noEmit --project packages/contracts/tsconfig.json

      - name: ESLint — zero warnings
        run: |
          npx eslint backend/src admin/src packages/contracts/src \
            --ext .ts,.tsx --max-warnings=0

      - name: Run tests
        run: npm test --workspaces 2>&1

      - name: PAYE accuracy gate
        run: cd packages/contracts && npm test -- --grep "NTA 2025 §33"

      - name: Prompt modules verify
        run: npm run prompts:build

  mobile-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: cd mobile && npm ci && npx tsc --noEmit
```

```bash
git add .github/
git commit -m "ci: add GitHub Actions CI pipeline — contamination, PAYE gate, mock mode guard, full test suite"
```

**Gate 0 complete when:** Feature branch created, `.env.example` files committed, all contamination scans clean, CI workflow created, baseline test count recorded.

---

## PHASE 1 — SECURITY FOUNDATION

**Purpose:** Security hardening must precede all feature implementation. A feature built on a non-hardened backend inherits its vulnerabilities.

### Step 1.1 — Install Security Middleware

```bash
cd backend
npm install helmet cors express-rate-limit express-validator sanitize-html bcryptjs
npm install --save-dev @types/bcryptjs @types/sanitize-html
```

### Step 1.2 — Apply Helmet and CORS to `backend/src/app.ts`

```typescript
import helmet from 'helmet';
import cors   from 'cors';

// CORS — whitelist mobile app origin and admin panel
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl in dev)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' not in allowlist`));
  },
  credentials:      true,
  allowedHeaders:   ['Authorization', 'Content-Type', 'X-Request-ID'],
  exposedHeaders:   ['X-Cache', 'X-RateLimit-Remaining'],
  methods:          ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],  // Tailwind requires this
      imgSrc:     ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
```

### Step 1.3 — Implement JWT Refresh Token Pattern

**File:** `backend/src/middleware/auth.ts`

The current single-token pattern has no revocation mechanism. Replace with access + refresh token pair.

```typescript
// Access token:  JWT, expires in 15 minutes (JWT_EXPIRES_IN=15m)
// Refresh token: opaque UUID stored in Redis, expires in 7 days (JWT_REFRESH_EXPIRES_IN=7d)
// Refresh key:   'refresh:${userId}:${tokenId}' — allows per-device revocation

// POST /api/v1/auth/refresh — accepts refresh token cookie, issues new access token
// POST /api/v1/auth/logout  — deletes refresh token from Redis (immediate revocation)

// The authenticate middleware verifies access token only.
// If access token is expired (401), client calls /refresh with HttpOnly cookie.
// If refresh token is also expired or deleted → 401, client must re-login.
```

**Token security requirements:**
- Access token: `Authorization: Bearer <token>` header
- Refresh token: `HttpOnly; Secure; SameSite=Strict` cookie only (never in response body)
- Both tokens: signed with separate secrets (`JWT_SECRET` and `JWT_REFRESH_SECRET`)

### Step 1.4 — Add Rate Limiting to Auth Routes

```typescript
// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

// Auth endpoints — tightest limit (prevents brute force)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      10,               // 10 attempts per 15 min per IP
  store:    new RedisStore({ client: redisClient }),
  message:  { error: 'TOO_MANY_REQUESTS', retryAfterMs: 900_000 },
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true,  // only count failures
});

// Standard user API routes
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max:      30,           // 30 req/min
  store:    new RedisStore({ client: redisClient }),
  keyGenerator: (req) => req.user?.id || req.ip,  // per-user not per-IP
});

// Expensive aggregation routes
export const heavyRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  store:    new RedisStore({ client: redisClient }),
  keyGenerator: (req) => req.user?.id || req.ip,
});
```

Apply `authRateLimit` to: `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`.

### Step 1.5 — Add Input Validation and Sanitisation to CSV Import

CSV import is the highest injection risk surface. Add validation before parsing:

```typescript
// backend/src/routes/expenses.ts — import endpoint
import { body, validationResult } from 'express-validator';
import sanitizeHtml from 'sanitize-html';

// Validation middleware for CSV import
const validateImport = [
  body().custom((_, { req }) => {
    if (!req.file) throw new Error('No file uploaded');
    if (req.file.size > 5 * 1024 * 1024) throw new Error('File too large (max 5MB)');
    if (!['text/csv', 'application/csv'].includes(req.file.mimetype))
      throw new Error('File must be CSV');
    return true;
  }),
];

// After parsing each CSV row — sanitise all string fields
const sanitiseRow = (row: any) => ({
  ...row,
  vendorName:  sanitizeHtml(row.vendorName || '', { allowedTags: [] }),
  description: sanitizeHtml(row.description || '', { allowedTags: [] }),
  category:    sanitizeHtml(row.category || '', { allowedTags: [] }),
});
```

### Step 1.6 — Add Request ID Middleware

```typescript
// backend/src/middleware/requestId.ts
import { v4 as uuidv4 } from 'uuid';

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  req.id = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};
// Mount before all routes in app.ts
// Pass req.id to Sentry.captureException() for trace correlation
```

### Step 1.7 — Database Backup Schedule

Configure on Render (or document for self-hosted):

```bash
# In Render Dashboard → PostgreSQL → Backups:
# - Daily automated backups: enabled
# - Retention: 7 days (free tier) or 30 days (paid)
# - Point-in-time recovery: enabled if on paid plan

# Document the backup schedule in PRODUCTION_READY.md:
cat >> PRODUCTION_READY.md << 'EOF'

## Database Backup Policy
- Provider: Render Managed PostgreSQL
- Schedule: Daily at 03:00 UTC (low traffic for Nigerian timezone UTC+1)
- Retention: 7 days
- Recovery procedure: Render Dashboard → Database → Restore from backup
- Manual backup command (for pre-migration snapshots):
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
EOF
```

**Commit:**
```bash
git add backend/src/middleware/ backend/.env.example .github/ PRODUCTION_READY.md
git commit -m "feat(security): helmet, CORS allowlist, JWT refresh tokens, auth rate limiting, CSV input sanitisation, request IDs, DB backup docs"
```

**Gate 1 complete when:** All security middleware installed, CORS configured with explicit origin list, JWT refresh pattern implemented, auth routes rate-limited, CSV input sanitised.

---

## PHASE 2 — PROMPT SYSTEM BOOTSTRAP

**Purpose:** Establish the `prompts/` module system. Done once — enables correct context loading for all subsequent Copilot sessions on this codebase.

### Step 2.1 — Create Folder Structure

```bash
mkdir -p prompts/{core,backend,mobile,ai,payments,data,devops,monetization,loaders}
```

### Step 2.2 — Write `prompts/index.ts`

Create with the exact `TASK_PROFILES` registry from the Master Prompt. All 10 profiles required:

```typescript
export const TASK_PROFILES: Record<string, string[]> = {
  'backend-api':         ['M00', 'M01'],
  'mobile-ui':           ['M00', 'M02', 'M08'],
  'dashboard-ux':        ['M00', 'M02', 'M08'],
  'mobile-enhancements': ['M00', 'M02', 'M08', 'M09'],
  'ai-features':         ['M00', 'M01', 'M03', 'M05'],
  'nrs-compliance':      ['M00', 'M01', 'M04', 'M05'],
  'tax-engine':          ['M00', 'M01', 'M05'],
  'devops':              ['M00', 'M06'],
  'growth':              ['M00', 'M07'],
  'full-audit':          ['M00', 'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09'],
};
```

### Step 2.3 — Write and Run Bootstrap

Create `prompts/loaders/bootstrap.ts` (per Master Prompt spec), then:

```bash
npx ts-node prompts/loaders/bootstrap.ts
# Expected: ✅ Bootstrap complete. 10 module stubs created.
```

### Step 2.4 — Fill Module Files

Fill in priority order. Each module must contain complete content from the corresponding Master Prompt section — no `TODO` stubs remaining.

1. `prompts/core/M00-identity-rules.md` — `<system_role>`, `<session_protocol>`, `<constraints>`
2. `prompts/data/M05-data-tax-engine.md` — `<tax_reference>`, `<contracts_api>`
3. `prompts/mobile/M08-dashboard-ux-patterns.md` — `<requirements_engine>`, `<technical_blueprint>`
4. `prompts/backend/M01-backend-architecture.md` — `<schema_inventory>`, `<anomaly_engine>`, `<feature_specs>`
5. `prompts/mobile/M02-mobile-ux.md` — `<established_patterns>`, `<i18n_registry>`
6. `prompts/mobile/M09-enhancement-implementation.md` — M09 module contract
7. Remaining: M03, M04, M06, M07

### Step 2.5 — Add Scripts and Verify

Add to root `package.json`:
```json
{
  "scripts": {
    "prompts:bootstrap": "ts-node prompts/loaders/bootstrap.ts",
    "prompts:verify":    "ts-node -e \"require('./prompts/loaders/prompt-loader').verifyAllModules()\"",
    "prompts:build":     "npm run prompts:verify && echo '✅ All 10 modules verified.'",
    "i18n:check":        "ts-node scripts/check-i18n.ts"
  }
}
```

```bash
npm run prompts:build
# Expected: ✅ All 10 modules verified.
```

**Commit:**
```bash
git add prompts/ package.json
git commit -m "feat(prompts): V10.3 module system — 10 modules filled, loader, bootstrap, scripts"
```

**Gate 2 complete when:** `npm run prompts:build` exits 0, no TODO sections in any module file.

---

## PHASE 3 — TAX ENGINE (`packages/contracts/`)

**Purpose:** Implement the complete NTA 2025 tax calculation library. Every other package imports from here. Errors here are regulatory violations.
**Load context:** `loadContextForTask('tax-engine')` → M00 + M01 + M05.

### Step 3.1 — Create File Structure

```bash
mkdir -p packages/contracts/src/__tests__
```

Files to create (content specified in Master Prompt `<contracts_api>`):
```
packages/contracts/src/
├── constants.ts   ← NTA_2025 object — single source of truth for all rates
├── types.ts       ← all shared TypeScript interfaces
├── pit.ts         ← calculatePIT(input: PITInput): PITResult
├── rra.ts         ← calculateRRA(input: RRAInput): RRAResult
├── paye.ts        ← calculatePAYE(input: PAYEInput): PAYEResult
├── vat.ts         ← calculateVAT(input: VATInput): VATResult
├── wht.ts         ← calculateWHT(input: WHTInput): WHTResult
├── cit.ts         ← calculateCIT(input: CITInput): CITResult
├── cgt.ts         ← calculateCGT(input: CGTInput): CGTResult
├── devlevy.ts     ← calculateDevLevy(input: DevLevyInput): DevLevyResult
└── index.ts       ← barrel export
```

### Step 3.2 — Implement `constants.ts`

The `NTA_2025` object is the regulatory bedrock of the entire platform. Every value must be verified against the Master Prompt before committing.

```typescript
// Verify these values explicitly — these are the most commonly mis-implemented:
// PIT_BANDS[0].upTo    = 800_000     (NOT 200_000 — pre-NTA 2025 error)
// PIT_BANDS[1].rate    = 0.15        (NOT 0.10 — pre-NTA 2025 error)
// RRA_RATE             = 0.20        (NOT 0.25 — that is the top PIT band rate)
// RRA_CAP              = 500_000
// VAT_REG_THRESHOLD    = 25_000_000  (NOT 100_000_000 — common confusion with CIT threshold)
// CIT_SMALL_TURNOVER   = 100_000_000 (₦100M)
// CIT_SMALL_ASSETS     = 250_000_000 (₦250M)
// WHT.professionalFees = 0.10        (NOT 0.05 — WHT BUG from V10.2)
// WHT.construction     = 0.05        (the ONE category at 5%)
// CGT_COMPANY_RATE     = 0.30        (NOT 0.10 — pre-NTA 2025)
// DEV_LEVY_RATE        = 0.04        (4% on assessable profits)
// NRS_STAMP_THRESHOLD  = 200_000     (₦200K — unchanged from V10.2)
```

### Step 3.3 — Implement `pit.ts`

```typescript
// Algorithm (strictly in this order):
// 1. Deductions: calculateRRA(rentPaid) + pension(8% qualifying) + NHF(2.5%) + NHIS + lifeIns + mortgage
// 2. taxableIncome = max(0, grossIncome - totalDeductions)
// 3. CRITICAL: if taxableIncome ≤ 0 → PITResult with totalTax: 0. NO floor, NO minimum.
// 4. Apply NTA_2025.PIT_BANDS progressively via reduce()
// 5. Return PITResult with taxByBand array, effectiveTaxRate, ntaSection: 'NTA 2025 §§14–23'

// Nigerian SME use cases to test:
// - Artisan earning ₦720,000/year → Band 1 only → tax = ₦0
// - Market trader ₦2,400,000/year with ₦300,000 rent → reduced taxable income
// - Freelancer ₦15,000,000/year → multi-band calculation
// - Salary earner ₦50,000,000+ → hits all 6 bands
```

### Step 3.4 — Implement `rra.ts`

```typescript
// Formula: min(NTA_2025.RRA_RATE × annualRentPaid, NTA_2025.RRA_CAP)
// RRA requires documentary evidence. Validation NOT here — enforced in route handlers.
// Test cases per Master Prompt:
// calculateRRA({ annualRentPaid: 3_000_000 }) → { allowance: 500_000, capped: true }
// calculateRRA({ annualRentPaid: 1_200_000 }) → { allowance: 240_000, capped: false }
// calculateRRA({ annualRentPaid: 0 })         → { allowance: 0, capped: false }
```

### Step 3.5 — Implement `paye.ts`

```typescript
// Algorithm:
// 1. Annualise: annualisedGross = monthlyGross × 12
// 2. Pension base = basicSalary + transportAllowance + housingAllowance
// 3. pensionDeduction = (pensionOptOut ? 0 : PENSION_RATE × pensionBase) / 12  [monthly]
// 4. nhfDeduction = NHF_RATE × basicSalary / 12  [monthly]
// 5. annualisedRRA = calculateRRA({ annualRentPaid }).allowance
// 6. Annualised tax = calculatePIT({
//      grossIncome: annualisedGross,
//      rentPaid: annualRentPaid,
//      pensionContrib: pensionBase × PENSION_RATE,
//      nhfContrib: basicSalary × NHF_RATE,
//    }).totalTax
// 7. monthlyTax = annualisedTax / 12  (round to nearest kobo)
// 8. netPay = monthlyGross - monthlyTax - pensionDeduction - nhfDeduction
```

**PAYE Reference Gate — hardcode this test and never change its expected value:**
```typescript
// Test: 'NTA 2025 §33 — PAYE reference calculation'
// Input: { monthlyGross: 416_667, basicSalary: 250_000,
//           transportAllowance: 83_333, housingAllowance: 83_333,
//           annualRentPaid: 600_000 }
// Expected: annualisedTax within ±₦1 of NTA 2025 §33 published figure
// If this test fails: fix paye.ts. Do NOT change the expected value.
```

### Step 3.6 — Implement `wht.ts`

```typescript
// Rate lookup: NTA_2025.WHT_RATES[category] — NEVER hardcode
// Small company exemption: BOTH conditions required
//   (1) vendorTIN matches /^[0-9]{10}$/ AND
//   (2) monthlyTotal <= NTA_2025.WHT_SMALL_CO_MONTHLY_LIMIT (₦2M)
// filingDeadline: always "21st of the following month"
// Non-resident: flat 4% regardless of category
```

### Step 3.7 — Implement `cit.ts`

```typescript
// Small company: ALL THREE conditions must be satisfied simultaneously
//   (1) annualTurnover <= CIT_SMALL_TURNOVER (₦100M)
//   (2) fixedAssets < CIT_SMALL_ASSETS (₦250M)   ← strictly less than
//   (3) isProfessionalFirm !== true
// If any condition fails → isSmallCompany: false → rate: 0.30 → CIT due
// Development levy (4%) applies to non-small companies only
// MNE 15% ETR: only when isMNE=true AND groupTurnoverEUR >= 750_000_000
```

### Step 3.8 — Implement `vat.ts`, `cgt.ts`, `devlevy.ts`

Per Master Prompt `<contracts_api>` schemas. Verify `vat.ts` uses `NTA_2025.VAT_STANDARD_RATE` (0.075 — never 0.05 or 0.15).

### Step 3.9 — Write Comprehensive Tests

**File:** `packages/contracts/src/__tests__/tax-engine.test.ts`

Minimum test coverage per function: zero input, low income (Band 1, ₦0 tax), midrange, boundary, maximum/edge, abolition guards.

**Mandatory named tests that cannot be renamed or have their expected values changed:**
```typescript
describe('NTA 2025 §33 — PAYE reference calculation', () => { ... });
describe('NTA 2025 §14 — Band 1 zero tax floor abolished', () => { ... });
describe('NTA 2025 §30(vi) — RRA replaces CRA', () => { ... });
describe('NTA 2025 §68 — CIT small company three-condition gate', () => { ... });
```

```bash
cd packages/contracts && npm test
# All tests must pass. Zero failures.

npx tsc --noEmit
# Zero TypeScript errors.
```

**Commit:**
```bash
git add packages/contracts/
git commit -m "feat(contracts): NTA 2025 tax engine — pit, rra, paye, vat, wht, cit, cgt, devlevy + comprehensive tests"
```

**Gate 3 complete when:** All contract tests pass including the PAYE §33 reference test, `tsc --noEmit` returns 0, zero banned formulas in source.

---

## PHASE 4 — DATABASE SCHEMA

**Purpose:** All required Prisma models, enums, and indexes applied and migrated.
**Load context:** `loadContextForTask('backend-api')` → M00 + M01.

### Step 4.1 — Read Existing Schema First

```bash
cat backend/prisma/schema.prisma
```

Read the entire file. Mark which models already exist. Only add models that are missing. Never duplicate.

### Step 4.2 — Add Missing Models (dependency order)

Add each missing model to `backend/prisma/schema.prisma`. Copy field specifications exactly from the Master Prompt `<schema_inventory>` section.

Order (foreign key safety):
1. `TaxHealthSnapshot` (references User)
2. `AnomalySignal` (references User, Expense?, Invoice?)
3. `ComplianceEvent` (references User)
4. `UserDevice` (references User) — add `@@unique([userId, pushToken])`
5. `TaxDocument` (references User, Expense?, Invoice?)
6. `TaxLesson` (standalone — no user FK)
7. `UserLessonProgress` (references User) — add `@@unique([userId, lessonSlug])`
8. `TaxReturn` (references User) — add `@@unique([userId, taxYear, returnType])`
9. `EmployeeRecord` (references User as employer) — **New model for PAYE**:
   ```prisma
   model EmployeeRecord {
     id                 String   @id @default(cuid())
     userId             String   // employer's userId
     name               String
     tin                String
     monthlyGross       Decimal  @db.Decimal(15,2)
     basicSalary        Decimal  @db.Decimal(15,2)
     transportAllowance Decimal  @db.Decimal(15,2)
     housingAllowance   Decimal  @db.Decimal(15,2)
     annualRentPaid     Decimal  @db.Decimal(15,2) @default(0)
     pensionOptOut      Boolean  @default(false)
     isActive           Boolean  @default(true)
     createdAt          DateTime @default(now())
     updatedAt          DateTime @updatedAt
     @@index([userId, isActive])
   }
   ```

### Step 4.3 — Add Enums

```prisma
enum AnomalyType {
  DUPLICATE_EXPENSE
  ROUND_NUMBER_INVOICE
  MISSING_RECEIPT
  EXCEEDS_CATEGORY_NORM
  WEEKEND_TRANSACTION
  VENDOR_TIN_MISMATCH
  CATEGORY_SHIFT
  TRANSACTION_GAP
  EXEMPT_VAT_CLAIMED
}

enum BusinessType {
  SOLE_TRADER
  PARTNERSHIP
  LIMITED_LIABILITY
  PROFESSIONAL_SERVICE
  NGO
}

enum FilingStatus {
  DRAFT
  SUBMITTED
  ACCEPTED
  REJECTED
}
```

### Step 4.4 — Add All Performance Indexes

```prisma
// Add to each model — paste these exactly
// TaxHealthSnapshot:    @@index([userId, date])
// AnomalySignal:        @@index([userId, createdAt])  @@index([userId, severity, resolvedAt])
// ComplianceEvent:      @@index([userId, status, dueDate])
// UserDevice:           @@index([userId, active])
// TaxDocument:          @@index([userId, taxYear])  @@index([retentionUntil])
// TaxReturn:            @@index([userId, taxYear, returnType])
// EmployeeRecord:       @@index([userId, isActive])
// Invoice (existing):   @@index([userId, nrsStamped]) if not present
// Expense (existing):   @@index([userId, flagged]) if not present
```

### Step 4.5 — Migrate and Generate

```bash
cd backend
npx prisma migrate dev --name "v10.3-schema-additions"
npx prisma generate
npx prisma validate
echo "✅ Schema valid"
```

**Contingency — migration conflict:** Read the error carefully. If a column already exists with different constraints:
1. Manually edit the generated migration SQL to use `ALTER TABLE ... ALTER COLUMN` instead of `ADD COLUMN`
2. Never `DROP` a column that has data — use `ALTER` to change type/constraint only
3. Never run `prisma migrate reset` on a database with production data

### Step 4.6 — Seed TaxAcademy Lessons

**File:** `backend/prisma/seeds/lessons.ts`

```typescript
// Seed all 12 lessons (10 complete + 2 stubs)
// Each lesson: { slug, titleKey, bodyKey, difficulty, estimatedMinutes, order, quizQuestions, prerequisiteSlug }
// Lessons 01–10: quizQuestions with at least 3 questions each, quiz pass threshold: 70
// Lessons 11–12: empty quizQuestions arrays, prerequisiteSlug: 'lesson-10'
// Use upsert — safe to re-run without duplicating

const lessons = await Promise.all(
  LESSON_DATA.map(lesson =>
    (prisma as any).taxLesson.upsert({
      where:  { slug: lesson.slug },
      update: lesson,
      create: lesson,
    })
  )
);
console.log(`✅ Seeded ${lessons.length} lessons`);
```

```bash
npx ts-node backend/prisma/seeds/lessons.ts
# ✅ Seeded 12 lessons
```

**Commit:**
```bash
git add backend/prisma/
git commit -m "feat(db): V10.3 schema — 9 new models, enums, performance indexes, lesson seeds, EmployeeRecord for PAYE"
```

**Gate 4 complete when:** `npx prisma validate` passes, migration applied without data loss, lesson seed idempotent.

---

## PHASE 5 — BUG FIXES (P0 BLOCKERS)

**Purpose:** These four bugs cause visual failures and broken localisation. Fix them before any new UI is built — broken infrastructure invalidates all subsequent visual QA.

### Step 5.1 — BUG-S01: Bundle Inter Font

```bash
cd mobile && npx expo install @expo-google-fonts/inter expo-font expo-splash-screen
```

**File:** `mobile/app/_layout.tsx` — add font loading at the top of the root layout:

```typescript
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  // ... rest of layout
}
```

**Gate 5.1:** Open Android emulator → bottom navigation bar → all icons must render as icons, not □ squares. Check in both light and dark mode.

### Step 5.2 — BUG-S02: Fix "NRSt" Typo

```bash
# Find all occurrences
grep -rn "NRSt" mobile/src --include="*.json" -l

# For each file found, replace NRSt with NRS
# Then verify the corrected key name still matches all usages:
for key in $(grep -rn "NRSt" mobile/src --include="*.json" | \
  grep -oP '"NRSt[^"]+":' | tr -d '":'  ); do
  echo "Checking usage of key: $key"
  grep -rn "$key" mobile/src --include="*.tsx" --include="*.ts"
done
```

After replacing: run the FIRS/NRSt scan again to confirm clean.

### Step 5.3 — BUG-S03/S04: Fix Offline i18n

**File:** `mobile/src/i18n/i18n.ts` (or `i18next.ts`):

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en     from './en.json';
import pidgin from './pidgin.json';

i18n
  .use(initReactI18next)
  .init({
    resources:     { en: { translation: en }, pidgin: { translation: pidgin } },
    lng:           'en',
    fallbackLng:   'en',
    initImmediate: false,           // ← BUG-S03 fix: synchronous init prevents raw keys on cold start
    interpolation: { escapeValue: false },
    react:         { useSuspense: false },
  });

export default i18n;
```

**File:** `mobile/src/i18n/en.json` — add missing key:
```json
"COMMON": {
  "OFFLINE": "You're offline — showing saved data"
}
```

**File:** `mobile/src/i18n/pidgin.json` — add matching key:
```json
"COMMON": {
  "OFFLINE": "E be like say internet don cut — we dey show you wetin we save"
}
```

**Gate 5.3:** Enable Airplane Mode on emulator. Navigate to dashboard. No raw i18n keys visible anywhere.

### Step 5.4 — Create `scripts/check-i18n.ts`

```typescript
// scripts/check-i18n.ts
import * as en     from '../mobile/src/i18n/en.json';
import * as pidgin from '../mobile/src/i18n/pidgin.json';

function flattenKeys(obj: any, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flattenKeys(v, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

const enKeys     = new Set(flattenKeys(en));
const pidginKeys = new Set(flattenKeys(pidgin));

const missing = [...enKeys].filter(k => !pidginKeys.has(k));
const extra   = [...pidginKeys].filter(k => !enKeys.has(k));

let exitCode = 0;
if (missing.length > 0) {
  console.error(`❌ ${missing.length} Pidgin keys missing:\n${missing.map(k => `  ${k}`).join('\n')}`);
  exitCode = 1;
}
if (extra.length > 0) {
  console.warn(`⚠️  ${extra.length} extra Pidgin keys (no English match):\n${extra.join('\n')}`);
}
if (exitCode === 0) console.log(`✅ i18n check passed — ${enKeys.size} keys in both locales`);
process.exit(exitCode);
```

```bash
npm run i18n:check
# Must exit 0
```

**Commit:**
```bash
git add mobile/
git commit -m "fix(mobile): BUG-S01 Inter font bundled, BUG-S02 NRSt typo corrected, BUG-S03/S04 offline i18n synchronous init + COMMON.OFFLINE key"
```

**Gate 5 complete when:** Icons render on Android, no raw keys offline, `npm run i18n:check` exits 0.

---

## PHASE 6 — DESIGN SYSTEM

**Purpose:** Complete token system before any component is written. Every visual decision flows from here.
**Load context:** `loadContextForTask('dashboard-ux')` → M00 + M02 + M08.

### Step 6.1 — Animation Vocabulary Module (MUST CREATE BEFORE ANY DASHBOARD COMPONENT)

**File:** `mobile/src/design-system/animation.ts`

```typescript
import { Easing } from 'react-native-reanimated';

export const DURATION = {
  instant:    100,   // visual ack only (scale tap feedback)
  fast:       200,   // urgent reveals
  standard:   400,   // normal transitions
  deliberate: 600,   // informational reveals (charts)
  slow:       800,   // gauge arc draw-in
  skeleton:   1200,  // shimmer cycle — DO NOT CHANGE (tuned for 2G user patience)
} as const;

export const EASE = {
  enter:     Easing.out(Easing.cubic),
  exit:      Easing.in(Easing.cubic),
  gauge:     Easing.bezier(0.25, 0.46, 0.45, 0.94),  // smooth arc draw-in
  urgent:    Easing.bezier(0.36, 0.07, 0.19, 0.97),  // sharp attention-grabbing
  shimmer:   Easing.linear,
  celebrate: Easing.bezier(0.34, 1.56, 0.64, 1),     // slight overshoot for milestones
} as const;

export const ENTER_FROM = {
  below: { translateY: 12, opacity: 0 },
  scale: { scale: 0.92,   opacity: 0 },
  above: { translateY: -8, opacity: 0 },
  fade:  { opacity: 0 },
} as const;

// Scan gate — run after creating this file:
// grep -rn "withTiming.*[0-9]{3,4}" mobile/src --include="*.ts" --include="*.tsx" | grep -v "animation.ts"
// Must return zero results
```

### Step 6.2 — Design Tokens

**File:** `mobile/src/design-system/tokens.ts`

Implement exactly as specified in Master Prompt `<design_tokens>`. Verify these critical values:

```
DARK_TOKENS.surface          = '#000000'         ← true black, AMOLED battery saving
LIGHT_TOKENS.red.gauge       = '#EF4444'          ← data color, not UI chrome
DARK_TOKENS.red.gauge        = '#EF4444'          ← same in both themes (it IS the same data)
TYPOGRAPHY.family.regular    = 'Inter_400Regular'  ← must match useFonts key exactly
SKELETON_COLORS.dark.from    = '#1F2937'
SKELETON_COLORS.dark.to      = '#374151'
```

### Step 6.3 — ThemeContext

**File:** `mobile/src/context/ThemeContext.tsx`

```typescript
import React, { createContext, useContext } from 'react';
import { useColorScheme }                   from 'react-native';
import { LIGHT_TOKENS, DARK_TOKENS }        from '../design-system/tokens';

interface ThemeContextValue {
  isDark:  boolean;
  theme:   'light' | 'dark';
  colors:  typeof LIGHT_TOKENS;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return (
    <ThemeContext.Provider value={{
      isDark,
      theme:  isDark ? 'dark' : 'light',
      colors: isDark ? DARK_TOKENS : LIGHT_TOKENS,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme() called outside <ThemeProvider>');
  return ctx;
}
```

### Step 6.4 — Wire into App Root

In `mobile/app/_layout.tsx`, `<ThemeProvider>` must be outermost — before `<QueryClientProvider>`:

```typescript
// Correct wrapping order:
// <ThemeProvider>           ← outermost
//   <QueryClientProvider>
//     <Stack />
//   </QueryClientProvider>
// </ThemeProvider>

// StatusBar must use theme-aware style:
// <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
```

### Step 6.5 — Purge Raw Hex From All Existing Components

```bash
grep -rn "#[0-9A-Fa-f]\{6\}\|#[0-9A-Fa-f]\{3\}" \
  mobile/src/screens mobile/src/components \
  --include="*.tsx" --include="*.ts" | grep -v "// " | grep -v "tokens.ts"
```

For every result: replace with `colors.*` from `useTheme()`. Components that don't currently call `useTheme()` must be updated to do so.

**Commit:**
```bash
git add mobile/src/design-system/ mobile/src/context/ mobile/app/_layout.tsx
git commit -m "feat(mobile): design system — animation vocabulary (ER-10), tokens light/dark/AMOLED, ThemeContext"
```

**Gate 6 complete when:** `grep` for raw hex returns 0 results in component files, `animation.ts` exists, `useTheme()` is accessible, zero raw duration scan results.

---

## PHASE 7 — BACKEND SERVICES & API

**Purpose:** Implement all backend routes, services, and workers.
**Load context:** `loadContextForTask('backend-api')` → M00 + M01.

> **Reminder:** All Prisma queries use `(prisma as any).modelName`. Never use generated Prisma types.
> **Reminder:** Every financial data route requires `authenticate` middleware.
> **Reminder:** Every new route requires a minimum of 3 tests.

### Step 7.1 — Fallback Constants

**File:** `backend/src/admin/fallbacks.ts`

```typescript
export const FALLBACK_ADMIN_STATS = {
  totalUsers: 0, activeToday: 0, invoicesToday: 0, nrsSuccessRate: 0, source: 'fallback',
} as const;
export const FALLBACK_ADMIN_USERS   = { users: [], total: 0, source: 'fallback' } as const;
export const FALLBACK_ADMIN_REVENUE = { mrr: 0, arr: 0, source: 'fallback' } as const;
```

### Step 7.2 — Composite Dashboard API

**File:** `backend/src/routes/dashboard.ts`

```typescript
// GET /api/v1/dashboard
// Auth:    authenticate (required)
// Rate:    apiRateLimit (30/min)
// Cache:   Redis 'dashboard:composite:${userId}' TTL 120s
// Headers: X-Cache: HIT | MISS

// Cache pattern:
const cacheKey = `dashboard:composite:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) {
  res.setHeader('X-Cache', 'HIT');
  return res.json(JSON.parse(cached));
}

const [stats, forecast, nrsHealth, topAnomalies, upcomingDeadlines] = await Promise.all([
  getDashboardStats(userId),
  forecastQuarterlyTax(userId),
  getNrsHealth(userId),
  detectExpenseAnomalies(userId, { limit: 3, minSeverity: 'medium' }),
  getUpcomingDeadlines(userId),
]);

const composite = { stats, forecast, nrsHealth, topAnomalies, upcomingDeadlines };
await redis.setex(cacheKey, 120, JSON.stringify(composite));
res.setHeader('X-Cache', 'MISS');
return res.json(composite);

// Cache invalidation — call these in the relevant write routes:
// invalidateDashboardCache(userId)  ← invoice create, expense create, NRS stamp
```

### Step 7.3 — Anomaly Detection Service

**File:** `backend/src/services/anomaly/detector.ts`

```typescript
// All 9 signals as individual async functions → returns AnomalySignalOutput | null
// Main function: Promise.all([s1,s2,...s9]) → filter(Boolean) → sortBySeverity → limit

// Signal implementations:
// S1 DUPLICATE_EXPENSE:    same amount + vendorName + category within 48h window
// S2 ROUND_NUMBER_INVOICE: divisible by 50_000 AND kobo === 0 (not just round numbers)
// S3 MISSING_RECEIPT:      receiptUrl IS NULL AND amount >= 50_000
// S4 EXCEEDS_CATEGORY_NORM:amount > (90-day avg for category × 2.5), min 5 data points
// S5 WEEKEND_TRANSACTION:  dayOfWeek(createdAt) IN (0=Sunday, 6=Saturday)
// S6 VENDOR_TIN_MISMATCH:  vendorTIN !~ /^[0-9]{10}$/ OR NRS TIN lookup returns invalid
// S7 CATEGORY_SHIFT:       vendor's last 3 transactions used different category
// S8 TRANSACTION_GAP:      no expense/invoice in userId for >= 21 consecutive days
// S9 EXEMPT_VAT_CLAIMED:   vatAmount > 0 WHERE supplyType = 'exempt'

// S4 note: skip signal if fewer than 5 historical data points — insufficient baseline
// S6 note: NRS TIN lookup is optional. If DIGITAX_MOCK_MODE=true, skip external call.
```

### Step 7.4 — TaxHealth Cron + Snapshot

**File:** `backend/src/workers/taxHealthCron.ts`

```typescript
// Schedule: '0 2 * * *'  (2am WAT = 1am UTC — low traffic)
// Health score formula (0–100):
//   nrsCompliance    × 0.35  → % of invoices ≥ ₦200K that are NRS-stamped
//   filingTimeliness × 0.35  → % of ComplianceEvents completed before dueDate
//   anomalyPenalty   × 0.20  → 100 - (highSeverityCount × 20 + mediumSeverityCount × 5)
//   dataCompleteness × 0.10  → % of expenses with receipts (for amounts ≥ ₦50K)
// Clamp result to [0, 100]
// Write TaxHealthSnapshot with score, breakdown, and last-7-scores trend array
// trend: get last 6 snapshots → append new score → last 7 items only
```

**Route:** `GET /api/v1/dashboard/trends` → last 30 `TaxHealthSnapshot` records, Redis TTL 300s.

### Step 7.5 — Compliance Calendar

**File:** `backend/src/services/compliance/calendar.ts`

```typescript
// generateComplianceEvents(userId, taxYear): ComplianceEvent[]
//
// Events generated (all per NTA 2025):
// VAT_FILING:       20th of month following each quarter end (Mar/Jun/Sep/Dec)
// PAYE_REMITTANCE:  10th of each following month (monthly)
// PIT_FILING:       March 31 of following year
// CIT_FILING:       6 months after company year-end (user-configured)
// WHT_REMITTANCE:   21st of month following each transaction month
//
// daysRemaining: computed at generation time AND refreshed daily by cron
// status transition rules:
//   daysRemaining > 30  → 'upcoming'
//   daysRemaining 1–30  → 'upcoming' (badge turns amber in UI)
//   daysRemaining = 0   → 'due'
//   daysRemaining < 0   → 'overdue'
//   completed at any time → 'completed'
//
// Nigerian calendar note: if deadline falls on a Sunday or public holiday,
// advance to next working day. Public holiday list: NTA 2025 Appendix B.
```

### Step 7.6 — NRS Circuit Breaker + SSE

**File:** `backend/src/services/nrs/circuitBreaker.ts`

```typescript
// State machine: closed → open → halfOpen → closed
// Transitions:
//   closed  → open:      5 consecutive failures within 60s window
//   open    → halfOpen:  after 5-minute cooldown
//   halfOpen→ closed:    1 successful probe request
//   halfOpen→ open:      probe fails
//
// State persisted in Redis key 'nrs:circuit:state' (survives server restarts)
// On transition to 'open':
//   1. Sentry.captureMessage('NRS circuit opened', { level: 'warning', extra: { failureCount } })
//   2. Emit SSE to all active status-stream connections
//   3. Queue push notification to affected users with pending invoices

// Failure definition: HTTP 5xx from NRS OR connection timeout (>10s) OR malformed response
```

**File:** `backend/src/routes/nrs.ts`

```typescript
// GET /api/v1/nrs/health → { state: 'closed'|'open'|'halfOpen', failureCount, lastFailureAt }
// No auth required (health check endpoint — read-only)

// GET /api/v1/nrs/status-stream/:invoiceId  → SSE
// Auth: Bearer token in ?token= query param (SSE cannot send Authorization header)
// Heartbeat: every 30s (prevents Render 60s idle close)
// Auto-close: on 'stamped' | 'failed' event OR 10-minute timeout
// Error on non-existent invoiceId: 404 before opening SSE connection

// POST /api/v1/nrs/stamp  → stamp invoice
// Auth: authenticate required
// If circuit OPEN: BullMQ job with delay schedule (+30min, +2h, +6h, +24h)
// If DIGITAX_MOCK_MODE=true: return mock { irn: 'MOCK-IRN-' + Date.now(), stamped: true }
// NRS rate limit: 100 stamps/hour per API key — track in Redis counter 'nrs:stamps:${hour}'
//   If counter >= 100: queue for next hour instead of attempting
```

**File:** `backend/src/workers/nrsRetry.ts` — BullMQ consumer on `nrs-stamp-queue`. Before each retry: check circuit state. If still open → reschedule (do not attempt). If closed → attempt stamp → on success: update invoice, notify user via push.

### Step 7.7 — VAT Filing Backend

**File:** `backend/src/routes/vat.ts`

```typescript
// POST /api/v1/vat/filing
// Auth: authenticate
// Rate: apiRateLimit
// Validates: period format (YYYY-MM), amounts are positive numbers
// Calls calculateVAT() from @taxbridge/contracts to verify client-submitted amounts
// If client amount ≠ server-calculated amount by > ₦1: reject with 422
// Writes TaxReturn (returnType: 'VAT', status: 'SUBMITTED')
// Calls NRS IRN endpoint for e-filing reference
// Invalidates dashboard cache for userId

// POST /api/v1/vat/refund-claim (separate endpoint — different NRS endpoint)
// Triggered when: netLiability < 0 (inputVAT > outputVAT)
// Stores claim reference in TaxReturn (returnType: 'VAT_REFUND')

// GET /api/v1/vat/summary/:period  → auto-populate wizard from DB
// Aggregates: sum(Invoice.vatAmount) WHERE period+nrsStamped=true → outputVAT
//             sum(Expense.vatAmount) WHERE period+recoverable=true → inputVAT
```

### Step 7.8 — PAYE Engine Backend

**File:** `backend/src/routes/payroll.ts`

```typescript
// GET  /api/v1/payroll/employees         → list active employees
// POST /api/v1/payroll/employees         → create single employee
// POST /api/v1/payroll/employees/bulk    → CSV bulk import (NEW — Nigerian SMEs need this)
//   Same CSV validation as expense import (sanitise + skip invalid rows)
//   Max: 200 employees per import
//   Columns: name, tin, monthly_gross, basic_salary, transport_allowance, housing_allowance,
//            annual_rent_paid (optional), pension_opt_out (optional, default false)
// PUT  /api/v1/payroll/employees/:id     → update employee record
// DELETE /api/v1/payroll/employees/:id   → soft delete (isActive: false)

// POST /api/v1/payroll/run
//   Calls calculatePAYE() for each active employee
//   Returns PayrollRunResult with per-employee breakdowns
//   Stores PayrollRun record (new model if not present)
//   Generates payslips via BullMQ → PDF per employee (MF-02 infrastructure)
//   Deadline: "10th of the following month" (NTA 2025 §33)
//   NRS remittance reference generated on submission
```

### Step 7.9 — Expense Reconciliation

```typescript
// POST /api/v1/expenses/reconcile
// Auth: authenticate | Rate: heavyRateLimit (10/min — 3 DB passes is expensive)
// Runs 3 passes sequentially (not parallel — each pass depends on the DB state)
// Return 200 even if all arrays are empty — empty IS the success state
// After reconciliation: trigger anomaly re-scan via BullMQ (non-blocking)
// estimatedTaxImpact: sum of VAT corrections from pass3 that affect deductible expenses
```

### Step 7.10 — Document Vault

```typescript
// POST /api/v1/vault/upload
//   Validate: max 25MB, allowed types: pdf/jpg/jpeg/png/xlsx/docx
//   storageKey = uuidv4() + extension  (never original filename)
//   retentionUntil = addYears(new Date(), 5)  (NTA 2025 §31)
//   Return: { uploadUrl: presignedUrl, documentId, retentionUntil }
//   Mobile client: encrypt file AES-256-GCM before PUT to uploadUrl
//   Encryption key derivation: PBKDF2(userId + JWT_SECRET, salt, 100000, 32, 'sha256')

// GET /api/v1/vault  → paginated, metadata only, never decrypt
//   Params: page, limit (default 20), fileType, taxYear
//   No file content in response — storage key never exposed in API response

// GET /api/v1/vault/:id/download
//   Verify userId owns the document (prevent IDOR)
//   Generate presigned URL (TTL 5 minutes)
//   Log download event for audit trail

// DELETE /api/v1/vault/:id
//   Verify ownership
//   Mark as deleted (soft delete — retentionUntil enforces hard delete via cron)
//   NTA 2025 §31: files cannot be deleted before retentionUntil by user request
//   If retentionUntil < now: allow deletion
```

### Step 7.11 — Push Notifications

```typescript
// POST /api/v1/devices/register
//   Upsert on (userId, pushToken) — same token can be updated with new userId
//   Validate pushToken format: ExponentPushToken[...]

// Worker: backend/src/workers/notificationWorker.ts
//   Uses expo-server-sdk (NOT direct APNs/FCM)
//   Batch: sendPushNotificationsAsync(chunks(tickets, 100))
//   Dead token: receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered'
//     → set UserDevice.active = false
//   PII guard: notification body MUST NOT contain name, TIN, amounts, IRN
//     Only: reference IDs and i18n template strings with placeholders
//   Rate limit: 100 notifications/user/day (prevent spam)
```

### Step 7.12 — Invoice PDF + Share Link

```typescript
// GET /api/v1/invoices/:id/pdf
//   Guard: invoice.userId === req.user.id (IDOR prevention)
//   Guard: invoice.nrsStamped === true (only stamped invoices get PDFs)
//   Lazy generation: check if PDF already in S3/R2 → return cached presigned URL
//   PDF template: TaxBridge logo, invoice header, line items, NRS stamp watermark,
//     IRN in bold, QR code linking to NRS verification endpoint, total + VAT breakdown
//   Library preference: pdfkit (lightweight) over puppeteer (heavy, slow on Render free tier)
//   Cache: store S3 key in Redis 'invoice:pdf:${invoiceId}' (permanent — PDF doesn't change)
//   Return: { url: presignedUrl, expiresAt: +15min }

// GET /api/v1/invoices/:id/share
//   Guard: nrsStamped === true only
//   Generate opaque share token: uuidv4() (never the invoiceId)
//   Store in Redis: 'invoice:share:${token}' → invoiceId, TTL 30 days
//   Share URL: process.env.ADMIN_URL + '/i/' + token
//   Public read endpoint (no auth) on admin panel: GET /i/[token]
```

### Step 7.13 — CSV Expense Import

```typescript
// POST /api/v1/expenses/import  (multipart/form-data, field: 'csv')
// Auth: authenticate | Rate: heavyRateLimit
// Validate: max 5MB, mimetype text/csv, max 1000 rows
// Parse with papaparse: header: true, skipEmptyLines: true, dynamicTyping: true
// Sanitise each row (Step 1.5 sanitiseRow function)
// Per-row validation: amount > 0, valid date (not future), category in enum
// Duplicate check: same (amount, vendorName, DATE) already exists → skip + report
// Partial import: valid rows inserted, invalid rows reported in errors array
// After import: queue anomaly re-scan for affected period via BullMQ
// taxImpact: sum of deductible amounts in imported rows (preliminary estimate)
```

### Step 7.14 — NDPC Data Export

```typescript
// POST /api/v1/account/data-export
//   Rate limit: 1 per user per 30 days (store last request in Redis 'export:last:${userId}')
//   Queue BullMQ job (async — do not wait for completion in request)
//   Return: { message: 'Export queued. You will receive an email when ready.', estimatedMinutes: 15 }

// Worker: data-export-worker.ts
//   Queries: User, Invoice, Expense, TaxReturn, TaxHealthSnapshot, TaxDocument metadata
//   ZIP structure: profile.json, invoices.json, expenses.json, tax-returns.json,
//                  health-snapshots.json, vault-manifest.json, README.txt
//   README.txt content: data schema explanation, NDPC §30 citation, TaxBridge contact
//   Upload to S3/R2 with presigned URL (TTL 7 days)
//   Send email with download link (SMTP via Nodemailer)
//   ZIP deleted from S3/R2 after 7 days (lifecycle rule on bucket)
//   PII note: vault file contents NOT included — manifest only (filenames, sizes, types, dates)
```

### Step 7.15 — Multi-Period Tax Comparison

```typescript
// GET /api/v1/tax/comparison?periods[]=2024&periods[]=2025&periods[]=2026
//   Max 3 periods. Each period must be a 4-digit year string.
//   Uses persisted data only — no live recalculation
//   Periods with no data → zeroed fields (not 404)
//   Cache: Redis TTL 300s per userId+periods combination
//   Key: 'tax:comparison:${userId}:${periods.sort().join('-')}'
```

### Step 7.16 — Admin Routes with Fallbacks

**File:** `backend/src/routes/admin/`

All three dashboard data routes use the `FALLBACK_*` pattern. Additionally:

```typescript
// Admin auth middleware — check against ALLOWED_ADMIN_EMAILS env var
// Never expose admin routes without this middleware
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const email = req.user?.email;
  const allowed = (process.env.ALLOWED_ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (!email || !allowed.includes(email)) return res.status(403).json({ error: 'FORBIDDEN' });
  next();
};

// Apply: authenticate → adminAuth → route handler (order matters)
```

All 5 analytics endpoints (`/api/admin/analytics/*`) use Redis TTL 300s and run real DB aggregations. No `Math.random()`.

### Step 7.17 — Write Backend Tests

For every new route, write minimum 3 tests: success, unauthenticated (401), edge case. For admin routes: add a 403 test (authenticated user, not admin email). For financial calculations: add a test that verifies `calculateXxx()` from `@taxbridge/contracts` is called (mock and assert call).

```bash
cd backend && npm test
# All tests must pass. Zero failures.

npx tsc --noEmit
# Zero errors.
```

**Commit:**
```bash
git add backend/
git commit -m "feat(backend): V10.3 — composite API, anomaly engine (9 signals), NRS circuit+SSE, PAYE+bulk import, VAT wizard, vault (IDOR guards), push notifications (PII-free), CSV import, NDPC export, admin fallbacks+adminAuth"
```

**Gate 7 complete when:** All backend tests pass, `tsc --noEmit` returns 0, CORS and security middleware active, no Prisma generated types used.

---

## PHASE 8 — DASHBOARD COMPONENTS

**Purpose:** Build the three foundational components that all dashboard UI builds on.
**Load context:** `loadContextForTask('dashboard-ux')` → M00 + M02 + M08.

### Step 8.1 — DashboardZone Component

**File:** `mobile/src/components/dashboard/DashboardZone.tsx`

```typescript
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { DURATION, EASE, ENTER_FROM } from '../../design-system/animation';

type DashboardZoneName = 'apex' | 'signal' | 'action' | 'context' | 'ambient';

const ZONE_CONFIG: Record<DashboardZoneName, { delay: number; from: keyof typeof ENTER_FROM }> = {
  apex:    { delay: 0,   from: 'scale' },
  signal:  { delay: 80,  from: 'below' },
  action:  { delay: 160, from: 'below' },
  context: { delay: 240, from: 'below' },
  ambient: { delay: 320, from: 'fade'  },
};

interface DashboardZoneProps {
  zone:      DashboardZoneName;
  visible:   boolean;
  urgent?:   boolean;   // urgent=true: delay=0, EASE.urgent, DURATION.fast
  children:  React.ReactNode;
}

// Animation logic:
// opacity:    0 → 1
// transform:  ENTER_FROM[config.from] → identity
// When urgent: override delay=0, duration=DURATION.fast, easing=EASE.urgent
// Normal:      delay=config.delay, duration=DURATION.standard, easing=EASE.enter
// Trigger:     when visible changes from false → true
```

### Step 8.2 — DashboardSkeleton Component

**File:** `mobile/src/components/dashboard/DashboardSkeleton.tsx`

```typescript
// SkeletonBlock: animated shimmer rectangle
// shimmer = useSharedValue(0)
// Animation: withRepeat(withTiming(1, { duration: DURATION.skeleton, easing: EASE.shimmer }), -1, true)
// Background: interpolateColor between SKELETON_COLORS[isDark ? 'dark' : 'light'].from/to
// accessibilityElementsHidden={true}  ← screen readers skip skeleton entirely

// Zone geometry (must match real content ±0px — no layout shift on reveal):
// apex:    View 100%×{ gauge circle 200×110 + greeting 100%×24 }
// signal:  Row of 3 blocks: [31%×72px, gap 8, 31%×72px, gap 8, 31%×72px]
// action:  Wrap grid: 6 blocks 30%×64px, gap 6, 3 per row
// context: [ block 40%×14px, gap 8, block 100%×52px, gap 8, block 100%×52px ]
// ambient: Row of 2 blocks: [48%×80px, gap 8, 48%×80px]

// accessibilityLabel on outermost View: "Loading your tax dashboard"
```

### Step 8.3 — SectionState Machine

**File:** `mobile/src/components/dashboard/SectionState.tsx`

```typescript
// Generic: SectionState<T>
// Props: { data, isLoading, error, isEmpty, loading, empty, errorView, children }
// State priority (strict — do not change order):
//   1. isLoading → render loading
//   2. error     → render errorView
//   3. isEmpty(data) → render empty  (may be null for anomaly section)
//   4. children(data) → render content

// InlineError component:
// Props: { icon: string (emoji), message: string, action: string, onAction: () => void }
// Pressable with scale(0.97) on press (C-20)
// icon must be an emoji — never a Spinner/ActivityIndicator
```

### Step 8.4 — Layout Shift Verification

After building both skeleton and real components, render both side-by-side in development mode and measure:

```typescript
// In DashboardScreen for development only:
// const { showSkeleton } = useDevMenu();
// if (showSkeleton) return <DashboardSkeleton />;
// Visually compare skeleton zones to their real counterparts at each viewport width
// Target: 0px position difference when skeleton fades out and real content fades in
```

**Commit:**
```bash
git add mobile/src/components/dashboard/DashboardZone.tsx mobile/src/components/dashboard/DashboardSkeleton.tsx mobile/src/components/dashboard/SectionState.tsx
git commit -m "feat(mobile): ER-07 DashboardZone (5-zone stagger), ER-08 DashboardSkeleton (geometry contract), ER-09 SectionState machine"
```

**Gate 8 complete when:** All three components render on Android without errors. Skeleton geometry visually matches real content in development overlay test.

---

## PHASE 9 — TAX HEALTH GAUGE

**Purpose:** Replace ProgressBar with production SVG arc gauge that communicates financial health clearly to Nigerian SME users who may be viewing their tax position for the first time.

### Step 9.1 — Install SVG Dependency

```bash
cd mobile && npx expo install react-native-svg
```

### Step 9.2 — Implement TaxHealthGauge

**File:** `mobile/src/components/dashboard/TaxHealthGauge.tsx`

```typescript
import Svg, { Path, Text as SvgText, G } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import { DURATION, EASE } from '../../design-system/animation';

// Arc specification:
// Sweep: 230°  (starts -205° from 3 o'clock, sweeps clockwise to +25°)
// StrokeWidth: 12px
// StrokeLinecap: 'round'
// Track arc: full 230°, colors.border (background track)
// Progress arc: 0 → score/100 × 230°, animated via useAnimatedProps
// Center: (100, 100) for 200px container
// Color zones by score:
//   0–49:   colors.red.gauge
//   50–74:  colors.amber.gauge
//   75–89:  colors.lime.gauge
//   90–100: colors.green.gauge
// Color must update immediately when score enters a new zone (no color transition animation)

// Animation:
// const progress = useSharedValue(0)
// On mount + on score change:
//   withTiming(score / 100, { duration: DURATION.slow, easing: EASE.gauge })
// animatedArcLength = progress × MAX_ARC_LENGTH

// score=0 guard: render track arc only (progress arc has 0 length — no NaN paths)
// score=100 guard: progress arc equals track arc exactly

// Compact mode ('compact'):
//   size=120, right-aligned, no sparkline, no label, score number centered
//   activates when: daysRemaining ≤ 7 OR any deadline is overdue
// Expanded mode (default):
//   size=200, centered, score number + status label + 7-day sparkline below

// accessibilityLabel: REQUIRED prop (throw Error if undefined in __DEV__)
// Accessibility: role="progressbar", accessibilityValue={{ min: 0, max: 100, now: score }}

// Status label text (derived from score, not from props):
//   0–49:   'Needs Attention'  / Pidgin: 'You need to act now'
//   50–74:  'Fair'             / Pidgin: 'E dey okay small small'
//   75–89:  'Good'             / Pidgin: 'E dey good'
//   90–100: 'Excellent'        / Pidgin: 'You dey do well well'
// Use t('gauge.status.XX') i18n keys — add these keys to both locales now
```

### Step 9.3 — Implement `computeGaugeMode`

**File:** `mobile/src/screens/DashboardScreen.tsx`

```typescript
export function computeGaugeMode(data: DashboardComposite | undefined): 'expanded' | 'compact' {
  if (!data) return 'expanded';
  const hasUrgentDeadline = data.upcomingDeadlines?.some(d => d.daysRemaining <= 7)  ?? false;
  const hasOverdue        = data.upcomingDeadlines?.some(d => d.daysRemaining < 0)   ?? false;
  return (hasUrgentDeadline || hasOverdue) ? 'compact' : 'expanded';
}

// When compact: APEX zone shows gauge right-aligned + UrgentDeadlineCard left-aligned
// UrgentDeadlineCard: bright red border, daysRemaining countdown, tap → VAT filing wizard
```

### Step 9.4 — Boundary Tests

Verify visually on 320px screen width (Android emulator set to Nexus S or similar):
```
score = 0:   track arc visible, no progress arc, score "0" centered, status "Needs Attention"
score = 49:  red arc at 49/100 of sweep, label "Needs Attention"
score = 50:  amber arc at 50/100 of sweep, label "Fair" (color snaps, no transition)
score = 75:  lime arc at 75/100 of sweep
score = 100: lime→green arc completes full sweep exactly
```

**Commit:**
```bash
git add mobile/src/components/dashboard/TaxHealthGauge.tsx
git commit -m "feat(mobile): CF-01/ER-02 TaxHealthGauge — 230° SVG arc, compact mode, zone colors, EASE.gauge, NaN boundary guards"
```

**Gate 9 complete when:** Gauge renders on all boundary scores without NaN paths. Animates on mount. Compact mode visible when deadline ≤ 7 days. Zero ProgressBar references in `TaxHealthGauge.tsx`.

---

## PHASE 10 — COMPOSITE HOOK + CANONICAL DASHBOARD SCREEN

**Purpose:** Wire the single composite API call and implement the canonical dashboard layout exactly as specified. No deviation from the canonical structure.

### Step 10.1 — useDashboard Hook

**File:** `mobile/src/hooks/useDashboard.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';

export function useDashboard() {
  return useQuery({
    queryKey:        ['dashboard', 'composite'],
    queryFn:         () => dashboardApi.composite().then(r => r.data),
    staleTime:       2 * 60 * 1000,    // 2 minutes — prevents refetch on tab switch
    placeholderData: (prev) => prev,   // no blank flash on background refresh
    retry:           2,                // retry twice on network error
    retryDelay:      attemptIndex => Math.min(1000 * 2 ** attemptIndex, 8000),
  });
}

// dashboardApi.composite() must:
// 1. Call GET /api/v1/dashboard with Authorization header
// 2. On network error: return cached data if available (React Query handles this)
// 3. Read X-Cache header and log to analytics (helps measure Redis hit rate)
```

### Step 10.2 — Canonical DashboardScreen

**File:** `mobile/src/screens/DashboardScreen.tsx`

```typescript
// The structure below is canonical. Do not add zones. Do not reorder zones.
// Do not add conditional rendering outside SectionState wrappers.

export default function DashboardScreen() {
  const { data, isLoading, error, refetch } = useDashboard();

  const gaugeMode     = useMemo(() => computeGaugeMode(data), [data]);
  const hasHighAnomaly = data?.topAnomalies?.some(a => a.severity === 'high') ?? false;

  // ONE skeleton gate — only renders during cold load (no data yet)
  if (isLoading && !data) return <DashboardSkeleton />;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={isLoading && !!data} onRefresh={refetch} />}
    >
      {/* ZONE 1: APEX — health score + greeting + urgent deadline card */}
      <DashboardZone zone="apex" visible={!isLoading}>
        <Greeting name={data?.user?.name} />
        <TaxHealthGauge
          score={data?.stats?.taxHealthScore ?? 0}
          mode={gaugeMode}
          trend={data?.stats?.trend}
          accessibilityLabel={t('dashboard.taxHealthA11y', {
            score: data?.stats?.taxHealthScore ?? 0,
            status: getHealthStatus(data?.stats?.taxHealthScore ?? 0),
          })}
        />
        {gaugeMode === 'compact' && (
          <UrgentDeadlineCard deadline={data?.upcomingDeadlines?.find(d => d.daysRemaining <= 7)} />
        )}
      </DashboardZone>

      {/* ZONE 2: SIGNAL — 3 key metrics row */}
      <DashboardZone zone="signal" visible={!isLoading}>
        <SectionState
          data={data?.stats}
          isLoading={isLoading}
          error={error}
          isEmpty={(d) => !d}
          loading={<SectionSkeletonRows count={1} height={72} />}
          empty={<EmptyMetrics />}
          errorView={<InlineError icon="📊" message={t('dashboard.metricsLoadError')} action={t('common.retry')} onAction={refetch} />}
        >
          {(stats) => <MetricsRow stats={stats} />}
        </SectionState>
      </DashboardZone>

      {/* ZONE 3: ACTION — 6 quick action tiles */}
      <DashboardZone zone="action" visible={!isLoading}>
        <QuickActionsGrid data={data} />
      </DashboardZone>

      {/* ZONE 4: CONTEXT — anomalies + deadlines (urgent items first) */}
      <DashboardZone zone="context" visible={!isLoading} urgent={hasHighAnomaly}>
        <SectionState
          data={data?.topAnomalies}
          isLoading={isLoading}
          error={error}
          isEmpty={(d) => d.length === 0}
          loading={<SectionSkeletonRows count={2} height={52} />}
          empty={null}  {/* C-19: SILENCE when no anomalies */}
          errorView={<InlineError icon="🔍" message={t('dashboard.anomaliesLoadError')} action={t('common.retry')} onAction={refetch} />}
        >
          {(anomalies) => <TopAnomaliesSection anomalies={anomalies} />}
        </SectionState>

        <SectionState
          data={data?.upcomingDeadlines}
          isLoading={isLoading}
          error={error}
          isEmpty={(d) => d.length === 0}
          loading={<SectionSkeletonRows count={2} height={52} />}
          empty={<EmptyDeadlines />}
          errorView={<InlineError icon="📅" message={t('dashboard.calendarLoadError')} action={t('common.retry')} onAction={refetch} />}
        >
          {(deadlines) => <ComplianceCalendar deadlines={deadlines} />}
        </SectionState>
      </DashboardZone>

      {/* ZONE 5: AMBIENT — charts + offline status */}
      <DashboardZone zone="ambient" visible={!isLoading}>
        <SectionState
          data={data?.stats?.trend}
          isLoading={isLoading}
          error={error}
          isEmpty={(d) => !d || d.length === 0}
          loading={<SectionSkeletonRow height={80} />}
          empty={null}
          errorView={<InlineError icon="📈" message={t('dashboard.chartsLoadError')} action={t('common.retry')} onAction={refetch} />}
        >
          {(trend) => <TrendCharts trend={trend} />}
        </SectionState>
        <OfflineSyncStatus />
      </DashboardZone>
    </ScrollView>
  );
}
```

### Step 10.3 — Quick Actions Grid — Explicit Action Definitions

The original prompt left this under-specified. Define the 6 actions explicitly for Nigerian SME context:

```typescript
// computeQuickActions(data: DashboardComposite | undefined): QuickAction[]
// Returns 6 actions in urgency-first order

const ALL_ACTIONS: QuickAction[] = [
  { id: 'file-vat',      icon: '🧾', labelKey: 'action.fileVAT',       route: '/filing/vat',       priority: (d) => d?.upcomingDeadlines?.some(e => e.eventType === 'VAT_FILING'  && e.daysRemaining <= 14) ? 100 : 10 },
  { id: 'stamp-invoice', icon: '✅', labelKey: 'action.stampInvoice',   route: '/invoices/new',     priority: (d) => (d?.stats?.unstampedCount ?? 0) > 0 ? 90 : 20 },
  { id: 'add-expense',   icon: '💸', labelKey: 'action.addExpense',     route: '/expenses/new',     priority: () => 30 },
  { id: 'run-payroll',   icon: '👥', labelKey: 'action.runPayroll',     route: '/payroll',          priority: (d) => d?.upcomingDeadlines?.some(e => e.eventType === 'PAYE_REMITTANCE' && e.daysRemaining <= 7) ? 95 : 15 },
  { id: 'reconcile',     icon: '🔍', labelKey: 'action.reconcile',      route: '/expenses/reconcile', priority: (d) => (d?.topAnomalies?.length ?? 0) > 0 ? 85 : 5 },
  { id: 'tax-academy',   icon: '📚', labelKey: 'action.taxAcademy',     route: '/academy',          priority: () => 5 },
];

// Sort by priority(data) descending, take first 6
// Each tile: 30% width, 64px height, 3-column grid
// Pressable: scale(0.97) on press, then navigate (C-20 — visual ack before navigation)
```

### Step 10.4 — Add All Required i18n Keys for Dashboard

Add to both `en.json` and `pidgin.json`:
```json
{
  "action.fileVAT":       { "en": "File VAT",        "pidgin": "File VAT" },
  "action.stampInvoice":  { "en": "Stamp Invoice",   "pidgin": "Stamp Invoice" },
  "action.addExpense":    { "en": "Add Expense",     "pidgin": "Add Expense" },
  "action.runPayroll":    { "en": "Run Payroll",     "pidgin": "Run Payroll" },
  "action.reconcile":     { "en": "Reconcile",       "pidgin": "Fix Records" },
  "action.taxAcademy":    { "en": "Tax Academy",     "pidgin": "Learn Tax" },
  "gauge.status.poor":    { "en": "Needs Attention", "pidgin": "You need to act now" },
  "gauge.status.fair":    { "en": "Fair",             "pidgin": "E dey okay small small" },
  "gauge.status.good":    { "en": "Good",             "pidgin": "E dey good" },
  "gauge.status.excellent":{"en": "Excellent",        "pidgin": "You dey do well well" }
}
```

### Step 10.5 — CI Verification

```bash
# C-17: Exactly 5 zone= attributes
COUNT=$(grep -c 'zone="' mobile/src/screens/DashboardScreen.tsx)
[ "$COUNT" -eq 5 ] && echo "✅ 5 zones" || echo "❌ Expected 5 zones, found $COUNT"

# C-19: No "no anomalies" text
ANOM=$(grep -rn "No anomal\|noAnomal\|no_anomal" mobile/src --include="*.tsx" --include="*.json" | wc -l)
[ "$ANOM" -eq 0 ] && echo "✅ No anomaly empty text" || echo "❌ Found anomaly empty text: $ANOM"

# C-20: No await before navigate
AWAIT=$(grep -c "await.*router\|router.*await" mobile/src/screens/DashboardScreen.tsx)
[ "$AWAIT" -eq 0 ] && echo "✅ No await before navigate" || echo "❌ Found await+router: $AWAIT"

# C-16: No raw durations in components (excluding animation.ts)
RAW=$(grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src --include="*.ts" --include="*.tsx" | grep -v "animation.ts" | wc -l)
[ "$RAW" -eq 0 ] && echo "✅ No raw durations" || echo "❌ Raw durations found: $RAW"

# Run i18n check
npm run i18n:check
```

All five checks must pass before committing.

**Commit:**
```bash
git add mobile/src/
git commit -m "feat(mobile): CF-03/ER-05 composite hook + canonical DashboardScreen — 5 zones, SectionState everywhere, explicit QuickActions, C-15/C-19/C-20 compliant"
```

**Gate 10 complete when:** Dashboard loads with one network request (verify in network tab: 1 call to `/api/v1/dashboard`), all 5 zones animate in with correct stagger, skeleton-to-content transition has 0px layout shift, all 5 CI checks pass.

---

## PHASE 11 — REMAINING DASHBOARD COMPONENTS

### Step 11.1 — TopAnomaliesSection

**File:** `mobile/src/components/dashboard/TopAnomaliesSection.tsx`

```typescript
// Renders 1–3 AnomalySignalOutput items (never 0 — SectionState handles empty silently)
// Each row:
//   - Severity indicator: circle (shape) + fill color + text label (3 channels, C-15)
//     high   → red circle  + "High Risk"  / Pidgin: "E bad"
//     medium → amber circle + "Review"    / Pidgin: "Check am"
//     low    → grey circle  + "Note"      / Pidgin: "Note am"
//   - Message: t(signal.messageKey) — never signal.message directly
//   - Amount: formatted in ₦ if present
//   - Chevron right →
// Tap: router.push('/expenses/' + signal.expenseId)  (no await — C-20)
// Swipe left to dismiss: call PATCH /api/v1/anomalies/:id/resolve
//   Optimistic update: remove from list immediately
//   Show undo toast for 3 seconds (on undo: re-add to list + PATCH to un-resolve)
//   After 3s without undo: confirm resolution server-side
```

### Step 11.2 — ComplianceCalendar

**File:** `mobile/src/components/dashboard/ComplianceCalendar.tsx`

```typescript
// Renders ALL deadlines (not just 1 — CF-06 fix)
// Section header: "Upcoming Deadlines" (t('dashboard.upcomingDeadlines'))
// Each deadline row:
//   - Event type label: human-readable (e.g. "VAT Return", "PAYE Remittance", "Income Tax")
//   - Days remaining badge:
//     daysRemaining < 0:  red badge "OVERDUE"      / Pidgin: "E DON EXPIRE"
//     daysRemaining = 0:  red badge "TODAY"         / Pidgin: "TODAY O"
//     daysRemaining ≤ 7:  amber badge "{n} days"    / Pidgin: "{n} days remain"
//     daysRemaining ≤ 30: amber badge "{n} days"
//     daysRemaining > 30: green badge "{n} days"
//   - Due date formatted: "20 Mar 2026" (not ISO format — Nigerian users read DD MMM YYYY)
//   - Arrow →
// Tap: navigate to the correct filing screen for that event type
//   VAT_FILING         → /filing/vat
//   PAYE_REMITTANCE    → /payroll
//   PIT_FILING         → /filing/pit
//   CIT_FILING         → /filing/cit
//   WHT_REMITTANCE     → /filing/wht
// Sort: overdue first, then by daysRemaining ascending
```

### Step 11.3 — MetricsRow

**File:** `mobile/src/components/dashboard/MetricsRow.tsx`

```typescript
// 3 metric cards — flex row, each 31% width, 72px height (matches skeleton geometry)
// Card 1: VAT Due
//   value: formatNaira(data.stats.vatDue)
//   status: due > 0 → amber; overdue → red; clear → green
//   icon: 🧾 + color + label (3 channels C-15)
// Card 2: Tax Estimate (quarterly forecast)
//   value: formatNaira(data.forecast?.estimatedTax ?? 0)
//   subtitle: t('dashboard.pitEstimate')
// Card 3: Invoices This Month
//   value: data.stats.invoicesToday.toString()  ← today; monthly count in subtitle
//   tapped → navigate to /invoices

// formatNaira: ₦ + abbreviated (₦1.2M not ₦1,234,567 — fits in small card)
// Values from data.stats — never recalculate here
```

### Step 11.4 — TrendCharts

**File:** `mobile/src/components/dashboard/TrendCharts.tsx`

```typescript
// 2 sparkline views — flex row, each 48% wide, 80px tall (matches skeleton geometry)
// Left: 7-day health score trend (data.stats.trend: number[])
// Right: 30-day rolling VAT position trend (from /api/v1/dashboard/trends if available)
// Each chart: minimal Svg path, no axes, no labels (sparkline only)
// Draw-in animation: path strokeDashoffset withTiming(0, { duration: DURATION.deliberate, easing: EASE.enter })
// Color: matches TaxHealthGauge zone for the latest score
// If trend data missing: render SkeletonBlock at same dimensions (not error state)
// NO Math.random() — if no data, render skeleton — never fabricated data (C-08)
```

### Step 11.5 — OfflineSyncStatus

**File:** `mobile/src/components/dashboard/OfflineSyncStatus.tsx`

```typescript
// Visible ONLY when offline (useNetInfo().isConnected === false)
// When online: renders null (not hidden — actually unmounted)
// Content: 
//   - WiFi-off icon (shape) + amber color + text (3 channels C-15)
//   - Last sync: "Last updated {timeAgo}" (e.g. "Last updated 3 minutes ago")
//   - Pending queue: "3 items waiting to sync" (BullMQ queue depth from localStorage/SecureStore)
// Pidgin: "E be like say internet don cut — data wey we save last: {timeAgo}"
// Appearance: full-width amber banner, 48px height, bottom of AMBIENT zone
```

### Step 11.6 — Add All Remaining i18n Keys

Add every key from the Master Prompt `<i18n_registry>` that hasn't been added yet (anomaly, notification namespaces, quiz namespace):

```json
// Add to en.json + pidgin.json — quiz namespace:
"quiz.question":    { "en": "Question {n} of {total}", "pidgin": "Question {n} of {total}" },
"quiz.correct":     { "en": "Correct! ✅",             "pidgin": "You get am! ✅" },
"quiz.incorrect":   { "en": "Not quite.",               "pidgin": "No be that one." },
"quiz.explanation": { "en": "Here's why:",              "pidgin": "This na why:" },
"quiz.passed":      { "en": "Lesson complete!",         "pidgin": "You don pass this one!" },
"quiz.failed":      { "en": "Try again to pass.",       "pidgin": "Try am again make you pass." },
"quiz.score":       { "en": "Your score: {score}%",     "pidgin": "Your score: {score}%" }
```

```bash
npm run i18n:check
# Must exit 0
```

**Commit:**
```bash
git add mobile/src/components/
git commit -m "feat(mobile): P1 dashboard components — TopAnomalies (swipe-dismiss), ComplianceCalendar (multi-deadline), MetricsRow, TrendCharts (real data), OfflineSyncStatus, all i18n"
```

**Gate 11 complete when:** Full dashboard renders on physical Android device with all 5 zones populated. All anomaly swipe-dismiss and undo toasts work. `npm run i18n:check` exits 0.

---

## PHASE 12 — MOBILE SCREENS

**Purpose:** Screen-level UI for all P1 features. Optimised for Nigerian SME workflows.

### Step 12.1 — VAT Filing Wizard Screen

**File:** `mobile/src/screens/filing/VATFilingScreen.tsx`

```
6-step wizard:
  Step 1: Period selection (month picker — shows last 3 months + current)
  Step 2: Output VAT summary (auto-populated from invoices — editable with explanation)
  Step 3: Input VAT summary (auto-populated from expenses — editable)
  Step 4: Net liability review (calls calculateVAT() client-side for preview)
  Step 5: Submit confirmation (shows NRS deadline, penalty if late)
  Step 6: Success (filing reference + IRN displayed prominently)

Nigerian SME notes:
  - Step 2: show "₦X auto-calculated from X stamped invoices this period"
  - Step 3: show "₦X auto-calculated from X expense receipts this period"
  - Step 4: if inputVAT > outputVAT → show "You may be eligible for a ₦X refund"
  - Step 5: deadline warning if filing late (red banner + penalty estimate)
  - Step 6: "File another period" CTA + share filing reference button
  - Exit: Step 6 → DashboardScreen (invalidate dashboard cache via mutation)
  - Back: wizard steps allow back navigation (do not lose entered data)
  - State: wizard state in React.useState (not AsyncStorage — session only)
```

### Step 12.2 — Payroll Screen

**File:** `mobile/src/screens/payroll/PayrollScreen.tsx`

```
Tabs: Employees | Run Payroll | History

Employees tab:
  - List of active employees (name, TIN, monthly gross, net pay preview)
  - "Add Employee" button → single employee form
  - "Import CSV" button → file picker → POST /api/v1/payroll/employees/bulk
    CSV template download button (pre-formatted with correct column headers)
  - Swipe to deactivate employee

Run Payroll tab:
  - Period picker (default: current month)
  - "Calculate" button → shows per-employee breakdown BEFORE submitting
    Columns: Name | Gross | PAYE | Pension | NHF | Net Pay
    Total row at bottom
  - "Submit & Remit" button → POST /api/v1/payroll/run → confirmation
    Shows NRS remittance reference + "Pay by 10th {month}" deadline

History tab:
  - List of past payroll runs with period, employee count, total cost
  - Tap → per-employee detail + payslip download buttons

Nigerian SME notes:
  - Employee count badge on tab (e.g. "Employees (12)")
  - Bulk import maximum: 200 employees — show progress bar during import
  - Payslip PDF share: WhatsApp share button (primary sharing mechanism in Nigeria)
```

### Step 12.3 — Reconciliation Screen

**File:** `mobile/src/screens/expenses/ReconciliationScreen.tsx`

```
Entry: Quick Actions grid → "Reconcile"
Header card: estimated tax impact in ₦ (bold, large)
  "Fixing these issues could change your tax by ₦{impact}"

Pass 1 section (Duplicates):
  If empty: show green checkmark "No duplicate expenses found"
  Each item: both records shown side-by-side, "Keep" | "Delete" buttons
  Batch action: "Delete all duplicates"

Pass 2 section (Category Issues):
  Each item: expense description + "Was: {current}" → "Should be: {suggested}"
  "Accept" | "Keep original" per item | "Accept all suggestions"

Pass 3 section (VAT Issues):
  Each item: expense + "VAT of ₦{amount} appears incorrect — should be ₦0"
  "Fix" | "Keep" per item | "Fix all VAT issues"

Footer: "Apply X fixes" → bulk confirm → POST /api/v1/expenses/reconcile with decisions
  On success: navigate to DashboardScreen (invalidate dashboard cache)
```

### Step 12.4 — Document Vault Screen

**File:** `mobile/src/screens/vault/VaultScreen.tsx`

```
Search + filter bar (type, year)
File list: fileName (masked), fileType icon, taxYear, fileSize, retentionUntil
  Retention warning: amber if retentionUntil < 180 days, green otherwise
  NTA note: "Required to keep until {date} per NTA 2025 §31"

Upload:
  1. File picker (documents + images)
  2. File size check: max 25MB — warn user before uploading
  3. Client-side AES-256-GCM encryption
  4. POST /api/v1/vault/upload → presigned URL → PUT encrypted file
  5. Success toast

Download:
  GET /api/v1/vault/:id/download → opens in device PDF viewer or share sheet
  Downloads decrypt on device (key derivation same as encryption)

Delete:
  Only allowed if retentionUntil has passed
  If retention active: show "Cannot delete — required until {date} per NTA 2025 §31"

2G note: show upload progress bar — Nigerian networks are slow
         file compression hint: "Tip: compress large files before uploading"
```

### Step 12.5 — TaxAcademy Screen

**File:** `mobile/src/screens/academy/TaxAcademyScreen.tsx`

```
Lesson list:
  Progress header: "X of 12 lessons complete"
  Each lesson: icon (status) + title + difficulty badge + estimated time
    ✅ green checkmark → complete
    🔒 lock icon → locked (prerequisites not met)
    ○ empty circle → available, not started

Lesson detail screen:
  Progress: "Lesson X of 12"
  Body: rendered from t(lesson.bodyKey) — supports markdown-ish formatting
  "Take Quiz" button (appears after scrolling to bottom)

Quiz screen:
  "Question {n} of {total}"
  Multiple choice — 3–4 options
  On select: immediate feedback (green/red highlight)
  Show explanation: t(question.explanationKey) after each answer
  Score calculation after all questions
  Pass (≥ 70%): "Lesson complete! ✅" → mark UserLessonProgress
  Fail: "Try again to pass" → reset quiz state

Lesson 11 + 12 locked state:
  If not all prior lessons completed at ≥ 70%:
  Show "Complete all previous lessons to unlock"
  Do NOT show partial lesson content behind a paywall or hard error
```

### Step 12.6 — NRS Status Screen

**File:** `mobile/src/screens/NRSStatusScreen.tsx`

```
Circuit state banner (3-channel C-15):
  closed:   green ● "NRS is operational" / Pidgin: "NRS dey work well"
  open:     red ■ "NRS stamping paused" + retry countdown / Pidgin: "NRS dey rest small"
  halfOpen: amber ▲ "NRS testing connection" / Pidgin: "NRS dey check connection"

Invoice stamping status (SSE):
  Pending invoices list → tap to open status stream
  EventSource connection via react-native-sse
  Events rendered in real-time: pending → stamping → stamped | failed
  On 'stamped': show IRN, green banner, "View PDF" button
  On 'failed': show error, retry button, next retry time

Retry countdown:
  When circuit open: "Retrying in {minutes} minutes"
  Updated every second using setInterval
  On circuit close: auto-refresh page

Nigerian network note: SSE reconnects automatically (EventSource spec default)
  Manual reconnect button also shown if disconnected > 60s
```

**Commit:**
```bash
git add mobile/src/screens/
git commit -m "feat(mobile): VAT wizard (6-step, refund detection), payroll (bulk CSV import, WhatsApp payslip share), reconciliation, vault (NTA retention warnings), TaxAcademy (quiz gates), NRS status (SSE + circuit state)"
```

**Gate 12 complete when:** All 6 screens navigate to without errors. VAT filing end-to-end completes. Payroll bulk CSV import works for 50-row file. TaxAcademy quiz gate blocks Lesson 11 correctly.

---

## PHASE 13 — ADMIN PANEL

**Purpose:** Complete the Next.js admin panel.
**Load context:** `loadContextForTask('backend-api')` → M00 + M01. (Not 'devops' — admin panel needs backend patterns.)

### Step 13.1 — Verify All Routes Exist

```bash
ls admin/app/
# Must contain: page.tsx (redirects to /dashboard), dashboard/, users/, users/[id]/,
#               invoices/, analytics/, tax-health/, nrs-status/, settings/
# Also: /i/[token]/ (public invoice share viewer)
```

Create any missing routes as Next.js App Router pages.

### Step 13.2 — Admin Authentication Middleware

**File:** `admin/src/middleware.ts`

```typescript
// Next.js middleware — runs on all /admin/* and /api/admin/* routes
// Checks NextAuth session
// Verifies session.user.email is in ALLOWED_ADMIN_EMAILS
// Redirects to /login if not authenticated or not in allowlist
// Never expose admin routes to non-admin authenticated users
```

### Step 13.3 — Wire Fallbacks on All 3 Data Routes

```typescript
// Pattern for ALL admin server actions and API routes:
async function getAdminData() {
  try {
    const data = await (prisma as any).user.aggregate({ ... });
    return { ...data, source: 'live' };
  } catch (error) {
    Sentry.captureException(error);  // log but don't throw
    return FALLBACK_ADMIN_STATS;
  }
}

// Test: temporarily point DATABASE_URL to a non-existent DB in .env.test
// All 3 admin data endpoints must return 200 with fallback data
// Use supertest — never the production DB for this test
```

### Step 13.4 — Analytics Charts (Real Data)

Five endpoints with Redis TTL 300s each:

```typescript
// GET /api/admin/analytics/dau         → 30-day daily active users (count distinct userId)
// GET /api/admin/analytics/nrs         → NRS stamp success rate (stamped/total × 100)
// GET /api/admin/analytics/health      → health score distribution histogram (10-point buckets)
// GET /api/admin/analytics/filing-rate → % ComplianceEvents completed on or before dueDate
// GET /api/admin/analytics/revenue     → MRR from active Pro/Business plan users × monthly price
```

Frontend: Recharts `LineChart` / `BarChart`. No `Math.random()`. Show loading skeleton, not empty state, while fetching.

### Step 13.5 — Dark Mode

Tailwind config: `darkMode: 'media'`. Add `dark:` prefix variants throughout. Test with macOS/Windows dark mode toggle — admin panel must fully switch.

### Step 13.6 — Public Invoice Share Viewer

**File:** `admin/app/i/[token]/page.tsx`

```typescript
// Public route — no auth required
// Fetches invoice data via share token: GET /api/v1/invoices/share/{token}
// Displays: invoice details, NRS stamp status, IRN, QR code
// If token expired or not found: show "Invoice link has expired" (not 500)
// NRS verification link: links to NRS public portal with IRN pre-filled
// "Download PDF" button
```

**Commit:**
```bash
git add admin/
git commit -m "feat(admin): complete panel — 9 routes, adminAuth middleware, FALLBACK_* on all data routes, analytics charts (real data), public invoice share viewer, dark mode"
```

**Gate 13 complete when:** Admin loads at `http://localhost:3000`, all routes return 200, cold-start test passes (using test DB env), analytics charts render real data, public share viewer works.

---

## PHASE 14 — DOCUMENTATION

### Step 14.1 — Update `CHANGELOG.md`

```markdown
## [3.0.0] — 2026-02-26

### Added
- Animation vocabulary module (DURATION, EASE, ENTER_FROM) — ER-10
- DashboardZone 5-zone choreography with staggered reveal — ER-07
- DashboardSkeleton with geometry contract (0px layout shift) — ER-08
- SectionState machine replacing all raw ternary conditionals — ER-09
- TaxHealthGauge SVG arc (230°, compact/expanded, AMOLED-safe) — CF-01/ER-02
- Composite dashboard API (single call, Redis cached 120s TTL) — CF-03/ER-01
- ThemeContext + AMOLED true-black dark mode — CF-04/ER-03
- Tax health score algorithm (NRS 35% + filing 35% + anomaly 20% + data 10%)
- TaxHealthSnapshot daily cron + 30-day trend persistence — CF-05
- Anomaly detection engine — all 9 signals with NTA 2025 references
- VAT filing wizard (6-step, auto-populated, refund detection, NRS IRN)
- PAYE payroll engine (NTA 2025 §33 ±₦1 compliant) + payslip PDF + WhatsApp share
- Employee bulk CSV import (max 200 employees)
- 3-pass expense reconciliation (dedup + category + VAT)
- Document vault (AES-256-GCM, 5-year NTA §31 retention warnings)
- Push notifications via Expo push API (PII-free, dead-token cleanup)
- Invoice PDF generation (pdfkit, lazy cached, IRN watermark)
- Invoice share link (public viewer, 30-day token expiry)
- NRS real-time status via SSE (heartbeat 30s, circuit state propagation)
- NDPC §30 data export (async ZIP, 7-day download window)
- CSV bulk expense import (partial import, sanitised, anomaly re-scan)
- Multi-period tax comparison (up to 3 years)
- TaxAcademy lessons 11–12 (Development Levy + NDPC §30 rights)
- Security: Helmet, CORS allowlist, JWT refresh tokens, auth rate limiting
- Security: CSV input sanitisation (sanitize-html), IDOR guards on vault + PDF
- Admin: adminAuth middleware, public invoice share viewer
- CI/CD: GitHub Actions pipeline (contamination scans, PAYE gate, mock mode guard)
- prompts/ module system (10 modules, loader, bootstrap)
- .env.example files for all packages

### Fixed
- BUG-S01: Inter font not bundled → □ squares on bottom nav
- BUG-S02: "NRSt" typo in invoice modal i18n key
- BUG-S03: initImmediate not false → raw keys on offline cold start
- BUG-S04: COMMON.OFFLINE key missing from both locales
- CF-01: TaxHealthGauge was ProgressBar — now 230° SVG arc
- CF-02: Anomaly section was invisible — now in CONTEXT zone with SectionState
- CF-03: Dashboard made 3 waterfall API calls — now 1 composite with Promise.all
- CF-04: Dark mode tokens defined but never applied — ThemeContext now everywhere
- CF-05: No chart data infrastructure — TaxHealthSnapshot + /trends endpoint
- CF-06: Compliance calendar showed only 1 deadline — now all upcoming deadlines
- CF-07: useNrsHealth had no Pidgin error messages — all error states bilingual
- CF-08: No animation choreography — 5-zone stagger with DURATION/EASE vocabulary

### Removed
- CRA formula (abolished NTA 2025) — replaced by calculateRRA()
- Individual 1% gross minimum tax (abolished NTA 2025)
- 15% ETR applied to PIT paths (corporate MNE only)
- 20% CIT medium band (abolished NTA 2025)

### Security
- JWT single token replaced with access (15m) + refresh (7d) pattern
- CORS now uses explicit origin allowlist
- Auth routes rate limited: 10 attempts per 15 min per IP
- CSV import sanitised against XSS injection
- Admin routes protected by adminAuth middleware (email allowlist)
- Vault download endpoints verify document ownership (IDOR prevention)
```

### Step 14.2 — Update `README.md`

Must contain:
- Project summary and who it serves (Nigerian SMEs, sole traders, employers)
- Mermaid architecture diagram:

```mermaid
graph TD
  Mobile["📱 TaxBridge Mobile\n(Expo/React Native)"]
  Admin["🖥️ Admin Panel\n(Next.js + Tailwind)"]
  API["⚙️ Backend API\n(Node.js/Express)"]
  DB["🗄️ PostgreSQL\n(Render Managed)"]
  Cache["⚡ Redis\n(Upstash)"]
  NRS["🏛️ NRS DIGITAX\n(e-Invoice API)"]
  S3["☁️ Cloudflare R2\n(Documents + PDFs)"]
  Sentry["🔍 Sentry\n(Error Tracking)"]
  Expo["📨 Expo Push\n(Notifications)"]

  Mobile -->|HTTPS REST| API
  Admin -->|HTTPS REST| API
  API --> DB
  API --> Cache
  API -->|Stamp invoices| NRS
  API -->|Store documents| S3
  API -->|Errors + traces| Sentry
  API -->|Push notifications| Expo
```

- Prerequisites: Node 20, npm 10, Expo CLI, PostgreSQL 15
- Setup: clone → npm install → copy .env.example → fill values → `npx prisma migrate dev` → `npm run dev`
- First-time contributor: `npm run prompts:bootstrap` creates all context module stubs
- Live URLs section
- Contributing guide pointing to `/prompts/` folder

### Step 14.3 — Update `PRODUCTION_READY.md`

Update with V10.3 metrics, security hardening checklist, monitoring thresholds.

### Step 14.4 — Generate OpenAPI Spec

```bash
cd backend && npx swagger-jsdoc -d swaggerDef.js 'src/routes/**/*.ts' -o docs/openapi.json
```

Add JSDoc `@openapi` comments to all V10.3 endpoints if missing.

**Commit:**
```bash
git add CHANGELOG.md README.md PRODUCTION_READY.md docs/
git commit -m "docs: V10.3 — CHANGELOG with security additions, README Mermaid arch, OpenAPI spec"
```

---

## PHASE 15 — QUALITY ASSURANCE

**Purpose:** Every gate must pass before deployment begins. No exceptions.

### Step 15.1 — Full Type Check

```bash
for pkg in backend admin "packages/contracts"; do
  echo "=== TypeScript: $pkg ===" && \
  npx tsc --noEmit --project ${pkg}/tsconfig.json 2>&1 | grep "error TS" | head -20
done
# Mobile (react-native may have loose types):
cd mobile && npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "node_modules" | head -20
```

Zero `error TS` lines required from all four packages.

### Step 15.2 — Lint

```bash
npx eslint backend/src admin/src packages/contracts/src \
  --ext .ts,.tsx --max-warnings=0 --format=compact 2>&1 | tail -10
```

Zero warnings, zero errors.

### Step 15.3 — Security Audit

```bash
npm audit --audit-level=high 2>&1 | grep -E "found [0-9]+ vulnerabilities"
```

Zero HIGH or CRITICAL. Document any MODERATE with a ticket reference.

### Step 15.4 — Full Test Suite

```bash
npm test --workspaces 2>&1 | grep -E "Tests:|passing|failing|✓|✗" | tail -15
```

Must report ≥ 423 tests passing, 0 failing. If below 423: identify untested features (routes with < 3 tests), write the missing tests, re-run.

### Step 15.5 — Contamination Final Re-Scan

```bash
echo "--- Final Contamination Gate ---"
FIRS_COUNT=$(grep -rn "FIRS" . --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules | wc -l)
CRA_COUNT=$(grep -rn "CRA\|consolidatedRelief" packages/ backend/ mobile/ --include="*.ts" | wc -l)
MINTAX_COUNT=$(grep -rn "minimumTax\|minTax\|0\.01.*gross" packages/contracts/ --include="*.ts" | wc -l)
RAWDUR_COUNT=$(grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src --include="*.ts" --include="*.tsx" | grep -v "animation.ts" | wc -l)
MOCK_PROD=$(grep -r "DIGITAX_MOCK_MODE=true" backend/.env 2>/dev/null | wc -l)

echo "FIRS occurrences:         $FIRS_COUNT  (expect 0)"
echo "CRA/abolished formulas:   $CRA_COUNT   (expect 0)"
echo "Min tax references:       $MINTAX_COUNT (expect 0)"
echo "Raw animation durations:  $RAWDUR_COUNT (expect 0)"
echo "Mock mode in .env:        $MOCK_PROD   (expect 0 for production)"

[ "$FIRS_COUNT" -eq 0 ] && \
[ "$CRA_COUNT"  -eq 0 ] && \
[ "$MINTAX_COUNT" -eq 0 ] && \
[ "$RAWDUR_COUNT" -eq 0 ] && \
[ "$MOCK_PROD"  -eq 0 ] && \
echo "✅ All contamination scans clean" || echo "❌ Fix contamination before deploying"
```

ALL must be 0.

### Step 15.6 — PAYE Accuracy Gate

```bash
cd packages/contracts && npm test -- --grep "NTA 2025 §33"
# Must pass with ±₦1 tolerance. Do not change test expected value. Fix paye.ts if it fails.
```

### Step 15.7 — Performance Benchmark

```bash
# Create the k6 script if it doesn't exist
cat > scripts/k6/dashboard.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 100, duration: '30s', thresholds: { http_req_duration: ['p(95)<350'] } };

const TOKEN = __ENV.TEST_TOKEN;
export default function () {
  const res = http.get('http://localhost:3001/api/v1/dashboard', {
    headers: { 'Authorization': `Bearer ${TOKEN}` },
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.5);
}
EOF

# Run (requires k6 installed and a test JWT token)
TEST_TOKEN="your-test-token" k6 run scripts/k6/dashboard.js
```

Target: P95 < 350ms at 100 concurrent users.

**Contingency if P95 ≥ 350ms:**
1. Check `X-Cache` header on responses — should be `HIT` for most requests
2. If `MISS` on every request: Redis cache not working → check `REDIS_URL` and Redis connectivity
3. If cache is working but still slow: check that `Promise.all()` is not accidentally serialised (no `await` between calls)
4. Add missing database index if slow query log shows full table scans
5. Re-run benchmark after each fix

### Step 15.8 — Mobile Performance Check

On Android emulator (API 28, 2GB RAM — approximates mid-range Nigerian device):
```
□ DashboardScreen initial render: < 400ms (measured with Flipper or Systrace)
□ Zone reveal animation: 60fps (no jank in Perf Monitor during stagger)
□ TaxHealthGauge arc draw: smooth (no dropped frames during withTiming)
□ All Pressable taps: visual ack ≤ 100ms (scale(0.97) must appear before navigation)
□ Offline mode: data visible within 200ms of app open (cached React Query data)
```

**Gate 15 complete when:** TypeScript 0 errors, ESLint 0 warnings, security audit clean, ≥ 423 tests passing, all contamination scans 0, PAYE gate passes, P95 < 350ms, mobile perf targets met.

---

## PHASE 16 — GIT WORKFLOW

**Purpose:** Clean, reviewable commit history with proper branching and release tagging.

### Step 16.1 — Verify Branch and Clean State

```bash
git branch --show-current
# Must be: feat/v10.3-implementation
# If somehow on master: git stash && git checkout feat/v10.3-implementation && git stash pop

git status
# Must show: nothing to commit, working tree clean

git log --oneline -20
# Verify logical commit sequence matches Phases 1–14
```

### Step 16.2 — Push Feature Branch

```bash
git push origin feat/v10.3-implementation
# If this is the first push: git push -u origin feat/v10.3-implementation
```

### Step 16.3 — Create Pull Request

```bash
gh pr create \
  --title "feat: TaxBridge V10.3 — complete implementation" \
  --body "$(cat << 'PRBODY'
## Summary
Complete implementation of TaxBridge V10.3 — all P0, P1, and P2 features, security hardening, and CI/CD.

## Key Changes
- **Security:** JWT refresh tokens, CORS allowlist, auth rate limiting, CSV sanitisation, IDOR prevention
- **Tax Engine:** NTA 2025 fully compliant — PIT, RRA, PAYE, VAT, WHT, CIT, CGT, DevLevy
- **Dashboard:** 5-zone animated choreography, SVG gauge, skeleton (0px shift), SectionState machine
- **Features:** VAT wizard, PAYE + bulk employee import, reconciliation, vault, push, PDF, SSE, NDPC export
- **CI/CD:** GitHub Actions pipeline with contamination scans, PAYE gate, mock mode guard
- **Nigerian SME UX:** explicit QuickActions, Pidgin-first i18n, 2G-tolerant skeleton timing, WhatsApp payslip share

## All Gates Passed
- ✅ TypeScript: 0 errors (all 4 packages)
- ✅ ESLint: 0 warnings
- ✅ Tests: ≥ 423 passing, 0 failing
- ✅ PAYE §33 accuracy: ±₦1
- ✅ Security audit: 0 HIGH/CRITICAL
- ✅ FIRS occurrences: 0
- ✅ CRA/abolished formulas: 0
- ✅ Raw animation durations: 0
- ✅ DIGITAX_MOCK_MODE in .env: false
- ✅ i18n parity: all keys in both locales
- ✅ Performance: P95 < 350ms at 100 VUs
- ✅ Admin cold-start fallback: all 3 data routes return 200 when DB unreachable

## Nigerian SME Workflow Verification
- ✅ Artisan earning ₦720K/year: Band 1, tax = ₦0 (not ₦7,200 false minimum)
- ✅ 50-employee payroll: bulk CSV import + PAYE run completes < 10s
- ✅ Offline: all dashboard data visible, no raw i18n keys, no □ squares
- ✅ 2G simulation: DashboardScreen initial render < 400ms (skeleton shows immediately)
PRBODY
  )" \
  --base master \
  --head feat/v10.3-implementation
```

### Step 16.4 — Merge and Tag

```bash
gh pr merge --squash --delete-branch

git checkout master && git pull origin master

git tag -a v3.0.0 -m "TaxBridge V3.0.0 — V10.3 complete

Highlights:
- NTA 2025 fully compliant tax engine (±₦1 PAYE accuracy)
- 5-zone animated dashboard with 0px-shift skeleton
- Security hardened: JWT refresh, CORS, rate limiting, IDOR prevention
- Nigerian SME optimised: Pidgin i18n, 2G skeleton, WhatsApp payslip share
- All P0 bugs resolved: BUG-S01-S04, CF-01-CF-08
- CI/CD with contamination scans and PAYE accuracy gate"

git push origin v3.0.0
```

---

## PHASE 17 — PRODUCTION DEPLOYMENT

### Step 17.1 — Pre-Deployment Checklist

```bash
# Run ALL of these. Every item must be confirmed before deploying.
echo "Pre-deployment checklist:"

echo -n "1. DIGITAX_MOCK_MODE=false in production env: "
grep "DIGITAX_MOCK_MODE=false" backend/.env && echo "✅" || echo "❌ FIX THIS"

echo -n "2. NODE_ENV=production in backend: "
grep "NODE_ENV=production" backend/.env && echo "✅" || echo "⚠️ verify in Render env vars"

echo -n "3. No .env files staged: "
git diff --cached --name-only | grep -q "\.env$" && echo "❌ REMOVE .env FROM STAGING" || echo "✅"

echo -n "4. v3.0.0 tag exists: "
git tag | grep -q "v3.0.0" && echo "✅" || echo "❌"

echo -n "5. CI pipeline green on master: "
gh run list --limit 1 --branch master --json conclusion | grep -q '"conclusion":"success"' && echo "✅" || echo "❌ CHECK CI"
```

**Gate:** All 5 items must show ✅. If any fails, fix before proceeding.

### Step 17.2 — Backend Deployment (Render)

```bash
# Render auto-deploys on push to master. Monitor the deploy:
open https://dashboard.render.com/web/taxbridge-api
# Watch logs — important signals:
# "Running prisma migrate deploy" → migration applying
# "✓ Generated Prisma Client"     → schema updated
# "Server listening on port 3001" → deploy successful
```

**Required Render production environment variables** (verify in Render dashboard):

```
DATABASE_URL              → PostgreSQL internal connection string (Render-provided)
REDIS_URL                 → Upstash Redis URL (redis://default:TOKEN@HOST:PORT)
JWT_SECRET                → 32+ char random string
JWT_REFRESH_SECRET        → different 32+ char random string
JWT_EXPIRES_IN            → 15m
JWT_REFRESH_EXPIRES_IN    → 7d
DIGITAX_API_KEY           → NRS DIGITAX API key
DIGITAX_API_URL           → https://api.digitax.gov.ng
DIGITAX_MOCK_MODE         → false
AWS_ACCESS_KEY            → Cloudflare R2 access key
AWS_SECRET_KEY            → Cloudflare R2 secret key
AWS_BUCKET                → taxbridge-documents
AWS_REGION                → auto (Cloudflare R2 uses its own endpoint)
AWS_ENDPOINT              → https://ACCOUNT_ID.r2.cloudflarestorage.com
EXPO_ACCESS_TOKEN         → Expo push API token
SENTRY_DSN                → backend Sentry DSN
SENTRY_ENVIRONMENT        → production
CORS_ALLOWED_ORIGINS      → https://taxbridge.vercel.app,exp://[expo-go-url]
ALLOWED_ADMIN_EMAILS      → admin email(s) comma-separated
NODE_ENV                  → production
SMTP_HOST                 → SMTP provider host
SMTP_USER                 → noreply@taxbridge.ng
SMTP_PASS                 → SMTP password
FROM_EMAIL                → TaxBridge <noreply@taxbridge.ng>
```

**Configure Render health check:**
- Path: `/health`
- Interval: every 5 minutes (prevents cold start — free tier sleeps after 15 min)
- This replaces the need for an external UptimeRobot configuration

**Post-deploy verification:**

```bash
# Wait 3–5 minutes for deploy to complete, then:
curl -s https://taxbridge-api-ker8.onrender.com/health | python3 -m json.tool
# Expected: { "status": "ok", "version": "3.0.0", "db": "connected", "redis": "connected" }

curl -s https://taxbridge-api-ker8.onrender.com/api/v1/nrs/health | python3 -m json.tool
# Expected: { "state": "closed" }
```

**Contingency — migration failed during deploy:**
1. Connect to Render shell: Dashboard → Service → Shell
2. Run: `npx prisma migrate status` to see which migrations are pending
3. Run: `npx prisma migrate deploy` to apply manually
4. If migration has a conflict: `npx prisma migrate resolve --applied MIGRATION_NAME` after fixing

### Step 17.3 — Admin Deployment (Vercel)

```bash
# Vercel auto-deploys on push to master. Monitor:
open https://vercel.com/scardubu/taxbridge
```

**Required Vercel production environment variables:**

```
DATABASE_URL     → same Render PostgreSQL URL
NEXTAUTH_SECRET  → 32+ char random string
NEXTAUTH_URL     → https://taxbridge.vercel.app
SENTRY_DSN       → admin Sentry DSN (different project from backend)
ALLOWED_ADMIN_EMAILS → same as backend
```

**Post-deploy verification:**

```bash
curl -I https://taxbridge.vercel.app
# HTTP/2 200 — verify no HTTP → HTTPS redirect issues

curl -s https://taxbridge.vercel.app/api/health
# Expected: 200

# Admin fallback test (safe — uses Vercel preview env, not production DB):
# In Vercel dashboard → Preview env → set DATABASE_URL=postgresql://invalid@localhost/none
# Deploy preview → load preview URL → all admin routes must return 200 with fallback data
# Revert DATABASE_URL in preview env after confirming
```

### Step 17.4 — Mobile Deployment (EAS)

```bash
cd mobile

# Verify SDK versions (C-03 — never skip this)
node -e "const e=require('./eas.json'); console.log('compileSdkVersion:', e.build?.production?.android?.compileSdkVersion, '| targetSdkVersion:', e.build?.production?.android?.targetSdkVersion);"
# Must output: compileSdkVersion: 36 | targetSdkVersion: 35

# Update EXPO_PUBLIC_API_URL to production backend
echo "EXPO_PUBLIC_API_URL=https://taxbridge-api-ker8.onrender.com" > .env.production

# Build production Android bundle
eas build --platform android --profile production --non-interactive
# Monitor: https://expo.dev/accounts/scardubu/projects/taxbridge/builds
# Build time: ~15–25 minutes
# Expected result: "Build finished" with .aab download link
```

**If EAS build fails — common causes and fixes:**
```
AAR incompatibility:
  → Bump gradle cache key in eas.json build profile (add "1" to end of current key)
  → Ensure compileSdkVersion: 36

Missing native module:
  → Run: npx expo doctor
  → Install any flagged modules: npx expo install [module]

Font bundling error:
  → Confirm @expo-google-fonts/inter in package.json
  → Confirm useFonts() called in _layout.tsx

Node version mismatch:
  → Add to eas.json: "node": "20.x"
```

```bash
# Submit to Google Play Internal Testing
eas submit --platform android --latest --non-interactive

# OTA update for existing users (same JS bundle, no store review needed)
eas update --branch production --message "TaxBridge v3.0.0 — V10.3 complete"
```

### Step 17.5 — Configure Sentry Monitoring

```bash
# Verify backend errors are flowing
curl -X POST https://taxbridge-api-ker8.onrender.com/api/v1/admin/test-sentry \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Check Sentry dashboard for the test event within 30s

# Verify mobile source maps uploaded with build
# Sentry → taxbridge-mobile project → Source Maps → confirm build version present
```

**Configure Sentry alert rules (do this in Sentry dashboard):**

```
Alert 1: Error rate
  Condition: error_rate > 1%  over 5 minutes
  Action: Email + Slack (immediately)

Alert 2: P95 latency (backend)
  Condition: p95(transaction.duration) > 500ms  over 10 minutes
  Action: Email

Alert 3: NRS circuit opened
  Condition: event.level = 'warning' AND message CONTAINS 'circuit opened'
  Action: Email + Slack (immediately)

Alert 4: Android crash rate
  Condition: crash_rate > 0.1%  over 1 hour
  Action: Email + Slack

Alert 5: PAYE calculation error (critical — regulatory impact)
  Condition: any error from packages/contracts/ in production
  Action: PagerDuty (immediately)
```

### Step 17.6 — Post-Deploy Smoke Tests

Run all against production URLs:

```bash
echo "=== Production Smoke Tests ==="

# Backend health
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://taxbridge-api-ker8.onrender.com/health)
echo "Backend /health: $STATUS (expect 200)"

# NRS circuit
NRS=$(curl -s https://taxbridge-api-ker8.onrender.com/api/v1/nrs/health | grep -c '"closed"')
echo "NRS circuit closed: $NRS (expect 1)"

# Admin panel
ADMIN=$(curl -s -o /dev/null -w "%{http_code}" https://taxbridge.vercel.app)
echo "Admin panel: $ADMIN (expect 200)"

# Admin SSL
SSL=$(curl -s -I https://taxbridge.vercel.app | grep "^Strict-Transport" | wc -l)
echo "Admin HSTS header: $SSL (expect 1)"

# Tax engine accuracy (runs against production API if test user exists)
cd packages/contracts && npm test -- --grep "NTA 2025 §33" 2>&1 | grep -E "passing|failing"
```

### Step 17.7 — Automated Monitoring (Post-Deploy)

Configure these within 24 hours of deployment:

```
1. UptimeRobot (or similar) — free tier sufficient:
   Monitor: https://taxbridge-api-ker8.onrender.com/health
   Interval: Every 5 minutes
   Alert: Email on downtime > 2 minutes

2. Render built-in health check:
   Path: /health
   Timeout: 10s
   This keeps the service warm (prevents free-tier sleep)

3. Daily PAYE accuracy regression test:
   Schedule: 6am WAT daily (5am UTC)
   Command: cd packages/contracts && npm test -- --grep "NTA 2025 §33"
   Alert: Email if test fails

4. Weekly contamination scan:
   Schedule: Monday 6am WAT
   Command: scripts/weekly-contamination-scan.sh (create this file)
   Content: runs all 5 contamination scans, emails results
```

---

## PHASE 18 — FINAL VERIFICATION CHECKLIST

**Execute every item. Mark ✅ when confirmed. Do not declare completion until all items are checked.**

---

### 🔐 SECURITY

```
□ JWT refresh token pattern implemented (access 15m + refresh 7d)
□ Refresh tokens stored in HttpOnly Secure SameSite=Strict cookies
□ Auth routes rate-limited: 10 attempts / 15 min per IP
□ CORS allowlist: only explicit origins accepted (no wildcard *)
□ Helmet applied: HSTS, CSP, XSS protection headers present
□ CSV import: all string fields sanitised via sanitize-html
□ Vault download: ownership verified before presigned URL generated (no IDOR)
□ Admin routes: adminAuth middleware on all /admin/* routes
□ DIGITAX_MOCK_MODE=false in production (verified in Render env vars)
□ No .env files committed to git (verified: git log --all -- "*.env")
□ npm audit: 0 HIGH or CRITICAL vulnerabilities
□ Request IDs on all responses (X-Request-ID header visible)
```

### 🟢 CODE QUALITY

```
□ TypeScript: 0 errors in all 4 packages (backend, admin, contracts, mobile)
□ ESLint: 0 warnings, 0 errors
□ npm test: ≥ 423 passing, 0 failing
□ npm run prompts:build → "✅ All 10 modules verified."
□ npm run i18n:check → exits 0
□ Git: working tree clean, logical commit sequence
□ Git tag v3.0.0 exists and pushed
```

### 🔴 CONTAMINATION (ALL MUST BE ZERO)

```
□ grep "FIRS" codebase: 0 results
□ grep "NRSt" i18n files: 0 results
□ grep "CRA|consolidatedRelief" contracts/: 0 results
□ grep "minTax|0.01.*gross" contracts/: 0 results
□ grep "withTiming.*[0-9]{3,4}" (excluding animation.ts): 0 results
□ grep "No anomal|noAnomal" mobile/src: 0 results
□ grep "await.*router|router.*await" DashboardScreen: 0 results
□ grep "Math.random" (excluding node_modules): 0 results in chart/dashboard code
□ DIGITAX_MOCK_MODE=true in backend/.env: 0 results
```

### 🧮 TAX CORRECTNESS

```
□ calculatePIT({ grossIncome: 720_000 }) → totalTax: 0 (Band 1 fully exempt)
□ calculatePIT({ grossIncome: 4_000_000, rentPaid: 600_000 }) → totalTax: 510_000
□ calculateRRA({ annualRentPaid: 3_000_000 }) → { allowance: 500_000, capped: true }
□ calculateRRA({ annualRentPaid: 1_200_000 }) → { allowance: 240_000, capped: false }
□ calculateWHT({ category: 'professionalFees', amount: 500_000 }) → whtAmount: 50_000 (10%)
□ calculateWHT({ category: 'construction',     amount: 500_000 }) → whtAmount: 25_000 (5%)
□ calculateCIT({ turnover: 80_000_000, assets: 200_000_000, isProfessionalFirm: false }) → isSmallCompany: true, citPayable: 0
□ calculateCIT({ turnover: 150_000_000, profits: 30_000_000 }) → citPayable: 9_000_000
□ PAYE §33 gate test: passes to ±₦1 (do not change expected value)
□ 15% ETR: not referenced in any PIT or PAYE function
□ VAT registration threshold constant: 25_000_000 (not 100_000_000)
□ VAT standard rate: 0.075 (not 0.05 or 0.15)
□ CGT company rate: 0.30 (not 0.10)
□ Dev levy rate: 0.04 (not 0.02)
```

### 🎨 VISUAL & UX

```
□ Bottom nav: Inter font renders as icons (not □ squares) — verified on Android emulator
□ Dark mode: all surfaces use colors.* tokens (raw hex scan = 0 results in components)
□ Dark mode: StatusBar barStyle is 'light-content' when isDark
□ AMOLED dark: DARK_TOKENS.surface = '#000000' confirmed in tokens.ts
□ ThemeProvider: outermost wrapper in _layout.tsx (before QueryClientProvider)
□ TaxHealthGauge: renders SVG arc (Inspect → no ProgressBar in component tree)
□ TaxHealthGauge: arc animates on mount (EASE.gauge, DURATION.slow)
□ TaxHealthGauge: compact mode activates when daysRemaining ≤ 7
□ TaxHealthGauge: score=0 renders without NaN path errors
□ DashboardSkeleton → real content: 0px layout shift confirmed
□ All 5 zones present: grep returns exactly 5 zone= attributes
□ Zone stagger: apex 0ms → signal 80ms → action 160ms → context 240ms → ambient 320ms
□ Dashboard frame rate: ≥ 55fps during full zone reveal (Perf Monitor)
□ All interactive elements: scale(0.97) visual ack before navigation
□ No await before router.push() anywhere in DashboardScreen
□ Status indicators: 3 channels (color + shape/icon + text) on all 3 severity levels
□ Anomaly empty state: silence (no "no anomalies" text visible)
□ OfflineSyncStatus: visible in Airplane Mode, hidden when online
□ Offline mode: all dashboard data visible within 200ms (cached React Query)
□ QuickActions: 6 tiles in 3×2 grid, urgency-sorted correctly
□ ComplianceCalendar: shows ALL deadlines (not just 1)
□ Pidgin toggle: all strings read naturally (verified by native speaker or closest equivalent)
```

### 🔌 API & BACKEND

```
□ GET /health → 200, { status:'ok', version:'3.0.0', db:'connected', redis:'connected' }
□ GET /api/v1/dashboard → 200, single composite (1 call, not 3)
□ GET /api/v1/dashboard → X-Cache: HIT on second call (< 120s apart)
□ GET /api/v1/nrs/health → 200, { state: 'closed' }
□ GET /api/admin/dashboard → 200 even when DB is unreachable (FALLBACK_*)
□ GET /api/admin/users → 200 even when DB is unreachable (FALLBACK_*)
□ GET /api/admin/revenue → 200 even when DB is unreachable (FALLBACK_*)
□ POST /api/v1/vat/filing → 200 with filingReference
□ POST /api/v1/payroll/run → PAYE amounts match NTA 2025 §33 to ±₦1
□ POST /api/v1/payroll/employees/bulk → 50-row CSV imports correctly
□ POST /api/v1/expenses/reconcile → 200 with empty arrays (not error)
□ POST /api/v1/expenses/import → invalid rows skipped (partial import)
□ GET /api/v1/nrs/status-stream/:id → SSE stays open, heartbeat every 30s
□ GET /api/v1/vault/:id/download → 403 if userId doesn't own document (IDOR test)
□ All user financial routes: 401 without token
□ All admin routes: 403 for authenticated non-admin users
□ Auth rate limit: 11th login attempt within 15min returns 429
□ CORS: request from unlisted origin returns CORS error, not 200
```

### 📱 MOBILE BUILD

```
□ eas.json: compileSdkVersion: 36
□ eas.json: targetSdkVersion: 35
□ EAS build: successful (no AAR incompatibility errors in build log)
□ EAS submit: accepted by Google Play Internal Testing
□ OTA update: eas update --branch production deployed
□ Fonts: Inter_400Regular/500Medium/600SemiBold/700Bold all in useFonts() call
□ Offline: Airplane Mode → all strings visible (no raw keys)
□ Offline: icons visible (no □ squares)
□ Offline: dashboard data visible from cache
□ Push notifications: test notification received on physical device
```

### 🌐 DEPLOYMENT

```
□ Backend: https://taxbridge-api-ker8.onrender.com/health → 200
□ Backend: HTTPS enforced (HTTP redirects to HTTPS)
□ Admin: https://taxbridge.vercel.app → 200
□ Admin: HSTS header present (Strict-Transport-Security)
□ Admin: SSL certificate valid (no mixed content warnings)
□ Mobile: v3.0.0 in Google Play Internal Testing
□ Sentry: backend error events flowing (test event visible in dashboard)
□ Sentry: mobile source maps uploaded (test crash shows readable stack trace)
□ Sentry: all 5 alert rules configured
□ Render health check: configured to ping /health every 5 min (service warm)
□ DB backup: daily automated backup confirmed in Render dashboard
```

### 📊 PERFORMANCE

```
□ k6: P95 GET /api/v1/dashboard < 350ms at 100 VUs
□ Redis: dashboard:composite cache hit rate > 80% (verify with Upstash dashboard)
□ Mobile: DashboardScreen initial render < 400ms on mid-range Android (Flipper/Systrace)
□ Mobile: all taps produce visual ack ≤ 100ms
□ Mobile: zone reveal animation 60fps (Perf Monitor during stagger)
□ Sentry: P95 < 350ms in production dashboard (check 24h after deploy)
```

### 📚 DOCUMENTATION

```
□ CHANGELOG.md: V3.0.0 entry with Added/Fixed/Removed/Security sections
□ README.md: Mermaid architecture diagram, setup instructions, prompts/ explanation
□ PRODUCTION_READY.md: V10.3 metrics, security checklist, monitoring thresholds
□ docs/openapi.json: all V10.3 endpoints documented
□ prompts/: all 10 modules filled (run: grep -r "TODO" prompts/ | wc -l → must be 0)
□ DEPLOYMENT_v3.0.0_COMPLETE.md: created and committed
□ .env.example files: committed for all 3 packages
```

---

## COMPLETION DECLARATION

When every Phase 18 item is checked, create and commit the deployment record:

```bash
cat > DEPLOYMENT_v3.0.0_COMPLETE.md << EOF
# TaxBridge V3.0.0 — Deployment Complete

**Timestamp:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Prompt version:** V10.3 (Implementation Prompt v2.0 — Audited)
**Git tag:** v3.0.0
**Implementing engineer:** [your name or "Copilot / automated"]

## Live Production URLs
- Backend:  https://taxbridge-api-ker8.onrender.com
- Admin:    https://taxbridge.vercel.app
- Mobile:   Google Play Internal Testing — v3.0.0 (bundle: $(date +%Y%m%d))

## Quality Metrics at Deployment
- Tests passing:          [INSERT COUNT] / ≥ 423 required
- TypeScript errors:      0
- ESLint warnings:        0
- FIRS occurrences:       0
- CRA formula:            0
- Raw animation durations:0
- i18n missing keys:      0
- npm audit HIGH/CRIT:    0
- DIGITAX_MOCK_MODE prod: false
- PAYE §33 gate:          PASSED (±₦1)
- k6 P95 dashboard:       [INSERT]ms / < 350ms target

## P0 Defects Resolved
- BUG-S01: Inter font bundled — no □ squares ✅
- BUG-S02: NRSt typo corrected ✅
- BUG-S03: initImmediate:false — no raw keys offline ✅
- BUG-S04: COMMON.OFFLINE key added to both locales ✅
- CF-01: TaxHealthGauge → 230° SVG arc ✅
- CF-02: Anomaly section visible in CONTEXT zone ✅
- CF-03: Single composite API call (was 3 waterfall) ✅
- CF-04: ThemeContext active — dark mode works ✅
- CF-05: TaxHealthSnapshot + trends endpoint ✅
- CF-06: Multi-deadline ComplianceCalendar ✅
- CF-07: NRS Pidgin error messages complete ✅
- CF-08: 5-zone animation choreography ✅

## NTA 2025 Corrections Applied (All 9)
1. PIT bands corrected: 0%–25% (6 bands) ✅
2. CRA abolished → calculateRRA() ✅
3. Individual 1% minimum tax abolished ✅
4. 15% ETR scope: corporate MNE only ✅
5. VAT registration threshold: ₦25M ✅
6. CIT small company threshold: ₦100M ✅
7. CIT 20% medium band abolished ✅
8. WHT professional fees: 10% ✅
9. CGT company rate: 30% ✅

## Security Hardening Applied
- JWT refresh token pattern (access 15m + refresh 7d) ✅
- CORS explicit origin allowlist ✅
- Auth routes rate limited (10/15min per IP) ✅
- Helmet applied (HSTS, CSP, XSS headers) ✅
- CSV import input sanitised (sanitize-html) ✅
- Vault download IDOR prevention ✅
- Admin email allowlist middleware ✅
- CI mock mode guard (blocks MOCK_MODE=true merges) ✅

## Next Phase (P3 Platform Scale)
- MOD-27: Multi-user team accounts (5 roles)
- MOD-28: Referral engine
- MOD-24: USSD *347*123# + SMS channel
- MF-06:  Multi-period tax comparison UI enhancements
EOF

git add DEPLOYMENT_v3.0.0_COMPLETE.md
git commit -m "chore: deployment record v3.0.0 — V10.3 implementation complete"
git push origin master
echo "✅ TaxBridge V3.0.0 is live."
```

---

**The TaxBridge V10.3 implementation is complete.**

Every feature is live. Every gate has passed. Every NTA 2025 correction is applied and CI-protected against regression. Every security gap identified in the audit has been closed.

The sole trader in Aba can file their VAT return in under 5 minutes, in Pidgin, on 2G, without ever seeing a raw i18n key, a □ square, or an illegitimate ₦7,200 minimum tax that the law no longer requires.

That is the standard. It has been met.

---

*Implementation Prompt v2.0 — Audited & Hardened — February 26, 2026*
*Authority: `/prompts/master_prompt_v10.3.md` | Repo: `github.com/Scardubu/taxbridge`*
*Changes from v1.0: security foundation phase added, branch creation moved to Phase 0,*
*DIGITAX_MOCK_MODE production guard, JWT refresh pattern, CORS allowlist, auth rate limiting,*
*CSV sanitisation, vault IDOR prevention, admin email allowlist, CI/CD pipeline, employee bulk import,*
*explicit QuickActions with Nigerian SME context, gauge status labels in both languages,*
*quiz i18n namespace, VAT refund detection, payslip WhatsApp share, 2G performance targets,*
*flattenKeys() for nested i18n structure, admin load context corrected (backend-api not devops),*
*completion declaration heredoc fixed (EOF quotes prevent variable expansion — removed),*
*EmployeeRecord model added to schema, FilingStatus enum added, PAYE artisan zero-tax test added.*