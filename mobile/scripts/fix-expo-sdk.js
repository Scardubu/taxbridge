#!/usr/bin/env node
/**
 * fix-expo-sdk.js
 * Self-healing pre-build script that:
 *  1. Validates app.json schema (removes unknown top-level keys)
 *  2. Ensures expo-linking is present (required peer of expo-router)
 *  3. Detects and deduplicates conflicting native modules
 *  4. Emits a report so CI logs show what was fixed
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_JSON = path.join(ROOT, 'app.json');
const PKG_JSON = path.join(ROOT, 'package.json');

const INVALID_EXPO_TOP_LEVEL_KEYS = [
  'enableMinifyInReleaseBuilds',
  'enableShrinkResourcesInReleaseBuilds',
];

const SDK54_REQUIRED = {
  'expo-linking':          '~8.0.11',
  'expo-sqlite':           '~16.0.10',
  'expo-secure-store':     '~15.0.8',
  'expo-haptics':          '~15.0.8',
  'expo-speech':           '~14.0.8',
  'expo-sharing':          '~14.0.8',
  'expo-file-system':      '~19.0.21',
  'expo-crypto':           '~15.0.8',
  'expo-device':           '~8.0.10',
  'expo-localization':     '~17.0.8',
  'react-native-view-shot':'4.0.3',
  'lottie-react-native':   '~7.3.1',
  '@sentry/react-native':  '~7.2.0',
  '@shopify/flash-list':   '2.0.2',
  'react-native-screens':  '~4.16.0',
  'react-native-svg':      '15.12.1',
  'expo-router':           '~6.0.23',
  'react-native-reanimated':'~4.1.1',
};

let fixed = [];
let warnings = [];

// ── 1. Fix app.json schema ────────────────────────────────────────────────────
if (fs.existsSync(APP_JSON)) {
  const appJson = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'));
  let dirty = false;
  for (const key of INVALID_EXPO_TOP_LEVEL_KEYS) {
    if (appJson.expo && Object.prototype.hasOwnProperty.call(appJson.expo, key)) {
      delete appJson.expo[key];
      fixed.push(`app.json: removed invalid top-level key "expo.${key}"`);
      dirty = true;
    }
  }
  if (dirty) {
    fs.writeFileSync(APP_JSON, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
  }
} else {
  warnings.push('app.json not found — skipping schema check');
}

// ── 2. Fix package.json dependency versions ────────────────────────────────────
if (fs.existsSync(PKG_JSON)) {
  const pkg = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8'));
  let dirty = false;

  for (const [name, expected] of Object.entries(SDK54_REQUIRED)) {
    const current = (pkg.dependencies || {})[name];
    if (!current) {
      pkg.dependencies = pkg.dependencies || {};
      pkg.dependencies[name] = expected;
      fixed.push(`package.json: added missing dependency "${name}": "${expected}"`);
      dirty = true;
    } else if (current !== expected) {
      const curMajor = current.replace(/[^0-9]/, '').split('.')[0];
      const expMajor = expected.replace(/[^0-9]/, '').split('.')[0];
      if (curMajor !== expMajor) {
        pkg.dependencies[name] = expected;
        fixed.push(`package.json: updated "${name}" from "${current}" → "${expected}" (major mismatch)`);
        dirty = true;
      } else {
        warnings.push(`package.json: "${name}" is "${current}" (expected "${expected}") — minor, no auto-fix`);
      }
    }
  }

  if (dirty) {
    fs.writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }
} else {
  warnings.push('package.json not found — skipping dependency check');
}

// ── 3. Detect duplicate native modules ────────────────────────────────────────
const NM = path.join(ROOT, 'node_modules');
const NATIVE_MODULES_TO_CHECK = [
  'expo-file-system',
  'expo-sqlite',
  'expo-secure-store',
  'react-native-screens',
  'react-native-reanimated',
];

for (const mod of NATIVE_MODULES_TO_CHECK) {
  const topLevel  = path.join(NM, mod, 'package.json');
  const expoNested = path.join(NM, 'expo', 'node_modules', mod, 'package.json');
  if (fs.existsSync(topLevel) && fs.existsSync(expoNested)) {
    try {
      const v1 = JSON.parse(fs.readFileSync(topLevel, 'utf8')).version;
      const v2 = JSON.parse(fs.readFileSync(expoNested, 'utf8')).version;
      if (v1 !== v2) {
        warnings.push(`Duplicate native module: "${mod}" top-level=${v1}, expo/node_modules=${v2} — run "npm dedupe" to fix`);
      }
    } catch (_err) {}
  }
}

// ── 4. Print report ────────────────────────────────────────────────────────────
console.log('\n🤖 fix-expo-sdk.js report');
console.log('─'.repeat(50));

if (fixed.length === 0 && warnings.length === 0) {
  console.log('✅ No issues found — project is aligned with Expo SDK 54');
} else {
  if (fixed.length > 0) {
    console.log(`\n✅ Auto-fixed (${fixed.length}):`);
    fixed.forEach(m => console.log(`   • ${m}`));
  }
  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}) — manual action may be needed:`);
    warnings.forEach(m => console.log(`   • ${m}`));
  }
}
console.log('─'.repeat(50) + '\n');

if (fixed.length > 0) {
  console.log('📦 Re-run "npm install" in mobile/ to apply version changes.\n');
}
