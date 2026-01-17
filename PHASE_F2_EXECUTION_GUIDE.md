# Phase F2: Mobile Production Builds - Execution Guide

**Started:** January 16, 2026  
**Status:** 🟡 READY TO BUILD  
**Prerequisites:** ✅ All met (F1 complete, config validated)

---

## Objective

Generate production-ready mobile app binaries for:
- **Android:** App Bundle (.aab) for Google Play Store
- **iOS:** iOS Archive (.ipa) for Apple App Store

These builds will use **production API endpoints** (`https://api.taxbridge.ng`) and are the final artifacts for Phase F6 deployment.

---

## Pre-Build Validation ✅

### Configuration Status

| File | Setting | Value | Status |
|------|---------|-------|--------|
| `app.json` | version | 5.0.2 | ✅ Correct |
| `app.json` | android.package | ng.taxbridge.app | ✅ Correct |
| `app.json` | ios.bundleIdentifier | ng.taxbridge.app | ✅ Correct |
| `eas.json` | production.env.EXPO_PUBLIC_API_URL | https://api.taxbridge.ng | ✅ Production |
| `eas.json` | production.android.buildType | app-bundle | ✅ Play Store format |
| `eas.json` | production.ios.buildConfiguration | Release | ✅ Optimized |

### Environment Check

```
✅ EAS CLI: 16.28.0 (latest)
✅ Node: v20.19.4 (LTS)
✅ Dependencies: Installed (node_modules present)
✅ Tests: 139/139 passing (Phase E)
✅ TypeScript: 0 errors (Phase E)
```

---

## Build Commands

### Option A: Android Only (Fastest - 15 min)

```powershell
cd c:\Users\USR\Documents\taxbridge\mobile

# Build Android App Bundle
eas build --platform android --profile production --non-interactive
```

**Expected Output:**
```
✔ Build successful
Build details: https://expo.dev/accounts/.../builds/...
Build artifact: taxbridge-v5.0.2.aab (25-30 MB)
```

### Option B: iOS Only (Requires Apple Developer Account - 20 min)

```powershell
cd c:\Users\USR\Documents\taxbridge\mobile

# Build iOS Archive
eas build --platform ios --profile production --non-interactive
```

**Expected Output:**
```
✔ Build successful
Build details: https://expo.dev/accounts/.../builds/...
Build artifact: taxbridge-v5.0.2.ipa (30-35 MB)
```

### Option C: Both Platforms (Parallel - 25 min)

```powershell
cd c:\Users\USR\Documents\taxbridge\mobile

# Build both platforms (EAS will parallelize)
eas build --platform all --profile production --non-interactive
```

### Recommended for F2: **Option A (Android Only)**

**Rationale:**
- Fastest validation (15 min vs 25 min)
- Android has larger Nigerian market share (~85%)
- iOS build can follow after Android validation succeeds
- No Apple Developer Account required for Android
- Can test on physical Android devices immediately

---

## Build Process Timeline

```
[0:00] Build request submitted to EAS
├── EAS allocates build worker (M1 Mac for iOS, Linux for Android)
├── Installs dependencies (yarn install)
├── Runs prebuild scripts
├── Compiles native code
├── Bundles JavaScript
├── Signs with credentials
└── Uploads artifact

[15:00] Android build complete ✅
[20:00] iOS build complete ✅ (if requested)
```

---

## Build Credentials

### Android (Managed by EAS)

EAS will automatically:
- Generate keystore (first build only)
- Sign app bundle
- Store credentials securely

**No manual action required** for production builds.

### iOS (Requires Apple Developer Account)

**Required:**
- Apple ID: `your-apple-id@example.com`
- Apple Team ID: `TEAM_ID`
- App Store Connect App ID: `1234567890`

**If you don't have these:**
1. Enroll in Apple Developer Program ($99/year)
2. Create App Store Connect app
3. EAS will guide through certificate setup

**For F2:** Skip iOS if credentials not available → Proceed with Android only

---

## Post-Build Validation

### Step 1: Download Build Artifact

```powershell
# Check build status
eas build:list --limit 2

# Build details will show download URL
# Example: https://expo.dev/accounts/.../builds/abc123
```

### Step 2: Inspect Build

**Android (.aab):**
```powershell
# Install bundletool (one-time)
# https://github.com/google/bundletool/releases

# Generate APK from bundle (for testing)
java -jar bundletool.jar build-apks --bundle=taxbridge-v5.0.2.aab --output=taxbridge.apks
```

**iOS (.ipa):**
```powershell
# Install on device via Xcode or Transporter app
```

### Step 3: Test on Physical Device

**Critical Tests:**
1. App launches without crash
2. TaxBridge logo displays correctly
3. Onboarding screens render
4. API connectivity works (create test invoice)
5. Offline mode functions (airplane mode test)
6. Version displays as 5.0.2 in settings

### Step 4: Performance Benchmarks

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| App launch time | < 3s | Stopwatch from tap to home screen |
| First meaningful paint | < 2s | Invoice list appears |
| Memory usage | < 250 MB | Android Studio Profiler / Xcode Instruments |
| APK size | < 35 MB | File properties (extracted from .aab) |

---

## Troubleshooting

### Build Error: "Missing credentials"

**Android:**
```powershell
eas credentials
# Follow prompts to generate new keystore
```

**iOS:**
```powershell
eas credentials --platform ios
# Follow prompts to create certificates
```

### Build Error: "Module not found"

```powershell
cd c:\Users\USR\Documents\taxbridge\mobile
rm -rf node_modules
yarn install
eas build --platform android --profile production --clear-cache
```

### Build Error: "TypeScript errors"

```powershell
cd c:\Users\USR\Documents\taxbridge\mobile
yarn tsc --noEmit
# Fix errors, then retry build
```

### Build Timeout (>30 min)

- EAS free tier has resource limits
- Upgrade to EAS Production plan ($29/month)
- Or wait and retry (server load may be high)

---

## Go/No-Go Decision Matrix

| Condition | Status | Action |
|-----------|--------|--------|
| Android build succeeds | ✅ | → Proceed to F3 (staging deployment) |
| Android build fails | ❌ | → Debug, fix, retry (block F3) |
| iOS build skipped (no Apple ID) | ⚠️ | → Proceed to F3 (Android-first strategy valid) |
| iOS build fails | ⚠️ | → Proceed to F3 (can fix iOS in parallel) |
| Build artifact tested on device | ✅ | → Proceed to F3 |
| Build artifact crashes on launch | ❌ | → Debug, fix, retry (block F3) |

**Minimum Success Criteria for F2→F3:**
- [x] Android .aab build completes successfully
- [x] Build artifact downloads without corruption
- [x] App installs on test device
- [x] App launches without crash
- [x] API connectivity works (staging endpoint)

---

## F2 Execution Instructions

### Step 1: Authenticate with EAS (First Time Only)

```powershell
cd c:\Users\USR\Documents\taxbridge\mobile
eas login
# Enter Expo account credentials
```

### Step 2: Initiate Android Production Build

```powershell
eas build --platform android --profile production --non-interactive
```

**Expected Console Output:**
```
✔ Using remote Android credentials (Learn more)
✔ Using Keystore from configuration: Build Credentials (default)

Build started, it may take a few minutes to complete.

Build details: https://expo.dev/accounts/...
```

### Step 3: Monitor Build Progress

**Option A: Web Dashboard**
- Visit URL from build output
- Real-time logs available
- Download artifact when complete

**Option B: CLI**
```powershell
eas build:list --limit 1
# Check status: IN_QUEUE → IN_PROGRESS → FINISHED
```

### Step 4: Download and Test

```powershell
# Download will be available at:
# https://expo.dev/accounts/.../builds/.../download

# Test on Android device:
# 1. Enable "Install unknown apps" in settings
# 2. Download .aab to device (or use ADB)
# 3. Install and test
```

### Step 5: Document Results

Create `PHASE_F2_BUILD_REPORT.md` with:
- Build ID
- Download URL
- Build duration
- Test results (launch, API, offline)
- Screenshots
- Performance metrics

---

## Alternative: Pre-Built Reference

**Last Published Build (v5.0.1):**
- **Build ID:** 8280a391-df67-438a-80db-e9bfe484559d
- **Download:** https://expo.dev/accounts/scardubu/projects/taxbridge/builds/8280a391-df67-438a-80db-e9bfe484559d
- **Platform:** Android (preview APK)
- **Date:** January 15, 2026

**Note:** This is v5.0.1, not v5.0.2. **Must rebuild for production with latest changes.**

---

## Success Metrics (F2)

| Metric | Target | Status |
|--------|--------|--------|
| Build completion time | < 20 min | ⏳ Pending |
| Build success rate | 100% (1st try) | ⏳ Pending |
| App launch time | < 3s | ⏳ Pending |
| Memory usage | < 250 MB | ⏳ Pending |
| APK size | < 35 MB | ⏳ Pending |
| Test device compatibility | 100% (Android 8+) | ⏳ Pending |

---

## Next Steps After F2

### If Android Build Succeeds:
1. ✅ Mark F2 complete
2. ➡️ Proceed to F3: Deploy Backend to Staging
3. ➡️ iOS build can continue in parallel (non-blocking)

### If Build Fails:
1. Review build logs
2. Fix identified issues
3. Re-run validation (`yarn tsc --noEmit`, `yarn test`)
4. Retry build
5. Do not proceed to F3 until build succeeds

---

## F2 Sign-Off (Pending Build Completion)

| Role | Name | Approved | Date |
|------|------|----------|------|
| Engineering Lead | | ⏳ | |
| QA Tester | | ⏳ | |
| DevOps | | ⏳ | |

---

**Next Phase:** F3 - Deploy Backend to Staging (30 min)

**Estimated F2 Completion:** January 16, 2026 (within 20 minutes of build initiation)
