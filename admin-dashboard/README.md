# TaxBridge Enterprise Control Center

<div align="center">

**Accountant-first admin dashboard for TaxBridge platform operations**

[![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.3-blue)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com)
[![Tests](https://img.shields.io/badge/Tests-8%2F8%20Passing-green)]()

</div>

---

## 🏗️ Architecture — Enterprise Control Center

The admin dashboard is a single-page tabbed interface at `/dashboard`. All legacy sub-routes
(`/dashboard/analytics`, `/dashboard/compliance`, etc.) now perform **server-side redirects**
to the appropriate tab via `?tab=<name>`, preserving backward compatibility and deep-linkability.

### Component structure

```
components/admin-dashboard/
├── shell/
│   └── EnterpriseShell.tsx      — Layout shell (top-nav, SSE indicator, footer)
├── tabs/
│   ├── OverviewTab.tsx          — KPIs, health, launch metrics, charts
│   ├── AnalyticsTab.tsx         — DigiTax + Remita analytics, compliance trends
│   ├── ComplianceTab.tsx        — NRS status, compliance rate, recent issues
│   ├── InvoicesTab.tsx          — Invoice registry, UBL viewer, resubmit
│   ├── UsersTab.tsx             — Business registry, search & filter
│   ├── DevicesTab.tsx           — Mobile device management, force-sync
│   ├── SystemTab.tsx            — Infrastructure health, resource usage
│   └── index.ts                 — Barrel export
└── ui/
    ├── MetricCard.tsx            — KPI card with trend indicator
    ├── StatusPill.tsx            — Semantic status badge
    ├── SectionHeader.tsx         — Section title + description
    └── index.ts                  — Barrel export
```

### Navigation

| URL | Behaviour |
|-----|-----------|
| `/` | Server redirect → `/dashboard` |
| `/dashboard` | Enterprise Control Center (tabbed) |
| `/dashboard?tab=overview` | Opens Overview tab |
| `/dashboard?tab=analytics` | Opens Analytics tab |
| `/dashboard?tab=compliance` | Opens Compliance tab |
| `/dashboard?tab=invoices` | Opens Invoices tab |
| `/dashboard?tab=users` | Opens Businesses tab |
| `/dashboard?tab=devices` | Opens Devices tab |
| `/dashboard?tab=system` | Opens System tab |
| `/dashboard/analytics` | Server redirect → `/dashboard?tab=analytics` |
| `/dashboard/compliance` | Server redirect → `/dashboard?tab=compliance` |
| `/dashboard/invoices` | Server redirect → `/dashboard?tab=invoices` |
| `/dashboard/users` | Server redirect → `/dashboard?tab=users` |
| `/dashboard/devices` | Server redirect → `/dashboard?tab=devices` |
| `/dashboard/system` | Server redirect → `/dashboard?tab=system` |

---

## ✨ Features

### 🎯 Overview Tab
- Real-time KPI cards (users, invoices, payments, compliance)
- AI insights panel with platform intelligence and anomaly detection
- Integration health cards (DigiTax/Duplo, Remita) with live latency
- Launch metrics widget with MRR, NRR, GRR tracking
- Risk signal panel with anomaly classification
- Invoice and payment trend charts

### 📊 Analytics Tab
- **Date range filter**: 7d / 30d / 90d
- **DigiTax metrics**: Success rate trend, daily submission bar chart, error breakdown pie
- **Remita metrics**: Transaction trend, daily volume line chart
- **NRS compliance trend**: Compliant vs non-compliant bar chart
- **Withholding tax tracking**: Monthly WHT line chart
- CSV export capability

### 🛡️ Compliance Tab
- NRS connection status (connected / mock / error) with pulse indicator
- Compliance rate progress bar with breakdown
- Compliance KPIs: rate, compliant count, pending, non-compliant
- Recent issues list with type icons and resolved/open status
- Exemption utilization breakdown with progress bars

### 📄 Invoices Tab
- Invoice registry with status filter (all / queued / processing / stamped / failed)
- Full-text search across customer name, business, ID, NRS reference
- UBL XML viewer dialog with invoice detail
- One-click resubmit to DigiTax for failed invoices
- KPIs: total, stamped, in-progress, failed

### 👥 Businesses Tab
- Business registry with status filter (all / active / pending / suspended)
- Search by name, email, phone, TIN
- Onboarding completion indicator
- KPIs: total, active, pending, suspended

### 📱 Devices Tab
- Registered mobile device list with platform filter (iOS / Android)
- Active-only toggle and pagination
- Real-time updates via SSE (device:heartbeat, device:registered)
- Force-sync dialog with audit reason
- KPIs: registered, active, pending sync jobs, unresolved conflicts

### 🖥️ System Tab
- Overall system status banner (operational / degraded / disruption)
- Resource utilisation bars: CPU, memory, disk
- Individual service cards: API Server, Database, Cache, Job Queue
- Integration status cards: DigiTax, Remita, Supabase, Redis
- Recent system events feed (info / warning / error)
- Auto-refresh toggle (30-second interval)
- KPIs: uptime, CPU %, memory %, active connections

---

## 🔧 System Administration
- **User Management**: Monitor registered SMEs
- **Payment Reconciliation**: Track Remita RRR generation and confirmation
- **Audit Logging**: Complete audit trail for compliance
- **Health Monitoring**: API latency and uptime tracking

---

## 🛠 Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Framework** | Next.js (App Router) | 16.x |
| **Language** | TypeScript | 5.x |
| **UI Components** | Tailwind CSS + shadcn/ui | 3.x |
| **Charts** | Recharts | 3.x |
| **Data Fetching** | SWR | 2.x |
| **XML Processing** | xml2js | 0.6.x |
| **Icons** | Lucide React | 0.5x |

---

## 📁 Project Structure

```
admin-dashboard/
├── app/                     # Next.js App Router
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Landing page
│   ├── api/                 # API routes
│   │   └── admin/
│   │       ├── analytics/
│   │       ├── invoices/
│   │       └── stats/
│   └── dashboard/
│       ├── page.tsx         # Main dashboard
│       ├── analytics/       # Analytics view
│       └── invoices/        # Invoice management
├── components/
│   ├── DashboardLayout.tsx  # Main layout wrapper
│   ├── Navigation.tsx       # Sidebar navigation
│   ├── HealthCard.tsx       # API health display
│   ├── LoadingSpinner.tsx   # Loading states
│   ├── UBLViewer.tsx        # UBL XML viewer
│   ├── ErrorBoundary.tsx    # Error handling
│   ├── charts/
│   │   ├── DuploHealthChart.tsx
│   │   └── RemitaTransactionChart.tsx
│   └── ui/                  # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
├── lib/
│   ├── adminApiFallback.ts  # Backend-unavailable fallback helpers
│   ├── duplo.ts             # Duplo API client
│   ├── remita.ts            # Remita API client
│   └── utils.ts             # Utility functions
├── scripts/
│   └── clean-next.cjs       # Cross-platform .next cleanup
├── public/                  # Static assets
└── __tests__/               # Test files
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Access to TaxBridge backend API

### Installation

1. **Install dependencies**:
   ```bash
   cd admin-dashboard
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Configure the following variables:
   ```bash
   # Backend API
   BACKEND_URL=http://localhost:3000
   ADMIN_API_KEY=your-admin-api-key
   # Optional: provide comma-separated ADMIN_API_KEYS for rotation
   # ADMIN_API_KEYS=primary-admin-key,secondary-admin-key
   
   # Duplo Integration
   DUPLO_CLIENT_ID=your-duplo-client-id
   DUPLO_CLIENT_SECRET=your-duplo-client-secret
   DUPLO_API_URL=https://sandbox.duplo.ng
   
   # Remita Integration
   REMITA_MERCHANT_ID=your-merchant-id
   REMITA_API_KEY=your-api-key
   REMITA_API_URL=https://remitademo.net
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Access dashboard**: Open [http://localhost:3001](http://localhost:3001)

---

## 🔌 API Integration

### Backend API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/stats` | Dashboard statistics |
| `GET` | `/api/admin/analytics` | Analytics data |
| `GET` | `/api/admin/invoices` | Invoice list |
| `POST` | `/api/admin/invoices/:id/resubmit-duplo` | Resubmit invoice |

### Duplo E-Invoicing

**OAuth 2.0 Authentication** (Client Credentials Flow):
```typescript
// Token request
POST /oauth/token
{
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "grant_type": "client_credentials"
}
```

**Endpoints**:
- `POST /v1/einvoice/submit`: Submit UBL 3.0 XML
- `GET /v1/einvoice/status/{irn}`: Check submission status
- `GET /v1/health`: API health check

### Remita Payments

**SHA512 Hashing** for secure transaction signing:
```typescript
const hash = sha512(merchantId + serviceTypeId + orderId + amount + apiKey);
```

**Endpoints**:
- `POST /ecomm/init.reg`: Generate RRR
- `GET /ecomm/status.reg`: Check payment status
- `GET /ecomm/transactions`: Transaction history

---

## 📋 UBL 3.0 Compliance

### Mandatory Fields (55 total)

| Category | Fields |
|----------|--------|
| **Invoice Identification** | cbc:ID, cbc:IssueDate, cbc:InvoiceTypeCode |
| **Supplier Information** | TIN, Company Name, Address |
| **Customer Information** | TIN, Company Name, Address |
| **Line Items** | Description, Quantity, Unit Price |
| **Tax Calculations** | VAT (7.5%), Tax Category |
| **Monetary Totals** | Subtotal, Tax, Total, Payable |

### Validation Features
- Real-time field presence checking
- Compliance score calculation
- XML structure validation
- Error highlighting and suggestions

### UBL Viewer Component

```tsx
import { UBLViewer } from '@/components/UBLViewer';

<UBLViewer 
  ublXml={invoice.ublXml} 
  showValidation={true}
/>
```

---

## 🧪 Testing

The admin dashboard has **8 tests** across component and utility test suites.

### Test Summary

| Test Suite | Tests | Description |
|------------|-------|-------------|
| `HealthCard.test.tsx` | 4 | Health card component rendering |
| `UBLViewer.test.tsx` | 4 | UBL XML viewer validation |
| **Total** | **8** | ✅ All Passing |

### Run Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific test file
npm test -- HealthCard.test.tsx
```

### Test Structure

```
__tests__/
├── components/
│   ├── HealthCard.test.tsx   # Health monitoring card tests
│   └── UBLViewer.test.tsx    # UBL XML viewer tests
│   └── UBLViewer.test.tsx
├── lib/
│   └── utils.test.ts
└── api/
    └── admin.test.ts
```

### Test Scenarios (50+)
- API health monitoring
- Invoice resubmission workflows
- Payment status tracking
- Error handling and recovery
- Data export functionality

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Setup

| Environment | APIs | Access |
|-------------|------|--------|
| **Development** | Sandbox/Mock | Full |
| **Staging** | Sandbox | Limited |
| **Production** | Live | Restricted |

### Build Commands

```bash
# Production build (runs clean + webpack; Radix-compatible)
npm run build

# Start production server
npm start

# Lint check
npm run lint
```

**Build Notes:**
- Production builds use **webpack** (not Turbopack) for compatibility with Radix UI packages.
- The build script automatically runs `scripts/clean-next.cjs` before `next build` to avoid stale cache issues (especially on Windows).

---

## 📊 Monitoring

### Health Checks

The dashboard continuously monitors:
- Backend API health (every 30s)
- Duplo API status
- Remita API status
- Database connectivity
- Redis/Queue status

### Health Card Component

```tsx
<HealthCard
  title="Duplo API"
  status="healthy"
  latency={45}
  description="E-invoicing service"
/>
```

Status indicators:
- 🟢 **Healthy**: < 200ms latency
- 🟡 **Degraded**: 200-500ms latency  
- 🔴 **Error**: > 500ms or unavailable

---

## 🔒 Security & Compliance

### NDPC Compliance
- Data anonymization in logs
- User consent management
- Secure API key handling
- Audit trail maintenance

### NRS 2026 Compliance
- UBL 3.0 BIS Billing 3.0 support
- Peppol framework compatibility
- Mandatory field validation
- XML signature verification

### Security Headers

Applied via Next.js middleware:
```typescript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000'
}
```

---

## 💰 Cost Management

### Development
| Resource | Cost |
|----------|------|
| Duplo Sandbox | Free |
| Remita Demo | Free |
| Local Dev | Free |

### Production (Estimates)
| Resource | Cost |
|----------|------|
| Duplo | ₦50/1000 submissions |
| Remita | 1.5% transaction fee |
| Vercel Pro | $20/month |
| Monitoring | Free tier |

---

## 🔧 Troubleshooting

### Degraded State (Backend Warming Up)

When the backend API is unavailable (e.g., cold start on Render), the admin dashboard shows a **degraded-state** experience instead of failing:

- **Stats, Analytics, Invoices, Launch Metrics** API routes return fallback payloads with `fallback: true` and `warnings: ['backend_warming_up']`.
- Dashboard pages display a warning banner and avoid misleading empty states.
- CSV export is disabled when in fallback mode.
- Use `lib/adminApiFallback.ts` helpers (`getBackendFailureContext`, `fallbackJson`) for consistent handling.

### Common Issues

| Issue | Solution |
|-------|----------|
| API health errors | Check `BACKEND_URL` in `.env.local` |
| Duplo auth fails | Verify client credentials |
| Build fails | Run `npm run clean` then `npm run build` |
| Radix/Turbopack errors | Build uses webpack; ensure `next build --webpack` |
| SWR not updating | Check refresh intervals |

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev
```

---

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TaxBridge PRD](../docs/PRD.md)
- [UBL 3.0 Specification](https://docs.oasis-open.org/ubl/UBL-3.0/UBL-3.0.html)
- [Duplo API Docs](https://docs.duplo.ng)
- [Remita Integration Guide](https://www.remita.net/developers)

---

<div align="center">

**TaxBridge Admin Dashboard** - Empowering Nigerian SMEs with compliant tax management

[Report Bug](https://github.com/Scardubu/taxbridge/issues) • [Request Feature](https://github.com/Scardubu/taxbridge/issues)

</div>
