# TaxBridge Admin Dashboard

<div align="center">

**Comprehensive monitoring and management for TaxBridge operations**

[![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.3-blue)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com)
[![Tests](https://img.shields.io/badge/Tests-8%2F8%20Passing-green)]()

</div>

---

## ✨ Features

### 🎯 Dashboard Overview
- Real-time system health monitoring
- API health checks for Duplo and Remita
- Key metrics visualization (users, invoices, payments, compliance)
- Trend indicators and recent activity tracking
- Auto-refresh with visual indicators

### 📊 Analytics & Insights
- **Integration Metrics**: Duplo success rates, Remita transaction volumes
- **Compliance Analytics**: NRS compliance tracking, exemption utilization
- **Trend Analysis**: Payment patterns, invoice submission trends
- **Export Capabilities**: CSV export for NRS audits

### 📄 Invoice Management
- **UBL 3.0 XML Viewer**: Parse and validate UBL XML with mandatory field checking
- **Duplo Integration**: Resubmit failed invoices, track IRN generation
- **Status Tracking**: Real-time invoice status updates
- **Bulk Operations**: Mass resubmission capabilities

### 🔧 System Administration
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
│   ├── duplo.ts             # Duplo API client
│   ├── remita.ts            # Remita API client
│   └── utils.ts             # Utility functions
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
# Production build
npm run build

# Start production server
npm start

# Lint check
npm run lint
```

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

### Common Issues

| Issue | Solution |
|-------|----------|
| API health errors | Check `BACKEND_URL` in `.env.local` |
| Duplo auth fails | Verify client credentials |
| Build fails | Clear `.next` folder |
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
