# 📱 TAXBRIDGE MOBILE APP RELEASE GUIDE
## Google Play Store Deployment & Version Management

**Platform**: Android (React Native + Expo)  
**Build System**: EAS (Expo Application Services)  
**Target SDK**: Android 14 (API 35)  
**Minimum SDK**: Android 7.0 (API 24)

---

## 🎯 RELEASE WORKFLOW OVERVIEW

```
Code Ready → Build → Test → Submit → Review → Publish
   ↓           ↓       ↓       ↓        ↓        ↓
  1-2h        15m     2h      10m     1-3d      1h
```

**Total Time**: 2-4 days (most time is Google Play review)

---

## 📦 VERSION NUMBERING STRATEGY

### Semantic Versioning: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

- **MAJOR** (1.x.x): Breaking changes, major new features
- **MINOR** (x.2.x): New features, non-breaking changes
- **PATCH** (x.x.3): Bug fixes, minor improvements

### Version Code (Android)
- Auto-incremented integer (1, 2, 3, ...)
- Managed by EAS with `"autoIncrement": true` in production profile
- **Never manually set** - EAS handles this

### Examples:
```
v1.0.0 (Build 1)   - Initial launch
v1.0.1 (Build 2)   - Hotfix for OCR crash
v1.1.0 (Build 3)   - Added expense categories feature
v2.0.0 (Build 4)   - Redesigned UI, new tax engine
```

---

## 🔧 PRE-BUILD CHECKLIST

### 1. Update Version Number

**File**: `mobile/app.json`
```json
{
  "expo": {
    "version": "1.0.1",  // ← Update this
    "android": {
      "versionCode": 2   // ← EAS auto-increments if "autoIncrement": true
    }
  }
}
```

### 2. Update Dependencies
```bash
cd mobile
npm outdated  # Check for updates
npm update    # Update minor/patch versions
npm audit fix # Fix security vulnerabilities
```

### 3. Run Tests
```bash
npm test -- --coverage
# Expected: All tests passing, coverage >70%
```

### 4. Build Locally (Optional)
```bash
npx expo prebuild  # Generate native code
npm run android    # Test on emulator/device
```

---

## 🏗️ BUILDING WITH EAS

### Production Build (Google Play Store)

```bash
cd mobile

# Build Android App Bundle (AAB) for Play Store
eas build --platform android --profile production

# Build APK for internal testing
eas build --platform android --profile production-apk
```

**Build Time**: 10-15 minutes  
**Output**: 
- AAB: `taxbridge-1.0.0.aab` (~15MB)
- APK: `taxbridge-1.0.0.apk` (~20MB)

### Monitoring Build Progress
1. Watch terminal output for build ID
2. Check EAS dashboard: https://expo.dev/accounts/taxbridgengs-organization/projects/taxbridge/builds
3. Receive email when build completes

### Download Build Artifact
```bash
# CLI download
eas build:download --id [build-id]

# Or download from EAS dashboard (recommended)
```

---

## 🧪 PRE-SUBMISSION TESTING

### Internal Testing Checklist (2-4 hours)

#### Device Matrix (Test on at least 3 devices)
- [ ] **Low-end**: Samsung Galaxy A10 (Android 9)
- [ ] **Mid-range**: Xiaomi Redmi Note 10 (Android 11)
- [ ] **High-end**: Samsung Galaxy S22 (Android 14)

#### Critical User Journeys
1. **Onboarding** (2 minutes)
   - [ ] App launches successfully
   - [ ] Onboarding completes in <60 seconds
   - [ ] Profile setup saves correctly

2. **Invoice Creation** (3 minutes)
   - [ ] Create invoice with 3 line items
   - [ ] VAT calculated correctly (7.5%)
   - [ ] Invoice saves to SQLite
   - [ ] PDF generation works

3. **OCR Scanning** (2 minutes)
   - [ ] Camera permission granted
   - [ ] Receipt scanned successfully
   - [ ] Amount extracted correctly
   - [ ] Confidence score displayed

4. **Offline Mode** (5 minutes)
   - [ ] Enable airplane mode
   - [ ] Create 3 invoices
   - [ ] Disable airplane mode
   - [ ] Invoices sync within 30 seconds

5. **Payment Processing** (3 minutes)
   - [ ] Initialize Paystack payment
   - [ ] Redirect to payment page
   - [ ] Complete test payment
   - [ ] Webhook updates invoice status

#### Performance Metrics
- [ ] Cold start: <3 seconds
- [ ] Hot start: <1 second
- [ ] Memory usage (idle): <150MB
- [ ] Frame rate: 60fps (no jank)
- [ ] Battery drain: <5% per hour

#### Edge Cases
- [ ] Poor network (throttle to 2G)
- [ ] Background/foreground transitions
- [ ] Low storage warning (< 100MB free)
- [ ] Large invoices (50+ line items)
- [ ] Multiple sync conflicts

---

## 🚀 GOOGLE PLAY CONSOLE SUBMISSION

### First-Time Setup (One-time only)

1. **Create Developer Account**
   - Visit: https://play.google.com/console/signup
   - Pay one-time fee: $25
   - Verify identity (government ID + address)

2. **Create App**
   - Click "Create app"
   - App name: **TaxBridge**
   - Default language: **English (US)**
   - App type: **App**
   - Category: **Business**
   - Free/Paid: **Free**

3. **Complete Store Listing**
   ```
   Short Description (80 chars):
   Nigeria's first offline-first tax compliance platform for SMEs
   
   Full Description (4000 chars):
   TaxBridge is Nigeria's premier tax compliance platform, designed specifically for small and medium enterprises (SMEs). Create NTA 2025-compliant invoices offline, submit to NRS for e-invoicing, and process payments seamlessly.
   
   KEY FEATURES:
   • 📱 Offline-First: Create invoices anywhere, sync later
   • 🧾 NRS Compliant: Automatic e-invoicing with FIRS
   • 🧮 Smart Tax Calculator: CIT, PIT, VAT, WHT, PAYE
   • 📸 Receipt Scanning: OCR extracts data from receipts
   • 💳 Multi-Gateway Payments: Paystack, Flutterwave, Remita
   • 🔒 NDPC Compliant: Bank-grade encryption
   
   Built for Nigerian SMEs by Nigerian developers 🇳🇬
   ```

4. **Upload Screenshots** (Required: 2-8 screenshots)
   - Phone: 1080x1920 (9:16 aspect ratio)
   - Tablet: 1920x1200 (7-inch tablet)
   
   **Screenshot Ideas**:
   1. Dashboard with invoice stats
   2. Invoice creation form
   3. OCR receipt scanning
   4. Tax calculator results
   5. Offline mode indicator
   6. Payment success screen

5. **Feature Graphic** (Required)
   - Size: 1024x500 pixels
   - Design: TaxBridge logo + tagline
   - Tool: Canva (free)

6. **App Icon**
   - Size: 512x512 pixels
   - Already exists: `mobile/assets/icon.png`

---

### Submission Process (10-15 minutes)

1. **Navigate to Release Dashboard**
   ```
   Google Play Console > TaxBridge > Release > Production
   ```

2. **Create New Release**
   - Click "Create new release"
   - Select "App bundles" tab
   - Upload: `taxbridge-1.0.0.aab`

3. **Release Notes** (What's new in this version)
   ```
   Version 1.0.1 - Bug Fixes & Performance Improvements
   
   ✅ Fixed OCR crash on low-end devices
   ✅ Improved sync performance (50% faster)
   ✅ Enhanced offline mode stability
   ✅ Updated tax calculations for NTA 2025
   
   Thank you for using TaxBridge! 🇳🇬
   ```

4. **Review Release Summary**
   - App version: 1.0.1
   - Version code: 2
   - Target audience: Everyone
   - Content rating: Everyone

5. **Select Rollout Type**
   
   **Option A: Staged Rollout (Recommended)**
   - Day 1: 10% (monitor crash-free rate)
   - Day 3: 50% (if crash-free rate >99.5%)
   - Day 7: 100% (full rollout)
   
   **Option B: Full Rollout**
   - 100% immediately (riskier)

6. **Submit for Review**
   - Click "Save" → "Review release" → "Start rollout to Production"
   - Confirmation email sent

---

## ⏱️ GOOGLE PLAY REVIEW PROCESS

### Timeline
- **Standard Review**: 1-3 days
- **Expedited Review**: Request via support (critical bugs only)

### Review Criteria
- [ ] App functionality works as described
- [ ] No crashes or critical bugs
- [ ] Privacy policy accessible
- [ ] No policy violations (spam, malware, deceptive behavior)
- [ ] Complies with Nigerian regulations

### Common Rejection Reasons
1. **Crash on startup** → Fix and resubmit
2. **Missing privacy policy** → Add link in Play Console
3. **Misleading description** → Update store listing
4. **Broken payment flow** → Test payment integration

### After Approval
- Status changes to "Available on Google Play"
- App appears in search within 2-4 hours
- Push notification sent to opted-in users

---

## 🔄 HOTFIX RELEASE PROCESS

For critical bugs requiring immediate fix:

### 1. Create Hotfix Branch (5 minutes)
```bash
git checkout -b hotfix/1.0.1
# Fix bug in code
git add .
git commit -m "Hotfix: Fix OCR crash on Android 9"
git push origin hotfix/1.0.1
```

### 2. Update Version (2 minutes)
```json
// mobile/app.json
{
  "expo": {
    "version": "1.0.1"  // Increment patch version
  }
}
```

### 3. Build & Test (20 minutes)
```bash
eas build --platform android --profile production
# Download APK and test on affected devices
```

### 4. Submit (10 minutes)
- Upload to Play Console
- Select "Expedited Review" checkbox
- Explain urgency: "Critical crash affecting 20% of users on Android 9"

### 5. Merge to Master
```bash
git checkout master
git merge hotfix/1.0.1
git push origin master
git tag v1.0.1
git push origin v1.0.1
```

**Total Time**: 45 minutes (+ review time)

---

## 📊 POST-RELEASE MONITORING

### First 24 Hours (Critical)

**Check Every Hour**:
- [ ] Crash-free rate (target: >99.5%)
- [ ] ANR rate (target: <1%)
- [ ] Install success rate (target: >95%)
- [ ] User ratings (respond to negative reviews within 2 hours)

**Google Play Console Metrics**:
```
Production > Dashboard > Statistics
- Installs: Track growth
- Uninstalls: Monitor churn (<5%)
- Crashes: Investigate spikes
- ANRs: Optimize performance
```

### Week 1 (Daily Review)

**Key Metrics**:
- Crash-free rate: >99.5%
- User retention (D1): >40%
- User retention (D7): >20%
- Average rating: >4.0/5.0
- Reviews: Respond to all negative reviews

**Firebase/Sentry**:
- Error rate: <1%
- API response time: P95 <500ms
- OCR processing time: P95 <3s

---

## 🔐 RELEASE SIGNING & SECURITY

### Google Play App Signing (Recommended)

EAS handles signing automatically:
1. First build generates keystore
2. Keystore stored securely in EAS
3. Google Play re-signs with Play App Signing key
4. Increased security, easier key management

### Manual Signing (Not recommended for production)

If you need manual control:
```bash
# Generate keystore (one-time)
keytool -genkeypair -v -keystore taxbridge.keystore -alias taxbridge \
  -keyalg RSA -keysize 2048 -validity 10000

# Configure EAS credentials
eas credentials
```

---

## 📱 TESTING TRACKS

### Internal Testing Track
- **Purpose**: Team testing before release
- **Audience**: Up to 100 testers (email whitelist)
- **Review**: No Google review required
- **Rollout**: Instant

### Closed Testing Track (Alpha)
- **Purpose**: Trusted testers, early adopters
- **Audience**: Up to 1,000 testers (email list or Google Group)
- **Review**: Minimal Google review
- **Rollout**: 1-2 hours

### Open Testing Track (Beta)
- **Purpose**: Public beta, wider audience
- **Audience**: Unlimited (public opt-in)
- **Review**: Standard Google review
- **Rollout**: 1-3 days

### Production Track
- **Purpose**: All users
- **Audience**: Everyone
- **Review**: Full Google review
- **Rollout**: 1-3 days + staged rollout

---

## 🚨 EMERGENCY ROLLBACK

### Halt Rollout (If critical bug discovered)

1. **Stop Rollout**
   ```
   Production > Releases > [Active release] > Halt rollout
   ```
   - Only affects users who haven't updated yet
   - Already-updated users **cannot** be rolled back

2. **Communicate to Users**
   - In-app banner: "Known issue, update coming soon"
   - Social media: Acknowledge issue, provide ETA
   - Support email: Proactive notification

3. **Prepare Hotfix**
   - Follow hotfix process above
   - Test thoroughly
   - Submit with "Expedited Review" flag

4. **Resume Rollout**
   - After hotfix approved
   - Start with 10% rollout to verify fix

---

## 📋 RELEASE CHECKLIST

Use this checklist for every production release:

### Pre-Build
- [ ] Version number updated in `app.json`
- [ ] All tests passing (`npm test`)
- [ ] Dependencies updated (`npm audit`)
- [ ] Build locally tested (`npm run android`)
- [ ] Release notes drafted

### Build
- [ ] EAS build started (`eas build --profile production`)
- [ ] Build completed successfully (check EAS dashboard)
- [ ] AAB/APK downloaded

### Testing
- [ ] Tested on 3+ devices (low/mid/high-end)
- [ ] All critical user journeys working
- [ ] Performance metrics meet targets
- [ ] Offline mode tested thoroughly
- [ ] Edge cases verified

### Submission
- [ ] Store listing updated (if changed)
- [ ] Screenshots current (if changed)
- [ ] AAB uploaded to Play Console
- [ ] Release notes added
- [ ] Rollout type selected (staged/full)
- [ ] Submitted for review

### Post-Release
- [ ] Monitor crash-free rate (first 24h)
- [ ] Respond to user reviews
- [ ] Track key metrics (installs, retention, ratings)
- [ ] Team notified of successful release

---

## 🔗 USEFUL LINKS

- **EAS Dashboard**: https://expo.dev/accounts/taxbridgengs-organization/projects/taxbridge
- **Google Play Console**: https://play.google.com/console
- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **Google Play Policies**: https://play.google.com/about/developer-content-policy/
- **Firebase Console**: https://console.firebase.google.com (if using)
- **Sentry**: https://sentry.io/organizations/taxbridge

---

## 📞 SUPPORT CONTACTS

### EAS Build Issues
- **Email**: support@expo.dev
- **Discord**: https://discord.gg/expo
- **Docs**: https://docs.expo.dev

### Google Play Console Issues
- **Help Center**: https://support.google.com/googleplay/android-developer
- **Phone**: 1-855-836-3987 (US, business hours)
- **Email**: Via Play Console support form

---

## 🎓 BEST PRACTICES

1. **Always use staged rollouts** for major updates
2. **Test on low-end devices** (most Nigerian users)
3. **Monitor crash-free rate** for first 24 hours
4. **Respond to reviews** within 24 hours
5. **Keep release notes concise** (5-7 bullet points)
6. **Version every hotfix** (never skip versions)
7. **Tag releases in Git** for easy rollback
8. **Document breaking changes** in release notes
9. **Test offline mode** before every release
10. **Keep AAB/APK artifacts** for at least 6 months

---

**Document Owner**: Mobile Team Lead  
**Last Updated**: February 2026  
**Next Review**: After first production release
