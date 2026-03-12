const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable cache for build
config.cacheStores = [];
config.resetCache = true;

// Add asset extensions
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'db',
  'sqlite',
  'mlmodel',
  'tflite',
  'zip',
  'wav',
  'lottie',
];

// Add source extensions
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'mjs',
  'cjs',
];

// Block test files
config.resolver.blockList = /(.*\/__tests__\/.*|.*\/\..*)/;

module.exports = config;
