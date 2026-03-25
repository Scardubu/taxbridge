#!/usr/bin/env tsx
/**
 * ai-build.ts — AI Autonomous APK Build Fixer
 * Full clean + realign + doctor + EAS APK build.
 * Run from monorepo root: npm run fix:apk
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const MOBILE_ROOT = path.join(REPO_ROOT, 'mobile');
const CONTRACTS_ROOT = path.join(REPO_ROOT, 'packages', 'contracts');

function run(cmd: string, cwd = REPO_ROOT): void {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd });
}

function runSafe(cmd: string, cwd = REPO_ROOT): boolean {
  try {
    run(cmd, cwd);
    return true;
  } catch {
    return false;
  }
}

function step(n: number, total: number, label: string): void {
  console.log(`\n${'═'.repeat(60)}\n🤖 Step ${n}/${total} — ${label}\n${'═'.repeat(60)}`);
}

const TOTAL = 9;
console.log('\n🤖 TaxBridge AI Autonomous APK Build\n');
console.log('   Env: EAS production-apk profile (cache-free)');
console.log('   Target: Android APK\n');

// ── 1. Build shared contracts ───────────────────────────────────────────────
step(1, TOTAL, 'Build shared contracts');
run('npm run build', CONTRACTS_ROOT);

// ── 2. Fix SDK config drift ────────────────────────────────────────────────
step(2, TOTAL, 'Expo SDK self-healer');
run('node scripts/fix-expo-sdk.js', MOBILE_ROOT);

// ── 3. Clean caches ────────────────────────────────────────────────────────
step(3, TOTAL, 'Clean npm cache (mobile)');
run('npm cache clean --force', MOBILE_ROOT);

// ── 4. Fresh install ───────────────────────────────────────────────────────
step(4, TOTAL, 'npm install (mobile)');
run('npm install', MOBILE_ROOT);

// ── 5. Deduplicate native modules ─────────────────────────────────────────
step(5, TOTAL, 'npm dedupe (mobile)');
run('npm dedupe', MOBILE_ROOT);

// ── 6. Align Expo SDK peer deps ────────────────────────────────────────────
step(6, TOTAL, 'npx expo install --check');
runSafe('npx expo install --check', MOBILE_ROOT);

// ── 7. Validate with expo doctor ───────────────────────────────────────────
step(7, TOTAL, 'expo doctor');
try {
  run('npx expo-doctor', MOBILE_ROOT);
} catch {
  console.error('\n❌ expo doctor found issues — aborting build\n');
  process.exit(1);
}

// ── 8. Prebuild (generates android/ native project) ────────────────────────
step(8, TOTAL, 'expo prebuild --platform android --clean');
run(
  'cross-env CI=1 npx expo prebuild --platform android --clean',
  MOBILE_ROOT,
);

// ── 9. EAS Build — cache-free APK ─────────────────────────────────────────
step(9, TOTAL, 'EAS build: production-apk (cache-free)');
run(
  'cross-env EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile production-apk --clear-cache --non-interactive',
  MOBILE_ROOT,
);

console.log('\n✅ AI Autonomous APK Build completed successfully\n');
