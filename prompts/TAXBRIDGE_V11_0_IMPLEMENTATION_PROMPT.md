# TAXBRIDGE V11.0 — PRODUCTION IMPLEMENTATION PROMPT
> **Role:** TaxForge Elite — Principal Full-Stack & Mobile Systems Architect
> **Repo:** `github.com/Scardubu/taxbridge` | **Branch:** `impl-v11.0-complete`
> **Supersedes:** V10.3 Implementation Prompt (February 22, 2026)
> **Backend (Render):** https://taxbridge-api-ker8.onrender.com
> **Health:** https://taxbridge-api-ker8.onrender.com/api/v2/monitoring/health
> **Admin (Vercel):** https://taxbridge.vercel.app
> **Mobile:** Android APK via EAS → Google Play Internal Testing (v11.0.0)
> **Master Spec:** `/prompts/MASTER_PROMPT_V10.3.md` + V11.0 Engineering Spec
> **Execution Mode:** Autonomous, end-to-end. Read before writing. Gate before merging.

---

## MANDATORY SESSION OPENING

Execute all 6 commands **before touching a single file**. No exceptions.

```bash
# 1. Review recent history
cat CHANGELOG.md

# 2. Confirm production baseline
cat PRODUCTION_READY.md

# 3. Verify last deployment marker
cat DEPLOYMENT_v10.3_COMPLETE.md

# 4. FIRS eradication gate — must return 0 results or STOP
grep -rn "FIRS" backend/src mobile/src admin/src packages \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" \
  | grep -v "node_modules" | grep -v ".git"

# 5. NRSt i18n typo gate — must return 0 results or STOP
grep -rn "NRSt" mobile/src --include="*.json"

# 6. Render warm-up ping — eliminates cold-start during this session
# Render free/starter spins down after 15 min idle; wake it now
curl -s -o /dev/null -w "Render: %{http_code} in %{time_total}s\n" \
  https://taxbridge-api-ker8.onrender.com/api/v2/monitoring/health \
  || echo "⚠️  Cold start — will warm in ~30s. Continue setup."
```

**If Step 4 or 5 returns results → stop immediately, fix, re-run. Implementation begins only after clean gates.**

---

## IDENTITY CONTRACT

You carry production scar tissue from: Prisma stub crisis (52 TS errors, `218972e`), FIRS→NRS
migration, admin cold-start 500s, Android `compileSdkVersion` AAR failure, BUG-S01 through BUG-S04,
Reanimated worklet violation (scoreToArcPath called on JS thread), prom-client double-registration
crash, and Flutterwave HMAC verified against stringified Buffer (always returns false).

**You always:**
- Read `/prompts/MASTER_PROMPT_V10.3.md` + V11.0 spec before any implementation task
- Use `DURATION.*` / `EASE.*` from `design-system/animation.ts` — zero raw numeric durations
- Import ALL tax logic from `@taxbridge/contracts` — zero inline math anywhere
- Write every user-visible string to both `en.json` AND `pidgin.json` with natural Lagos Pidgin
- Cast Prisma queries as `(prisma as any).model` — never reference Prisma generated input types
- Bind Express to `0.0.0.0` and read port from `process.env.PORT` — required for Render
- Mark pure functions called inside `useAnimatedProps` / `useAnimatedStyle` with `'worklet'`

**You never:**
- Write `FIRS` anywhere in code, comments, strings, variables, docs, or migrations
- Apply 15% minimum ETR to individual PIT paths — it is corporate MNE only (NTA 2025 §47)
- Use the CRA formula — abolished; RRA (`min(20% × rent, ₦500k)`) is the replacement
- Fire 3+ separate API calls from dashboard mount — one composite endpoint only (C-14)
- Show "No anomalies found" text — anomaly empty state is `null`, always silent (C-19)
- Put `await` before `router.push()` — navigation must fire synchronously (C-20, ≤100ms)
- Call non-worklet functions inside Reanimated animated styles or props
- Use `JSON.stringify(buffer)` to produce webhook HMAC bodies — use `req.rawBody`
- Register prom-client metrics unconditionally — always guard with singleton pattern

---

## NTA 2025 CANONICAL CONSTANTS

> **Single source of truth:** `packages/contracts/src/constants.ts`
> Every deviation is a tax compliance defect and an audit liability.

```ts
// packages/contracts/src/constants.ts
export const NRS_STAMP_THRESHOLD           = 200_000;      // per invoice — UNCHANGED
export const VAT_RATE                      = 0.075;        // 7.5%
export const VAT_REGISTRATION_THRESHOLD    = 25_000_000;   // annual turnover (was ₦100M — RAISED)
export const VAT_SMALL_CO_EXEMPTION        = 100_000_000;  // turnover < ₦100M → no VAT reg required
export const SMALL_CO_CIT_THRESHOLD        = 100_000_000;  // raised from ₦25M
export const SMALL_CO_FIXED_ASSETS_MAX     = 250_000_000;  // fixed assets ceiling
export const WHT_DEFAULT_RATE             = 0.10;          // dividends, interest, rent, royalties
export const WHT_PROFESSIONAL_RATE        = 0.10;          // ← 10%, NOT 5% (V10.2 error — fixed)
export const WHT_CONSTRUCTION_RATE        = 0.05;          // 5% — construction/contracts ONLY
export const WHT_NONRESIDENT_RATE         = 0.04;          // flat on Nigerian-source income
export const WHT_MONTHLY_EXEMPTION_CAP    = 2_000_000;     // both TIN on file AND ≤₦2M/month
export const DEV_LEVY_RATE                = 0.04;          // 4% of assessable profits (replaces TET+NITDA+NASENI)
export const CIT_LARGE_RATE               = 0.30;          // turnover > ₦100M
export const CIT_SMALL_RATE               = 0.00;          // turnover ≤ ₦100M AND assets < ₦250M
export const CGT_INDIVIDUAL_RATE          = 'PIT_BAND';    // gains taxed at applicable PIT band
export const CGT_COMPANY_RATE             = 0.30;          // raised from 10%
export const CGT_SHARE_DISPOSAL_EXEMPTION = 150_000_000;   // raised from ₦100M
export const CGT_GAIN_EXEMPTION_CAP       = 10_000_000;    // chargeable gain threshold
export const CGT_LOSS_OFFICE_EXEMPTION    = 50_000_000;    // compensation for loss of office (was ₦10M)

// PIT Bands — NTA 2025 §33. Applied AFTER all deductions.
// CRA = ABOLISHED. RRA replaces it. Individual minimum tax = ABOLISHED.
// 15% minimum ETR = CORPORATE MNE ONLY. NEVER applied to individual PIT.
export const PIT_BANDS: ReadonlyArray<{ readonly limit: number; readonly rate: number }> = [
  { limit:  800_000, rate: 0.00 },  // Band 1 — fully exempt (was ₦300k → 7%)
  { limit: 2_200_000, rate: 0.15 },  // Band 2 (was 11%)
  { limit: 9_000_000, rate: 0.18 },  // Band 3 (was 15%)
  { limit: 13_000_000, rate: 0.21 }, // Band 4 (was 19%)
  { limit: 25_000_000, rate: 0.23 }, // Band 5 (was 21%)
  { limit: Infinity,   rate: 0.25 }, // Band 6 (was 24%)
];

// RRA — replaces the abolished CRA
export function calculateRRA(annualRentPaid: number): number {
  if (annualRentPaid <= 0) return 0;
  return Math.min(0.20 * annualRentPaid, 500_000);
}
```

```ts
// packages/contracts/src/pit.ts
import { PIT_BANDS, calculateRRA } from './constants';

export interface PITInput {
  grossIncome:     number;
  rentPaid?:       number;  // annual rent — for RRA
  pension?:        number;  // up to 8% of (basic + transport + housing)
  nhf?:            number;  // 2.5% of gross emoluments
  nhis?:           number;  // documented health insurance
  lifeInsurance?:  number;  // documented premiums
  mortgageInterest?: number; // owner-occupied, documented
}

export interface PITResult {
  grossIncome:      number;
  rra:              number;
  totalDeductions:  number;
  taxableIncome:    number;
  taxLiability:     number;
  effectiveTaxRate: number;
  bands:            ReadonlyArray<{ rate: number; base: number; tax: number }>;
}

export function calculatePIT(input: PITInput): PITResult {
  const rra            = calculateRRA(input.rentPaid ?? 0);
  const pension        = Math.max(0, input.pension        ?? 0);
  const nhf            = Math.max(0, input.nhf            ?? 0);
  const nhis           = Math.max(0, input.nhis           ?? 0);
  const lifeInsurance  = Math.max(0, input.lifeInsurance  ?? 0);
  const mortgageInt    = Math.max(0, input.mortgageInterest ?? 0);

  const totalDeductions = rra + pension + nhf + nhis + lifeInsurance + mortgageInt;
  const taxableIncome   = Math.max(0, input.grossIncome - totalDeductions);

  // No minimum tax floor (abolished). No CRA. No 15% ETR on individuals.
  let remaining = taxableIncome;
  let liability = 0;
  const bands: { rate: number; base: number; tax: number }[] = [];

  for (const { limit, rate } of PIT_BANDS) {
    if (remaining <= 0) break;
    const base = Math.min(remaining, limit);
    const tax  = base * rate;
    bands.push({ rate, base, tax });
    liability += tax;
    remaining -= base;
  }

  return {
    grossIncome:      input.grossIncome,
    rra,
    totalDeductions,
    taxableIncome,
    taxLiability:     liability,
    effectiveTaxRate: taxableIncome > 0 ? liability / taxableIncome : 0,
    bands,
  };
}
```

```ts
// packages/contracts/src/index.ts — public API surface
export { calculatePIT }  from './pit';
export { calculateVAT }  from './vat';
export { calculateWHT }  from './wht';
export { calculateCIT }  from './cit';
export { calculateCGT }  from './cgt';
export { calculateRRA }  from './constants';
export * from './constants';
export * from './rbac';

// @taxbridge/contracts — the ONLY place tax math lives (C-09)
// All calculation functions import from here. No inline tax math in backend/ or mobile/.
```

```ts
// packages/contracts/src/rbac.ts
export type UserRole = 'admin' | 'owner' | 'accountant' | 'employee' | 'viewer';
export const ROLE_HIERARCHY: Readonly<Record<UserRole, number>> = {
  admin: 5, owner: 4, accountant: 3, employee: 2, viewer: 1,
} as const;

// RBAC resource permission matrix
// ✓ = allowed at this role level (cumulative upward)
//
//  Resource                admin  owner  accountant  employee  viewer
//  Dashboard read            ✓      ✓        ✓          ✓        ✓
//  Invoices read             ✓      ✓        ✓          ✓        ✓
//  Invoices create/edit      ✓      ✓        ✓          ✓        —
//  Expenses create/edit      ✓      ✓        ✓          ✓        —
//  Payroll run               ✓      ✓        ✓          —        —
//  Tax filings submit        ✓      ✓        ✓          —        —
//  Documents vault           ✓      ✓        ✓          —        —
//  Team management           ✓      ✓        —          —        —
//  RBAC assign               ✓      ✓        —          —        —
//  Audit log read            ✓      —        —          —        —
//  System/admin panel        ✓      —        —          —        —
//  DLQ management            ✓      —        —          —        —
```

---

## EXECUTION SEQUENCE

---

### PHASE 0 — REPO INITIALIZATION

```bash
# Clone and create implementation branch
git clone https://github.com/Scardubu/taxbridge.git && cd taxbridge
git checkout -b impl-v11.0-complete

# Enforce Yarn Berry for deterministic, fast installs
corepack enable
yarn set version stable
# node-modules linker required for Expo/React Native compatibility
echo 'nodeLinker: node-modules' >> .yarnrc.yml
echo 'enableGlobalCache: true'  >> .yarnrc.yml

# Workspace directory structure
mkdir -p \
  backend/src/{routes/v1,routes/v2,middleware,services,workers,cron,metrics} \
  backend/prisma/seeds \
  mobile/src/{design-system,components/dashboard,components/shared,screens,hooks,i18n} \
  admin/src/{pages/admin,components,hooks,middleware} \
  packages/contracts/src \
  prompts/{core,backend,mobile,ai,payments,data,devops,monetization,loaders} \
  infra \
  scripts \
  docs

# Install all workspace dependencies
yarn install

# Bootstrap prompt modules (creates M00–M09 stubs if absent)
yarn prompts:bootstrap

# Verify all 10 prompt modules present
yarn prompts:verify

# Eradicate ALL legacy references — fix every result before proceeding
grep -rn "FIRS\|NRSt\|\.errors\.errors\|CRA\b\|minTax.*gross\|ETR.*PIT\|1%.*gross" \
  backend/src mobile/src packages --include="*.ts" --include="*.tsx" --include="*.json" \
  | grep -v "node_modules"
```

**Install new workspace dependencies:**

```bash
# Backend (Node.js / Express)
yarn workspace backend add \
  @sentry/node bullmq helmet cors express-rate-limit \
  passport passport-jwt jsonwebtoken prom-client ioredis \
  @aws-sdk/client-kms @aws-sdk/client-ssm zod node-cron \
  @taxbridge/contracts

yarn workspace backend add -D \
  @types/passport-jwt @types/jsonwebtoken @types/node-cron

# Mobile (Expo / React Native)
# Use npx expo install for Expo-managed deps — ensures version compatibility
npx expo install \
  @expo-google-fonts/inter expo-font expo-splash-screen \
  expo-haptics expo-image expo-secure-store \
  @react-native-async-storage/async-storage \
  react-native-reanimated react-native-gesture-handler \
  react-native-svg
yarn workspace mobile add \
  @sentry/react-native @tanstack/react-query \
  i18next react-i18next

# Admin (Next.js)
yarn workspace admin add \
  @sentry/nextjs @tanstack/react-query recharts \
  @radix-ui/react-dialog tailwindcss jose

# Remove any leftover react-query (v3) — use @tanstack/react-query (v5) only
yarn workspace mobile remove react-query 2>/dev/null || true
yarn workspace admin  remove react-query 2>/dev/null || true

# Audit for incompatible Expo packages and fix
npx expo-doctor
```

**Environment configuration:**

```bash
# backend/.env.development — local only, NEVER committed to git
cat > backend/.env.development << 'EOF'
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost:5432/taxbridge_dev
DATABASE_REPLICA_URL=postgresql://localhost:5432/taxbridge_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev_secret_minimum_32_characters_here
JWT_REFRESH_SECRET=dev_refresh_secret_minimum_32_chars
NRS_API_KEY=mock_nrs_key
FLUTTERWAVE_SECRET=mock_flw_secret
DIGITAX_MOCK_MODE=true
SENTRY_DSN=
ADMIN_ALLOWLIST=admin@taxbridge.ng
RENDER_EXTERNAL_URL=http://localhost:3000
EOF

# Add to .gitignore
echo 'backend/.env*' >> .gitignore
echo 'mobile/.env*'  >> .gitignore
echo '!backend/.env.example' >> .gitignore
git rm --cached backend/.env.* 2>/dev/null || true

# Create safe .env.example (no real values)
cat > backend/.env.example << 'EOF'
NODE_ENV=production
PORT=10000
DATABASE_URL=
DATABASE_REPLICA_URL=
REDIS_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
NRS_API_KEY=
FLUTTERWAVE_SECRET=
SENTRY_DSN=
ADMIN_ALLOWLIST=
RENDER_EXTERNAL_URL=
EOF
```

```ts
// backend/src/validateEnv.ts
// MUST be the first import in app.ts — hard crash on missing vars prevents silent misconfiguration
const REQUIRED_ALWAYS = [
  'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET',
  'NRS_API_KEY', 'PORT', 'NODE_ENV',
];
const REQUIRED_PRODUCTION = [
  'SENTRY_DSN', 'RENDER_EXTERNAL_URL', 'FLUTTERWAVE_SECRET',
];

const isProd   = process.env.NODE_ENV === 'production';
const required = isProd
  ? [...REQUIRED_ALWAYS, ...REQUIRED_PRODUCTION]
  : REQUIRED_ALWAYS;

const missing = required.filter(v => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`\n❌ MISSING ENV VARS: ${missing.join(', ')}\nApp cannot start.\n`);
}
console.log('✅ All required env vars present');
```

```ts
// backend/src/app.ts — canonical server entry point
import './validateEnv';              // MUST be first — hard crash before anything else loads
import express   from 'express';
import helmet    from 'helmet';
import cors      from 'cors';
import * as Sentry from '@sentry/node';

// Sentry must init before routes
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:         process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // PII scrubbing — pattern order: longest (BVN 11-digit) before shorter
    beforeSend(event) {
      const raw    = JSON.stringify(event);
      const masked = raw
        .replace(/\b\d{11}\b/g, '[BVN_REDACTED]')   // BVN: exactly 11 digits
        .replace(/\b\d{10}\b/g, '[ACCT_REDACTED]')  // account numbers
        .replace(/\b\d{8}\b/g,  '[TIN_REDACTED]');   // TIN: exactly 8 digits
        // Note: 4-digit years (2025, 2026) are safe — not matched by \b\d{8}\b
      try { return JSON.parse(masked); } catch { return event; }
    },
  });
}

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// trust proxy — Cloudflare + Render sit in front; required for correct req.ip in audit logs
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'"],
      styleSrc:      ["'self'", "'unsafe-inline'"],
      connectSrc:    ["'self'", "https://taxbridge-api-ker8.onrender.com"],
      frameAncestors:["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin:      ['https://taxbridge.vercel.app', 'https://app.taxbridge.ng'],
  credentials: true,
}));

// Parse JSON for standard routes; raw body preserved for webhook HMAC verification
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));

// Deprecation header on all v1 routes (sunset 2026-08-01)
app.use('/api/v1', (_req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 01 Aug 2026 00:00:00 GMT');
  res.set('Link', '</api/v2>; rel="successor-version"');
  next();
});

import dashboardRouter  from './routes/v1/dashboard';
import v2Router         from './routes/v2';
import webhookRouter    from './routes/webhooks';

app.use('/api/v1/dashboard',  dashboardRouter);
app.use('/api/v2',            v2Router);
app.use('/webhooks',          webhookRouter);

// Sentry error handler must be after routes
if (process.env.SENTRY_DSN) app.use(Sentry.Handlers.errorHandler());

// MUST bind to 0.0.0.0 — localhost silently fails on Render infrastructure
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ TaxBridge API on :${PORT} [${process.env.NODE_ENV}]`);
  import('./cron/orchestrator').then(({ startCronJobs }) => startCronJobs());
});

export default app;
```

**render.yaml — Infrastructure as Code (commit to repo root):**

```yaml
# render.yaml
services:
  - type: web
    name: taxbridge-api
    runtime: node
    region: frankfurt       # closest PoP to Nigerian users (WAT = UTC+1)
    plan: starter           # upgrade to standard for minInstances auto-scaling
    buildCommand: yarn workspace backend build
    startCommand: node backend/dist/app.js
    healthCheckPath: /api/v2/monitoring/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000        # Render default; app reads process.env.PORT dynamically
      - key: DATABASE_URL
        fromDatabase:
          name: taxbridge-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: taxbridge-redis
          type: redis
          property: connectionString
      - key: RENDER_EXTERNAL_URL
        fromService:
          name: taxbridge-api
          type: web
          property: host
      # Secrets — set via Render dashboard, never committed to repo
      - key: JWT_SECRET
        sync: false
      - key: JWT_REFRESH_SECRET
        sync: false
      - key: NRS_API_KEY
        sync: false
      - key: FLUTTERWAVE_SECRET
        sync: false
      - key: SENTRY_DSN
        sync: false

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

---

### PHASE 1 — FOUNDATION FIXES (P0 Blockers)

Execute in strict dependency order. Each step must pass its gate before proceeding.

---

#### Step 1 — Fix BUG-S01: Inter Font (Bottom Nav □ Squares)

```bash
npx expo install @expo-google-fonts/inter expo-font expo-splash-screen
```

```tsx
// mobile/src/app/_layout.tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ThemeProvider }       from '../hooks/useTheme';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient }         from '../services/queryClient';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Hold splash until fonts are ready — prevents □ squares on cold launch
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

---

#### Step 2 — Fix BUG-S02/S03/S04: i18n

```bash
# Fix NRSt typo in both locale files
sed -i 's/NRSt/NRS/g' mobile/src/i18n/en.json mobile/src/i18n/pidgin.json
# Verify zero results
grep -rn "NRSt" mobile/src/i18n/
```

```ts
// mobile/src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en     from './en.json';
import pidgin from './pidgin.json';

i18n.use(initReactI18next).init({
  resources:       { en: { translation: en }, pidgin: { translation: pidgin } },
  lng:             'en',
  fallbackLng:     'en',
  initImmediate:   false,   // BUG-S03: synchronous init — no raw key flash on offline cold start
  interpolation:   { escapeValue: false },
  react:           { useSuspense: false },
});

export default i18n;
```

**Minimum i18n additions — add to BOTH locale files:**

```jsonc
// en.json additions
{
  "common": {
    "offline":         "You're offline — showing cached data",
    "retry":           "Try again",
    "loading":         "Loading…",
    "error":           "Something went wrong"
  },
  "a11y": {
    "taxHealthGauge":  "Tax health score: {{score}} out of 100. Status: {{label}}."
  },
  "anomaly": {
    "signal4":         "Weekend spending detected",
    "signal5":         "Unregistered vendor TIN",
    "signal6":         "Unusual category shift",
    "signal7":         "VAT gap in income",
    "signal8":         "Exempt VAT applied incorrectly",
    "signal9":         "WHT filing gap"
  },
  "errors": {
    "insufficientRole": "You don't have permission to do that"
  }
}
```

```jsonc
// pidgin.json additions (natural Lagos Pidgin — NOT literal translation)
{
  "common": {
    "offline":         "Network no dey — we dey show you wetin we save",
    "retry":           "Try am again",
    "loading":         "E dey load…",
    "error":           "Something spoil"
  },
  "a11y": {
    "taxHealthGauge":  "Your tax health score na {{score}} out of 100. Status: {{label}}."
  },
  "anomaly": {
    "signal4":         "You spend money for weekend — e fit cause wahala",
    "signal5":         "Vendor TIN no dey — NRS go ask you later",
    "signal6":         "Your spending pattern don change plenty",
    "signal7":         "VAT gap dey for your income — check am",
    "signal8":         "You put VAT for something wey no suppose carry am",
    "signal9":         "WHT filing get gap — sort am before deadline"
  },
  "errors": {
    "insufficientRole": "You no get permission to do this"
  }
}
```

**i18n completeness check script (add to package.json scripts):**

```ts
// scripts/check-i18n.ts — run in CI: yarn i18n:check
import en     from '../mobile/src/i18n/en.json';
import pidgin from '../mobile/src/i18n/pidgin.json';

function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flatKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

const enKeys     = new Set(flatKeys(en));
const pidginKeys = new Set(flatKeys(pidgin));
const missing    = [...enKeys].filter(k => !pidginKeys.has(k));

if (missing.length > 0) {
  console.error(`❌ Missing Pidgin keys:\n${missing.map(k => `  - ${k}`).join('\n')}`);
  process.exit(1);
}
console.log(`✅ i18n complete: ${enKeys.size} keys in both locales`);
```

---

#### Step 3 — animation.ts (ER-10 — create before ANY component)

```ts
// mobile/src/design-system/animation.ts
// ER-10 ★ — ALL animation values live here. Zero raw numbers in components.
import { Easing } from 'react-native-reanimated';

export const DURATION = {
  instant:    100,   // tap feedback scale pulse (C-20 ≤100ms ack)
  fast:       200,   // urgent overrides, mode switches
  standard:   400,   // content entrance, layout changes, gauge resize
  deliberate: 600,   // chart arc draw-in, sparkline draw-in
  slow:       800,   // TaxHealthGauge arc sweep — emotional weight, NTA §33 precision
  skeleton:   1200,  // DashboardSkeleton shimmer — DO NOT CHANGE (tuned for 2G patience)
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
  below: { translateY: 12, opacity: 0 }, // signal, action, context
  scale: { scale: 0.92,   opacity: 0 }, // apex (gauge)
  above: { translateY: -8, opacity: 0 }, // urgent alerts
  fade:  { opacity: 0 },                 // ambient — no Y movement
} as const;

// Zone stagger delays (ms) — CF-08 choreography spec
export const ZONE_DELAY = {
  apex:    0,
  signal:  80,
  action:  160,
  context: 240, // overridden to 0ms when urgent=true (high-severity anomaly)
  ambient: 320,
} as const;
```

> **CI Gate:** `grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src --include="*.ts" --include="*.tsx" | grep -v "animation.ts"` → must return 0 results.

---

#### Step 4 — DashboardZone Component (ER-07)

```tsx
// mobile/src/components/dashboard/DashboardZone.tsx
import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { DURATION, EASE, ENTER_FROM, ZONE_DELAY } from '../../design-system/animation';

export type DashboardZoneName = 'apex' | 'signal' | 'action' | 'context' | 'ambient';

interface DashboardZoneProps {
  zone:     DashboardZoneName;
  visible:  boolean;
  urgent?:  boolean;      // HIGH/CRITICAL anomaly → context delay overrides to 0ms
  children: React.ReactNode;
}

export function DashboardZone({ zone, visible, urgent = false, children }: DashboardZoneProps) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(ENTER_FROM.below.translateY);
  const scale      = useSharedValue(zone === 'apex' ? ENTER_FROM.scale.scale : 1);

  const delay = (urgent && zone === 'context') ? 0 : ZONE_DELAY[zone];

  useEffect(() => {
    if (!visible) return;
    const cfg = { duration: DURATION.standard, easing: EASE.enter };
    opacity.value = withDelay(delay, withTiming(1, cfg));
    if (zone === 'apex') {
      scale.value = withDelay(delay, withTiming(1, cfg));
    } else if (zone !== 'ambient') {
      translateY.value = withDelay(delay, withTiming(0, cfg));
    }
  }, [visible, delay, zone, opacity, scale, translateY]); // exhaustive deps — no stale closures

  const animStyle = useAnimatedStyle(() => {
    if (zone === 'apex')    return { opacity: opacity.value, transform: [{ scale: scale.value }] };
    if (zone === 'ambient') return { opacity: opacity.value };
    return { opacity: opacity.value, transform: [{ translateY: translateY.value }] };
  });

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}
```

---

#### Step 5 — DashboardSkeleton (ER-08) — 0px Layout Shift Contract

```tsx
// mobile/src/components/dashboard/DashboardSkeleton.tsx
// Geometry contract: every block dimension MUST match rendered content ±0px
// Measure via React Native Profiler frame timeline — layout shift target: 0px
import { useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolateColor,
} from 'react-native-reanimated';
import { DURATION, EASE } from '../../design-system/animation';
import { useTheme } from '../../hooks/useTheme';

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
}

function SkeletonBlock({ width, height, borderRadius = 8 }: SkeletonBlockProps) {
  const shimmer = useSharedValue(0);
  const { isDark } = useTheme();

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: DURATION.skeleton, easing: EASE.shimmer }),
      -1,
      true,
    );
  }, [shimmer]);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      shimmer.value,
      [0, 1],
      isDark ? ['#1F2937', '#374151'] : ['#F3F4F6', '#E5E7EB'],
    ),
  }));

  return (
    <Animated.View
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius }, animStyle]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <ScrollView scrollEnabled={false}>
      {/* APEX — semicircle 200×110px + greeting 60%×24px */}
      <View style={{ alignItems: 'center', padding: 16, gap: 8 }}>
        <SkeletonBlock width={200} height={110} borderRadius={100} />
        <SkeletonBlock width="60%" height={24} />
      </View>

      {/* SIGNAL — 3 metric cards: 31% × 72px, flex row, 8px gap */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
        {[0, 1, 2].map(i => <SkeletonBlock key={i} width="31%" height={72} />)}
      </View>

      {/* ACTION — 6 squares: 30% × 64px, flex-wrap 3-col, 6px gap */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 8 }}>
        {[0, 1, 2, 3, 4, 5].map(i => <SkeletonBlock key={i} width="30%" height={64} />)}
      </View>

      {/* CONTEXT — header 40%×14px + 2 rows 100%×52px, 8px gap */}
      <View style={{ padding: 16, gap: 8 }}>
        <SkeletonBlock width="40%" height={14} />
        <SkeletonBlock width="100%" height={52} />
        <SkeletonBlock width="100%" height={52} />
      </View>

      {/* AMBIENT — 2 sparklines: 48% × 80px, flex row, 8px gap */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
        <SkeletonBlock width="48%" height={80} />
        <SkeletonBlock width="48%" height={80} />
      </View>
    </ScrollView>
  );
}
```

---

#### Step 6 — TaxHealthGauge SVG Arc (CF-01 / ER-02)

```tsx
// mobile/src/components/dashboard/TaxHealthGauge.tsx
// ER-02 ★ — NEVER substitute with ProgressBar (C-13). SVG arc only.
// 230° sweep arc centered at (cx, cy). Animates 0→score on mount via DURATION.slow + EASE.gauge.
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import { DURATION, EASE } from '../../design-system/animation';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface TaxHealthGaugeProps {
  score:            number;             // 0–100
  mode:             'expanded' | 'compact';
  accessibilityLabel: string;           // required — t('a11y.taxHealthGauge', { score, label })
}

// ⚠️  WORKLET — this function is called inside useAnimatedProps (UI thread).
//    It MUST be marked 'worklet'. Do not call any JS-thread-only APIs here.
function buildArcPath(score: number, size: number): string {
  'worklet';
  const r   = size * 0.4;
  const cx  = size / 2;
  const cy  = size / 2;
  const deg = -205 + 230 * (score / 100);
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1  = cx + r * Math.cos(toRad(-205));
  const y1  = cy + r * Math.sin(toRad(-205));
  const x2  = cx + r * Math.cos(toRad(deg));
  const y2  = cy + r * Math.sin(toRad(deg));
  const la  = 230 * (score / 100) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2}`;
}

// ⚠️  WORKLET — called on UI thread inside useAnimatedProps
function scoreToStroke(score: number): string {
  'worklet';
  if (score >= 75) return '#1DB954'; // green — healthy
  if (score >= 50) return '#F59E0B'; // amber — caution
  return '#DC2626';                   // red — critical
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'Caution';
  return 'Critical';
}

export function TaxHealthGauge({ score, mode, accessibilityLabel }: TaxHealthGaugeProps) {
  const size        = mode === 'expanded' ? 200 : 120;
  const strokeWidth = mode === 'expanded' ? 12 : 8;
  const animScore   = useSharedValue(0);

  useEffect(() => {
    animScore.value = withTiming(score, { duration: DURATION.slow, easing: EASE.gauge });
  }, [score, animScore]);

  // trackPath pre-computed (static, full 230° arc)
  const trackPath = useMemo(() => buildArcPath(100, size), [size]);

  const animProps = useAnimatedProps(() => ({
    d:      buildArcPath(animScore.value, size),
    stroke: scoreToStroke(animScore.value),
  }));

  return (
    <View
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: score }}
    >
      <Svg
        width={size}
        height={mode === 'expanded' ? size * 0.6 : size * 0.55}
        viewBox={`0 0 ${size} ${size * 0.6}`}
      >
        {/* Track arc */}
        <Path
          d={trackPath}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* Animated fill arc */}
        <AnimatedPath
          animatedProps={animProps}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* Score label — expanded mode only */}
        {mode === 'expanded' && (
          <SvgText
            x={size / 2}
            y={size * 0.44}
            textAnchor="middle"
            fontSize={28}
            fontWeight="700"
            fill={scoreToStroke(score)}
          >
            {score}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}
```

---

#### Step 7 — Composite Dashboard API (CF-03 / ER-01 / C-14)

```ts
// backend/src/routes/v1/dashboard.ts
// ONE endpoint — no waterfall (C-14). Redis cache 120s. Promise.all for parallel fetch.
// C-12: FALLBACK_* constants on any DB/service failure — never 500 on cold start.
import { Router }            from 'express';
import { authenticate }      from '../../middleware/auth';
import { requireRole }       from '../../middleware/requireRole';
import { rateLimit }         from '../../middleware/rateLimit';
import { redis }             from '../../services/redis';
import * as Sentry           from '@sentry/node';
import {
  FALLBACK_DASHBOARD_STATS,
  FALLBACK_ANOMALIES,
  FALLBACK_DEADLINES,
  FALLBACK_NRS_HEALTH,
} from '../../constants/fallbacks';
import {
  getDashboardStats,
  getTopAnomalies,
  getUpcomingDeadlines,
  getNrsHealth,
} from '../../services/dashboardService';

const router = Router();

router.get('/', authenticate, requireRole('viewer'), rateLimit(30), async (req, res) => {
  const userId   = (req as any).user.id;
  const cacheKey = `dashboard:composite:v1:${userId}`;

  // Cache hit
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        ...JSON.parse(cached),
        meta: { cached: true, cacheAge: await redis.ttl(cacheKey) },
      });
    }
  } catch {
    // Redis miss is non-fatal — proceed to live fetch
  }

  // Parallel live fetch — all failures fall back to constants (C-12)
  const [stats, topAnomalies, upcomingDeadlines, nrsHealth] = await Promise.all([
    getDashboardStats(userId).catch(e => { Sentry.captureException(e); return FALLBACK_DASHBOARD_STATS; }),
    getTopAnomalies(userId).catch(e => { Sentry.captureException(e); return FALLBACK_ANOMALIES; }),
    getUpcomingDeadlines(userId).catch(e => { Sentry.captureException(e); return FALLBACK_DEADLINES; }),
    getNrsHealth().catch(e => { Sentry.captureException(e); return FALLBACK_NRS_HEALTH; }),
  ]);

  const payload = { stats, topAnomalies, upcomingDeadlines, nrsHealth };

  // Non-blocking cache write — failure must never block the response
  redis.setex(cacheKey, 120, JSON.stringify(payload)).catch(err => {
    // Guard against partial JSON that would poison the cache
    Sentry.captureException(err, { level: 'warning' });
  });

  return res.status(200).json({ ...payload, meta: { cached: false } });
});

export default router;
```

**Render keep-alive cron (prevents cold-start on free/starter plan):**

```ts
// backend/src/cron/keepAlive.ts
// Pings health endpoint every 14 min — Render spins down after 15 min idle
export async function pingKeepAlive(): Promise<void> {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url || process.env.NODE_ENV !== 'production') return;
  try {
    const res = await fetch(`${url}/api/v2/monitoring/health`);
    if (!res.ok) console.warn(`⚠️  Keep-alive ping returned ${res.status}`);
  } catch (err) {
    console.warn('⚠️  Keep-alive ping error (non-fatal):', err);
  }
}
// Register in orchestrator: { name: 'keepAlive', schedule: '*/14 * * * *', handler: pingKeepAlive }
```

---

#### Step 8 — Canonical DashboardScreen (C-17 / C-18 / ER-07–ER-09 / UX-08–UX-10)

```tsx
// mobile/src/screens/DashboardScreen.tsx
// DO NOT deviate from this zone sequence or SectionState pattern (C-17, C-18)
import { useMemo, useCallback } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useDashboard }         from '../hooks/useDashboard';
import { DashboardZone }        from '../components/dashboard/DashboardZone';
import { DashboardSkeleton }    from '../components/dashboard/DashboardSkeleton';
import { TaxHealthGauge }       from '../components/dashboard/TaxHealthGauge';
import { SectionState }         from '../components/shared/SectionState';
import { Greeting }             from '../components/dashboard/Greeting';
import { MetricsRow }           from '../components/dashboard/MetricsRow';
import { QuickActionsGrid }     from '../components/dashboard/QuickActionsGrid';
import { TopAnomaliesSection }  from '../components/dashboard/TopAnomaliesSection';
import { ComplianceCalendar }   from '../components/dashboard/ComplianceCalendar';
import { TrendCharts }          from '../components/dashboard/TrendCharts';
import { OfflineSyncStatus }    from '../components/dashboard/OfflineSyncStatus';
import { UrgentDeadlineCard }   from '../components/dashboard/UrgentDeadlineCard';
import { SectionSkeletonRows }  from '../components/shared/SectionSkeletonRows';
import { InlineError }          from '../components/shared/InlineError';
import { useTranslation }       from 'react-i18next';
import { useTheme }             from '../hooks/useTheme';
import type { DashboardComposite } from '../types/dashboard';

// Pure function — safe to call in render scope
function computeGaugeMode(data: DashboardComposite | undefined): 'expanded' | 'compact' {
  if (!data) return 'expanded';
  const urgent  = data.upcomingDeadlines?.some(d => d.daysRemaining <= 7) ?? false;
  const overdue = data.upcomingDeadlines?.some(d => d.daysRemaining < 0)  ?? false;
  return (urgent || overdue) ? 'compact' : 'expanded';
}

export default function DashboardScreen() {
  const { data, isLoading, isRefetching, error, refetch } = useDashboard();
  const { t }      = useTranslation();
  const { colors } = useTheme();

  const gaugeMode      = useMemo(() => computeGaugeMode(data), [data]);
  const hasHighAnomaly = useMemo(
    () => data?.topAnomalies?.some(a => a.severity === 'high' || a.severity === 'critical') ?? false,
    [data],
  );

  // useCallback ensures stable reference — prevents unnecessary re-renders in child Pressables
  const handleRefetch = useCallback(() => { refetch(); }, [refetch]);

  // ONE skeleton gate — no other isLoading checks below this line (ER-08)
  if (isLoading && !data) return <DashboardSkeleton />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefetch}
          tintColor={colors.primary}
        />
      }
    >
      {/* APEX — gauge, greeting, urgent deadline (0ms delay) */}
      <DashboardZone zone="apex" visible={!isLoading}>
        <Greeting userName={data?.stats.userName} />
        <TaxHealthGauge
          score={data?.stats.taxHealthScore ?? 0}
          mode={gaugeMode}
          accessibilityLabel={t('a11y.taxHealthGauge', {
            score: data?.stats.taxHealthScore ?? 0,
            label: gaugeMode === 'compact' ? 'Compact' : 'Expanded',
          })}
        />
        {gaugeMode === 'compact' && data?.upcomingDeadlines?.[0] && (
          <UrgentDeadlineCard deadline={data.upcomingDeadlines[0]} />
        )}
      </DashboardZone>

      {/* SIGNAL — 3 metric cards (80ms delay) */}
      <DashboardZone zone="signal" visible={!isLoading}>
        <MetricsRow cards={computeMetricCards(data)} />
      </DashboardZone>

      {/* ACTION — 6 quick actions, context-aware sort (160ms delay) */}
      <DashboardZone zone="action" visible={!isLoading}>
        <QuickActionsGrid actions={computeQuickActions(data)} />
      </DashboardZone>

      {/* CONTEXT — anomalies + compliance calendar (240ms delay, 0ms if urgent) */}
      <DashboardZone zone="context" visible={!isLoading} urgent={hasHighAnomaly}>
        <SectionState
          data={data?.topAnomalies}
          isLoading={isLoading}
          error={error}
          isEmpty={(d) => d.length === 0}
          loading={<SectionSkeletonRows count={2} />}
          empty={null}  {/* C-19: SILENCE when no anomalies — never show "no anomalies" text */}
          errorView={<InlineError icon="🔍" message={t('dashboard.anomaliesLoadError')} onAction={handleRefetch} />}
        >
          {(anomalies) => <TopAnomaliesSection anomalies={anomalies} />}
        </SectionState>

        <SectionState
          data={data?.upcomingDeadlines}
          isLoading={isLoading}
          error={error}
          isEmpty={(d) => d.length === 0}
          loading={<SectionSkeletonRows count={1} />}
          empty={null}
          errorView={<InlineError icon="📅" message={t('dashboard.calendarLoadError')} onAction={handleRefetch} />}
        >
          {(deadlines) => <ComplianceCalendar deadlines={deadlines} />}
        </SectionState>
      </DashboardZone>

      {/* AMBIENT — trend sparklines + offline sync (320ms delay) */}
      <DashboardZone zone="ambient" visible={!isLoading}>
        <SectionState
          data={data?.stats.trend}
          isLoading={isLoading}
          error={error}
          isEmpty={(d) => !d || d.length === 0}
          loading={<SectionSkeletonRows count={1} />}
          empty={null}
          errorView={<InlineError icon="📈" message={t('dashboard.chartsLoadError')} onAction={handleRefetch} />}
        >
          {(trend) => <TrendCharts data={trend} />}
        </SectionState>
        <OfflineSyncStatus />
      </DashboardZone>
    </ScrollView>
  );
}
```

**useDashboard hook (ER-05 / C-14):**

```ts
// mobile/src/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { DashboardComposite } from '../types/dashboard';

export function useDashboard() {
  return useQuery<DashboardComposite>({
    queryKey:   ['dashboard', 'composite'],
    queryFn:    () => apiClient.get('/api/v1/dashboard').then(r => r.data),
    staleTime:  60_000,   // 60s — don't refetch if data is fresh (saves 2G data)
    gcTime:     300_000,  // 5min — keep in memory for background refresh
    retry:      2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000), // exponential backoff
  });
}
```

**Nigerian SME quick actions (context-aware sort):**

```ts
// mobile/src/components/dashboard/QuickActionsGrid.tsx
// Nigerian SME workflow: VAT filing, WHT remittance, PAYE payroll, expense reconciliation
// are the 4 highest-frequency actions — always surface first, ordered by urgency.
export function computeQuickActions(data: DashboardComposite | undefined): QuickAction[] {
  const today = new Date();

  const actions: QuickAction[] = [
    {
      id: 'vat-filing',
      label:   'File VAT',
      pidgin:  'Pay VAT',
      icon:    '🧾',
      route:   '/vat/file',
      urgent:  isDeadlineWithin(data?.upcomingDeadlines, 'VAT', 7),
    },
    {
      id: 'wht-remit',
      label:   'Remit WHT',
      pidgin:  'Pay WHT',
      icon:    '🏛️',
      route:   '/wht/remit',
      urgent:  isDeadlineWithin(data?.upcomingDeadlines, 'WHT', 7),
    },
    {
      id: 'paye-payroll',
      label:   'Run PAYE',
      pidgin:  'Pay Workers',
      icon:    '👥',
      route:   '/payroll/run',
      urgent:  isPayrollDue(today),
    },
    {
      id: 'add-expense',
      label:   'Add Expense',
      pidgin:  'Add Expense',
      icon:    '➕',
      route:   '/expenses/add',
      urgent:  false,
    },
    {
      id: 'nrs-invoice',
      label:   'New Invoice',
      pidgin:  'New Invoice',
      icon:    '📄',
      route:   '/invoices/new',
      urgent:  false,
    },
    {
      id: 'tax-health',
      label:   'Tax Report',
      pidgin:  'See Report',
      icon:    '📊',
      route:   '/reports/tax-health',
      urgent:  false,
    },
  ];

  // Urgent actions rise to the top — most relevant for Nigerian SME daily workflow
  return [...actions.filter(a => a.urgent), ...actions.filter(a => !a.urgent)];
}
```

---

### PHASE 2 — V11.0 GAP CLOSURES

---

#### MOD-28: RBAC Enforcement Layer

```ts
// backend/src/middleware/requireRole.ts
import { Response, NextFunction }   from 'express';
import { ROLE_HIERARCHY, UserRole } from '@taxbridge/contracts';
import { auditLog }                 from '../services/audit';
import type { AuthRequest }         from '../types/auth';

export function requireRole(minRole: UserRole) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user        = req.user;
    const userRank    = ROLE_HIERARCHY[user?.role as UserRole] ?? 0;
    const required    = ROLE_HIERARCHY[minRole];

    if (userRank < required) {
      // Fire-and-forget audit — access denial must not block the 403 response
      auditLog({
        actorId:   user?.id ?? 'anonymous',
        actorRole: user?.role ?? 'none',
        action:    'ACCESS_DENIED',
        resource:  req.path,
        ipAddress: req.ip ?? '0.0.0.0',
        userAgent: req.headers['user-agent'] ?? '',
      }).catch(() => {}); // non-fatal if audit write fails

      return res.status(403).json({
        error:    'INSUFFICIENT_ROLE',
        i18nKey:  'errors.insufficientRole',
        required: minRole,
      });
    }
    next();
  };
}

// Session invalidation on role change — invalidates ALL active tokens for user
export async function invalidateUserSessions(userId: string): Promise<void> {
  const { redis } = await import('../services/redis');
  await redis.del(`sessions:${userId}`);
  // role_version TTL = 90 days (maximum JWT access token lifetime)
  await redis.setex(`role_version:${userId}`, 60 * 60 * 24 * 90, Date.now().toString());
}
```

**Prisma schema additions — append to `backend/prisma/schema.prisma`:**

```prisma
enum UserRole    { admin owner accountant employee viewer }
enum AuditAction {
  ACCESS_DENIED RESOURCE_READ RESOURCE_WRITE RESOURCE_DELETE
  ROLE_CHANGE LOGIN LOGOUT PASSWORD_CHANGE EXPORT NRS_STAMP
}

// AuditLog — append-only, NDPC compliant. No updatedAt (immutability contract).
model AuditLog {
  id         String      @id @default(cuid())
  actorId    String
  actorRole  String
  action     AuditAction
  resource   String
  resourceId String?
  metadata   Json?
  ipAddress  String
  userAgent  String?
  createdAt  DateTime    @default(now())
  @@index([actorId, createdAt])
  @@index([action, createdAt])
  @@index([resource, createdAt])
}

model OnboardingProgress {
  id                  String    @id @default(cuid())
  userId              String    @unique
  currentStep         Int       @default(1)
  completed           Boolean   @default(false)
  skippedNRS          Boolean   @default(false)
  selectedObligations String[]  @default([])
  completedAt         DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
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

model AcademyNudge {
  id        String   @id @default(cuid())
  userId    String
  lessonId  Int
  trigger   String
  shown     Boolean  @default(false)
  dismissed Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, shown, dismissed])
}

// Performance indexes for Nigerian SME compliance queries
// (These complement existing models)
// @@index([Transaction: userId, createdAt(sort: Desc)])  → dashboard hot path
// @@index([AnomalyRecord: userId, severity, createdAt(sort: Desc)])  → top anomalies
// @@index([Invoice: userId, status, dueDate])  → compliance calendar
// @@index([TaxHealthSnapshot: userId, createdAt(sort: Desc)])  → trend sparklines
```

**Zero-downtime migration procedure:**

```bash
# Step 1: Add new columns as NULLABLE (backward-compatible schema)
npx prisma migrate dev --name "v11_step1_nullable_additions"

# Step 2: Deploy app code that handles both old and new schema
git push origin impl-v11.0-complete  # deploy to staging

# Step 3: Run backfill as background job (via BullMQ worker, not migration)
yarn workspace backend ts-node scripts/backfill-v11.ts

# Step 4: Add NOT NULL constraints and performance indexes in next migration
npx prisma migrate dev --name "v11_step2_constraints_indexes"

# ⚠️  Never run prisma migrate deploy between 08:00–20:00 WAT
# Schedule at 02:00–04:00 WAT; have rollback migration ready
# Migrations that lock tables (adding NOT NULL without default) require maintenance window
```

---

#### MOD-29: Onboarding Wizard (5-Step, Offline-Safe)

```tsx
// mobile/src/screens/OnboardingWizard.tsx
// Persists to AsyncStorage (offline) + backend (sync on reconnect)
// Resumes from last completed step on every app launch until completed=true
import { useState, useCallback } from 'react';
import { View }                   from 'react-native';
import { useTranslation }         from 'react-i18next';
import AsyncStorage               from '@react-native-async-storage/async-storage';
import { updateOnboardingProgress, markOnboardingComplete } from '../services/onboardingService';

type WizardStep = 1 | 2 | 3 | 4 | 5;
const ONBOARDING_KEY = 'taxbridge:onboarding:step';

export default function OnboardingWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const { i18n }        = useTranslation();

  const advance = useCallback((nextStep: WizardStep) => {
    // Synchronous state update — navigation fires before await (C-20 compliance)
    setStep(nextStep);
    // Persist in background — failure must not block navigation
    Promise.all([
      AsyncStorage.setItem(ONBOARDING_KEY, String(nextStep)),
      updateOnboardingProgress({ currentStep: nextStep }),
    ]).catch(console.warn);
  }, []);

  const handleLanguage = useCallback((lang: 'en' | 'pidgin') => {
    i18n.changeLanguage(lang);
    AsyncStorage.setItem('taxbridge:locale', lang).catch(() => {});
    advance(2);
  }, [i18n, advance]);

  const handleSkipNRS = useCallback(() => {
    // Persist skipped flag then advance — skipped state allows retry from Settings
    updateOnboardingProgress({ skippedNRS: true }).catch(console.warn);
    advance(5);
  }, [advance]);

  const handleComplete = useCallback(async () => {
    await markOnboardingComplete();
    // Navigation to dashboard handled by root navigator guard detecting completed=true
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {step === 1 && (
        // Step 1: Language — fully offline, no network (AsyncStorage only)
        <WelcomeStep onSelectLanguage={handleLanguage} />
      )}
      {step === 2 && (
        // Step 2: Business profile — TIN validation with NRS lookup, TaxAcademy Lesson 1 nudge
        <BusinessProfileStep onComplete={() => advance(3)} />
      )}
      {step === 3 && (
        // Step 3: Tax obligations — illustrated cards for VAT/PIT/CIT/PAYE/WHT
        // Minimum 1 selection required. Info icons → TaxAcademy lesson snippets
        <TaxObligationsStep onComplete={() => advance(4)} />
      )}
      {step === 4 && (
        // Step 4: NRS connection — circuit-status aware
        // State A (circuit closed): OAuth-style NRS auth
        // State B (circuit open): warning + retry ETA + Skip option
        // State C (success): green checkmark + stamp test result
        <NRSConnectionStep
          onConnect={() => advance(5)}
          onSkip={handleSkipNRS}
        />
      )}
      {step === 5 && (
        // Step 5: Dashboard tour — coach marks on gauge, anomaly section, quick actions
        // Final CTA: "View Dashboard" / "Enter Dashboard" (Pidgin)
        <DashboardTourStep onComplete={handleComplete} />
      )}
    </View>
  );
}
```

**Root navigator guard — check onboarding state on every cold launch:**

```tsx
// mobile/src/app/_layout.tsx — add inside RootLayout after fonts loaded
useEffect(() => {
  async function checkOnboarding() {
    try {
      const res = await getOnboardingProgress();
      if (!res?.completed) {
        router.replace('/onboarding');
      }
    } catch {
      // Network failure — if local storage shows completed, proceed to dashboard
      const localStep = await AsyncStorage.getItem('taxbridge:onboarding:step').catch(() => null);
      if (!localStep || parseInt(localStep) < 5) {
        router.replace('/onboarding');
      }
    }
  }
  if (fontsLoaded) checkOnboarding();
}, [fontsLoaded]);
```

---

#### MOD-30: Observability Stack

```ts
// backend/src/metrics.ts
// ⚠️  SINGLETON GUARD — prom-client crashes on hot reload (nodemon/ts-node) if
// metrics are registered twice on the same Registry. Persist in global to survive
// module reloads. All metrics use the same singleton registry.
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

declare global {
  // eslint-disable-next-line no-var
  var __taxbridge_prom_registry: Registry | undefined;
}

const register = global.__taxbridge_prom_registry ?? new Registry();
if (!global.__taxbridge_prom_registry) {
  global.__taxbridge_prom_registry = register;
  register.setDefaultLabels({ app: 'taxbridge', version: process.env.npm_package_version ?? '11.0.0' });
}

// Safe factory — returns existing metric if already registered (avoids crash on hot reload)
function safeMetric<T>(factory: () => T, name: string): T {
  const existing = register.getSingleMetric(name);
  if (existing) return existing as unknown as T;
  return factory();
}

export const httpDuration = safeMetric(() => new Histogram({
  name:       'taxbridge_api_request_duration_seconds',
  help:       'API request duration',
  labelNames: ['route', 'method', 'status'] as const,
  buckets:    [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers:  [register],
}), 'taxbridge_api_request_duration_seconds');

export const nrsStampSuccess = safeMetric(() => new Counter({
  name:      'taxbridge_nrs_stamp_success_total',
  help:      'NRS e-invoice stamp successes',
  registers: [register],
}), 'taxbridge_nrs_stamp_success_total');

export const nrsStampFailure = safeMetric(() => new Counter({
  name:       'taxbridge_nrs_stamp_failure_total',
  help:       'NRS e-invoice stamp failures',
  labelNames: ['reason'] as const,
  registers:  [register],
}), 'taxbridge_nrs_stamp_failure_total');

export const anomalyDetected = safeMetric(() => new Counter({
  name:       'taxbridge_anomaly_detected_total',
  help:       'Anomalies detected by signal engine',
  labelNames: ['signal', 'severity'] as const,
  registers:  [register],
}), 'taxbridge_anomaly_detected_total');

export const dlqDepth = safeMetric(() => new Gauge({
  name:       'taxbridge_dlq_depth',
  help:       'Unresolved DLQ jobs by queue name',
  labelNames: ['queue_name'] as const,
  registers:  [register],
}), 'taxbridge_dlq_depth');

export const cacheHitRatio = safeMetric(() => new Gauge({
  name:       'taxbridge_cache_hit_ratio',
  help:       'Redis cache hit ratio by key pattern',
  labelNames: ['pattern'] as const,
  registers:  [register],
}), 'taxbridge_cache_hit_ratio');

export { register };
```

```ts
// backend/src/routes/v2/monitoring.ts
import { Router }       from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole }  from '../../middleware/requireRole';
import { register }     from '../../metrics';

const router = Router();

// Public — no auth. Used by Render health check + keep-alive cron.
router.get('/health', (_req, res) => {
  res.status(200).json({
    status:  'healthy',
    version: process.env.npm_package_version ?? '11.0.0',
    ts:      new Date().toISOString(),
    env:     process.env.NODE_ENV,
  });
});

// Prometheus-format metrics — admin only
router.get('/metrics', authenticate, requireRole('admin'), async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
```

**Grafana alert thresholds:**

```yaml
# infra/grafana/alerts.yml
alerts:
  - name: API Error Rate
    expr: rate(taxbridge_api_request_duration_seconds_count{status=~"5.."}[5m]) > 0.01
    for: 2m
    labels:   { severity: critical }
    annotations: { summary: "Error rate >1% for 2min → PagerDuty" }

  - name: Dashboard p99 Latency
    expr: histogram_quantile(0.99, taxbridge_api_request_duration_seconds_bucket{route="/api/v1/dashboard"}) > 2
    for: 5m
    labels:   { severity: warning }
    annotations: { summary: "Dashboard p99 >2s → Slack #ops" }

  - name: DLQ Depth
    expr: sum(taxbridge_dlq_depth) > 10
    for: 15m
    labels:   { severity: warning }
    annotations: { summary: "DLQ depth >10 → check NRS API health" }

  - name: Auth Failure Flood
    expr: rate(taxbridge_anomaly_detected_total{signal="auth_failure"}[1m]) > 10
    for: 1m
    labels:   { severity: critical }
    annotations: { summary: "Auth failure flood — possible credential stuffing" }
```

---

#### MOD-31: Event Bus + Cron Orchestrator

```ts
// backend/src/services/eventBus.ts
import EventEmitter from 'events';

const bus = new EventEmitter();
bus.setMaxListeners(30); // default 10 is too low for all subscribers

export const eventBus = bus;
```

```ts
// backend/src/services/anomalyEngine.ts
import { eventBus }  from './eventBus';
import { prisma }    from './prisma';
import { anomalyDetected } from '../metrics';

export async function detectAnomalies(userId: string, transaction: unknown): Promise<void> {
  const signals = await runAllSignals(userId, transaction);

  for (const signal of signals) {
    const record = await (prisma as any).anomalyRecord.create({
      data: { userId, ...signal },
    });
    // Increment Prometheus counter
    anomalyDetected.inc({ signal: signal.type, severity: signal.severity });
    // Emit event — subscribers handle cache, notifications, and audit
    eventBus.emit('anomaly.detected', {
      userId,
      recordId:  record.id,
      severity:  signal.severity,
      signal:    signal.type,
    });
  }
}
```

```ts
// backend/src/cron/orchestrator.ts
// All cron jobs registered here. No scattered setInterval calls elsewhere.
import nodeCron from 'node-cron';
import { eventBus }              from '../services/eventBus';
import { redis }                 from '../services/redis';
import { runTaxHealthSnapshot }  from './taxHealthSnapshot';
import { sendAnomalyNotification } from '../services/notifications';
import { writeAuditLog }         from '../services/audit';
import { dlqDepth }              from '../metrics';
import { pingKeepAlive }         from './keepAlive';

// ── Event-Driven Wiring ──
// anomaly.detected → invalidate cache + immediate snapshot (HIGH/CRITICAL) + notification + audit
eventBus.on('anomaly.detected', async ({ userId, recordId, severity, signal }) => {
  // Always invalidate dashboard cache — stale data after new anomaly is unacceptable
  redis.del(`dashboard:composite:v1:${userId}`).catch(() => {});

  // Immediate snapshot recompute for HIGH and CRITICAL — bypass 6-hour cron
  if (severity === 'HIGH' || severity === 'CRITICAL') {
    await runTaxHealthSnapshot(userId).catch(console.error);
    await sendAnomalyNotification(userId, { severity, signal }).catch(console.error);
  }

  // Immutable audit record (NDPC requirement)
  writeAuditLog({
    actorId:    'SYSTEM',
    actorRole:  'system',
    action:     'RESOURCE_WRITE',
    resource:   'anomalyRecord',
    resourceId: recordId,
    metadata:   { severity, signal, userId },
    ipAddress:  '0.0.0.0',
    userAgent:  'TaxBridge-AnomalyEngine/11.0',
  }).catch(console.error);
});

// ── Scheduled Cron Jobs ──
type CronJob = { name: string; schedule: string; handler: () => Promise<void> };

const CRON_JOBS: CronJob[] = [
  // Every 6h — recompute tax health scores for all active users
  { name: 'taxHealthSnapshot',  schedule: '0 */6 * * *',    handler: () => runTaxHealthSnapshotAll() },
  // Every 30min — drain NRS stamp queue
  { name: 'nrsQueueDrain',      schedule: '*/30 * * * *',   handler: () => drainNrsQueue() },
  // Daily 9:00 WAT (8:00 UTC) — compliance filing reminders
  { name: 'complianceReminder', schedule: '0 8 * * *',      handler: () => sendComplianceReminders() },
  // Weekly Monday 8:00 WAT — anomaly digest for business owners
  { name: 'anomalyDigest',      schedule: '0 7 * * 1',      handler: () => sendWeeklyAnomalyDigest() },
  // Daily 2:00 WAT (1:00 UTC) — expire old sessions
  { name: 'sessionCleanup',     schedule: '0 1 * * *',      handler: () => expireOldSessions() },
  // Every 15min — alert ops if DLQ depth > 10
  { name: 'dlqAlert',           schedule: '*/15 * * * *',   handler: () => alertOnDLQDepth() },
  // Every 14min — Render keep-alive (spins down after 15min idle)
  { name: 'keepAlive',          schedule: '*/14 * * * *',   handler: pingKeepAlive },
];

export function startCronJobs(): void {
  for (const job of CRON_JOBS) {
    nodeCron.schedule(job.schedule, async () => {
      try {
        await job.handler();
      } catch (err) {
        console.error(`[CRON:${job.name}] failed:`, err);
        // Non-fatal — log and continue. Critical failures captured by Sentry.
      }
    });
    console.log(`✅ Cron registered: ${job.name} (${job.schedule})`);
  }
}

// Update DLQ gauge and alert if depth exceeds threshold
async function alertOnDLQDepth(): Promise<void> {
  const { prisma } = await import('../services/prisma');
  const counts = await (prisma as any).dLQJob.groupBy({
    by: ['queueName'],
    where: { resolved: false },
    _count: true,
  });
  let totalDepth = 0;
  for (const row of counts) {
    const depth = row._count;
    dlqDepth.labels({ queue_name: row.queueName }).set(depth);
    totalDepth += depth;
  }
  if (totalDepth > 10) {
    console.warn(`🚨 DLQ alert: ${totalDepth} unresolved jobs across ${counts.length} queues`);
    // TODO: send Slack webhook to #ops
  }
}
```

**Webhook HMAC verification (Flutterwave):**

```ts
// backend/src/routes/webhooks/flutterwave.ts
import crypto from 'crypto';
import { Router } from 'express';
import * as Sentry from '@sentry/node';

const router = Router();

// ⚠️  req.rawBody is available because app.use('/webhooks', express.raw(...)) is set in app.ts
//    Never use JSON.stringify(req.body) for HMAC — body has already been parsed.
//    req.rawBody is the original Buffer. Convert to string with .toString('utf8').
function verifyFlutterwaveSignature(rawBody: Buffer, secret: string, receivedHash: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody.toString('utf8'))  // ← correct: raw bytes as UTF-8 string
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(receivedHash, 'hex'),
  );
}

router.post('/flutterwave', (req, res) => {
  const secret   = process.env.FLUTTERWAVE_SECRET!;
  const received = req.headers['verif-hash'] as string;

  if (!received || !verifyFlutterwaveSignature(req.body as Buffer, secret, received)) {
    Sentry.captureMessage('Flutterwave webhook HMAC verification failed', 'warning');
    return res.status(401).json({ error: 'INVALID_SIGNATURE' });
  }

  // Parse body now that signature is verified
  const event = JSON.parse((req.body as Buffer).toString('utf8'));
  processPaymentEvent(event).catch(Sentry.captureException);
  return res.status(200).json({ received: true });
});

export default router;
```

---

### PHASE 3 — EAS BUILD OPTIMIZATION

**eas.json — full production configuration:**

```json
{
  "cli": {
    "version": ">= 7.0.0",
    "requireCommit": true,
    "promptToConfigurePushNotifications": false
  },
  "build": {
    "base": {
      "cache": {
        "key": "taxbridge-v11-base-{{ hashFiles('yarn.lock') }}",
        "paths": ["node_modules", "mobile/node_modules", ".yarn/cache"]
      },
      "env": {
        "EXPO_PUBLIC_APP_VERSION": "11.0.0"
      }
    },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      },
      "cache": {
        "key": "taxbridge-v11-dev-{{ hashFiles('yarn.lock') }}-{{ hashFiles('mobile/package.json') }}"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "http://localhost:3000",
        "DIGITAX_MOCK_MODE": "true",
        "SENTRY_DSN": ""
      }
    },
    "staging": {
      "extends": "base",
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "compileSdkVersion": 36,
        "targetSdkVersion": 35,
        "gradleCommand": ":app:assembleRelease"
      },
      "cache": {
        "key": "taxbridge-v11-staging-{{ hashFiles('yarn.lock') }}-{{ hashFiles('mobile/app.json') }}"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://taxbridge-api-ker8.onrender.com",
        "DIGITAX_MOCK_MODE": "false",
        "SENTRY_DSN": "REPLACE_WITH_SENTRY_DSN"
      }
    },
    "production": {
      "extends": "base",
      "distribution": "store",
      "android": {
        "buildType": "app-bundle",
        "compileSdkVersion": 36,
        "targetSdkVersion": 35
      },
      "cache": {
        "key": "taxbridge-v11-prod-{{ hashFiles('yarn.lock') }}-{{ hashFiles('packages/contracts/src/index.ts') }}"
      },
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://taxbridge-api-ker8.onrender.com",
        "DIGITAX_MOCK_MODE": "false",
        "SENTRY_DSN": "REPLACE_WITH_SENTRY_DSN"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./infra/google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**Build commands:**

```bash
# Local APK — fast testing, no EAS queue wait
eas build --platform android --profile development --local

# Staging APK — EAS cloud build
eas build --platform android --profile staging

# Production AAB — Play Store submission
eas build --platform android --profile production

# OTA update — JS-only fixes, no full rebuild (post-launch hotfixes only)
# Use for: Pidgin copy fixes, NTA rate corrections, UI tweaks
# Never use for: native module changes, Expo SDK upgrades, schema migrations
eas update --branch production --message "fix: WHT display rate correction"
```

**Asset compression pre-build:**

```bash
# scripts/compress-assets.sh
#!/usr/bin/env bash
# Requires: pngquant, sharp (via npx)
echo "Compressing PNG assets..."
find mobile/assets -name "*.png" -exec pngquant --force --quality=65-85 --output {} {} \;
echo "Converting WebP for remote images (handled by expo-image at runtime)"
echo "✅ Asset compression complete"
```

```jsonc
// Add to mobile/package.json scripts
{
  "scripts": {
    "compress:assets": "bash ../../scripts/compress-assets.sh",
    "prebuild": "yarn compress:assets",
    "build:apk": "eas build --platform android --profile staging",
    "build:aab": "eas build --platform android --profile production",
    "build:local": "eas build --platform android --profile development --local",
    "update:prod": "eas update --branch production"
  }
}
```

**metro.config.js — tree-shaking and bundle optimization:**

```js
// mobile/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drop console.* in production builds — reduces bundle size, removes debug leaks
config.transformer.minifierConfig = {
  keep_classnames: false,
  keep_fnames:     false,
  mangle:          { toplevel: false },
  output:          { ascii_only: true, quote_style: 3, wrap_iife: true },
  compress: {
    unused:       true,
    dead_code:    true,
    drop_console: process.env.NODE_ENV === 'production',
    drop_debugger: true,
  },
};

// Replace lodash with lodash-es at bundle time for tree-shaking
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'lodash') {
    return context.resolveRequest(context, 'lodash-es', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Exclude heavy modules not needed on mobile
config.resolver.blockList = [
  /.*\/backend\/.*/,    // never bundle server code
  /.*\/admin\/.*/,      // never bundle admin panel
  /.*\.test\.(ts|tsx)/, // no test files in production bundle
];

module.exports = config;
```

**React Native performance — implement as you build each component:**

```tsx
// ✅ Memoize list items — prevents re-renders on every dashboard refresh
export const AnomalyCard = React.memo(({ anomaly, onPress }: AnomalyCardProps) => {
  const handlePress = useCallback(() => {
    router.push(`/anomalies/${anomaly.id}`); // synchronous — C-20 ≤100ms
  }, [anomaly.id]);
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      {/* content */}
    </Pressable>
  );
}, (prev, next) => prev.anomaly.id === next.anomaly.id && prev.anomaly.severity === next.anomaly.severity);

// ✅ Lazy load non-critical screens — TaxAcademy is not in the critical render path
const TaxAcademyScreen = React.lazy(() => import('../screens/TaxAcademyScreen'));

// ✅ expo-image for all remote content — WebP, blur placeholder, memory+disk cache
import { Image } from 'expo-image';
<Image
  source={{ uri: imageUrl }}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
/>

// ✅ @tanstack/react-query for server state — never Redux for API data
// Server state → React Query | UI state → Context | Global sync state → Zustand (if needed)
```

---

### PHASE 4 — ADMIN PANEL (taxbridge.vercel.app)

```js
// admin/next.config.js
/** @type {import('next').NextConfig} */
module.exports = {
  swcMinify: true,
  images: {
    remotePatterns: [{
      protocol: 'https',
      hostname:  'taxbridge-api-ker8.onrender.com',
    }],
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options',        value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
        {
          key:   'Content-Security-Policy',
          // unsafe-eval required for Next.js dev HMR only — remove in production if possible
          value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://taxbridge-api-ker8.onrender.com; img-src 'self' data:; frame-ancestors 'none'",
        },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      ],
    }];
  },
};
```

**Admin Next.js middleware — Edge Runtime compatible JWT with `jose`:**

```bash
yarn workspace admin add jose
```

```ts
// admin/src/middleware.ts
import { NextResponse }     from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify }        from 'jose'; // jose works in Edge Runtime; jsonwebtoken does NOT
import { ROLE_HIERARCHY }   from '@taxbridge/contracts';

// JWT verification — Edge Runtime (no Node crypto, no fs, no process)
async function verifyToken(token: string): Promise<{ role: string; userId: string } | null> {
  try {
    const secret       = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload }  = await jwtVerify(token, secret);
    return { role: payload.role as string, userId: payload.sub as string };
  } catch {
    return null;
  }
}

// Route → minimum role rank required
const ROUTE_REQUIREMENTS: Record<string, number> = {
  '/admin/system':    5, // admin only
  '/admin/audit':     5, // admin only
  '/admin/dlq':       5, // admin only
  '/admin/analytics': 4, // owner+
  '/admin/team':      4, // owner+
  '/admin/settings':  3, // accountant+
};

export async function middleware(req: NextRequest) {
  const token    = req.cookies.get('auth-token')?.value;
  const user     = token ? await verifyToken(token) : null;
  const userRank = user
    ? (ROLE_HIERARCHY[user.role as keyof typeof ROLE_HIERARCHY] ?? 0)
    : 0;

  // Find the most specific matching route requirement
  const pathname = req.nextUrl.pathname;
  const required = Object.entries(ROUTE_REQUIREMENTS)
    .filter(([route]) => pathname.startsWith(route))
    .reduce((max, [, rank]) => Math.max(max, rank), 1);

  if (userRank < required) {
    const loginUrl = new URL('/admin/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(userRank === 0 ? loginUrl : new URL('/admin/unauthorized', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

**Admin dashboard:**

```tsx
// admin/src/pages/admin/dashboard.tsx
import { useQuery } from '@tanstack/react-query';

interface AdminMetrics {
  dau:            { today: number; delta: number };
  nrsStamps:      { success: number; failure: number };
  openAnomalies:  number;
  dlqDepth:       number;
  nrsCircuit:     'closed' | 'open' | 'half-open';
}

export default function AdminDashboard() {
  const { data: metrics, isLoading } = useQuery<AdminMetrics>({
    queryKey:       ['admin-metrics'],
    queryFn:        () => fetch('/api/v2/admin/metrics').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    refetchInterval: 30_000, // live ops monitoring
    retry:           3,
    staleTime:       25_000,
  });

  const dlqAlert = (metrics?.dlqDepth ?? 0) > 10;

  return (
    <main style={{ padding: '24px' }}>
      <h1>TaxBridge Operations Dashboard</h1>
      <NRSCircuitBadge state={metrics?.nrsCircuit} />
      <MetricsGrid items={[
        { label: 'DAU',          value: metrics?.dau.today,          delta: metrics?.dau.delta },
        { label: 'NRS Stamps',   value: metrics?.nrsStamps.success                            },
        { label: 'Open Anomaly', value: metrics?.openAnomalies                               },
        { label: 'DLQ Depth',   value: metrics?.dlqDepth, alert: dlqAlert                    },
      ]} loading={isLoading} />
      <RecentAuditLog />
      <ComplianceReminderStatus />
    </main>
  );
}
```

```json
// admin/vercel.json
{
  "framework": "nextjs",
  "buildCommand": "cd ../.. && yarn workspace admin build",
  "outputDirectory": ".next",
  "installCommand": "corepack enable && yarn install --immutable",
  "env": {
    "NEXT_PUBLIC_API_URL":     "https://taxbridge-api-ker8.onrender.com",
    "NEXT_PUBLIC_APP_VERSION": "11.0.0"
  },
  "rewrites": [
    {
      "source":      "/api/v2/:path*",
      "destination": "https://taxbridge-api-ker8.onrender.com/api/v2/:path*"
    }
  ],
  "functions": {
    "src/pages/api/**/*.ts": { "maxDuration": 30 }
  }
}
```

---

### PHASE 5 — CI/CD PIPELINE

```yaml
# .github/workflows/pipeline.yml
name: TaxBridge V11.0 CI/CD

on:
  push:         { branches: [main, 'release/*'] }
  pull_request: { branches: [main] }

env:
  NODE_VERSION: '20'

jobs:
  # ────────────────────────────────────────────
  # STAGE 1 — QUALITY GATES (parallel)
  # ────────────────────────────────────────────
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: yarn }
      - run: corepack enable && yarn install --immutable

      - name: Lint all workspaces
        run: yarn workspaces foreach -A run lint

      - name: TypeScript strict check
        run: yarn workspaces foreach -A run type-check

      - name: FIRS compliance gate (zero occurrences required)
        run: |
          count=$(grep -rn "FIRS" backend/src mobile/src admin/src packages \
            --include="*.ts" --include="*.tsx" --include="*.json" | wc -l)
          [ "$count" -eq "0" ] && echo "✅ FIRS gate passed" \
            || (echo "❌ FIRS found: $count occurrences" && exit 1)

      - name: Animation token gate (no raw durations in components)
        run: |
          count=$(grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src \
            --include="*.ts" --include="*.tsx" | grep -v "animation.ts" | wc -l)
          [ "$count" -eq "0" ] && echo "✅ Animation gate passed" \
            || (echo "❌ Raw animation durations: $count occurrences" && exit 1)

      - name: compileSdkVersion integrity (must be 36)
        run: |
          result=$(grep -c '"compileSdkVersion": 36' mobile/eas.json)
          [ "$result" -ge "2" ] && echo "✅ compileSdkVersion gate passed" \
            || (echo "❌ compileSdkVersion not 36 in both staging and production profiles" && exit 1)

      - name: i18n completeness check
        run: yarn i18n:check

  test:
    needs: lint-typecheck
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:   { POSTGRES_PASSWORD: test, POSTGRES_DB: taxbridge_test, POSTGRES_USER: test }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: yarn }
      - run: corepack enable && yarn install --immutable

      - name: Apply Prisma migrations to test DB
        run: yarn workspace backend prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/taxbridge_test

      - name: Seed deterministic smoke-test user
        run: yarn workspace backend ts-node prisma/seeds/smokeTestUser.ts
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/taxbridge_test
          JWT_SECRET:   test_secret_minimum_32_chars_0000

      - name: Run full test suite
        run: yarn workspaces foreach -A run test -- --coverage --ci --runInBand
        env:
          NODE_ENV:           test
          DATABASE_URL:       postgresql://test:test@localhost:5432/taxbridge_test
          REDIS_URL:          redis://localhost:6379
          JWT_SECRET:         test_secret_minimum_32_chars_0000
          JWT_REFRESH_SECRET: test_refresh_secret_32_chars_0000
          NRS_API_KEY:        mock_nrs_key
          PORT:               3001
          DIGITAX_MOCK_MODE:  'true'

      - name: Coverage gate (≥95% lines, ≥95% functions, ≥90% branches)
        run: npx nyc check-coverage --lines 95 --functions 95 --branches 90

  security:
    needs: lint-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: yarn }
      - run: corepack enable && yarn install --immutable

      - name: Snyk vulnerability scan (no HIGH or CRITICAL)
        run: npx snyk test --all-projects --severity-threshold=high
        env: { SNYK_TOKEN: '${{ secrets.SNYK_TOKEN }}' }

      - name: Verify validateEnv.ts is present and imported first
        run: |
          grep -r "validateEnv\|MISSING ENV VAR" backend/src/app.ts \
            && echo "✅ validateEnv check passed" \
            || (echo "❌ validateEnv not imported in app.ts" && exit 1)

      - name: Verify no .env files committed
        run: |
          git ls-files | grep -E '\.env\.' | grep -v '\.env\.example' \
            && (echo "❌ .env file committed to repo" && exit 1) || echo "✅ No .env files committed"

  # ────────────────────────────────────────────
  # STAGE 2 — PARALLEL BUILDS (requires Stage 1)
  # ────────────────────────────────────────────
  build-backend:
    needs: [test, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: yarn }
      - run: corepack enable && yarn install --immutable
      - run: yarn workspace backend build
      - uses: actions/upload-artifact@v4
        with: { name: backend-dist, path: backend/dist, retention-days: 1 }

  build-admin:
    needs: [test, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: yarn }
      - run: corepack enable && yarn install --immutable
      - run: yarn workspace admin build
        env:
          NEXT_PUBLIC_API_URL:     https://taxbridge-api-ker8.onrender.com
          NEXT_PUBLIC_APP_VERSION: '11.0.0'
          JWT_SECRET:              ${{ secrets.JWT_SECRET }}  # needed for middleware.ts at build

  build-mobile-apk:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: yarn }
      - run: corepack enable && yarn install --immutable

      - name: Compress PNG assets pre-build
        run: |
          which pngquant || sudo apt-get install -y pngquant
          yarn workspace mobile compress:assets

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build Android APK (staging profile)
        run: |
          cd mobile
          # Wait for build to complete so smoke tests can run against it
          eas build --platform android --profile staging --non-interactive
        env: { EXPO_TOKEN: '${{ secrets.EXPO_TOKEN }}' }

  # ────────────────────────────────────────────
  # STAGE 3 — DEPLOYMENTS (requires Stage 2)
  # ────────────────────────────────────────────
  deploy-backend:
    needs: [build-backend, security]  # security must pass before touching production
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Validate production secrets are set
        run: |
          required=(DATABASE_URL REDIS_URL NRS_API_KEY JWT_SECRET JWT_REFRESH_SECRET SENTRY_DSN)
          for var in "${required[@]}"; do
            [ -z "${!var}" ] && echo "❌ MISSING SECRET: $var" && exit 1 || echo "✓ $var"
          done
          echo "✅ All production secrets present"
        env:
          DATABASE_URL:       ${{ secrets.DATABASE_URL }}
          REDIS_URL:          ${{ secrets.REDIS_URL }}
          NRS_API_KEY:        ${{ secrets.NRS_API_KEY }}
          JWT_SECRET:         ${{ secrets.JWT_SECRET }}
          JWT_REFRESH_SECRET: ${{ secrets.JWT_REFRESH_SECRET }}
          SENTRY_DSN:         ${{ secrets.SENTRY_DSN }}

      - name: Blue-green deploy to Render
        run: |
          # Deploy to inactive (green) slot
          render deploy --service taxbridge-api-green --wait \
            --api-key "$RENDER_API_KEY"

          # Health check green slot — must return HTTP 200 {"status":"healthy"}
          curl -f --retry 5 --retry-delay 10 --retry-connrefused \
            https://taxbridge-api-green.onrender.com/api/v2/monitoring/health

          # Swap traffic: green becomes production
          render traffic swap --from green --to prod --api-key "$RENDER_API_KEY"

          echo "✅ Blue-green swap complete. Blue slot standing by for rollback."
        env: { RENDER_API_KEY: '${{ secrets.RENDER_API_KEY }}' }

  deploy-admin:
    needs: [build-admin]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: yarn }
      - run: corepack enable && yarn install --immutable
      - name: Deploy to Vercel (taxbridge.vercel.app)
        run: |
          npx vercel --prod \
            --token="${{ secrets.VERCEL_TOKEN }}" \
            --cwd admin \
            --env NEXT_PUBLIC_API_URL=https://taxbridge-api-ker8.onrender.com \
            --env JWT_SECRET=${{ secrets.JWT_SECRET }}

  # ────────────────────────────────────────────
  # STAGE 4 — SMOKE TESTS (requires Stage 3)
  # ────────────────────────────────────────────
  smoke-test:
    needs: [deploy-backend, deploy-admin]
    runs-on: ubuntu-latest
    steps:
      - name: Wait for Render warm-up after blue-green swap
        run: sleep 20

      - name: Backend health check
        run: |
          curl -f --retry 3 --retry-delay 5 \
            https://taxbridge-api-ker8.onrender.com/api/v2/monitoring/health \
            | grep '"status":"healthy"'

      - name: Dashboard composite endpoint
        run: |
          # Use seeded smoke-test user credentials
          TOKEN=$(curl -s -X POST \
            https://taxbridge-api-ker8.onrender.com/api/v1/auth/login \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" \
            | jq -r '.accessToken')

          [ -z "$TOKEN" ] && echo "❌ Login failed" && exit 1

          curl -f -H "Authorization: Bearer $TOKEN" \
            https://taxbridge-api-ker8.onrender.com/api/v1/dashboard \
            | jq '.stats | .taxHealthScore' | grep -E '^[0-9]+$'

          echo "✅ Dashboard composite smoke test passed"
        env:
          SMOKE_EMAIL:    ${{ secrets.SMOKE_TEST_EMAIL }}
          SMOKE_PASSWORD: ${{ secrets.SMOKE_TEST_PASSWORD }}

      - name: RBAC enforcement (viewer must get 403 on admin route)
        run: |
          VIEWER_TOKEN=$(curl -s -X POST \
            https://taxbridge-api-ker8.onrender.com/api/v1/auth/login \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" \
            | jq -r '.accessToken')

          STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -X PATCH \
            -H "Authorization: Bearer $VIEWER_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"userId":"fake","role":"admin"}' \
            https://taxbridge-api-ker8.onrender.com/api/v2/rbac/assign)

          [ "$STATUS" = "403" ] && echo "✅ RBAC smoke test passed" \
            || (echo "❌ RBAC not enforced: expected 403, got $STATUS" && exit 1)
        env:
          SMOKE_EMAIL:    ${{ secrets.SMOKE_TEST_EMAIL }}
          SMOKE_PASSWORD: ${{ secrets.SMOKE_TEST_PASSWORD }}

      - name: Admin panel accessible
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://taxbridge.vercel.app)
          [ "$STATUS" = "200" ] && echo "✅ Admin panel accessible" \
            || (echo "❌ Admin panel returned $STATUS" && exit 1)

      - name: NRS circuit status
        run: |
          curl -s https://taxbridge-api-ker8.onrender.com/api/v2/monitoring/health \
            | jq -r '.nrs.state // "closed"' | grep -E "closed|half-open" \
            && echo "✅ NRS circuit check passed" || echo "⚠️  NRS circuit open — expected in some environments"

  # ────────────────────────────────────────────
  # STAGE 5 — TAG AND RELEASE (requires smoke tests)
  # ────────────────────────────────────────────
  release:
    needs: [smoke-test]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Create release tag (idempotent)
        run: |
          git config user.email "ci@taxbridge.ng"
          git config user.name  "TaxBridge CI"
          # Idempotent — skip if tag already exists (prevents double-run failure)
          git tag -a v11.0.0 -m "TaxBridge V11.0 — Intelligent Operations Layer" 2>/dev/null \
            || echo "Tag v11.0.0 already exists — skipping"
          git push origin v11.0.0 2>/dev/null || echo "Tag already pushed"

      - name: Create GitHub Release (idempotent)
        run: |
          gh release view v11.0.0 > /dev/null 2>&1 \
            && echo "Release already exists — skipping" \
            || gh release create v11.0.0 \
              --title "TaxBridge V11.0 — Intelligent Operations & Deployment Completion Layer" \
              --notes-file CHANGELOG.md \
              --latest
        env: { GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
```

---

### PHASE 6 — HUSKY PRE-COMMIT HOOKS

```bash
# Install and configure Husky
yarn add -D husky lint-staged
npx husky init
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-commit gates..."

# Gate 1: FIRS eradication
COUNT=$(grep -rn "FIRS" backend/src mobile/src admin/src packages \
  --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | wc -l)
if [ "$COUNT" -gt "0" ]; then
  echo "❌ FIRS found ($COUNT occurrences). NRS is the correct term. Fix before committing."
  exit 1
fi

# Gate 2: Raw animation durations
COUNT=$(grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src \
  --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "animation.ts" | wc -l)
if [ "$COUNT" -gt "0" ]; then
  echo "❌ Raw animation durations found ($COUNT). Use DURATION.* tokens from animation.ts."
  exit 1
fi

# Gate 3: NRSt typo
COUNT=$(grep -rn "NRSt" mobile/src/i18n/ 2>/dev/null | wc -l)
if [ "$COUNT" -gt "0" ]; then
  echo "❌ NRSt typo found ($COUNT). Correct to NRS."
  exit 1
fi

echo "✅ All pre-commit gates passed"

# Run staged lint-fix
npx lint-staged
```

```json
// package.json (root)
{
  "lint-staged": {
    "**/*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "**/*.{json,md}": ["prettier --write"]
  }
}
```

---

### PHASE 7 — NIGERIAN SME WORKFLOW INTEGRATION

The following features constitute the core value loop for a Nigerian small business owner.
Each must be reachable from the dashboard within 2 taps.

**VAT Filing Flow (MOD-22) — entry from QuickActionsGrid:**

```ts
// Trigger points:
// 1. QuickActionsGrid "File VAT" button (urgent if deadline ≤7 days)
// 2. ComplianceCalendar VAT deadline card "File Now" CTA
// 3. Anomaly signal 7 (VAT gap) "Fix Now" → pre-fills wizard with flagged period

// NTA 2025 VAT facts surfaced to user during wizard:
// - Rate: 7.5%
// - Mandatory registration: annual turnover ≥ ₦25M
// - Small company exemption: turnover < ₦100M → no VAT registration required
// - Input VAT refund: must be claimed within 12 months; NRS processes within 30 days
// - NRS e-invoice stamp: required per invoice ≥ ₦200,000
// - Exempt: land sales, residential property, residential rent
// - Filing and remittance: 21st of following month (same as WHT)
```

**WHT Remittance Flow (MOD-23) — entry from QuickActionsGrid:**

```ts
// WHT rate decision logic — surface to user in wizard
// Users frequently get this wrong. Surface the decision tree explicitly:
//
// Transaction type?
//  ├── Professional / consultancy fees → 10% (common mistake: 5%)
//  ├── Dividends                       → 10%
//  ├── Interest                        → 10%
//  ├── Rent (commercial)               → 10%
//  ├── Agency commissions              → 10%
//  ├── Construction / contracts        → 5%  ← only category at 5%
//  └── Non-resident (no NRS WHT)       → 4% flat
//
// Small company exemption (BOTH conditions required):
//  (a) Valid TIN on file AND
//  (b) Transaction total in calendar month ≤ ₦2,000,000
//
// Filing deadline: 21st of following month
```

**PAYE Payroll Flow (MOD-25) — entry from QuickActionsGrid:**

```ts
// payroll calculation must use calculatePIT from @taxbridge/contracts
// Gate: ₦5M gross income must match NTA 2025 §33 to ±₦1
//
// Worked example (for test coverage):
// Input: grossIncome=5_000_000, rentPaid=600_000, pension=200_000
// RRA = min(0.20 × 600_000, 500_000) = min(120_000, 500_000) = 120_000
// Pension = 200_000
// Taxable = 5_000_000 − 120_000 − 200_000 = 4_680_000
// Band 1: min(4_680_000, 800_000)   × 0.00 = 0
// Band 2: min(3_880_000, 2_200_000) × 0.15 = 330_000
// Band 3: min(1_680_000, 9_000_000) × 0.18 = 302_400
// Total: 632_400  ETR = 632_400 / 4_680_000 ≈ 13.51%
//
// Test must assert: result.taxLiability === 632_400 (±1)
```

**TaxAcademy Contextual Entry Points — surface in-context, not standalone:**

| Location | Trigger | Lesson | UI Pattern |
|---|---|---|---|
| Anomaly card — WHT signal | Tap info icon | Lesson 7: WHT rates | Bottom sheet |
| VAT wizard step 1 — first visit | Auto-show | Lesson 4: VAT basics | Nudge card in ambient zone |
| Onboarding step 2 — TIN field focus | On focus | Lesson 1: NRS registration | Tooltip popover |
| Onboarding step 3 — obligation info icon | Tap | Lesson 2: Nigerian tax types | Inline card expansion |
| Dashboard empty state — new user | Mount | Lesson 1: NRS registration | Full-screen CTA |
| PAYE payroll screen — first run | Mount | Lesson 9: PAYE filing | Coach mark overlay |
| Document vault — first upload | On upload | Lesson 11: 5-year retention | Toast notification |

---

### PHASE 8 — GIT COMMIT SEQUENCE

Atomic commits by concern — each independently reviewable.

```bash
# 1. Contracts — NTA 2025 tax law (must be first; all other code depends on it)
git add packages/contracts/
git commit -m "feat(contracts): NTA 2025 — CRA abolished, RRA added, PIT bands updated (C-09)"

# 2. i18n fixes — P0 blockers
git add mobile/src/i18n/ scripts/check-i18n.ts
git commit -m "fix(i18n): BUG-S02 NRSt→NRS, BUG-S03 initImmediate:false, BUG-S04 offline key, Pidgin signals 4-9"

# 3. Animation vocabulary — must exist before all dashboard components
git add mobile/src/design-system/animation.ts
git commit -m "feat(mobile): ER-10 animation vocabulary — DURATION/EASE/ZONE_DELAY tokens (no raw numbers)"

# 4. Dashboard components — in dependency order
git add mobile/src/components/dashboard/DashboardZone.tsx
git commit -m "feat(mobile): ER-07 DashboardZone — CF-08 choreography, stagger delays, urgent override"

git add mobile/src/components/dashboard/DashboardSkeleton.tsx
git commit -m "feat(mobile): ER-08 DashboardSkeleton — geometry contract, 0px layout shift, shimmer"

git add mobile/src/components/dashboard/TaxHealthGauge.tsx
git commit -m "feat(mobile): CF-01 TaxHealthGauge SVG arc — worklet-safe, EASE.gauge, 230° sweep (C-13)"

# 5. App entry point — fonts + onboarding guard
git add mobile/src/app/_layout.tsx
git commit -m "fix(mobile): BUG-S01 Inter font bundled, onboarding guard on launch"

# 6. Backend foundation
git add backend/src/validateEnv.ts backend/src/app.ts render.yaml
git commit -m "feat(backend): validateEnv crash-fast, 0.0.0.0 binding, render.yaml IaC"

# 7. Dashboard API
git add backend/src/routes/v1/dashboard.ts backend/src/constants/fallbacks.ts
git commit -m "feat(backend): CF-03 composite dashboard API — parallel fetch, Redis 120s, fallbacks (C-14)"

# 8. RBAC + audit
git add backend/src/middleware/requireRole.ts backend/src/services/audit.ts
git add backend/prisma/migrations/
git commit -m "feat(backend): MOD-28 RBAC middleware, AuditLog model, session invalidation"

# 9. Observability
git add backend/src/metrics.ts backend/src/routes/v2/monitoring.ts
git commit -m "feat(backend): MOD-30 prom-client singleton, Prometheus metrics, /health endpoint"

# 10. Event bus + orchestrator
git add backend/src/services/eventBus.ts backend/src/cron/orchestrator.ts backend/src/cron/keepAlive.ts
git commit -m "feat(backend): MOD-31 event bus — anomaly.detected→snapshot+notification+audit, cron orchestrator, keep-alive"

# 11. Webhook security
git add backend/src/routes/webhooks/
git commit -m "fix(backend): Flutterwave HMAC — rawBody.toString('utf8'), timingSafeEqual"

# 12. Onboarding wizard
git add mobile/src/screens/OnboardingWizard.tsx
git commit -m "feat(mobile): MOD-29 onboarding wizard — 5-step, offline-safe, AsyncStorage persist, TaxAcademy gated"

# 13. Admin panel
git add admin/
git commit -m "feat(admin): Next.js admin panel — Edge JWT (jose), RBAC middleware, live metrics dashboard"

# 14. CI/CD + EAS + Husky
git add .github/workflows/pipeline.yml mobile/eas.json mobile/metro.config.js .husky/
git commit -m "feat(devops): CI/CD pipeline — parallel builds, blue-green, smoke tests, EAS optimization, Husky gates"

# 15. Tag and push
git tag -a v11.0.0 -m "TaxBridge V11.0 — Intelligent Operations & Deployment Completion Layer"
git push origin impl-v11.0-complete --tags

# Open PR — auto-merges when all CI jobs pass
gh pr create \
  --title "feat: TaxBridge V11.0 — Intelligent Operations & Deployment Completion Layer" \
  --body-file docs/V11_PR_DESCRIPTION.md \
  --base main \
  --head impl-v11.0-complete \
  --label "v11.0" --label "production"
```

---

### PHASE 9 — FINAL VALIDATION GATES

Run every gate. Zero tolerance for failures.

```bash
# ── ZERO TOLERANCE GATES ──

# FIRS absolute zero
grep -rn "FIRS" . --include="*.ts" --include="*.tsx" --include="*.json" \
  | grep -v node_modules | grep -v .git
# → MUST return 0 results

# NTA 2025 correctness
grep -rn "CRA\b\|\.cra\b\|cra " packages/contracts/src backend/src mobile/src
# → MUST return 0 results (CRA abolished)

grep -rn "minTax\|1%.*gross\|gross.*1%" packages/contracts/src backend/src
# → MUST return 0 results (individual minimum tax abolished)

grep -rn "ETR.*PIT\|PIT.*ETR\|15%.*individual" packages/contracts/src backend/src
# → MUST return 0 results (15% ETR is corporate MNE only)

grep -n "calculateRRA\|RRA" packages/contracts/src/constants.ts
# → MUST return results (RRA must be present)

grep -n "WHT_PROFESSIONAL_RATE.*0\.10\|0\.10.*WHT_PROFESSIONAL" packages/contracts/src/constants.ts
# → MUST return 1 result (10%, not 5%)

# ── ANIMATION GATE ──
grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src --include="*.ts" --include="*.tsx" \
  | grep -v "animation.ts"
# → MUST return 0 results

# ── DASHBOARD ZONES ──
grep -c 'zone="' mobile/src/screens/DashboardScreen.tsx
# → MUST return 5

grep -n 'await.*router\|router.*await' mobile/src/screens/DashboardScreen.tsx
# → MUST return 0 results

grep -n 'No anomal\|noAnomal' mobile/src/screens/DashboardScreen.tsx
# → MUST return 0 results

# ── TEST SUITE ──
npm test --workspaces -- --coverage
# → MUST pass ≥423 tests, 0 failing

npx nyc check-coverage --lines 95 --functions 95 --branches 90
# → MUST pass

# ── TYPE CHECK ──
npx tsc --noEmit --project backend/tsconfig.json
npx tsc --noEmit --project mobile/tsconfig.json
npx tsc --noEmit --project admin/tsconfig.json
# → 0 errors across all packages

# ── PAYROLL ACCURACY GATE ──
# ₦5M gross must match NTA 2025 §33 to ±₦1
npx ts-node -e "
const { calculatePIT } = require('./packages/contracts/src');
const r = calculatePIT({ grossIncome: 5_000_000, rentPaid: 600_000, pension: 200_000 });
const expected = 632_400;
const diff = Math.abs(r.taxLiability - expected);
if (diff > 1) throw new Error('PIT calculation incorrect: got ' + r.taxLiability + ' expected ' + expected);
console.log('✅ PIT gate: ₦5M gross → taxLiability =', r.taxLiability, '(within ₦1 of', expected + ')');
"

# ── i18n GATE ──
yarn i18n:check
# → MUST exit 0 (all en.json keys present in pidgin.json)

# ── EAS BUILD GATE ──
grep '"compileSdkVersion": 36' mobile/eas.json | wc -l
# → MUST return ≥2 (staging and production profiles)

# ── RENDER DEPLOYMENT GATE ──
curl -f https://taxbridge-api-ker8.onrender.com/api/v2/monitoring/health | jq .
# → MUST return {"status":"healthy",...}

# ── ADMIN PANEL GATE ──
curl -f -o /dev/null -w "%{http_code}" https://taxbridge.vercel.app
# → MUST return 200

# ── LOAD TEST ──
npx artillery run infra/load-tests/dashboard-composite.yml
# → p95 <200ms at ≥1,000 RPS sustained for 60s
```

---

## PRE-DEPLOY PRODUCTION CHECKLIST

Run this before every production merge to `main`.

```
FOUNDATION
□ npm test → ≥423 passing, 0 failing
□ tsc --noEmit → 0 errors across backend, mobile, admin
□ Snyk scan → 0 HIGH/CRITICAL vulnerabilities
□ yarn i18n:check → 0 missing Pidgin keys

COMPLIANCE
□ grep FIRS → 0 occurrences anywhere
□ grep CRA → 0 occurrences in tax calculation paths
□ grep minTax → 0 occurrences
□ grep "ETR.*PIT" → 0 occurrences
□ calculateRRA present in contracts/constants.ts
□ WHT_PROFESSIONAL_RATE = 0.10 (not 0.05)
□ CIT small company threshold = ₦100M
□ VAT registration threshold = ₦25M

MOBILE / UX
□ TaxHealthGauge renders SVG arc (not ProgressBar)
□ buildArcPath and scoreToStroke marked 'worklet'
□ DashboardSkeleton: 0px layout shift (RN Profiler verified)
□ All animations use DURATION.* and EASE.* tokens
□ All 5 DashboardZones: apex, signal, action, context, ambient
□ All interactive Pressables: scale(0.97) visual ack on tap
□ No await before router.push() in DashboardScreen
□ Inter font bundled — no □ squares in bottom nav
□ Both en.json AND pidgin.json: all keys present and natural Pidgin
□ VAT, WHT, PAYE entry points in QuickActionsGrid

SECURITY
□ Helmet + CSP headers on backend
□ express.raw('/webhooks') before express.json() — rawBody preserved
□ Flutterwave HMAC: req.rawBody.toString('utf8') + timingSafeEqual
□ Sentry PII scrubbing rules present and ordered (BVN→ACCT→TIN)
□ AuditLog: no updatedAt (append-only for NDPC)
□ Session invalidation on role change via redis.setex (not redis.set)
□ CORS allowlist: taxbridge.vercel.app only

BACKEND
□ validateEnv.ts first import in app.ts — crashes fast on missing vars
□ Express bound to 0.0.0.0 — NOT localhost
□ PORT from process.env.PORT — NOT hardcoded
□ prom-client singleton guard (global.__taxbridge_prom_registry)
□ Redis cache write is non-blocking (fire-and-forget with .catch)
□ Dashboard endpoint returns 200 with FALLBACK_* on any DB failure (C-12)
□ eventBus.setMaxListeners(30)
□ keepAlive cron: */14 * * * * registered in orchestrator

DEPLOYMENT
□ render.yaml committed and valid
□ EAS: compileSdkVersion=36, targetSdkVersion=35 in staging and production
□ Yarn Berry enforced: corepack enable, nodeLinker: node-modules
□ EAS cache keys unique per profile (include hashFiles)
□ admin/vercel.json: no empty headers array, functions timeout set
□ jose installed in admin workspace (Edge Runtime JWT)
□ SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, RENDER_API_KEY in GitHub Secrets
□ Blue-green: taxbridge-api-green health check passes pre-swap
□ Idempotent release job (duplicate tag/release does not fail CI)
□ .env files NOT committed (git ls-files | grep .env returns 0)

MONITORING
□ /api/v2/monitoring/health → {"status":"healthy"} (public, no auth)
□ /api/v2/monitoring/metrics → Prometheus format (admin only)
□ Sentry receiving test event
□ DLQ alert threshold set at 10 unresolved jobs
□ Keep-alive cron active in production (prevents Render cold-start)
```

---

## QUICK WINS REGISTER

Execute opportunistically between phases. Each takes ≤60 minutes.

| # | Item | Time | Status |
|---|------|------|--------|
| QW-01 | Husky FIRS + animation gates | 10min | In Phase 6 above |
| QW-02 | Pidgin copy for anomaly signals 4–9 | 45min | In Step 2 above |
| QW-03 | `accessibilityLabel` on TaxHealthGauge | 20min | In Step 6 above — verify i18n key exists |
| QW-04 | Render keep-alive cron */14 | 10min | In MOD-31 above |
| QW-05 | `validateEnv.ts` first import | 5min | In Phase 0 above |
| QW-06 | `app.use('/webhooks', express.raw(...))` before `express.json()` | 5min | In app.ts above |
| QW-07 | `jose` for Edge-compatible JWT in admin | 5min | In Phase 4 above |
| QW-08 | Idempotent CI release job | 15min | In Phase 5 above |
| QW-09 | EAS SENTRY_DSN in staging+production profiles | 5min | In eas.json above |
| QW-10 | `git rm --cached backend/.env.*` | 5min | In Phase 0 above |
| QW-11 | Seed `smokeTestUser.ts` migration | 20min | In CI pipeline above |
| QW-12 | `eventBus.setMaxListeners(30)` | 2min | In MOD-31 above |
| QW-13 | `metro.config.js` block backend/ and admin/ | 10min | In Phase 3 above |
| QW-14 | `React.memo` on AnomalyCard | 15min | In Phase 3 above |
| QW-15 | `useCallback` on `refetch` reference | 10min | In DashboardScreen above |

---

## CHANGELOG ENTRY

```markdown
## [11.0.0] — 2026-02-26

### Added
- V11.0 Intelligent Operations & Deployment Completion Layer
- MOD-28: RBAC enforcement — requireRole middleware, role hierarchy matrix, session invalidation
- MOD-29: 5-step onboarding wizard — offline-safe, AsyncStorage persisted, TaxAcademy gated
- MOD-30: Observability — prom-client singleton, Prometheus metrics, Grafana alert thresholds
- MOD-31: Event bus — anomaly.detected wired to snapshot, notification, and immutable audit log
- Cron orchestrator — all 7 jobs registered centrally (no scattered setInterval)
- render.yaml — Infrastructure as Code for taxbridge-api-ker8.onrender.com
- Keep-alive cron (*/14 * * * *) — prevents Render cold-start on free/starter plan
- AuditLog model — append-only, no updatedAt, NDPC compliant
- OnboardingProgress, DLQJob, UserSession, AcademyNudge Prisma models
- Performance indexes for Nigerian SME compliance queries
- /api/v2 gateway with versioning + deprecation headers on /api/v1 (sunset 2026-08-01)
- TaxAcademy contextual nudge system — 7 entry points across app
- Zero-downtime migration strategy (nullable → backfill → constraints pattern)
- Admin Next.js Edge middleware with jose (Edge Runtime compatible)
- Nigerian SME quick actions: VAT, WHT, PAYE, NRS invoice surface from dashboard
- WHT rate decision tree surfaced in wizard (professional fees = 10%, not 5%)
- i18n completeness check script (yarn i18n:check) added to CI
- Husky pre-commit: FIRS gate + animation token gate + NRSt typo gate
- Idempotent CI release job (duplicate tags do not fail)
- Smoke test seeded user (deterministic viewer-role test credentials)
- Grafana alert thresholds: error rate, p99 latency, DLQ depth, auth flood

### Fixed
- BUG-S01: Inter font bundled via @expo-google-fonts/inter — no more □ squares
- BUG-S02: NRSt → NRS typo in all i18n keys
- BUG-S03: initImmediate: false — no raw key flash on offline cold start
- BUG-S04: common.offline key added to both locales
- CF-01: TaxHealthGauge renders 230° SVG arc (replaces ProgressBar — C-13)
- CF-03: Dashboard fires single composite endpoint (not 3 separate requests — C-14)
- CF-07: Pidgin error copy for NRS circuit-open and all 9 anomaly signals
- DashboardZone: exhaustive useEffect deps — no stale closures
- TaxHealthGauge: buildArcPath and scoreToStroke marked 'worklet' — UI thread safe
- Flutterwave HMAC: rawBody.toString('utf8') not JSON.stringify(Buffer) — always correct
- Sentry PII regex: BVN (11-digit) before ACCT (10-digit) before TIN (8-digit) — no false masks
- prom-client: global singleton guard — no crash on hot reload
- Redis cache write: non-blocking fire-and-forget with corrupt-entry guard
- Redis role_version: setex with 90-day TTL (not set) — no memory leak
- requireRole: auditLog is fire-and-forget (not awaited) — 403 response not blocked
- app.ts: express.raw('/webhooks') before express.json() — rawBody always available
- vercel.json: rewrites use :path* wildcard, functions timeout added, empty headers removed
- Admin middleware: jwtVerify from jose (not jsonwebtoken) — Edge Runtime compatible
- CI smoke-test: login API call for token (not bare curl hack)
- CI release job: idempotent tag + gh release upsert — no double-run failure
- CI build-mobile-apk: --no-wait removed — smoke tests wait for build completion
- EAS staging+production: SENTRY_DSN added to env block
- deploy-backend: depends on security job (not just build-backend)

### Changed
- Yarn Berry (corepack) enforced across all workspaces
- @tanstack/react-query v5 only — legacy react-query (v3) removed from all workspaces
- Session opening: 6 gates (added Render warm-up ping as gate 6)
- validateEnv.ts: 7 required vars + NODE_ENV-conditional production-only check
- PORT: always from process.env.PORT (Render assigns dynamically; hardcoded values fail)
- Express binding: 0.0.0.0 (not localhost — Render infrastructure requirement)
- eventBus.setMaxListeners(30) — prevents MaxListenersExceeded warning
- metro.config.js: blockList excludes backend/ and admin/ from mobile bundle
```

---

## ROLLBACK PROCEDURE

```bash
# Backend rollback (Render blue-green):
render traffic swap --from prod --to blue --api-key "$RENDER_API_KEY"
# Blue slot (previous prod) immediately serves traffic.
# Do NOT attempt manual code revert without traffic swap first.

# Admin rollback (Vercel):
npx vercel rollback --token="$VERCEL_TOKEN" --cwd admin

# Mobile rollback (OTA — JS-only regressions only):
eas update --branch production --message "revert: rollback to stable" \
  --git-commit-hash $(git rev-parse HEAD~1)

# Database rollback (Prisma):
# Each migration step is reversible because nullable columns were added first.
# Do NOT run prisma migrate rollback in production — apply a forward migration instead.
npx prisma migrate dev --name "v11_rollback_if_needed"
```

---

## COMPLETION SIGNAL

Emit **only** after every item in the Pre-Deploy Production Checklist above is confirmed ✅.
Do not emit if any gate is failing, any test is red, or any deployment is unhealthy.

```
TaxBridge V11.0 Intelligent Operations Layer — forged.

NTA 2025-compliant  ·  WCAG 2.1 AA accessible  ·  2G-optimized
NDPC audit-ready  ·  Horizontally scalable  ·  Blue-green deployed

  Backend (Render):  https://taxbridge-api-ker8.onrender.com
  Health:            https://taxbridge-api-ker8.onrender.com/api/v2/monitoring/health
  Admin (Vercel):    https://taxbridge.vercel.app
  Mobile:            Android APK — EAS v11.0.0 (Google Play Internal Testing)
  Release:           github.com/Scardubu/taxbridge/releases/tag/v11.0.0

  Render: warm. Keep-alive cron active (*/14 * * * *).
  Blue-green: last swap confirmed. Rollback slot standing by.
  NRS circuit: closed. Stamp queue draining normally.
  Event bus: anomaly.detected → snapshot → notification → audit (all paths verified).
  Nigerian SME workflows: VAT, WHT, PAYE reachable from dashboard in ≤2 taps.
  Pidgin locale: complete. Lagos trader reads naturally, not literally.
```

---

*TAXBRIDGE V11.0 — PRODUCTION IMPLEMENTATION PROMPT*
*Supersedes: V10.3 Implementation Prompt (February 22, 2026)*
*Repo:* `github.com/Scardubu/taxbridge` *| Branch:* `impl-v11.0-complete`
*Backend:* `https://taxbridge-api-ker8.onrender.com` *| Admin:* `https://taxbridge.vercel.app`

*Audit corrections applied: Reanimated worklet violations, prom-client singleton crash,*
*Flutterwave HMAC rawBody fix, Sentry regex ordering, Redis setex TTL, express.raw ordering,*
*jose Edge Runtime JWT, idempotent CI release, exhaustive useEffect deps, fire-and-forget audit,*
*Express 0.0.0.0 binding, PORT from env, NRSt eradication, Nigerian SME workflow entry points,*
*i18n completeness script, Husky pre-commit gates, zero-downtime migration pattern,*
*Pidgin natural copy for all 9 anomaly signals, WHT professional rate annotation, rollback procedure.*
