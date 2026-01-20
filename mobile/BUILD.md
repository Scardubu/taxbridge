# TaxBridge Mobile Build Guide

## Building Android APK for Production

This guide explains how to build the TaxBridge mobile app as an Android APK using EAS Build.

### Prerequisites

1. **EAS CLI** - Install globally:
   ```bash
   npm install -g eas-cli
   ```

2. **Expo Account** - You need to be logged in:
   ```bash
   eas login
   ```
   
   Or set the `EXPO_TOKEN` environment variable:
   ```bash
   export EXPO_TOKEN=your_expo_token_here
   ```

3. **Project Configuration** - Already configured in `eas.json`

### Quick Start

The command requested in the problem statement was:
```bash
eas build --platform android --type apk --profile production
```

However, EAS CLI doesn't support the `--type` flag. Build types are configured in `eas.json`. The production profile has been configured to build APK format.

#### Option 1: Using npm script (Recommended)

```bash
cd mobile/
npm run build:android:apk
```

#### Option 2: Using shell script

```bash
cd mobile/
./build-android-apk.sh
```

#### Option 3: Direct command

```bash
cd mobile/
eas build --platform android --profile production
```

### Build Configuration

The build configuration is defined in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.taxbridge.ng",
        "EXPO_PUBLIC_ENV": "production",
        "EXPO_PUBLIC_SENTRY_DSN": "https://prod@sentry.io/project",
        "EXPO_PUBLIC_MIXPANEL_TOKEN": "prod_mixpanel_token"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production-aab": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.taxbridge.ng",
        "EXPO_PUBLIC_ENV": "production",
        "EXPO_PUBLIC_SENTRY_DSN": "https://prod@sentry.io/project",
        "EXPO_PUBLIC_MIXPANEL_TOKEN": "prod_mixpanel_token"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

**Note:** The `production` profile builds APK format, while `production-aab` builds Android App Bundle (AAB) format for Google Play Store submission.

### Build Types Explained

| Build Type | Profile | Use Case | File Extension |
|------------|---------|----------|----------------|
| **APK** | `production` | Direct installation, testing, side-loading | `.apk` |
| **App Bundle** | `production-aab` | Google Play Store submission | `.aab` |

### Available Build Scripts

All scripts are defined in `package.json`:

```bash
# Build Android APK (production profile)
npm run build:android:apk

# Build Android App Bundle (production-aab profile)
npm run build:android:bundle

# Build iOS (production profile)
npm run build:ios

# Build for all platforms (production profile)
npm run build:all
```

### Build Profiles

The project supports multiple build profiles:

1. **Development** - Local testing with dev client
   ```bash
   eas build --platform android --profile development
   ```

2. **Staging** - Internal testing with staging API
   ```bash
   eas build --platform android --profile staging
   ```

3. **Preview** - Pre-production testing
   ```bash
   eas build --platform android --profile preview
   ```

4. **Production** - Production release (APK format)
   ```bash
   eas build --platform android --profile production
   ```

5. **Production AAB** - Production release for Play Store (App Bundle format)
   ```bash
   eas build --platform android --profile production-aab
   ```

### Environment Variables

Each profile uses different environment variables:

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | `https://api-staging.taxbridge.ng` | `https://api.taxbridge.ng` |
| `EXPO_PUBLIC_ENV` | `development` | `staging` | `production` |
| `EXPO_PUBLIC_SENTRY_DSN` | - | Staging DSN | Production DSN |
| `EXPO_PUBLIC_MIXPANEL_TOKEN` | - | Staging token | Production token |

### Monitoring Build Progress

1. **CLI Output** - Watch the terminal for build progress
2. **EAS Dashboard** - Visit https://expo.dev/accounts/scardubu/projects/taxbridge/builds
3. **Email Notifications** - You'll receive emails on build completion/failure

### Build Artifacts

After a successful build:

1. **Download Link** - Available in CLI output and EAS dashboard
2. **QR Code** - Scan to install directly on Android device
3. **Expiration** - Links expire after 30 days

### Installing the APK

#### On Physical Device

1. Download APK from EAS dashboard
2. Enable "Install from Unknown Sources" in Android settings
3. Tap the APK file to install

#### On Android Emulator

```bash
adb install path/to/taxbridge.apk
```

### Troubleshooting

#### "Not logged in" Error

```bash
# Solution: Login to Expo
eas login

# Or use token
export EXPO_TOKEN=your_token_here
```

#### "eas.json not found" Error

```bash
# Solution: Make sure you're in the mobile/ directory
cd mobile/
eas build --platform android --type apk --profile production
```

#### Build Failed on EAS

1. Check the build logs in the EAS dashboard
2. Common issues:
   - Missing credentials (keystore)
   - Invalid app.json configuration
   - Dependency resolution failures
3. Re-run with `--clear-cache` flag:
   ```bash
   eas build --platform android --type apk --profile production --clear-cache
   ```

#### Keystore/Credentials Issues

EAS Build automatically manages Android keystores. If you need to use a custom keystore:

```bash
# Configure credentials interactively
eas credentials

# Or specify in eas.json
{
  "build": {
    "production": {
      "android": {
        "credentialsSource": "local"
      }
    }
  }
}
```

### CI/CD Integration

The build command is already integrated in GitHub Actions workflow `.github/workflows/deploy-production.yml`:

```yaml
- name: Build and submit
  working-directory: ./mobile
  run: |
    eas build --platform all --profile production --non-interactive
```

To run the Android APK build specifically in CI:

```yaml
- name: Build Android APK
  working-directory: ./mobile
  env:
    EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
  run: |
    eas build --platform android --type apk --profile production --non-interactive
```

### Best Practices

1. **Always test builds** - Test APKs thoroughly before production deployment
2. **Use App Bundles for Play Store** - Google Play prefers AAB format
3. **Version Management** - Update `version` and `versionCode` in `app.json` before building
4. **Environment Separation** - Use appropriate profiles for each environment
5. **Credential Security** - Never commit keystores or credentials to git

### Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Android App Bundle vs APK](https://docs.expo.dev/build-reference/apk/)
- [Managing Credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [CI/CD with EAS Build](https://docs.expo.dev/build/building-on-ci/)

## Building for Other Platforms

### iOS

```bash
# Build for iOS (requires Mac for local builds, or use EAS Build)
npm run build:ios
```

### All Platforms

```bash
# Build for both Android and iOS
npm run build:all
```

## Support

For build issues:
- Check [EAS Build Status](https://status.expo.dev/)
- Review [Expo Forums](https://forums.expo.dev/)
- Open a GitHub issue with build logs

---

**Last Updated:** January 2026  
**TaxBridge Version:** 5.0.2  
**EAS CLI Version:** 6.0.0+
