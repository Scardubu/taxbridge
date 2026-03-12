const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Use file:// URL for Windows compatibility
const projectRoot = path.resolve(__dirname);
const config = getDefaultConfig(projectRoot);

config.cacheStores = [];
config.resetCache = true;

config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, '../packages'),
];

config.resolver.unstable_enablePackageExports = true;

config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles'];

config.transformer.minifierConfig = {
  compress: {
    drop_console:  process.env.NODE_ENV === 'production',
    drop_debugger: true,
    pure_funcs:    process.env.NODE_ENV === 'production'
      ? ['console.log', 'console.debug', 'console.info']
      : [],
  },
  mangle: {
    keep_fnames: false,
  },
};

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

// Reanimated 4.x worklet runtime — required for condition-based package resolution
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'mjs',
  'cjs',
];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules'),
];

config.resolver.blockList = /(.*\/__tests__\/.*|.*\/\..*)/;

module.exports = config;
