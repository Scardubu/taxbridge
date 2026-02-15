# 🚀 TAXBRIDGE PRODUCTION DEPLOYMENT RUNBOOK
## Step-by-Step Production Launch Guide

**Version**: 1.0.0  
**Last Updated**: February 15, 2026  
**Target Environment**: Production  
**Estimated Duration**: 2-3 hours

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Code & Tests
- [ ] All backend tests passing (423+ tests)
- [ ] Mobile app builds successfully on EAS
- [ ] Admin dashboard builds without errors
- [ ] No critical security vulnerabilities (`npm audit`)
- [ ] All Git branches merged to `main`
- [ ] Latest commit tagged with version (e.g., `v1.0.0`)

### 2. Environment Configuration
- [ ] Production `.env` file configured (see Environment Variables section)
- [ ] `ALLOWED_ORIGINS` set (NOT wildcard `*`)
- [ ] All API keys are **LIVE** keys (not test/sandbox)
- [ ] `YOUVERIFY_SANDBOX=false`
- [ ] `DIGITAX_MOCK_MODE=false`
- [ ] `PAYSTACK_SECRET_KEY` starts with `sk_live_`
- [ ] `FLW_SECRET_KEY` starts with `FLWSECK-` (live)
- [ ] Database connection strings point to production
- [ ] Redis URL points to production instance

### 3. Infrastructure
- [ ] Production database created and accessible
- [ ] Redis instance running and accessible
- [ ] SSL certificates valid and configured
- [ ] Domain DNS configured correctly
- [ ] CDN/static assets configured (if applicable)
- [ ] Backup system configured and tested

### 4. Monitoring & Alerts
- [ ] Sentry project created and DSN configured
- [ ] Uptime monitoring configured (UptimeRobot, etc.)
- [ ] Log aggregation configured (if using external service)
- [ ] Alert channels configured (email, Slack, etc.)
- [ ] On-call rotation established

---

## 🔧 DEPLOYMENT STEPS

### Phase 1: Database Setup (30 minutes)

#### 1.1 Backup Existing Data (if upgrading)
```bash
# If this is an upgrade from previous version
pg_dump -h <host> -U <user> -d <database> -F c -f taxbridge_backup_$(date +%Y%m%d_%H%M%S).dump
```

#### 1.2 Run Database Migrations
```bash
cd backend
npx prisma migrate deploy
```

**Expected Output**: All migrations applied successfully

#### 1.3 Verify Database Schema
```bash
npx prisma db pull
npx prisma generate
```

#### 1.4 Seed Initial Data (if fresh install)
```bash
npm run seed:production
```

**Verify**:
- [ ] All tables created
- [ ] Indexes created
- [ ] No migration errors in logs

---

### Phase 2: Backend Deployment (45 minutes)

#### 2.1 Install Dependencies
```bash
cd backend
npm ci --production
```

#### 2.2 Build Backend
```bash
npm run build
```

**Expected Output**: `dist/` folder created with compiled JavaScript

#### 2.3 Run Production Validation
```bash
# From repository root
pwsh scripts/validate-production-readiness.ps1
```

**Expected Output**: All checks pass (green ✓)

**If validation fails**:
- Fix all FAIL items immediately
- Address WARN items if using `-Strict` mode
- Re-run validation until all checks pass

#### 2.4 Start Backend Server
```bash
# Using PM2 (recommended)
pm2 start dist/server.js --name taxbridge-api --instances max --exec-mode cluster

# OR using systemd
sudo systemctl start taxbridge-backend

# OR direct (for testing)
NODE_ENV=production node dist/server.js
```

#### 2.5 Verify Backend Health
```bash
curl https://api.taxbridge.ng/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-15T...",
  "uptime": 123,
  "database": "connected",
  "redis": "connected",
  "queues": "healthy"
}
```

**Check All Health Endpoints**:
```bash
curl https://api.taxbridge.ng/health/db
curl https://api.taxbridge.ng/health/queues
curl https://api.taxbridge.ng/health/integrations
curl https://api.taxbridge.ng/api/v1/nrs/health
```

---

### Phase 3: Admin Dashboard Deployment (20 minutes)

#### 3.1 Build Admin Dashboard
```bash
cd admin-dashboard
npm ci
npm run build
```

**Expected Output**: `.next/` folder created with optimized build

#### 3.2 Deploy to Hosting Provider

**Option A: Vercel**
```bash
vercel --prod
```

**Option B: Netlify**
```bash
netlify deploy --prod --dir=.next
```

**Option C: Self-hosted (PM2)**
```bash
pm2 start npm --name taxbridge-admin -- start
```

#### 3.3 Verify Admin Dashboard
- [ ] Navigate to `https://admin.taxbridge.ng`
- [ ] Login with admin credentials
- [ ] Check dashboard loads correctly
- [ ] Verify API connectivity
- [ ] Test key admin functions

---

### Phase 4: Mobile App Deployment (60 minutes)

#### 4.1 Build Production APK/AAB (Android)
```bash
cd mobile
eas build --platform android --profile production
```

**Wait for build to complete** (~20-30 minutes)

**Expected Output**: Build URL and download link

#### 4.2 Build Production IPA (iOS)
```bash
eas build --platform ios --profile production
```

**Wait for build to complete** (~20-30 minutes)

#### 4.3 Submit to App Stores

**Google Play Store**:
```bash
eas submit --platform android --profile production
```

**Apple App Store**:
```bash
eas submit --platform ios --profile production
```

**Manual Submission**:
1. Download builds from EAS
2. Upload to respective stores via web console
3. Fill in app metadata, screenshots, descriptions
4. Submit for review

#### 4.4 Monitor Submission Status
- [ ] Android: Check Google Play Console
- [ ] iOS: Check App Store Connect
- [ ] Expected review time: 1-3 days (iOS), 1-2 hours (Android)

---

### Phase 5: Post-Deployment Verification (30 minutes)

#### 5.1 Smoke Tests

**Backend API**:
```bash
# Health check
curl https://api.taxbridge.ng/health

# Tax calculation
curl -X POST https://api.taxbridge.ng/api/v1/tax/calculate/pit \
  -H "Content-Type: application/json" \
  -d '{"grossIncome": 5000000, "reliefs": {"cra": true}}'

# Invoice creation (requires auth token)
curl -X POST https://api.taxbridge.ng/api/v1/invoices \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"customer": {...}, "items": [...]}'
```

**Admin Dashboard**:
- [ ] Login successful
- [ ] Dashboard metrics loading
- [ ] User management accessible
- [ ] Invoice list loads
- [ ] Payment list loads

**Mobile App** (TestFlight/Internal Testing):
- [ ] App launches successfully
- [ ] Login/registration works
- [ ] Create invoice flow works
- [ ] Tax calculator works
- [ ] OCR receipt scanning works
- [ ] Payment initialization works

#### 5.2 Integration Tests

**Payment Gateways**:
- [ ] Initialize test payment (Paystack)
- [ ] Initialize test payment (Flutterwave)
- [ ] Verify webhook delivery
- [ ] Check payment status updates

**NRS E-Invoicing**:
- [ ] Create invoice
- [ ] Submit to NRS (DigiTax)
- [ ] Verify IRN received
- [ ] Check QR code generated

**Business Verification**:
- [ ] Submit TIN for verification
- [ ] Check Youverify API response
- [ ] Verify status updates correctly

#### 5.3 Performance Checks
```bash
# API response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.taxbridge.ng/health

# Database query performance
psql -h <host> -U <user> -d <database> -c "EXPLAIN ANALYZE SELECT * FROM invoices LIMIT 100;"

# Redis latency
redis-cli --latency -h <redis-host>
```

**Expected Metrics**:
- API P95 response time: < 500ms
- Database query time: < 100ms
- Redis latency: < 10ms

---

## 🔍 MONITORING & VALIDATION

### First Hour Monitoring

**Check every 15 minutes**:
- [ ] Error rate < 1%
- [ ] API response time P95 < 500ms
- [ ] No 5xx errors in logs
- [ ] Database connections stable
- [ ] Redis connections stable
- [ ] Queue processing normal

**Sentry Dashboard**:
- [ ] No new critical errors
- [ ] Error rate within normal range
- [ ] Performance metrics acceptable

**Server Logs**:
```bash
# PM2 logs
pm2 logs taxbridge-api --lines 100

# System logs
journalctl -u taxbridge-backend -f

# Application logs
tail -f /var/log/taxbridge/app.log
```

### First 24 Hours Monitoring

**Business Metrics**:
- [ ] User registrations tracking
- [ ] Invoice creation rate
- [ ] Payment success rate
- [ ] Tax calculation requests
- [ ] NRS submission success rate

**System Metrics**:
- [ ] CPU usage < 70%
- [ ] Memory usage < 80%
- [ ] Disk usage < 80%
- [ ] Network bandwidth normal

**Integration Health**:
- [ ] Paystack webhook delivery rate
- [ ] Flutterwave webhook delivery rate
- [ ] DigiTax API success rate
- [ ] Youverify API success rate
- [ ] SMS delivery rate

---

## 🚨 ROLLBACK PROCEDURE

### When to Rollback

**Immediate Rollback Triggers**:
- Critical security vulnerability discovered
- Data corruption detected
- Error rate > 10%
- Payment processing failures > 5%
- NRS submission failures > 20%
- Database connection failures

### Rollback Steps

#### 1. Stop Current Deployment
```bash
# Stop backend
pm2 stop taxbridge-api
# OR
sudo systemctl stop taxbridge-backend
```

#### 2. Restore Previous Version
```bash
# Git rollback
git checkout <previous-stable-tag>

# Rebuild
cd backend
npm ci
npm run build

# Restart
pm2 start dist/server.js --name taxbridge-api
```

#### 3. Restore Database (if needed)
```bash
# Restore from backup
pg_restore -h <host> -U <user> -d <database> -c taxbridge_backup_YYYYMMDD_HHMMSS.dump
```

#### 4. Verify Rollback
```bash
curl https://api.taxbridge.ng/health
```

#### 5. Notify Stakeholders
- Send incident report
- Update status page
- Communicate timeline for fix

---

## 📊 SUCCESS CRITERIA

### Technical Metrics (First 48 Hours)

- [ ] **Uptime**: > 99.5%
- [ ] **API Response Time (P95)**: < 500ms
- [ ] **Error Rate**: < 1%
- [ ] **Payment Success Rate**: > 95%
- [ ] **NRS Submission Success**: > 90%
- [ ] **Database Query Time (P95)**: < 100ms
- [ ] **OCR Processing Time (P95)**: < 3s

### Business Metrics (First Week)

- [ ] **User Registrations**: Tracking and growing
- [ ] **Invoices Created**: > 100
- [ ] **Payments Processed**: > 50
- [ ] **Tax Calculations**: > 500
- [ ] **NRS Submissions**: > 80
- [ ] **User Retention (Day 1)**: > 60%

### Compliance Metrics

- [ ] **NRS Compliance Rate**: 100% (all invoices stamped)
- [ ] **Tax Accuracy**: 100% (verified against test cases)
- [ ] **Audit Log Coverage**: 100% (all sensitive operations logged)
- [ ] **Data Encryption**: 100% (TIN/BVN/NIN encrypted)

---

## 🔐 SECURITY CHECKLIST

### Pre-Launch Security Audit

- [ ] All secrets rotated (JWT, encryption keys)
- [ ] HTTPS enforced (no HTTP traffic)
- [ ] CORS configured (no wildcard in production)
- [ ] Rate limiting enabled
- [ ] SQL injection protection verified
- [ ] XSS protection verified
- [ ] CSRF protection enabled
- [ ] Security headers configured (Helmet.js)
- [ ] Input validation on all endpoints
- [ ] Authentication required on protected routes
- [ ] Authorization checks on all resources
- [ ] Sensitive data encrypted at rest
- [ ] Audit logging enabled
- [ ] Error messages sanitized (no stack traces to users)
- [ ] Dependencies scanned (`npm audit`)

---

## 📞 INCIDENT RESPONSE

### Severity Levels

**P0 - Critical** (Response: Immediate)
- System down
- Data breach
- Payment processing failure
- Database corruption

**P1 - High** (Response: < 1 hour)
- API error rate > 5%
- NRS submission failures
- Payment gateway issues
- Performance degradation

**P2 - Medium** (Response: < 4 hours)
- Minor bugs
- UI issues
- Non-critical feature failures

**P3 - Low** (Response: < 24 hours)
- Feature requests
- Cosmetic issues
- Documentation updates

### Escalation Path

1. **On-Call Engineer** → Investigate and attempt resolution
2. **Engineering Lead** → If unresolved after 30 minutes
3. **CTO** → If critical and unresolved after 1 hour
4. **CEO** → If business-critical and unresolved after 2 hours

### Communication Channels

- **Internal**: Slack #incidents channel
- **External**: Status page (status.taxbridge.ng)
- **Users**: Email notifications for critical issues

---

## 📝 POST-DEPLOYMENT TASKS

### Day 1
- [ ] Monitor error rates and performance
- [ ] Review Sentry errors
- [ ] Check payment gateway webhooks
- [ ] Verify NRS submissions
- [ ] Review user feedback

### Week 1
- [ ] Analyze user behavior patterns
- [ ] Review performance metrics
- [ ] Optimize slow queries
- [ ] Address user-reported issues
- [ ] Update documentation based on feedback

### Month 1
- [ ] Conduct security audit
- [ ] Review and optimize infrastructure costs
- [ ] Analyze business metrics
- [ ] Plan feature roadmap
- [ ] Conduct retrospective

---

## 🎯 ENVIRONMENT VARIABLES REFERENCE

### Critical (Required)

```bash
# Core
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/taxbridge
DIRECT_URL=postgresql://user:pass@host:5432/taxbridge?sslmode=require
REDIS_URL=redis://host:6379

# Security
JWT_SECRET=<64-char-hex>
ENCRYPTION_KEY=<64-char-hex>
TAX_ID_ENCRYPTION_KEY=<64-char-hex>
SESSION_SECRET=<random-string>
WEBHOOK_SECRET=<random-string>
ALLOWED_ORIGINS=https://taxbridge.ng,https://app.taxbridge.ng,https://admin.taxbridge.ng

# Payment Gateways
PAYSTACK_SECRET_KEY=sk_live_***
PAYSTACK_PUBLIC_KEY=pk_live_***
PAYSTACK_WEBHOOK_SECRET=***
FLW_SECRET_KEY=FLWSECK-***
FLW_PUBLIC_KEY=FLWPUBK-***
FLW_SECRET_HASH=***
FLW_ENCRYPTION_KEY=***
REMITA_MERCHANT_ID=***
REMITA_API_KEY=***
REMITA_SERVICE_TYPE_ID=***
REMITA_API_URL=https://login.remita.net

# Business Verification
YOUVERIFY_API_KEY=***
YOUVERIFY_BASE_URL=https://api.youverify.co
YOUVERIFY_SANDBOX=false

# FIRS/DigiTax
DIGITAX_API_KEY=***
DIGITAX_BASE_URL=https://api.digitax.ng
DIGITAX_HMAC_SECRET=***
DIGITAX_MOCK_MODE=false

# Monitoring
SENTRY_DSN=https://***@sentry.io/***
ENABLE_METRICS=true
LOG_LEVEL=info
```

### Optional (Recommended)

```bash
# SMS Providers
COMMS_PROVIDER=africastalking
AT_API_KEY=***
AT_USERNAME=***
AT_SHORTCODE=***

# Feature Flags
FEATURE_DEVICE_SYNC=true
ENABLE_DEADLINE_REMINDERS=true
ENABLE_OCR=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## ✅ FINAL GO/NO-GO DECISION

### GO Criteria (All Must Be Met)

- [x] All backend tests passing (423+ tests)
- [x] Production environment validated
- [x] CORS configured (no wildcard)
- [x] All API keys are LIVE (not sandbox)
- [x] Database migrations successful
- [x] Health endpoints returning 200 OK
- [x] Monitoring configured
- [x] Rollback plan documented
- [x] On-call rotation established
- [x] Stakeholders notified

### NO-GO Triggers (Any Present)

- [ ] Critical test failures
- [ ] Security vulnerabilities unresolved
- [ ] Database migration failures
- [ ] Missing required environment variables
- [ ] Health checks failing
- [ ] No rollback plan
- [ ] No monitoring configured

---

## 📚 ADDITIONAL RESOURCES

- **API Documentation**: https://api.taxbridge.ng/docs
- **Admin Dashboard**: https://admin.taxbridge.ng
- **Status Page**: https://status.taxbridge.ng
- **Support Email**: support@taxbridge.ng
- **Incident Response**: See `docs/INCIDENT_RESPONSE.md`
- **Architecture Docs**: See `docs/ARCHITECTURE.md`

---

**Deployment Lead**: _________________  
**Date**: _________________  
**Sign-off**: _________________

**Approved By**:
- [ ] Engineering Lead
- [ ] CTO
- [ ] Product Manager
- [ ] Security Lead

---

*This runbook should be updated after each deployment with lessons learned and process improvements.*
