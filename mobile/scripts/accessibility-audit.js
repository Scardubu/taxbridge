/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');

const accessibilityLabelPattern = /accessibilityLabel=/g;
const accessibilityHintPattern = /accessibilityHint=/g;
const minSizePattern = /(minHeight|minWidth):\s*(\d+)/g;

let labelCount = 0;
let hintCount = 0;
const sizeWarnings = [];

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
      if (accessibilityLabelPattern.test(line)) labelCount += 1;
      if (accessibilityHintPattern.test(line)) hintCount += 1;

      let match;
      while ((match = minSizePattern.exec(line)) !== null) {
        const value = Number(match[2]);
        if (value > 0 && value < 44) {
          sizeWarnings.push({ file: fullPath, line: index + 1, value });
        }
      }
    });
  });
};

scanDirectory(ROOT);

console.log('Accessibility audit summary');
console.log(`- accessibilityLabel count: ${labelCount}`);
console.log(`- accessibilityHint count: ${hintCount}`);

if (sizeWarnings.length > 0) {
  console.log('\n⚠️  Potential touch-target issues (<44px):');
  sizeWarnings.forEach((warning) => {
    console.log(`${warning.file}:${warning.line} - ${warning.value}px`);
  });
}
