# TaxBridge V13 Mobile — COMPLETE BLUEPRINT v6
## The Single Source of Truth: All Corrections V1→V5 Synthesised
**Repository**: `Scardubu/taxbridge.git` | **Directory**: `mobile/`
**Date**: March 17, 2026 | **Status**: Production-Ready, Deployment-Ready
---
**Stack**: Expo SDK 54 · React Native 0.81 · New Architecture (Fabric + TurboModules)
**Routing**: Expo Router v6 · NativeTabs (unstable-native-tabs)
**Animation**: Reanimated 4.1.x · CSS Transitions · Keyframe API
**Styling**: NativeWind v4.2.x (compatible with Reanimated v4)
**State**: Zustand v5 · `expo-sqlite/kv-store` (MMKV) · SQLite WAL
**Backend**: Fastify 5 · Prisma 5 · PostgreSQL 15 · Redis 7 · BullMQ 5
**Integrations**: Youverify · Flutterwave · Paystack · Remita · Africa's Talking · FIRSMBS
**Compliance**: NRS 2026 · NTA 2025 · NTAA 2025 · Phased e-invoicing
---

## ═══════════════════════════════════════════════════
## CHAPTER 0 — MASTER EVOLUTION TABLE (v1 → v6)
## ═══════════════════════════════════════════════════

Every correction across all previous versions, with its definitive resolution:

| ID | Origin | Symptom | Root Cause | v6 Resolution |
|----|--------|---------|-----------|---------------|
| **B-01** | v1 | App kill/restart loses all onboarding progress | AsyncStorage partial write (no transactions) | `expo-sqlite/kv-store` sync writes for step pointer; SQLite WAL for field data |
| **B-02** | v1 | 300–800ms black screen after `completeOnboarding()` | Context re-render cascade race condition | `router.replace('/(tabs)/')` (Expo Router v6) — synchronous, no ref needed |
| **B-03** | v1 | Returning v11 users frozen at step 0 with 0% progress | Legacy step IDs (`pit`, `vatcit`, `nrs`) not migrated | `migrateLegacyStepId()` in Zustand `onRehydrateStorage` |
| **B-04** | v1 | Back press fires N times after N step changes | `BackHandler.addEventListener` without `.remove()` cleanup | `const sub = BackHandler.addEventListener(...); return () => sub.remove()` |
| **B-05** | v1 | Wrong step's data saved under wrong step ID | Auto-save debounce fired after step changed | Cancel pending timer in `useEffect` cleanup |
| **B-06** | v1 | "Skip All" produces half-skipped state on crash | Non-atomic multi-write | Single atomic Zustand `set()` then `complete()` |
| **B-07** | v1 | Zero crash recovery in OnboardingScreen | No error boundaries | `OnboardingErrorBoundary` class component + Sentry |
| **C-01** | v2 | AsyncStorage replaced wholesale with SQLite (overcorrection) | v1 used SQLite for everything including small hot state | Three-layer storage: SecureStore (tokens) + MMKV (hot state) + SQLite (relational) |
| **C-02** | v2 | `withSpring` worklets on step transitions cause jank on low-end | Reanimated New Arch Android regression (#7435, #8250) | CSS Transitions API (`transitionProperty` inline on `Animated.View` style) |
| **C-03** | v2 | E-invoicing UX said "mandatory Jan 2026 for all SMEs" | Wrong date, wrong scope | Three-phase NRS rollout: large Apr 2026, medium Jul 2026, small Jul 2027 |
| **C-04** | v2 | VAT UX confused filing exemption with charging exemption | Misread NTA 2025 §22 | Exempt from FILING returns; MUST still charge 7.5% VAT on invoices |
| **C-05** | v2 | OnboardingContext useState = every child re-renders on any change | React Context performance anti-pattern | Zustand with selector hooks — only relevant slice triggers re-render |
| **C-06** | v2 | One-shot `execAsync` DDL — no schema evolution path | No migration versioning | Version-gated migrations with `PRAGMA user_version` |
| **C-07** | v2 | `db.runAsync()` not atomic for multi-step writes | No transaction wrapper | `withExclusiveTransactionAsync` for all multi-step writes |
| **I-01** | v3 | Mobile OfflineQueue payloads didn't match BullMQ worker schemas | No contract documented | Exact type map: `TIN_VERIFY` → `kyc-queue`, etc. |
| **I-02** | v3 | JWT stored in MMKV (unencrypted) | v1/v2 left tokens in kv-store | `expo-secure-store` exclusively for access + refresh tokens |
| **I-03** | v3 | Missing `X-TaxBridge-Version: 13` header | No API version contract | All `apiRequest` calls include version + device ID headers |
| **I-04** | v3 | TIN verification treated as synchronous | Youverify is webhook-based async | SSE service listens for `tin_verified` event, auto-advances step |
| **I-05** | v3 | Paystack received Naira directly from mobile | Paystack API requires kobo (×100) | Mobile always sends Naira; backend converts. `paymentService` documented. |
| **I-06** | v3 | Africa's Talking received unformatted phone numbers | Nigeria `0XXXXXXXXXX` format rejected | `normalizeNigeriaPhone()` → always produces `+234XXXXXXXXXX` |
| **I-07** | v3 | Remita RRR discarded after payment initiation | Unreconcilable tax payments | Store `remita_rrr` in `tax_payments` immediately on response |
| **I-08** | v3 | Admin dashboard `compliance_events` table empty | Mobile never wrote events | `logComplianceEvent()` called on: onboarding_complete, tin_verified, invoice_submitted |
| **SDK-01** | v3 | `enableProguardInReleaseBuilds` in app.json | Deprecated in SDK 54 | `enableMinifyInReleaseBuilds` |
| **SDK-02** | v3 | `expo-file-system/next` import path | Changed in SDK 54 stable | `expo-file-system` (new API is now default) |
| **SDK-03** | v3/v4 | `SafeAreaView` from `react-native` | Deprecated in RN 0.81 | `SafeAreaView` from `react-native-safe-area-context` |
| **SDK-04** | v4 | `react-native-reanimated/plugin` in `babel.config.js` | `babel-preset-expo` auto-injects it; duplicate = build fail | Remove from plugins entirely |
| **SDK-05** | v4 | `GENERATED ALWAYS AS … STORED` in SQLite schema | Not supported in WAL mode on expo-sqlite bundled SQLite | Remove; use plain `CREATE INDEX` |
| **SDK-06** | v4 | `openDatabaseAsync('name', { useNewConnection: false })` | Not a valid expo-sqlite v2 option | `openDatabaseAsync('taxbridge_v13.db')` with no options |
| **SDK-07** | v4 | `NativeTabs.Trigger.Icon` | SDK 55+ only, not in SDK 54 | `Icon` from `expo-router/unstable-native-tabs` |
| **SDK-08** | v4 | NativeTabs crashes on iOS 18 dev builds | Known issue #39722 | `USE_NATIVE_TABS` guard; fallback to `<Tabs>` on iOS 18 dev |
| **SDK-09** | v4 | Reanimated `staticFlags` in `app.json` plugin config | Field doesn't exist in Reanimated plugin API | Remove entirely |
| **SDK-10** | v5 | Zustand `createJSONStorage` wired to sync kv-store API | `PersistStorage<T>` requires `Promise`-returning methods | `zustandKvStorage` uses `Storage.getItem/setItem` (async); `AppKV` keeps sync helpers for components |
| **SDK-11** | v5 | `react-native-reanimated` listed twice in `package.json` | npm silently uses last occurrence | Listed once at correct version |
| **SDK-12** | v5 | `NativeTabs.Trigger.Icon` `md` prop for Android | Not stable in SDK 54 | `drawable` prop with Android vector drawable names |
| **SDK-13** | v5 | `router.replace()` vs `navigationRef.reset()` | Expo Router v6 does not need navigationRef | `router.replace('/(tabs)/')` from `expo-router` |
| **UX-01** | v4 | No design system tokens specified | Ad-hoc inline styles throughout | Complete design system: palette, spacing, typography, radius, shadows |
| **UX-02** | v4 | No dashboard screen spec | Post-onboarding UX undefined | Dashboard with TaxShieldRing, nudge cards, quick actions, obligations summary |
| **UX-03** | v4 | No accessibility annotations | TalkBack/VoiceOver unsupported | `accessibilityRole`, `accessibilityLabel`, `accessibilityHint`, `accessibilityState` on all interactive elements |
| **UX-04** | v4 | No Lottie illustrations or loading states | Steps feel empty | Lottie-first with PNG fallback; loading/error/empty states per screen |
| **UX-05** | v1–v4 | Pidgin as secondary/buried option | Nigerian users need Pidgin by default | Welcome step: Pidgin/English toggle with locale auto-detect |
| **TAX-01** | v2 | E-invoicing date wrong ("mandatory Jan 2026 all businesses") | Large taxpayers only, phased | Phase 1: ≥₦5B, enforcement Apr 2026. Phase 2: ₦1B–₦5B, mandatory Jul 2026. Phase 3: <₦1B, mandatory Jul 2027 |
| **TAX-02** | v2 | VAT threshold "₦25M mandatory" stated as bright line | Grey zone — NRS enforcement focus | Register if >₦25M; exempt from filing returns if <₦100M + <₦250M assets |
| **TAX-03** | v2 | Authority name "FIRS" throughout | Renamed NRS under NTA 2025 | Dual display "NRS (formerly FIRS)"; portal URL stays `einvoice.firs.gov.ng` |
| **TAX-04** | v2 | CIT said "flat rates apply to all" | 0% CIT for small companies | 0% if turnover <₦50M + assets <₦250M + not professional services |
| **TAX-05** | v2 | PIT zero-band missing | NTA 2025 introduced ₦800K zero-band | First ₦800K of annual income = 0% PIT |
| **TAX-06** | v3 | WHT exemption threshold missing | NTAA 2025 — transactions <₦2M/month exempt with valid TIN | `whtExemptEligible` field in obligations calculator |
| **CI-01** | v4 | No CI/CD pipeline | EAS builds manual only | EAS Workflows fingerprint-aware CI + GitHub Actions test/lint |
| **CI-02** | v4 | No `.env.example` | Onboarding friction for new devs | Complete `.env.example` with all `EXPO_PUBLIC_*` keys |

---

## ═══════════════════════════════════════════════════
## CHAPTER 1 — ARCHITECTURE OVERVIEW
## ═══════════════════════════════════════════════════

### 1.1 Repository Layout

```
Scardubu/taxbridge.git
├── mobile/                          ← This blueprint owns this directory
│   ├── app/                         Expo Router v6 file-based routing
│   │   ├── _layout.tsx              Root: Sentry + providers + DB init
│   │   ├── (onboarding)/
│   │   │   ├── _layout.tsx          Guard: redirect → (tabs) if complete
│   │   │   ├── index.tsx            Step 1: Welcome + language toggle
│   │   │   ├── business-type.tsx    Step 2: Business type + sector
│   │   │   ├── tin-verify.tsx       Step 3: TIN entry + SSE wait
│   │   │   ├── vat-setup.tsx        Step 4: VAT obligations (optional)
│   │   │   ├── einvoice.tsx         Step 5: E-invoice phase (optional)
│   │   │   └── community.tsx        Step 6: Badge share + referral (optional)
│   │   └── (tabs)/
│   │       ├── _layout.tsx          NativeTabs (SDK 54 API) + iOS 18 fallback
│   │       ├── index.tsx            Dashboard: Shield ring + nudges
│   │       ├── invoices.tsx         Invoice list + create (FlashList)
│   │       ├── tax-calendar.tsx     Statutory deadlines (WAT offline)
│   │       ├── compliance.tsx       Tax simulator + obligations
│   │       └── settings.tsx         Profile, language, dark mode
│   ├── components/
│   │   ├── design-system/
│   │   │   ├── tokens.ts            Palette, spacing, type, radius, shadows
│   │   │   ├── Button.tsx           Animated, haptic, accessible
│   │   │   ├── Card.tsx             Surface card
│   │   │   ├── Input.tsx            Labelled, error-state
│   │   │   ├── Badge.tsx            Status pill
│   │   │   ├── NudgeCard.tsx        Priority action card
│   │   │   └── index.ts             Barrel export
│   │   ├── TaxShieldRing.tsx        Reanimated 4 Keyframe + SVG
│   │   ├── StepContainer.tsx        CSS Transition step wrapper
│   │   ├── OnboardingProgressBar.tsx CSS Transition width bar
│   │   ├── OnboardingErrorBoundary.tsx Sentry class boundary
│   │   ├── OfflineIndicator.tsx     NetInfo banner
│   │   └── ComplianceBadge.tsx      view-shot shareable badge
│   ├── stores/
│   │   ├── onboardingStore.ts       Zustand + kv-store persist
│   │   └── businessProfileStore.ts  Zustand + SQLite debounced flush
│   ├── services/
│   │   ├── database.ts              SQLite singleton, WAL, v-gated migrations
│   │   ├── tokenService.ts          expo-secure-store JWT
│   │   ├── api.ts                   fetch wrapper, 401 refresh, headers
│   │   ├── offlineQueue.ts          SQLite queue → BullMQ-schema payloads
│   │   ├── sseService.ts            react-native-sse, auto-reconnect
│   │   ├── nrsCompliance.ts         NRS 2026 rules engine
│   │   ├── taxSimulator.ts          Pure-JS offline simulator
│   │   ├── taxCalendar.ts           WAT statutory deadlines
│   │   ├── nudgeEngine.ts           Priority nudge generator
│   │   ├── paymentService.ts        Paystack/Flutterwave/Remita (Naira-in)
│   │   ├── otpService.ts            Africa's Talking + phone normalisation
│   │   ├── pidginVoice.ts           expo-speech Pidgin hints
│   │   ├── complianceEventService.ts → local + offline queue
│   │   └── storageMigration.ts      One-time AsyncStorage → kv-store
│   ├── storage/
│   │   └── kv.ts                    Dual API: async (Zustand) + sync (components)
│   ├── i18n/
│   │   ├── index.ts                 i18next init with locale detection
│   │   ├── en.json                  Complete English strings
│   │   └── pidgin.json              Complete Pidgin strings
│   ├── __tests__/
│   │   ├── onboardingStore.test.ts
│   │   ├── nrsCompliance.test.ts
│   │   ├── otpService.test.ts
│   │   └── offlineQueue.test.ts
│   ├── assets/animations/           Lottie JSON files
│   │   ├── tax-shield.json          Welcome screen hero
│   │   ├── tin-verify.json          TIN verification pending
│   │   ├── celebration.json         Step completion
│   │   └── offline.json             Offline indicator
│   ├── .eas/workflows/ci.yml        EAS fingerprint-aware CI
│   ├── .github/workflows/mobile-ci.yml GitHub Actions
│   ├── app.json
│   ├── eas.json
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── tailwind.config.js
│   ├── global.css
│   ├── tsconfig.json
│   └── .env.example
├── backend/                         Fastify 5 (unchanged)
└── web/                             Next.js 15 Admin (unchanged)
```

### 1.2 Storage Layers (No Ambiguity)

```
Layer 1 ── expo-secure-store (encrypted)
           JWT access token (15-min expiry)
           JWT refresh token (7-day expiry)

Layer 2 ── expo-sqlite/kv-store (MMKV-backed, sync reads)
           • Onboarding step pointer          'ob:step'
           • Completion flag                  'ob:done'
           • Language preference              'pref:lang'
           • Dark mode                        'pref:dark'
           • Voice assistant toggle           'pref:voice'
           • Migration marker                 'migration:v13'
           • Feature flags                    'flag:<key>'
           ↳ Zustand persist uses ASYNC       Storage.getItem/setItem
           ↳ Components use SYNC              Storage.getItemSync/setItemSync

Layer 3 ── expo-sqlite (WAL mode, withExclusiveTransactionAsync)
           • business_profiles         field data with SQLite types
           • offline_operations        BullMQ-schema sync queue
           • tax_records               VAT/CIT/PIT/WHT records
           • compliance_events         Admin dashboard feed
           • invoices                  FIRSMBS e-invoices
           • tax_payments              Remita RRR storage
```

### 1.3 Backend API Contract

```
Auth
  POST   /api/v1/auth/login             → { accessToken, refreshToken }
  POST   /api/v1/auth/refresh           → { accessToken, refreshToken }
  DELETE /api/v1/auth/logout
  POST   /api/v1/auth/otp/request       → Africa's Talking SMS
  POST   /api/v1/auth/otp/verify        → { valid: boolean }

Onboarding
  POST   /api/v1/onboarding/step-complete  body: { stepId }
  POST   /api/v1/onboarding/complete

Profile
  PATCH  /api/v1/business-profile       body: BusinessProfile
  GET    /api/v1/business-profile

KYC
  POST   /api/v1/kyc/tin-verify         → BullMQ → Youverify → webhook → SSE
  GET    /api/v1/kyc/tin-status

Tax
  GET    /api/v1/tax/obligations
  POST   /api/v1/tax/payments           body: { provider, amountNGN, ... }
  GET    /api/v1/tax/calendar

Invoices
  POST   /api/v1/invoices               → FIRSMBS
  GET    /api/v1/invoices?page=&limit=

Sync
  POST   /api/v1/sync/operations        body: { clientId, type, payload }
  GET    /events                        Server-Sent Events stream

Required headers on every call:
  Authorization:        Bearer <access_token>
  X-TaxBridge-Version:  13
  X-Device-ID:          <stable-uuid-from-expo-device>
  Content-Type:         application/json
```

### 1.4 BullMQ Queue Map (mobile type → backend queue)

```
'TIN_VERIFY'        → kyc-queue         (Youverify)
'VAT_REGISTER'      → nrs-queue
'EINVOICE_SUBMIT'   → firsmbs-queue
'PROFILE_SYNC'      → profile-queue     (Prisma upsert)
'PAYMENT_INITIATE'  → payment-queue     (Paystack / Flutterwave / Remita)
'COMPLIANCE_EVENT'  → compliance-queue  (→ Admin dashboard)
```

---

## ═══════════════════════════════════════════════════
## CHAPTER 2 — NRS 2026 COMPLIANCE REFERENCE
## ═══════════════════════════════════════════════════

| Rule | Value | Source |
|------|-------|--------|
| VAT rate | 7.5% | NTA 2025 |
| VAT registration enforcement threshold | ₦25M turnover | NRS operational guidance |
| VAT filing exemption | <₦100M turnover AND <₦250M fixed assets | NTA 2025 §22 |
| **VAT exemption caveat** | **Exempt from FILING; MUST still CHARGE 7.5% on invoices** | NTA 2025 §22 |
| CIT: small company | **0%** — turnover <₦50M + assets <₦250M + non-professional | NTA 2025 §56 |
| CIT: medium | 20% — turnover ₦50M–₦100M | NTA 2025 |
| CIT: large | 30% — turnover >₦100M | NTA 2025 |
| PIT: zero-band | First **₦800K** annual income = 0% | NTA 2025 |
| WHT exemption | <₦2M/month with valid TIN | NTAA 2025 |
| WHT without TIN | Full WHT rate on ALL receipts | NTA 2025 |
| Dev levy | Exempt for small companies <₦50M | NTA 2025 |
| E-invoice Phase 1 | ≥₦5B: enforcement **active since Apr 2026** | NRS Q1 2026 |
| E-invoice Phase 2 | ₦1B–₦5B: mandatory **Jul 2026**, enforcement Jan 2027 | NRS Q1 2026 |
| E-invoice Phase 3 | <₦1B (most TaxBridge users): mandatory **Jul 2027** | NRS Q1 2026 |
| Authority legal name | Nigeria Revenue Service (NRS) | NTA 2025 |
| Technical portal | `einvoice.firs.gov.ng` (domain NOT yet migrated) | NRS Mar 2026 |
| TIN on invoices | Mandatory; no TIN = full WHT deducted by payer | NTA 2025 |

---

## ═══════════════════════════════════════════════════
## CHAPTER 3 — COMPLETE FILE IMPLEMENTATIONS
## ═══════════════════════════════════════════════════

### 3.1 Config Files

#### `babel.config.js`
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [],
    // ✅ DO NOT add react-native-reanimated/plugin
    // ✅ DO NOT add react-native-worklets/plugin
    // babel-preset-expo auto-injects both for SDK 54 (SDK-04 fix)
  };
};
```

#### `metro.config.js`
```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind }   = require('nativewind/metro');
const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

#### `global.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### `tailwind.config.js`
```javascript
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand:      { primary: '#006B3F', secondary: '#FFD700', accent: '#E8401C' },
        compliance: { shield: '#00C853', warning: '#FFB300', danger: '#D50000', pending: '#7C4DFF' },
        surface:    { DEFAULT: '#FFFFFF', dark: '#1A1A2E', card: '#F5F7FA', cardDark: '#16213E' },
        text:       { primary: '#1A1A2E', secondary: '#5A6A7A', muted: '#8A9BB0' },
      },
    },
  },
  plugins: [],
};
```

#### `tsconfig.json`
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"]
}
```

#### `app.json` (critical fields — merge with existing)
```json
{
  "expo": {
    "name": "TaxBridge",
    "slug": "taxbridge",
    "version": "1.3.0",
    "sdkVersion": "54.0.0",
    "runtimeVersion": { "policy": "sdkVersion" },
    "scheme": "taxbridge",
    "newArchEnabled": true,
    "android": {
      "package": "ng.taxbridge.app",
      "versionCode": 13,
      "compileSdkVersion": 36,
      "targetSdkVersion": 36,
      "predictiveBackGestureEnabled": false,
      "androidNavigationBar": { "backgroundColor": "#00000000", "barStyle": "dark-content" }
    },
    "ios": {
      "bundleIdentifier": "ng.taxbridge.app",
      "infoPlist": {
        "CADisableMinimumFrameDurationOnPhone": true,
        "NSFaceIDUsageDescription": "Secure your TaxBridge account with Face ID",
        "NSCameraUsageDescription": "Scan documents for TIN verification"
      }
    },
    "plugins": [
      ["expo-build-properties", {
        "android": {
          "enableMinifyInReleaseBuilds": true,
          "compileSdkVersion": 36,
          "targetSdkVersion": 36,
          "kotlinVersion": "2.1.20"
        },
        "ios": { "buildReactNativeFromSource": false }
      }],
      ["@sentry/react-native/expo", {
        "organization": "taxbridge",
        "project": "taxbridge-mobile",
        "authToken": { "$ref": "$SENTRY_AUTH_TOKEN" }
      }],
      "expo-router", "expo-sqlite", "expo-secure-store",
      "expo-speech", "expo-sharing", "lottie-react-native"
    ],
    "extra": {
      "router": { "origin": false },
      "eas": { "projectId": "YOUR_EAS_PROJECT_ID" }
    }
  }
}
```
**Removed from v3/v4**: `staticFlags` in Reanimated plugin (doesn't exist in plugin API — SDK-09 fix).
**Changed from v4**: `enableProguardInReleaseBuilds` → `enableMinifyInReleaseBuilds` (SDK-01 fix).

#### `.env.example`
```bash
EXPO_PUBLIC_API_URL=https://api.taxbridge.ng
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_SENTRY_DSN=https://your_dsn@sentry.io/project_id
# Set via EAS secrets (never commit real values):
# SENTRY_AUTH_TOKEN=
```

#### `package.json` (key entries)
```json
{
  "name": "taxbridge-mobile",
  "version": "1.3.0",
  "main": "expo-router/entry",
  "engines": { "node": ">=20.19.4" },
  "scripts": {
    "start":      "expo start",
    "prebuild":   "expo prebuild --clean",
    "test":       "jest --coverage",
    "typecheck":  "tsc --noEmit",
    "lint":       "eslint . --ext .ts,.tsx",
    "doctor":     "npx expo-doctor"
  },
  "dependencies": {
    "expo": "~54.0.7",
    "expo-router": "~6.0.4",
    "react": "19.1.0",
    "react-native": "0.81.5",
    "react-native-reanimated": "~4.1.0",
    "react-native-worklets": "~0.5.1",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.23.0",
    "react-native-svg": "~15.11.2",
    "@shopify/flash-list": "~2.7.2",
    "expo-sqlite": "~15.2.10",
    "expo-secure-store": "~14.2.0",
    "expo-haptics": "~14.0.1",
    "expo-speech": "~13.0.0",
    "expo-sharing": "~13.0.0",
    "expo-file-system": "~18.0.11",
    "expo-crypto": "~14.0.1",
    "expo-device": "~7.0.1",
    "expo-localization": "~16.0.1",
    "react-native-view-shot": "~3.9.0",
    "react-native-sse": "~1.2.0",
    "@react-native-community/netinfo": "~11.4.1",
    "zustand": "~5.0.3",
    "i18next": "~24.2.2",
    "react-i18next": "~15.4.1",
    "nativewind": "~4.2.1",
    "@sentry/react-native": "~6.11.0",
    "lottie-react-native": "~7.2.2"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.17",
    "typescript": "~5.8.3",
    "@types/react": "~19.1.0",
    "jest": "~29.7.0",
    "eslint": "~9.23.0"
  }
}
```
**Note**: `react-native-reanimated` listed ONCE (SDK-11 fix — v4 listed it twice).

---

### 3.2 Storage Layer

#### `storage/kv.ts`
```typescript
// mobile/storage/kv.ts
// B-01, C-01, SDK-10 fixes: dual API — async for Zustand, sync for components
import Storage from 'expo-sqlite/kv-store';

// ── Async adapter ── required by Zustand createJSONStorage (SDK-10 fix) ─
export const zustandKvStorage = {
  getItem:    (key: string): Promise<string | null> => Storage.getItem(key),
  setItem:    (key: string, value: string): Promise<void> => Storage.setItem(key, value),
  removeItem: (key: string): Promise<void> => Storage.removeItem(key),
};

// ── Sync helpers ── direct component reads, < 0.1ms (C-01 fix) ─────────
export const AppKV = {
  onboarding: {
    getStep:      (): string   => Storage.getItemSync('ob:step') ?? 'welcome',
    setStep:      (id: string) => Storage.setItemSync('ob:step', id),
    isComplete:   (): boolean  => Storage.getItemSync('ob:done') === 'true',
    setComplete:  (v: boolean) => Storage.setItemSync('ob:done', String(v)),
    isMigrated:   (): boolean  => Storage.getItemSync('migration:v13') === 'true',
    markMigrated: ()           => Storage.setItemSync('migration:v13', 'true'),
  },
  prefs: {
    getLanguage:    (): 'en' | 'pidgin' => (Storage.getItemSync('pref:lang') ?? 'en') as 'en' | 'pidgin',
    setLanguage:    (l: 'en' | 'pidgin') => Storage.setItemSync('pref:lang', l),
    isDarkMode:     (): boolean  => Storage.getItemSync('pref:dark') === 'true',
    setDarkMode:    (v: boolean) => Storage.setItemSync('pref:dark', String(v)),
    isVoiceEnabled: (): boolean  => Storage.getItemSync('pref:voice') === 'true',
    setVoice:       (v: boolean) => Storage.setItemSync('pref:voice', String(v)),
  },
  flags: {
    get: (key: string, fallback = '') => Storage.getItemSync(`flag:${key}`) ?? fallback,
    set: (key: string, v: string)     => Storage.setItemSync(`flag:${key}`, v),
  },
};
```

---

### 3.3 Database Service

#### `services/database.ts`
```typescript
// mobile/services/database.ts
// C-06, C-07, SDK-05, SDK-06 fixes: version-gated migrations, no GENERATED column,
// correct openDatabaseAsync signature, withExclusiveTransactionAsync
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  // SDK-06 fix: no options object — openDatabaseAsync('name') only
  _db = await SQLite.openDatabaseAsync('taxbridge_v13.db');
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA cache_size = -8000;
    PRAGMA synchronous = NORMAL;
  `);
  await runMigrations(_db);
  return _db;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;

  if (v < 1) {
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS business_profiles (
          id INTEGER PRIMARY KEY DEFAULT 1,
          business_name TEXT NOT NULL DEFAULT '', trading_name TEXT,
          tin TEXT, rc_number TEXT, sector TEXT, business_type TEXT,
          annual_turnover REAL, monthly_revenue REAL, total_fixed_assets REAL,
          employee_count INTEGER DEFAULT 0, is_vat_registered INTEGER NOT NULL DEFAULT 0,
          vat_number TEXT, lga TEXT, state TEXT, phone TEXT, email TEXT,
          has_valid_tin INTEGER NOT NULL DEFAULT 0,
          onboarding_complete INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS offline_operations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL CHECK(type IN (
            'TIN_VERIFY','VAT_REGISTER','EINVOICE_SUBMIT',
            'PROFILE_SYNC','PAYMENT_INITIATE','COMPLIANCE_EVENT')),
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','syncing','done','failed','dead')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 5,
          error_msg TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_offline_ops
          ON offline_operations (status, created_at);
        PRAGMA user_version = 1;
      `);
    });
    v = 1;
  }

  if (v < 2) {
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS tax_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT UNIQUE,
          period TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('VAT','CIT','PIT','WHT','STAMP_DUTY','DEV_LEVY')),
          amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'NGN',
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK(status IN ('draft','filed','paid','overdue','disputed')),
          due_date TEXT, filed_at TEXT, paid_at TEXT,
          nrs_ref TEXT, remita_rrr TEXT, receipt_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS compliance_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT UNIQUE,
          event_type TEXT NOT NULL, description TEXT NOT NULL,
          severity TEXT NOT NULL CHECK(severity IN ('info','warning','critical')),
          resolved INTEGER NOT NULL DEFAULT 0, resolved_at TEXT, action_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_tax_records ON tax_records (period, type);
        CREATE INDEX IF NOT EXISTS idx_compliance ON compliance_events (severity, resolved, created_at);
        PRAGMA user_version = 2;
      `);
    });
    v = 2;
  }

  if (v < 3) {
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT UNIQUE,
          invoice_number TEXT NOT NULL, buyer_name TEXT NOT NULL, buyer_tin TEXT,
          subtotal REAL NOT NULL, vat_amount REAL NOT NULL DEFAULT 0, total REAL NOT NULL,
          currency TEXT NOT NULL DEFAULT 'NGN', firsmbs_ref TEXT, firsmbs_qr_url TEXT,
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK(status IN ('draft','sent','paid','overdue','cancelled')),
          issued_at TEXT, due_date TEXT, paid_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS tax_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT UNIQUE,
          tax_record_id INTEGER REFERENCES tax_records(id),
          provider TEXT NOT NULL CHECK(provider IN ('paystack','flutterwave','remita')),
          provider_ref TEXT, remita_rrr TEXT,
          amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'NGN',
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','processing','successful','failed','reversed')),
          initiated_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_invoices ON invoices (status, issued_at);
        CREATE INDEX IF NOT EXISTS idx_payments ON tax_payments (provider, status);
        PRAGMA user_version = 3;
      `);
    });
  }
}
```

---

### 3.4 Zustand Stores

#### `stores/onboardingStore.ts`
```typescript
// mobile/stores/onboardingStore.ts
// B-01..B-06, C-01..C-05, SDK-10, SDK-13 fixes applied
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { router } from 'expo-router';               // SDK-13: no navigationRef
import * as Haptics from 'expo-haptics';
import { zustandKvStorage } from '../storage/kv';   // SDK-10: async API
import { apiRequest } from '../services/api';
import { logComplianceEvent } from '../services/complianceEventService';
import { getDatabase } from '../services/database';

// Step registry
export const STEP_IDS = {
  WELCOME: 'welcome', BUSINESS_TYPE: 'business-type', TIN_VERIFY: 'tin-verify',
  VAT_SETUP: 'vat-setup', EINVOICE: 'einvoice', COMMUNITY: 'community',
} as const;
export type StepId = typeof STEP_IDS[keyof typeof STEP_IDS];

export interface OnboardingStep {
  id: StepId; titleKey: string; required: boolean; backendSyncOnComplete: boolean;
}

export const STEPS: OnboardingStep[] = [
  { id: 'welcome',       titleKey: 'onboarding.welcome.title',      required: true,  backendSyncOnComplete: false },
  { id: 'business-type', titleKey: 'onboarding.businessType.title', required: true,  backendSyncOnComplete: true  },
  { id: 'tin-verify',    titleKey: 'onboarding.tinVerify.title',    required: true,  backendSyncOnComplete: true  },
  { id: 'vat-setup',     titleKey: 'onboarding.vatSetup.title',     required: false, backendSyncOnComplete: true  },
  { id: 'einvoice',      titleKey: 'onboarding.einvoice.title',     required: false, backendSyncOnComplete: false },
  { id: 'community',     titleKey: 'onboarding.community.title',    required: false, backendSyncOnComplete: false },
];

// B-03 fix: legacy ID migration map
const LEGACY: Record<string, StepId> = {
  pit: 'tin-verify', vatcit: 'vat-setup', nrs: 'einvoice',
};
export function migrateLegacyStepId(raw: string): StepId {
  return LEGACY[raw] ?? (STEPS.find(s => s.id === raw)?.id ?? 'welcome');
}

interface OnboardingStore {
  currentStepId: StepId; completedSteps: StepId[];
  isComplete: boolean; schemaVersion: number; isSyncing: boolean;
  goNext(): Promise<void>; goPrev(): void;
  skipAllOptional(): Promise<void>; complete(): Promise<void>;
  migrateIfNeeded(): void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      currentStepId: 'welcome', completedSteps: [], isComplete: false,
      schemaVersion: 13, isSyncing: false,

      // B-03 fix: called in onRehydrateStorage, not in a separate useEffect
      migrateIfNeeded: () => {
        const { currentStepId, completedSteps, schemaVersion } = get();
        if (schemaVersion < 13) {
          set({
            currentStepId:  migrateLegacyStepId(currentStepId),
            completedSteps: completedSteps.map(migrateLegacyStepId),
            schemaVersion:  13,
          });
        }
      },

      goNext: async () => {
        const { currentStepId, completedSteps } = get();
        const idx = STEPS.findIndex(s => s.id === currentStepId);
        const newCompleted = completedSteps.includes(currentStepId)
          ? completedSteps : [...completedSteps, currentStepId];

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Non-blocking backend sync for steps that need it
        if (STEPS[idx].backendSyncOnComplete) {
          set({ isSyncing: true });
          apiRequest('/api/v1/onboarding/step-complete', {
            method: 'POST', body: JSON.stringify({ stepId: currentStepId }),
          }).catch(async () => {
            const db = await getDatabase();
            await db.runAsync(
              `INSERT OR IGNORE INTO offline_operations (client_id, type, payload)
               VALUES (?, 'PROFILE_SYNC', ?)`,
              [`step_${currentStepId}_${Date.now()}`, JSON.stringify({ stepId: currentStepId })]
            );
          }).finally(() => set({ isSyncing: false }));
        }

        if (idx >= STEPS.length - 1) { await get().complete(); return; }
        set({ currentStepId: STEPS[idx + 1].id, completedSteps: newCompleted });
      },

      goPrev: () => {
        const idx = STEPS.findIndex(s => s.id === get().currentStepId);
        if (idx > 0) set({ currentStepId: STEPS[idx - 1].id });
      },

      // B-06 fix: atomic single set + complete
      skipAllOptional: async () => {
        const { completedSteps } = get();
        const optionalIds  = STEPS.filter(s => !s.required).map(s => s.id);
        const requiredDone = completedSteps.filter(id => STEPS.find(s => s.id === id && s.required));
        set({ completedSteps: [...requiredDone, ...optionalIds] });
        await get().complete();
      },

      // B-02 fix: router.replace (no navigationRef race condition)
      complete: async () => {
        set({ isComplete: true });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        apiRequest('/api/v1/onboarding/complete', { method: 'POST' }).catch(() => {});
        // I-08 fix: write compliance event for admin dashboard
        logComplianceEvent('onboarding_complete', 'User completed onboarding', 'info').catch(() => {});
        router.replace('/(tabs)/');
      },
    }),
    {
      name:    'taxbridge:onboarding:v13',
      storage: createJSONStorage(() => zustandKvStorage), // SDK-10 fix
      partialize: s => ({
        currentStepId: s.currentStepId, completedSteps: s.completedSteps,
        isComplete: s.isComplete, schemaVersion: s.schemaVersion,
      }),
      onRehydrateStorage: () => state => state?.migrateIfNeeded(), // B-03 fix
    }
  )
);

// C-05 fix: selector hooks — only relevant slice re-renders
export const useCurrentStepId    = () => useOnboardingStore(s => s.currentStepId);
export const useIsOnboardingDone = () => useOnboardingStore(s => s.isComplete);
export const useProgressPercent  = () => useOnboardingStore(s => {
  const req  = STEPS.filter(st => st.required).length;
  const done = s.completedSteps.filter(id => STEPS.find(st => st.id === id && st.required)).length;
  return Math.round((done / req) * 100);
});
```

#### `stores/businessProfileStore.ts`
```typescript
// mobile/stores/businessProfileStore.ts
import { create } from 'zustand';
import { getDatabase } from '../services/database';
import { apiRequest } from '../services/api';

interface BusinessProfile {
  businessName: string; tradingName: string; tin: string; rcNumber: string;
  sector: string; businessType: 'sole_trader'|'partnership'|'limited_company'|'ngo'|'';
  annualTurnover: number|null; monthlyRevenue: number|null; totalFixedAssets: number|null;
  employeeCount: number; isVatRegistered: boolean; vatNumber: string;
  lga: string; state: string; phone: string; email: string; hasValidTIN: boolean;
}

interface Store extends BusinessProfile {
  isHydrated: boolean; isDirty: boolean; lastSyncedAt: string|null;
  hydrate(): Promise<void>;
  updateField<K extends keyof BusinessProfile>(key: K, val: BusinessProfile[K]): void;
  syncToBackend(): Promise<void>;
  getProfileSnapshot(): Partial<BusinessProfile>;
}

export const useBusinessProfileStore = create<Store>()((set, get) => {
  let flushTimer: ReturnType<typeof setTimeout>|null = null;

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(async () => {
      const s = get();
      const db = await getDatabase();
      // C-07 fix: withExclusiveTransactionAsync for atomic multi-column write
      await db.withExclusiveTransactionAsync(async tx => {
        await tx.runAsync(
          `INSERT OR REPLACE INTO business_profiles (
             id, business_name, trading_name, tin, rc_number, sector, business_type,
             annual_turnover, monthly_revenue, total_fixed_assets, employee_count,
             is_vat_registered, vat_number, lga, state, phone, email, has_valid_tin,
             updated_at)
           VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
          [s.businessName, s.tradingName, s.tin, s.rcNumber, s.sector, s.businessType,
           s.annualTurnover, s.monthlyRevenue, s.totalFixedAssets, s.employeeCount,
           s.isVatRegistered ? 1 : 0, s.vatNumber, s.lga, s.state,
           s.phone, s.email, s.hasValidTIN ? 1 : 0]
        );
      });
      set({ isDirty: false });
    }, 800);
  };

  return {
    businessName: '', tradingName: '', tin: '', rcNumber: '', sector: '',
    businessType: '', annualTurnover: null, monthlyRevenue: null,
    totalFixedAssets: null, employeeCount: 0, isVatRegistered: false,
    vatNumber: '', lga: '', state: '', phone: '', email: '', hasValidTIN: false,
    isHydrated: false, isDirty: false, lastSyncedAt: null,

    hydrate: async () => {
      const db  = await getDatabase();
      const row = await db.getFirstAsync<any>('SELECT * FROM business_profiles WHERE id = 1');
      if (row) set({ ...row, isVatRegistered: row.is_vat_registered === 1,
                    hasValidTIN: row.has_valid_tin === 1, isHydrated: true });
      else set({ isHydrated: true });
    },

    updateField: (key, value) => { set({ [key]: value, isDirty: true }); scheduleFlush(); },

    syncToBackend: async () => {
      if (!get().isDirty) return;
      try {
        await apiRequest('/api/v1/business-profile', {
          method: 'PATCH', body: JSON.stringify(get().getProfileSnapshot()),
        });
        set({ lastSyncedAt: new Date().toISOString(), isDirty: false });
      } catch { /* Will retry via OfflineQueue */ }
    },

    getProfileSnapshot: () => {
      const s = get();
      return { businessName: s.businessName, tradingName: s.tradingName, tin: s.tin,
               rcNumber: s.rcNumber, sector: s.sector, businessType: s.businessType,
               annualTurnover: s.annualTurnover, monthlyRevenue: s.monthlyRevenue,
               totalFixedAssets: s.totalFixedAssets, employeeCount: s.employeeCount,
               isVatRegistered: s.isVatRegistered, vatNumber: s.vatNumber,
               lga: s.lga, state: s.state, phone: s.phone, email: s.email };
    },
  };
});
```

---

### 3.5 Services

#### `services/tokenService.ts`
```typescript
// mobile/services/tokenService.ts
// I-02 fix: expo-secure-store exclusively — MMKV is not encrypted
import * as SecureStore from 'expo-secure-store';

const ACCESS  = 'taxbridge:access_token';
const REFRESH = 'taxbridge:refresh_token';

export const TokenService = {
  async setTokens(access: string, refresh: string) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS, access),
      SecureStore.setItemAsync(REFRESH, refresh),
    ]);
  },
  getAccessToken:  () => SecureStore.getItemAsync(ACCESS),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH),
  async clearTokens() {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]);
  },
};
```

#### `services/api.ts` (additions to existing file)
```typescript
// mobile/services/api.ts — add these to existing apiRequest function
// I-03 fix: version + device ID headers on every request
// I-02 fix: 401 → silent refresh → retry once → logout on second 401

import { TokenService } from './tokenService';
import { useAuthStore } from '../stores/authStore'; // existing store
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';

let deviceId: string | null = null;
async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  deviceId = Device.deviceName ?? await Crypto.randomUUID();
  return deviceId;
}

let isRefreshing = false;

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await TokenService.getAccessToken();
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token ?? ''}`,
      'X-TaxBridge-Version': '13',
      'X-Device-ID': await getDeviceId(),
      ...options.headers,
    },
  });

  if (res.status === 401 && !isRefreshing) {
    isRefreshing = true;
    try {
      const refreshToken = await TokenService.getRefreshToken();
      if (!refreshToken) throw new Error('no_refresh_token');
      const refreshRes = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/v1/auth/refresh`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TaxBridge-Version': '13' },
          body: JSON.stringify({ refreshToken }) }
      );
      if (!refreshRes.ok) throw new Error('refresh_failed');
      const { accessToken, refreshToken: newRefresh } = await refreshRes.json();
      await TokenService.setTokens(accessToken, newRefresh);
      isRefreshing = false;
      return apiRequest(path, options); // retry once
    } catch {
      isRefreshing = false;
      await TokenService.clearTokens();
      useAuthStore.getState().logout();
      throw new Error('session_expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'api_error');
  }
  return res.json();
}
```

#### `services/storageMigration.ts`
```typescript
// mobile/services/storageMigration.ts
// B-01 fix: one-time migration from AsyncStorage to kv-store
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppKV } from '../storage/kv';
import { migrateLegacyStepId } from '../stores/onboardingStore';

export async function migrateFromAsyncStorage(): Promise<void> {
  if (AppKV.onboarding.isMigrated()) return;
  try {
    const [step, done] = await Promise.all([
      AsyncStorage.getItem('onboarding_step'),
      AsyncStorage.getItem('onboarding_complete'),
    ]);
    if (step) AppKV.onboarding.setStep(migrateLegacyStepId(step));
    if (done) AppKV.onboarding.setComplete(done === 'true');
    AppKV.onboarding.markMigrated();
    await AsyncStorage.multiRemove([
      'onboarding_step','onboarding_complete','onboarding_fields',
      'onboarding_progress', // v11 key
    ]);
  } catch {
    // Degraded: start fresh rather than crash
  }
}
```

#### `services/nrsCompliance.ts`
```typescript
// mobile/services/nrsCompliance.ts
// TAX-01..TAX-06 fixes: complete NRS 2026 rules

export const TAX_AUTHORITY = {
  legalName:   'Nigeria Revenue Service (NRS)',
  displayName: 'NRS (formerly FIRS)',
  portalUrl:   'https://einvoice.firs.gov.ng', // domain NOT yet migrated
  tinPortal:   'https://apps.firs.gov.ng/tinverification/',
};

export const EINVOICING_PHASES = {
  large:  { turnoverMin: 5_000_000_000, mandatoryDate: new Date('2025-11-01'),
            enforcementDate: new Date('2026-04-01'), status: 'ENFORCEMENT_ACTIVE' as const },
  medium: { turnoverMin: 1_000_000_000, turnoverMax: 5_000_000_000,
            mandatoryDate: new Date('2026-07-01'), enforcementDate: new Date('2027-01-01'),
            status: 'PILOT_PHASE' as const },
  small:  { turnoverMax: 1_000_000_000, mandatoryDate: new Date('2027-07-01'),
            enforcementDate: new Date('2028-01-01'), status: 'VOLUNTARY' as const },
};

export const NRS_RULES = {
  vat: { rate: 0.075, practicalThreshold: 25_000_000,
         filingExemptTurnoverCap: 100_000_000, filingExemptAssetCap: 250_000_000 },
  cit: { smallRate: 0, smallTurnoverCap: 50_000_000, smallAssetCap: 250_000_000,
         mediumRate: 0.20, mediumTurnoverCap: 100_000_000, largeRate: 0.30 },
  pit: { zeroTaxBand: 800_000,
         brackets: [
           { from: 800_000,    to: 2_800_000,  rate: 0.15 },
           { from: 2_800_000,  to: 5_800_000,  rate: 0.19 },
           { from: 5_800_000,  to: 10_800_000, rate: 0.21 },
           { from: 10_800_000, to: Infinity,   rate: 0.24 },
         ]},
  wht: { exemptMonthlyThreshold: 2_000_000 },
};

export interface BusinessProfile {
  annualTurnover: number; totalFixedAssets: number; sector: string;
  businessType: string; isVatRegistered: boolean; hasValidTIN: boolean;
  monthlyRevenue?: number;
}

export function computeObligations(p: BusinessProfile) {
  const isProf     = p.sector === 'professional_services';
  const isSmallBiz = p.annualTurnover <= 100_000_000 && p.totalFixedAssets <= 250_000_000 && !isProf;
  const isSmallCo  = p.annualTurnover <= 50_000_000  && p.totalFixedAssets <= 250_000_000 && !isProf;
  const isSole     = ['sole_trader','partnership'].includes(p.businessType);

  const citRate      = isSmallCo ? 0 : p.annualTurnover <= 100_000_000 ? 0.20 : 0.30;
  const citLiability = isSole ? 0 : p.annualTurnover * citRate;
  const pitLiability = isSole ? computePIT(p.annualTurnover) : 0;

  const einvPhase = p.annualTurnover >= 5_000_000_000 ? 'large'
                  : p.annualTurnover >= 1_000_000_000 ? 'medium' : 'small';
  const phase     = EINVOICING_PHASES[einvPhase];
  const eInvoicingMandatory = new Date() >= phase.mandatoryDate;

  return {
    vatRegistrationRequired: p.annualTurnover > 25_000_000 || p.isVatRegistered,
    vatFilingRequired:        !isSmallBiz || p.annualTurnover > 100_000_000,
    vatFilingExempt:          isSmallBiz && p.annualTurnover <= 100_000_000,
    citRate, citLiability, pitLiability,
    whtExemptEligible: p.hasValidTIN && (p.monthlyRevenue ?? 0) < 2_000_000,
    eInvoicingPhase: einvPhase as 'large'|'medium'|'small',
    eInvoicingMandatory,
    eInvoicingDeadline: phase.mandatoryDate,
    complianceScore: computeScore(p, eInvoicingMandatory),
    annualTaxBurden: citLiability + pitLiability,
  };
}

function computePIT(income: number): number {
  const taxable = Math.max(0, income - NRS_RULES.pit.zeroTaxBand);
  let tax = 0, rem = taxable;
  for (const b of NRS_RULES.pit.brackets) {
    if (rem <= 0) break;
    const band = b.to === Infinity ? rem : Math.min(rem, b.to - b.from);
    tax += band * b.rate; rem -= band;
  }
  return tax;
}

function computeScore(p: BusinessProfile, eInvMandatory: boolean): number {
  let s = 10;
  if (p.hasValidTIN) s += 40;
  if (p.isVatRegistered || p.annualTurnover <= 25_000_000) s += 30;
  if (!eInvMandatory) s += 20;
  return Math.min(100, s);
}
```

#### `services/otpService.ts`
```typescript
// mobile/services/otpService.ts
// I-06 fix: three clean non-overlapping branches (B-duplicate removed)
export function normalizeNigeriaPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11)     return `+234${d.slice(1)}`;
  if (d.startsWith('234') && d.length === 13)   return `+${d}`;
  if (raw.startsWith('+234') && raw.length === 14) return raw;
  return raw;
}
export async function requestOTP(raw: string) {
  const { apiRequest } = await import('./api');
  return apiRequest<{ success: boolean; message: string }>('/api/v1/auth/otp/request', {
    method: 'POST', body: JSON.stringify({ phone: normalizeNigeriaPhone(raw) }),
  });
}
export async function verifyOTP(raw: string, code: string): Promise<boolean> {
  const { apiRequest } = await import('./api');
  const r = await apiRequest<{ valid: boolean }>('/api/v1/auth/otp/verify', {
    method: 'POST', body: JSON.stringify({ phone: normalizeNigeriaPhone(raw), code }),
  });
  return r.valid;
}
```

#### `services/offlineQueue.ts`
```typescript
// mobile/services/offlineQueue.ts
// I-01 fix: payloads match BullMQ worker schemas
// B-01 fix: SQLite-backed, not AsyncStorage
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { getDatabase } from './database';
import { apiRequest } from './api';

export type OpType = 'TIN_VERIFY'|'VAT_REGISTER'|'EINVOICE_SUBMIT'|
                     'PROFILE_SYNC'|'PAYMENT_INITIATE'|'COMPLIANCE_EVENT';

export class OfflineQueue {
  private static instance: OfflineQueue|null = null;
  private flushing = false;
  private unsub: (() => void)|null = null;

  private constructor() {
    this.unsub = NetInfo.addEventListener(s => {
      if (s.isConnected && !this.flushing) this.flush().catch(console.error);
    });
  }

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) OfflineQueue.instance = new OfflineQueue();
    return OfflineQueue.instance;
  }

  async enqueue(type: OpType, payload: Record<string, unknown>): Promise<void> {
    const db = await getDatabase();
    const id = await Crypto.randomUUID();
    await db.runAsync(
      `INSERT OR IGNORE INTO offline_operations (client_id, type, payload) VALUES (?,?,?)`,
      [id, type, JSON.stringify({ ...payload, clientId: id })]
    );
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    const db = await getDatabase();
    try {
      const ops = await db.getAllAsync<{ id: number; client_id: string; type: string; payload: string; retry_count: number }>(
        `SELECT id, client_id, type, payload, retry_count FROM offline_operations
         WHERE status = 'pending' AND retry_count < max_retries ORDER BY created_at ASC LIMIT 20`
      );
      for (const op of ops) {
        await db.runAsync(`UPDATE offline_operations SET status='syncing' WHERE id=?`, [op.id]);
        try {
          await apiRequest('/api/v1/sync/operations', {
            method: 'POST',
            body: JSON.stringify({ clientId: op.client_id, type: op.type, payload: JSON.parse(op.payload) }),
          });
          await db.runAsync(`UPDATE offline_operations SET status='done', synced_at=datetime('now') WHERE id=?`, [op.id]);
        } catch (err) {
          const n = op.retry_count + 1;
          await db.runAsync(
            `UPDATE offline_operations SET status=?, retry_count=?, error_msg=? WHERE id=?`,
            [n >= 5 ? 'dead' : 'pending', n, String(err), op.id]
          );
        }
      }
    } finally { this.flushing = false; }
  }

  destroy() { this.unsub?.(); OfflineQueue.instance = null; }
}

export const offlineQueue = OfflineQueue.getInstance();
```

#### `services/complianceEventService.ts`
```typescript
// mobile/services/complianceEventService.ts
// I-08 fix: write events that feed the admin dashboard
import { getDatabase } from './database';
import { offlineQueue } from './offlineQueue';

export type ComplianceEventType =
  | 'onboarding_complete' | 'tin_verified' | 'tin_failed'
  | 'vat_registration_attempted' | 'einvoice_submitted'
  | 'invoice_overdue' | 'tax_payment_initiated'
  | 'tax_payment_successful' | 'tax_payment_failed'
  | 'deadline_approaching' | 'deadline_missed';

export async function logComplianceEvent(
  type: ComplianceEventType, description: string,
  severity: 'info'|'warning'|'critical',
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO compliance_events (event_type, description, severity) VALUES (?,?,?)`,
    [type, description, severity]
  );
  await offlineQueue.enqueue('COMPLIANCE_EVENT',
    { eventType: type, description, severity, metadata: metadata ?? {} }
  );
}
```

---

### 3.6 Expo Router App Files

#### `app/_layout.tsx`
```typescript
// mobile/app/_layout.tsx
// SDK-03 fix: SafeAreaView from react-native-safe-area-context
// B-02 fix: no navigationRef needed — Expo Router handles routing
import 'react-native-reanimated';  // must be first import
import '../global.css';

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import { I18nextProvider } from 'react-i18next';

import i18n from '../i18n';
import { getDatabase } from '../services/database';
import { migrateFromAsyncStorage } from '../services/storageMigration';
import { useBusinessProfileStore } from '../stores/businessProfileStore';
import { offlineQueue } from '../services/offlineQueue';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__ && !isRunningInExpoGo(),
  tracesSampleRate: 0.15,
  environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
});

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const hydrateProfile = useBusinessProfileStore(s => s.hydrate);

  useEffect(() => {
    (async () => {
      try {
        await getDatabase();
        await migrateFromAsyncStorage();  // B-01 fix: one-time migration
        await hydrateProfile();
        offlineQueue.flush();             // non-blocking
      } catch (err) {
        Sentry.captureException(err);
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(onboarding)" options={{ animation: 'none' }} />
            <Stack.Screen name="(tabs)"       options={{ animation: 'none' }} />
          </Stack>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
```

#### `app/(onboarding)/_layout.tsx`
```typescript
// mobile/app/(onboarding)/_layout.tsx
import { Redirect, Stack } from 'expo-router';
import { useIsOnboardingDone } from '../../stores/onboardingStore';

export default function OnboardingLayout() {
  const isDone = useIsOnboardingDone();
  if (isDone) return <Redirect href="/(tabs)/" />;
  return (
    <Stack screenOptions={{
      headerShown: false, animation: 'slide_from_right', gestureEnabled: false,
    }} />
  );
}
```

#### `app/(tabs)/_layout.tsx`
```typescript
// mobile/app/(tabs)/_layout.tsx
// SDK-07, SDK-08 fixes: correct NativeTabs API for SDK 54, iOS 18 fallback
import { Platform } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useIsOnboardingDone } from '../../stores/onboardingStore';

// SDK-08: NativeTabs icons invisible on iOS 18 dev builds (issue #39722)
// Production builds work on all platforms. Liquid Glass only on iOS 26+.
const USE_NATIVE_TABS = Platform.OS !== 'ios' || !__DEV__;

const TABS = [
  { name: 'index',        sf: 'house.fill',             drawable: 'ic_home',           label: 'Dashboard'  },
  { name: 'invoices',     sf: 'doc.text.fill',           drawable: 'ic_description',    label: 'Invoices'   },
  { name: 'tax-calendar', sf: 'calendar.badge.clock',    drawable: 'ic_calendar_today', label: 'Calendar'   },
  { name: 'compliance',   sf: 'checkmark.shield.fill',   drawable: 'ic_verified_user',  label: 'Compliance' },
  { name: 'settings',     sf: 'gearshape.fill',          drawable: 'ic_settings',       label: 'Settings'   },
  // MAX 5 tabs — Android Material constraint (SDK-70 note)
];

export default function TabsLayout() {
  const isDone = useIsOnboardingDone();
  if (!isDone) return <Redirect href="/(onboarding)/" />;

  if (!USE_NATIVE_TABS) {
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#006B3F' }}>
        {TABS.map(t => (
          <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
        ))}
      </Tabs>
    );
  }

  // SDK-07 fix: use Icon/Label directly, NOT NativeTabs.Trigger.Icon
  return (
    <NativeTabs>
      {TABS.map(t => (
        <NativeTabs.Trigger key={t.name} name={t.name}>
          <Icon sf={t.sf} drawable={t.drawable} />
          <Label>{t.label}</Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
```

---

### 3.7 Components

#### `components/design-system/tokens.ts`
```typescript
// mobile/components/design-system/tokens.ts
// UX-01 fix: complete design system
import { Platform, useColorScheme } from 'react-native';

export const palette = {
  nrsGreen: '#006B3F', nrsGreenDim: '#004D2D',
  nrsGold: '#FFD700', nrsRed: '#E8401C',
  shield: '#00C853', warning: '#FFB300', danger: '#D50000', pending: '#7C4DFF',
  white: '#FFFFFF', gray50: '#F5F7FA', gray100: '#E8EDF2', gray200: '#CBD5E0',
  gray400: '#8A9BB0', gray600: '#5A6A7A', gray900: '#1A1A2E',
  dark900: '#0D0D1A', dark800: '#1A1A2E', dark700: '#16213E', dark600: '#1E2D40',
} as const;

export function useTokens() {
  const d = useColorScheme() === 'dark';
  return {
    bg: d ? palette.dark900 : palette.white,
    bgCard: d ? palette.dark800 : palette.gray50,
    bgInput: d ? palette.dark700 : palette.gray50,
    textPrimary: d ? palette.white : palette.gray900,
    textSecondary: d ? palette.gray400 : palette.gray600,
    textMuted: d ? palette.gray600 : palette.gray400,
    border: d ? palette.dark600 : palette.gray100,
    brandPrimary: palette.nrsGreen,
    complianceShield: palette.shield,
    complianceWarning: palette.warning,
    complianceDanger: palette.danger,
  };
}

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const typography = {
  display:  { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h1:       { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h2:       { fontSize: 20, fontWeight: '700' as const, lineHeight: 28 },
  h3:       { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  body:     { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption:  { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label:    { fontSize: 11, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.5 },
  naira:    { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
} as const;

export const radius = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 } as const;

export const shadows = {
  sm: Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } }),
  md: Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }, android: { elevation: 4 } }),
  shield: Platform.select({ ios: { shadowColor: '#00C853', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 16 }, android: { elevation: 8 } }),
} as const;

export const minTouchTarget = 48; // iOS HIG + Material 3 minimum
```

#### `components/TaxShieldRing.tsx`
```typescript
// mobile/components/TaxShieldRing.tsx
// C-02 fix: Keyframe for entrance (worklet correct for looping), CSS Transition for score changes
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  Keyframe, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { palette } from './design-system/tokens';

const entrance = new Keyframe({
  0:   { transform: [{ scale: 0.8 }], opacity: 0 },
  70:  { transform: [{ scale: 1.05 }] },
  100: { transform: [{ scale: 1.0 }], opacity: 1 },
}).duration(600);

interface Props { compliance: number; isStreaking: boolean; size?: number; }

export function TaxShieldRing({ compliance, isStreaking, size = 128 }: Props) {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = isStreaking
      ? withRepeat(withSequence(
          withTiming(0.9, { duration: 900 }),
          withTiming(0.3, { duration: 900 })
        ), -1, true)
      : withTiming(0, { duration: 300 });
  }, [isStreaking]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value, shadowOpacity: glow.value * 0.8,
  }));

  const color  = compliance >= 80 ? palette.shield : compliance >= 50 ? palette.warning : palette.danger;
  const r      = (size / 2) - 8;
  const circ   = 2 * Math.PI * r;
  const filled = (compliance / 100) * circ;
  const cx     = size / 2;

  return (
    <Animated.View entering={entrance} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size/2, borderWidth: 2, borderColor: color, shadowColor: color, shadowRadius: 20 }, glowStyle]} />
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={color + 'AA'} />
          </LinearGradient>
        </Defs>
        <Circle cx={cx} cy={cx} r={r} stroke={palette.gray100} strokeWidth={8} fill="transparent" />
        <Circle cx={cx} cy={cx} r={r} stroke="url(#grad)" strokeWidth={8}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          fill="transparent" transform={`rotate(-90 ${cx} ${cx})`} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color }}>{compliance}%</Text>
        <Text style={{ fontSize: 11, color: palette.gray400 }}>Protected</Text>
      </View>
      {isStreaking && (
        <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#FF6D00', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, color: '#fff' }}>🔥</Text>
        </View>
      )}
    </Animated.View>
  );
}
```

#### `components/StepContainer.tsx`
```typescript
// mobile/components/StepContainer.tsx
// C-02 fix: CSS Transitions instead of worklets for step UI
import Animated from 'react-native-reanimated';

interface Props { isActive: boolean; children: React.ReactNode; }

export function StepContainer({ isActive, children }: Props) {
  return (
    <Animated.View style={{
      flex: 1, opacity: isActive ? 1 : 0,
      transform: [{ translateX: isActive ? 0 : 20 }],
      transitionProperty: ['opacity', 'transform'],
      transitionDuration: 220,
      transitionTimingFunction: 'ease-out',
    }}>
      {children}
    </Animated.View>
  );
}

export function OnboardingProgressBar({ percent }: { percent: number }) {
  const color = percent === 100 ? '#00C853' : '#006B3F';
  return (
    <Animated.View style={{ height: 4, backgroundColor: '#E8EDF2', borderRadius: 2, marginHorizontal: 20 }}>
      <Animated.View style={{
        height: '100%', width: `${percent}%`, backgroundColor: color, borderRadius: 2,
        transitionProperty: ['width', 'background-color'],
        transitionDuration: 400, transitionTimingFunction: 'ease-in-out',
      }} />
    </Animated.View>
  );
}
```

#### `components/OnboardingErrorBoundary.tsx`
```typescript
// mobile/components/OnboardingErrorBoundary.tsx
// B-07 fix: error boundary with Sentry and Pidgin messaging
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { palette, typography, spacing, radius } from './design-system/tokens';

interface Props { stepId: string; children: React.ReactNode; }
interface State { hasError: boolean; errorId?: string; }

export class OnboardingErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): Partial<State> { return { hasError: true }; }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    const id = Sentry.captureException(err, {
      contexts: { onboarding: { stepId: this.props.stepId } },
      extra: { componentStack: info.componentStack },
    });
    this.setState({ errorId: id });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.container}>
        <Text style={s.emoji}>😓</Text>
        <Text style={s.title}>Wahala dey — something break small</Text>
        <Text style={s.body}>Your progress don save. You fit continue later.</Text>
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false })}>
          <Text style={s.btnText}>Try Again</Text>
        </TouchableOpacity>
        {this.state.errorId && (
          <Text style={s.errorId}>Error ID: {this.state.errorId}</Text>
        )}
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emoji:     { fontSize: 48, marginBottom: spacing.md },
  title:     { ...typography.h2, color: palette.gray900, textAlign: 'center', marginBottom: spacing.sm },
  body:      { ...typography.body, color: palette.gray600, textAlign: 'center', marginBottom: spacing.lg },
  btn:       { backgroundColor: palette.nrsGreen, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.lg },
  btnText:   { ...typography.bodyBold, color: palette.white },
  errorId:   { ...typography.caption, color: palette.gray400, marginTop: spacing.md },
});
```

---

### 3.8 i18n

#### `i18n/index.ts`
```typescript
// mobile/i18n/index.ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en     from './en.json';
import pidgin from './pidgin.json';
import { AppKV } from '../storage/kv';

i18next.use(initReactI18next).init({
  lng: AppKV.prefs.getLanguage(),
  fallbackLng: 'en',
  resources: { en: { translation: en }, pidgin: { translation: pidgin } },
  interpolation: { escapeValue: false },
});
export default i18next;
```

#### `i18n/en.json` (complete)
```json
{
  "onboarding": {
    "stepCount": "Step {{current}} of {{total}}",
    "skipAll": "Skip remaining steps", "skipStep": "Skip this step", "finish": "Complete Setup",
    "welcome": {
      "headline": "Your Tax Partner,\nBuilt for Nigeria",
      "subheadline": "VAT, CIT, TIN and e-invoices — offline-first, Pidgin-ready.",
      "cta": "Get Started", "ctaHint": "Begin TaxBridge setup",
      "termsNote": "By continuing you agree to our Terms of Service"
    },
    "businessType": { "title": "Tell Us About\nYour Business", "subtitle": "We personalise your obligations based on your type." },
    "tinVerify": {
      "title": "Verify Your TIN",
      "body": "Your TIN is required on all invoices. Without it, 10% WHT applies to ALL payments you receive.",
      "nrsNote": "Managed by NRS (Nigeria Revenue Service, formerly FIRS)",
      "pendingNote": "Verification takes 1–2 minutes via NRS. We'll notify you automatically."
    },
    "vatSetup": {
      "title": "VAT Setup",
      "exemptTitle": "Good news — you may be exempt from filing VAT returns",
      "exemptBody": "Businesses under ₦100M turnover are exempt from filing VAT returns (NTA 2025 §22). However you MUST still charge 7.5% VAT on all invoices.",
      "requiredBody": "Your business must file VAT returns by the 21st of each month.",
      "rate": "VAT Rate: 7.5%"
    },
    "einvoice": {
      "title": "E-Invoicing",
      "phaseSmall": "Mandatory from July 2027 for your business size. Set up now — banks offer faster invoice financing to e-invoice-ready businesses.",
      "phaseMedium": "Pilot phase active. Mandatory July 1 2026. Apply for FIRSMBS integration now.",
      "phaseLarge": "⚠️ E-INVOICING ENFORCEMENT IS ACTIVE. Non-compliance = ₦200,000 penalty + 100% of tax due.",
      "platform": "Via FIRSMBS (NRS Merchant-Buyer Solution)"
    },
    "community": {
      "title": "Join the\nTaxBridge Community",
      "body": "Connect with 50,000+ Nigerian SMEs. Share your Compliance Badge and earn referral rewards.",
      "shareLabel": "Share Compliance Badge"
    }
  },
  "dashboard": {
    "greeting": "Good day",
    "yourBusiness": "Your Business",
    "shield": {
      "excellent": "🛡️ Excellent compliance — keep it up!",
      "good": "Your compliance is on track",
      "needsWork": "Action needed to improve your shield"
    },
    "nudges": { "title": "Action Required" },
    "obligations": { "title": "Your Tax Obligations" },
    "quickAction": { "invoice": "New Invoice", "payTax": "Pay Tax", "simulate": "Tax Simulator" }
  },
  "tax": {
    "cit": { "label": "Company Income Tax", "exempt": "0% (Small Company Relief)" },
    "vat": { "filing": "VAT Return Filing", "exempt": "Exempt (under ₦100M)", "required": "Required monthly" },
    "einvoice": { "label": "E-Invoicing" }
  },
  "einvoice": { "status": { "small": "Voluntary (prepare for 2027)", "medium": "Pilot active — mandatory Jul 2026", "large": "⚠️ Mandatory now" } },
  "nrs": { "name": "Nigeria Revenue Service", "shortName": "NRS", "formerly": "Formerly FIRS" },
  "nudge": {
    "tin": { "missing": "No TIN → 10% WHT on ALL income" },
    "cit": { "zeroRate": "You qualify for 0% Company Tax" },
    "vat": { "exemption": "You may be exempt from VAT return filing" }
  },
  "common": {
    "back": "Back", "continue": "Continue", "skip": "Skip",
    "loading": "Loading...", "error": "Something went wrong", "retry": "Try Again",
    "offline": "You're offline — changes saved locally"
  }
}
```

#### `i18n/pidgin.json` (complete)
```json
{
  "onboarding": {
    "stepCount": "Step {{current}} of {{total}}",
    "skipAll": "Skip the rest", "finish": "Finish Setup",
    "welcome": {
      "headline": "Your Tax Paddy,\nBuilt for Nigeria",
      "subheadline": "We go help you do VAT, CIT, TIN and e-invoice. No wahala!",
      "cta": "Make We Start"
    },
    "tinVerify": {
      "title": "Enter Your TIN",
      "body": "Without TIN, dem go cut 10% from all the money wey you collect. Enter am quick quick.",
      "pendingNote": "Verification fit take small time. We go notify you when e done."
    },
    "vatSetup": {
      "title": "VAT Setup",
      "exemptTitle": "Good news — you no need file VAT return!",
      "exemptBody": "Because your business dey below 100 million naira, you no need submit VAT return. BUT you still need collect 7.5% VAT from your customers and put am for your invoice.",
      "requiredBody": "Your business must file VAT return before 21st of every month."
    },
    "einvoice": {
      "title": "E-Invoice — New Law",
      "phaseSmall": "This one no dey compulsory for your business size until 2027. But if you start now, bank fit give you loan faster!",
      "phaseLarge": "⚠️ E-INVOICE DON BECOME LAW. If you no comply, NRS go fine you 200,000 naira plus full tax."
    },
    "community": {
      "title": "Join Our Community",
      "body": "Join more than 50,000 Nigerian business owners. Share your badge and earn referral money!"
    }
  },
  "dashboard": {
    "greeting": "How far",
    "shield": {
      "excellent": "🛡️ Your shield dey strong! Keep am up!",
      "good": "Your compliance dey okay",
      "needsWork": "You need do some things to protect your business"
    },
    "nudges": { "title": "Action Needed" }
  },
  "common": {
    "back": "Go Back", "continue": "Continue",
    "offline": "You dey offline — we don save your work"
  }
}
```

---

### 3.9 CI/CD

#### `.eas/workflows/ci.yml`
```yaml
name: TaxBridge Mobile CI/CD
on:
  push:
    branches: [master, 'release/**']
jobs:
  fingerprint:
    name: Check Native Fingerprint
    type: fingerprint
    params: { platform: all }
  build_android:
    name: Build Android
    type: build
    needs: [fingerprint]
    if: ${{ needs.fingerprint.outputs.android_fingerprint_changed == 'true' }}
    params: { platform: android, profile: production }
  build_ios:
    name: Build iOS
    type: build
    needs: [fingerprint]
    if: ${{ needs.fingerprint.outputs.ios_fingerprint_changed == 'true' }}
    params: { platform: ios, profile: production }
  update:
    name: OTA Update (JS-only)
    type: update
    needs: [fingerprint]
    if: ${{ needs.fingerprint.outputs.android_fingerprint_changed == 'false' && needs.fingerprint.outputs.ios_fingerprint_changed == 'false' }}
    params: { branch: production, message: "Auto OTA: ${{ github.event.head_commit.message }}" }
```

#### `.github/workflows/mobile-ci.yml`
```yaml
name: Mobile CI
on:
  push:    { branches: [master, 'feature/**', 'fix/**'] }
  pull_request: { branches: [master] }
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.19.4', cache: 'npm', cache-dependency-path: mobile/package-lock.json }
      - run: npm ci
        working-directory: mobile
      - run: npm run typecheck
        working-directory: mobile
      - run: npm run lint
        working-directory: mobile
      - run: npm test -- --coverage --ci
        working-directory: mobile
      - run: npx expo-doctor
        working-directory: mobile
      - uses: codecov/codecov-action@v4
        with: { token: ${{ secrets.CODECOV_TOKEN }}, directory: mobile/coverage }
```

---

### 3.10 Complete Test Suite

#### `__tests__/onboardingStore.test.ts`
```typescript
import { useOnboardingStore, STEPS, STEP_IDS, migrateLegacyStepId } from '../stores/onboardingStore';

jest.mock('expo-sqlite/kv-store', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getItemSync: jest.fn(() => null),
  setItemSync: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../services/api', () => ({ apiRequest: jest.fn(() => Promise.resolve({})) }));
jest.mock('../services/complianceEventService', () => ({ logComplianceEvent: jest.fn() }));
jest.mock('../services/database', () => ({
  getDatabase: jest.fn(() => Promise.resolve({ runAsync: jest.fn() })),
}));

const reset = () => useOnboardingStore.setState({
  currentStepId: 'welcome', completedSteps: [], isComplete: false, schemaVersion: 13, isSyncing: false,
});

describe('migrateLegacyStepId', () => {
  it.each([
    ['pit', STEP_IDS.TIN_VERIFY], ['vatcit', STEP_IDS.VAT_SETUP],
    ['nrs', STEP_IDS.EINVOICE],   ['unknown_xyz', STEP_IDS.WELCOME],
  ])('%s → %s', (inp, exp) => expect(migrateLegacyStepId(inp)).toBe(exp));

  it('is idempotent for all v13 IDs', () => {
    STEPS.forEach(s => expect(migrateLegacyStepId(s.id)).toBe(s.id));
  });
});

describe('useOnboardingStore', () => {
  beforeEach(reset);

  it('advances on goNext()', async () => {
    await useOnboardingStore.getState().goNext();
    expect(useOnboardingStore.getState().currentStepId).toBe('business-type');
  });

  it('appends to completedSteps on goNext()', async () => {
    await useOnboardingStore.getState().goNext();
    expect(useOnboardingStore.getState().completedSteps).toContain('welcome');
  });

  it('does not duplicate completedSteps', async () => {
    useOnboardingStore.setState({ completedSteps: ['welcome'] });
    await useOnboardingStore.getState().goNext();
    expect(useOnboardingStore.getState().completedSteps.filter(s => s === 'welcome')).toHaveLength(1);
  });

  it('goes back on goPrev()', () => {
    useOnboardingStore.setState({ currentStepId: 'tin-verify' });
    useOnboardingStore.getState().goPrev();
    expect(useOnboardingStore.getState().currentStepId).toBe('business-type');
  });

  it('does not go below first step', () => {
    useOnboardingStore.getState().goPrev();
    expect(useOnboardingStore.getState().currentStepId).toBe('welcome');
  });

  it('calls router.replace on complete()', async () => {
    const { router } = require('expo-router');
    await useOnboardingStore.getState().complete();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/');
    expect(useOnboardingStore.getState().isComplete).toBe(true);
  });

  it('skipAllOptional marks all optional steps done', async () => {
    useOnboardingStore.setState({ completedSteps: ['welcome','business-type','tin-verify'] });
    await useOnboardingStore.getState().skipAllOptional();
    const { completedSteps } = useOnboardingStore.getState();
    ['vat-setup','einvoice','community'].forEach(id => expect(completedSteps).toContain(id));
  });
});
```

#### `__tests__/nrsCompliance.test.ts`
```typescript
import { computeObligations } from '../services/nrsCompliance';

const base = {
  annualTurnover: 0, totalFixedAssets: 0, sector: 'trade',
  businessType: 'limited_company', isVatRegistered: false,
  hasValidTIN: true, monthlyRevenue: 0,
};

describe('CIT', () => {
  it('0% for <₦50M non-professional', () => {
    const r = computeObligations({ ...base, annualTurnover: 40_000_000, totalFixedAssets: 100_000_000 });
    expect(r.citRate).toBe(0); expect(r.citLiability).toBe(0);
  });
  it('20% for ₦50M–₦100M', () => {
    expect(computeObligations({ ...base, annualTurnover: 75_000_000, totalFixedAssets: 300_000_000 }).citRate).toBe(0.20);
  });
  it('30% for >₦100M', () => {
    expect(computeObligations({ ...base, annualTurnover: 200_000_000 }).citRate).toBe(0.30);
  });
  it('no 0% for professional services', () => {
    expect(computeObligations({ ...base, annualTurnover: 30_000_000, sector: 'professional_services' }).citRate).toBeGreaterThan(0);
  });
});

describe('PIT', () => {
  it('0 PIT for ₦800K sole trader', () => {
    expect(computeObligations({ ...base, annualTurnover: 800_000, businessType: 'sole_trader' }).pitLiability).toBe(0);
  });
  it('sole trader: CIT=0, PIT>0', () => {
    const r = computeObligations({ ...base, annualTurnover: 5_000_000, businessType: 'sole_trader' });
    expect(r.citLiability).toBe(0); expect(r.pitLiability).toBeGreaterThan(0);
  });
});

describe('VAT', () => {
  it('filing exempt for <₦100M small biz', () => {
    expect(computeObligations({ ...base, annualTurnover: 80_000_000, isVatRegistered: true }).vatFilingExempt).toBe(true);
  });
  it('filing required for >₦100M', () => {
    const r = computeObligations({ ...base, annualTurnover: 150_000_000, isVatRegistered: true });
    expect(r.vatFilingRequired).toBe(true); expect(r.vatFilingExempt).toBe(false);
  });
});

describe('E-invoice phases', () => {
  it('small = voluntary, not mandatory', () => {
    const r = computeObligations({ ...base, annualTurnover: 50_000_000 });
    expect(r.eInvoicingPhase).toBe('small'); expect(r.eInvoicingMandatory).toBe(false);
  });
  it('large = mandatory (enforcement active Apr 2026)', () => {
    const r = computeObligations({ ...base, annualTurnover: 10_000_000_000 });
    expect(r.eInvoicingPhase).toBe('large'); expect(r.eInvoicingMandatory).toBe(true);
  });
});

describe('WHT', () => {
  it('exempt: valid TIN + <₦2M/month', () => {
    expect(computeObligations({ ...base, hasValidTIN: true, monthlyRevenue: 1_500_000 }).whtExemptEligible).toBe(true);
  });
  it('not exempt: no TIN', () => {
    expect(computeObligations({ ...base, hasValidTIN: false, monthlyRevenue: 500_000 }).whtExemptEligible).toBe(false);
  });
});
```

#### `__tests__/otpService.test.ts`
```typescript
import { normalizeNigeriaPhone } from '../services/otpService';

it.each([
  ['08012345678',    '+2348012345678'],
  ['2348012345678',  '+2348012345678'],
  ['+2348012345678', '+2348012345678'],
  ['abcdefg',        'abcdefg'],
])('normalizes %s → %s', (i, o) => expect(normalizeNigeriaPhone(i)).toBe(o));
```

---

## ═══════════════════════════════════════════════════
## CHAPTER 4 — PERFORMANCE BENCHMARKS
## ═══════════════════════════════════════════════════

| Metric | Target | How to Measure |
|--------|--------|---------------|
| MMKV sync read (step pointer) | < 0.1ms | `performance.now()` around `AppKV.onboarding.getStep()` |
| Zustand rehydration | < 100ms cold start | Expo DevTools startup trace |
| Step CSS transition (render) | < 16ms JS frame | Flipper JS Frame Rate profiler |
| SQLite WAL flush (profile fields) | < 5ms | `performance.now()` around `withExclusiveTransactionAsync` |
| Cold start → first paint | < 100ms | Expo DevTools |
| Kill → resume at correct step | < 200ms | `performance.now()` around rehydration |
| TaxSimulator full compute | < 2ms | Jest `performance.now()` |
| NudgeEngine generate | < 5ms | Jest `performance.now()` |
| Zero janky frames (6-step traversal) | 0 janky frames | `adb shell dumpsys gfxinfo ng.taxbridge.app \| grep Janky` |
| Memory delta per 10 step transitions | < 5MB | Android Profiler → Heap |
| OTA update deploy (JS-only) | < 3 minutes | EAS update log |

---

## ═══════════════════════════════════════════════════
## CHAPTER 5 — QUICK REFERENCE: NEVER / ALWAYS
## ═══════════════════════════════════════════════════

| ❌ NEVER | ✅ ALWAYS | Fix ID |
|---------|---------|--------|
| `SafeAreaView` from `react-native` | from `react-native-safe-area-context` | SDK-03 |
| `react-native-reanimated/plugin` in babel | Let `babel-preset-expo` auto-inject | SDK-04 |
| `NativeTabs.Trigger.Icon` | `Icon` from `expo-router/unstable-native-tabs` | SDK-07 |
| NativeTabs without iOS 18 fallback | `USE_NATIVE_TABS = Platform.OS !== 'ios' \|\| !__DEV__` | SDK-08 |
| Sync kv-store in Zustand persist | Async `Storage.getItem/setItem` | SDK-10 |
| `GENERATED ALWAYS AS...STORED` in SQLite | Plain `CREATE INDEX` | SDK-05 |
| `openDatabaseAsync` with options object | `openDatabaseAsync('name.db')` only | SDK-06 |
| JWT in kv-store/MMKV | `expo-secure-store` only | I-02 |
| Kobo/pence to `paymentService` | Always Naira — backend converts | I-05 |
| `navigationRef.reset()` | `router.replace()` from `expo-router` | SDK-13 |
| `withSpring/withTiming` for step transitions | CSS Transitions on `Animated.View` style | C-02 |
| 6+ tabs in NativeTabs | Max 5 (Android Material constraint) | SDK-70 |
| `enableProguardInReleaseBuilds` | `enableMinifyInReleaseBuilds` | SDK-01 |
| `react-native-reanimated` twice in `package.json` | Listed once | SDK-11 |
| Duplicate branch in `normalizeNigeriaPhone` | Three clean non-overlapping conditions | I-06 |
| Direct push to master | feature branch → PR → CI → squash merge | CI-01 |
| Discard Remita RRR | Store in `tax_payments.remita_rrr` immediately | I-07 |
| Empty `compliance_events` | Call `logComplianceEvent` at required call sites | I-08 |
| E-invoicing framed as "mandatory Jan 2026 all SMEs" | Three-phase rollout; <₦1B not mandatory until Jul 2027 | TAX-01 |
| VAT exemption = exempt from charging | Exempt from FILING; must still charge 7.5% | TAX-02 |

---