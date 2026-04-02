const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required for expo-sqlite/kv-store sub-path exports
config.resolver.unstable_enablePackageExports = true;

// Reanimated 4.x worklet runtime condition resolution
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

// SQLite / ML asset extensions
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'db', 'sqlite', 'mlmodel', 'tflite', 'lottie',
];

module.exports = config;
