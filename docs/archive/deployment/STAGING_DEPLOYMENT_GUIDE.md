# TaxBridge Staging Deployment Guide

**Environment:** Staging  
**Purpose:** Pre-production testing with real integrations (sandbox mode)  
**Target:** Internal team + 5 pilot ambassadors

---

## Prerequisites

1. ✅ All 136 mobile tests passing
2. ✅ Backend tests passing
3. ✅ Pre-launch checks complete (48/50 passing, 2 warnings OK)
4. ✅ Environment variables configured (.env.staging)
5. ✅ Database migrations applied
6. ✅ Redis queues initialized

---

## Deployment Steps

### 1. Backend Deployment (Render.com)

TaxBridge staging is deployed via a **Render Blueprint** to avoid config drift.

**CRITICAL:** Create the services via **Blueprints → New Blueprint Instance** using `render.staging.yaml`.
Creating a Render service manually ("New Web Service") can ignore the blueprint and cause build failures.

**Blueprint:** `render.staging.yaml` (repo root)
**Expected runtime:** Node.js 20.19.4 (via `NODE_VERSION`)

**Secrets (set in Render Dashboard for keys marked `sync: false`):**
- `DATABASE_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY`, `SESSION_SECRET`
- `WEBHOOK_SECRET`, `REMITA_WEBHOOK_SECRET`

**After the deploy shows “Live”:**

1) Run migrations (Render Shell recommended)
```bash
yarn workspace @taxbridge/backend prisma:migrate:deploy
```

2) Validate health (from your local machine)
```powershell
node backend/scripts/validate-health.js https://taxbridge-api-staging.onrender.com
```

---

### 2. Admin Dashboard Deployment (Vercel)

```bash
# Navigate to admin dashboard
cd admin-dashboard

# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to Vercel (staging)
vercel --prod --env staging

# Verify deployment
curl https://admin-staging.taxbridge.ng

# Test LaunchMetricsWidget
open https://admin-staging.taxbridge.ng/dashboard
```

**Vercel Configuration:**
- Project: `taxbridge-admin-staging`
- Framework: Next.js 15.x
- Build Command: `npm run build`
- Output Directory: `.next`
- Environment Variables: Copy from `.env.staging.example`

---

### 3. Mobile App Deployment (Expo EAS)

```bash
# Ensure monorepo deps are installed (run from repo root)
yarn install --frozen-lockfile

# Navigate to mobile directory
cd mobile

# Update app.json for staging
# Change appIdentifier to: ng.taxbridge.staging

# Build for Android (staging)
eas build --platform android --profile staging

# Build for iOS (staging)
eas build --platform ios --profile staging

# Publish OTA update (for testing)
eas update --branch staging --message "Staging deployment"
```

**EAS Build Configuration (eas.json):**
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "staging": {
      "env": {
        "APP_ENV": "staging",
        "API_URL": "https://api-staging.taxbridge.ng"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      }
    },
    "production": {
      "env": {
        "APP_ENV": "production",
        "API_URL": "https://api.taxbridge.ng"
      }
    }
  },
  "submit": {
    "staging": {
      "android": {
        "track": "internal"
      },
      "ios": {
        "appleTeamId": "TEAM_ID",
        "ascAppId": "APP_ID"
      }
    }
  }
}
```

---

### 4. Database Setup (Supabase Staging)

```bash
# Connect to staging database
psql $DATABASE_URL

# Verify tables exist
\dt

# Expected tables:
# - users
# - invoices
# - payments
# - audit_logs
# - sync_queue
# - alerts
# - etc.

# Check indexes
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';

# Verify sample data (optional)
SELECT COUNT(*) FROM users;
```

---

### 5. Redis Setup (Upstash Staging)

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
# Expected: PONG

# Check queue initialization
redis-cli -u $REDIS_URL KEYS "bull:*"

# Expected queues:
# - bull:invoice-sync:wait
# - bull:email-campaign:wait
# - bull:sms-campaign:wait

# Monitor queue depth
redis-cli -u $REDIS_URL LLEN "bull:invoice-sync:wait"
```

---

### 6. Integration Tests (Sandbox Mode)

#### DigiTax (e-Invoicing)
```bash
curl -X POST https://api-staging.taxbridge.ng/api/invoices/submit \
  -H "Authorization: Bearer $STAGING_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "test-invoice-001",
    "amount": 10000,
    "customerName": "Test Customer"
  }'

# Expected: 200 OK with CSID/IRN
```

#### Remita (Payments)
```bash
curl -X POST https://api-staging.taxbridge.ng/api/v1/payments/generate \
  -H "Authorization: Bearer $STAGING_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "<UUID>",
    "payerName": "Test User",
    "payerEmail": "test@example.com",
    "payerPhone": "08012345678"
  }'

# Expected: 200 OK with RRR
```

#### Africa's Talking (SMS)
```bash
curl -X POST https://api-staging.taxbridge.ng/api/notifications/sms \
  -H "Authorization: Bearer $STAGING_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+2348012345678",
    "message": "Test SMS from TaxBridge Staging"
  }'

# Expected: 200 OK with delivery status
```

---

### 7. Smoke Tests (End-to-End)

#### Test 1: User Registration
```bash
curl -X POST https://api-staging.taxbridge.ng/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@staging.taxbridge.ng",
    "phone": "+2348012345678",
    "password": "Test1234!"
  }'

# Expected: 201 Created with JWT token
```

#### Test 2: Create Invoice
```bash
curl -X POST https://api-staging.taxbridge.ng/api/v1/invoices \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Customer",
    "items": [{"description": "Test Item", "quantity": 1, "unitPrice": 5000}],
    "totalAmount": 5000
  }'

# Expected: 201 Created with invoice ID
```

#### Test 3: Generate Payment (RRR)
```bash
curl -X POST https://api-staging.taxbridge.ng/api/v1/payments/generate \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "invoice-id-from-step-2",
    "payerName": "Test User",
    "payerEmail": "test@example.com",
    "payerPhone": "08012345678"
  }'

# Expected: 200 OK with RRR
```

#### Test 4: Check Launch Metrics
```bash
curl https://api-staging.taxbridge.ng/api/admin/launch-metrics \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

# Expected: JSON with NRR, GRR, MRR
```

---

### 8. Monitoring Setup

#### Sentry (Error Tracking)
1. Navigate to https://sentry.io/taxbridge
2. Verify "staging" environment active
3. Send test error:
```bash
curl -X POST https://api-staging.taxbridge.ng/api/_test/error \
  -H "Authorization: Bearer $JWT_TOKEN"
```
4. Check Sentry dashboard for error event

#### Mixpanel (Analytics)
1. Navigate to https://mixpanel.com/taxbridge
2. Filter by environment: staging
3. Send test event:
```bash
curl -X POST https://api-staging.taxbridge.ng/api/_test/analytics \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"event": "test_event", "properties": {"env": "staging"}}'
```
4. Check Mixpanel live view

#### Grafana (Metrics)
1. Navigate to https://grafana.taxbridge.ng
2. Select "Staging" data source
3. View dashboards:
   - System Health
   - API Performance
   - Queue Metrics
   - Business Metrics (NRR/GRR)

---

### 9. Load Testing (Optional)

```bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io

# Run load test
cd backend/load-test
k6 run k6-script.js --env ENV=staging

# Expected:
# - P95 latency < 500ms
# - Error rate < 1%
# - Throughput > 100 req/s
```

---

### 10. Pilot User Onboarding

#### Invite 5 Pilot Ambassadors

**Ambassadors:**
1. Iyabo Adeyemi (Lagos – Yaba Market)
2. Chidi Okafor (Onitsha – Trader)
3. Amina Bello (Kano – Freelancer)
4. Tunde Alabi (Ibadan – SMB Owner)
5. Fatima Abubakar (Abuja – SMEDAN Liaison)

**Onboarding Steps:**
1. Create accounts manually in staging database
2. Send WhatsApp invites with staging app link
3. Schedule 1:1 onboarding calls (30 mins each)
4. Provide staging credentials + test data
5. Monitor usage for 7 days
6. Collect feedback via Google Forms

**Feedback Questions:**
- Did the app work offline?
- Were invoices synced correctly?
- Did SMS notifications arrive?
- Was the tax onboarding tutorial helpful?
- Any bugs or errors encountered?
- NPS: How likely are you to recommend TaxBridge? (0-10)

---

## Success Criteria (Staging Gate)

| Metric | Target | Status |
|--------|--------|--------|
| Backend uptime | 99%+ | ⏳ |
| Mobile app crash-free rate | 99%+ | ⏳ |
| Invoice sync success | 95%+ | ⏳ |
| Payment RRR generation | 100% | ⏳ |
| SMS delivery rate | 95%+ | ⏳ |
| NRS submission success | 90%+ (sandbox) | ⏳ |
| Pilot user satisfaction | NPS ≥7 | ⏳ |
| Critical bugs | 0 | ⏳ |

**Gate Decision:** If all criteria met → Proceed to Phase 1 Production Launch

---

## Rollback Procedure

### If Staging Deployment Fails:

1. **Backend Rollback:**
```bash
# Render.com Dashboard → Rollback to previous deployment
# OR via CLI:
render rollback taxbridge-api-staging --version previous
```

2. **Admin Dashboard Rollback:**
```bash
# Vercel Dashboard → Rollback to previous deployment
# OR via CLI:
vercel rollback taxbridge-admin-staging
```

3. **Mobile App Rollback:**
```bash
# Rollback OTA update
eas update rollback --branch staging
```

4. **Database Rollback:**
```bash
# Restore from backup (if migrations failed)
npm run migrate:rollback
```

---

## Post-Deployment Checklist

- [ ] Backend health check passes
- [ ] Admin dashboard accessible
- [ ] Mobile app installs successfully
- [ ] Database migrations applied
- [ ] Redis queues initialized
- [ ] Sentry receiving errors
- [ ] Mixpanel receiving events
- [ ] LaunchMetricsWidget displaying data
- [ ] Email campaigns triggering
- [ ] SMS notifications working
- [ ] 5 pilot ambassadors onboarded
- [ ] WhatsApp support group created
- [ ] Feedback form published

---

## Next Steps

After staging validation (7 days):
1. Review pilot ambassador feedback
2. Fix any P1/P2 bugs
3. Update documentation
4. Prepare production deployment
5. Schedule Phase 1 launch (100 users)

**Staging Environment URL:** https://staging.taxbridge.ng  
**Admin Dashboard:** https://admin-staging.taxbridge.ng  
**API:** https://api-staging.taxbridge.ng

**Team Contact:** staging@taxbridge.ng
