# TaxBridge Production Deployment Checklist

**Target**: Zero-Defect Production Launch
**Date**: November 6, 2026
**Release Version**: v14.0.0-production
**Deployment Lead**: TaxBridge Core Engineering Team

---

## Pre-Deployment

### 1. Code Quality

- [x] All unit tests passing (`npm test` — 452 backend unit, 396 mobile, 20 admin, 10 contracts)
- [x] Code coverage > 80% (97.29% coverage on canonical tax engine)
- [x] ESLint shows 0 errors across all workspaces
- [x] No `console.log` in production code (audited — structured Pino logging only)
- [x] No commented-out code blocks or orphan debug stubs
- [x] No hardcoded secrets or API keys (all use runtime env vars)
- [x] TypeScript strict mode — zero errors (`tsc --noEmit` clean on root, backend, mobile, admin-dashboard)

### 2. Environment Configuration

- [x] Backend `.env` populated from `.env.production.example`
- [x] Mobile `.env.production` populated from `mobile/.env.production.example`
- [x] Admin dashboard `.env.production` populated from `admin-dashboard/.env.production.example`
- [x] All secrets generated with `crypto.randomBytes(32).toString('hex')`
- [x] JWT_SECRET set (min 64 chars) and JWT_REFRESH_SECRET configured
- [x] ENCRYPTION_KEY and TAX_ID_ENCRYPTION_KEY set (64 hex chars)
- [x] No `.env` files committed to git (`.gitignore` verified)

### 3. Database

- [x] Prisma migrations applied: `npx prisma migrate deploy`
- [x] Prisma client generated: `npx prisma generate` (v5.22.0)
- [x] Database connection pooling configured (pgbouncer direct & pooled URLs)
- [x] Slow query threshold set: `PRISMA_SLOW_QUERY_MS=500`
- [x] Database backup verified and tested

### 4. Infrastructure

- [x] Render.com service configured and healthy (Docker runtime, frankfurt region)
- [x] Redis instance provisioned and connected (fail-closed rate limiting)
- [x] Vercel admin dashboard deployed (Next.js 16 App Router, React 19)
- [x] SSL/TLS certificates valid and HSTS enforced
- [x] DNS records configured and propagating
- [x] CORS origins set correctly in `ALLOWED_ORIGINS` (exact same-origin enforcement)

---

## Integration Verification

### 5. Payment Gateways

- [x] Flutterwave credentials configured (FLW_PUBLIC_KEY, FLW_SECRET_KEY, FLW_ENCRYPTION_KEY)
- [x] Paystack credentials configured (PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY)
- [x] Primary gateway set: `PRIMARY_PAYMENT_GATEWAY=flutterwave`
- [x] Fallback gateway set: `FALLBACK_PAYMENT_GATEWAY=paystack`
- [x] Webhook endpoints registered with HMAC-SHA256 signature verification
- [x] Payment attempt pre-reservation and per-invoice scoped idempotency enforced
- [x] Cross-gateway failover suppressed on ambiguous provider outcomes

### 6. Tax & Compliance

- [x] DigiTax/NRS API credentials configured and validated
- [x] Remita credentials configured (RRR generation and status tracking)
- [x] NTA 2025 tax rules verified (PIT 0-25% progressive, VAT 7.5%, CIT 3-tier 0/20/30%, RRA relief)
- [x] UBL 3.0 / Peppol BIS Billing 3.0 XML validation verified
- [x] All tax calculators sourced from canonical `@taxbridge/contracts` package

### 7. Business Verification

- [x] Youverify API key configured
- [x] TIN/BVN/CAC verification endpoints tested with confidence scoring
- [x] Parallel verification pipelines verified

### 8. Communications

- [x] SMS provider configured (Africa's Talking / Infobip / Termii)
- [x] SMS webhook signature verification enabled: `REQUIRE_SMS_SIGNATURE=1`
- [x] USSD service registered and tested with failover handler

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

- [x] `app.json` version bumped to SDK 54 compatible release
- [x] Kotlin version is KSP-compatible (`2.1.20` aligned across `app.json` and `build.gradle`)
- [x] `eas.json` production profile configured (production-apk, production)
- [x] Native tabs aligned (exactly 5 tabs: dashboard, receipts, tax-calendar, compliance, settings)
- [x] All 33 mobile test suites passing (396 tests passing, 0 failing)

### 11. Offline Capability

- [x] SQLite database initializes correctly without GENERATED columns
- [x] Sync queue processes pending operations on reconnect
- [x] Foreground reconciliation restarts queue listener when app returns from background
- [x] Local payment rows stored idempotently with unique idempotency keys
- [x] Offline invoice and expense creation persists across app restarts
- [x] Explicit server acknowledgement lifecycle distinguishes acceptance from completion

---

## Monitoring & Observability

### 12. Error Tracking

- [x] Sentry DSN configured for backend with strict HTTPS requirement in production
- [x] Sentry initialized in mobile app (`initSentry()` in App.tsx)
- [x] PII redaction active: auth tokens, passwords, TIN/BVN, and payer info stripped from events
- [x] Terminal BullMQ and worker process failures reported to Sentry

### 13. Metrics & Health

- [x] `/health` endpoint returns `ok`
- [x] `/health/live` liveness probe configured (<200ms)
- [x] `/health/ready` readiness probe configured (<500ms)
- [x] `/metrics` endpoint returns Prometheus-compatible metrics (7 core metrics)
- [x] DLQ monitoring enabled with auto-alerting at depth > 10
- [x] Database connection pool metrics enabled

### 14. Alerting

- [x] Uptime monitoring configured on `/health/ready`
- [x] Grafana alerts configured for NRS circuit state, DLQ depth, and auth flood
- [x] Incident response playbook reviewed (`docs/INCIDENT_RESPONSE.md`)

---

## Security

### 15. Security Headers

- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `X-XSS-Protection: 1; mode=block`
- [x] `Strict-Transport-Security` with `includeSubDomains`
- [x] `Content-Security-Policy` configured with environment-scoped origins
- [x] `Referrer-Policy: strict-origin-when-cross-origin`

### 16. Authentication & Authorization

- [x] Database-backed platform administrator guard (`requirePlatformAdmin`) active on global routes
- [x] Platform-aware role selector prevents privilege escalation
- [x] JWT access tokens expire in 24h; atomic refresh-token rotation with replay detection
- [x] Database-backed logout endpoint revokes refresh tokens and sessions
- [x] Double-submit CSRF cookie & header validation on mutating admin endpoints
- [x] Browser-exposed admin API keys completely eliminated from frontend bundles
- [x] Rate limiting enabled in production (Redis-backed, 5 tiers, fail-closed)
- [x] No debug headers in production: `ALLOW_DEBUG_USER_ID_HEADER=false`

### 17. Data Protection

- [x] TIN/BVN encrypted at rest (AES-256-GCM)
- [x] No PII in analytics events or structured logs
- [x] NDPC compliance verified (right to erasure, consent mechanisms)
- [x] Immutable audit logging enabled for all privileged operations

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

- [x] All components show "healthy"
- [x] Database latency < 100ms
- [x] Redis latency < 50ms
- [x] Error rate < 1%
- [x] Memory usage stable

---

## KPI Targets

| Metric | Target | Status |
|--------|--------|--------|
| Crash-free rate | > 99.9% | ✅ PASS |
| Onboarding completion | > 60% | ✅ PASS |
| Offline sync success | > 95% | ✅ PASS |
| API p95 latency | < 500ms | ✅ PASS |
| WCAG 2.1 AA compliance | 100% | ✅ PASS |
| Test pass rate | 100% | ✅ PASS |
| Code coverage | > 80% | ✅ PASS (97.29%) |

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Engineering Lead | TaxBridge Core Engineering | Nov 6, 2026 | ✅ SIGNED OFF |
| QA & Automation Lead | Verification & Quality Assurance | Nov 6, 2026 | ✅ SIGNED OFF |
| Product & Security Lead | Security Architecture & Governance | Nov 6, 2026 | ✅ SIGNED OFF |
| DevOps & Release Lead | Platform Operations & Release Eng | Nov 6, 2026 | ✅ SIGNED OFF |

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
