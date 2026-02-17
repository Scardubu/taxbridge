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
[![Production](https://img.shields.io/badge/status-production%20ready-success?logo=checkmarx)](/)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](/)

**[Live API](https://taxbridge-api-ker8.onrender.com/health)** · **[Admin Console](https://taxbridge.vercel.app)** · **[API Docs](https://taxbridge-api-ker8.onrender.com/docs)** · **[Production Report](docs/PRODUCTION_FINALIZATION_REPORT.md)**

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

| Platform | URL | Status | Last Updated |
| --- | --- | --- | --- |
| **Backend API** | [taxbridge-api-ker8.onrender.com](https://taxbridge-api-ker8.onrender.com/health) | ✅ Live | Feb 15, 2026 |
| **Admin Console** | [taxbridge.vercel.app](https://taxbridge.vercel.app) | ✅ Live | Feb 15, 2026 |
| **Mobile App** | EAS Build → Google Play Internal Testing | ✅ Ready | Feb 15, 2026 |
| **API Docs** | [/docs](https://taxbridge-api-ker8.onrender.com/docs) | ✅ Live | Feb 15, 2026 |

### Recent Production Updates (Feb 15, 2026)

- ✅ **Admin Dashboard Build Fixed** - Resolved Recharts/Redux Toolkit compatibility
- ✅ **Tax Engine Hardened** - 97.29% coverage with 37 boundary tests
- ✅ **Mobile OCR Enhanced** - Confidence scoring and review workflow
- ✅ **NRS Submission Hardened** - Idempotency, retry logic, circuit breaker
- ✅ **460+ Tests Passing** - Comprehensive test suite across all modules

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

- **Node.js** 18+ (20.x recommended)
- **PostgreSQL** 14+ (or Supabase)
- **Redis** 6+

### Development Setup

```bash
# Clone
git clone https://github.com/Scardubu/taxbridge.git
cd taxbridge

# Install all workspaces
npm install

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

### Production Deployment

```powershell
# 1. Analyze repository
.\scripts\0-Analyze-Repository.ps1

# 2. Install dependencies
.\scripts\1-Install-Dependencies.ps1

# 3. Validate production environment
.\scripts\validate-production-env.ps1 -EnvFile .env.production

# 4. Run smoke tests
.\scripts\smoke-tests.ps1 -ApiUrl "https://taxbridge-api-ker8.onrender.com" -Verbose

# 5. Monitor production
.\scripts\6-Monitor-Production.ps1 -Continuous

# 6. Build mobile app
.\scripts\8-Build-Mobile-App.ps1 -Profile production -Platform android
```

See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for the full deployment checklist.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Mobile** | React Native, Expo SDK 52, SQLite, Reanimated 2, i18next |
| **Backend** | Node.js, Fastify, Prisma, PostgreSQL, Redis, BullMQ |
| **Admin** | Next.js, shadcn/ui, Tailwind CSS, Recharts |
| **Integrations** | DigiTax, Paystack, Flutterwave, Remita, Youverify |
| **Monitoring** | Sentry, Prometheus metrics, custom DLQ/pool monitors |
| **Deploy** | Render (API + Worker + Redis), Vercel (Admin), EAS (Mobile) |
| **Testing** | Jest (418 tests), 3 projects (unit/integration/e2e) |

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
| Development | Production ready (Feb 2026) |

---

## Documentation

| Document | Description |
| --- | --- |
| [Production Finalization Report](docs/PRODUCTION_FINALIZATION_REPORT.md) | ⭐ Complete production readiness validation |
| [Production Checklist](PRODUCTION_CHECKLIST.md) | Pre-deploy verification checklist |
| [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | Platform deployment instructions |
| [Incident Response](docs/INCIDENT_RESPONSE.md) | P1-P4 incident playbook |
| [Implementation History](docs/IMPLEMENTATION_HISTORY.md) | Phases 1-10 development timeline |
| [API Documentation](.windsurf/rules/api-documentation.md) | Complete REST API reference |
| [Developer Guide](docs/DEVELOPER_GUIDE.md) | Setup and contribution guidelines |

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
