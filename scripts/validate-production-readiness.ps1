#!/usr/bin/env pwsh
# TaxBridge Production Readiness Validation Script
# Validates all critical environment variables, configurations, and system health

param(
    [switch]$Strict,
    [switch]$SkipTests,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$script:FailureCount = 0
$script:WarningCount = 0
$script:CheckCount = 0

function Write-Check {
    param([string]$Message, [string]$Status = "INFO")
    $script:CheckCount++
    $color = switch ($Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "WARN" { "Yellow" }
        default { "White" }
    }
    $icon = switch ($Status) {
        "PASS" { "✓" }
        "FAIL" { "✗" }
        "WARN" { "⚠" }
        default { "ℹ" }
    }
    Write-Host "$icon $Message" -ForegroundColor $color
    
    if ($Status -eq "FAIL") { $script:FailureCount++ }
    if ($Status -eq "WARN") { $script:WarningCount++ }
}

function Test-EnvVar {
    param(
        [string]$Name,
        [string]$Description,
        [bool]$Required = $true,
        [string]$Pattern = $null,
        [string]$Example = $null
    )
    
    $value = [Environment]::GetEnvironmentVariable($Name)
    
    if ([string]::IsNullOrWhiteSpace($value)) {
        if ($Required) {
            Write-Check "$Name - $Description" "FAIL"
            if ($Example) {
                Write-Host "  Example: $Example" -ForegroundColor Gray
            }
            return $false
        } else {
            Write-Check "$Name - $Description (optional)" "WARN"
            return $true
        }
    }
    
    if ($Pattern -and $value -notmatch $Pattern) {
        Write-Check "$Name - Invalid format" "FAIL"
        Write-Host "  Expected pattern: $Pattern" -ForegroundColor Gray
        return $false
    }
    
    $maskedValue = if ($Name -match "SECRET|KEY|PASSWORD|TOKEN") {
        $value.Substring(0, [Math]::Min(8, $value.Length)) + "***"
    } else {
        $value
    }
    
    Write-Check "$Name - $Description ($maskedValue)" "PASS"
    return $true
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TaxBridge Production Readiness Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Core Infrastructure
Write-Host "`n[1/10] Core Infrastructure" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray

Test-EnvVar "NODE_ENV" "Environment (should be 'production')" -Required $true
Test-EnvVar "PORT" "Server port" -Required $false -Example "3000"
Test-EnvVar "DATABASE_URL" "PostgreSQL connection string" -Required $true -Example "postgresql://user:pass@host:5432/db"
Test-EnvVar "DIRECT_URL" "Direct PostgreSQL URL (for migrations)" -Required $true
Test-EnvVar "REDIS_URL" "Redis connection string" -Required $true -Example "redis://localhost:6379"

# 2. Security & Encryption
Write-Host "`n[2/10] Security & Encryption" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray

Test-EnvVar "JWT_SECRET" "JWT signing secret (64+ chars)" -Required $true -Pattern ".{64,}"
Test-EnvVar "ENCRYPTION_KEY" "AES-256 encryption key (64 hex chars)" -Required $true -Pattern "^[0-9a-fA-F]{64}$"
Test-EnvVar "TAX_ID_ENCRYPTION_KEY" "Tax ID encryption key (64 hex chars)" -Required $true -Pattern "^[0-9a-fA-F]{64}$"
Test-EnvVar "SESSION_SECRET" "Session secret" -Required $true
Test-EnvVar "WEBHOOK_SECRET" "Webhook signature secret" -Required $true

# 3. CORS & Security Headers
Write-Host "`n[3/10] CORS & Security Headers" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray

$allowedOrigins = [Environment]::GetEnvironmentVariable("ALLOWED_ORIGINS")
if ([string]::IsNullOrWhiteSpace($allowedOrigins) -or $allowedOrigins -eq "*") {
    Write-Check "ALLOWED_ORIGINS - CRITICAL: Wildcard CORS in production!" "FAIL"
    Write-Host "  Set to: https://yourdomain.com,https://app.yourdomain.com" -ForegroundColor Gray
} else {
    Write-Check "ALLOWED_ORIGINS - Configured ($allowedOrigins)" "PASS"
}

# 4. Payment Gateways
Write-Host "`n[4/10] Payment Gateways" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray

Test-EnvVar "PAYSTACK_SECRET_KEY" "Paystack secret key (live)" -Required $true -Pattern "^sk_live_"
Test-EnvVar "PAYSTACK_PUBLIC_KEY" "Paystack public key (live)" -Required $true -Pattern "^pk_live_"
Test-EnvVar "PAYSTACK_WEBHOOK_SECRET" "Paystack webhook secret" -Required $true
Test-EnvVar "FLW_SECRET_KEY" "Flutterwave secret key (live)" -Required $true -Pattern "^FLWSECK-"
Test-EnvVar "FLW_PUBLIC_KEY" "Flutterwave public key (live)" -Required $true -Pattern "^FLWPUBK-"
Test-EnvVar "FLW_SECRET_HASH" "Flutterwave webhook hash" -Required $true
Test-EnvVar "FLW_ENCRYPTION_KEY" "Flutterwave encryption key" -Required $true
Test-EnvVar "REMITA_MERCHANT_ID" "Remita merchant ID" -Required $true
Test-EnvVar "REMITA_API_KEY" "Remita API key" -Required $true
Test-EnvVar "REMITA_SERVICE_TYPE_ID" "Remita service type ID" -Required $true

# 5. Business Verification (Youverify)
Write-Host "`n[5/10] Business Verification" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray

Test-EnvVar "YOUVERIFY_API_KEY" "Youverify API key" -Required $true
Test-EnvVar "YOUVERIFY_BASE_URL" "Youverify base URL" -Required $false -Example "https://api.youverify.co"
$youverifySandbox = [Environment]::GetEnvironmentVariable("YOUVERIFY_SANDBOX")
if ($youverifySandbox -eq "true") {
    Write-Check "YOUVERIFY_SANDBOX - WARNING: Sandbox mode in production!" "WARN"
} else {
    Write-Check "YOUVERIFY_SANDBOX - Production mode" "PASS"
}

# 6. FIRS/DigiTax (NRS E-Invoicing)
Write-Host "`n[6/10] FIRS/DigiTax (NRS)" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray

Test-EnvVar "DIGITAX_API_KEY" "DigiTax API key" -Required $true
Test-EnvVar "DIGITAX_BASE_URL" "DigiTax base URL" -Required $true -Example "https://api.digitax.ng"
Test-EnvVar "DIGITAX_HMAC_SECRET" "DigiTax HMAC secret" -Required $true
$digitaxMock = [Environment]::GetEnvironmentVariable("DIGITAX_MOCK_MODE")
if ($digitaxMock -eq "true") {
    Write-Check "DIGITAX_MOCK_MODE - WARNING: Mock mode in production!" "WARN"
} else {
    Write-Check "DIGITAX_MOCK_MODE - Production mode" "PASS"
}

# 7. SMS/USSD Communications
Write-Host "`n[7/10] SMS/USSD Communications" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray

Test-EnvVar "COMMS_PROVIDER" "Primary SMS provider" -Required $false -Example "africastalking"
Test-EnvVar "AT_API_KEY" "Africa's Talking API key" -Required $false
Test-EnvVar "AT_USERNAME" "Africa's Talking username" -Required $false
Test-EnvVar "AT_SHORTCODE" "Africa's Talking shortcode" -Required $false
Test-EnvVar "INFOBIP_API_KEY" "Infobip API key" -Required $false
Test-EnvVar "TERMII_API_KEY" "Termii API key" -Required $false

# 8. Monitoring & Observability
Write-Host "`n[8/10] Monitoring & Observability" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray

Test-EnvVar "SENTRY_DSN" "Sentry DSN for error tracking" -Required $false
Test-EnvVar "ENABLE_METRICS" "Prometheus metrics enabled" -Required $false -Example "true"
Test-EnvVar "LOG_LEVEL" "Logging level" -Required $false -Example "info"

# 9. Feature Flags
Write-Host "`n[9/10] Feature Flags" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray

Test-EnvVar "FEATURE_DEVICE_SYNC" "Device sync feature" -Required $false -Example "true"
Test-EnvVar "ENABLE_DEADLINE_REMINDERS" "Tax deadline reminders" -Required $false -Example "true"
Test-EnvVar "ENABLE_OCR" "OCR receipt scanning" -Required $false -Example "true"

# 10. Backend Tests (if not skipped)
if (-not $SkipTests) {
    Write-Host "`n[10/10] Backend Test Suite" -ForegroundColor Cyan
    Write-Host "─────────────────────────────────────────`n" -ForegroundColor Gray
    
    Push-Location "$PSScriptRoot\..\backend"
    try {
        Write-Host "Running backend tests..." -ForegroundColor Gray
        $testOutput = npm test 2>&1
        $testExitCode = $LASTEXITCODE
        
        if ($testExitCode -eq 0) {
            Write-Check "Backend tests - All tests passing" "PASS"
            if ($Verbose) {
                Write-Host $testOutput -ForegroundColor Gray
            }
        } else {
            Write-Check "Backend tests - FAILED" "FAIL"
            Write-Host $testOutput -ForegroundColor Red
        }
    } catch {
        Write-Check "Backend tests - Error running tests: $_" "FAIL"
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[10/10] Backend Test Suite - SKIPPED" -ForegroundColor Yellow
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Validation Summary" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Total Checks: $script:CheckCount" -ForegroundColor White
Write-Host "Failures: $script:FailureCount" -ForegroundColor $(if ($script:FailureCount -gt 0) { "Red" } else { "Green" })
Write-Host "Warnings: $script:WarningCount" -ForegroundColor $(if ($script:WarningCount -gt 0) { "Yellow" } else { "Green" })

if ($script:FailureCount -gt 0) {
    Write-Host "`n❌ PRODUCTION READINESS: NOT READY" -ForegroundColor Red
    Write-Host "Fix all failures before deploying to production." -ForegroundColor Red
    exit 1
} elseif ($script:WarningCount -gt 0 -and $Strict) {
    Write-Host "`n⚠️  PRODUCTION READINESS: WARNINGS PRESENT" -ForegroundColor Yellow
    Write-Host "Address warnings before deploying (strict mode)." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "`n✅ PRODUCTION READINESS: READY" -ForegroundColor Green
    Write-Host "All critical checks passed. Ready for deployment." -ForegroundColor Green
    exit 0
}
