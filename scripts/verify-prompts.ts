#!/usr/bin/env tsx
/**
 * TaxBridge — Prompt Module Verification Script  (COMP-09)
 *
 * Verifies that all required MASTER prompt module files are present and
 * non-empty. Exits 1 if any are missing or empty; exits 0 on full pass.
 *
 * Usage:
 *   npx tsx scripts/verify-prompts.ts
 *   # or as pre-commit hook / CI step
 */

import fs from 'fs';
import path from 'path';

// ─── Module Registry ─────────────────────────────────────────────────────────
// The 11 required prompt modules for TaxBridge V12 Apex execution.
// Each entry is relative to the workspace root.

const REQUIRED_PROMPT_MODULES: Array<{ file: string; description: string }> = [
  {
    file: 'prompts/core/M00-identity-rules.md',
    description: 'M00 — Core Identity & System Rules',
  },
  {
    file: 'prompts/backend/M01-backend-architecture.md',
    description: 'M01 — Backend Architecture',
  },
  {
    file: 'prompts/mobile/M02-mobile-ux.md',
    description: 'M02 — Mobile UX & Offline-First',
  },
  {
    file: 'prompts/ai/M03-ai-intelligence.md',
    description: 'M03 — AI Intelligence',
  },
  {
    file: 'prompts/payments/M04-payments-compliance.md',
    description: 'M04 — Payments & Compliance',
  },
  {
    file: 'prompts/data/M05-data-tax-engine.md',
    description: 'M05 — Data & Tax Engine',
  },
  {
    file: 'prompts/devops/M06-deployment-devops.md',
    description: 'M06 — Deployment & DevOps',
  },
  {
    file: 'prompts/monetization/M07-monetization-analytics.md',
    description: 'M07 — Monetization & Analytics',
  },
  {
    file: 'prompts/mobile/M08-dashboard-ux-patterns.md',
    description: 'M08 — Dashboard UX Patterns',
  },
  {
    file: 'prompts/mobile/M09-enhancement-integration.md',
    description: 'M09 — Enhancement Integration',
  },
  {
    file: 'prompts/TAXBRIDGE_V12_MASTER_PROMPT.md',
    description: 'V12 — Master Prompt',
  },
  {
    file: 'prompts/taxbridge_production_architecture_module.md',
    description: 'V12 — Production Architecture Module',
  },
];

// ─── Run ─────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');

interface Result {
  file: string;
  description: string;
  status: 'ok' | 'missing' | 'empty';
  sizeBytes?: number;
}

function verifyPrompts(): void {
  console.log('\nTaxBridge V12 — Prompt Module Verification (COMP-09 — 12 modules)');
  console.log('='.repeat(60));

  const results: Result[] = REQUIRED_PROMPT_MODULES.map(({ file, description }) => {
    const absPath = path.join(ROOT, file);

    if (!fs.existsSync(absPath)) {
      return { file, description, status: 'missing' };
    }

    const stat = fs.statSync(absPath);
    if (stat.size === 0) {
      return { file, description, status: 'empty', sizeBytes: 0 };
    }

    return { file, description, status: 'ok', sizeBytes: stat.size };
  });

  let pass = 0;
  let fail = 0;

  for (const r of results) {
    const icon  = r.status === 'ok' ? '✅' : '❌';
    const badge = r.status === 'ok'
      ? `ok  (${r.sizeBytes?.toLocaleString()} bytes)`
      : r.status.toUpperCase();
    console.log(`${icon}  ${r.description.padEnd(45)} ${badge}`);
    r.status === 'ok' ? pass++ : fail++;
  }

  console.log('='.repeat(60));
  console.log(`Result: ${pass}/${results.length} modules present`);

  if (fail > 0) {
    console.error(`\n❌ FAIL — ${fail} module(s) are missing or empty.`);
    console.error(
      'Create the missing prompt files before proceeding with V12 execution.\n',
    );
    process.exit(1);
  }

  console.log('\n✅ PASS — All required prompt modules are present.\n');
  process.exit(0);
}

verifyPrompts();
