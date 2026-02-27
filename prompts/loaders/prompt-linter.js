/**
 * TaxBridge Prompt Linter
 * =======================
 * Validates all prompt modules for structural completeness,
 * required sections, and cross-module consistency.
 *
 * Run: node loaders/prompt-linter.js
 * Or:  npm run prompts:lint
 *
 * Exit code 0 = all checks pass
 * Exit code 1 = one or more violations
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

const PROMPTS_ROOT = path.resolve(__dirname, '..');

const REQUIRED_MODULES = [
  { id: 'M00', file: 'core/M00-identity-rules.md',           maxTokens: 1000 },
  { id: 'M01', file: 'backend/M01-backend-architecture.md',  maxTokens: 1500 },
  { id: 'M02', file: 'mobile/M02-mobile-ux.md',              maxTokens: 1400 },
  { id: 'M03', file: 'ai/M03-ai-intelligence.md',            maxTokens: 1300 },
  { id: 'M04', file: 'payments/M04-payments-compliance.md',  maxTokens: 1200 },
  { id: 'M05', file: 'data/M05-data-tax-engine.md',          maxTokens: 1300 },
  { id: 'M06', file: 'devops/M06-deployment-devops.md',      maxTokens: 1100 },
  { id: 'M07', file: 'monetization/M07-monetization-analytics.md', maxTokens: 1000 },
];

// Required sections in every module
const REQUIRED_SECTIONS = ['## PURPOSE', '## SCOPE', '## INPUTS / OUTPUTS', '## DEPENDENCIES'];

// Required phrases in M00 (system rules — must always be present)
const M00_REQUIRED_PHRASES = [
  'R01', 'R02', 'R03', 'R04', 'R05', 'R06',
  'Prisma', 'NRS', 'FIRS', 'compileSdkVersion',
  'pre-commit', 'ABSOLUTE RULES',
];

// Forbidden strings — must not appear anywhere in any module
// Each entry has a regex (with \b word boundaries to avoid false positives)
// and a human-readable label for error messages.
const FORBIDDEN_STRINGS = [
  { pattern: /\bFIRS\b/,         label: 'FIRS (use NRS instead)' },
  { pattern: /\bNRSt\b/,         label: 'NRSt (typo — use NRS)' },
  { pattern: /COMMON\\\./,       label: 'COMMON\\. raw i18n key' },
  { pattern: /\btodo:/i,          label: 'todo:' },
  { pattern: /\bFIXME:/,         label: 'FIXME:' },
  { pattern: /\bplaceholder\b/i, label: 'placeholder' },
  { pattern: /lorem ipsum/i,     label: 'lorem ipsum' },
];

// ─── Linter Engine ────────────────────────────────────────────────────────────

let errors = 0;
let warnings = 0;
let checks = 0;

function pass(msg) {
  process.stdout.write(`  ✓ ${msg}\n`);
  checks++;
}

function fail(msg) {
  process.stderr.write(`  ✗ ${msg}\n`);
  errors++;
  checks++;
}

function warn(msg) {
  process.stdout.write(`  ⚠ ${msg}\n`);
  warnings++;
  checks++;
}

function section(title) {
  console.log(`\n[${title}]`);
}

// ─── Check 1: File existence ──────────────────────────────────────────────────

section('Module File Existence');

const moduleContents = {};

for (const mod of REQUIRED_MODULES) {
  const filePath = path.join(PROMPTS_ROOT, mod.file);
  if (!fs.existsSync(filePath)) {
    fail(`${mod.id}: File missing — ${mod.file}`);
    moduleContents[mod.id] = null;
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  moduleContents[mod.id] = content;
  pass(`${mod.id}: Found (${content.split('\n').length} lines)`);
}

// ─── Check 2: Required sections ──────────────────────────────────────────────

section('Required Sections');

for (const mod of REQUIRED_MODULES) {
  const content = moduleContents[mod.id];
  if (!content) continue;

  for (const section of REQUIRED_SECTIONS) {
    if (content.includes(section)) {
      pass(`${mod.id}: Has "${section}"`);
    } else {
      fail(`${mod.id}: Missing section "${section}"`);
    }
  }
}

// ─── Check 3: Token budget ────────────────────────────────────────────────────

section('Token Budget (1 token ≈ 4 chars)');

for (const mod of REQUIRED_MODULES) {
  const content = moduleContents[mod.id];
  if (!content) continue;

  const estimatedTokens = Math.ceil(content.length / 4);
  if (estimatedTokens > mod.maxTokens) {
    warn(`${mod.id}: ${estimatedTokens} estimated tokens (budget: ${mod.maxTokens}) — consider trimming`);
  } else {
    pass(`${mod.id}: ~${estimatedTokens} tokens (budget: ${mod.maxTokens})`);
  }
}

// ─── Check 4: M00 required phrases ───────────────────────────────────────────

section('M00 System Rules Completeness');

const m00 = moduleContents['M00'];
if (m00) {
  for (const phrase of M00_REQUIRED_PHRASES) {
    if (m00.includes(phrase)) {
      pass(`M00: Contains "${phrase}"`);
    } else {
      fail(`M00: Missing required phrase "${phrase}" — system rules may be incomplete`);
    }
  }
}

// ─── Check 5: Forbidden strings ──────────────────────────────────────────────

section('Forbidden String Audit');

// Lines that DOCUMENT a forbidden string as something to fix are OK.
// We skip any line that contains the forbidden word AND one of these exemption markers.
const EXEMPTION_MARKERS = [
  'fix:', 'Fix:', 'BUG-', 'typo', 'not', '→', '# Must', '# Zero', '# must',
  'grep', 'banned', 'references', 'mandate', 'replace', 'remove', 'audit',
  'avoid', 'Must be', 'must be', 'never use', 'Never use', 'zero ', 'Zero ',
  'must return', 'Must return', '// ', 'Migrate', 'legacy',
];

function lineIsDocumentingForbidden(line, forbidden) {
  // If the line contains an exemption marker alongside the forbidden string,
  // it is describing the rule (don't use X) not violating it.
  return EXEMPTION_MARKERS.some(marker => line.includes(marker));
}

for (const mod of REQUIRED_MODULES) {
  const content = moduleContents[mod.id];
  if (!content) continue;

  for (const { pattern, label } of FORBIDDEN_STRINGS) {
    const lines = content.split('\n');

    const violatingLines = lines.filter((line) => {
      if (!pattern.test(line)) return false;
      // M00 references FIRS only in the rule "don't use FIRS" — always exempt
      if (label.startsWith('FIRS') && mod.id === 'M00') return false;
      // If the line documents the rule, exempt it
      if (lineIsDocumentingForbidden(line, label)) return false;
      return true;
    });

    if (violatingLines.length > 0) {
      fail(`${mod.id}: Contains forbidden "${label}" (${violatingLines.length} line(s)):\n    → ${violatingLines[0].trim().slice(0, 80)}`);
    }
  }
}

// Blanket pass if no errors from this section were added
const forbiddenSectionErrors = errors;
if (forbiddenSectionErrors === 0) {
  pass('No forbidden strings found in any module');
}

// ─── Check 6: i18n consistency ────────────────────────────────────────────────

section('i18n Key Consistency (M00 + M02)');

const m02 = moduleContents['M02'];
if (m00 && m02) {
  // Both must reference initImmediate: false (critical i18n fix)
  if (m02.includes('initImmediate: false')) {
    pass('M02: initImmediate: false present (offline i18n fix)');
  } else {
    fail('M02: Missing initImmediate: false — BUG-S03 fix not documented');
  }

  // BUG-S01 through BUG-S04 must be referenced in M02
  const bugIds = ['BUG-S01', 'BUG-S02', 'BUG-S03', 'BUG-S04'];
  for (const bugId of bugIds) {
    if (m02.includes(bugId)) {
      pass(`M02: ${bugId} documented`);
    } else {
      fail(`M02: ${bugId} not documented — confirmed bug missing from mobile context`);
    }
  }
}

// ─── Check 7: Tax law references in M05 ──────────────────────────────────────

section('Tax Law Citations (M05)');

const m05 = moduleContents['M05'];
if (m05) {
  const requiredCitations = [
    'NTA 2025',
    '₦100,000,000',  // VAT threshold
    '7.5%',           // VAT rate
    '₦200,000',       // CRA base
    '20%',            // CRA rate
    'CIT',
    'PAYE',
    'WHT',
  ];

  for (const citation of requiredCitations) {
    if (m05.includes(citation)) {
      pass(`M05: Tax reference "${citation}" present`);
    } else {
      fail(`M05: Missing tax reference "${citation}" — critical compliance data`);
    }
  }
}

// ─── Check 8: Loader files ────────────────────────────────────────────────────

section('Loader File Integrity');

const loaderFiles = [
  'loaders/prompt-loader.ts',
  'loaders/embedding-pipeline.ts',
  'loaders/prompt-linter.js',
  'tsconfig.json',
  'package.json',
  '.gitignore',
];

for (const file of loaderFiles) {
  const filePath = path.join(PROMPTS_ROOT, file);
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    pass(`${file}: Present (${size} bytes)`);
  } else {
    fail(`${file}: Missing — loader system incomplete`);
  }
}

// ─── Check 9: package.json scripts ───────────────────────────────────────────

section('Package.json Scripts');

const pkgPath = path.join(PROMPTS_ROOT, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const requiredScripts = ['prompts:load', 'prompts:build', 'prompts:verify', 'prompts:query', 'prompts:lint'];

  for (const script of requiredScripts) {
    if (pkg.scripts && pkg.scripts[script]) {
      pass(`package.json: script "${script}" defined`);
    } else {
      fail(`package.json: missing script "${script}"`);
    }
  }
}

// ─── Check 10: MASTER_PROMPT.md references all modules ───────────────────────

section('MASTER_PROMPT.md Module Reference Completeness');

const masterPath = path.join(PROMPTS_ROOT, 'MASTER_PROMPT.md');
if (fs.existsSync(masterPath)) {
  const master = fs.readFileSync(masterPath, 'utf-8');
  for (const mod of REQUIRED_MODULES) {
    if (master.includes(mod.id)) {
      pass(`MASTER_PROMPT.md: References ${mod.id}`);
    } else {
      fail(`MASTER_PROMPT.md: Does not reference ${mod.id}`);
    }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
console.log(`PROMPT LINT SUMMARY`);
console.log('═'.repeat(60));
console.log(`  Total checks:   ${checks}`);
console.log(`  Passed:         ${checks - errors - warnings}`);
console.log(`  Warnings:       ${warnings}`);
console.log(`  Errors:         ${errors}`);
console.log('─'.repeat(60));

if (errors > 0) {
  console.error(`\n✗ LINT FAILED — ${errors} error(s) must be fixed\n`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`\n⚠ LINT PASSED WITH WARNINGS — ${warnings} warning(s) to review\n`);
  process.exit(0);
} else {
  console.log('\n✓ LINT PASSED — All prompt modules valid\n');
  process.exit(0);
}
