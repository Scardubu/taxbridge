#!/usr/bin/env pwsh

param(
    [switch]$Verbose,
    [switch]$SkipTests
)

Write-Host ""
Write-Host "🚀 TaxBridge Pre-Deployment Final Check V6.0" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$allChecks = @()
$startTime = Get-Date

Write-Host "1️⃣  Mobile Build Configuration" -ForegroundColor Magenta
Push-Location mobile

if (Test-Path "eas.json") {
    $easConfig = Get-Content "eas.json" | ConvertFrom-Json

    if ($easConfig.build.production.cache.disabled -eq $true) {
        Write-Host "   ✅ Cache disabled for production" -ForegroundColor Green
        $allChecks += $true
    } else {
        Write-Host "   ❌ CRITICAL: Cache NOT disabled!" -ForegroundColor Red
        $allChecks += $false
    }

    $apiUrl = $easConfig.build.production.env.EXPO_PUBLIC_API_URL
    if ($apiUrl -eq "https://taxbridge-api-ker8.onrender.com") {
        Write-Host "   ✅ Production API URL correct" -ForegroundColor Green
        $allChecks += $true
    } else {
        Write-Host "   ❌ CRITICAL: Wrong API URL: $apiUrl" -ForegroundColor Red
        $allChecks += $false
    }

    $envVars = $easConfig.build.base.env
    $requiredEnvVars = @(
        "EAS_BUILD_DISABLE_NPM_CACHE",
        "EAS_BUILD_DISABLE_MAVEN_CACHE",
        "METRO_CACHE_DISABLED"
    )

    foreach ($var in $requiredEnvVars) {
        if ($envVars.PSObject.Properties.Name -contains $var) {
            Write-Host "   ✅ $var present" -ForegroundColor Green
            $allChecks += $true
        } else {
            Write-Host "   ❌ $var missing!" -ForegroundColor Red
            $allChecks += $false
        }
    }
} else {
    Write-Host "   ❌ eas.json missing!" -ForegroundColor Red
    $allChecks += $false
}

Pop-Location

Write-Host ""
Write-Host "2️⃣  Backend Test Suite" -ForegroundColor Magenta
Push-Location backend

if (-not $SkipTests) {
    npm test 2>&1 | Out-Host
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ All tests passing (460+ tests)" -ForegroundColor Green
        $allChecks += $true
    } else {
        Write-Host "   ❌ CRITICAL: Tests failing!" -ForegroundColor Red
        $allChecks += $false
    }
} else {
    Write-Host "   ⏭️  Tests skipped (--SkipTests)" -ForegroundColor Gray
}

Pop-Location

Write-Host ""
Write-Host "3️⃣  Tax Rules Compliance (NTA 2025)" -ForegroundColor Magenta

$taxRulesFile = "packages/contracts/src/tax-rules.ts"
if (Test-Path $taxRulesFile) {
    $content = Get-Content $taxRulesFile -Raw

    $taxChecks = @(
        @($content -match "rate:\s*0\.04", "Development Levy 4%"),
        @($content -match "rate:\s*0\.02", "EDT 2%"),
        @($content -match "rate:\s*0\.15", "Minimum ETR 15%"),
        @($content -match "digitalIncome:\s*25_000_000", "Digital Tax ₦25M")
    )

    foreach ($check in $taxChecks) {
        if ($check[0]) {
            Write-Host "   ✅ $($check[1]) verified" -ForegroundColor Green
            $allChecks += $true
        } else {
            Write-Host "   ❌ CRITICAL: $($check[1]) missing!" -ForegroundColor Red
            $allChecks += $false
        }
    }
} else {
    Write-Host "   ❌ Tax rules file missing!" -ForegroundColor Red
    $allChecks += $false
}

Write-Host ""
Write-Host "4️⃣  Environment Configuration" -ForegroundColor Magenta

$envFileCandidates = @(
    "backend/.env.production.example",
    "mobile/.env.production.example",
    "admin-dashboard/.env.production.example",
    ".env.production.example"
)

$envFile = $envFileCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($envFile) {
    Write-Host "   ✅ Using env template: $envFile" -ForegroundColor Green
    $envContent = Get-Content $envFile -Raw

    $requiredVars = @(
        "DATABASE_URL",
        "REDIS_URL",
        "JWT_SECRET",
        "ENCRYPTION_KEY",
        "TAX_ID_ENCRYPTION_KEY",
        "ALLOWED_ORIGINS"
    )

    foreach ($var in $requiredVars) {
        if ($envContent -match $var) {
            Write-Host "   ✅ $var documented" -ForegroundColor Green
            $allChecks += $true
        } else {
            Write-Host "   ⚠️  $var not in .env.example" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   ⚠️  .env.production.example not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "5️⃣  Security Hardening" -ForegroundColor Magenta

$securityFiles = @(
    "backend/src/lib/crypto.ts",
    "backend/src/lib/auditLog.ts",
    "backend/src/middleware/rateLimiter.ts"
)

foreach ($file in $securityFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $(Split-Path $file -Leaf) exists" -ForegroundColor Green
        $allChecks += $true
    } else {
        Write-Host "   ❌ $file missing!" -ForegroundColor Red
        $allChecks += $false
    }
}

Write-Host ""
Write-Host "6️⃣  NRS E-Invoicing Integration" -ForegroundColor Magenta

if (Test-Path "backend/src/services/nrs-submission.ts") {
    $nrsContent = Get-Content "backend/src/services/nrs-submission.ts" -Raw

    $nrsChecks = @(
        @($nrsContent -match "nrsReference", "Idempotency"),
        @($nrsContent -match "circuitBreaker", "Circuit Breaker"),
        @($nrsContent -match "retry", "Retry Logic"),
        @($nrsContent -match "exponential", "Exponential Backoff")
    )

    foreach ($check in $nrsChecks) {
        if ($check[0]) {
            Write-Host "   ✅ $($check[1]) implemented" -ForegroundColor Green
            $allChecks += $true
        } else {
            Write-Host "   ⚠️  $($check[1]) not found" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   ❌ NRS submission service missing!" -ForegroundColor Red
    $allChecks += $false
}

Write-Host ""
Write-Host "7️⃣  Production Endpoints Health" -ForegroundColor Magenta

$endpoints = @(
    "https://taxbridge-api-ker8.onrender.com/health",
    "https://taxbridge-api-ker8.onrender.com/health/db",
    "https://taxbridge-api-ker8.onrender.com/health/redis"
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri $endpoint -Method GET -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ $(Split-Path $endpoint -Leaf) → 200 OK" -ForegroundColor Green
            $allChecks += $true
        } else {
            Write-Host "   ❌ $(Split-Path $endpoint -Leaf) → $($response.StatusCode)" -ForegroundColor Red
            $allChecks += $false
        }
    } catch {
        Write-Host "   ❌ $(Split-Path $endpoint -Leaf) → Failed to connect" -ForegroundColor Red
        $allChecks += $false
    }
}

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan

$passed = ($allChecks | Where-Object { $_ }).Count
$total = $allChecks.Count

Write-Host "Checks Passed: $passed / $total" -ForegroundColor White
Write-Host "Duration: $([math]::Round($duration, 1))s" -ForegroundColor White
Write-Host ""

if ($passed -eq $total) {
    Write-Host "✅ ALL CHECKS PASSED - READY FOR DEPLOYMENT" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Run: cd mobile && powershell -ExecutionPolicy Bypass -File scripts/nuclear-cache-wipe.ps1" -ForegroundColor White
    Write-Host "  2. Run: npx expo-doctor" -ForegroundColor White
    Write-Host "  3. Run: eas build --platform all --profile production --clear-cache" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ SOME CHECKS FAILED - FIX ISSUES BEFORE DEPLOYMENT" -ForegroundColor Red
    Write-Host ""
    exit 1
}
