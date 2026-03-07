const { existsSync } = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');

const nextDir = path.join(process.cwd(), '.next');

if (!existsSync(nextDir)) {
  process.exit(0);
}

try {
  if (process.platform === 'win32') {
    const escapedPath = nextDir.replace(/'/g, "''");
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `if (Test-Path -LiteralPath '${escapedPath}') { Remove-Item -LiteralPath '${escapedPath}' -Recurse -Force }`,
    ], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } else {
    execFileSync('rm', ['-rf', nextDir], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  }
} catch (error) {
  console.error('Failed to clean .next directory', error);
  process.exit(1);
}
