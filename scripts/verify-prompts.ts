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
    file: 'prompts/M00_CORE_IDENTITY.md',
    description: 'M00 — Core Identity & System Rules',
  },
  {
    file: 'prompts/M01_BACKEND_CONTRACTS.md',
    description: 'M01 — Backend & Contracts Layer',
  },
  {
    file: 'prompts/M02_MOBILE_UX.md',
    description: 'M02 — Mobile UX & Offline-First',
  },
  {
    file: 'prompts/M03_ADMIN_DASHBOARD.md',
    description: 'M03 — Admin Dashboard',
  },
  {
    file: 'prompts/M04_TAX_ENGINE.md',
    description: 'M04 — Tax Engine & Compliance Rules',
  },
  {
    file: 'prompts/M05_NRS_DIGITAX.md',
    description: 'M05 — NRS / DigiTax Integration',
  },
  {
    file: 'prompts/M06_PAYMENTS.md',
    description: 'M06 — Payments & Reconciliation',
  },
  {
    file: 'prompts/M07_SECURITY.md',
    description: 'M07 — Security, Auth & NDPC',
  },
  {
    file: 'prompts/M08_DEVOPS_INFRA.md',
    description: 'M08 — DevOps & Infrastructure',
  },
  {
    file: 'prompts/M09_OBSERVABILITY.md',
    description: 'M09 — Observability & Monitoring',
  },
  {
    file: 'prompts/M10_RELEASE.md',
    description: 'M10 — Release Management & Go-Live',
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
  console.log('\nTaxBridge V12 — Prompt Module Verification (COMP-09)');
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
