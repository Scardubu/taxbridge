/**
 * Metro configuration for React Native
 * Forces single React instance across monorepo
 * Optimized for Windows file watcher performance
 * EAS Build compatible
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
// For EAS builds, always include workspace node_modules
const isEASBuild = process.env.EAS_BUILD === 'true';
config.watchFolders = [projectRoot];

if (isEASBuild || process.platform !== 'win32') {
  config.watchFolders.push(path.join(workspaceRoot, 'node_modules'));
}

// Force single React resolution (critical for hooks)
// Point to workspace root node_modules for shared dependencies
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      // Check if module exists in workspace root first
      const workspaceModule = path.join(workspaceRoot, 'node_modules', name);
      if (require('fs').existsSync(workspaceModule)) {
        return workspaceModule;
      }
      // Fallback to project node_modules
      return path.join(projectRoot, 'node_modules', name);
    },
  }
);

// Block nested React instances (but allow direct project/node_modules)
config.resolver.blockList = [
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
