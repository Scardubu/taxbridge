/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');

const inlineStylePattern = /style=\{\{/g;
const hardcodedColorPattern = /(color|backgroundColor|borderColor|shadowColor):\s*['"]#[0-9A-Fa-f]{3,8}['"]/g;
const hardcodedSpacingPattern = /(margin|padding)[^:]*:\s*\d+/g;

const shouldSkipLine = (line) => line.includes('colors.') || line.includes('spacing.') || line.includes('radii.');

const issues = [];

const scanDirectory = (dir) => {
  const entries = fs.readdirSync(dir);
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!entry.startsWith('.')) scanDirectory(fullPath);
      return;
    }
    if (!fullPath.endsWith('.ts') && !fullPath.endsWith('.tsx')) return;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      if (inlineStylePattern.test(line)) {
        issues.push({ file: fullPath, line: index + 1, issue: 'Inline style detected', severity: 'warning' });
      }
      if (!shouldSkipLine(line) && hardcodedColorPattern.test(line)) {
        issues.push({ file: fullPath, line: index + 1, issue: 'Hardcoded color detected', severity: 'error' });
      }
      if (!shouldSkipLine(line) && hardcodedSpacingPattern.test(line)) {
        issues.push({ file: fullPath, line: index + 1, issue: 'Hardcoded spacing detected', severity: 'warning' });
      }
    });
  });
};

scanDirectory(ROOT);

if (issues.length === 0) {
  console.log('✅ No UI consistency issues found');
  process.exit(0);
}

const errors = issues.filter((issue) => issue.severity === 'error');
const warnings = issues.filter((issue) => issue.severity === 'warning');

if (errors.length > 0) {
  console.log('❌ ERRORS:');
  errors.forEach((issue) => {
    console.log(`${issue.file}:${issue.line} - ${issue.issue}`);
  });
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  warnings.forEach((issue) => {
    console.log(`${issue.file}:${issue.line} - ${issue.issue}`);
  });
}

process.exit(errors.length > 0 ? 1 : 0);
