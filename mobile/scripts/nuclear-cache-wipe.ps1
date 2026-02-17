#!/usr/bin/env pwsh

<#
.SYNOPSIS
    TaxBridge Nuclear Cache Wipe - Eliminates all 8 cache layers
.DESCRIPTION
    Comprehensive cache clearing for EAS builds to ensure fresh artifacts
.PARAMETER IncludeGlobal
    Also clear global npm cache (slower but more thorough)
.PARAMETER Verbose
    Show detailed output for debugging
.EXAMPLE
    pwsh nuclear-cache-wipe.ps1
.EXAMPLE
    pwsh nuclear-cache-wipe.ps1 -IncludeGlobal -Verbose
#>

param(
    [switch]$IncludeGlobal,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "🧹 TaxBridge Nuclear Cache Wipe V6.0" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$cleaned = 0
$startTime = Get-Date

Write-Host "1️⃣  Clearing Metro bundler cache..." -ForegroundColor Yellow

$metroPaths = @(
    "$env:TMPDIR/metro-*",
    "$env:TEMP/metro-*",
    ".metro",
    "$env:LOCALAPPDATA\Temp\metro-*"
)

foreach ($path in $metroPaths) {
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
        $cleaned++
        if ($Verbose) { Write-Host "   Removed: $path" -ForegroundColor Gray }
    }
}
Write-Host "   ✅ Metro cache cleared" -ForegroundColor Green

Write-Host "2️⃣  Clearing node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item "node_modules" -Recurse -Force
    $cleaned++
    Write-Host "   ✅ node_modules cleared" -ForegroundColor Green
} else {
    Write-Host "   ⏭️  node_modules not found (skip)" -ForegroundColor Gray
}

Write-Host "3️⃣  Clearing Expo cache..." -ForegroundColor Yellow
try {
    npx expo start --clear 2>&1 | Out-Null
    $cleaned++
    Write-Host "   ✅ Expo cache cleared" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Expo cache clear failed (non-critical)" -ForegroundColor Yellow
}

Write-Host "4️⃣  Clearing Watchman..." -ForegroundColor Yellow
if (Get-Command watchman -ErrorAction SilentlyContinue) {
    watchman watch-del-all 2>&1 | Out-Null
    $cleaned++
    Write-Host "   ✅ Watchman cleared" -ForegroundColor Green
} else {
    Write-Host "   ⏭️  Watchman not installed (skip)" -ForegroundColor Gray
}

Write-Host "5️⃣  Clearing Android build cache..." -ForegroundColor Yellow
if (Test-Path "android") {
    Push-Location android

    $androidPaths = @("build", "app/build", ".gradle", ".cxx")
    foreach ($path in $androidPaths) {
        if (Test-Path $path) {
            Remove-Item $path -Recurse -Force
            $cleaned++
            if ($Verbose) { Write-Host "   Removed: android/$path" -ForegroundColor Gray }
        }
    }

    Pop-Location
    Write-Host "   ✅ Android cache cleared" -ForegroundColor Green
} else {
    Write-Host "   ⏭️  Android directory not found (skip)" -ForegroundColor Gray
}

Write-Host "6️⃣  Clearing iOS build cache..." -ForegroundColor Yellow
if (Test-Path "ios") {
    Push-Location ios

    $iosPaths = @("build", "Pods", "Podfile.lock", "DerivedData")
    foreach ($path in $iosPaths) {
        if (Test-Path $path) {
            Remove-Item $path -Recurse -Force
            $cleaned++
            if ($Verbose) { Write-Host "   Removed: ios/$path" -ForegroundColor Gray }
        }
    }

    Pop-Location
    Write-Host "   ✅ iOS cache cleared" -ForegroundColor Green
} else {
    Write-Host "   ⏭️  iOS directory not found (skip)" -ForegroundColor Gray
}

if ($IncludeGlobal) {
    Write-Host "7️⃣  Clearing global npm cache..." -ForegroundColor Yellow
    npm cache clean --force
    $cleaned++
    Write-Host "   ✅ Global npm cache cleared" -ForegroundColor Green
}

Write-Host "8️⃣  Reinstalling dependencies..." -ForegroundColor Yellow
npm ci --prefer-offline=false --no-audit --loglevel=error
Write-Host "   ✅ Dependencies reinstalled" -ForegroundColor Green

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✅ Cache wipe complete!" -ForegroundColor Green
Write-Host "   Cleaned: $cleaned cache locations" -ForegroundColor White
Write-Host "   Duration: $([math]::Round($duration, 1))s" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run: npx expo-doctor" -ForegroundColor White
Write-Host "  2. Run: npx expo prebuild --clean" -ForegroundColor White
Write-Host "  3. Build: eas build --platform all --profile production --clear-cache" -ForegroundColor White
Write-Host ""
