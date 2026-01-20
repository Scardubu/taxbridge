# Quick Start: Building Android APK

## To run the build command requested in the problem statement:

```bash
cd mobile/
eas build --platform android --profile production
```

**Note:** The original command included `--type apk`, but EAS CLI doesn't support that flag. The build type is configured in `eas.json` instead, where the `production` profile is set to build APK format.

## Prerequisites

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Authenticate with Expo**:
   ```bash
   eas login
   ```
   
   Or set environment variable:
   ```bash
   export EXPO_TOKEN=your_expo_token_here
   ```

## Alternative Methods

### Using npm script:
```bash
npm run build:android:apk
```

### Using the provided script:
```bash
./build-android-apk.sh
```

## More Information

See [BUILD.md](./BUILD.md) for comprehensive build documentation including:
- All build profiles (development, staging, preview, production)
- Environment variables
- Troubleshooting guide
- CI/CD integration examples
