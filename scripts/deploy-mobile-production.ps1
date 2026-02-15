# TaxBridge Mobile Production Deployment Script
# Triggers fresh EAS build with cache clearing

param(
    [switch]$DryRun,
    [string]$Platform = "android",
    [string]$Profile = "production-apk"
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  TaxBridge Mobile Deployment" -ForegroundColor Cyan
Write-Host "  Platform: $Platform" -ForegroundColor Cyan
Write-Host "  Profile: $Profile" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify we're in the right directory
if (-not (Test-Path "mobile/eas.json")) {
    Write-Host "[ERROR] Not in TaxBridge root directory" -ForegroundColor Red
    Write-Host "Please run from: c:\Users\USR\Documents\taxbridge" -ForegroundColor Red
    exit 1
}

# Step 2: Validate eas.json
Write-Host "[Step 1] Validating eas.json..." -ForegroundColor Yellow

Push-Location mobile

try {
    $easConfig = Get-Content eas.json -Raw | ConvertFrom-Json
    Write-Host "  [OK] eas.json is valid" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Invalid eas.json: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Step 3: Check EAS CLI is installed
Write-Host "`n[Step 2] Checking EAS CLI..." -ForegroundColor Yellow

$easVersion = eas --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] EAS CLI installed: $easVersion" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] EAS CLI not found. Installing..." -ForegroundColor Red
    npm install -g eas-cli
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Failed to install EAS CLI" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

# Step 4: Trigger build with cache clearing
Write-Host "`n[Step 3] Triggering EAS Build..." -ForegroundColor Yellow
Write-Host "  Platform: $Platform" -ForegroundColor Cyan
Write-Host "  Profile: $Profile" -ForegroundColor Cyan
Write-Host "  Cache: Clearing (force fresh build)" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "  [DRY RUN] Would execute:" -ForegroundColor Gray
    Write-Host "  eas build --platform $Platform --profile $Profile --clear-cache --non-interactive" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[DRY RUN COMPLETE]" -ForegroundColor Yellow
} else {
    Write-Host "  Executing build command..." -ForegroundColor White
    
    eas build --platform $Platform --profile $Profile --clear-cache --non-interactive
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Green
        Write-Host "  [SUCCESS] Build Triggered!" -ForegroundColor Green
        Write-Host "=========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Monitor build progress:" -ForegroundColor White
        Write-Host "  https://expo.dev/accounts/taxbridgengs-organization/projects/taxbridge/builds" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Expected build time: 10-15 minutes" -ForegroundColor Gray
        Write-Host ""
        Write-Host "After build completes:" -ForegroundColor Yellow
        Write-Host "  1. Download APK from EAS dashboard" -ForegroundColor White
        Write-Host "  2. Install on Android device" -ForegroundColor White
        Write-Host "  3. Test splash screen (should be single logo)" -ForegroundColor White
        Write-Host "  4. Test 'Let's Start' button (should not crash)" -ForegroundColor White
        Write-Host "  5. Complete onboarding flow" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Red
        Write-Host "  [ERROR] Build Failed!" -ForegroundColor Red
        Write-Host "=========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Check the error messages above" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

Pop-Location

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Deployment Script Complete" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
