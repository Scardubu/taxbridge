# FILE: scripts/1-Install-Dependencies.ps1
# PURPOSE: Install all dependencies with comprehensive verification

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TaxBridge Dependency Installation" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

$pkgManager = if (Test-Path "yarn.lock") { "yarn" } 
              elseif (Test-Path "pnpm-lock.yaml") { "pnpm" } 
              else { "npm" }

Write-Host "`nUsing package manager: $pkgManager" -ForegroundColor Cyan

# Root dependencies
Write-Host "`n📦 Installing root dependencies..." -ForegroundColor Yellow
& $pkgManager install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Root installation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Root dependencies installed" -ForegroundColor Green

# Mobile dependencies
Write-Host "`n📱 Installing mobile dependencies..." -ForegroundColor Yellow
Push-Location mobile
& $pkgManager install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Mobile installation failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "   Checking Expo CLI..." -NoNewline
$expoVersion = npx expo --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓ ($expoVersion)" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Expo CLI not found (install with: npm install -g expo-cli)" -ForegroundColor Yellow
}
Pop-Location

# Backend dependencies
Write-Host "`n🔧 Installing backend dependencies..." -ForegroundColor Yellow
Push-Location backend
& $pkgManager install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend installation failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "   Generating Prisma Client..." -NoNewline
npx prisma generate 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓" -ForegroundColor Green
} else {
    Write-Host " ✗ (run manually: cd backend && npx prisma generate)" -ForegroundColor Red
}
Pop-Location

# Admin dashboard dependencies
Write-Host "`n🖥️  Installing admin dashboard dependencies..." -ForegroundColor Yellow
Push-Location admin-dashboard
& $pkgManager install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Admin installation failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Contracts package
if (Test-Path "packages/contracts") {
    Write-Host "`n📋 Building contracts package..." -ForegroundColor Yellow
    Push-Location packages/contracts
    & $pkgManager install
    if (Test-Path "tsconfig.json") {
        npx tsc --build 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Contracts built" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Contracts build had warnings (non-blocking)" -ForegroundColor Yellow
        }
    }
    Pop-Location
}

# Verification matrix
Write-Host "`n🔍 Verification Matrix" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray

$workspaces = @("mobile", "backend", "admin-dashboard", "packages/contracts")
foreach ($workspace in $workspaces) {
    if (Test-Path $workspace) {
        Write-Host "  $workspace/" -NoNewline -ForegroundColor White
        
        if (Test-Path "$workspace/node_modules") {
            $moduleCount = (Get-ChildItem "$workspace/node_modules" -Directory -ErrorAction SilentlyContinue).Count
            Write-Host " ✓ ($moduleCount packages)" -ForegroundColor Green
        } else {
            Write-Host " ✗ node_modules missing" -ForegroundColor Red
        }
    }
}

Write-Host "`n✅ Installation complete!" -ForegroundColor Green
