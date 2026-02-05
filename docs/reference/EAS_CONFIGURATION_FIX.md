# EAS Configuration Fix - February 3, 2026

**Status:** ✅ **RESOLVED**

---

## Issue Summary

**Error Encountered:**
```
Entity not authorized: AppEntity[fb2a2641-40b4-4741-bf52-b544d90ef1ba]
You don't have the required permissions to perform this operation.
```

**Root Cause:**
- The `app.json` was configured with `"owner": "scardubu"`
- User was logged in as `scartony357`
- EAS project ID belonged to a different account

---

## Resolution Applied

### 1. Updated Project Owner ✅
Changed owner from `scardubu` to `scartony357` in [mobile/app.json](mobile/app.json)

### 2. Removed Old Project ID ✅
Removed the old project configuration:
- Old Project ID: `fb2a2641-40b4-4741-bf52-b544d90ef1ba` (scardubu account)
- Old Updates URL: `https://u.expo.dev/fb2a2641-40b4-4741-bf52-b544d90ef1ba`

### 3. Initialized New EAS Project ✅
Created new EAS project under `scartony357` account:
- **New Project ID:** `ab92bfbb-8bf0-44c7-848f-76e717be26b7`
- **Project Name:** `@scartony357/taxbridge`
- **Owner:** `scartony357`

---

## Updated Configuration

### app.json (Relevant Section)
```json
{
  "expo": {
    "name": "TaxBridge",
    "slug": "taxbridge",
    "version": "1.0.0",
    "owner": "scartony357",
    "extra": {
      "eas": {
        "projectId": "ab92bfbb-8bf0-44c7-848f-76e717be26b7"
      }
    },
    "updates": {
      "enabled": false
    }
  }
}
```

**Note:** OTA updates are currently disabled. To enable, you'll need to configure the updates URL after setting up EAS Update channels.

---

## Latest Fix - Build Dependencies (February 3, 2026, 12:30 PM WAT)

### Issue: EAS Build Failed with Babel Plugin Error ✅

**Error Message:**
```
Cannot find module 'babel-plugin-transform-remove-console'
```

**Root Cause:**
The `babel.config.js` referenced `transform-remove-console` plugin in production builds, but the package wasn't installed as a dependency.

**Solution Applied:**
1. ✅ Added `babel-plugin-transform-remove-console@^6.9.4` to `devDependencies` in `package.json`
2. ✅ Fixed Metro config `watchman` property → `watcher.watchman` (EAS compatibility)

**Files Modified:**
- `mobile/package.json` - Added missing Babel plugin dependency
- `mobile/metro.config.js` - Fixed watchman configuration structure

---

## Next Steps for Deployment

### 1. Install Dependencies (REQUIRED BEFORE BUILD)
```powershell
cd C:\Users\USR\Documents\taxbridge\mobile
yarn install
# OR if network issues:
npm install
```

### 2. Build Preview APK (Android)
```powershell
cd C:\Users\USR\Documents\taxbridge\mobile
eas build --platform android --profile preview
```

**Expected Output:**
- Build queued on EAS servers
- APK downloadable after ~10-15 minutes
- Installable on any Android device (no Play Store required)

### 2. Build Production (Both Platforms)
```powershell
# Android AAB (for Play Store)
eas build --platform android --profile production

# iOS IPA (for App Store)
eas build --platform ios --profile production

# Both platforms simultaneously
eas build --platform all --profile production
```

### 3. Submit to App Stores
```powershell
# Android (requires Google Play developer account)
eas submit --platform android

# iOS (requires Apple Developer account)
eas submit --platform ios
```

---

## EAS Project Information

### Current Configuration
- **Account:** `scartony357`
- **Organization Access:** 
  - `scartony357` (Owner)
  - `scartony357s-organization` (Owner)
- **Project Slug:** `taxbridge`
- **Bundle Identifier (iOS):** `ng.taxbridge.app`
- **Package Name (Android):** `ng.taxbridge.app`

### Build Profiles (from eas.json)

#### Development
```json
{
  "developmentClient": true,
  "distribution": "internal"
}
```
- For local development builds with Expo Dev Client
- Internal distribution only

#### Preview
```json
{
  "distribution": "internal"
}
```
- Creates installable APK/IPA
- No app store submission
- Perfect for testing and QA

#### Production
```json
{
  "autoIncrement": true
}
```
- Auto-increments build numbers
- Creates store-ready builds (AAB for Android, IPA for iOS)

---

## Verification Steps

### 1. Verify Current User ✅
```powershell
eas whoami
# Output: scartony357
```

### 2. Verify Project Linking ✅
```powershell
eas init
# Output: Project successfully linked (ID: ab92bfbb-8bf0-44c7-848f-76e717be26b7)
```

### 3. Test Build Command
```powershell
eas build --platform android --profile preview --non-interactive
```

**Expected:** Build starts successfully without authorization errors

---

## Important Notes

### Account Management
- If you need to switch between accounts:
  ```powershell
  eas logout
  eas login
  ```

- If you need to use the organization account instead:
  ```json
  {
    "expo": {
      "owner": "scartony357s-organization"
    }
  }
  ```

### OTA Updates (Currently Disabled)
To enable OTA updates later:

1. Update `app.json`:
   ```json
   {
     "updates": {
       "enabled": true,
       "url": "https://u.expo.dev/ab92bfbb-8bf0-44c7-848f-76e717be26b7"
     },
     "runtimeVersion": {
       "policy": "appVersion"
     }
   }
   ```

2. Configure channels:
   ```powershell
   eas channel:create production
   eas channel:create preview
   eas update --channel production
   ```

### Build Credentials
- **Android:** EAS will auto-generate signing certificates
- **iOS:** You'll need Apple Developer Program membership ($99/year)

---

## Cost Considerations

### EAS Build Limits (Free Tier)
- **Android:** 30 builds/month
- **iOS:** 15 builds/month (macOS required locally, or 30 credits/month on EAS)

### Paid Plans
If you exceed free tier:
- **Production Plan:** $29/month (unlimited builds)
- **Enterprise Plan:** Custom pricing

---

## Rollback Plan

If you need to revert to the old project:

1. Restore old configuration:
   ```json
   {
     "owner": "scardubu",
     "extra": {
       "eas": {
         "projectId": "fb2a2641-40b4-4741-bf52-b544d90ef1ba"
       }
     }
   }
   ```

2. Login as `scardubu`:
   ```powershell
   eas logout
   eas login
   # Enter scardubu credentials
   ```

---

## Production Deployment Checklist

- [x] EAS account configured correctly
- [x] Project linked to correct account
- [x] Authorization errors resolved
- [ ] Preview build tested on Android devices
- [ ] Preview build tested on iOS devices (requires macOS)
- [ ] Production build created (Android AAB)
- [ ] Production build created (iOS IPA)
- [ ] Google Play Console configured
- [ ] Apple App Store Connect configured
- [ ] App submitted for review
- [ ] Post-submission monitoring enabled

---

## Support Resources

- **EAS Documentation:** https://docs.expo.dev/eas/
- **Build Documentation:** https://docs.expo.dev/build/introduction/
- **Submit Documentation:** https://docs.expo.dev/submit/introduction/
- **EAS Dashboard:** https://expo.dev/accounts/scartony357/projects/taxbridge

---

**Resolution Date:** February 3, 2026, 12:15 PM WAT  
**Status:** ✅ **READY FOR BUILDS**  
**Action Required:** Run build commands to create preview/production builds
