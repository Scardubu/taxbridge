# TaxBridge EAS Build Commands

> **📁 Config Location**: All commands below use `mobile/eas.json` (NOT root `eas.json`).
> The root `eas.json` is for workspace-level tooling only. Mobile builds use `mobile/eas.json`
> which includes zero-cache settings, Gradle flags, and production API URLs.

## Development Build (Internal Testing)

```bash
# Android APK (fastest for testing)
eas build --platform android --profile development --clear-cache --no-wait

# iOS Simulator
eas build --platform ios --profile development --clear-cache --no-wait
```

## Preview Build (Staging/QA)

```bash
# Both platforms
eas build --platform all --profile preview --clear-cache --no-wait

# Android only
eas build --platform android --profile preview --clear-cache

# iOS only
eas build --platform ios --profile preview --clear-cache
```

## Production Build (App Store Submission)

### Pre-Build Checklist
- [ ] Run: `pwsh scripts/nuclear-cache-wipe.ps1 -IncludeGlobal`
- [ ] Run: `npx expo-doctor` (fix all warnings)
- [ ] Run: `npx expo prebuild --clean`
- [ ] Verify: `mobile/eas.json` production profile has `cache.disabled: true`
- [ ] Verify: Environment variables in EAS dashboard
- [ ] Commit all changes to git

### Build Commands

```bash
# Android (Google Play)
eas build --platform android --profile production --clear-cache

# iOS (App Store)
eas build --platform ios --profile production --clear-cache

# Both platforms
eas build --platform all --profile production --clear-cache

# With auto-submit (if configured)
eas build --platform all --profile production --clear-cache --auto-submit
```

## Emergency Rebuild (Cache Still Persists)

When cache still appears despite all efforts:

```bash
# 1. Nuclear wipe
pwsh scripts/nuclear-cache-wipe.ps1 -IncludeGlobal -Verbose

# 2. Clean prebuild
npx expo prebuild --clean

# 3. Force complete rebuild
eas build --platform android --profile production --clear-cache --no-cache

# 4. If still failing, delete .eas directory locally
rm -rf .eas
eas build --platform android --profile production --clear-cache
```

## Download & Install Build

```bash
# Download latest build
eas build:download --platform android --profile production

# Install on connected device
adb install -r taxbridge-production.apk

# View logs
adb logcat | grep -i taxbridge
```

## Troubleshooting

### Build fails with `ENOENT: no such file or directory, open '/home/expo/workingdir/build/mobile/android/gradlew'`
**Cause:** EAS detected a native Android project locally, but the committed repo snapshot uploaded to EAS did not include the full `android/` directory.

**Fix:**
```bash
# Ensure native Android project files are tracked
git add android

# Keep only local secrets/artifacts ignored
git add .gitignore android/.gitignore

# Commit before EAS build when requireCommit=true
git commit -m "fix(build): commit native android project for EAS"

# Re-run the APK build
eas build --platform android --profile production-apk --clear-cache --no-wait
```

**Verification:**
```bash
git ls-files android/gradlew android/build.gradle android/settings.gradle android/app/build.gradle
```

The command above must print all four files before triggering a cloud build.

### Build fails with "cached dependency" error
**Solution:** Verify all cache environment variables in `mobile/eas.json`:
```bash
cat mobile/eas.json | jq '.build.production.env'
```

### Environment variables not updating
**Solution:** Clear Metro cache specifically:
```bash
rm -rf $TMPDIR/metro-*
METRO_CACHE_DISABLED=1 eas build --platform android --profile production --clear-cache
```

### Assets (icons/splash) not updating
**Solution:** Bump `runtimeVersion` in `app.json`:
```bash
# Change from:
"runtimeVersion": {
  "policy": "appVersion"
}

# To:
"runtimeVersion": "1.0.1"  # Increment on every asset change
```
