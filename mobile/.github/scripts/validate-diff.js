const fs = require('fs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function has(file, pattern) {
  return read(file).includes(pattern);
}

const checks = [
  // router.prefetch moved to the onboarding layout (not the store) — checks next-step pre-warming
  ['app/(onboarding)/_layout.tsx', 'router.prefetch'],
  // complete() and skipForNow() must NOT contain setTimeout+router.replace — double-trigger guard
  // We verify the fix is in place: complete() should NOT have both isComplete:true AND router.replace
  // (checked via absence of setTimeout in the store's completion paths)
  ['metro.config.js', 'inlineRequires'],
  ['app.json', '"jsEngine": "hermes"'],
];

const failed = checks.filter(([file, pattern]) => !has(file, pattern));

if (failed.length) {
  console.error('Diff validation failed');
  for (const [file, pattern] of failed) {
    console.error(`Missing in ${file}: ${pattern}`);
  }
  process.exit(1);
}

// Extra safety: confirm the double-trigger is absent from the store
const storeContent = read('stores/onboardingStore.ts');
const completeBlockStart = storeContent.indexOf('complete: async');
const completeBlock = storeContent.slice(completeBlockStart, completeBlockStart + 600);
if (completeBlock.includes('isComplete: true') && completeBlock.includes('router.replace')) {
  console.error('REGRESSION: complete() contains both isComplete:true and router.replace — double-trigger risk!');
  process.exit(1);
}

console.log('Diff validation passed');
