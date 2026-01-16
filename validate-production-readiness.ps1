#!/usr/bin/env pwsh
# TaxBridge Production Readiness Validation Script
# Run this before deployment to verify all systems are ready

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host ""
Write-Host "TaxBridge Production Readiness Validator" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$failureCount = 0
$warningCount = 0

function Test-Step {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [bool]$Critical = $true
    )
    
    Write-Host "[*] $Name..." -NoNewline
    
    try {
        $result = & $Test
        if ($result -eq $true -or $result -eq $null) {
            Write-Host " [OK]" -ForegroundColor Green
            return $true
        } else {
            if ($Critical) {
                Write-Host " [FAILED]" -ForegroundColor Red
                $script:failureCount++
            } else {
                Write-Host " [WARN]" -ForegroundColor Yellow
                $script:warningCount++
            }
            return $false
        }
    } catch {
        if ($Critical) {
            Write-Host " [ERROR]: $_" -ForegroundColor Red
            $script:failureCount++
        } else {
            Write-Host " [WARN]: $_" -ForegroundColor Yellow
            $script:warningCount++
        }
        return $false
    }
}

# ============================================
# 1. Repository Structure
# ============================================
Write-Host ""
Write-Host "[1] Repository Structure" -ForegroundColor Yellow
Write-Host ""

Test-Step "mobile/ directory exists" {
    Test-Path "mobile"
}

Test-Step "backend/ directory exists" {
    Test-Path "backend"
}

Test-Step "admin-dashboard/ directory exists" {
    Test-Path "admin-dashboard"
}

Test-Step "docs/ directory exists" {
    Test-Path "docs"
}

# ============================================
# 2. Brand Assets
# ============================================
Write-Host ""
Write-Host "[2] Brand Assets Inventory" -ForegroundColor Yellow
Write-Host ""

$requiredAssets = @(
    "mobile/assets/icon.png",
    "mobile/assets/adaptive-icon.png",
    "mobile/assets/splash-icon.png",
    "mobile/assets/favicon.png",
    "mobile/assets/favicon 32x32.png",
    "mobile/assets/favicon 16x16.png",
    "mobile/assets/logo.png",
    "mobile/assets/logo 2000x500.png"
)

foreach ($asset in $requiredAssets) {
    $assetName = Split-Path -Leaf $asset
    Test-Step "Asset exists: $assetName" {
        Test-Path $asset
    }
}

# ============================================
# 3. Configuration Files
# ============================================
Write-Host ""
Write-Host "[3] Configuration Files" -ForegroundColor Yellow
Write-Host ""

Test-Step "mobile/eas.json exists" {
    Test-Path "mobile/eas.json"
}

Test-Step "mobile/app.json exists" {
    Test-Path "mobile/app.json"
}

Test-Step "admin-dashboard/next.config.ts exists" {
    Test-Path "admin-dashboard/next.config.ts"
}

Test-Step "backend/tsconfig.json exists" {
    Test-Path "backend/tsconfig.json"
}

Test-Step "backend/prisma/schema.prisma exists" {
    Test-Path "backend/prisma/schema.prisma"
}

# ============================================
# 4. Environment Configuration
# ============================================
Write-Host ""
Write-Host "[4] Environment Configuration" -ForegroundColor Yellow
Write-Host ""

Test-Step "EAS production profile configured" {
    $easConfig = Get-Content "mobile/eas.json" -Raw | ConvertFrom-Json
    $null -ne $easConfig.build.production
}

Test-Step "Production API URL set in EAS" {
    $easConfig = Get-Content "mobile/eas.json" -Raw | ConvertFrom-Json
    $easConfig.build.production.env.EXPO_PUBLIC_API_URL -eq "https://api.taxbridge.ng"
}

Test-Step "No hardcoded localhost in mobile services" {
    $apiService = Get-Content "mobile/src/services/api.ts" -Raw
    $databaseService = Get-Content "mobile/src/services/database.ts" -Raw
    -not ($apiService -match "localhost:3000" -and $databaseService -match "localhost:3000")
} -Critical $false

Test-Step "Admin metadataBase configured" {
    $layout = Get-Content "admin-dashboard/app/layout.tsx" -Raw
    $layout -match "metadataBase.*https://admin.taxbridge.ng"
}

# ============================================
# 5. Dependencies
# ============================================
Write-Host ""
Write-Host "[5] Dependencies" -ForegroundColor Yellow
Write-Host ""

Test-Step "Backend node_modules exists" {
    Test-Path "backend/node_modules"
} -Critical $false

Test-Step "Mobile node_modules exists" {
    Test-Path "mobile/node_modules"
} -Critical $false

Test-Step "Admin node_modules exists" {
    Test-Path "admin-dashboard/node_modules"
} -Critical $false

# ============================================
# 6. TypeScript Compilation
# ============================================
Write-Host ""
Write-Host "[6] TypeScript Compilation" -ForegroundColor Yellow
Write-Host ""

Test-Step "Backend TypeScript compiles" {
    Push-Location backend
    $output = npm run build 2>&1
    Pop-Location
    $LASTEXITCODE -eq 0
}

Test-Step "Mobile TypeScript validates" {
    Push-Location mobile
    $output = yarn tsc --noEmit 2>&1
    Pop-Location
    $LASTEXITCODE -eq 0
}

Test-Step "Admin TypeScript compiles" {
    Push-Location admin-dashboard
    $output = npm run build 2>&1
    Pop-Location
    $LASTEXITCODE -eq 0
}

# ============================================
# 7. Test Suites
# ============================================
Write-Host ""
Write-Host "[7] Test Suites" -ForegroundColor Yellow
Write-Host ""

Test-Step "Backend tests pass" {
    Push-Location backend
    $output = npm test 2>&1
    Pop-Location
    $LASTEXITCODE -eq 0
}

Test-Step "Mobile tests pass" {
    Push-Location mobile
    $output = yarn test --watchAll=false 2>&1
    Pop-Location
    $LASTEXITCODE -eq 0
}

# ============================================
# 8. Documentation
# ============================================
Write-Host ""
Write-Host "[8] Documentation" -ForegroundColor Yellow
Write-Host ""

Test-Step "PRD.md exists" {
    Test-Path "docs/PRD.md"
}

Test-Step "README.md updated with new logo" {
    $readme = Get-Content "README.md" -Raw
    $readme -match "mobile/assets/logo.*2000x500.png"
}

Test-Step "Production checklist exists" {
    Test-Path "PRODUCTION_FINAL_CHECKLIST.md"
}

Test-Step "Quick deployment guide exists" {
    Test-Path "DEPLOY_QUICK_REFERENCE.md"
}

# ============================================
# 9. Security
# ============================================
Write-Host ""
Write-Host "[9] Security Baseline" -ForegroundColor Yellow
Write-Host ""

Test-Step "Encryption utility exists" {
    Test-Path "backend/src/lib/encryption.ts"
}

Test-Step "JWT middleware exists" {
    Test-Path "backend/src/middleware/auth.ts"
}

Test-Step "Rate limiting configured" {
    $server = Get-Content "backend/src/server.ts" -Raw
    $server -match "rate.*limit"
}

Test-Step "Helmet.js security headers" {
    $server = Get-Content "backend/src/server.ts" -Raw
    $server -match "helmet"
}

Test-Step ".env file not committed" {
    $gitignore = Get-Content ".gitignore" -Raw
    $gitignore -match "\.env"
}

# ============================================
# 10. Compliance
# ============================================
Write-Host ""
Write-Host "[10] Compliance" -ForegroundColor Yellow
Write-Host ""

Test-Step "DigiTax integration exists" {
    Test-Path "backend/integrations/digitax-client.ts"
}

Test-Step "UBL invoice generation exists" {
    Test-Path "backend/src/services/ubl-invoice-service.ts"
}

Test-Step "Remita payment integration exists" {
    Test-Path "backend/integrations/remita-client.ts"
}

Test-Step "No direct NRS integration" {
    $allFiles = Get-ChildItem -Path "backend" -Include "*.ts","*.js" -Recurse | Get-Content -Raw
    -not ($allFiles -match "nrs.gov.ng|firs.gov.ng")
}

# ============================================
# Final Summary
# ============================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

if ($failureCount -eq 0) {
    Write-Host "[OK] All Critical Checks Passed!" -ForegroundColor Green
    Write-Host ""
    if ($warningCount -gt 0) {
        Write-Host "[WARN] $warningCount warnings (non-critical)" -ForegroundColor Yellow
    } else {
        Write-Host "[SUCCESS] Production Ready! No warnings." -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Review PRODUCTION_FINAL_CHECKLIST.md" -ForegroundColor White
    Write-Host "2. Configure production environment variables" -ForegroundColor White
    Write-Host "3. Deploy backend, then admin, then mobile (in order)" -ForegroundColor White
    Write-Host "4. Run post-deployment smoke tests" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "FAILED: $failureCount critical issues found" -ForegroundColor Red
    Write-Host "WARNING: $warningCount warnings" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "NOT READY FOR PRODUCTION" -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix critical issues before deploying." -ForegroundColor White
    Write-Host ""
    exit 1
}
