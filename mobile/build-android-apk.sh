#!/bin/bash
# Script to build Android APK for production using EAS Build
# Usage: ./build-android-apk.sh

set -e

echo "🚀 Starting TaxBridge Android APK build (production profile)"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g eas-cli
fi

# Check if authenticated with Expo
if ! eas whoami &> /dev/null; then
    echo "⚠️  Not logged in to Expo. Please authenticate:"
    echo "   Run: eas login"
    echo "   Or set EXPO_TOKEN environment variable"
    exit 1
fi

# Verify eas.json exists
if [ ! -f "eas.json" ]; then
    echo "❌ eas.json not found. Are you in the mobile/ directory?"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""
echo "📦 Building Android APK with production profile..."
echo "   Platform: Android"
echo "   Build Type: APK"
echo "   Profile: production"
echo ""

# Run the build command
eas build --platform android --type apk --profile production

echo ""
echo "✅ Build complete! Check EAS dashboard for download link:"
echo "   https://expo.dev/accounts/scardubu/projects/taxbridge/builds"
