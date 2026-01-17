# Phase F: Phased Production Launch Preparation

**Version:** 5.0.2  
**Date:** January 17, 2026  
**Status:** 🟡 F3 READY TO EXECUTE (F1-F2 Complete)  
**Previous Phase:** E (Validation) ✅ COMPLETE

---

## Executive Summary

Phase E validation has confirmed TaxBridge V5.0.2 is **production-ready**:

| Gate | Status | Details |
|------|--------|---------|
| TypeScript | ✅ | 0 errors across all layers |
| Mobile Tests | ✅ | 139/139 passing |
| Backend Tests | ✅ | 68/68 passing |
| Admin Tests | ✅ | 8/8 passing |
| Pre-Staging Check | ✅ | 31/31 checks passed |
| Documentation | ✅ | Aligned, streamlined |
| Security | ✅ | Phase B hardening complete |

**Total Tests:** 215/215 passing (100% success rate)

**Current Progress:**
- ✅ F1: Production environment configured (secrets generated)
- ✅ F2: Android .aab build complete (Build ID: 446d5211-e437-438c-9fc1-c56361286855)
- 🟡 F3: Staging deployment ready to execute (next step)

---

## Phase F Execution Sequence

### Step 1: Build Production Artifacts (30 min)

#### 1.1 Mobile App Builds

```powershell
cd c:\Users\USR\Documents\taxbridge\mobile

# Android production build
eas build --platform android --profile production --non-interactive

# iOS production build  
eas build --platform ios --profile production --non-interactive
```

**Expected Output:**
- Android: `taxbridge-v5.0.2.aab` (App Bundle)
- iOS: `taxbridge-v5.0.2.ipa`

#### 1.2 Verify Build Artifacts

```powershell
# Check build status
eas build:list --limit 2
```

**Validation Criteria:**
- [ ] Build status: `FINISHED`
- [ ] Version: `5.0.2`
- [ ] Bundle ID: `ng.taxbridge.app`
- [ ] No signing errors

---

### Step 2: Production Environment Configuration (15 min)

#### 2.1 Create Production Environment

```powershell
# Copy production template
Copy-Item .env.production.example .env.production

# Generate new secrets (if not already created)
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

#### 2.2 Required Production Variables

| Variable | Source | Status |
|----------|--------|--------|
| `ENCRYPTION_KEY` | Generate new | ⏳ |
| `JWT_SECRET` | Generate new | ⏳ |
| `DATABASE_URL` | Supabase production | ⏳ |
| `REDIS_URL` | Upstash production | ⏳ |
| `DIGITAX_API_KEY` | DigiTax dashboard | ⏳ |
| `DIGITAX_API_SECRET` | DigiTax dashboard | ⏳ |
| `REMITA_API_KEY` | Remita dashboard | ⏳ |
| `SENTRY_DSN` | Sentry project | ⏳ |

---

### Step 3: Staging Deployment (30 min)

#### 3.1 Deploy Backend to Staging

```powershell
cd c:\Users\USR\Documents\taxbridge

# Deploy via Render
git push render staging:main

# Or via deployment script
.\deploy-production.ps1 -Environment staging
```

#### 3.2 Run Staging Health Checks

```powershell
# API health
curl https://api-staging.taxbridge.ng/health

# Queue health
curl https://api-staging.taxbridge.ng/health/queues

# Database health
curl https://api-staging.taxbridge.ng/health/db
```

**Expected Response:**
```json
{
  "status": "healthy",
  "version": "5.0.2",
  "uptime": "...",
  "services": {
    "database": "connected",
    "redis": "connected",
    "queues": "active"
  }
}
```

---

### Step 4: Load Testing (60 min)

#### 4.1 Smoke Test (5 min)

```powershell
cd c:\Users\USR\Documents\taxbridge\backend\load-test

k6 run k6-smoke.js -e BASE_URL=https://api-staging.taxbridge.ng
```

**Pass Criteria:**
- [ ] All requests succeed (0% error rate)
- [ ] P95 < 300ms

#### 4.2 Load Test (27 min)

```powershell
k6 run k6-script.js -e BASE_URL=https://api-staging.taxbridge.ng
```

**Pass Criteria:**
- [ ] Error rate < 10%
- [ ] P95 < 300ms
- [ ] Circuit breaker activates under load

#### 4.3 Soak Test (30 min)

```powershell
k6 run k6-soak.js -e BASE_URL=https://api-staging.taxbridge.ng
```

**Pass Criteria:**
- [ ] No response time degradation
- [ ] Memory stable
- [ ] No connection leaks

---

### Step 5: DigiTax Certification (External)

#### 5.1 Pre-Certification Checklist

- [ ] UBL 3.0 schema validation (55 mandatory fields)
- [ ] CSID generation working
- [ ] QR code encoding correct
- [ ] Webhook endpoints responding
- [ ] Error handling for NRS failures

#### 5.2 Submit for Certification

Contact DigiTax support with:
- API endpoint URLs
- Test transaction IDs
- Webhook URLs

---

### Step 6: Production Deployment (30 min)

#### 6.1 Pre-Deployment Gate

| Check | Status |
|-------|--------|
| Staging tests pass | ⏳ |
| Load tests pass | ⏳ |
| DigiTax certified | ⏳ |
| Rollback plan documented | ✅ |
| Monitoring enabled | ✅ |

#### 6.2 Deploy Production

```powershell
# Deploy backend
.\deploy-production.ps1 -Environment production

# Verify deployment
curl https://api.taxbridge.ng/health
```

#### 6.3 Deploy Mobile Builds

```powershell
# Submit to Google Play (internal track first)
eas submit --platform android --profile production

# Submit to App Store (TestFlight first)
eas submit --platform ios --profile production
```

---

### Step 7: Phased Rollout

#### Week 1: Internal Testing (10 users)

- TaxBridge team members
- Manual QA testing
- Collect crash reports

#### Week 2: Beta Users (100 users)

- Invited beta testers
- WhatsApp referral tracking
- NPS surveys

#### Week 3: Soft Launch (1,000 users)

- Limited marketing
- Monitor metrics:
  - DAU/WAU
  - Invoice creation rate
  - Payment success rate
  - Churn signals

#### Week 4: General Availability

- Full marketing push
- App Store featuring request
- Press release

---

## Rollback Plan

### Immediate Rollback (< 5 min)

```powershell
# Backend rollback
git revert HEAD
git push render main

# Mobile rollback (via OTA)
eas update --branch production --message "Rollback to v5.0.1"
```

### Full Rollback (< 30 min)

1. Disable new signups
2. Rollback database migrations
3. Restore previous backend version
4. Push OTA update to mobile

---

## Success Metrics

| Metric | Target | Tracking |
|--------|--------|----------|
| App Crash Rate | < 1% | Sentry |
| API P95 | < 300ms | Prometheus |
| Invoice Success Rate | > 95% | Internal |
| Payment Success Rate | > 90% | Remita dashboard |
| User Activation (D1) | > 40% | Mixpanel |
| User Retention (D7) | > 25% | Mixpanel |

---

## Phase F Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | | | |
| Product Owner | | | |
| Compliance Officer | | | |
| Operations | | | |

---

**Next Phase:** G (Growth & Scaling) - Post-launch optimization
