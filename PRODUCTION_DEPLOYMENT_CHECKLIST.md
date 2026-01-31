# Production Pre-Deployment Checklist

**Version:** 1.0.0  
**Date:** January 31, 2026  
**Branch:** feature/ui-polish-v5.0.6 → master

---

## ✅ Code Quality

- [x] TypeScript compilation: 0 errors (mobile, backend, admin-dashboard)
- [x] UI consistency validation passed (PaymentScreen: 0/25 hardcoded values)
- [x] Accessibility: 79 labels, 9 hints, 44px minimum touch targets
- [x] Component memoization applied (4 components)
- [x] Design token system enforced
- [x] i18n parity (English + Nigerian Pidgin)

## ✅ Configuration

- [x] `app.json` version: 1.0.0
- [x] `eas.json` production profile configured
- [x] `metro.config.js` created (React deduplication)
- [x] Environment variables documented (`.env.production.example`)
- [x] Feature flags configured with safe defaults
- [x] API base URL: https://api.taxbridge.ng (production)

## ✅ Performance

- [x] Metro bundler optimization (single React instance)
- [x] Component memoization (StatusBadge, OfflineBadge, InvoiceCard, NetworkStatus)
- [x] Named imports for tree-shaking
- [x] Navigation transitions centralized
- [x] Image optimization (OptimizedImage component)
- [x] VirtualizedList for large datasets

## ✅ Security & Compliance

- [x] Peppol BIS Billing 3.0 UBL compliance
- [x] Customer TIN capture (schemeID="TIN")
- [x] Endpoint ID (schemeID="0199")
- [x] NDPC data protection considerations
- [x] Audit logging in backend
- [x] Secure token storage (expo-secure-store)
- [x] Input validation (TIN format)

## ✅ Database

- [x] Migration applied: `customer_tin`, `customer_endpoint_id` columns
- [x] Prisma client regenerated
- [x] SQLite schema updated (mobile)
- [x] Sync logic updated

## ✅ Mobile App

### Build Configuration
- [x] Bundle identifier: `ng.taxbridge.app`
- [x] Version: 1.0.0
- [x] Build number: 1 (iOS), auto-increment (Android)
- [x] Hermes engine enabled
- [x] New Architecture enabled
- [x] Splash screen configured
- [x] Icon assets present

### Permissions
- [x] Camera (receipt scanning)
- [x] Photo library (receipt import)
- [x] Internet
- [x] Network state

### Features
- [x] Offline-first architecture
- [x] SQLite persistence
- [x] Sync engine with exponential backoff
- [x] Device registration
- [x] Receipt OCR
- [x] Tax calculation engine
- [x] Payment integration (Remita)

## ✅ Backend

- [x] Database migration ready
- [x] UBL generator updated (TIN fields)
- [x] API routes validated
- [x] Sync endpoints tested
- [x] Payment endpoints (RRR generation, status check)
- [x] Device management endpoints
- [x] Error handling & logging

## ✅ Admin Dashboard

- [x] Invoice list (TIN display)
- [x] Device management
- [x] Force sync functionality
- [x] Conflict resolution
- [x] i18n complete

## 🔧 Pre-Build Actions

### 1. Merge Feature Branch
```bash
git checkout master
git merge feature/ui-polish-v5.0.6
git push origin master
```

### 2. Build Mobile App
```bash
cd mobile

# Preview build (internal testing)
npx eas-cli build --platform all --profile preview

# Production build (Google Play / App Store)
npx eas-cli build --platform all --profile production
```

### 3. Deploy Backend
```bash
# Automatic deployment via Render on push to master
git push render master

# Verify deployment
curl https://api.taxbridge.ng/health
```

### 4. Deploy Admin Dashboard
```bash
# Automatic deployment via Vercel on push to master
# Verify at: https://admin.taxbridge.ng
```

## 📱 Post-Deployment Validation

### Mobile App
- [ ] Install from TestFlight/Internal Testing
- [ ] Create invoice offline
- [ ] Verify sync when online
- [ ] Test receipt scanner
- [ ] Generate payment RRR
- [ ] Check payment status
- [ ] Verify TIN capture
- [ ] Test language switching
- [ ] Validate accessibility (VoiceOver/TalkBack)

### Backend API
- [ ] Health check: `GET /health`
- [ ] Invoice creation: `POST /api/invoices`
- [ ] Sync endpoint: `POST /api/sync`
- [ ] Payment generation: `POST /payments/generate`
- [ ] Device registration: `POST /devices/register`

### Admin Dashboard
- [ ] Login with test account
- [ ] View invoice list (TIN visible)
- [ ] Force sync device
- [ ] Resolve conflict
- [ ] Export data

## 🚨 Rollback Plan

If critical issues found post-deployment:

1. **Mobile**: Revert to previous EAS build
   ```bash
   eas channel:rollout:edit --channel=production --build-id=<previous-build-id>
   ```

2. **Backend**: Revert commit on Render
   ```bash
   git revert HEAD
   git push render master
   ```

3. **Admin**: Revert deployment on Vercel dashboard

## 📊 Monitoring

- [ ] Sentry error tracking active
- [ ] Backend logs monitored
- [ ] API response times < 500ms
- [ ] Database connection pool healthy
- [ ] Sync success rate > 95%

## 🎯 Success Criteria

- [ ] 0 critical bugs in first 24 hours
- [ ] Sync success rate > 95%
- [ ] App launch < 3 seconds
- [ ] Invoice creation < 2 seconds
- [ ] Payment RRR generation < 5 seconds
- [ ] User satisfaction > 4.0/5.0

## ✍️ Sign-Off

**Technical Lead:** _________________ Date: _______

**Product Owner:** _________________ Date: _______

**Compliance Officer:** _________________ Date: _______

---

**Status:** Ready for production deployment ✅
