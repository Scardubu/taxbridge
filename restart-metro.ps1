# TaxBridge Metro Restart Script
# Fixes file watcher timeout issues on Windows

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "TaxBridge Metro Restart Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop all Node processes
Write-Host "[1/6] Stopping Node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "[OK] Node processes stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Clean Metro cache
Write-Host "[2/6] Cleaning Metro cache..." -ForegroundColor Yellow
$tempPath = [System.IO.Path]::GetTempPath()
Remove-Item -Path "$tempPath\metro-*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$tempPath\haste-map-*" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "[OK] Metro cache cleaned" -ForegroundColor Green
Write-Host ""

# Step 3: Clean Expo caches
Write-Host "[3/6] Cleaning Expo caches..." -ForegroundColor Yellow
Set-Location "c:\Users\USR\Documents\taxbridge\mobile"
Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".expo-web" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "[OK] Expo caches cleaned" -ForegroundColor Green
Write-Host ""

# Step 4: Verify watchman (optional)
Write-Host "[4/6] Checking Watchman..." -ForegroundColor Yellow
$watchmanExists = Get-Command watchman -ErrorAction SilentlyContinue
if ($watchmanExists) {
    watchman watch-del-all 2>$null
    Write-Host "[OK] Watchman caches cleared" -ForegroundColor Green
} else {
    Write-Host "[SKIP] Watchman not installed (optional)" -ForegroundColor Gray
}
Write-Host ""

# Step 5: Verify metro.config.js
Write-Host "[5/6] Verifying metro.config.js..." -ForegroundColor Yellow
if (Test-Path "c:\Users\USR\Documents\taxbridge\mobile\metro.config.js") {
    Write-Host "[OK] metro.config.js exists" -ForegroundColor Green
} else {
    Write-Host "[ERROR] metro.config.js missing!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Start Metro with clean cache
Write-Host "[6/6] Starting Metro bundler..." -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Metro will start now with clean cache" -ForegroundColor Cyan
Write-Host "Watch for QR code and web server confirmation" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "c:\Users\USR\Documents\taxbridge"
yarn workspace mobile start --clear --reset-cache
