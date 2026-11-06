# TaxBridge Backend Production Deployment Guide 🚀

This guide provides comprehensive production deployment instructions for the TaxBridge Backend API on Render.

## 🏗️ Production Architecture

```
┌─────────────────────────────────┐
│          Cloudflare WAF         │ (TLS 1.3, DDoS protection, HSTS)
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│      Render Docker Service      │ (taxbridge-api, Node 20.x LTS)
│      Frankfurt Region (fra)     │
└───────┬───────────────┬─────────┘
        │               │
┌───────▼───────┐ ┌─────▼─────────┐
│  PostgreSQL   │ │  Redis Cloud  │ (BullMQ queues: nrsStamp, pdfReceipt,
│  (Supabase)   │ │  Cache Store  │  sms, ussd, audit, sync)
└───────────────┘ └───────────────┘
        │
┌───────▼─────────────────────────────────────────────────┐
│                   External Integrations                 │
│  - DigiTax (NRS Access Point, UBL 3.0 / Peppol BIS 3.0) │
│  - Payment Gateways: Flutterwave (Primary), Paystack   │
│  - Remita (RRR Generation & Government Revenue)         │
│  - Youverify (TIN / CAC Identity Verification)          │
│  - Africa's Talking (SMS & OTP delivery)                │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites & Infrastructure

### Hardware / Resource Allocation (Render)
- **Service Name**: `taxbridge-api`
- **Region**: Frankfurt (`frankfurt` / `fra`)
- **Runtime**: Docker (Multi-stage Dockerfile, Node 20.x, non-root `taxbridge` user)
- **Plan**: Standard / Starter (min 1 vCPU, 2GB RAM)
- **Health Checks**:
  - Liveness: `/health/live` (<200ms)
  - Readiness: `/health/ready` (<500ms)
  - Detailed: `/api/v2/monitoring/health`

### Databases & Cache
- **PostgreSQL 15+** (Supabase with connection pooling via PgBouncer on port 6543, direct migration connection on port 5432)
- **Redis 7+** (Upstash / Redis Cloud with TLS and password authentication)

---

## 🔧 Environment Configuration

Set the following environment variables in the Render Dashboard under **Environment**:

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database Connections
DATABASE_URL="postgresql://user:password@pooler.host.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@direct.host.supabase.com:5432/postgres?sslmode=require"

# Redis Cache & Message Queues
REDIS_URL="rediss://default:password@host.redis.com:6379"

# Cryptographic Keys (Min 64-char hex strings)
JWT_SECRET="generate-with-crypto-randomBytes-32-hex"
JWT_REFRESH_SECRET="generate-with-crypto-randomBytes-32-hex"
ENCRYPTION_KEY="64-char-hex-string-for-aes-256-gcm"
TAX_ID_ENCRYPTION_KEY="64-char-hex-string-for-tin-bvn-encryption"

# Security & CORS
ALLOWED_ORIGINS="https://taxbridge.vercel.app,https://admin.taxbridge.ng"
ALLOW_DEBUG_USER_ID_HEADER=false

# Platform Administration
INTERNAL_API_KEY="server-only-internal-key-min-32-chars"
ADMIN_API_KEYS="primary-admin-key,secondary-admin-key"

# Payment Providers (LIVE CREDENTIALS)
PRIMARY_PAYMENT_GATEWAY="flutterwave"
FALLBACK_PAYMENT_GATEWAY="paystack"

# Flutterwave
FLW_PUBLIC_KEY="your-flutterwave-public-key"
FLW_SECRET_KEY="your-flutterwave-secret-key"
FLW_SECRET_HASH="your-flutterwave-secret-hash"
FLW_ENCRYPTION_KEY="your-flutterwave-encryption-key"

# Paystack
PAYSTACK_SECRET_KEY="your-paystack-secret-key"
PAYSTACK_PUBLIC_KEY="your-paystack-public-key"
PAYSTACK_WEBHOOK_SECRET="your-paystack-webhook-secret"

# Remita Integration
REMITA_MERCHANT_ID="your-merchant-id"
REMITA_API_KEY="your-api-key"
REMITA_SERVICE_TYPE_ID="your-service-type-id"
REMITA_API_URL="https://remita.net"

# DigiTax (NRS E-Invoicing)
DIGITAX_API_URL="https://api.digitax.ng"
DIGITAX_API_KEY="your-digitax-production-key"
DIGITAX_HMAC_SECRET="your-hmac-secret"
DIGITAX_MOCK_MODE=false

# Youverify (Identity & Business Verification)
YOUVERIFY_API_KEY="your-youverify-production-key"
YOUVERIFY_BASE_URL="https://api.youverify.co"
YOUVERIFY_SANDBOX=false

# Communications (Africa's Talking)
COMMS_PROVIDER="africastalking"
AT_API_KEY="your-at-production-key"
AT_USERNAME="taxbridge"
AT_SENDER_ID="TaxBridge"

# Observability
SENTRY_DSN="https://xxxx@sentry.io/xxxx"
ENABLE_METRICS=true
```

---

## 🐳 Docker Deployment

The production build uses the root multi-stage Dockerfile:

```bash
# Build production Docker image locally to verify
docker build -f Dockerfile -t taxbridge-backend:v14.0.0 .

# Run container locally with environment file
docker run -p 3000:3000 --env-file .env taxbridge-backend:v14.0.0
```

### Build & Run Commands (Render)
- **Build Command**: Multi-stage build (`prisma generate && tsc -p tsconfig.json && node scripts/copy-static-assets.js`)
- **Start Command**: `node dist/backend/src/server.js`

---

## 🗄️ Database Migrations

Apply database migrations directly using Prisma before promoting a new release:

```bash
# In backend workspace:
npx prisma migrate deploy

# Verify schema state:
npx prisma migrate status
```

---

## 🔍 Health Checks & Verification

After deployment, confirm all health probes respond successfully:

```bash
# Liveness Probe (<200ms)
curl -i https://taxbridge-api-ker8.onrender.com/health/live

# Readiness Probe (<500ms)
curl -i https://taxbridge-api-ker8.onrender.com/health/ready

# Prometheus Telemetry (Platform admin authenticated)
curl -i https://taxbridge-api-ker8.onrender.com/metrics
```
