const { execSync } = require('child_process');

console.log('🔨 Building TaxBridge Android APK...');

// Set environment variables
process.env.EXPO_NO_DOCTOR = '1';
process.env.EXPO_OFFLINE = '1';
process.env.EXPO_PUBLIC_ENV = 'production';
process.env.EXPO_PUBLIC_API_URL = 'https://taxbridge-api-ker8.onrender.com';

try {
  // Build using Expo CLI directly
  console.log('📦 Starting build process...');
  
  // Use expo export to create a production build
  execSync('npx --yes expo@54 export --platform android --output-dir dist', {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  console.log('✅ Build completed successfully!');
  console.log('📁 APK location: mobile/dist/android-apk/');
  
} catch (err) {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
}
