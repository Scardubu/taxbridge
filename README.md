# TaxBridge

<div align="center">

<img src="public/images/taxbridge-logo.png" alt="TaxBridge" width="280" />

### AI-Powered Tax Compliance for Nigerian Businesses

[![Backend](https://img.shields.io/badge/API-live-brightgreen?logo=render)](https://taxbridge-api-ker8.onrender.com/health/live)
[![Admin](https://img.shields.io/badge/Admin-live-brightgreen?logo=vercel)](https://taxbridge.vercel.app)
[![Tests](https://img.shields.io/badge/tests-528+%20passing-success?logo=jest)](/)
[![Coverage](https://img.shields.io/badge/coverage-97.29%25-brightgreen?logo=jest)](/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](/)
[![NRS](https://img.shields.io/badge/NRS%202026-compliant-green?logo=shield)](/)
[![Production](https://img.shields.io/badge/version-v12.0.0-blue?logo=git)](/)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](/)

**[Live API](https://taxbridge-api-ker8.onrender.com/api/v2/monitoring/health)** · **[Admin Console](https://taxbridge.vercel.app)** · **[API Docs](https://taxbridge-api-ker8.onrender.com/docs)** · **[Changelog](CHANGELOG.md)**

</div>

---

## What is TaxBridge?

TaxBridge is a **mobile-first, offline-capable** tax compliance platform built for Nigerian SMEs. It automates invoicing, tax calculations, expense tracking, payroll, and NRS e-invoicing — all compliant with the **Nigeria Tax Act 2025** and **NRS 2026** regulations.

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Mobile App  │────▶│   Backend API    │────▶│   Integrations  │
│  (Expo/RN)   │◀────│  (Fastify/Node)  │◀────│                 │
│              │     │                  │     │  DigiTax (NRS)   │
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
| **Backend API** | [taxbridge-api-ker8.onrender.com](https://taxbridge-api-ker8.onrender.com/api/v2/monitoring/health) | ✅ Live | Mar 7, 2026 |
| **Admin Console** | [taxbridge.vercel.app](https://taxbridge.vercel.app) | ✅ Live | Mar 7, 2026 |
| **Mobile App** | EAS → Google Play Internal Testing | ✅ v12.0.0 | Mar 7, 2026 |
| **API Docs** | [/docs](https://taxbridge-api-ker8.onrender.com/docs) | ✅ Live | Mar 7, 2026 |

### v12.0.0 — Apex Execution Directive (Mar 7, 2026)

- ✅ **5-zone dashboard** — apex/signal/action/context/ambient with staggered animations and skeleton loading
- ✅ **TaxHealthGauge** — SVG arc gauge with expanded/compact modes (COMP-02), WCAG AA progressbar
- ✅ **Full CIT engine** — `calculateCIT()` with small/large company bands, dev levy, education tax, loss carryforward (C-41)
- ✅ **All 5 filing wizards** — VAT, WHT, PAYE, NIL, CIT with idempotency, preflight checks, WCAG 2.2 AA
- ✅ **TOTP 2FA** — Setup, verify, disable, backup codes (bcrypt-hashed) with role_version invalidation (C-44)
- ✅ **Push notifications** — Expo push via UserDevice model, SMS fallback, chunked delivery (GAP-01)
- ✅ **Deep link security** — SAFE_ROUTES allowlist prevents dynamic path injection (C-36)
- ✅ **NRS circuit breaker** — opossum-based with 3-state Prometheus metric (C-14)
- ✅ **Flutterwave webhook** — HMAC-SHA256 + Redis NX idempotency + already_processed guard (C-37)
- ✅ **PDF receipt pipeline** — Async BullMQ worker to R2 with 24h signed URLs (C-40)
- ✅ **Admin DLQ management** — Retry, resolve, 2FA gate for bulk >10 depth
- ✅ **Admin analytics** — 5 panels: revenue-at-risk, compliance rate, risk distribution, NRS health, DLQ trend
- ✅ **Cursor pagination** — `PaginatedResponse<T>` with `encodeCursor`/`decodeCursor` (COMP-11)
- ✅ **7 Prometheus metrics** — request duration, NRS stamp success/failure, anomaly count, DLQ depth, penalty estimate, NRS circuit state
- ✅ **7 cron jobs** — tax health snapshot, risk scoring, NRS retry, deadline reminders, anomaly digest, session cleanup, keep-alive
- ✅ **Design system tokens** — colors, typography, spacing, radius, animation with dark mode support
- ✅ **Offline-first** — `networkMode:'offlineFirst'`, stale-on-resume (2 min threshold), exponential backoff
- ✅ **Docker multi-stage** — Non-root user, health-checked, Prisma generate for alpine target
- ✅ **46 absolute constraints** (C-01 to C-46) enforced via CI gates

---

## Key Features

### AI Intelligence (v3.0)

- **9-signal anomaly scanner** — `duplicate_amount`, `zscore_spike`, `vat_mismatch`, `round_number_clustering`, `weekend_business_expense`, `rapid_succession`, `phantom_vendor`, `cashflow_cliff`, `vat_threshold_approach`
- **Tax Health Score** — 0–100 composite with 30-day trend, grade labels in English + Pidgin
- **Smart Compliance Calendar** — NTA 2025 deadlines, projected liabilities, penalty accrual

### Tax Engine (NTA 2025 Compliant)

- **6 tax calculators** — PIT (0-25% progressive), VAT (7.5%), CIT (3-tier: 0/20/30%), CGT (10%), WHT, PAYE
- **Compliance calendar** — Auto-generated reminders with penalty estimation
- **Crypto tax** — FIFO cost basis tracking with CGT reporting

### NRS Operations Center (Admin, v3.0)

- **Real-time queue health** — 6-queue BullMQ dashboard with 10 s auto-refresh
- **Live submission feed** — Per-invoice NRS status with IRN tracking
- **Failed submission retry** — Rate-limited re-submission from the admin console

### Invoicing & NRS

- **NRS e-invoicing** via DigiTax integration with IRN stamping
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
- **Multi-language** — English + Nigerian Pidgin (1,200+ i18n keys)
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

# Start infrastructure
docker compose up -d                     # postgres:15-alpine + redis:7-alpine

# Environment
cp .env.example .env.local               # Edit DATABASE_URL, REDIS_URL, JWT_SECRET, NRS_API_KEY

# Install all workspaces
npm install

# Build shared contracts
npm run build --workspace=@taxbridge/contracts

# Backend
cd backend
npx prisma migrate dev
npx ts-node ../scripts/seed-dev.ts       # Seed test data
npm run dev                              # http://localhost:10000

# Mobile (new terminal)
cd mobile
npx expo start

# Admin Dashboard (new terminal)
cd admin-dashboard
npm run dev                              # http://localhost:3000

# Verify health
curl -s http://localhost:10000/api/v2/monitoring/health | jq '.status'
# → "healthy"
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
| **Mobile** | React Native (Expo SDK 54), Expo Router, Reanimated, @shopify/flash-list, i18next, lottie-react-native |
| **Backend** | Node.js 20, Fastify 5, Prisma 5.22, PostgreSQL 15, Redis 7 (IORedis), BullMQ 5, Pino, Sentry |
| **Admin** | Next.js 15 (App Router), jose (JWT), Tailwind CSS, Recharts |
| **Shared** | `@taxbridge/contracts` — PIT, CIT, VAT, WHT, penalty calculators + tax rate constants |
| **Integrations** | DigiTax/APP (NRS), Flutterwave, Paystack, Remita, Youverify, Africa's Talking (SMS) |
| **Security** | TOTP 2FA (speakeasy), bcrypt, HMAC-SHA256 webhooks, opossum circuit breaker, RBAC middleware |
| **Monitoring** | Sentry, Prometheus (7 metrics), Grafana (5 alerts), prom-client |
| **Deploy** | Render (Docker, fra region), Vercel (Admin), EAS (Mobile) |
| **Testing** | Jest (550+ tests), CI/CD with 5-stage pipeline |

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
| Lines of Code | 80,000+ |
| Test Suites | 30+ suites (550+ tests, 100% pass rate) |
| Test Coverage | 95%+ lines/functions, 90%+ branches |
| API Endpoints | 75+ RESTful |
| i18n Keys | 1,500+ (English + Nigerian Pidgin) |
| UI Components | 160+ with design token adoption |
| Mobile Screens | 20+ production screens |
| Backend Services | 22+ service modules |
| Absolute Constraints | 46 (C-01 to C-46) |
| Prometheus Metrics | 7 |
| Cron Jobs | 7 |
| Version | v12.0.0 (Mar 2026) |

---

## Monorepo Architecture

```
taxbridge/
├── mobile/             # Expo SDK 54 mobile app (EAS)
├── backend/            # Fastify 5 API (Render, Docker)
├── admin-dashboard/    # Next.js 15 admin console (Vercel)
├── packages/
│   └── contracts/     # @taxbridge/contracts — tax calculators + rate constants
│       ├── src/       # PIT, CIT, VAT, WHT, penalty, RBAC, pagination
│       └── dist/
├── prompts/            # 12 V12 AI prompt modules
├── scripts/            # seed-dev, backfill-v12, verify-prompts, rollback
├── infra/              # Grafana alerts + dashboard, k6 load tests
├── ml/                 # OCR & NLP services
├── docs/               # PRD, DPIA, API specs
├── docker-compose.yml  # Local dev (postgres:15 + redis:7)
└── render.yaml         # Render blueprint (fra region)
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
| [Deployment Summary v3.0.0](docs/DEPLOYMENT_SUMMARY_FEB_2026.md) | Feb 2026 production deployment record |
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

