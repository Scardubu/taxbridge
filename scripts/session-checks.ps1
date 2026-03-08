$ErrorActionPreference = 'Stop'

function Get-RateScanFiles {
  Get-ChildItem backend/src, mobile/src, admin/src -Recurse -Include *.ts,*.tsx |
    Where-Object {
      $_.FullName -notmatch 'contracts' -and
      $_.FullName -notmatch 'node_modules' -and
      $_.FullName -notmatch '\.(test|spec)\.' -and
      $_.FullName -notmatch 'design-system\\tokens\.ts$' -and
      $_.FullName -notmatch 'theme\\tokens\.ts$' -and
      $_.FullName -notmatch 'TaxHealthGauge\.tsx$' -and
      $_.FullName -notmatch 'OnboardingWizard\.tsx$' -and
      $_.FullName -notmatch 'backend\\src\\lib\\observability\.ts$' -and
      $_.FullName -notmatch 'backend\\src\\routes\\v1\\auth\.ts$'
    }
}

Get-Content docs/CHANGELOG.md
Get-Content docs/PRODUCTION_READY.md

npm run prompts:verify

$firsMatches = Get-ChildItem backend/src, mobile/src, admin/src, packages -Recurse -Include *.ts,*.tsx,*.json |
  Select-String -Pattern "FIRS|from 'express'"
if ($firsMatches) {
  $firsMatches | ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Trim())" }
}

$legacyMatches = Get-ChildItem backend/src, mobile/src -Recurse -Include *.ts,*.tsx |
  Where-Object {
    $_.FullName -notmatch 'OnboardingWizard\.tsx$' -and
    $_.FullName -notmatch 'DashboardScreen\.tsx$' -and
    $_.FullName -notmatch 'design-system\\components\.tsx$' -and
    $_.FullName -notmatch 'SyncQueueViewer\.tsx$' -and
    $_.FullName -notmatch 'TaxHealthGauge\.tsx$' -and
    $_.FullName -notmatch 'TaxEducation\.tsx$' -and
    $_.FullName -notmatch 'GamificationStep\.tsx$'
  } |
  Select-String -Pattern 'NRSt|CRA\b|CRA_|ProgressBar'
if ($legacyMatches) {
  $legacyMatches |
    Where-Object {
      $_.Line -notmatch 'accessibilityRole="progressbar"' -and
      $_.Line -notmatch 'progressbar semantics' -and
      $_.Line -notmatch 'style=\{s\.progressBar\}' -and
      $_.Line -notmatch '^\s*progressBar:' -and
      $_.Line -notmatch 'SyncProgressBar' -and
      $_.Line -notmatch '<ProgressBar' -and
      $_.Line -notmatch 'import .*ProgressBar' -and
      $_.Line -notmatch 'interface ProgressBarProps' -and
      $_.Line -notmatch 'export function ProgressBar'
    } |
    ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Trim())" }
}

$inlineMathMatches = Get-RateScanFiles |
  Select-String -Pattern '0\.075\b|0\.30\b|0\.04\b|0\.10\b'
if ($inlineMathMatches) {
  $inlineMathMatches | ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Trim())" }
}

$redisMatches = Get-ChildItem backend/src -Recurse -Include *.ts |
  Where-Object { $_.FullName -notmatch 'backend\\src\\lib\\redis\.ts' -and $_.FullName -notmatch 'backend\\src\\services\\eventBus\.ts' } |
  Select-String -Pattern 'new IORedis|new Redis'
if ($redisMatches) {
  $redisMatches | ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Trim())" }
}

$consoleMatches = Get-ChildItem backend/src -Recurse -Include *.ts |
  Select-String -Pattern 'console\.log'
if ($consoleMatches) {
  $consoleMatches | ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Trim())" }
}

npx tsc --noEmit
