# TaxBridge Production Deployment Checklist

**Target**: Zero-Defect Production Launch
**Date**: _______________
**Release Version**: _______________
**Deployment Lead**: _______________

---

## Pre-Deployment

### 1. Code Quality

- [ ] All unit tests passing (`cd backend && node ../node_modules/jest/bin/jest.js --forceExit`)
- [ ] Code coverage > 80%
- [ ] ESLint shows 0 errors (warnings acceptable)
- [x] No `console.log` in production code (replaced with structured logger in queue/client, performOCR, payment adapters)
- [ ] No commented-out code blocks
- [x] No hardcoded secrets or API keys (audited — all use env vars)
- [ ] TypeScript strict mode — no `any` in new code

### 2. Environment Configuration

- [ ] Backend `.env` populated from `.env.production.example`
- [ ] Mobile `.env.production` populated from `mobile/.env.production.example`
- [ ] Admin dashboard `.env.production` populated from `admin-dashboard/.env.production.example`
- [ ] All secrets generated with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] JWT_SECRET set (min 32 chars)
- [ ] ENCRYPTION_KEY set (64 hex chars)
- [ ] No `.env` files committed to git

### 3. Database

- [ ] Prisma migrations applied: `cd backend && npx prisma migrate deploy`
- [ ] Prisma client generated: `npx prisma generate`
- [ ] Database connection pooling configured (pgbouncer for Supabase)
- [ ] Slow query threshold set: `PRISMA_SLOW_QUERY_MS=500`
- [ ] Database backup verified

### 4. Infrastructure

- [ ] Render.com service configured and healthy
- [ ] Redis instance provisioned and connected
- [ ] Vercel admin dashboard deployed
- [ ] SSL/TLS certificates valid
- [ ] DNS records configured
- [x] CORS origins set correctly in `ALLOWED_ORIGINS` (wildcard warning in production, explicit methods/headers, preflight cache)

---

## Integration Verification

### 5. Payment Gateways

- [ ] Flutterwave credentials configured (FLW_PUBLIC_KEY, FLW_SECRET_KEY, FLW_ENCRYPTION_KEY)
- [ ] Paystack credentials configured (PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY)
- [ ] Primary gateway set: `PRIMARY_PAYMENT_GATEWAY=flutterwave`
- [ ] Fallback gateway set: `FALLBACK_PAYMENT_GATEWAY=paystack`
- [ ] Webhook endpoints registered with payment providers
- [ ] Mock mode disabled: `FLW_MOCK_MODE=false`, `PAYSTACK_MOCK_MODE=false`

### 6. Tax & Compliance

- [ ] DigiTax/FIRS API credentials configured
- [ ] DigiTax mock mode disabled: `DIGITAX_MOCK_MODE=false`
- [ ] Remita credentials configured
- [ ] Remita mock mode disabled: `REMITA_MOCK_MODE=false`
- [ ] NTA 2025 tax rules verified (PIT 0-25%, VAT 7.5%, CIT 3-tier)
- [ ] UBL XSD path set: `UBL_XSD_PATH=lib/ubl-invoice-2.1.xsd`

### 7. Business Verification

- [ ] Youverify API key configured
- [ ] Youverify sandbox disabled: `YOUVERIFY_SANDBOX=false`
- [ ] TIN/BVN/CAC verification endpoints tested

### 8. Communications

- [ ] SMS provider configured (Africa's Talking / Infobip / Termii)
- [ ] SMS webhook signature verification enabled: `REQUIRE_SMS_SIGNATURE=1`
- [ ] USSD service registered

---

## Mobile App

### 9. Crash Protection

- [x] ErrorBoundary wraps entire app with Sentry reporting + error ID tracking
- [x] SplashScreen has boot timeout (10s safety) with parallel warm-up tasks
- [x] WelcomeStep has double-tap prevention + async error handling
- [x] OnboardingScreen has step validation + error recovery
- [x] Global error handler set via `ErrorUtils.setGlobalHandler`
- [x] Unhandled promise rejection handler configured

### 10. Mobile Build

- [ ] `app.json` version bumped
- [ ] Kotlin version is KSP-compatible (2.x, matching expo-updates): currently `2.1.20`
  - Must be set in BOTH `mobile/app.json` expo-build-properties AND `mobile/android/build.gradle` ext.kotlinVersion
  - Both values must match to prevent KSP version conflicts
- [ ] `eas.json` production profile configured
- [ ] EAS build triggered: `.\scripts\8-Build-Mobile-App.ps1 -Profile production`
- [ ] APK/AAB tested on physical device
- [ ] Google Play Internal Testing track uploaded
- [ ] App signing configured

### 11. Offline Capability

- [ ] SQLite database initializes correctly
- [ ] Sync queue processes pending operations on reconnect
- [ ] Offline invoice creation works
- [ ] Offline expense tracking works
- [ ] Data persists across app restarts

---

## Monitoring & Observability

### 12. Error Tracking

- [ ] Sentry DSN configured for backend
- [ ] Sentry initialized in mobile app (`initSentry()` in App.tsx)
- [ ] Error boundary reports to Sentry with error IDs
- [ ] Source maps uploaded for production builds

### 13. Metrics & Health

- [ ] `/health` endpoint returns `ok`
- [ ] `/health/live` liveness probe configured
- [ ] `/health/ready` readiness probe configured
- [ ] `/metrics` endpoint returns server stats
- [ ] Prometheus-compatible metrics available (`?format=prometheus`)
- [ ] DLQ monitoring enabled: `ENABLE_DLQ_MONITORING=true`
- [ ] Pool monitoring enabled: `ENABLE_POOL_MONITORING=true`

### 14. Alerting

- [ ] Uptime monitoring configured (UptimeRobot or equivalent)
- [ ] Slack webhook configured for alerts (optional)
- [ ] Incident response playbook reviewed (`docs/INCIDENT_RESPONSE.md`)

---

## Security

### 15. Security Headers

- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `X-XSS-Protection: 1; mode=block`
- [x] `Strict-Transport-Security` with `includeSubDomains`
- [x] `Content-Security-Policy` configured
- [x] `Referrer-Policy: strict-origin-when-cross-origin`

### 16. Authentication & Authorization

- [x] JWT tokens expire in 24h
- [x] Rate limiting enabled in production (Redis-backed, 5 rate limit tiers)
- [x] Secrets validation passes at startup (`validateSecrets()` + `logSecretsSummary()`)
- [x] No debug headers in production: `ALLOW_DEBUG_USER_ID_HEADER=false` (default)

### 17. Data Protection

- [ ] TIN/BVN encrypted at rest (AES-256-GCM)
- [ ] No PII in analytics events
- [ ] NDPC compliance verified
- [ ] Audit logging enabled

---

## Post-Deployment Verification

### 18. Smoke Tests

Run: `.\scripts\7-Post-Deployment-Smoke-Tests.ps1`

- [x] Backend liveness check passes
- [x] Backend readiness check passes
- [x] Full health check passes
- [x] Metrics endpoint responds
- [x] DigiTax integration healthy
- [x] Remita integration healthy
- [x] Admin console loads
- [x] Admin favicon returns 200
- [x] Security headers present (all 6 headers verified on backend + admin dashboard)
- [x] Response times within targets (health < 500ms, liveness < 200ms)

### 19. Monitoring Dashboard

Run: `.\scripts\6-Monitor-Production.ps1 -Continuous`

- [ ] All components show "healthy"
- [ ] Database latency < 100ms
- [ ] Redis latency < 50ms
- [ ] Error rate < 1%
- [ ] Memory usage stable

---

## KPI Targets

| Metric | Target | Status |
|--------|--------|--------|
| Crash-free rate | > 99.9% | ☐ |
| Onboarding completion | > 60% | ☐ |
| Offline sync success | > 95% | ☐ |
| API p95 latency | < 500ms | ☐ |
| WCAG 2.1 AA compliance | 100% | ☐ |
| Test pass rate | 100% | ☐ |
| Code coverage | > 80% | ☐ |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| QA Lead | | | |
| Product Owner | | | |
| DevOps | | | |

---

## Rollback Plan

If critical issues are detected post-deployment:

1. **Backend**: Revert to previous Render deploy via dashboard
2. **Admin**: Revert Vercel deployment to previous production
3. **Mobile**: Cannot rollback — push hotfix via EAS Update (OTA)
4. **Database**: Restore from latest backup (< 1 hour RPO)

See `docs/INCIDENT_RESPONSE.md` for full incident response procedures.

---

## 🚨 Emergency Contacts

**Critical Issues (P1 - Production Down)**

| Role | Name | Phone | Email | Availability |
|------|------|-------|-------|--------------|
| Technical Lead | [Name] | +234-XXX-XXX-XXXX | tech-lead@taxbridge.ng | 24/7 |
| DevOps Engineer | [Name] | +234-XXX-XXX-XXXX | devops@taxbridge.ng | 24/7 |
| Backend Lead | [Name] | +234-XXX-XXX-XXXX | backend@taxbridge.ng | 24/7 |
| Mobile Lead | [Name] | +234-XXX-XXX-XXXX | mobile@taxbridge.ng | On-call |

**Business Contacts**

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Product Owner | [Name] | +234-XXX-XXX-XXXX | product@taxbridge.ng |
| CTO | [Name] | +234-XXX-XXX-XXXX | cto@taxbridge.ng |
| Customer Support | [Name] | +234-XXX-XXX-XXXX | support@taxbridge.ng |

**Vendor Contacts**

| Service | Contact | Support URL |
|---------|---------|-------------|
| Render.com | support@render.com | https://render.com/support |
| Vercel | support@vercel.com | https://vercel.com/support |
| Supabase | support@supabase.io | https://supabase.com/support |
| Paystack | support@paystack.com | https://paystack.com/support |
| Flutterwave | support@flutterwave.com | https://flutterwave.com/support |

---

## 📅 Post-Launch Monitoring Schedule

### Day 1-3 (Critical Period)
- **Monitoring Frequency**: Every 4 hours
- **On-Call**: 24/7 rotation
- **Focus Areas**:
  - Crash-free rate (target: >99.9%)
  - API error rate (target: <1%)
  - Database connection pool utilization
  - Payment gateway success rate
  - User onboarding completion rate

**Actions**:
- Run smoke tests every 4 hours: `.\scripts\7-Post-Deployment-Smoke-Tests.ps1`
- Check Sentry for new error patterns
- Monitor user feedback channels (WhatsApp, email)
- Review server logs for anomalies

### Day 4-7 (Stabilization)
- **Monitoring Frequency**: Twice daily (9 AM, 6 PM WAT)
- **On-Call**: Business hours + evening check
- **Focus Areas**:
  - User retention (D1, D3, D7)
  - Feature adoption rates
  - Sync success rate
  - Payment conversion rate

**Actions**:
- Daily metrics review meeting (15 min)
- Address any P2/P3 bugs
- Gather user feedback
- Optimize slow queries

### Week 2 (Optimization)
- **Monitoring Frequency**: Daily (9 AM WAT)
- **On-Call**: Business hours
- **Focus Areas**:
  - Performance optimization opportunities
  - Cost optimization (API calls, database queries)
  - User experience improvements

**Actions**:
- Weekly retrospective meeting
- Plan feature iterations based on feedback
- Review and optimize infrastructure costs

### Week 3+ (Steady State)
- **Monitoring Frequency**: Weekly + automated alerts
- **On-Call**: Rotating schedule
- **Focus Areas**:
  - Long-term KPIs
  - Feature requests prioritization
  - Technical debt management

**Actions**:
- Weekly metrics dashboard review
- Monthly infrastructure health check
- Quarterly security audit

---

## 📊 7-Day Success Metrics Tracking

| Metric | Target | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Day 6 | Day 7 | Status |
|--------|--------|-------|-------|-------|-------|-------|-------|-------|--------|
| Crash-free rate | >99.9% | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |
| API uptime | >99.5% | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |
| Onboarding completion | >60% | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |
| Invoice creation rate | >50% | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |
| Sync success rate | >95% | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |
| User retention (D1) | >70% | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |
| Payment success rate | >95% | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |
| Avg session duration | >5 min | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |
| API p95 latency | <500ms | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |
| Support tickets | <10/day | _____ | _____ | _____ | _____ | _____ | _____ | _____ | ☐ |

**Notes Section:**
```
Day 1: _______________________________________________________________
Day 2: _______________________________________________________________
Day 3: _______________________________________________________________
Day 4: _______________________________________________________________
Day 5: _______________________________________________________________
Day 6: _______________________________________________________________
Day 7: _______________________________________________________________
```

---

## ⚖️ Legal & Compliance

### Data Protection (NDPC Compliance)
- [ ] Privacy Policy published and accessible
- [ ] Terms of Service published and accessible
- [ ] User consent mechanism for data collection implemented
- [ ] Data retention policy documented (max 7 years for tax records)
- [ ] Right to erasure (GDPR-style) mechanism implemented
- [ ] Data breach notification procedure documented
- [ ] Data Processing Agreement (DPA) with vendors signed

### Nigerian Tax Compliance
- [ ] FIRS integration approved and documented
- [ ] NRS e-invoicing compliance verified
- [ ] Tax calculation accuracy certified by tax consultant
- [ ] VAT rate (7.5%) correctly implemented
- [ ] CIT 3-tier system (0%/20%/30%) correctly implemented
- [ ] WHT rates verified against FIRS guidelines
- [ ] Tax remittance procedures documented

### Financial Regulations
- [ ] Payment gateway agreements signed (Paystack, Flutterwave)
- [ ] PCI DSS compliance verified (no card data stored)
- [ ] Anti-money laundering (AML) checks implemented
- [ ] Know Your Customer (KYC) verification via Youverify
- [ ] Transaction limits documented and enforced

### Intellectual Property
- [ ] TaxBridge trademark registration filed
- [ ] Open source licenses compliance verified
- [ ] Third-party API terms of service reviewed
- [ ] Code ownership and contributor agreements signed

### Insurance & Liability
- [ ] Professional indemnity insurance obtained
- [ ] Cyber liability insurance obtained
- [ ] Limitation of liability clause in Terms of Service
- [ ] Service Level Agreement (SLA) defined

---

## Version Pins (for regression prevention)

| Component | Version | Notes |
|-----------|---------|-------|
| Expo SDK | ~54.0.32 | mobile/package.json |
| React Native | 0.81.5 | mobile/package.json |
| Kotlin | 2.1.20 | mobile/app.json expo-build-properties |
| Node.js | 20.x | root package.json engines |
| compileSdkVersion | 35 | mobile/app.json |
| targetSdkVersion | 35 | mobile/app.json |
| minSdkVersion | 24 | mobile/app.json |
