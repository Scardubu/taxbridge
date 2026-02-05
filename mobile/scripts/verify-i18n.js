const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EN_PATH = path.join(ROOT, 'src', 'i18n', 'en.json');
const PIDGIN_PATH = path.join(ROOT, 'src', 'i18n', 'pidgin.json');

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function flattenKeys(obj, prefix = '') {
  if (obj === null || obj === undefined) {
    return [];
  }
  if (Array.isArray(obj)) {
    return [prefix];
  }
  if (typeof obj !== 'object') {
    return [prefix];
  }
  return Object.keys(obj).flatMap((key) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(obj[key], nextPrefix);
  });
}

function diffKeys(baseKeys, compareKeys) {
  const compareSet = new Set(compareKeys);
  return baseKeys.filter((key) => !compareSet.has(key));
}

function main() {
  const en = loadJson(EN_PATH);
  const pidgin = loadJson(PIDGIN_PATH);

  const enKeys = flattenKeys(en).sort();
  const pidginKeys = flattenKeys(pidgin).sort();

  const missingInPidgin = diffKeys(enKeys, pidginKeys);
  const missingInEnglish = diffKeys(pidginKeys, enKeys);

  const hasIssues = missingInPidgin.length > 0 || missingInEnglish.length > 0;

  console.log(`English keys: ${enKeys.length}`);
  console.log(`Pidgin keys: ${pidginKeys.length}`);

  if (missingInPidgin.length > 0) {
    console.log('\nMissing in pidgin.json:');
    missingInPidgin.forEach((key) => console.log(`- ${key}`));
  }

  if (missingInEnglish.length > 0) {
    console.log('\nMissing in en.json:');
    missingInEnglish.forEach((key) => console.log(`- ${key}`));
  }

  if (hasIssues) {
    process.exit(1);
  }

  console.log('\nParity: 100%');
}

main();
