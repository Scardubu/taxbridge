const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('🔍 Checking TypeScript compilation...\n');
  
  const tscPath = path.join(__dirname, 'node_modules', '.bin', 'tsc');
  execSync(`"${tscPath}" --noEmit`, {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });
  
  console.log('\n✅ TypeScript compilation successful!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ TypeScript compilation failed');
  process.exit(1);
}
