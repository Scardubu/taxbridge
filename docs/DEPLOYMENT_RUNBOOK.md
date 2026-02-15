# 🚀 TAXBRIDGE PRODUCTION DEPLOYMENT RUNBOOK
## Complete Launch Checklist & Emergency Procedures

**Last Updated**: February 2026  
**Version**: 1.0.0  
**Status**: Production Ready

---

## 📋 PRE-LAUNCH CHECKLIST

### 1. Code Quality & Testing (48 hours before launch)

#### Backend
- [ ] All 423 unit tests passing (`npm test` in `backend/`)
- [ ] Test coverage >80% on critical paths (tax engine, payment, NRS)
- [ ] No TypeScript errors (`npm run build`)
- [ ] ESLint warnings <10 (`npm run lint`)
- [ ] Security audit clean (`npm audit --audit-level=high`)
- [ ] Prisma migrations applied (`npx prisma db push`)

#### Mobile App
- [ ] All mobile tests passing (`npm test` in `mobile/`)
- [ ] Production build successful (`eas build --platform android --profile production-apk`)
- [ ] App bundle size <5MB (measure with performance-audit.js)
- [ ] Cold start <3s on test devices
- [ ] Offline mode fully functional
- [ ] OCR processing <2s average

#### Admin Dashboard
- [ ] All admin tests passing (`npm test` in `admin-dashboard/`)
- [ ] Production build successful (`npm run build`)
- [ ] Lighthouse score >90 (Performance, Accessibility, Best Practices)
- [ ] No console errors in production build

---

### 2. Environment Configuration (24 hours before launch)

#### Backend Environment Variables
```bash
# Core
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/taxbridge?sslmode=require
DIRECT_URL=postgresql://user:pass@host:5432/taxbridge?sslmode=require
REDIS_URL=redis://user:pass@host:6379

# Security
JWT_SECRET=[64-char hex - GENERATE NEW]
TAX_ID_ENCRYPTION_KEY=[64-char hex - GENERATE NEW]
ALLOWED_ORIGINS=https://taxbridge.vercel.app,https://www.taxbridge.ng

# Payment Gateways (LIVE KEYS)
PAYSTACK_SECRET_KEY=sk_live_[...]
PAYSTACK_PUBLIC_KEY=pk_live_[...]
PAYSTACK_WEBHOOK_SECRET=[...]
FLW_SECRET_KEY=FLWSECK-[...]
FLW_PUBLIC_KEY=FLWPUBK-[...]
FLW_SECRET_HASH=[...]
FLW_ENCRYPTION_KEY=[...]
REMITA_MERCHANT_ID=[...]
REMITA_API_KEY=[...]

# Verification Services (LIVE KEYS)
YOUVERIFY_API_KEY=[...]
YOUVERIFY_BASE_URL=https://api.youverify.co
YOUVERIFY_SANDBOX=false

# FIRS/DigiTax (PRODUCTION)
DIGITAX_API_KEY=[...]
DIGITAX_BASE_URL=https://api.digitax.ng
DIGITAX_HMAC_SECRET=[...]
DIGITAX_MOCK_MODE=false

# Monitoring
SENTRY_DSN=https://[...]@sentry.io/[...]
ENABLE_METRICS=true
```

**Verification Commands**:
```powershell
# Run validation script
.\scripts\validate-production-env.ps1 -EnvFile .env.production

# Expected output: "✅ All required environment variables are set"
```

#### Mobile Environment Variables
```bash
EXPO_PUBLIC_API_URL=https://taxbridge-api-ker8.onrender.com
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_SENTRY_DSN=https://[...]@sentry.io/[...]
EXPO_PUBLIC_MIXPANEL_TOKEN=[...] # Optional
NODE_ENV=production
```

#### Admin Dashboard Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://taxbridge-api-ker8.onrender.com
NEXTAUTH_SECRET=[64-char hex - GENERATE NEW]
NEXTAUTH_URL=https://taxbridge.vercel.app
NODE_ENV=production
```

---

### 3. Infrastructure Health Checks (12 hours before launch)

#### Database (Supabase)
- [ ] Connection pooler active (port 6543)
- [ ] Direct connection working (port 5432)
- [ ] Backup schedule confirmed (daily at 2 AM UTC)
- [ ] Storage usage <50% capacity
- [ ] All indexes created (check Prisma schema)
- [ ] Query performance baseline recorded

**Health Check Commands**:
```bash
# Test database connection
cd backend
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => console.log('✅ DB connected')).catch(e => console.error('❌', e));"
```

#### Redis (Upstash/Railway)
- [ ] Connection successful
- [ ] Memory usage <50%
- [ ] Eviction policy: `allkeys-lru`
- [ ] Persistence: AOF enabled
- [ ] Max connections: 10000

**Health Check Commands**:
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
# Expected: PONG
```

#### Render (Backend Hosting)
- [ ] Service plan: Starter ($7/mo) or higher
- [ ] Auto-deploy enabled on `master` branch
- [ ] Health check path: `/health`
- [ ] Environment variables imported from `.env.production`
- [ ] Custom domain configured (optional)

**Dashboard**: https://dashboard.render.com

#### Vercel (Admin Dashboard)
- [ ] Production deployment linked to `master` branch
- [ ] Environment variables configured
- [ ] Custom domain configured (optional)
- [ ] Automatic HTTPS enabled
- [ ] Edge functions enabled (if using Next.js API routes)

**Dashboard**: https://vercel.com/dashboard

---

### 4. Integration Testing (6 hours before launch)

#### Payment Gateway Testing
```bash
# Test Paystack webhook signature verification
curl -X POST https://taxbridge-api-ker8.onrender.com/api/v1/payments/webhook/paystack \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: [test signature]" \
  -d '{"event":"charge.success","data":{"reference":"TEST-123"}}'

# Expected: 200 OK or 401 Invalid signature (not 500)
```

#### NRS E-Invoicing Testing
```bash
# Submit test invoice to DigiTax sandbox
curl -X POST https://taxbridge-api-ker8.onrender.com/api/v1/invoices/:id/stamp \
  -H "Authorization: Bearer [test token]"

# Expected: 200 OK with IRN or 400 with validation errors
```

#### OCR Testing
```bash
# Test OCR endpoint with sample receipt
curl -X POST https://taxbridge-api-ker8.onrender.com/api/v1/ocr/extract \
  -H "Authorization: Bearer [test token]" \
  -F "image=@test-receipt.jpg"

# Expected: 200 OK with extracted fields (amount, date, vendor)
```

---

### 5. Monitoring Setup (4 hours before launch)

#### Sentry Configuration
- [ ] Backend DSN configured
- [ ] Mobile DSN configured
- [ ] Admin DSN configured
- [ ] Alert rules configured:
  - Error rate >1% → Email + Slack
  - Critical errors (payment failures) → Immediate page
- [ ] Sampling rate: 10% for transactions (to reduce quota usage)

**Test Sentry**:
```bash
# Trigger test error
curl -X GET https://taxbridge-api-ker8.onrender.com/sentry-test
# Check Sentry dashboard for error
```

#### UptimeRobot Configuration
- [ ] Backend health check: https://taxbridge-api-ker8.onrender.com/health (every 5 min)
- [ ] Admin dashboard: https://taxbridge.vercel.app (every 5 min)
- [ ] Alert contacts: Email + SMS for critical downtime

**Free Tier Limits**: 50 monitors, 5-minute intervals

#### Log Aggregation
- [ ] Backend logs: Winston to file (`logs/combined.log`)
- [ ] Rotation: Daily, keep 14 days
- [ ] Log level: `info` (not `debug` in production)
- [ ] Sensitive data redacted (TIN, passwords, API keys)

---

### 6. Security Hardening (2 hours before launch)

#### Rate Limiting
- [ ] API: 100 req/min per IP
- [ ] Auth: 5 failed attempts/15 min → 30 min block
- [ ] Webhook: 50 req/min per endpoint
- [ ] USSD: 10 req/min per phone number

**Test Rate Limiting**:
```bash
# Rapid-fire requests to trigger rate limit
for i in {1..110}; do curl https://taxbridge-api-ker8.onrender.com/health; done
# Expected: First 100 succeed, remaining get 429 Too Many Requests
```

#### CORS Configuration
- [ ] `ALLOWED_ORIGINS` set to production domains only (NO wildcard `*`)
- [ ] Credentials enabled for specific origins
- [ ] Preflight requests handled correctly

**Test CORS**:
```bash
curl -H "Origin: https://taxbridge.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS https://taxbridge-api-ker8.onrender.com/api/v1/invoices

# Expected: 200 OK with Access-Control-Allow-Origin header
```

#### Security Headers
- [ ] Helmet.js enabled
- [ ] CSP configured (no `unsafe-inline` scripts)
- [ ] HSTS enabled (1 year max-age)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff

---

## 🚀 DEPLOYMENT SEQUENCE

### T-60 minutes: Final Code Freeze

1. **Merge Final PRs**
   ```bash
   git checkout master
   git pull origin master
   git log --oneline -10  # Review recent commits
   ```

2. **Create Release Tag**
   ```bash
   git tag -a v1.0.0 -m "Production launch - February 2026"
   git push origin v1.0.0
   ```

3. **Lock Dependency Versions**
   ```bash
   # Backend
   cd backend && npm ci

   # Mobile
   cd ../mobile && npm ci

   # Admin
   cd ../admin-dashboard && npm ci
   ```

---

### T-30 minutes: Backend Deployment

1. **Push to Render**
   ```bash
   git push origin master
   # Render auto-deploys via webhook
   ```

2. **Monitor Deployment**
   - Watch build logs: https://dashboard.render.com/web/[service-id]
   - Wait for "Live" status (3-5 minutes)

3. **Verify Health**
   ```bash
   curl https://taxbridge-api-ker8.onrender.com/health
   # Expected: {"status":"ok","uptime":123,"database":"connected","redis":"connected"}
   ```

4. **Run Smoke Tests**
   ```powershell
   .\scripts\smoke-tests.ps1 -ApiUrl "https://taxbridge-api-ker8.onrender.com" -Verbose
   ```

---

### T-20 minutes: Admin Dashboard Deployment

1. **Push to Vercel**
   ```bash
   git push origin master
   # Vercel auto-deploys via GitHub integration
   ```

2. **Monitor Deployment**
   - Watch build logs: https://vercel.com/dashboard
   - Wait for "Ready" status (2-3 minutes)

3. **Verify Deployment**
   ```bash
   curl https://taxbridge.vercel.app
   # Expected: 200 OK with HTML content
   ```

---

### T-10 minutes: Mobile App Release

1. **Build Production APK/AAB**
   ```bash
   cd mobile
   eas build --platform android --profile production --no-wait
   ```

2. **Upload to Google Play Console**
   - Login: https://play.google.com/console
   - Navigate to: **Release > Production > Create new release**
   - Upload: `taxbridge-1.0.0.aab`
   - Release notes:
     ```
     🎉 TaxBridge v1.0.0 - Official Launch
     
     ✅ NTA 2025 compliant tax calculations
     ✅ Offline-first invoice creation
     ✅ NRS e-invoicing integration
     ✅ OCR receipt scanning
     ✅ Multi-gateway payments (Paystack, Flutterwave, Remita)
     
     Built for Nigerian SMEs 🇳🇬
     ```
   - Click: **Save** → **Review release** → **Start rollout to Production**

3. **Staged Rollout** (Recommended)
   - Day 1: 10% of users (1,000 users if 10k installs expected)
   - Day 3: 50% of users (monitor crash-free rate)
   - Day 7: 100% of users (if crash-free rate >99.5%)

---

### T-0: Go Live! 🎉

1. **Final Smoke Test**
   ```bash
   # Test critical user journey
   # 1. Register business
   # 2. Create invoice
   # 3. Submit to NRS
   # 4. Process payment
   ```

2. **Enable Monitoring Alerts**
   - Sentry: Enable all alert rules
   - UptimeRobot: Enable SMS alerts for critical downtime

3. **Announce Launch**
   - Update website: "Now Live"
   - Social media: Launch announcement
   - Email list: "TaxBridge is here!"

---

## 🔥 EMERGENCY PROCEDURES

### Scenario 1: Backend API Down

**Symptoms**: Health check returns 500 or times out

**Immediate Actions** (< 5 minutes):
1. Check Render dashboard: https://dashboard.render.com
2. Review recent deploy logs for errors
3. Check Sentry for error spikes
4. Verify database connection:
   ```bash
   # From Render shell
   node -e "const { PrismaClient } = require('@prisma/client'); new PrismaClient().\$connect()"
   ```

**Resolution**:
- If database issue: Check Supabase dashboard, restart connection pooler
- If Redis issue: Check Upstash dashboard, restart Redis instance
- If code issue: Rollback to previous deployment
  ```bash
  # In Render dashboard
  Manual Deploy > Select previous commit > Deploy
  ```

**Recovery Time Objective (RTO)**: <15 minutes

---

### Scenario 2: Payment Gateway Webhook Failures

**Symptoms**: Payments marked as "pending" in Paystack/Flutterwave but not confirmed in TaxBridge

**Immediate Actions** (< 10 minutes):
1. Check webhook signature verification logs
2. Verify webhook URL is accessible:
   ```bash
   curl https://taxbridge-api-ker8.onrender.com/api/v1/payments/webhook/paystack
   # Should NOT return 404
   ```
3. Check Paystack/Flutterwave dashboard for webhook delivery failures

**Resolution**:
- If webhook URL incorrect: Update in payment gateway dashboard
- If signature mismatch: Verify `PAYSTACK_WEBHOOK_SECRET` matches gateway dashboard
- If webhook endpoint down: Check backend logs, restart service if needed

**Manual Payment Confirmation**:
```bash
# Manually verify payment via API
curl https://taxbridge-api-ker8.onrender.com/api/v1/payments/verify/REFERENCE \
  -H "Authorization: Bearer [admin token]"
```

---

### Scenario 3: NRS Submission Failures

**Symptoms**: Invoices stuck in "pending" status, no IRN received

**Immediate Actions** (< 10 minutes):
1. Check DigiTax API status: https://status.digitax.ng (hypothetical)
2. Review NRS submission logs in backend
3. Check FIRS dashboard for failed submissions

**Resolution**:
- If DigiTax API down: Wait for service restoration, queue will auto-retry
- If authentication error: Verify `DIGITAX_API_KEY` is valid
- If validation error: Check invoice UBL XML format

**Manual Resubmission**:
```bash
# Retry failed submission
curl -X POST https://taxbridge-api-ker8.onrender.com/api/v1/invoices/:id/stamp \
  -H "Authorization: Bearer [token]"
```

---

### Scenario 4: Database Connection Pool Exhausted

**Symptoms**: 500 errors with "Too many connections" message

**Immediate Actions** (< 5 minutes):
1. Check Supabase connection count:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'taxbridge';
   ```
2. Kill idle connections:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
   WHERE datname = 'taxbridge' AND state = 'idle' AND query_start < now() - interval '10 minutes';
   ```

**Resolution**:
- Increase connection pool size in Prisma:
  ```typescript
  // backend/src/config/database.ts
  connection_limit: 20  // Increase from 10
  ```
- Restart backend service to apply changes

---

### Scenario 5: Mobile App Crash Rate Spike

**Symptoms**: Crash-free rate drops below 99% in Google Play Console

**Immediate Actions** (< 30 minutes):
1. Check Sentry for crash reports
2. Identify affected Android versions/devices
3. Review recent mobile releases

**Resolution**:
- If critical crash: Halt rollout in Play Console
- If device-specific: Add device compatibility filters
- If code bug: Prepare hotfix release

**Emergency Hotfix Process**:
1. Fix bug in codebase
2. Increment version: `1.0.0` → `1.0.1`
3. Build: `eas build --platform android --profile production`
4. Upload to Play Console as emergency update
5. Submit for expedited review (typically approved in 2-4 hours)

---

## 📊 POST-LAUNCH MONITORING (First 48 Hours)

### Hour 1: Critical Monitoring
- [ ] Backend health check: Every 5 minutes
- [ ] Error rate <1% (check Sentry)
- [ ] API response time P95 <500ms
- [ ] No critical errors logged

### Hour 6: User Activity Check
- [ ] User registrations: Track via `/api/v1/auth/register` logs
- [ ] Invoice creations: Track via `/api/v1/invoices` logs
- [ ] Payment processing: Check payment gateway dashboards
- [ ] NRS submissions: Check DigiTax dashboard

### Hour 24: Performance Review
- [ ] Database query performance (check slow query log)
- [ ] Redis hit rate >80%
- [ ] Sync queue size <100 items
- [ ] OCR processing time P95 <3s

### Hour 48: Stability Assessment
- [ ] Crash-free rate >99.5%
- [ ] API uptime >99.9%
- [ ] No payment failures
- [ ] No critical bugs reported

---

## 📞 ESCALATION CONTACTS

### P0 - Critical (System Down)
- **Response Time**: Immediate
- **Contact**: [Technical Lead Phone]
- **Backup**: [DevOps Engineer Phone]

### P1 - High (Degraded Service)
- **Response Time**: <1 hour
- **Contact**: [On-Call Engineer Email]
- **Backup**: [Technical Lead Email]

### P2 - Medium (Minor Issues)
- **Response Time**: <4 hours
- **Contact**: [Support Team Email]

### External Services Support
- **Render**: support@render.com
- **Vercel**: support@vercel.com
- **Supabase**: support@supabase.com
- **Paystack**: support@paystack.com
- **Flutterwave**: support@flutterwave.com

---

## ✅ POST-DEPLOYMENT CHECKLIST

### Immediate (Within 1 hour)
- [ ] All smoke tests passing
- [ ] No critical errors in Sentry
- [ ] Monitoring alerts configured
- [ ] Team notified of successful launch

### Short-term (Within 24 hours)
- [ ] User feedback channel monitored
- [ ] Performance metrics reviewed
- [ ] First 10 invoices manually reviewed for correctness
- [ ] First 5 payments verified

### Mid-term (Within 7 days)
- [ ] User onboarding completion rate measured
- [ ] Mobile app crash-free rate reviewed
- [ ] Database performance optimized (indexes added if needed)
- [ ] Customer support tickets triaged

---

## 📖 ROLLBACK PROCEDURES

### Backend Rollback (If deployment fails)
1. **Identify previous stable commit**
   ```bash
   git log --oneline -20
   ```

2. **Rollback in Render**
   - Dashboard > Service > Manual Deploy
   - Select previous commit hash
   - Click "Deploy"

3. **Verify rollback**
   ```bash
   curl https://taxbridge-api-ker8.onrender.com/health
   ```

### Mobile App Rollback (If critical crash discovered)
1. **Halt rollout in Google Play Console**
   - Release > Production > Halt rollout
   - Affects only un-updated users

2. **Prepare emergency hotfix**
   - Fix crash in codebase
   - Build new version: `1.0.1`
   - Upload to Play Console

3. **Cannot rollback existing installs** (Android limitation)
   - Users must update to hotfix version
   - Expedite review process

---

## 📝 LAUNCH DAY CHECKLIST

**Time**: Launch Day - 8:00 AM  
**Duration**: 8-10 hours

| Time | Task | Owner | Status |
|------|------|-------|--------|
| 08:00 | Code freeze | Tech Lead | ⏳ |
| 08:30 | Run all tests | QA | ⏳ |
| 09:00 | Verify environment variables | DevOps | ⏳ |
| 09:30 | Database backup | DevOps | ⏳ |
| 10:00 | Deploy backend | DevOps | ⏳ |
| 10:15 | Deploy admin dashboard | DevOps | ⏳ |
| 10:30 | Run smoke tests | QA | ⏳ |
| 11:00 | Upload mobile app to Play Console | Mobile Dev | ⏳ |
| 11:30 | Configure monitoring alerts | DevOps | ⏳ |
| 12:00 | **GO LIVE** | Team | ⏳ |
| 12:00-18:00 | Active monitoring (every 30 min) | On-Call | ⏳ |
| 18:00 | Post-launch review meeting | Team | ⏳ |

---

## 🎯 SUCCESS CRITERIA

Launch is considered successful if:
- ✅ Backend API uptime >99.5% (first 24 hours)
- ✅ Mobile app crash-free rate >99.5%
- ✅ Zero payment processing failures
- ✅ NRS submission success rate >95%
- ✅ Error rate <1%
- ✅ No P0/P1 incidents

---

**Document Maintained By**: DevOps Team  
**Review Frequency**: Quarterly or after major incidents  
**Next Review Date**: May 2026
