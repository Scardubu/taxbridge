# TaxBridge Mobile App 📱

<div align="center">

**Production-ready, offline-first tax compliance platform for Nigerian SMEs**

[![Expo](https://img.shields.io/badge/Expo-54.0.31-blue)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-378%20passing-success)]()
[![Blueprint](https://img.shields.io/badge/Blueprint-v9-green)]()
[![Version](https://img.shields.io/badge/Version-1.4.1-blue)]()
[![Production](https://img.shields.io/badge/Status-Production%20Ready-success)]()

</div>

---

## 🎯 Overview

TaxBridge Mobile is a **production-ready React Native application** that brings tax compliance to Nigeria's 40+ million informal businesses. Built with an **offline-first architecture** and designed for **low-literacy, low-bandwidth environments**, the app makes NRS-compliant e-invoicing accessible to everyone.

### 📘 Blueprint v9 — Final Production Release

This codebase implements **TaxBridge V13 Mobile Blueprint v9**, the single authoritative patch superseding all prior versions (v1–v8). It enforces **14 absolute constraints** for architecture, dependencies, storage, UI, navigation, and compliance, and delivers two net-new systems on top of v8’s zero-blank-screen foundation:

**SYSTEM-A — Receipt Scanner**

- `expo-camera` capture → ML Kit OCR pipeline → expense classification (7 categories)
- VAT input credit extraction, SHA-256 duplicate detection
- SQLite persistence: `receipts`, `vat_credits`, `vat_returns` tables
- Offline queue op `RECEIPT_SUBMIT`; SSE `receipt_processed` → `markServerConfirmed`
- `ExpenseSummaryCard` on dashboard shows running spend + credit totals
- Receipt scanner replaces invoices as the primary tab

**SYSTEM-B — Tax Engine v2 (pure TypeScript)**

- VAT: 7.5% output, input credit netting, net payable, nil-return detection
- CIT: 3-tier (0% ≤₦25M • 20% ≤₦100M • 30% >₦100M) per NRS 2026
- WHT: 22 rate codes per FIRS schedule
- E-invoicing phase assignment (large/medium/small) + enforcement dates
- Compliance score v2: 6-factor weighted (max 100 pts)
- `useTaxEngine` memoised hook; `TaxCalculationSummary` on dashboard

**Tests: 31/31 suites • 378 passing • 0 failing • TypeScript: 0 errors**

#### Key Constraints Applied

- ✅ **Expo SDK 54** with expo-router v6 and **NativeTabs** (exactly 5 tabs)
- ✅ **Zustand `_hasHydrated`** sentinel — `waitForHydration()` via `store.subscribe()`, not polling
- ✅ **`previewMode` in Zustand store** — synchronous guard, no async KV read during render
- ✅ **Root layout gate** — DB init → storage migration → hydration → profile hydrate → splash hide
- ✅ **SecureStore-only** JWT storage (expo-secure-store)
- ✅ **SQLite** without GENERATED columns, with versioned migrations
- ✅ **Navigation** via `router.replace()` (no `navigationRef.reset`)
- ✅ **Animated API pulse only** for skeleton loaders; no `withSpring`/`withTiming` on step transitions
- ✅ **Compliance events** logged for `onboarding_complete`, `tin_verified`, `receipt_scanned`
- ✅ **NRS 2026** phased e-invoicing rules, CIT 0% relief, PIT zero band ₦800K
- ✅ **SSE** event streaming — `tin_verified`, `admin_alert`, `obligation_override`, `tin_manual_verify`, `payment_confirmed`
- ✅ **i18n** with English and Nigerian Pidgin (205+ keys)
- ✅ **SafeAreaView** from `react-native-safe-area-context` only
- ✅ **No reanimated plugins** in `babel.config.js`
- ✅ **Remita RRR** immediately persisted to `tax_payments` on API response
- ✅ **Exactly 5 NativeTabs** entries: dashboard, receipts, tax-calendar, compliance, settings

### ✨ Core Features

#### 🔌 Offline-First Architecture

- **Local-first storage**: Scan and save receipts without internet connection using SQLite
- **Intelligent sync**: Automatic background sync when connectivity is restored
- **Queue depth display**: `OfflineIndicator` shows pending count + "Sync now" CTA
- **Conflict resolution**: Smart merge strategies for concurrent edits
- **Queue management**: Resilient retry with dead-letter after 5 attempts
- **Network indicators**: Real-time connection status with visual feedback

#### 📊 Tax Compliance & Education

- **PIT Calculator**: Personal Income Tax calculator aligned with Nigeria Tax Act 2025
- **VAT/CIT Awareness**: Conditional education on thresholds and rates
- **FIRS Demo**: Mock e-invoicing simulation with educational disclaimers
- **Interactive Quizzes**: Knowledge validation with instant feedback
- **Progressive Disclosure**: Step-by-step tax education flow

#### 🌍 Inclusion-First Design

- **Multi-language Support**: Full English and Nigerian Pidgin translations (205+ keys)
- **Low-bandwidth optimized**: Works on 2G/3G networks
- **Accessible UI**: WCAG 2.1 Level AA compliant components
- **Number formatting**: Localized currency display with comma separators
- **Touch-optimized**: Large tap targets for low-precision input

#### 🎓 Enhanced Onboarding System

- **Profile Assessment**: Smart income/business type collection with emoji-enhanced UX
- **Number formatting**: Real-time comma-separated number formatting for better readability
- **Loading states**: Visual feedback during async operations
- **Skip functionality**: User-controlled onboarding with "Skip All" confirmation
- **Step indicators**: Clear progress tracking (e.g., "1 of 5")
- **PIT Tutorial**: Multi-step interactive calculator with:
  - Income presets (Market Trader, Small Business, Professional)
  - Visual tax band breakdown with color coding
  - Real-time calculation with deduction itemization
  - Knowledge quiz with contextual feedback
- **VAT/CIT Awareness**: Context-aware education based on user profile
- **FIRS Demo**: Animated e-invoicing flow with mock API simulation
- **Gamification**: Optional achievement system (7 badges)
- **Community Features**: Referral codes with reward tracking

#### 🎨 Production-Grade User Experience

- **Premium Animations**: Smooth transitions using React Native Reanimated 4.x
- **Web Compatibility**: Shadow styles optimized for web (boxShadow)
- **Form Validation**: Real-time validation with contextual error messages
- **Loading States**: Elegant overlays with branded animations
- **Number Formatting**: Auto-formatted currency inputs (e.g., "1,000,000")
- **Visual Polish**: Consistent 12-16px border radius, proper spacing scale
- **Responsive Design**: Adaptive layouts for phones and tablets
- **Accessibility**:
  - WCAG 2.1 Level AA compliant
  - Proper semantic roles (`accessibilityRole`, `accessibilityState`)
  - Screen reader optimized labels
  - Keyboard navigation support
- **Error Boundaries**: Graceful error recovery with Sentry integration
- **Performance Optimization**:
  - React.memo for expensive components
  - useCallback for stable function references
  - useMemo for computed values
  - Lazy loading for heavy components

#### 🔧 Technical Excellence

- **TypeScript**: Strict mode enabled, 100% type coverage
- **Modular Architecture**: Clean separation of concerns
  - Components: Reusable UI primitives
  - Contexts: Global state management
  - Services: Business logic layer
  - Utilities: Pure helper functions
- **Error Handling**:
  - Error boundaries at screen and app level
  - Sentry integration for crash reporting
  - User-friendly fallback UI
  - Automatic error recovery
- **Performance**:
  - React.memo for 6 onboarding components
  - useCallback/useMemo hooks throughout
  - Virtualized lists for receipt rendering
  - Debounced search inputs
  - Optimistic UI updates
- **Code Quality**:
  - ESLint + Prettier configured
  - Pre-commit hooks (Husky)
  - Automated testing (Jest)
  - **378 tests across 31 suites (100% passing)**
- **i18n Support**:
  - 205+ translation keys
  - English + Nigerian Pidgin
  - Context-aware pluralization
  - Number/currency formatting

---

## 📁 Project Structure

```
mobile/
├── app/                     # Expo Router file-system routes
│   ├── _layout.tsx          # Root gate: DB → migration → hydration → splash
│   ├── index.tsx            # Entry redirect
│   ├── (onboarding)/        # Onboarding route group
│   │   ├── _layout.tsx      # Onboarding guard (redirect if done)
│   │   ├── index.tsx        # Entry redirect to welcome
│   │   ├── welcome.tsx      # Welcome screen + language toggle
│   │   ├── business-type.tsx
│   │   ├── tin-verify.tsx
│   │   ├── vat-setup.tsx
│   │   ├── einvoice.tsx
│   │   ├── community.tsx
│   │   └── _shared.tsx      # Shared step components
│   └── (tabs)/              # Main tab group (5 NativeTabs)
│       ├── _layout.tsx      # Tab guard (sync previewMode read — RC-B fix)
│       ├── index.tsx        # Dashboard (MODE A preview / MODE B full)
│       ├── receipts.tsx
│       ├── tax-calendar.tsx
│       ├── compliance.tsx
│       └── settings.tsx
├── components/              # Shared UI components
│   ├── design-system/
│   │   └── tokens.ts        # Single source of truth for all design tokens
│   ├── TaxShieldRing.tsx    # SVG compliance score arc
│   ├── SkeletonDashboard.tsx # Animated pulse skeleton
│   ├── OfflineIndicator.tsx # Queue depth display + sync CTA
│   ├── OnboardingProgressBanner.tsx # MODE A continue banner
│   ├── EducativeTaxObligationsSection.tsx # Accordion obligations
│   ├── ComplianceBadge.tsx
│   ├── OnboardingProgressBar.tsx
│   └── StepContainer.tsx
├── services/                # Business logic and API
│   ├── api.ts               # Typed HTTP client (6 methods + ApiError)
│   ├── sseService.ts        # SSE — 10 event types + auto-reconnect
│   ├── database.ts          # SQLite WAL mode, versioned migrations
│   ├── offlineQueue.ts      # SQLite-backed retry queue
│   ├── nrsCompliance.ts     # NRS 2026 obligations engine
│   ├── nudgeEngine.ts       # Priority-sorted nudge generation
│   ├── taxCalendar.ts       # WAT-aware deadline generation
│   ├── otpService.ts        # 3-branch NG phone normalisation
│   ├── paymentService.ts    # Remita payment + RRR persistence
│   ├── tokenService.ts      # SecureStore-only JWT management
│   └── complianceEventService.ts
├── stores/
│   ├── onboardingStore.ts   # Zustand + _hasHydrated + previewMode
│   └── businessProfileStore.ts
├── storage/
│   └── kv.ts                # Namespaced KV — flags, prefs
├── i18n/
│   ├── en.json              # English (205+ keys)
│   ├── pidgin.json          # Nigerian Pidgin (205+ keys)
│   └── index.ts
├── __tests__/               # Test suites
├── __mocks__/               # Jest mocks
├── app.json                 # Expo config — v1.3.0, ng.taxbridge.app
├── eas.json                 # EAS Build profiles
├── babel.config.js
├── jest.config.js
├── jest.setup.js
├── package.json
└── tsconfig.json            # TypeScript strict mode
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >=20.19.4
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android development)
- Xcode (for iOS development - macOS only)

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/Scardubu/taxbridge.git
   cd taxbridge/mobile
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start the development server**:

   ```bash
   npm start
   ```

   > **Note**: If you experience `fetch failed` or network-related failures on restricted networks, use:
>
   > ```bash
   > npm run start:no-doctor
   > ```
>
   > This sets `EXPO_NO_DOCTOR=1` to skip the dependency health check.

1. **Run on device/simulator**:

   ```bash
   # Android emulator
   npm run android

   # iOS simulator (macOS only)
   npm run ios

   # Web browser
   npm run web
   ```

---

## 🔌 Backend Integration

### API Configuration

The mobile app connects to the backend API. Default configuration:

| Environment | URL | Notes |
|-------------|-----|-------|
| Android Emulator | `http://10.0.2.2:3000` | Maps to host localhost |
| iOS Simulator | `http://localhost:3000` | Direct localhost access |
| Physical Device | `http://<your-ip>:3000` | Use network IP |
| Production | `https://api.taxbridge.ng` | Production server |

### Changing API URL

**Option 1: Settings Screen**

1. Open the app → Settings
2. Tap "API Server URL"
3. Enter your backend URL
4. Save changes

**Option 2: Programmatic**

```typescript
import { setApiBaseUrl } from './src/services/api';

// Set custom API URL
await setApiBaseUrl('http://192.168.1.100:3000');
```

### API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/invoices` | Create new invoice |
| `GET` | `/api/v1/invoices` | List invoices |
| `GET` | `/api/v1/invoices/:id` | Get invoice details |

### Request/Response Format

**Create Invoice**:

```typescript
// Request
POST /api/v1/invoices
{
  "customerName": "Aunty Ngozi",
  "items": [
    {
      "description": "Product A",
      "quantity": 2,
      "unitPrice": 500.00
    }
  ]
}

// Response
{
  "invoiceId": "uuid-string",
  "status": "queued"
}
```

---

## 📶 Offline Sync Flow

### How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Creates  │     │   Local SQLite  │     │   Backend API   │
│     Invoice     │────►│    Database     │────►│    (Online)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌───────────┐
                        │  Pending  │◄── Network Offline
                        │   Queue   │
                        └─────┬─────┘
                              │
                              ▼ Network Online
                        ┌───────────┐
                        │   Auto    │
                        │   Sync    │
                        └───────────┘
```

### Sync Logic

1. **Invoice Creation** → Saved to SQLite with `synced: 0`
2. **Network Check** → Background monitoring via NetInfo
3. **Auto Sync** → When online, sync pending invoices
4. **Retry Logic** → Exponential backoff (max 5 attempts)
5. **Status Update** → Local record updated on success

### Sync Service (sync.ts)

```typescript
// Automatically syncs pending invoices
export async function syncPendingInvoices() {
  const pending = await getPendingInvoices();

  for (const invoice of pending) {
    try {
      await updateInvoiceStatus(invoice.id, 'processing');
      const result = await createInvoice(invoice);
      await markInvoiceSynced(invoice.id, result.invoiceId);
    } catch (error) {
      // Retry with exponential backoff
      await setInvoiceRetryMetadata(invoice.id, attempt, nextRetry);
    }
  }
}
```

---

## 🌍 Internationalization

### Supported Languages

| Code | Language | File | Keys |
|------|----------|------|------|
| `en` | English | `src/i18n/en.json` | 205+ |
| `pidgin` | Nigerian Pidgin | `src/i18n/pidgin.json` | 205+ |

### Translation Coverage

**Modules**:

- Home screen (6 keys)
- Invoice creation (6 keys)
- Invoice list (3 keys)
- Settings (6 keys)
- Network status (9 keys)
- Onboarding (150+ keys across 6 steps)

**Key Highlights**:

- Profile Assessment: Income sources, business types, hints
- PIT Tutorial: Calculator labels, quiz questions, feedback
- VAT/CIT: Thresholds, rates, flowcharts
- FIRS Demo: API endpoints, benefits, penalties
- Gamification: Achievements, streaks, preferences
- Community: Referral codes, resources, social features

### Usage

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();

  return (
    <View>
      <Text>{t('home.title')}</Text>
      <Button onPress={() => i18n.changeLanguage('pidgin')}>
        {t('settings.language')}
      </Button>
    </View>
  );
}
```

### Adding Translations

1. Add key to `src/i18n/en.json`:

   ```json
   {
     "newFeature": {
       "title": "New Feature",
       "description": "This is a new feature"
     }
   }
   ```

2. Add Pidgin translation to `src/i18n/pidgin.json`:

   ```json
   {
     "newFeature": {
       "title": "New Feature",
       "description": "Dis na new feature"
     }
   }
   ```

---

## 🧪 Testing

TaxBridge mobile has **167 tests** across 8 test suites, all passing.

### Test Summary

| Test Suite | Tests | Description |
|------------|-------|-------------|
| `taxEngine.test.ts` | 32 | PIT/VAT/CIT/PAYE/CGT/anomaly |
| `onboardingStore.test.ts` | 19 | Step config & migration |
| `nrsCompliance.test.ts` | 22 | Obligations engine |
| `otpService.test.ts` | 15 | Phone normalisation |
| `offlineQueue.test.ts` | 17 | Retry, dedup, payloads |
| `payment.e2e.test.tsx` | 16 | Payment E2E flow |
| `e2e.test.tsx` | 19 | Core E2E integration |
| Legacy suites | 27 | OnboardingSystem, invoices, sync |
| **Total** | **167** | ✅ All Passing |

### Run Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Run specific test file
npm test -- OnboardingSystem.integration.test.tsx
```

### Test Highlights

**Onboarding System (29 tests):**

- ✅ Full 6-step flow with conditional gating
- ✅ AsyncStorage persistence verification
- ✅ Tax calculations (Nigeria Tax Act 2025)
- ✅ Mock FIRS API safety checks

**Tax Calculator (50+ tests):**

- ✅ PIT 6-band progressive system
- ✅ VAT threshold (₦100M)
- ✅ CIT rates (0%/20%/30%)
- ✅ Relief calculations (rent, NHF, pension)

### Test Structure

```
mobile/
├── __tests__/
│   ├── OnboardingSystem.integration.test.tsx
│   ├── taxCalculator.test.ts
│   ├── mockFIRS.test.ts
│   ├── payment.e2e.test.tsx
│   └── e2e.test.tsx
├── src/__tests__/
│   ├── CreateInvoiceScreen.test.tsx
│   └── SyncContext.test.tsx
├── __mocks__/
│   ├── styleMock.js
│   ├── expo-file-system.js
│   └── expo-image-picker.js
├── jest.config.js           # Jest 29.7.0 (stable LTS)
└── jest.setup.js            # Comprehensive mocking (~320 lines)
```

### Jest Configuration for npm Workspaces

This project uses Jest 29.7.0 with npm workspaces monorepo structure:

```javascript
// jest.config.js - Key settings
const rootNodeModules = path.resolve(__dirname, '../node_modules');

module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  globals: { __DEV__: true },
  moduleDirectories: ['node_modules', rootNodeModules],
  // ... see jest.config.js for full configuration
};
```

### Mocking Strategy

Comprehensive mocks for React Native and Expo:

- **React Native Core**: View, Text, TextInput, TouchableOpacity, Alert
- **Navigation**: @react-navigation/native, bottom-tabs
- **Expo Modules**: expo-sqlite, expo-constants, expo-file-system
- **Network**: @react-native-community/netinfo
- **Storage**: @react-native-async-storage/async-storage
- **Sentry**: Breadcrumb logging

See [UNIT_TESTS_COMPLETE.md](UNIT_TESTS_COMPLETE.md) and [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md) for details.

### Test Categories

1. **Unit Tests**: Component rendering, form validation
2. **Integration Tests**: API mocking, context interactions
3. **E2E Tests**: Complete user flows (invoice creation, payment)

---

## 📱 Building for Production

### Android (APK/AAB)

```bash
# Build APK for testing
npx expo build:android -t apk

# Build AAB for Play Store
npx expo build:android -t app-bundle

# Using EAS Build (recommended)
npx eas build --platform android
```

### iOS

```bash
# Build for App Store
npx expo build:ios

# Using EAS Build (recommended)
npx eas build --platform ios
```

### Environment Configuration

Create `app.config.js` for environment-specific settings:

```javascript
export default {
  name: 'TaxBridge',
  slug: 'taxbridge',
  extra: {
    apiUrl: process.env.API_URL || 'https://api.taxbridge.ng',
    environment: process.env.NODE_ENV || 'production',
  },
};
```

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `fetch failed` on start | Use `npm run start:no-doctor` |
| Metro bundler crash | Clear cache: `npx expo start -c` |
| Android emulator not connecting | Use `http://10.0.2.2:3000` for API URL |
| iOS build failing | Ensure Xcode CLI tools installed |
| SQLite errors on web | Web uses AsyncStorage fallback |

### Debug Mode

```bash
# Enable React Native Debugger
npm start -- --dev-client

# View console logs
npx react-native log-android  # Android
npx react-native log-ios      # iOS
```

---

## 🎯 Production Readiness

### ✅ Completed Features

- [x] **All 139 tests passing** (100% success rate)
- [x] **Offline-first architecture** with SQLite persistence
- [x] **Multi-language support** (English + Nigerian Pidgin, 205+ keys)
- [x] **Enhanced onboarding** with skip functionality and progress tracking
- [x] **Tax calculators** (PIT, VAT, CIT) aligned with Nigeria Tax Act 2025
- [x] **Network status indicators** with real-time sync notifications
- [x] **Error boundaries** at app and screen levels with Sentry integration
- [x] **Loading states** for all async operations
- [x] **Accessibility compliance** (WCAG 2.1 Level AA)
- [x] **Number formatting** with locale-aware comma separators
- [x] **Web compatibility** (shadow styles, responsive layout)
- [x] **Performance optimization** (React.memo, useCallback, useMemo)
- [x] **Visual consistency** across all screens with design system
- [x] **Production-ready HomeScreen** with stats, actions, and tips

### 🚀 Recent Improvements (January 2026)

**UX Enhancements:**

- Enhanced ProfileAssessmentStep with emoji icons and formatted number inputs
- Added "Skip All" onboarding with confirmation dialog
- Improved HomeScreen with stats cards, quick actions, and compliance tips
- Enhanced NetworkStatus with animated sync indicators
- Better OfflineBadge with clearer messaging

**Performance:**

- Added React.memo to 6 onboarding components
- Implemented useCallback for event handlers
- Optimized re-renders with useMemo for computed values
- Number formatting with real-time updates

**Visual Polish:**

- Fixed deprecated shadow styles (migrated to boxShadow)
- Consistent border radius (12-16px)
- Improved color contrast ratios
- Added visual loading states
- Enhanced button states (pressed, disabled, loading)

**i18n:**

- Added 15+ missing translation keys
- Full coverage for network status
- Onboarding step indicators
- Profile hints and descriptions

### 📊 Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Test Coverage | 383/383 tests | ✅ 100% passing |
| TypeScript Errors | 0 | ✅ No errors |
| Translation Keys | 1567 | ✅ Full EN + Pidgin parity |
| Build Warnings | 0 | ✅ Clean |
| Accessibility | WCAG 2.1 AA | ✅ Compliant |
| Blueprint v8 Constraints | 14/14 | ✅ All satisfied |
| Navigation Races (RC-C, RC-H) | 0 | ✅ Eliminated |
| App Version | 1.4.1 (versionCode 15) | ✅ Production |

---

## 🔄 Changelog

### Version 1.4.1 (April 8, 2026) — Blueprint v9 Production Hardening

**Boot / hydration race (RC-C + RC-H) eliminated:**

- `setPreviewMode()` changed from fire-and-forget `void` to `async Promise<void>` — KV write now `await`ed before navigation
- Both onboarding CTAs (`handleExploreFirst`, `handleGetStarted`) `await setPreviewMode(...)` before `router.replace/push`
- `waitForHydration()` 4 s timeout fallback now emits a Sentry `'warning'` — race is observable in telemetry if it ever fires

**Receipt sync contract hardened:**

- `saveReceipt()` validates `vendorName.trim()` and `amountNgn > 0` — throws typed errors instead of silently no-oping
- `RECEIPT_SUBMIT` offline queue payload now includes `idempotency_key: id` — server-side deduplication on retry
- `getDeadLetterCount()` method added to `OfflineQueue` for dead-letter observability

**Tax Engine v2 (Blueprint v9 §CIT-decision):**

- `citEstimatedNgn` documented: zero when `annualProfit` is absent (intentional — estimation requires explicit input)
- New test: `'citEstimatedNgn is zero when annualProfit is absent'` (T41)

**UI lockdown — `ReceiptReviewForm`:**

- Inline i18n validation errors for vendor name and amount — previously silently returned void
- `accessibilityRole="alert"` on error messages for screen reader compatibility
- Removed invalid `accessibilityInvalid` prop (web-only ARIA, not a valid `TextInputProps` field)
- Error state clears on user input

**CI / build pipeline:**

- GitHub Actions workflow updated: triggers on `master` (previously `main` only), EAS build job added as post-CI step
- Workflow uses `expo/expo-github-action@v8` with `EXPO_TOKEN` secret — CI has full internet access
- `npm run test` passes `--forceExit` flag to prevent worker hang on teardown
- `codecov/codecov-action` upgraded v3 → v4, `fail_ci_if_error: false` to avoid blocking on Codecov service outages

**i18n:**

- Added `receipts.vendorRequired` and `receipts.amountRequired` keys — EN + Pidgin parity maintained (1567 keys each)

**app.json:** v1.4.1, versionCode 15, buildNumber 5

### Version 1.3.0 (2026) — Blueprint v8 FINAL

**Navigation — RC-B + RC-C compound race conditions eliminated:**

- `waitForHydration()` uses `store.subscribe()` (not polling), 4 s safety timeout
- `previewMode` stored in Zustand (synchronous reads) — KV only used for cold-start restore
- `setPreviewMode(true)` called before `router.replace('/(tabs)')` — guard sees state immediately

**New Components:**

- `TaxShieldRing` — SVG arc score ring, score-driven colour, no Reanimated
- `SkeletonDashboard` — Animated pulse, shared opacity value, `useNativeDriver`
- `OfflineIndicator` — queue depth display, 5 s poll, "Sync now" CTA
- `OnboardingProgressBanner` — MODE A dismissable banner with haptics
- `EducativeTaxObligationsSection` — accordion with FIRS portal deep-links

**Design System:**

- `components/design-system/tokens.ts` — `Colors`, `Spacing`, `Radii`, `Typography` + backward-compat aliases

**Dashboard — MODE A / MODE B:**

- Preview profile with realistic sample data for first-run UX
- SSE wiring — 10 event types: `tin_verified`, `admin_alert`, `obligation_override`, `payment_confirmed`, etc.
- Score-driven `TaxShieldRing` + nudge-driven action cards

**Backend API Contract:**

- `patchBusinessProfile`, `postComplianceEvent`, `postInvoice`, `initiatePayment`, `verifyTin`, `getAlerts`
- 401 silent refresh → single retry; 409 conflict resolves with server version + Sentry capture

**i18n (+60 new keys):**

- Flat obligation keys: `obligations.vatReg`, `obligations.eInvoice`, `obligations.cit`, etc.
- Offline indicator: `offline.syncing`, `offline.queued`, `offline.syncNow`, `offline.syncingNow`
- Dashboard banner: `dashboard.bannerBody`, `dashboard.bannerCta`
- Full EN + Pidgin parity maintained

**Build:**

- `app.json` version `1.3.0`, versionCode `13`
- `eas.json` production android: explicit `gradleCommand: ":app:bundleRelease"`

---

### Version 6.0.0 (March 2026) — Blueprint v6

**Architecture (14 absolute constraints satisfied):**

- SDK 54 + expo-router v6 + Reanimated 4.x (no worklets/reanimated babel plugins)
- SecureStore-only JWT storage (`services/tokenService.ts`)
- `expo-sqlite/kv-store` for Zustand async persistence (`storage/kv.ts`)
- SQLite WAL mode, no `GENERATED` columns (`services/database.ts`)
- Declarative `<Redirect>` guards in all layouts (no imperative `router.replace`)
- Exactly five NativeTabs: index, invoices, tax-calendar, compliance, settings
- CSS transitions for onboarding `StepContainer` UI
- Immediate Remita RRR persistence in `tax_payments` on receipt
- Mandatory compliance event logging: `onboarding_complete`, `tin_verified`, `invoice_submitted`
- SSE: all 7 required event types + auto-reconnect after error
- `X-TaxBridge-Version: 13` + `X-Device-ID` on every API request
- Three-branch Nigerian phone normalisation (otpService)
- NRS 2026 e-invoicing phase schedule (Apr/Jul 2026, Jul 2027)

**New / Updated Services:**

- `generateTaxCalendar(profile, year)` — Africa/Lagos (WAT) deadline generation
- `generateNudges(profile, obligations)` — priority-sorted (critical > warning > opportunity)
- `speakStepHint(stepId)` — Pidgin voice hints for all six onboarding steps
- Expanded `computeObligations` — `eInvoicingRequired`, `eInvoicingStatus`, `citRate` fields

**Tests (+31 new):**

- `onboardingStore.test.ts` — step config, migration, ordering invariants
- `nrsCompliance.test.ts` — CIT/VAT/e-invoice obligations, compliance score
- `otpService.test.ts` — three-branch phone normalisation coverage
- `offlineQueue.test.ts` — retry/dead-letter, dedup, compliance event payloads

**i18n:**

- `pidgin.json` now at full EN key parity (230+ keys): tax, einvoice, nrs, nudge, obligations, quickAction, common.error/retry

---

### Version 5.0.0 (January 2026) - Production Launch

**Major Features:**

- Complete onboarding system with 6 interactive steps
- Skip All onboarding functionality
- Enhanced HomeScreen with stats and quick actions
- Network status with sync indicators
- Multi-language support (205+ keys)

**Improvements:**

- ProfileAssessmentStep with emoji-enhanced UI
- Number formatting (comma-separated)
- Loading states for all async operations
- Visual polish across all screens
- Web compatibility improvements

**Performance:**

- React.memo for 6 components
- useCallback/useMemo optimizations
- Optimized re-renders
- Improved list rendering

**Bug Fixes:**

- Fixed shadow style deprecation warnings
- Fixed missing translation keys
- Fixed number input formatting
- Fixed network status display

**Testing:**

- 139 tests (100% passing)
- Integration test suite
- E2E test coverage
- Tax calculator validation

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Run tests**: `npm test`
5. **Commit with conventional commits**: `git commit -m "feat: add amazing feature"`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Add JSDoc comments for complex functions
- Write tests for new features
- Update documentation

---

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.

---

## 📞 Support

- **Documentation**: [docs/PRD.md](../docs/PRD.md)
- **Issues**: [GitHub Issues](https://github.com/Scardubu/taxbridge/issues)
- **Email**: <support@taxbridge.ng>

---

## 🙏 Acknowledgments

Built with ❤️ for Nigerian SMEs and informal traders.

**Technologies:**

- React Native & Expo Team
- SQLite Foundation
- React Navigation Team
- i18next Community

**Compliance:**

- Nigeria Tax Act 2025
- NITDA (National Information Technology Development Agency)
- NDPC (Nigeria Data Protection Commission)

---

<div align="center">

**TaxBridge Mobile** | Making tax compliance accessible to everyone

[Documentation](../docs/PRD.md) · [Report Bug](https://github.com/Scardubu/taxbridge/issues) · [Request Feature](https://github.com/Scardubu/taxbridge/issues)

</div>

---

## 📞 Support

For technical support:

- **Documentation**: Check main [README](../README.md)
- **Issues**: Open a GitHub issue
- **Email**: <support@taxbridge.ng>

---

<div align="center">

**Built with ❤️ for Nigerian SMEs**

</div>
