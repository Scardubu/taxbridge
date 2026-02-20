const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);

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
    drop_console: process.env.NODE_ENV === 'production',
    drop_debugger: true,
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
];

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
