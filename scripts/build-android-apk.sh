#!/bin/bash

echo "🔨 Building TaxBridge Android APK..."

# Navigate to mobile directory
cd mobile

# Set environment variables
export EXPO_NO_DOCTOR=1
export EXPO_OFFLINE=1
export EXPO_PUBLIC_ENV=production
export EXPO_PUBLIC_API_URL=https://taxbridge-api-ker8.onrender.com

# Use local expo CLI
node ../node_modules/.bin/expo export --platform android --output-dir dist

if [ $? -eq 0 ]; then
  echo "✅ Build completed successfully!"
  echo "📁 Build artifacts in mobile/dist/"
else
  echo "❌ Build failed!"
  exit 1
fi
