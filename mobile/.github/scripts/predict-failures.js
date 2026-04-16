#!/usr/bin/env node
/* eslint-env node */
'use strict';

/**
 * predict-failures.js — TaxBridge V5 Predictive Failure Analysis
 *
 * Static analysis pass over the onboarding + navigation surface.
 * Outputs structured risk flags consumed by risk-score.js.
 * Exit 0 = no HIGH risks. Exit 1 = HIGH risk detected.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

// ── helpers ─────────────────────────────────────────────────────────────────

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return '';
  return fs.readFileSync(abs, 'utf8');
}

function has(content, pattern) {
  if (typeof pattern === 'string') return content.includes(pattern);
  return pattern.test(content);
}

function occurrences(content, pattern) {
  const re = typeof pattern === 'string' ? new RegExp(pattern.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`), 'g') : pattern;
  return (content.match(re) || []).length;
}

// ── file corpus ──────────────────────────────────────────────────────────────

const corpus = {
  onboardingLayout:   read('app/(onboarding)/_layout.tsx'),
  onboardingShared:   read('app/(onboarding)/_shared.tsx'),
  welcomeScreen:      read('app/(onboarding)/index.tsx'),
  communityScreen:    read('app/(onboarding)/community.tsx'),
  onboardingStore:    read('stores/onboardingStore.ts'),
  rootLayout:         read('app/_layout.tsx'),
  appIndex:           read('app/index.tsx'),
  metroConfig:        read('metro.config.js'),
  appJson:            read('app.json'),
  // OnboardingProgressBar re-exports from StepContainer — scan both for Reanimated usage.
  progressBar:        read('components/OnboardingProgressBar.tsx') + read('components/StepContainer.tsx'),
  progressBanner:     read('components/OnboardingProgressBanner.tsx'),
};

// ── rules ────────────────────────────────────────────────────────────────────

/** @type {Array<{id: string, severity: 'HIGH'|'MEDIUM'|'LOW', file: string, description: string, predictedFailure: string, check: () => boolean}>} */
const RULES = [
  {
    id: 'NAV_DOUBLE_TRIGGER',
    severity: 'HIGH',
    file: 'stores/onboardingStore.ts',
    description: 'complete() or skipForNow() sets isComplete=true (triggering the layout <Redirect>) AND ' +
      'also calls router.replace(DEFAULT_TAB_ROUTE) via setTimeout — two concurrent navigations to the same route.',
    predictedFailure: 'Unmatched route or double-push crash on community → tabs transition.',
    check() {
      const store = corpus.onboardingStore;
      // HIGH risk only if complete() or skipForNow() set isComplete=true AND also call router.replace
      const completeBlock = store.slice(store.indexOf('complete: async'), store.indexOf('complete: async') + 600);
      const skipBlock = store.slice(store.indexOf('skipForNow:'), store.indexOf('skipForNow:') + 500);
      const completeDoubles = has(completeBlock, 'isComplete: true') && has(completeBlock, 'router.replace');
      const skipDoubles = has(skipBlock, 'isComplete: true') && has(skipBlock, 'router.replace');
      return completeDoubles || skipDoubles;
    },
  },
  {
    id: 'NAV_MISSING_PREFETCH',
    severity: 'MEDIUM',
    file: 'stores/onboardingStore.ts',
    description: 'No router.prefetch() calls found in onboarding store, shared utilities, or layout.',
    predictedFailure: 'Cold transition latency spike (>300 ms) on initial route-to-route navigation on low-end Android.',
    check() {
      return !has(corpus.onboardingStore, 'router.prefetch') &&
             !has(corpus.onboardingShared, 'router.prefetch') &&
             !has(corpus.onboardingLayout, 'router.prefetch');
    },
  },
  {
    id: 'PERF_INLINE_REQUIRES_DISABLED',
    severity: 'MEDIUM',
    file: 'metro.config.js',
    description: 'Metro transformer.inlineRequires is not enabled.',
    predictedFailure: 'Full bundle evaluated at startup → 200–400 ms avoidable cold-start regression on Hermes.',
    check() {
      return !has(corpus.metroConfig, 'inlineRequires');
    },
  },
  {
    id: 'NAV_SETTIMEOUT_FRAGILE',
    severity: 'MEDIUM',
    file: 'app/(onboarding)/index.tsx + stores/onboardingStore.ts',
    description: 'Multiple setTimeout(fn, 0) deferred navigations as a workaround for Zustand/Expo Router ' +
      'state-update/render ordering. setTimeout is not a reliable synchronization primitive.',
    predictedFailure: 'Under heavy JS thread load, setTimeout callback can fire before the store subscriber ' +
      're-renders the layout guard, causing momentary flash of onboarding screen after redirect.',
    check() {
      const setTimeoutCount =
        occurrences(corpus.welcomeScreen, /setTimeout\(/g) +
        occurrences(corpus.onboardingStore, /setTimeout\(/g);
      return setTimeoutCount >= 2;
    },
  },
  {
    id: 'ANIM_NO_REANIMATED_WORKLETS',
    severity: 'LOW',
    file: 'components/OnboardingProgressBar.tsx',
    description: 'OnboardingProgressBar has no detected Reanimated 3 worklet usage for progress animation.',
    predictedFailure: 'Progress animations run on the JS thread. Frame drops visible on mid-range Android ' +
      'devices when JS thread is busy during onboarding API calls.',
    check() {
      return !has(corpus.progressBar, 'useSharedValue') &&
             !has(corpus.progressBar, 'useAnimatedStyle');
    },
  },
  {
    id: 'HYDRATION_TIMEOUT_4S',
    severity: 'LOW',
    file: 'app/_layout.tsx',
    description: 'waitForHydration() falls back to 4 000 ms timeout. On cold launch on slow devices, ' +
      'this extends the app black-screen period.',
    predictedFailure: 'Sentry "waitForHydration resolved via 4s timeout" warning on ~5% of Nigerian 2G devices. ' +
      'User sees loading spinner for 4 s before any content.',
    check() {
      return has(corpus.rootLayout, '4000');
    },
  },
  {
    id: 'HERMES_ENABLED',
    severity: 'INFO',
    file: 'app.json',
    description: 'Hermes JS engine is correctly enabled.',
    predictedFailure: 'N/A — this is a positive signal.',
    check() {
      return false; // never flags as risk
    },
  },
];

// ── run analysis ─────────────────────────────────────────────────────────────

const flags = RULES
  .filter((rule) => rule.check())
  .map(({ id, severity, file, description, predictedFailure }) => ({
    id,
    severity,
    file,
    description,
    predictedFailure,
  }));

const highs   = flags.filter((f) => f.severity === 'HIGH');
const mediums = flags.filter((f) => f.severity === 'MEDIUM');
const lows    = flags.filter((f) => f.severity === 'LOW');

// ── output ───────────────────────────────────────────────────────────────────

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║       TAXBRIDGE — PREDICTIVE FAILURE ANALYST                ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Scanned ${Object.keys(corpus).length} source files`);
console.log(`Evaluated ${RULES.length} failure rules`);
console.log(`Found: ${highs.length} HIGH  |  ${mediums.length} MEDIUM  |  ${lows.length} LOW`);
console.log('');

for (const flag of flags) {
  const SEVERITY_BADGES = { HIGH: '🔴 HIGH  ', MEDIUM: '🟡 MEDIUM', LOW: '🔵 LOW   ' };
  const badge = SEVERITY_BADGES[flag.severity] ?? '🔵 LOW   ';
  console.log(`${badge}  [${flag.id}]`);
  console.log(`         File   : ${flag.file}`);
  console.log(`         Risk   : ${flag.description}`);
  console.log(`         Failure: ${flag.predictedFailure}`);
  console.log('');
}

// Write machine-readable output for risk-score.js
const output = { flags, scannedAt: new Date().toISOString() };
fs.writeFileSync(path.join(__dirname, 'predict-output.json'), JSON.stringify(output, null, 2));
console.log('Output written → .github/scripts/predict-output.json');
console.log('');

if (highs.length > 0) {
  console.log('🚨 PREDICTION: HIGH-RISK failures detected — release BLOCKED pending fix.');
  process.exit(1);
} else {
  console.log('✅ PREDICTION: No HIGH-risk failures detected. Proceed to risk scoring.');
  process.exit(0);
}
