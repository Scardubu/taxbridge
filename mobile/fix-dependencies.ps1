# TaxBridge Mobile - Dependency Fix Script
# Fixes yarn package resolution issues and prepares for EAS build

Write-Host "🔧 TaxBridge Mobile - Dependency Fix Script" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean existing installations
Write-Host "Step 1: Cleaning existing installations..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  Removing node_modules..." -ForegroundColor Gray
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
}
if (Test-Path "yarn.lock") {
    Write-Host "  Removing yarn.lock..." -ForegroundColor Gray
    Remove-Item -Force yarn.lock -ErrorAction SilentlyContinue
}
Write-Host "  ✓ Clean complete" -ForegroundColor Green
Write-Host ""

# Step 2: Clear yarn cache
Write-Host "Step 2: Clearing yarn cache..." -ForegroundColor Yellow
yarn cache clean --all 2>&1 | Out-Null
Write-Host "  ✓ Cache cleared" -ForegroundColor Green
Write-Host ""

# Step 3: Install dependencies with resolutions
Write-Host "Step 3: Installing dependencies (this may take 2-3 minutes)..." -ForegroundColor Yellow
$installOutput = yarn install --network-timeout 120000 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Installation failed. Output:" -ForegroundColor Red
    Write-Host $installOutput -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Verify critical packages
Write-Host "Step 4: Verifying critical packages..." -ForegroundColor Yellow
$criticalPackages = @(
    "expo",
    "expo-build-properties",
    "react",
    "react-native",
    "@babel/core",
    "typescript"
)

$allPresent = $true
foreach ($pkg in $criticalPackages) {
    if (Test-Path "node_modules\$pkg") {
        Write-Host "  ✓ $pkg" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $pkg MISSING" -ForegroundColor Red
        $allPresent = $false
    }
}
Write-Host ""

if (-not $allPresent) {
    Write-Host "❌ Some critical packages are missing. Please check the errors above." -ForegroundColor Red
    exit 1
}

# Step 5: TypeScript check
Write-Host "Step 5: Running TypeScript check..." -ForegroundColor Yellow
$tscOutput = yarn tsc --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ TypeScript: 0 errors" -ForegroundColor Green
} else {
    Write-Host "  ⚠ TypeScript errors found (non-fatal)" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Summary
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "✅ Dependency fix complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Test locally: yarn start" -ForegroundColor White
Write-Host "  2. Build for EAS: npx eas-cli build --platform android --profile preview" -ForegroundColor White
Write-Host ""
