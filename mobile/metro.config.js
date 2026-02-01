/**
 * Metro configuration for React Native
 * Forces single React instance across monorepo
 * Optimized for Windows file watcher performance
 * 
 * @format
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get workspace root (one level up from mobile/)
const workspaceRoot = path.resolve(__dirname, '..');
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Watch only necessary folders to avoid Windows file watcher timeout
// Don't watch workspace root - watch only what we need
config.watchFolders = [
  projectRoot, // mobile folder
  path.resolve(workspaceRoot, 'shared'), // shared components if they exist
];

// Increase file watcher timeout
config.watchman = {
  enabled: true,
  watch_timeout_ms: 60000, // Increase from default 30000
};

// Force single React resolution (critical for hooks)
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
  'react-native-web': path.resolve(workspaceRoot, 'node_modules/react-native-web'),
  'react-i18next': path.resolve(workspaceRoot, 'node_modules/react-i18next'),
  'i18next': path.resolve(workspaceRoot, 'node_modules/i18next'),
  'use-sync-external-store': path.resolve(workspaceRoot, 'node_modules/use-sync-external-store'),
};

// Block nested React instances
config.resolver.blockList = [
  // Prevent mobile/node_modules/react
  new RegExp(`${path.resolve(projectRoot, 'node_modules/react')}/.*`),
  new RegExp(`${path.resolve(projectRoot, 'node_modules/react-dom')}/.*`),
  new RegExp(`${path.resolve(projectRoot, 'node_modules/react-i18next')}/.*`),
  new RegExp(`${path.resolve(projectRoot, 'node_modules/i18next')}/.*`),
  // Prevent nested use-sync-external-store (causes React context issues)
  /node_modules\/.*\/node_modules\/react\/.*/,
  /node_modules\/.*\/node_modules\/react-dom\/.*/,
  /node_modules\/.*\/node_modules\/use-sync-external-store\/.*/,
];

// Always resolve from workspace root first
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = config;
