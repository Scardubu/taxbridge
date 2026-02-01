# TaxBridge - Nuclear Cache Wipe
# Removes ALL caches to force Metro to use updated config

Write-Host "🚨 NUCLEAR CACHE WIPE - Removing all Metro and Expo caches..." -ForegroundColor Yellow

$ErrorActionPreference = "SilentlyContinue"

# Stop all Metro/Node processes
Write-Host "`n1. Stopping all Node processes..." -ForegroundColor Cyan
Get-Process -Name node | Stop-Process -Force
Start-Sleep -Seconds 2

# Metro bundler cache
Write-Host "`n2. Removing Metro bundler cache..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Temp\metro-*"
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Temp\haste-map-*"
Remove-Item -Recurse -Force "$env:TEMP\metro-*"
Remove-Item -Recurse -Force "$env:TEMP\haste-map-*"

# Expo caches
Write-Host "`n3. Removing Expo caches..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "mobile\.expo"
Remove-Item -Recurse -Force "mobile\.expo-web"
Remove-Item -Recurse -Force "mobile\node_modules\.cache"
Remove-Item -Recurse -Force "$env:USERPROFILE\.expo\web-cache"

# Watchman cache (if exists)
Write-Host "`n4. Removing Watchman cache..." -ForegroundColor Cyan
if (Get-Command watchman -ErrorAction SilentlyContinue) {
    watchman watch-del-all
}

# Yarn cache
Write-Host "`n5. Clearing Yarn cache..." -ForegroundColor Cyan
yarn cache clean

# Browser cache hint
Write-Host "`n6. Browser cache..." -ForegroundColor Cyan
Write-Host "   Open DevTools (F12) → Network tab → Check 'Disable cache'" -ForegroundColor Gray
Write-Host "   Or do a hard refresh: Ctrl+Shift+R" -ForegroundColor Gray

Write-Host "`n✅ Cache wipe complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. cd mobile" -ForegroundColor White
Write-Host "2. yarn start --clear --reset-cache" -ForegroundColor White
Write-Host "3. Open http://localhost:8081 in a NEW incognito window" -ForegroundColor White
Write-Host "4. Check console for 'Invalid hook call' - should be gone" -ForegroundColor White

$ErrorActionPreference = "Continue"
