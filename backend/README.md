# TaxBridge Backend API

<div align="center">

**NRS-compliant e-invoicing and tax management API for Nigerian SMEs**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![Fastify](https://img.shields.io/badge/Fastify-5.6-black)](https://fastify.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue)](https://postgresql.org)
[![Tests](https://img.shields.io/badge/Tests-68%2F68%20Passing-green)]()

</div>

---

## ✨ Features

### Core Functionality
- **NRS E-Invoicing**: UBL 3.0 / Peppol BIS Billing 3.0 compliant invoices
- **DigiTax Integration**: NITDA-accredited Access Point Provider integration
- **Remita Payments**: RRR generation and payment status tracking
- **OCR Processing**: Receipt scanning with Tesseract.js
- **Queue System**: BullMQ-powered async processing

### Technical Features
- **Fastify 5.x**: High-performance HTTP server
- **Prisma ORM 7.x**: Type-safe database operations
- **Redis + BullMQ**: Message queues and caching
- **Zod Validation**: Runtime type validation
- **TypeScript**: Full type safety

### Compliance
- **Nigeria Tax Act 2025**: Full compliance
- **NRS 2026 Mandate**: E-invoicing ready
- **NDPC/NDPR**: Data protection compliant
- **Peppol BIS 3.0**: International standard

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── server.ts              # Fastify server entry point
│   ├── routes/                # API route handlers
│   │   ├── invoices.ts        # Invoice CRUD operations
│   │   ├── payments.ts        # Remita payment endpoints
│   │   ├── ocr.ts             # OCR receipt processing
│   │   ├── admin.ts           # Admin dashboard APIs
│   │   └── health.ts          # Health check endpoints
│   ├── services/              # Business logic layer
│   │   ├── invoice.service.ts # Invoice operations
│   │   ├── payment.service.ts # Payment processing
│   │   └── ubl.service.ts     # UBL XML generation
│   ├── integrations/          # External API integrations
│   │   ├── duplo/             # DigiTax/Duplo e-invoicing
│   │   └── remita/            # Remita payment gateway
│   ├── lib/                   # Shared utilities
│   │   ├── ubl/               # UBL 3.0 generator
│   │   ├── tax/               # Tax calculations (7.5% VAT)
│   │   └── ocr/               # OCR processing
│   ├── queue/                 # BullMQ workers
│   ├── mocks/                 # Development mock servers
│   ├── types/                 # TypeScript definitions
│   └── __tests__/             # Test files
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── docs/
│   └── ubl/                   # UBL specification docs
├── load-test/
│   ├── k6-script.js           # k6 load testing
│   └── README.md              # Load test documentation
├── coverage/                  # Jest coverage reports
├── jest.config.cjs            # Jest configuration
├── tsconfig.json              # TypeScript configuration
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ LTS
- PostgreSQL 15+
- Redis 7+
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   
   Configure the following variables:
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
   ```

3. **Database Setup**:
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Apply database schema
   npx prisma db push
   
   # Run migrations (if available)
   npm run db:migrate
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   
   Server runs on `http://localhost:3000`

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

## 🧪 Testing

The backend has **68 tests** across unit, integration, and API test categories.

### Test Summary

| Category | Tests | Description |
|----------|-------|-------------|
| **Unit Tests** | ~40 | UBL generation, tax calculations, utilities |
| **Integration Tests** | ~20 | Duplo, Remita API integration |
| **API Tests** | ~8 | Route handlers, middleware |
| **Total** | **68** | ✅ All Passing |

### Run Tests

```bash
# Run all tests with coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# API-specific tests (Duplo/Remita)
npm run test:api

# Watch mode for development
npm run test:watch

# E2E tests
npm run test:e2e
```

### Test Structure

```
src/__tests__/
├── ubl.generator.unit.test.ts     # UBL 3.0 generation (55 fields)
├── tax.calculator.unit.test.ts    # Tax calculations (7.5% VAT)
├── duplo.integration.test.ts      # DigiTax OAuth + e-invoicing
├── remita.integration.test.ts     # Remita RRR + webhooks
└── routes.integration.test.ts     # API endpoint tests
```

### Coverage Requirements

- **Overall**: 85%+ coverage
- **Critical Paths**: 100% coverage
  - UBL generation (55 mandatory fields)
  - Tax calculations (7.5% VAT)
  - Duplo integration (OAuth 2.0)
  - Remita payment flow (RRR + webhooks)

---

## ⚡ Load Testing

### k6 Performance Tests

```bash
# Run load tests
npm run test:performance

# Specific scenarios
k6 run -e SCENARIO=duploStressTest load-test/k6-script.js
k6 run -e SCENARIO=remitaStressTest load-test/k6-script.js
k6 run -e SCENARIO=spikeTest load-test/k6-script.js
```

### Performance Gates (NRS 2026 Compliance)

| Endpoint | Requirement | Status |
|----------|-------------|--------|
| Health Check | p95 < 100ms | ✅ |
| Invoice List | p95 < 500ms | ✅ |
| Status Check | p95 < 1000ms | ✅ |
| Duplo Submit | p95 < 2000ms | ✅ |
| Remita RRR | p95 < 3000ms | ✅ |
| **Overall** | **p95 < 300ms** | ✅ |

---

## 🐳 Docker Development

```bash
# Start all services
docker-compose -f ../infra/docker-compose.dev.yml up -d

# This starts:
# - PostgreSQL on localhost:5432
# - Redis on localhost:6380
```

---

## 📋 UBL 3.0 Compliance

### 55 Mandatory Fields

The backend generates fully compliant UBL 3.0 / Peppol BIS Billing 3.0 invoices:

| Category | Fields |
|----------|--------|
| **Invoice Identification** | cbc:ID, cbc:IssueDate, cbc:InvoiceTypeCode |
| **Supplier Information** | TIN, Company Name, Address, Country |
| **Customer Information** | TIN, Company Name, Address, Country |
| **Line Items** | Description, Quantity, Unit Price |
| **Tax Calculations** | VAT (7.5%), Tax Category, TaxScheme |
| **Monetary Totals** | LineExtensionAmount, TaxExclusiveAmount, TaxInclusiveAmount, PayableAmount |

### Tax Calculations

```typescript
// VAT Rate: 7.5%
const VAT_RATE = 0.075;

// Calculation
const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
const vatAmount = subtotal * VAT_RATE;
const total = subtotal + vatAmount;
```

---

## 🔒 Security

### API Security
- JWT authentication for admin endpoints
- CORS configuration for allowed origins
- Rate limiting via nginx
- Input validation with Zod schemas

### Data Protection (NDPC)
- Encrypted sensitive fields (TIN, NIN)
- Immutable audit logs
- Data minimization practices

### Security Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

---

## 🚢 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive production deployment instructions.

### Quick Deploy (Development)

```bash
# Build
npm run build

# Start production server
npm start

# Start queue worker
npm run worker
```

---

## 🔧 Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run all tests with coverage |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests |
| `npm run test:api` | Run Duplo/Remita API tests |
| `npm run test:performance` | Run k6 load tests |
| `npm run queue:worker` | Start BullMQ worker |
| `npm run start:digitax-mock` | Start DigiTax mock server |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |

---

## 📚 Additional Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
- [USSD_SMS_README.md](USSD_SMS_README.md) - USSD/SMS integration
- [load-test/README.md](load-test/README.md) - Load testing documentation
- [docs/ubl/](docs/ubl/) - UBL 3.0 specification

---

<div align="center">

**TaxBridge Backend** - Powering compliant tax management for Nigerian SMEs

</div>
