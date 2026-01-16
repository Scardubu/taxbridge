# TaxBridge Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying TaxBridge to production with the cost-optimized stack ($42-62/month base spend).

---

## Prerequisites

### Required Accounts & Credentials

1. **DigitalOcean Account** (or AWS for Lightsail alternative)
   - Personal access token
   - SSH key uploaded

2. **Render.com Account**
   - GitHub repository connected
   - Payment method on file

3. **Supabase Pro Account**
   - Project created
   - Database connection string

4. **DigiTax (APP) Production Credentials**
   - API URL (base)
   - API key
   - HMAC secret (if provided by your APP)

5. **Remita Merchant Account**
   - Merchant ID
   - API Key
   - Service Type ID
   - Webhook secret

6. **Domain & DNS**
   - `api.taxbridge.ng` → Render/Load Balancer
   - `ocr.taxbridge.ng` → DigitalOcean Droplet
   - `admin.taxbridge.ng` → Vercel
   - SSL certificates via Let's Encrypt

---

## Step 1: Infrastructure Provisioning with Terraform

### 1.1 Configure Terraform Variables

Create `infra/terraform/terraform.tfvars`:

```hcl
do_token             = "your-digitalocean-token"
ssh_key_id           = "your-ssh-key-id"
duplo_client_id      = "your-duplo-client-id"
duplo_client_secret  = "your-duplo-client-secret"
remita_merchant_id   = "your-remita-merchant-id"
remita_api_key       = "your-remita-api-key"

# Note: TaxBridge backend uses DigiTax env vars at runtime (see render.yaml).
# Terraform variables here are illustrative and should match your infra module.
```

### 1.2 Deploy Infrastructure

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply

# Note the output:
# ocr_service_ip       = "xxx.xxx.xxx.xxx"
# storage_endpoint     = "taxbridge-storage.lon1.digitaloceanspaces.com"
```

---

## Step 2: Backend Deployment on Render

### 2.1 Connect GitHub Repository

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Select `render.yaml` from the repository

### 2.2 Configure Environment Variables

In Render Dashboard, set these environment variables:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
REDIS_URL=redis://default:[PASSWORD]@[HOST]:6379
DIGITAX_API_URL=https://api.digitax.ng
DIGITAX_API_KEY=your_digitax_api_key
DIGITAX_HMAC_SECRET=your_digitax_hmac_secret_optional
DIGITAX_MOCK_MODE=false
REMITA_MERCHANT_ID=your_merchant_id
REMITA_API_KEY=your_production_api_key
REMITA_SERVICE_TYPE_ID=your_service_type_id
SESSION_SECRET=generate_random_64_char_hex
WEBHOOK_SECRET=generate_random_64_char_hex
ALLOWED_ORIGINS=https://taxbridge.ng,https://admin.taxbridge.ng
ENABLE_METRICS=true
NODE_ENV=production
```

### 2.3 Deploy

```bash
# Render automatically deploys from main branch
git push origin main

# Monitor deployment:
# https://dashboard.render.com/web/[service-id]
```

### 2.4 Verify Deployment

```bash
curl https://api.taxbridge.ng/health
# Expected: {"status":"ok","timestamp":"...","uptime":...}

curl https://api.taxbridge.ng/health/digitax
# Expected: {"status":"healthy","provider":"digitax",...}

curl https://api.taxbridge.ng/health/remita
# Expected: {"status":"healthy","provider":"remita",...}
```

---

## Step 3: Database Setup (Supabase)

### 3.1 Create Production Database

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create new project: `taxbridge-production`
3. Region: **Singapore** or **Ireland** (closest to Nigeria with good peering)
4. Plan: **Pro** ($25/month)

### 3.2 Configure Backups

```sql
-- Enable Point-in-Time Recovery (optional, $100/7 days)
-- Only enable when handling >50K invoices or critical transactions

-- For now, rely on nightly automated backups (included in Pro plan)
```

### 3.3 Run Migrations

```bash
# From backend directory
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

yarn prisma migrate deploy
yarn prisma generate

# Verify tables created
yarn prisma studio
```

---

## Step 4: Mobile App Deployment

### 4.1 Configure EAS Build

```bash
cd mobile

# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure project
eas build:configure
```

### 4.2 Build for iOS

```bash
# Production build
eas build --platform ios --profile production

# Wait for build to complete (~15-20 minutes)
# Download IPA when ready

# Submit to App Store
eas submit --platform ios --latest
```

### 4.3 Build for Android

```bash
# Production build
eas build --platform android --profile production

# Wait for build to complete (~15-20 minutes)
# Download AAB when ready

# Submit to Play Store
eas submit --platform android --latest
```

---

## Step 5: Admin Dashboard Deployment (Vercel)

### 5.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Root directory: `admin-dashboard`

### 5.2 Configure Environment Variables

```bash
NEXT_PUBLIC_APP_URL=https://admin.taxbridge.ng
BACKEND_URL=https://api.taxbridge.ng
ADMIN_API_KEY=[admin_key]
```

### 5.3 Deploy

```bash
# Vercel automatically deploys from main branch
git push origin main

# Access at: https://admin.taxbridge.ng
```

---

## Step 6: Monitoring Setup

### 6.1 Configure Uptime Robot

```bash
cd infra/monitoring

# Set API key
export UPTIMEROBOT_API_KEY="your-api-key"

# Create monitors
bash uptime-robot.sh
```

### 6.2 Configure Sentry (Optional)

```bash
# Add to .env.production
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
```

### 6.3 Set Up Slack Notifications

```bash
# Add to .env.production
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## Step 7: DNS Configuration

### 7.1 Add DNS Records

```
A     api.taxbridge.ng          → Render IP or Load Balancer IP
A     ocr.taxbridge.ng          → DigitalOcean Droplet IP (from Terraform output)
CNAME admin.taxbridge.ng        → cname.vercel-dns.com
CNAME www.taxbridge.ng          → cname.vercel-dns.com
TXT   _dmarc.taxbridge.ng       → "v=DMARC1; p=quarantine; rua=mailto:admin@taxbridge.ng"
```

### 7.2 Enable SSL

- **Render**: Automatic SSL via Let's Encrypt
- **Vercel**: Automatic SSL
- **DigitalOcean**: Configure via Terraform (included in `main.tf`)

---

## Step 8: Smoke Testing

### 8.1 Backend Health

```bash
# Health check
curl https://api.taxbridge.ng/health

# DigiTax connectivity
curl https://api.taxbridge.ng/health/digitax

# Remita connectivity
curl https://api.taxbridge.ng/health/remita

# Metrics
curl https://api.taxbridge.ng/metrics
```

### 8.2 Invoice Creation Flow

```bash
# Create test invoice
curl -X POST https://api.taxbridge.ng/api/v1/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Customer",
    "customerTIN": "1234567890",
    "items": [{
      "description": "Test Item",
      "quantity": 1,
      "unitPrice": 1000
    }]
  }'
```

### 8.3 Payment Flow

```bash
# Generate RRR (invoice must be NRS-stamped first)
curl -X POST https://api.taxbridge.ng/api/v1/payments/generate \
   -H "Content-Type: application/json" \
   -d '{
      "invoiceId": "<UUID>",
      "payerName": "Test User",
      "payerEmail": "test@example.com",
      "payerPhone": "08012345678"
   }'

# Check payment status by invoiceId
curl https://api.taxbridge.ng/api/v1/payments/<UUID>/status
```

---

## Step 9: Go Live Checklist

- [ ] All services healthy (API, OCR, Database, Redis)
- [ ] DigiTax connectivity working
- [ ] Remita RRR generation working
- [ ] Mobile app approved on App Store & Play Store
- [ ] Admin dashboard accessible
- [ ] Monitoring alerts configured
- [ ] Backup strategy verified
- [ ] NDPC DPIA approved
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Support email active: support@taxbridge.ng

---

## Rollback Procedure

If issues arise after deployment:

```bash
# Identify last known good version
git log --oneline

# Rollback backend
cd infra/scripts
bash rollback.sh <commit-hash>

# Rollback mobile app
eas update --branch production --message "Rollback to v1.0.0"

# Monitor logs
# Render: https://dashboard.render.com/logs
# Vercel: https://vercel.com/[project]/deployments
```

---

## Cost Monitoring

### Monthly Cost Breakdown

```
Render API:              $7
Render Worker:           $7
Render Redis:           $10
Supabase Pro:           $25
DigitalOcean Droplet:    $6
Vercel:                  $0 (free tier)
Expo EAS:                $0 (free tier)
Cloudflare R2:           $0 (within free tier)
Monitoring:              $0 (free tiers)
-----------------------------------
Total Base:           $55/month

+ DigiTax fees:       per APP agreement
+ Remita fees:        1-2% of transaction
```

### Cost Optimization Tips

1. **Database**: Start with Supabase Pro, add PITR only when needed
2. **OCR**: Switch to AWS Lightsail nano ($3.50) to save $2.50/month
3. **CDN**: Use Cloudflare R2 (10GB free) before paid storage
4. **Monitoring**: Leverage free tiers (Sentry 1K errors, Uptime Robot 50 monitors)

---

## Support & Maintenance

### Log Access

- **Backend**: `https://dashboard.render.com/web/[service-id]/logs`
- **Worker**: `https://dashboard.render.com/web/[service-id]/logs`
- **Admin**: `https://vercel.com/[project]/deployments`
- **OCR**: SSH into droplet: `ssh taxbridge@[IP]`, then `docker logs`

### Database Access

```bash
# Via Supabase Studio
https://supabase.com/dashboard/project/[project-id]/editor

# Via psql
psql $DATABASE_URL
```

### Redis Access

```bash
# Via Render dashboard
https://dashboard.render.com/redis/[redis-id]

# Via redis-cli
redis-cli -h [host] -p 6379 -a [password]
```

---

## Troubleshooting

### Issue: DigiTax health check failing

**Solution:**
1. Verify `DIGITAX_API_URL` and `DIGITAX_API_KEY` in Render environment variables
2. Check if the DigiTax base URL is reachable: `curl https://api.digitax.ng`
3. If you are in staging, confirm `DIGITAX_MOCK_MODE=true` for mock-only flows

### Issue: Remita RRR generation timeout

**Solution:**
1. Check Remita API status
2. Verify merchant credentials
3. Review SHA512 hash generation logic

### Issue: Mobile app not connecting to API

**Solution:**
1. Verify API URL in mobile app: `EXPO_PUBLIC_API_URL`
2. Check CORS configuration in backend
3. Ensure SSL certificate is valid

---

## Next Steps

1. Monitor error rates and latency via `/metrics` endpoint
2. Set up automated load testing with k6
3. Configure log aggregation (optional: Datadog, Logtail)
4. Implement automated backups for critical data
5. Schedule penetration testing before public launch

---

**Deployment Complete! 🎉**

Your TaxBridge instance is now live and ready to serve Nigerian SMEs with NRS-compliant e-invoicing.
