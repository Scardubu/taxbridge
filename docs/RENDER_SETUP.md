# Render Environment Setup Guide

## Current Deployment Status

**Backend API**: Live at `https://taxbridge-api-ker8.onrender.com`  
**Build Status**: ✅ Successful (commit `66afc3b`)  
**Redis**: ✅ Connected  
**Database**: ⚠️ Requires configuration

---

## Required Environment Variables

The following environment variables must be set in the **Render Dashboard** for the `taxbridge-api` service:

### 1. Database (Supabase) - CRITICAL

```bash
# Pooler URL (for application connections)
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# Direct URL (for Prisma migrations)
DIRECT_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require
```

**How to get these values:**
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Database**
3. Copy the **Connection Pooling** URL (port 6543) for `DATABASE_URL`
4. Copy the **Direct Connection** URL (port 5432) for `DIRECT_URL`
5. Replace `[YOUR-PASSWORD]` with your actual database password

### 2. Security Secrets

Generate these with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

```bash
JWT_SECRET=<64-char-hex>
JWT_REFRESH_SECRET=<64-char-hex>
ENCRYPTION_KEY=<64-char-hex>
SESSION_SECRET=<64-char-hex>
WEBHOOK_SECRET=<64-char-hex>
REMITA_WEBHOOK_SECRET=<64-char-hex>
```

### 3. Admin Dashboard API Keys

```bash
# Comma-separated for rotation support
ADMIN_API_KEYS=<generate-secure-key-1>,<generate-secure-key-2>
```

### 4. Payment Gateway Credentials

**Flutterwave** (Primary):
```bash
FLW_PUBLIC_KEY=FLWPUBK-<your-key>
FLW_SECRET_KEY=FLWSECK-<your-key>
FLW_SECRET_HASH=<your-hash>
FLW_ENCRYPTION_KEY=<your-encryption-key>
```

**Paystack** (Fallback):
```bash
PAYSTACK_SECRET_KEY=sk_live_<your-key>
PAYSTACK_PUBLIC_KEY=pk_live_<your-key>
PAYSTACK_WEBHOOK_SECRET=<your-secret>
```

**Remita**:
```bash
REMITA_MERCHANT_ID=<your-merchant-id>
REMITA_API_KEY=<your-api-key>
REMITA_SERVICE_TYPE_ID=<your-service-type-id>
```

### 5. Tax & Compliance

**DigiTax/Duplo** (for FIRS NRS integration):
```bash
DUPLO_CLIENT_ID=<your-client-id>
DUPLO_CLIENT_SECRET=<your-client-secret>
DIGITAX_API_URL=https://api.digitax.ng
DIGITAX_MOCK_MODE=false  # Set to true for testing
```

### 6. Business Verification

**Youverify**:
```bash
YOUVERIFY_API_KEY=<your-api-key>
YOUVERIFY_SANDBOX=false  # Set to true for testing
```

### 7. Monitoring (Optional)

**Sentry**:
```bash
SENTRY_DSN=https://<your-sentry-dsn>
```

---

## Current Known Issues

### 1. Database Connection Errors (Expected)

**Error**: `Can't reach database server at aws-0-us-west-2.pooler.supabase.com:6543`

**Status**: Expected until `DATABASE_URL` and `DIRECT_URL` are configured in Render.

**Impact**: 
- API is live and responding to health checks
- Database-dependent features will fail
- Production monitoring returns default values

**Fix**: Set the database environment variables in Render Dashboard.

### 2. Redis Connection Warnings (Fixed)

**Error**: `Stream isn't writeable and enableOfflineQueue is false`

**Status**: ✅ Fixed in commit `66afc3b`

**Fix Applied**: Added `redis.status === 'ready'` check before calling Redis commands.

### 3. Vercel Admin Dashboard 404s (Cosmetic)

**Error**: `Failed to load resource: 404` for `/favicon.ico` and `/`

**Status**: Cosmetic browser requests, not affecting functionality.

**Explanation**: 
- Root page (`/`) auto-redirects to `/dashboard` after 1 second
- Browser makes requests before redirect completes
- Favicon exists at `app/favicon.ico` and `public/favicon.ico`

---

## Deployment Steps

### Step 1: Configure Environment Variables

1. Go to Render Dashboard → `taxbridge-api` service
2. Navigate to **Environment** tab
3. Add all required variables from sections 1-7 above
4. Click **Save Changes**

### Step 2: Trigger Redeploy

Render will auto-redeploy when environment variables are updated. Alternatively:

```bash
git push origin master
```

### Step 3: Run Database Migrations

Once `DATABASE_URL` is configured:

```bash
# SSH into Render service or use Render Shell
cd /opt/render/project/src/backend
npx prisma migrate deploy
```

### Step 4: Verify Deployment

Run smoke tests:

```powershell
.\scripts\7-Post-Deployment-Smoke-Tests.ps1
```

Or manually check:

- **Health**: https://taxbridge-api-ker8.onrender.com/health
- **Liveness**: https://taxbridge-api-ker8.onrender.com/health/live
- **Readiness**: https://taxbridge-api-ker8.onrender.com/health/ready
- **API Docs**: https://taxbridge-api-ker8.onrender.com/docs

---

## Mock Mode Configuration

For testing without real credentials, enable mock modes:

```bash
DIGITAX_MOCK_MODE=true
REMITA_MOCK_MODE=true
PAYSTACK_MOCK_MODE=true
FLW_MOCK_MODE=true
YOUVERIFY_SANDBOX=true
```

**Note**: Mock mode is currently enabled in `render.yaml` for DigiTax and Remita.

---

## Production Readiness Checklist

- [ ] Database credentials configured (`DATABASE_URL`, `DIRECT_URL`)
- [ ] Security secrets generated and set
- [ ] Admin API keys configured
- [ ] Payment gateway credentials configured (at least one)
- [ ] DigiTax/FIRS credentials configured (or mock mode enabled)
- [ ] Youverify credentials configured (or sandbox mode enabled)
- [ ] Sentry DSN configured (optional but recommended)
- [ ] Database migrations applied
- [ ] Smoke tests passing
- [ ] `/health` endpoint returns `ok`
- [ ] `/health/ready` returns `200`

---

## Monitoring

### Real-time Monitoring

```powershell
.\scripts\6-Monitor-Production.ps1 -Continuous
```

### Key Metrics Endpoints

- **Metrics**: https://taxbridge-api-ker8.onrender.com/metrics
- **Prometheus Format**: https://taxbridge-api-ker8.onrender.com/metrics?format=prometheus
- **Integration Health**: https://taxbridge-api-ker8.onrender.com/health/integrations

---

## Troubleshooting

### Database Connection Issues

1. Verify `DATABASE_URL` format matches Supabase connection string
2. Ensure password is URL-encoded if it contains special characters
3. Check Supabase project is not paused
4. Verify IP allowlist in Supabase includes Render's IPs (or set to `0.0.0.0/0`)

### Redis Connection Issues

1. Verify `REDIS_URL` is set (auto-populated by Render Redis service)
2. Check Redis service is running in Render Dashboard
3. Review logs for connection errors

### Payment Gateway Issues

1. Verify API keys are for the correct environment (test vs live)
2. Check webhook URLs are registered with payment providers
3. Review payment provider dashboards for failed transactions

---

## Support

For issues or questions:
- **Documentation**: See `PRODUCTION_CHECKLIST.md` and `INCIDENT_RESPONSE.md`
- **Logs**: Render Dashboard → Service → Logs
- **Metrics**: https://taxbridge-api-ker8.onrender.com/metrics
