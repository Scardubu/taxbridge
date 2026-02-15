<#
.SYNOPSIS
    Clean all caches and prepare for a fresh EAS build
.DESCRIPTION
    This script clears all local caches (Metro, Expo, npm, Gradle) to ensure
    the next EAS build does not use any cached files.
.EXAMPLE
    .\scripts\clean-build.ps1
    .\scripts\clean-build.ps1 -Profile production-apk
#>

param(
    [string]$Profile = "production-apk",
    [switch]$SkipBuild,
    [switch]$ClearCredentials
)

$ErrorActionPreference = "Stop"
$MobileDir = Split-Path -Parent $PSScriptRoot

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TaxBridge Clean Build Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Navigate to mobile directory
Set-Location $MobileDir
Write-Host "[1/8] Working directory: $MobileDir" -ForegroundColor Yellow

# Step 1: Clear Metro bundler cache
Write-Host "`n[2/8] Clearing Metro bundler cache..." -ForegroundColor Yellow
$metroCachePaths = @(
    "$env:TEMP\metro-*",
    "$env:TEMP\haste-map-*",
    "$env:TEMP\react-*"
)
foreach ($path in $metroCachePaths) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Cleared: $path" -ForegroundColor Gray
    }
}
Write-Host "  Metro cache cleared" -ForegroundColor Green

# Step 2: Clear Expo cache
Write-Host "`n[3/8] Clearing Expo cache..." -ForegroundColor Yellow
$expoCachePaths = @(
    ".\.expo",
    ".\dist\_expo",
    ".\dist",
    "$env:LOCALAPPDATA\Expo"
)
foreach ($path in $expoCachePaths) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Cleared: $path" -ForegroundColor Gray
    }
}
Write-Host "  Expo cache cleared" -ForegroundColor Green

# Step 3: Clear node_modules/.cache
Write-Host "`n[4/8] Clearing node_modules cache..." -ForegroundColor Yellow
$nodeModulesCache = ".\node_modules\.cache"
if (Test-Path $nodeModulesCache) {
    Remove-Item -Path $nodeModulesCache -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Cleared: $nodeModulesCache" -ForegroundColor Gray
}
Write-Host "  node_modules cache cleared" -ForegroundColor Green

# Step 4: Clear Android build artifacts (if they exist from local builds)
Write-Host "`n[5/8] Clearing Android build artifacts..." -ForegroundColor Yellow
$androidPaths = @(
    ".\android\.gradle",
    ".\android\app\build",
    ".\android\build"
)
foreach ($path in $androidPaths) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Cleared: $path" -ForegroundColor Gray
    }
}
Write-Host "  Android artifacts cleared" -ForegroundColor Green

# Step 5: Clear npm cache (optional but thorough)
Write-Host "`n[6/8] Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force 2>$null
Write-Host "  npm cache cleared" -ForegroundColor Green

# Step 6: Reinstall dependencies
Write-Host "`n[7/8] Reinstalling dependencies..." -ForegroundColor Yellow
if (Test-Path ".\node_modules") {
    Remove-Item -Path ".\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Removed node_modules" -ForegroundColor Gray
}
if (Test-Path ".\package-lock.json") {
    Remove-Item -Path ".\package-lock.json" -Force -ErrorAction SilentlyContinue
    Write-Host "  Removed package-lock.json" -ForegroundColor Gray
}
npm install
Write-Host "  Dependencies reinstalled" -ForegroundColor Green

# Step 7: Clear EAS credentials cache (optional)
if ($ClearCredentials) {
    Write-Host "`n[7b/8] Clearing EAS credentials cache..." -ForegroundColor Yellow
    eas credentials --clear-cache 2>$null
    Write-Host "  EAS credentials cache cleared" -ForegroundColor Green
}

# Step 8: Trigger EAS build with --clear-cache flag
if (-not $SkipBuild) {
    Write-Host "`n[8/8] Starting EAS build with cache disabled..." -ForegroundColor Yellow
    Write-Host "  Profile: $Profile" -ForegroundColor Cyan
    Write-Host "  Platform: Android" -ForegroundColor Cyan
    Write-Host ""
    
    # The --clear-cache flag forces EAS to not use any cached build artifacts
    eas build --platform android --profile $Profile --clear-cache --non-interactive
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n========================================" -ForegroundColor Green
        Write-Host "  Build submitted successfully!" -ForegroundColor Green
        Write-Host "========================================`n" -ForegroundColor Green
    } else {
        Write-Host "`n========================================" -ForegroundColor Red
        Write-Host "  Build failed! Check logs above." -ForegroundColor Red
        Write-Host "========================================`n" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`n[8/8] Skipping build (--SkipBuild flag set)" -ForegroundColor Yellow
    Write-Host "`nTo build manually, run:" -ForegroundColor Cyan
    Write-Host "  eas build --platform android --profile $Profile --clear-cache" -ForegroundColor White
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Cache Clearing Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary of cleared caches:" -ForegroundColor Yellow
Write-Host "  - Metro bundler cache" -ForegroundColor Gray
Write-Host "  - Expo cache (.expo, dist)" -ForegroundColor Gray
Write-Host "  - node_modules/.cache" -ForegroundColor Gray
Write-Host "  - Android build artifacts" -ForegroundColor Gray
Write-Host "  - npm cache" -ForegroundColor Gray
Write-Host "  - node_modules (reinstalled)" -ForegroundColor Gray
Write-Host ""
Write-Host "EAS build configuration:" -ForegroundColor Yellow
Write-Host "  - cache.disabled: true (in eas.json)" -ForegroundColor Gray
Write-Host "  - --clear-cache flag used" -ForegroundColor Gray
Write-Host ""
