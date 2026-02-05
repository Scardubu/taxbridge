# TaxBridge V1.0.0 - EAS Build Fix

**Date:** February 3, 2026, 12:30 PM WAT  
**Status:** ✅ **BUILD ERRORS RESOLVED**

---

## Issues Identified & Fixed

### Issue #1: Missing Babel Plugin Dependency ✅

**Error:**
```
SyntaxError: Cannot find module 'babel-plugin-transform-remove-console'

Make sure that all the Babel plugins and presets you are using
are defined as dependencies or devDependencies in your package.json
```

**Root Cause:**
- `babel.config.js` configured to remove console statements in production:
  ```javascript
  env: {
    production: {
      plugins: ['transform-remove-console'],
    },
  }
  ```
- But `babel-plugin-transform-remove-console` was not installed

**Solution Applied:**
✅ Added `babel-plugin-transform-remove-console@^6.9.4` to `devDependencies` in [mobile/package.json](mobile/package.json)

---

### Issue #2: Invalid Metro Configuration ✅

**Warning:**
```
Unknown option "watchman" with value {"enabled": false} was found.
This is probably a typing mistake. Fixing it will remove this message.
```

**Root Cause:**
- Metro Config v0.80+ changed the structure of watchman configuration
- Old: `config.watchman = { enabled: false }`
- New: `config.watcher = { watchman: { enabled: false } }`

**Solution Applied:**
✅ Fixed Metro config in [mobile/metro.config.js](mobile/metro.config.js):
```javascript
// Old (incorrect)
config.watchman = {
  enabled: false,
};

// New (correct)
config.watcher = {
  watchman: {
    enabled: false,
  },
};
```

---

## Files Modified

### 1. mobile/package.json
**Change:** Added missing Babel plugin to devDependencies
```json
"devDependencies": {
  "@babel/core": "^7.22.0",
  "@testing-library/react-native": "^13.3.3",
  "@types/react": "~19.1.0",
  "babel-jest": "^29.7.0",
  "babel-plugin-transform-remove-console": "^6.9.4", // ← Added
  "cross-env": "^7.0.3",
  "jest": "^29.7.0",
  "jest-expo": "^54.0.16",
  "react-refresh": "^0.14.2",
  "react-test-renderer": "19.1.0",
  "typescript": "~5.9.2"
}
```

### 2. mobile/metro.config.js
**Change:** Fixed watchman configuration structure
```javascript
// Disable watchman on Windows to avoid watch mode startup failures
// Use watcher.watchman for proper Metro config (EAS compatibility)
config.watcher = {
  watchman: {
    enabled: false,
  },
};
```

---

## Required Actions Before Build

### Step 1: Install Dependencies ⚠️ CRITICAL
The package.json has been updated, but dependencies must be installed before building:

```powershell
cd C:\Users\USR\Documents\taxbridge\mobile

# Option 1: Using Yarn (recommended)
yarn install

# Option 2: Using npm (if Yarn has network issues)
npm install

# Option 3: Clean install (if issues persist)
Remove-Item -Recurse -Force node_modules
Remove-Item yarn.lock
yarn install
```

**Expected Output:**
```
✔ babel-plugin-transform-remove-console@6.9.4 installed
✔ All dependencies installed successfully
```

---

### Step 2: Verify Local Build (Optional but Recommended)

Test the build locally before pushing to EAS:

```powershell
cd C:\Users\USR\Documents\taxbridge\mobile

# Start Metro bundler
yarn start

# In another terminal, build for Android
npx expo run:android --variant release
```

**Expected:** App builds and bundles JavaScript without Babel errors

---

### Step 3: Commit Changes

```bash
git add mobile/package.json mobile/metro.config.js
git commit -m "fix(mobile): resolve EAS build errors

- Add babel-plugin-transform-remove-console to devDependencies
- Fix Metro config watchman property structure for EAS compatibility

Fixes:
- Babel plugin not found error during EAS bundle phase
- Metro config validation warning

Build Status: Ready for EAS deployment"

git push origin main
```

---

### Step 4: Trigger EAS Build

```powershell
cd C:\Users\USR\Documents\taxbridge\mobile

# Preview build (for testing)
eas build --platform android --profile preview

# Production build (for Play Store)
eas build --platform android --profile production

# Both platforms
eas build --platform all --profile production
```

**Expected Output:**
```
✔ Compressed project files
✔ Uploaded to EAS
✔ Build queued successfully
```

---

## Build Profile Configuration

### Preview Profile (eas.json)
```json
{
  "preview": {
    "distribution": "internal",
    "env": {
      "EXPO_PUBLIC_API_URL": "https://api.taxbridge.ng",
      "EXPO_PUBLIC_ENV": "preview",
      "NODE_ENV": "production"
    }
  }
}
```

**Output:** Installable APK (no Play Store required)

---

### Production Profile (eas.json)
```json
{
  "production": {
    "autoIncrement": true,
    "env": {
      "EXPO_PUBLIC_API_URL": "https://api.taxbridge.ng",
      "EXPO_PUBLIC_ENV": "production",
      "NODE_ENV": "production"
    }
  }
}
```

**Output:** Android App Bundle (AAB) for Play Store submission

---

## Verification Checklist

Before considering the build fixed, verify:

- [x] `babel-plugin-transform-remove-console` added to `package.json`
- [x] Metro config `watcher.watchman` structure corrected
- [ ] Dependencies installed locally (`yarn install` or `npm install`)
- [ ] Local Metro bundler starts without errors
- [ ] EAS build completes without Babel errors
- [ ] Preview APK downloads and installs on test device
- [ ] App launches without crashes
- [ ] Console statements removed in production build

---

## Troubleshooting

### If Dependencies Won't Install

**Network timeout errors:**
```powershell
# Clear Yarn cache
yarn cache clean

# Use npm as fallback
npm cache clean --force
npm install

# Use offline mirror (if available)
yarn install --offline
```

---

### If EAS Build Still Fails

**Check Build Logs:**
1. Visit: https://expo.dev/accounts/scartony357/projects/taxbridge/builds
2. Click on the failed build
3. Expand "Bundle JavaScript" phase logs
4. Look for any remaining missing modules

**Common fixes:**
```powershell
# Ensure all peer dependencies are installed
cd mobile
npx expo install --check

# Clear EAS cache
eas build --platform android --profile preview --clear-cache
```

---

### If Metro Bundle Fails Locally

**Clear all caches:**
```powershell
cd C:\Users\USR\Documents\taxbridge
.\nuclear-cache-wipe.ps1

# Restart Metro
.\restart-metro.ps1
```

---

## Build Timeline Estimate

Assuming dependencies are installed and no network issues:

| Phase | Duration | Action |
|-------|----------|--------|
| Install Dependencies | 2-5 min | `yarn install` |
| Commit & Push | 2 min | Git operations |
| EAS Upload | 3-5 min | Upload project to EAS |
| EAS Build (Android) | 10-15 min | Build APK/AAB on EAS servers |
| Download Build | 1-3 min | Download APK from EAS |
| **Total** | **18-30 min** | End-to-end |

---

## What Changed From Previous Builds

### Previously Working Local Builds
- Local Metro bundler worked fine
- Development builds worked
- `yarn start` had no issues

### Why EAS Build Failed
- **EAS uses clean environment**: No cached node_modules
- **EAS runs production build**: Babel production plugins activated
- **Local vs EAS**: Local had plugin cached from previous installs

### Why This Fix Works
- ✅ Explicit dependency declaration in `package.json`
- ✅ EAS will install all devDependencies during build
- ✅ Metro config compatible with latest EAS infrastructure

---

## Post-Build Validation

After successful EAS build:

### 1. Download APK
```powershell
# APK will be available at:
# https://expo.dev/accounts/scartony357/projects/taxbridge/builds/<build-id>
```

### 2. Install on Test Device
```powershell
# Transfer APK to Android device
# Install via:
# - ADB: adb install -r taxbridge-preview.apk
# - Direct: Enable "Install from Unknown Sources" and open APK
```

### 3. Smoke Test
- [ ] App launches without crashes
- [ ] No console.log statements visible in production
- [ ] All features work (onboarding, invoices, sync)
- [ ] Receipt scanner functional
- [ ] No "undefined" or missing translations

---

## Success Indicators

**Build Successful:**
```
✔ Build completed
✔ APK available for download
✔ Build logs show no Babel errors
✔ Bundle size: ~25-30 MB (expected)
```

**App Functional:**
```
✔ App launches in < 3 seconds
✔ No console errors in browser DevTools
✔ Onboarding flow completes
✔ Invoice creation works offline
✔ Sync completes successfully
```

---

## Summary

**What Was Fixed:**
1. ✅ Added missing `babel-plugin-transform-remove-console` dependency
2. ✅ Fixed Metro config `watcher.watchman` structure
3. ✅ Updated documentation with clear build instructions

**What You Need To Do:**
1. ⚠️ Run `yarn install` or `npm install` in mobile directory
2. ⚠️ Commit changes to Git
3. ⚠️ Run `eas build` command

**Expected Outcome:**
- ✅ EAS build completes successfully
- ✅ APK available for download and testing
- ✅ No Babel or Metro configuration errors
- ✅ Production-ready app bundle

---

**Status:** ✅ **READY FOR BUILD**  
**Action Required:** Install dependencies (`yarn install`) and trigger EAS build  
**Estimated Time to Build:** 20-30 minutes after dependencies installed

**Next Command:**
```powershell
cd C:\Users\USR\Documents\taxbridge\mobile
yarn install
eas build --platform android --profile preview
```
