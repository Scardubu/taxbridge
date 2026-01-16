# TaxBridge - Quick Status Check
# Run this anytime to verify production readiness

Write-Host ""
Write-Host "=== TAXBRIDGE PRODUCTION STATUS ===" -ForegroundColor Cyan
Write-Host ""

# Brand Assets
Write-Host "[BRAND ASSETS]" -ForegroundColor Yellow
$assetCount = (Get-ChildItem mobile/assets/*.png -ErrorAction SilentlyContinue).Count
if ($assetCount -eq 8) {
    Write-Host "  OK: $assetCount/8 brand assets found" -ForegroundColor Green
} else {
    Write-Host "  WARN: Only $assetCount/8 assets found" -ForegroundColor Yellow
}

# Build Status
Write-Host ""
Write-Host "[BUILD STATUS]" -ForegroundColor Yellow
if (Test-Path "backend/dist") {
    Write-Host "  OK: Backend compiled" -ForegroundColor Green
} else {
    Write-Host "  PENDING: Backend not compiled (run: cd backend && npm run build)" -ForegroundColor Yellow
}

if (Test-Path "admin-dashboard/.next") {
    Write-Host "  OK: Admin dashboard compiled" -ForegroundColor Green
} else {
    Write-Host "  PENDING: Admin not compiled (run: cd admin-dashboard && npm run build)" -ForegroundColor Yellow
}

# Documentation
Write-Host ""
Write-Host "[DOCUMENTATION]" -ForegroundColor Yellow
$docs = @(
    "PRODUCTION_FINAL_CHECKLIST.md",
    "DEPLOY_QUICK_REFERENCE.md",
    "PRODUCTION_INTEGRATION_SUMMARY.md"
)

$allDocsExist = $true
foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "  OK: $doc" -ForegroundColor Green
    } else {
        Write-Host "  MISSING: $doc" -ForegroundColor Red
        $allDocsExist = $false
    }
}

# Environment Configuration
Write-Host ""
Write-Host "[ENVIRONMENT CONFIG]" -ForegroundColor Yellow
try {
    $eas = Get-Content "mobile/eas.json" -Raw | ConvertFrom-Json
    $prodUrl = $eas.build.production.env.EXPO_PUBLIC_API_URL
    
    if ($prodUrl -eq "https://api.taxbridge.ng") {
        Write-Host "  OK: Production API URL configured correctly" -ForegroundColor Green
        Write-Host "      $prodUrl" -ForegroundColor Cyan
    } else {
        Write-Host "  WARN: Unexpected production URL: $prodUrl" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERROR: Could not read eas.json" -ForegroundColor Red
}

# Final Status
Write-Host ""
if ($assetCount -eq 8 -and (Test-Path "backend/dist") -and (Test-Path "admin-dashboard/.next") -and $allDocsExist) {
    Write-Host "=== STATUS: PRODUCTION READY ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Review PRODUCTION_FINAL_CHECKLIST.md" -ForegroundColor White
    Write-Host "2. Configure production environment variables" -ForegroundColor White
    Write-Host "3. Deploy using DEPLOY_QUICK_REFERENCE.md" -ForegroundColor White
} else {
    Write-Host "=== STATUS: PENDING ===" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run builds before deploying:" -ForegroundColor White
    Write-Host "  cd backend && npm run build" -ForegroundColor White
    Write-Host "  cd admin-dashboard && npm run build" -ForegroundColor White
}

Write-Host ""
