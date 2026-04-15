#!/usr/bin/env node
/* eslint-env node */
'use strict';

/**
 * risk-score.js — TaxBridge V5 Release Risk Scorer
 *
 * Reads predict-output.json produced by predict-failures.js and
 * computes a weighted composite risk score [0.0 – 1.0].
 *
 * Decision thresholds (per agent spec):
 *   < 0.30  → SAFE   — proceed
 *   0.30–0.60 → CAUTION — proceed with monitoring
 *   > 0.60  → BLOCK  — release blocked, fix required
 *
 * Exit 0 = SAFE or CAUTION. Exit 1 = BLOCK.
 */

const fs   = require('fs');
const path = require('path');

const PREDICT_FILE = path.join(__dirname, 'predict-output.json');

if (!fs.existsSync(PREDICT_FILE)) {
  console.error('predict-output.json not found — run predict-failures.js first.');
  process.exit(2);
}

const { flags } = JSON.parse(fs.readFileSync(PREDICT_FILE, 'utf8'));

// ── weights per risk factor ID ───────────────────────────────────────────────
// Maximum possible contribution per flag → sum determines final score ceiling.
const WEIGHTS = {
  // Navigation
  NAV_DOUBLE_TRIGGER:          0.35, // Primary crash vector
  NAV_MISSING_PREFETCH:        0.15, // UX latency, not crash
  NAV_SETTIMEOUT_FRAGILE:      0.20, // Race condition window

  // Performance
  PERF_INLINE_REQUIRES_DISABLED: 0.15, // Cold-start regression

  // Animation
  ANIM_NO_REANIMATED_WORKLETS:   0.08, // Frame drop risk

  // Infrastructure
  HYDRATION_TIMEOUT_4S:          0.07, // UX delay risk
};

// ── compute score ────────────────────────────────────────────────────────────

let totalScore = 0;
const breakdown = [];

for (const flag of flags) {
  const weight = WEIGHTS[flag.id] ?? 0.05;
  // HIGH flags contribute full weight; MEDIUM = 60%; LOW = 25%
  const multiplier = flag.severity === 'HIGH' ? 1.0 :
                     flag.severity === 'MEDIUM' ? 0.6 : 0.25;
  const contribution = parseFloat((weight * multiplier).toFixed(3));
  totalScore += contribution;
  breakdown.push({ id: flag.id, severity: flag.severity, weight, multiplier, contribution });
}

// Cap at 1.0
totalScore = Math.min(parseFloat(totalScore.toFixed(3)), 1.0);

// ── decision ─────────────────────────────────────────────────────────────────

const decision =
  totalScore < 0.30 ? 'SAFE' :
  totalScore <= 0.60 ? 'CAUTION' :
  'BLOCK';

const decisionEmoji = decision === 'SAFE' ? '✅' : decision === 'CAUTION' ? '⚠️ ' : '🚫';

// ── output ───────────────────────────────────────────────────────────────────

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║        TAXBRIDGE — RELEASE RISK SCORER                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Score Breakdown:');
console.log('─────────────────────────────────────────────────────────────');
for (const row of breakdown) {
  const bar = '█'.repeat(Math.round(row.contribution * 40));
  console.log(
    `  ${row.id.padEnd(35)} ${row.severity.padEnd(7)} +${row.contribution.toFixed(3)}  ${bar}`
  );
}
console.log('─────────────────────────────────────────────────────────────');
console.log(`  ${'TOTAL RISK SCORE'.padEnd(35)}         ${totalScore.toFixed(3)}`);
console.log('');
console.log(`  ${decisionEmoji}  DECISION: ${decision}`);
console.log('');

if (decision === 'BLOCK') {
  console.log('  🚫 Release BLOCKED. HIGH-risk factors must be resolved before deployment.');
} else if (decision === 'CAUTION') {
  console.log('  ⚠️  Proceed with caution. Monitor telemetry closely post-deploy. Consider canary at 5%.');
} else {
  console.log('  ✅ Safe to proceed through full validation pipeline.');
}
console.log('');

// Write result for downstream pipeline
const result = { totalScore, decision, breakdown, scoredAt: new Date().toISOString() };
fs.writeFileSync(path.join(__dirname, 'risk-output.json'), JSON.stringify(result, null, 2));
console.log('Output written → .github/scripts/risk-output.json');
console.log('');

process.exit(decision === 'BLOCK' ? 1 : 0);
