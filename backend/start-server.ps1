# TaxBridge Backend Server Startup
# Run from the backend directory

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  TaxBridge Backend Server Startup                         " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# Check environment
Write-Host "[1/3] Checking environment..." -ForegroundColor Yellow
$envContent = Get-Content .env -ErrorAction SilentlyContinue
$hasAll = $true

$vars = @("DATABASE_URL", "ENCRYPTION_KEY", "JWT_SECRET", "JWT_REFRESH_SECRET")
foreach ($var in $vars) {
    $found = $envContent | Where-Object { $_ -match "^$var=" }
    if (-not $found) {
        Write-Host "   [X] Missing: $var" -ForegroundColor Red
        $hasAll = $false
    }
}

if ($hasAll) {
    Write-Host "[OK] Environment configured" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Please add missing variables to .env" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Check Prisma
Write-Host "[2/3] Checking Prisma..." -ForegroundColor Yellow
if (Test-Path "../node_modules/@prisma/client") {
    Write-Host "[OK] Prisma Client ready" -ForegroundColor Green
} else {
    Write-Host "[!] Generating Prisma Client..." -ForegroundColor Yellow
    & node_modules\.bin\prisma generate
}
Write-Host ""

# Start server
Write-Host "[3/3] Starting server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  Server Starting on Port 3000                             " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Security Features Enabled:" -ForegroundColor Green
Write-Host "   - AES-256-GCM Encryption" -ForegroundColor Gray
Write-Host "   - JWT Authentication (15min access, 7day refresh)" -ForegroundColor Gray
Write-Host "   - MFA Support (TOTP)" -ForegroundColor Gray
Write-Host "   - NDPA 2023 Compliance" -ForegroundColor Gray
Write-Host "   - Security Headers (Helmet)" -ForegroundColor Gray
Write-Host "   - Input Validation" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

npm run dev
