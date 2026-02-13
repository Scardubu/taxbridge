#!/usr/bin/env node

/**
 * TaxBridge — Copy static runtime assets into dist
 *
 * TypeScript compilation does not copy non-TS assets.
 * This script copies `src/data` into `dist/src/data` so runtime file reads work
 * in Render/production.
 */

const fs = require('fs');
const path = require('path');

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    return { copied: false, reason: 'source-missing' };
  }

  fs.mkdirSync(destDir, { recursive: true });

  // Node 16+ supports fs.cpSync
  fs.cpSync(srcDir, destDir, { recursive: true, force: true });
  return { copied: true };
}

function main() {
  const backendDir = path.resolve(__dirname, '..');

  const srcDataDir = path.join(backendDir, 'src', 'data');

  // TypeScript may output to dist/src/ or dist/backend/src/ depending on
  // rootDir inference (monorepo path imports can expand rootDir to repo root).
  // Detect the actual structure by checking for the compiled server entry point.
  const nestedServerPath = path.join(backendDir, 'dist', 'backend', 'src', 'server.js');
  const flatServerPath = path.join(backendDir, 'dist', 'src', 'server.js');

  const destinations = [];

  if (fs.existsSync(nestedServerPath)) {
    // tsc produced dist/backend/src/ structure
    destinations.push(path.join(backendDir, 'dist', 'backend', 'src', 'data'));
  }
  if (fs.existsSync(flatServerPath)) {
    // tsc produced dist/src/ structure
    destinations.push(path.join(backendDir, 'dist', 'src', 'data'));
  }

  // Fallback: always include both so it works regardless
  if (destinations.length === 0) {
    destinations.push(path.join(backendDir, 'dist', 'src', 'data'));
    destinations.push(path.join(backendDir, 'dist', 'backend', 'src', 'data'));
  }

  try {
    let copied = false;
    for (const distDataDir of destinations) {
      const result = copyDir(srcDataDir, distDataDir);
      if (result.copied) {
        console.log(`✅ Copied static assets: ${srcDataDir} → ${distDataDir}`);
        copied = true;
      }
    }
    if (!copied) {
      console.log(`ℹ️  No static assets copied (source missing: ${srcDataDir})`);
    }
  } catch (err) {
    console.error('❌ Failed to copy static assets', err);
    process.exit(1);
  }
}

main();
