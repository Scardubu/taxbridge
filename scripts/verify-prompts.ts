#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const MASTER_PROMPT = path.join(ROOT, 'prompts', 'v13_master_prompt.md');
const IMPLEMENTATION_PROMPT = path.join(ROOT, 'prompts', 'v13_implementation_prompt.md');
const REQUIRED_MARKERS = [
  'M00',
  'M01',
  'M02',
  'M03',
  'M04',
  'M05',
  'M06',
  'M07',
  'M08',
  'M09',
  'M10',
  'M11',
] as const;

if (!existsSync(MASTER_PROMPT)) {
  process.stderr.write('❌ Missing prompts/v13_master_prompt.md\n');
  process.exit(1);
}

if (!existsSync(IMPLEMENTATION_PROMPT)) {
  process.stderr.write('❌ Missing prompts/v13_implementation_prompt.md\n');
  process.exit(1);
}

const source = readFileSync(MASTER_PROMPT, 'utf8');
const missing = REQUIRED_MARKERS.filter((marker) => !source.includes(marker));

if (missing.length > 0) {
  process.stderr.write(`❌ Missing prompt markers: ${missing.join(', ')}\n`);
  process.exit(1);
}

process.stdout.write('✅ 12/12 modules loaded (M00–M11)\n');
