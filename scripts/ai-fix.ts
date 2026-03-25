#!/usr/bin/env tsx
/**
 * ai-fix.ts — AI-orchestrated dependency & config fixer
 * Runs from monorepo root. Safe: reads, validates, patches manifests only.
 * Does NOT delete node_modules or lock files (use ai-build.ts for full clean).
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

function step(label: string): void {
  console.log(`\n${'─'.repeat(60)}\n🔧 ${label}\n${'─'.repeat(60)}`);
}

console.log('\n🤖 TaxBridge AI Fix — Expo SDK + Monorepo Integrity\n');

// ── Step 1: Build shared contracts ──────────────────────────────────────────
step('Step 1/5 — Build shared contracts');
run('npm run build', CONTRACTS_ROOT);

// ── Step 2: Fix mobile Expo SDK config & dependency drift ──────────────────
step('Step 2/5 — Run mobile Expo SDK self-healer');
run('node scripts/fix-expo-sdk.js', MOBILE_ROOT);

// ── Step 3: Install mobile dependencies cleanly ────────────────────────────
step('Step 3/5 — npm install (mobile)');
run('npm install --prefer-offline', MOBILE_ROOT);

// ── Step 4: Deduplicate native modules ─────────────────────────────────────
step('Step 4/5 — npm dedupe (mobile)');
run('npm dedupe', MOBILE_ROOT);

// ── Step 5: Expo doctor validation ────────────────────────────────────────
step('Step 5/5 — expo doctor');
try {
  run('npx expo-doctor', MOBILE_ROOT);
  console.log('\n✅ ai-fix complete — expo doctor passed\n');
} catch {
  console.error('\n❌ expo doctor still reports issues — check output above\n');
  process.exit(1);
}
