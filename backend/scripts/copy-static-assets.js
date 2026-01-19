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
  const distDataDir = path.join(backendDir, 'dist', 'src', 'data');

  try {
    const result = copyDir(srcDataDir, distDataDir);
    if (result.copied) {
      console.log(`✅ Copied static assets: ${srcDataDir} → ${distDataDir}`);
    } else {
      console.log(`ℹ️  No static assets copied (${result.reason})`);
    }
  } catch (err) {
    console.error('❌ Failed to copy static assets', err);
    process.exit(1);
  }
}

main();
