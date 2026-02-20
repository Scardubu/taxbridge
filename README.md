# TaxBridge

<div align="center">

<img src="public/images/taxbridge-logo.png" alt="TaxBridge" width="280" />

### AI-Powered Tax Compliance for Nigerian Businesses

[![Backend](https://img.shields.io/badge/API-live-brightgreen?logo=render)](https://taxbridge-api-ker8.onrender.com/health/live)
[![Admin](https://img.shields.io/badge/Admin-live-brightgreen?logo=vercel)](https://taxbridge.vercel.app)
[![Tests](https://img.shields.io/badge/tests-460+%20passing-success?logo=jest)](/)
[![Coverage](https://img.shields.io/badge/coverage-97.29%25-brightgreen?logo=jest)](/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](/)
[![NRS](https://img.shields.io/badge/NRS%202026-compliant-green?logo=shield)](/)
[![Production](https://img.shields.io/badge/version-v1.0.3-blue?logo=git)](/)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](/)

**[Live API](https://taxbridge-api-ker8.onrender.com/health)** · **[Admin Console](https://taxbridge.vercel.app)** · **[API Docs](https://taxbridge-api-ker8.onrender.com/docs)** · **[Changelog](CHANGELOG.md)**

</div>

---

## What is TaxBridge?

TaxBridge is a **mobile-first, offline-capable** tax compliance platform built for Nigerian SMEs. It automates invoicing, tax calculations, expense tracking, payroll, and FIRS e-invoicing — all compliant with the **Nigeria Tax Act 2025** and **NRS 2026** regulations.

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Mobile App  │────▶│   Backend API    │────▶│   Integrations  │
│  (Expo/RN)   │◀────│  (Fastify/Node)  │◀────│                 │
│              │     │                  │     │  DigiTax (FIRS)  │
│ • Offline DB │     │ • PostgreSQL     │     │  Paystack        │
│ • OCR Scan   │     │ • Redis/BullMQ   │     │  Flutterwave     │
│ • Tax Engine │     │ • Prisma ORM     │     │  Remita          │
│ • Sync Queue │     │ • Sentry APM     │     │  Youverify       │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │ Admin Panel │
                    │ (Next.js)   │
                    └─────────────┘
```

---

## Production Status

| Platform | URL | Status | Last Deploy |
| --- | --- | --- | --- |
| **Backend API** | [taxbridge-api-ker8.onrender.com](https://taxbridge-api-ker8.onrender.com/health) | ✅ Live | Feb 20, 2026 |
| **Admin Console** | [taxbridge.vercel.app](https://taxbridge.vercel.app) | ✅ Live | Feb 20, 2026 |
| **Mobile App** | EAS → Google Play Internal Testing | ✅ v1.0.3 | Feb 20, 2026 |
| **API Docs** | [/docs](https://taxbridge-api-ker8.onrender.com/docs) | ✅ Live | Feb 20, 2026 |

### v1.0.3 — Production Hardening (Feb 17–20, 2026)

- ✅ **Deterministic Render builds** — Migrated `render.yaml` from `yarn` to `npm ci` (project uses `package-lock.json`; `yarn --frozen-lockfile` produced "no lockfile" warnings)
- ✅ **Vercel framework detection fixed** — Added `"next": "16.1.1"` to root `devDependencies`; Vercel CLI v50 scans root `package.json` regardless of `vercel.json` `framework` setting
- ✅ **Metro `blockList` migration** — Replaced deprecated `blacklistRE` with `blockList` in `mobile/metro.config.js`
- ✅ **EAS fingerprint optimisation** — `EAS_SKIP_AUTO_FINGERPRINT=1` added to base EAS profile to skip slow fingerprint step
- ✅ **`@taxbridge/contracts` source resolution** — Added `"react-native": "src/index.ts"` to contracts `package.json`; Metro now reads TypeScript source directly, bypassing the uncompiled `dist/` that was absent in EAS cloud builds
- ✅ **Reanimated v4 worklets peer dep** — Added `react-native-worklets@^0.7.4` (new mandatory peer dep for `react-native-reanimated` v4)
- ✅ **`expo-localization` plugin declared** — Added `expo-localization ~16.0.0` to `mobile/package.json` (was referenced in `app.json` plugins but missing from deps)
- ✅ **`NODE_ENV=production` removed from EAS** — Was causing `npm --production` installs that skipped TypeScript, silently preventing `tsc` from running
- ✅ **Tax Engine hardened** — 97.29% coverage with 37 boundary tests
- ✅ **460+ Tests passing** — Comprehensive test suite across all modules

---

## Key Features

### Tax Engine (NTA 2025 Compliant)

- **6 tax calculators** — PIT (0-25% progressive), VAT (7.5%), CIT (3-tier: 0/20/30%), CGT (10%), WHT, PAYE
- **Compliance calendar** — Auto-generated reminders with penalty estimation
- **Crypto tax** — FIFO cost basis tracking with CGT reporting

### Invoicing & NRS

- **NRS e-invoicing** via DigiTax/FIRS integration with IRN stamping
- **4 PDF templates** — Professional, retail, service, wholesale
- **QR code generation** for invoice verification
- **Bulk operations** — Status update, delete, CSV/JSON export

### Payments

- **3 payment gateways** — Flutterwave (primary), Paystack (fallback), Remita
- **Automatic failover** between gateways
- **Webhook processing** with signature verification and idempotency

### Mobile (Offline-First)

- **SQLite** local database with sync queue
- **OCR receipt scanning** with AI-powered categorization (13 categories)
- **4-step onboarding** with interactive tax demos
- **Multi-language** — English + Nigerian Pidgin (1,080+ i18n keys)
- **WCAG 2.1 AA** accessible design system

### Business Verification

- **Youverify** integration for TIN, BVN, and CAC verification
- **Parallel verification** with confidence scoring

### Payroll & HR

- **Employee management** with automated PAYE calculation
- **Payslip generation** with full tax breakdown
- **Batch processing** for multi-employee payroll runs

### Monitoring & Security

- **Sentry** error tracking with offline queue
- **Prometheus-compatible** metrics at `/metrics`
- **AES-256-GCM** encryption for TIN/BVN at rest
- **Rate limiting**, security headers, JWT auth with rotation
- **DLQ monitoring** and connection pool metrics

---

## Quick Start

### Prerequisites

- **Node.js** 20.x LTS
- **PostgreSQL** 14+
- **Redis** 6+
- **Expo CLI** (`npm install -g expo-cli eas-cli`)

### Development Setup

```bash
# Clone
git clone https://github.com/Scardubu/taxbridge.git
cd taxbridge

# Install all workspaces (npm — do not use yarn; project uses package-lock.json)
npm install

# Build shared contracts package
npm run build --workspace=@taxbridge/contracts

# Backend
cd backend
cp ../.env.production.example .env   # Edit with your credentials
npx prisma generate
npx prisma db push
npm run dev

# Mobile (new terminal)
cd mobile
npx expo start

# Admin Dashboard (new terminal)
cd admin-dashboard
npm run dev
```

### Mobile EAS Builds

EAS build profiles are defined in [`mobile/eas.json`](mobile/eas.json).

```bash
cd mobile

# Development client (simulator + device)
eas build --profile development --platform android

# Internal APK for testing (side-loadable)
eas build --profile production-apk --platform android

# Production AAB for Google Play
eas build --profile production --platform android

# Store submission
eas submit --platform android --profile production
```

> **Note:** The `@taxbridge/contracts` package is resolved by Metro via the `"react-native"` field in `packages/contracts/package.json` (`src/index.ts`), bypassing the compiled `dist/`. This means `tsc` for contracts does **not** need to run during EAS builds.

### Production Deployment

```powershell
# 1. Validate production environment
node backend/validate-production-env.js

# 2. Run smoke tests against production
.\scripts\smoke-tests.ps1 -ApiUrl "https://taxbridge-api-ker8.onrender.com" -Verbose

# 3. Monitor production metrics
.\setup-monitoring.ps1

# 4. Check deployment status
.\check-status.ps1
```

Render (backend) and Vercel (admin) auto-deploy from the `master` branch. See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for the full pre-deploy checklist.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Mobile** | React Native 0.81, Expo SDK 54, Expo Router, SQLite, Reanimated v4.1, react-native-worklets, i18next |
| **Backend** | Node.js 20.x, Fastify, Prisma 5.22, PostgreSQL 14+, Redis 6+, BullMQ |
| **Admin** | Next.js 16.1, shadcn/ui, Tailwind CSS, Recharts, TypeScript 5 |
| **Shared** | `@taxbridge/contracts` — monorepo TypeScript package (Metro resolves via `react-native` field) |
| **Integrations** | DigiTax/APP (FIRS), Paystack, Flutterwave, Remita, Youverify |
| **Monitoring** | Sentry, Prometheus metrics, custom DLQ/pool monitors |
| **Deploy** | Render (API + Worker + Redis), Vercel (Admin), EAS (Mobile) |
| **Testing** | Jest (460+ tests), 3 projects (unit/integration/e2e) |

---

## API Endpoints (60+)

| Module | Endpoints | Description |
| --- | --- | --- |
| **Auth** | 4 | Register, login, refresh, logout |
| **Tax** | 6 | PIT, VAT, CIT, CGT, WHT, PAYE calculators |
| **Invoices** | 9 | CRUD, NRS stamping, PDF generation, stats |
| **Payments** | 5 | Initialize, verify, webhooks (Paystack + Flutterwave) |
| **Expenses** | 9 | CRUD, OCR scan, approve/reject, stats |
| **Business** | 5 | CRUD, Youverify verification |
| **Payroll** | 9 | Employees, process, payslips |
| **Compliance** | 6 | Reminders, dashboard, file/dismiss |
| **Crypto** | 6 | Transactions, CGT report, portfolio |
| **Reconciliation** | 1 | 3-pass matching (exact/fuzzy/partial) |
| **Bulk** | 3 | Status update, delete, export |
| **Sync** | 4 | Device sync, conflict resolution |
| **Health** | 6 | Live, ready, detailed, DigiTax, Remita, metrics |

Interactive API docs available at [`/docs`](https://taxbridge-api-ker8.onrender.com/docs).

---

## Project Stats

| Metric | Value |
| --- | --- |
| Lines of Code | 55,000+ |
| Test Suites | 21 suites (460+ tests, 100% pass rate) |
| Test Coverage | 97.29% (tax engine), 65%+ overall |
| API Endpoints | 60+ RESTful |
| i18n Keys | 1,080+ (English + Nigerian Pidgin) |
| UI Components | 147+ with 100% design token adoption |
| Mobile Screens | 15+ production screens |
| Backend Services | 15+ service modules |
| Version | v1.0.3 (Feb 2026) |

---

## Monorepo Architecture

```
taxbridge/
├── mobile/          # Expo SDK 54 / React Native 0.81 app (EAS)
├── backend/         # Node.js 20 + Fastify API (Render)
├── admin-dashboard/ # Next.js 16.1 admin console (Vercel)
├── packages/
│   └── contracts/  # @taxbridge/contracts — shared TypeScript types
│       ├── src/index.ts        ← Metro reads this (react-native field)
│       └── dist/index.js       ← Node/backend reads this (main field)
├── ml/              # OCR & NLP services
├── infra/           # CI, mocks, docker-compose
├── docs/            # PRD, DPIA, API specs
└── render.yaml      # Render blueprint (npm ci — not yarn)
```

### Package Resolution Notes

`packages/contracts/package.json` exposes two entry points:

```json
{
  "main": "dist/index.js",        // Node.js (backend, admin-dashboard)
  "react-native": "src/index.ts", // Metro bundler (mobile) — reads TS source directly
  "types": "dist/index.d.ts"
}
```

Metro's resolver checks the `react-native` field before `main`, so the mobile build works without a compiled `dist/` on the EAS cloud server.

---

## Documentation

| Document | Description |
| --- | --- |
| [Changelog](CHANGELOG.md) | ⭐ Version history and release notes |
| [Production Checklist](PRODUCTION_CHECKLIST.md) | Pre-deploy verification checklist |
| [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | Platform deployment instructions (Render, Vercel, EAS) |
| [Deployment Summary v1.0.3](docs/DEPLOYMENT_SUMMARY_FEB_2026.md) | Feb 2026 production deployment record |
| [Incident Response](docs/INCIDENT_RESPONSE.md) | P1–P4 incident playbook |
| [Implementation History](docs/IMPLEMENTATION_HISTORY.md) | Phases 1–10 development timeline |
| [Developer Guide](docs/DEVELOPER_GUIDE.md) | Setup and contribution guidelines |
| [NRS Integration](docs/INTEGRATION_CONTRACTS.md) | DigiTax/APP integration contracts |

---

## Environment Configuration

All three platforms share a unified configuration approach:

| Platform | Env File | Key Variable |
| --- | --- | --- |
| **Backend** | `.env` (from `.env.production.example`) | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` |
| **Mobile** | `mobile/.env.production` | `EXPO_PUBLIC_API_URL` |
| **Admin** | `admin-dashboard/.env.production` | `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_ADMIN_API_KEY` |

All point to the same backend: `https://taxbridge-api-ker8.onrender.com`

---

## Contributing

See [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for setup instructions and contribution guidelines.

---

## License

Proprietary — © 2026 TaxBridge Nigeria

---

<div align="center">

**Built for Nigerian businesses** 🇳🇬

*Offline-capable · NRS compliant · AI-powered · Production-ready*

</div>
