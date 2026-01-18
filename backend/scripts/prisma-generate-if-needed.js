/* eslint-disable no-console */

const { existsSync } = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function anyExists(paths) {
  return paths.some((p) => {
    try {
      return existsSync(p);
    } catch {
      return false;
    }
  });
}

function run() {
  const forceGenerate = String(process.env.PRISMA_FORCE_GENERATE || '').toLowerCase() === 'true';
  const skipGenerate = String(process.env.PRISMA_SKIP_RUNTIME_GENERATE || '').toLowerCase() === 'true';

  if (skipGenerate && !forceGenerate) return 0;

  const backendDir = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(__dirname, '..', '..');

  const markerPaths = [
    // Typical Yarn workspaces hoist location
    path.join(repoRoot, 'node_modules', '.prisma', 'client', 'index.js'),
    path.join(repoRoot, 'node_modules', '.prisma', 'client', 'index.d.ts'),
    // Non-hoisted fallback
    path.join(backendDir, 'node_modules', '.prisma', 'client', 'index.js'),
    path.join(backendDir, 'node_modules', '.prisma', 'client', 'index.d.ts')
  ];

  const hasGeneratedClient = anyExists(markerPaths);
  if (hasGeneratedClient && !forceGenerate) return 0;

  const yarnCmd = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const result = spawnSync(yarnCmd, ['prisma:generate'], {
    cwd: backendDir,
    stdio: 'inherit'
  });

  return typeof result.status === 'number' ? result.status : 1;
}

process.exit(run());
