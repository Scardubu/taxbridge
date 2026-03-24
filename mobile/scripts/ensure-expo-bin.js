const fs = require('fs');
const path = require('path');

if (process.platform !== 'win32') {
  process.stdout.write('ensure-expo-bin: non-Windows platform, skipping.\n');
  process.exit(0);
}

const mobileRoot = path.resolve(__dirname, '..');
const mobileNodeModules = path.join(mobileRoot, 'node_modules');
const mobileBin = path.join(mobileNodeModules, '.bin');
const repoRoot = path.resolve(mobileRoot, '..');
const rootNodeModules = path.join(repoRoot, 'node_modules');
const rootExpoDir = path.resolve(mobileRoot, '..', 'node_modules', 'expo');
const rootExpoCli = path.join(rootExpoDir, 'bin', 'cli');
const localExpoDir = path.join(mobileNodeModules, 'expo');
const npmCompatExpoDir = path.join(rootNodeModules, 'node_modules', 'expo');

if (!fs.existsSync(localExpoDir)) {
  if (!fs.existsSync(rootExpoDir)) {
    process.stderr.write(`Expo package not found at ${rootExpoDir}\n`);
    process.exit(1);
  }

  fs.mkdirSync(mobileNodeModules, { recursive: true });
  fs.symlinkSync(rootExpoDir, localExpoDir, 'junction');
}

if (!fs.existsSync(npmCompatExpoDir)) {
  fs.mkdirSync(path.dirname(npmCompatExpoDir), { recursive: true });
  fs.symlinkSync(rootExpoDir, npmCompatExpoDir, 'junction');
}

const localExpoCli = path.join(localExpoDir, 'bin', 'cli');
const expoCli = fs.existsSync(localExpoCli) ? localExpoCli : rootExpoCli;

if (!fs.existsSync(expoCli)) {
  process.stderr.write(`Expo CLI not found at ${expoCli}\n`);
  process.exit(1);
}

fs.mkdirSync(mobileBin, { recursive: true });

const relativeCli = path.relative(mobileBin, expoCli).replace(/\\/g, '\\\\');

const cmdContent = [
  '@ECHO off',
  'GOTO start',
  ':find_dp0',
  'SET dp0=%~dp0',
  'EXIT /b',
  ':start',
  'SETLOCAL',
  'CALL :find_dp0',
  'IF EXIST "%dp0%\\node.exe" (',
  '  SET "_prog=%dp0%\\node.exe"',
  ') ELSE (',
  '  SET "_prog=node"',
  '  SET PATHEXT=%PATHEXT:;.JS;=;%',
  ')',
  `endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\${relativeCli}" %*`,
  ''
].join('\r\n');

const ps1Content = [
  '#!/usr/bin/env pwsh',
  '$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent',
  '$exe=""',
  'if ($PSVersionTable.PSVersion -lt "6.0" -or $IsWindows) {',
  '  $exe=".exe"',
  '}',
  '$ret=0',
  'if (Test-Path "$basedir/node$exe") {',
  '  if ($MyInvocation.ExpectingInput) {',
  `    $input | & "$basedir/node$exe"  "$basedir/${path.relative(mobileBin, expoCli).replace(/\\/g, '/')}" $args`,
  '  } else {',
  `    & "$basedir/node$exe"  "$basedir/${path.relative(mobileBin, expoCli).replace(/\\/g, '/')}" $args`,
  '  }',
  '  $ret=$LASTEXITCODE',
  '} else {',
  '  if ($MyInvocation.ExpectingInput) {',
  `    $input | & "node$exe"  "$basedir/${path.relative(mobileBin, expoCli).replace(/\\/g, '/')}" $args`,
  '  } else {',
  `    & "node$exe"  "$basedir/${path.relative(mobileBin, expoCli).replace(/\\/g, '/')}" $args`,
  '  }',
  '  $ret=$LASTEXITCODE',
  '}',
  'exit $ret',
  ''
].join('\r\n');

fs.writeFileSync(path.join(mobileBin, 'expo.cmd'), cmdContent, 'utf8');
fs.writeFileSync(path.join(mobileBin, 'expo.ps1'), ps1Content, 'utf8');

// ── EAS CLI launcher ─────────────────────────────────────────────────────────
// eas-cli is installed globally; create a local .bin/eas.cmd so npm scripts can
// resolve it without relying on the system PATH being available in npm run context.
const npmPrefix = (() => {
  try {
    return require('child_process')
      .execSync('npm config get prefix', { encoding: 'utf8' })
      .trim();
  } catch (_) {
    return null;
  }
})();

const globalEasBin = npmPrefix
  ? path.join(npmPrefix, 'node_modules', 'eas-cli', 'bin', 'run')
  : null;

const localEasBin = path.join(mobileNodeModules, 'eas-cli', 'bin', 'run');

const easBin =
  fs.existsSync(localEasBin) ? localEasBin :
  (globalEasBin && fs.existsSync(globalEasBin)) ? globalEasBin :
  null;

if (easBin) {
  const relEas = path.relative(mobileBin, easBin).replace(/\\/g, '\\\\');
  const relEasSlash = path.relative(mobileBin, easBin).replace(/\\/g, '/');

  const easCmd = [
    '@ECHO off',
    'GOTO start',
    ':find_dp0',
    'SET dp0=%~dp0',
    'EXIT /b',
    ':start',
    'SETLOCAL',
    'CALL :find_dp0',
    'IF EXIST "%dp0%\\node.exe" (',
    '  SET "_prog=%dp0%\\node.exe"',
    ') ELSE (',
    '  SET "_prog=node"',
    '  SET PATHEXT=%PATHEXT:;.JS;=;%',
    ')',
    `endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\${relEas}" %*`,
    ''
  ].join('\r\n');

  const easPs1 = [
    '#!/usr/bin/env pwsh',
    '$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent',
    '$exe=""',
    'if ($PSVersionTable.PSVersion -lt "6.0" -or $IsWindows) {',
    '  $exe=".exe"',
    '}',
    '$ret=0',
    'if (Test-Path "$basedir/node$exe") {',
    '  if ($MyInvocation.ExpectingInput) {',
    `    $input | & "$basedir/node$exe"  "$basedir/${relEasSlash}" $args`,
    '  } else {',
    `    & "$basedir/node$exe"  "$basedir/${relEasSlash}" $args`,
    '  }',
    '  $ret=$LASTEXITCODE',
    '} else {',
    '  if ($MyInvocation.ExpectingInput) {',
    `    $input | & "node$exe"  "$basedir/${relEasSlash}" $args`,
    '  } else {',
    `    & "node$exe"  "$basedir/${relEasSlash}" $args`,
    '  }',
    '  $ret=$LASTEXITCODE',
    '}',
    'exit $ret',
    ''
  ].join('\r\n');

  fs.writeFileSync(path.join(mobileBin, 'eas.cmd'), easCmd, 'utf8');
  fs.writeFileSync(path.join(mobileBin, 'eas.ps1'), easPs1, 'utf8');
  process.stdout.write('EAS Windows launcher ensured.\n');
} else {
  process.stderr.write('⚠️  eas-cli not found globally or locally. Run: npm install -g eas-cli\n');
}

process.stdout.write('Expo Windows launchers ensured.\n');
