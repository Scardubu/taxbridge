# TaxBridge

<div align="center">

![TaxBridge Logo](mobile/assets/logo 2000x500.png)

**Mobile-first, NRS-compliant e-invoicing platform for Nigerian SMEs**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://expo.dev/accounts/scardubu/projects/taxbridge)
[![Version](https://img.shields.io/badge/version-5.0.6-blue)](/)
[![Tests](https://img.shields.io/badge/tests-217%20passing-success)](/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Production](https://img.shields.io/badge/status-deploying-yellow)](https://taxbridge-api.onrender.com/health/live)

[Documentation](docs/PRD.md) • [Quick Start](#-quick-start) • [API Reference](#-api-endpoints) • [Integration Checklist](docs/INTEGRATION_CHECKLIST.md) • [Execution Reports](docs/execution/README.md) • [Production Guide](PRODUCTION_FINALIZATION_SUMMARY.md)

</div>

---

## 🚀 Latest Release: v5.0.6 (January 31, 2026)

### Production Status
- **Status:** ⏳ **DEPLOYING** (Deployment fixes applied)
- **Phase 1-9 Complete:** ✅ **100% INTEGRATION + BUILD HARDENING**
- **Deployment Hotfix:** ✅ **COMPLETE** (Render & Vercel build errors resolved)
- **Phase C UI Lockdown:** ✅ 100% Complete (300+ i18n keys, 0 hardcoded strings)
- **Phase 9 Build Verification:** ✅ **COMPLETE** (64→0 TypeScript errors, lockfile consolidated)
- **Device Sync:** ✅ **FULLY INTEGRATED** (mobile client + backend)
- **UI Sign-Off:** ✅ Approved (all gates passed)
- **F4 Load Testing:** ✅ Passed (99.2% success rate)
- **Android Build:** [Download v5.0.6 builds](https://expo.dev/accounts/scardubu/projects/taxbridge/builds)
- **Admin Dashboard:** ⏳ Deploying to Vercel (commit `c932645`)

### What's New in v5.0.6 (Deployment Hotfix)

#### Critical Deployment Fixes
- ✅ **Render Build Error Resolved:** Missing `@taxbridge/contracts` module
  - Added contracts build to `render.yaml` buildCommand
  - Build order: contracts → backend → admin-dashboard
  - Backend compilation now passes (21.7s)

- ✅ **Vercel Build Error Resolved:** Mobile workspace missing build script
  - Added noop build script to `mobile/package.json`
  - Updated root build script to explicitly list workspaces
  - Mobile builds remain independent via EAS

- ✅ **Build Chain Optimized:**
  - Contracts package generates TypeScript types (4.6s)
  - Backend uses contracts for sync schema validation (31s)
  - Admin dashboard builds cleanly (166s, 24 routes)
  - Total build time: ~3.4 minutes

**Documentation:** [DEPLOYMENT_FIXES_V5.0.6.md](DEPLOYMENT_FIXES_V5.0.6.md)

#### Core Features (Previous Releases)
- ✅ **Mobile TypeScript Resolution (64→0 errors):** Complete theme system implementation
  - Implemented `theme/index.ts` with full token exports
  - Extended `tokens.ts`: 15+ color aliases, typography styles
  - Built Card and Badge components from scratch
  - Fixed 12 critical files for strict TypeScript compliance

- ✅ **Lockfile Consolidation:** Unified workspace dependency management
  - Added admin-dashboard to root workspaces
  - Removed duplicate npm/yarn lockfiles
  - Eliminated Next.js workspace root warning
  - Optimized for Vercel deployment

- ✅ **Build Verification Complete:**
  - Mobile: `tsc --noEmit` passes (0 errors)
  - Admin: Next.js 16.1.1 build succeeds (24 routes, 0 warnings, 86s)
  - Backend: Health endpoints verified
  - 217 tests passing (100% success rate)

- ✅ **Deployment Contracts Verified:**
  - Render: Backend health endpoints aligned
  - Vercel: Admin dashboard env vars configured
  - Expo: Mobile API URL production-ready
  - Offline-first architecture confirmed (NetworkContext, SyncContext, DeviceContext)

#### Core Features (Previous Releases)

- ✅ **Complete DashboardScreen Implementation:** 520-line production dashboard with:
  - Real-time business metrics and KPIs
  - Tax insights card with PIT calculator integration
  - Compliance status monitoring (NRS/NDPR)
  - Quick action grid for rapid navigation
  - Pull-to-refresh with haptic feedback
  - Full accessibility support (WCAG 2.1 AA)

- ✅ **AR Receipt Scanner:** AI-powered OCR with offline processing
  - Real-time receipt detection with AR overlay
  - Auto-capture with alignment guides
  - Merchant, date, items, totals extraction
  - Automatic VAT calculation (7.5%)
  - Confidence scoring and validation

- ✅ **Intelligent Tax Engine:** Nigeria Tax Act 2025 compliant
  - PIT calculator with 6 progressive brackets (7%-24%)
  - VAT calculation (7.5% standard rate)
  - CIT calculator (20% small company, 30% standard)
  - Tax optimization recommendations
  - Consolidated Relief Allowance (CRA) calculation

- ✅ **TaxBreakdown Component:** Interactive tax visualization
  - Per-bracket breakdown display
  - Effective rate calculation
  - Take-home pay projection
  - Savings recommendations
  - Animated transitions

#### Infrastructure & Quality
- ✅ **Mobile Device Sync Client:** Complete 310-line service with heartbeat, push, pull, and conflict resolution
- ✅ **Composite Cursor Pagination:** Eliminates data loss risk with `timestamp:id` format
- ✅ **Heartbeat Ownership Verification:** NDPC-compliant device security
- ✅ **SyncContext Integration:** Feature-flag controlled with graceful legacy fallback
- ✅ **i18n Expansion:** 300+ translation keys (English + Nigerian Pidgin)
- ✅ **Type Safety:** Replaced all `any` types in critical components
- ✅ **Logger Utility:** Production-ready structured logging
- ✅ **217+ tests passing** (139 mobile + 70 backend + 8 admin)
- ✅ **Zero TypeScript errors** across all layers (Phase 9 hardening)
- ✅ **WCAG 2.1 AA accessibility** compliance verified
- ✅ **iOS Build Validated:** 1423 modules bundled successfully in 45.74s
- ✅ **Workspace Unified:** Single root yarn.lock, Next.js 16.1.1 build clean

### Previous Releases

#### v5.0.4 (January 30, 2026)
- ✅ **Complete DashboardScreen Implementation:** 520-line production dashboard
- ✅ **AR Receipt Scanner:** AI-powered OCR with offline processing
- ✅ **Intelligent Tax Engine:** Nigeria Tax Act 2025 compliant
- ✅ **TaxBreakdown Component:** Interactive tax visualization
- ✅ **Mobile Device Sync Client:** Complete 310-line service

#### v5.0.3 (January 29, 2026)
- ✅ **Mobile i18n hardening:** Removed remaining hardcoded strings
- ✅ **Added production APK profile:** `production-apk` for direct distribution
- ✅ **Phase C Complete:** 100% i18n coverage (English + Nigerian Pidgin)
- ✅ **UI Sign-Off:** Comprehensive approval with [600+ line checklist](UI_SIGN_OFF_CHECKLIST.md)
- ✅ **Admin Dashboard Audit:** [Zero placeholders](ADMIN_DASHBOARD_UI_AUDIT.md), production-ready

### Deployment Documentation
- 📋 [PHASE_9_BUILD_HARDENING_COMPLETE.md](PHASE_9_BUILD_HARDENING_COMPLETE.md) — Build verification & lockfile consolidation
- 📋 [PRODUCTION_DEPLOYMENT_READY.md](PRODUCTION_DEPLOYMENT_READY.md) — Quick reference
- 📋 [F6_DEPLOYMENT_EXECUTION_LOG.md](F6_DEPLOYMENT_EXECUTION_LOG.md) — Step-by-step guide
- 📋 [UI_SIGN_OFF_CHECKLIST.md](UI_SIGN_OFF_CHECKLIST.md) — UI/UX approval
- 📋 [ADMIN_DASHBOARD_UI_AUDIT.md](ADMIN_DASHBOARD_UI_AUDIT.md) — Admin audit
- 📋 [PHASE_C_AND_F6_PRE_DEPLOYMENT_COMPLETE.md](PHASE_C_AND_F6_PRE_DEPLOYMENT_COMPLETE.md) — Final report

---

## 📋 Overview

TaxBridge is a **mobile-first, offline-capable tax compliance platform** designed for Nigerian SMEs, micro-entrepreneurs, and informal traders. It addresses the **mandatory e-invoicing requirements** under Nigeria's 2025 Tax Act by providing:

- ✅ **NRS-compliant e-invoicing** via NITDA-accredited Access Point Providers (APPs)
- ✅ **Offline-first architecture** - create invoices without internet
- ✅ **Multi-language support** - English and Nigerian Pidgin
- ✅ **UBL 3.0/Peppol BIS Billing 3.0** format compliance
- ✅ **Remita integration** for seamless tax payments
- ✅ **AI-powered OCR** for receipt digitization

### Key Innovation

> Combines regulatory compliance with radical inclusion—offline-first architecture, USSD/SMS fallbacks, on-device OCR for receipt capture, and AI-powered tax guidance in local languages—making tax compliance accessible to Nigeria's 40+ million informal businesses.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TaxBridge Platform                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐   │
│   │   Mobile    │    │   Admin     │    │       Backend API           │   │
│   │    App      │◄──►│  Dashboard  │◄──►│    (Node.js/Fastify)        │   │
│   │ (Expo/RN)   │    │  (Next.js)  │    │                             │   │
│   └─────────────┘    └─────────────┘    └──────────────┬──────────────┘   │
│         │                                              │                   │
│         │ Offline Storage                              │                   │
│         ▼                                              ▼                   │
│   ┌───────────┐                         ┌──────────────────────────────┐   │
│   │  SQLite   │                         │         PostgreSQL           │   │
│   │  (Local)  │                         │          (Prisma)            │   │
│   └───────────┘                         └──────────────────────────────┘   │
│                                                        │                   │
│                                                        ▼                   │
│                                         ┌──────────────────────────────┐   │
│                                         │      Redis + BullMQ          │   │
│                                         │    (Queues & Caching)        │   │
│                                         └──────────────────────────────┘   │
│                                                        │                   │
│                                                        ▼                   │
│                                         ┌──────────────────────────────┐   │
│                                         │    External Integrations     │   │
│                                         │  • DigiTax (NRS e-Invoice)   │   │
│                                         │  • Remita (Payments)         │   │
│                                         │  • SMS Providers (AT/Termii) │   │
│                                         └──────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Mobile App** | React Native (Expo) + TypeScript | 0.81.5 / 54.0 / 5.9 |
| **Admin Dashboard** | Next.js + React + TypeScript | 16.1.1 / 19.2 / 5.x |
| **Backend API** | Node.js + Fastify + TypeScript | 5.6.2 / 5.9 |
| **Database** | PostgreSQL + Prisma ORM | 15.x / 5.22 |
| **Queue System** | Redis + BullMQ | 7.x / 5.66 |
| **OCR Engine** | Tesseract.js | 4.1.1 |
| **Validation** | Zod | 4.3.5 |
| **Testing (Mobile)** | Jest + jest-expo + @testing-library/react-native | 30.x / 54.x / 13.x |
| **Testing (Backend)** | Jest + Supertest | 29.7 / 7.x |
| **Testing (Admin)** | Jest + @testing-library/react | 29.7 / 16.x |
| **UI Components** | Tailwind CSS + shadcn/ui | 3.x |

---

## 📁 Project Structure

```
taxbridge/
├── mobile/                 # React Native (Expo) mobile app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── screens/        # App screens (Home, Invoices, Settings)
│   │   ├── services/       # API, database, sync services
│   │   ├── contexts/       # React contexts (Network, Loading)
│   │   ├── i18n/           # Internationalization (en, pidgin)
│   │   └── types/          # TypeScript definitions
│   └── App.tsx             # Entry point
│
├── backend/                # Node.js + Fastify API server
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── integrations/   # DigiTax, Remita, SMS providers
│   │   ├── queue/          # BullMQ workers
│   │   ├── lib/            # Utilities (logger, config, errors)
│   │   └── server.ts       # Server entry point
│   ├── prisma/             # Database schema & migrations
│   └── docs/               # API documentation
│
├── admin-dashboard/        # Next.js admin panel
│   ├── app/                # App Router pages
│   │   ├── dashboard/      # Dashboard views
│   │   └── api/            # API routes
│   ├── components/         # UI components
│   └── lib/                # Utility functions
│
├── ml/                     # Machine learning services
├── infra/                  # Docker & infrastructure configs
└── docs/                   # Product documentation
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x (LTS recommended; matches Render blueprints)
- **Yarn Classic** 1.22.x (workspace package manager)
- **Docker Desktop** (for PostgreSQL & Redis)
- **Expo CLI** (`npm install -g expo-cli`)
- **Git**

### 1. Clone & Install

```bash
git clone https://github.com/Scardubu/taxbridge.git
cd taxbridge

# Install monorepo dependencies
yarn install --frozen-lockfile
```

### 2. Start Infrastructure

```bash
cd infra
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6380`

### 3. Setup Backend

```bash
cd backend

# (Optional) If you already ran yarn install at repo root, you can skip installing here.

# Create environment file
cp .env.example .env

# Configure database URL in .env:
# DATABASE_URL="postgresql://taxbridge:dev_password@localhost:5432/taxbridge_dev"
# REDIS_URL="redis://localhost:6380"

# Initialize database (Prisma generation is also executed by the backend build used in CI/Render)
yarn prisma:generate
yarn prisma:push

# Start development server
yarn dev
```

Backend runs on `http://localhost:3000`

### 4. Start Mobile App

```bash
cd mobile
yarn start
```

Press `a` for Android emulator or `i` for iOS simulator.

### 5. Start Admin Dashboard

```bash
cd admin-dashboard
npm install
npm run dev
```

Dashboard runs on `http://localhost:3001`

---

## 📱 Mobile App Features (Production Ready - v5.0.4)

### ✅ Core Functionality
- **Offline-First**: Create invoices without internet connection with SQLite persistence
- **Intelligent Auto-Sync**: Background sync with exponential backoff and retry logic
- **Multi-Device Sync**: Full device sync with heartbeat, push, pull, and conflict resolution (v5.0.4)
- **SQLite Storage**: Local database with 139 tests covering all operations
- **Multi-language**: Full English and Nigerian Pidgin support (267+ translation keys)
- **Enhanced Onboarding**: 6-step interactive tax education with skip functionality
- **Tax Calculators**: PIT, VAT, CIT calculators aligned with Nigeria Tax Act 2025
- **Network Status**: Real-time sync indicators with visual feedback
- **Error Recovery**: Error boundaries with Sentry integration

### 🎨 User Experience
- **Premium Animations**: React Native Reanimated 4.x with smooth transitions
- **Visual Polish**: Consistent design system (12-16px border radius, proper spacing)
- **Number Formatting**: Locale-aware comma separators (e.g., "1,000,000")
- **Loading States**: Elegant overlays for all async operations
- **Accessibility**: WCAG 2.1 Level AA compliant
- **Web Compatible**: Optimized shadow styles and responsive layouts
- **Performance**: React.memo, useCallback, useMemo throughout

### 📊 Production Metrics
- **Tests**: 139/139 passing (100% success rate)
- **TypeScript**: 0 errors, strict mode enabled
- **Build Warnings**: 0 (production clean)
- **Translation Coverage**: 205+ keys (complete)

### Key Screens
| Screen | Description | Status |
|--------|-------------|--------|
| **Onboarding** | 6-step tax education with PIT/VAT/CIT tutorials, skip functionality | ✅ Production |
| **Home** | Enhanced stats cards, quick actions, compliance tips | ✅ Production |
| **Dashboard** | Real-time metrics, tax insights, compliance monitoring, quick actions | ✅ Production |
| **Create Invoice** | Form validation, OCR receipt scanner, number formatting, offline support | ✅ Production |
| **Invoices List** | Sync status, pull-to-refresh, search | ✅ Production |
| **Settings** | Language, API URL, sync preferences | ✅ Production |
| **Chatbot** | AI tax assistant with offline FAQ fallback | ✅ Production |

### 📦 Key Components

#### OCR Components
| Component | File | Description |
|-----------|------|-------------|
| **ARCameraView** | `mobile/src/components/ocr/ARCameraView.tsx` | Real-time receipt detection with AR overlay, alignment guides, auto-capture |
| **Receipt Classifier** | `mobile/src/services/ocr/receipt-classifier.ts` | AI-powered OCR service with offline processing, extracts merchant/items/totals |

#### Tax Components
| Component | File | Description |
|-----------|------|-------------|
| **TaxBreakdown** | `mobile/src/components/tax/TaxBreakdown.tsx` | Interactive tax visualization with per-bracket breakdown, savings recommendations |
| **Tax Engine** | `mobile/src/services/tax/engine.ts` | PIT/VAT/CIT calculators with Nigeria Tax Act 2025 rules |
| **Nigeria 2025 Rules** | `mobile/src/services/tax/rules/nigeria-2025.ts` | Tax rate constants and thresholds |

#### Dashboard Components
| Component | Description |
|-----------|-------------|
| **MetricCard** | Business metrics display with variant styles (primary, success, warning) |
| **QuickAction** | Action button grid for rapid navigation |
| **TaxInsightsCard** | PIT calculation display with optimization hints |
| **ComplianceCard** | NRS/NDPR compliance status monitoring |

#### Shared Components
| Component | File | Description |
|-----------|------|-------------|
| **SyncStatusBar** | `mobile/src/components/SyncStatusBar.tsx` | Network status and sync indicator |
| **QuickActionRail** | `mobile/src/components/QuickActionRail.tsx` | Home screen quick actions |
| **InsightsCarousel** | `mobile/src/components/InsightsCarousel.tsx` | Tax tips and compliance insights |
| **LivingBridgeHeader** | `mobile/src/components/LivingBridgeHeader.tsx` | Dynamic app header with sync status |

### API Integration

The mobile app connects to the backend via REST API:

```typescript
// Base URL configuration
const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:3000'  // Android emulator
  : 'https://api.taxbridge.ng';

// Create invoice
POST /api/v1/invoices
{
  "customerName": "Aunty Ngozi",
  "items": [
    { "description": "Product A", "quantity": 2, "unitPrice": 500 }
  ]
}

// List invoices
GET /api/v1/invoices?status=queued&take=50

// Get invoice details
GET /api/v1/invoices/:id
```

---

## 🔌 API Endpoints

### Invoice Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/invoices` | Create new invoice |
| `GET` | `/api/v1/invoices` | List invoices (paginated) |
| `GET` | `/api/v1/invoices/:id` | Get invoice details |

### Payments (Remita)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/payments/generate` | Generate Remita RRR (requires stamped invoice) |
| `GET` | `/api/v1/payments/:invoiceId/status` | Check payment status |

### OCR
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/ocr/receipt` | Extract text from receipt image |

### Health & Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health/live` | Liveness check (no DB) |
| `GET` | `/health/ready` | Readiness check (DB+Redis) |
| `GET` | `/health` | Deep health (all deps) |
| `GET` | `/ready` | Alias for `/health/ready` |
| `GET` | `/metrics` | Prometheus metrics |

### Device Sync (v5.0.4+)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/api/v1/sync/heartbeat` | Register/update device presence |
| `GET` | `/api/v1/sync/pull?cursor=...` | Pull changes (composite timestamp:id cursor) |
| `POST` | `/api/v1/sync/push` | Push local changes to server |
| `GET` | `/api/v1/sync/conflicts` | List unresolved sync conflicts |
| `POST` | `/api/v1/sync/conflicts/:id/resolve` | Resolve a sync conflict |

### Admin APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/stats` | Dashboard statistics |
| `GET` | `/api/admin/analytics` | Analytics data |
| `GET` | `/api/admin/invoices` | Invoice management |
| `POST` | `/api/admin/invoices/:id/resubmit-duplo` | Resubmit to DigiTax |

---

## ⚙️ Configuration

### Environment Variables

#### Backend (.env)
```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://taxbridge:dev_password@localhost:5432/taxbridge_dev"

# Redis
REDIS_URL="redis://localhost:6380"

# DigiTax Integration
DIGITAX_API_URL="https://sandbox.digitax.ng"
DIGITAX_API_KEY="your-api-key"
DIGITAX_HMAC_SECRET="your-hmac-secret"
DIGITAX_MOCK_MODE=true

# Remita Integration
REMITA_MERCHANT_ID="your-merchant-id"
REMITA_API_KEY="your-api-key"
REMITA_SERVICE_TYPE_ID="your-service-type"
REMITA_API_URL="https://remitademo.net"

# SMS (Africa's Talking)
COMMS_PROVIDER=africastalking
AT_API_KEY="your-at-api-key"
AT_USERNAME="sandbox"

# Security
ALLOWED_ORIGINS="http://localhost:3001,http://localhost:19006"
```

#### Admin Dashboard (.env.local)
```bash
BACKEND_URL=http://localhost:3000
ADMIN_API_KEY=your-admin-key
```

#### Mobile Authentication (JWT)

TaxBridge mobile uses JWT auth for production API calls:

- Tokens are stored on-device using `expo-secure-store` (with an AsyncStorage fallback for test/dev environments).
- The mobile API client automatically attaches `Authorization: Bearer <accessToken>` when available.
- If the backend returns `401`, the client will attempt a one-time refresh via `/api/v1/auth/refresh` (using the stored refresh token) and then retry.
- Offline-first still applies: invoices can be created offline, but syncing pending invoices requires an authenticated session.

Auth endpoints:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-phone`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

---

## 🧪 Testing

TaxBridge has a comprehensive testing infrastructure with **215 tests** across all components.

### Test Summary

| Component | Tests | Status | Coverage |
|-----------|-------|--------|----------|
| **Backend** | 68 tests | ✅ Passing | 85%+ |
| **Admin Dashboard** | 8 tests | ✅ Passing | 80%+ |
| **Mobile** | 139 tests | ✅ Passing | 90%+ |
| **Total** | **215 tests** | ✅ All Passing | - |

### Backend Tests
```bash
cd backend
npm test                    # Run all tests with coverage
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
npm run test:api            # Duplo/Remita API tests
npm run test:watch          # Watch mode
```

### Mobile Tests
```bash
cd mobile
npm test                    # Run all 139 tests (7 suites)
npm test -- --coverage      # With coverage report
npm test -- --watch         # Watch mode
```

**Test Suites:**
- `OnboardingSystem.integration.test.tsx` - Full onboarding flow (29 tests)
- `taxCalculator.test.ts` - PIT/VAT/CIT calculations (50+ tests)
- `mockFIRS.test.ts` - Mock e-invoicing simulation (40+ tests)
- `payment.e2e.test.tsx` - Payment flow E2E (16 tests)
- `CreateInvoiceScreen.test.tsx` - Invoice creation (2 tests)
- `SyncContext.test.tsx` - Offline sync context (1 test)
- `e2e.test.tsx` - Core E2E integration (19 tests)

**Note:** Mobile tests use Jest 29.7.0 (stable LTS) for npm workspaces monorepo compatibility. See [mobile/README.md](mobile/README.md) and [mobile/UNIT_TESTS_COMPLETE.md](mobile/UNIT_TESTS_COMPLETE.md) for details.

### Admin Dashboard Tests
```bash
cd admin-dashboard
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

### Load Testing
```bash
cd backend
npm run test:performance    # k6 load tests

# Specific scenarios
k6 run -e SCENARIO=duploStressTest backend/load-test/k6-script.js
k6 run -e SCENARIO=remitaStressTest backend/load-test/k6-script.js
```

### Performance Gates (NRS 2026 Compliance)
- API Response: p95 < 300ms
- Duplo Submission: p95 < 2000ms
- Remita RRR: p95 < 3000ms
- Error Rate: < 10% overall

---

## 🚢 Deployment

### Quick Deploy Options

| Platform | Cost | Recommended For |
|----------|------|-----------------|
| **Render** | $7/month | MVP/Startup |
| **Railway** | Pay-as-you-go | Development |
| **AWS EC2** | Variable | Production |
| **DigitalOcean** | $12/month | Production |

See [DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md) for detailed instructions.

### Production Checklist

- [ ] SSL/TLS certificates configured
- [ ] Environment variables secured
- [ ] Database backups enabled
- [ ] Redis persistence configured
- [ ] Rate limiting enabled
- [ ] Monitoring & alerting setup
- [ ] DPIA completed (NDPC compliance)

---

## 🔒 Security & Compliance

### NRS Compliance
- All invoices submitted via **NITDA-accredited APPs** (DigiTax)
- **UBL 3.0 / Peppol BIS Billing 3.0** format
- Cryptographic Stamp Identifier (CSID) generation
- Invoice Reference Number (IRN) tracking

### Data Protection (NDPC)
- Encryption of sensitive fields (TIN, NIN)
- Immutable audit logs
- Data minimization practices
- User data export capability

### Security Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

---

## 📊 Monitoring

### Health Endpoints
```bash
# Basic health check
curl http://localhost:3000/health

# Detailed readiness
curl http://localhost:3000/ready

# Prometheus metrics
curl http://localhost:3000/metrics
```

### Key Metrics
- Request latency (p50, p95, p99)
- Error rates by endpoint
- Queue depth and processing time
- External API health (DigiTax, Remita)

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Follow the coding standards in [.windsurfrules.md](.github/instructions/windsurfrules.instructions.md)
4. Write tests for new functionality
5. Submit a PR with clear description

### Development Rules
- **Compliance First**: Never bypass NRS/DigiTax integration
- **Offline-First**: Core features must work without internet
- **Inclusion Over Elegance**: Prioritize low-literacy, low-bandwidth users

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [PRD.md](docs/PRD.md) | Product Requirements Document |
| [ONBOARDING_QUICKSTART.md](ONBOARDING_QUICKSTART.md) | Onboarding system quick start |
| [DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md) | Deployment guide |
| [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) | Production deployment |
| [REMITA_QUICKSTART.md](REMITA_QUICKSTART.md) | Remita integration |
| [OCR_INTEGRATION.md](docs/OCR_INTEGRATION.md) | OCR setup guide |
| [TESTING_QUALITY_ASSURANCE.md](docs/TESTING_QUALITY_ASSURANCE.md) | Testing guide |
| [mobile/PRODUCTION_READINESS_REPORT.md](mobile/PRODUCTION_READINESS_REPORT.md) | Mobile production status |
| [SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md) | Security implementation |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Nigeria Revenue Service (NRS) for e-invoicing standards
- DigiTax team for APP integration support
- Remita for payment gateway services
- Open source community for foundational tools

---

<div align="center">

**Built with ❤️ for Nigerian SMEs**

[Report Bug](https://github.com/Scardubu/taxbridge/issues) • [Request Feature](https://github.com/Scardubu/taxbridge/issues) • [Documentation](docs/PRD.md)

</div>
