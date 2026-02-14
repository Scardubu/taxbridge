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
- [ ] No `console.log` in production code
- [ ] No commented-out code blocks
- [ ] No hardcoded secrets or API keys
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
- [ ] CORS origins set correctly in `ALLOWED_ORIGINS`

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

- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Strict-Transport-Security` with `includeSubDomains`
- [ ] `Content-Security-Policy` configured
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`

### 16. Authentication & Authorization

- [ ] JWT tokens expire in 24h
- [ ] Rate limiting enabled in production
- [ ] Secrets validation passes at startup (`validateSecrets()`)
- [ ] No debug headers in production: `ALLOW_DEBUG_USER_ID_HEADER=false`

### 17. Data Protection

- [ ] TIN/BVN encrypted at rest (AES-256-GCM)
- [ ] No PII in analytics events
- [ ] NDPC compliance verified
- [ ] Audit logging enabled

---

## Post-Deployment Verification

### 18. Smoke Tests

Run: `.\scripts\7-Post-Deployment-Smoke-Tests.ps1`

- [ ] Backend liveness check passes
- [ ] Backend readiness check passes
- [ ] Full health check passes
- [ ] Metrics endpoint responds
- [ ] DigiTax integration healthy
- [ ] Remita integration healthy
- [ ] Admin console loads
- [ ] Admin favicon returns 200
- [ ] Security headers present
- [ ] Response times within targets (health < 500ms, liveness < 200ms)

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
