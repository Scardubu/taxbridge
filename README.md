# TaxBridge

<div align="center">

![TaxBridge Logo](docs/assets/logo.png)

**Mobile-first, NRS-compliant e-invoicing platform for Nigerian SMEs**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](/)

[Documentation](docs/PRD.md) • [Quick Start](#-quick-start) • [API Reference](#-api-endpoints) • [Contributing](#-contributing)

</div>

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
| **Database** | PostgreSQL + Prisma ORM | 15.x / 7.2 |
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

- **Node.js** 18+ (LTS recommended)
- **Docker Desktop** (for PostgreSQL & Redis)
- **Expo CLI** (`npm install -g expo-cli`)
- **Git**

### 1. Clone & Install

```bash
git clone https://github.com/Scardubu/taxbridge.git
cd taxbridge
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
npm install

# Create environment file
cp .env.example .env

# Configure database URL in .env:
# DATABASE_URL="postgresql://taxbridge:dev_password@localhost:5432/taxbridge_dev"
# REDIS_URL="redis://localhost:6380"

# Initialize database
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

Backend runs on `http://localhost:3000`

### 4. Start Mobile App

```bash
cd mobile
npm install
npm start
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

## 📱 Mobile App Features

### Core Functionality
- **Offline-First**: Create invoices without internet connection
- **Auto-Sync**: Automatically syncs when online with exponential backoff
- **SQLite Storage**: Local database with automatic pruning
- **Multi-language**: English and Nigerian Pidgin support

### Key Screens
| Screen | Description |
|--------|-------------|
| **Home** | Quick stats and recent invoices |
| **Create Invoice** | Form with validation for new invoices |
| **Invoices List** | View all invoices with sync status |
| **Settings** | Language, API URL, sync preferences |

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
| `POST` | `/api/v1/payments/generate-rrr` | Generate Remita RRR |
| `GET` | `/api/v1/payments/status/:rrr` | Check payment status |

### OCR
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/ocr/receipt` | Extract text from receipt image |

### Health & Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Basic health check |
| `GET` | `/ready` | Readiness probe |
| `GET` | `/metrics` | Prometheus metrics |

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

---

## 🧪 Testing

TaxBridge has a comprehensive testing infrastructure with **114+ tests** across all components.

### Test Summary

| Component | Tests | Status | Coverage |
|-----------|-------|--------|----------|
| **Backend** | 68 tests | ✅ Passing | 85%+ |
| **Admin Dashboard** | 8 tests | ✅ Passing | 80%+ |
| **Mobile** | 38 tests | ✅ Passing | 80%+ |
| **Total** | **114+ tests** | ✅ All Passing | - |

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
npm test                    # Run all 38 tests (4 suites)
npm test -- --coverage      # With coverage report
npm test -- --watch         # Watch mode
```

**Test Suites:**
- `SyncContext.test.tsx` - Offline sync context (1 test)
- `CreateInvoiceScreen.test.tsx` - Invoice creation (2 tests)
- `payment.e2e.test.tsx` - Payment flow E2E (16 tests)
- `e2e.test.tsx` - Core E2E integration (19 tests)

**Note:** Mobile tests use custom Jest configuration for npm workspaces monorepo compatibility. See [mobile/README.md](mobile/README.md) for details.

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
| [DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md) | Deployment guide |
| [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) | Production deployment |
| [REMITA_QUICKSTART.md](REMITA_QUICKSTART.md) | Remita integration |
| [OCR_INTEGRATION.md](docs/OCR_INTEGRATION.md) | OCR setup guide |
| [TESTING_QUALITY_ASSURANCE.md](docs/TESTING_QUALITY_ASSURANCE.md) | Testing guide |

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
