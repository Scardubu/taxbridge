# TaxBridge Deployment Quick-Start Guide

## 🚀 Production Deployment in 30 Minutes

This guide walks you through deploying TaxBridge to production after obtaining necessary credentials.

---

## 2026 Cost-Optimized Reference Stack

| Layer | Platform | Monthly Cost (USD) | Notes |
|-------|----------|--------------------|-------|
| Backend API & Queue Worker | Render Starter (2×) | 14 | Auto-scale triggers at 70% CPU; blueprint in [render.yaml](render.yaml#L1)
| Database | Supabase Pro | 25 | Includes 14-day backups; enable PITR (+100) once invoice volume >50K |
| Redis Cache | Render Redis Starter | 10 | `allkeys-lru` eviction; provisioned in [render.yaml](render.yaml#L58-L65) |
| OCR Microservice | DigitalOcean Droplet s-1vcpu-1gb | 6 | Terraform-managed in [infra/terraform/main.tf](infra/terraform/main.tf#L1) downloads Peppol BIS 3.0 XSD; swap to AWS Lightsail nano ($3.50) by uncommenting provider block |
| Admin Dashboard | Vercel Free | 0 | 1M edge requests/mo |
| Mobile Delivery | Expo EAS Free | 0 | 15 builds/mo, 1K OTA MAUs |
| Storage & CDN | Cloudflare R2 (10 GB free) or DO Spaces | 0‑5 | Backups provisioned via [digitalocean_spaces_bucket](infra/terraform/main.tf#L78-L89) |
| Monitoring & Alerts | Sentry Free + Uptime Robot Free | 0 | Health automation script [infra/monitoring/uptime-robot.sh](infra/monitoring/uptime-robot.sh#L1) covers API/OCR/Duplo/Remita |

> **Estimated base spend:** $42‑$62/month before Duplo (₦20‑50/invoice) and Remita (1‑2% transaction) fees. All tiers sized for 10K active users with burst headroom.

### Deployment Artifacts Added in January 2026

- **Docker Runtime:** [infra/docker-compose.prod.yml](infra/docker-compose.prod.yml#L1) orchestrates API, worker, Redis, OCR, and hardened Nginx with `/health`, `/health/digitax`, `/health/remita` probes (legacy `/health/duplo` alias supported).
- **Reverse Proxy:** [infra/nginx/nginx.conf](infra/nginx/nginx.conf#L1) enforces TLS 1.2+, Duplo/Remita webhook routing, and per-endpoint rate limits for low-bandwidth markets.
- **Infrastructure as Code:** [infra/terraform/main.tf](infra/terraform/main.tf#L1) + [templates/user_data.sh.tmpl](infra/terraform/templates/user_data.sh.tmpl#L1) bootstrap the DigitalOcean OCR droplet (with Peppol BIS 3.0 XSD download) and Spaces bucket while documenting the AWS Lightsail alternative.
- **Render Blueprint:** [render.yaml](render.yaml#L1) pins build/run commands, injects Duplo/Remita secrets, and downloads the UBL XSD during deploys.
- **Automation Scripts:** deploy ([infra/scripts/deploy.sh](infra/scripts/deploy.sh#L1)), rollback ([infra/scripts/rollback.sh](infra/scripts/rollback.sh#L1)), and uptime monitors ([infra/monitoring/uptime-robot.sh](infra/monitoring/uptime-robot.sh#L1)).
- **Operational Checklist:** [infra/DEPLOYMENT_CHECKLIST.md](infra/DEPLOYMENT_CHECKLIST.md#L1) covers compliance (NDPC DPIA, 55 mandatory UBL fields, webhook idempotency) before go-live.

Use this stack as the canonical baseline before following the legacy quick-start sequence below.

---

## Prerequisites Checklist

### Required Accounts
- [ ] AWS/Azure/DigitalOcean account
- [ ] Domain registered (e.g., taxbridge.ng)
- [ ] Remita merchant account (**₦10K-20K one-time fee**)
- [ ] Duplo/DigiTax production credentials
- [ ] GitHub account (for CI/CD)
- [ ] App Store Connect account (iOS deployment)
- [ ] Google Play Console account (Android deployment)

### Required Tools
```bash
# Install required CLI tools
npm install -g expo-cli
npm install -g pm2         # Process manager
npm install -g @prisma/cli # Database migrations

# Verify installations
node --version  # Should be 18+
npm --version
expo --version
pm2 --version
prisma --version
```

---

## Step 1: Backend Deployment (15 minutes)

### 1.1 Provision Infrastructure

**Option A: Render (Recommended for MVP)**
```bash
# 1. Create account at render.com
# 2. Create New Web Service
# 3. Connect GitHub repository
# 4. Configure:
#    - Name: taxbridge-api
#    - Environment: Node
#    - Build Command: cd backend && npm install && npm run build
#    - Start Command: cd backend && npm run start:prod
#    - Plan: Starter ($7/month)
```

**Option B: AWS EC2**
```bash
# Launch Ubuntu 22.04 instance (t3.small)
ssh ubuntu@your-server-ip

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone repository
git clone https://github.com/your-org/taxbridge.git
cd taxbridge/backend
npm install
npm run build
```

### 1.2 Configure Database

**Option A: Supabase (Free tier)**
```bash
# 1. Create account at supabase.com
# 2. Create new project
# 3. Copy connection string
# 4. Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

**Option B: Managed PostgreSQL**
```bash
# AWS RDS, Azure Database, or DigitalOcean Managed Database
# Minimum: db.t3.micro (2GB RAM)
# Enable automated backups
# Enable encryption at rest
```

### 1.3 Configure Redis

**Option A: Upstash (Free tier)**
```bash
# 1. Create account at upstash.com
# 2. Create Redis database
# 3. Copy connection string
# Format: redis://default:[PASSWORD]@[HOST]:6379
```

### 1.4 Set Environment Variables

Create `.env.production`:
```bash
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/taxbridge_prod

# Redis
REDIS_URL=redis://default:pass@host:6379

# DigiTax/Duplo (Production)
DUPLO_CLIENT_ID=your_production_client_id
DUPLO_CLIENT_SECRET=your_production_secret
DUPLO_API_URL=https://api.duplo.ng

# Remita (Production)
REMITA_MERCHANT_ID=your_merchant_id
REMITA_API_KEY=your_production_api_key
REMITA_SERVICE_TYPE_ID=your_service_type_id
REMITA_API_URL=https://login.remita.net

# Security
SESSION_SECRET=generate_32_char_random_string
WEBHOOK_SECRET=generate_32_char_random_string
```

**Generate secrets**:
```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1.5 Run Database Migrations

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate:deploy

# Verify connection
npm run prisma:studio  # Open in browser
```

### 1.6 Start Backend Server

**Using PM2 (EC2)**:
```bash
cd backend

# Start with PM2
pm2 start npm --name "taxbridge-api" -- run start:prod

# Configure auto-restart on reboot
pm2 startup
pm2 save

# Monitor logs
pm2 logs taxbridge-api
pm2 monit
```

**Using Render**:
- Deployment happens automatically on git push
- Monitor logs in Render dashboard

### 1.7 Verify Backend Health

```bash
# Check health endpoint
curl https://api.taxbridge.ng/health

# Expected response:
# {"status":"ok","timestamp":"2026-01-10T...","uptime":123.45}

# Test Duplo connection
curl -X POST https://api.taxbridge.ng/api/v1/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Customer",
    "items": [{
      "description": "Test Item",
      "quantity": 1,
      "unitPrice": 100
    }]
  }'
```

---

## Step 2: SSL Certificate Setup (5 minutes)

### Option A: Let's Encrypt (Free)

**Using Certbot**:
```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d api.taxbridge.ng

# Certificate files will be at:
# /etc/letsencrypt/live/api.taxbridge.ng/fullchain.pem
# /etc/letsencrypt/live/api.taxbridge.ng/privkey.pem

# Auto-renewal (runs twice daily)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

**Update Fastify server** (`backend/src/server.ts`):
```typescript
import fs from 'fs';
import path from 'path';

const server = fastify({
  logger: true,
  https: process.env.NODE_ENV === 'production' ? {
    key: fs.readFileSync('/etc/letsencrypt/live/api.taxbridge.ng/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/api.taxbridge.ng/fullchain.pem')
  } : undefined
});
```

### Option B: CloudFlare (Recommended)

```bash
# 1. Add domain to CloudFlare
# 2. Update nameservers at registrar
# 3. Enable Full (Strict) SSL
# 4. Enable Always Use HTTPS
# 5. Enable Automatic HTTPS Rewrites
# 6. CloudFlare will handle SSL termination
```

---

## Step 3: Mobile App Deployment (10 minutes)

### 3.1 Configure Production API URL

**Update `mobile/src/services/api.ts`**:
```typescript
export async function getApiBaseUrl(): Promise<string> {
  try {
    const customUrl = await AsyncStorage.getItem(API_BASE_URL_KEY);
    if (customUrl) {
      return customUrl;
    }
  } catch (error) {
    console.warn('Failed to load custom API URL:', error);
  }
  
  // Production API URL
  return 'https://api.taxbridge.ng';
}
```

### 3.2 Build for iOS

```bash
cd mobile

# Configure app.json
# Update version, bundleIdentifier, etc.

# Build for production
expo build:ios \
  --release-channel production \
  --type archive

# Wait for build to complete (10-15 minutes)
# Download IPA file when ready
```

**Upload to App Store Connect**:
1. Open [App Store Connect](https://appstoreconnect.apple.com)
2. Create new app
3. Upload IPA using Transporter app
4. Fill in app metadata (screenshots, description, keywords)
5. Submit for review
6. Wait for approval (1-3 days typically)

### 3.3 Build for Android

```bash
cd mobile

# Build AAB (Android App Bundle)
expo build:android \
  --release-channel production \
  --type app-bundle

# Wait for build to complete (10-15 minutes)
# Download AAB file when ready
```

**Upload to Google Play Console**:
1. Open [Google Play Console](https://play.google.com/console)
2. Create new app
3. Upload AAB to Internal Testing track
4. Test with internal testers (optional)
5. Promote to Production track
6. Fill in store listing (screenshots, description)
7. Submit for review
8. Wait for approval (1-2 days typically)

---

## Step 4: Monitoring Setup (5 minutes)

### 4.1 Error Tracking with Sentry

```bash
# Install Sentry
cd backend
npm install @sentry/node @sentry/tracing

# Configure in server.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'your_sentry_dsn',
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
});

# Add error handler
app.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error);
  reply.status(500).send({ error: 'Internal Server Error' });
});
```

### 4.2 Performance Monitoring

**Backend logs**:
```bash
# View PM2 logs
pm2 logs taxbridge-api

# Or use Render logs dashboard
# Or configure CloudWatch (AWS)
```

**Health checks**:
```bash
# Add to crontab for uptime monitoring
*/5 * * * * curl -f https://api.taxbridge.ng/health || mail -s "API Down" admin@taxbridge.ng
```

### 4.3 Database Monitoring

**Supabase Dashboard**:
- Monitor query performance
- Check connection pool usage
- Review slow queries

**Custom monitoring**:
```bash
# Add to backend
app.get('/metrics', async (req, reply) => {
  const dbStatus = await prisma.$queryRaw`SELECT 1`;
  const redisStatus = await redis.ping();
  
  return {
    database: dbStatus ? 'ok' : 'error',
    redis: redisStatus === 'PONG' ? 'ok' : 'error',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
});
```

---

## Step 5: Production Verification (5 minutes)

### 5.1 Smoke Tests

```bash
# Run from local machine
cd backend

# Test health endpoint
curl https://api.taxbridge.ng/health

# Test invoice creation
curl -X POST https://api.taxbridge.ng/api/v1/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Production Test",
    "items": [{
      "description": "Test Item",
      "quantity": 1,
      "unitPrice": 100
    }]
  }'

# Test payment generation
curl -X POST https://api.taxbridge.ng/api/v1/payments/generate \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "invoice-id-from-above",
    "payerName": "Test Payer",
    "payerEmail": "test@example.com",
    "payerPhone": "08012345678"
  }'
```

### 5.2 Mobile App Tests

```bash
# Download from App Store/Play Store
# Or use TestFlight (iOS) / Internal Testing (Android)

1. Open app
2. Create invoice
3. Verify invoice appears in list
4. Tap "Pay Tax"
5. Generate RRR
6. Verify payment URL opens
7. Check payment status
```

### 5.3 Load Testing

```bash
# Run load test against production
cd backend

BASE_URL=https://api.taxbridge.ng k6 run load-test/k6-script.js

# Verify metrics:
# - p95 response time < 300ms
# - Error rate < 10%
# - Duplo submission < 2s
# - Remita RRR generation < 3s
```

---

## 🎯 Post-Deployment Checklist

### Day 1
- [ ] Verify all API endpoints responding
- [ ] Check database connections stable
- [ ] Verify webhook endpoints working
- [ ] Monitor error rates (should be <1%)
- [ ] Test payment flow end-to-end
- [ ] Verify mobile apps accessible

### Week 1
- [ ] Monitor performance metrics daily
- [ ] Review error logs and fix issues
- [ ] Gather user feedback
- [ ] Tune performance based on usage
- [ ] Check resource utilization
- [ ] Verify backup systems working

### Month 1
- [ ] Review scaling requirements
- [ ] Analyze usage patterns
- [ ] Plan feature improvements
- [ ] Review security audit
- [ ] Optimize database queries
- [ ] Update documentation

---

## 🆘 Troubleshooting Common Issues

### Backend won't start
```bash
# Check logs
pm2 logs taxbridge-api

# Common issues:
# 1. Database connection failed
#    - Verify DATABASE_URL in .env
#    - Check firewall allows connections
#    - Verify credentials are correct

# 2. Redis connection failed
#    - Verify REDIS_URL in .env
#    - Check Redis server is running

# 3. Port already in use
#    - Change PORT in .env
#    - Kill existing process: sudo lsof -ti:3000 | xargs kill -9
```

### Mobile app can't connect to API
```bash
# 1. Verify API URL is correct
#    - Should be https://api.taxbridge.ng
#    - Not http:// or localhost

# 2. Check CORS settings in backend
#    - Add mobile app domain to whitelist

# 3. Verify SSL certificate is valid
#    - curl https://api.taxbridge.ng/health
#    - Should not show SSL errors
```

### Payment generation fails
```bash
# 1. Verify Remita credentials
#    - Check REMITA_MERCHANT_ID, REMITA_API_KEY
#    - Test with Remita sandbox first

# 2. Check invoice status
#    - Invoice must be "stamped" before payment
#    - Verify Duplo stamping completed

# 3. Check logs for error details
#    - pm2 logs taxbridge-api
#    - Look for Remita API errors
```

### Webhook not receiving callbacks
```bash
# 1. Verify webhook URL is accessible
#    - Must be HTTPS
#    - Must be publicly accessible
#    - Test: curl -X POST https://api.taxbridge.ng/webhooks/remita/payment

# 2. Check webhook signature verification
#    - Verify REMITA_API_KEY matches production key
#    - Check logs for signature validation errors

# 3. Test webhook locally
#    - Use ngrok to expose local server
#    - Test with Remita sandbox
```

---

## 📞 Support Resources

### Documentation
- [TaxBridge Testing Guide](./docs/TESTING_QUALITY_ASSURANCE.md)
- [Remita Implementation](./REMITA_IMPLEMENTATION.md)
- [UBL Validation Guide](./backend/docs/ubl/peppol-bis-billing-3.0-validation.md)

### External Resources
- [Remita API Documentation](https://www.remita.net/developers/)
- [Duplo API Documentation](https://docs.duplo.ng/)
- [Expo Deployment Guide](https://docs.expo.dev/distribution/introduction/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)

### Emergency Contacts
- Backend Issues: Check server logs first
- Payment Issues: Contact Remita support
- NRS Issues: Contact Duplo support
- App Store Issues: Check App Store Connect

---

## 🏆 Success Criteria

Your deployment is successful when:

✅ All health checks passing
✅ API response times < 300ms (p95)
✅ Zero critical errors in logs
✅ Mobile apps approved and published
✅ Payment flow working end-to-end
✅ Users can create invoices offline
✅ Invoice stamping completes in <2s
✅ Payment generation completes in <3s
✅ Webhook callbacks processing correctly
✅ Database backups running daily
✅ Monitoring and alerts configured

---

**TaxBridge Deployment Quick-Start Guide v1.0.0**
**Estimated Total Time**: 30-45 minutes (excluding app review times)
**Last Updated**: January 10, 2026
