#!/usr/bin/env pwsh
# Production Environment Validation Script
# Validates all required environment variables and configurations before deployment

param(
    [string]$EnvFile = ".env.production",
    [switch]$Strict = $false
)

$ErrorActionPreference = "Continue"
$script:errors = @()
$script:warnings = @()
$script:passed = 0
$script:failed = 0

function Write-ValidationHeader {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "   TaxBridge Production Validation" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Test-EnvVar {
    param(
        [string]$Name,
        [string]$Description,
        [switch]$Required,
        [string]$Pattern,
        [int]$MinLength
    )
    
    $value = [System.Environment]::GetEnvironmentVariable($Name)
    
    if (-not $value) {
        if ($Required) {
            $script:errors += "❌ $Name - MISSING (Required: $Description)"
            $script:failed++
            return $false
        } else {
            $script:warnings += "⚠️  $Name - Not set ($Description)"
            return $true
        }
    }
    
    if ($MinLength -and $value.Length -lt $MinLength) {
        $script:errors += "❌ $Name - Too short (min: $MinLength chars)"
        $script:failed++
        return $false
    }
    
    if ($Pattern -and $value -notmatch $Pattern) {
        $script:errors += "❌ $Name - Invalid format (expected: $Pattern)"
        $script:failed++
        return $false
    }
    
    $maskedValue = if ($value.Length -gt 8) { 
        $value.Substring(0, 4) + "..." + $value.Substring($value.Length - 4) 
    } else { 
        "***" 
    }
    
    Write-Host "✅ $Name = $maskedValue" -ForegroundColor Green
    $script:passed++
    return $true
}

function Test-DatabaseConnection {
    Write-Host "`n--- Database Connectivity ---" -ForegroundColor Yellow
    
    $dbUrl = [System.Environment]::GetEnvironmentVariable("DATABASE_URL")
    if (-not $dbUrl) {
        $script:errors += "❌ DATABASE_URL not set"
        $script:failed++
        return
    }
    
    Write-Host "✅ DATABASE_URL configured" -ForegroundColor Green
    $script:passed++
}

function Test-RedisConnection {
    Write-Host "`n--- Redis Connectivity ---" -ForegroundColor Yellow
    
    $redisUrl = [System.Environment]::GetEnvironmentVariable("REDIS_URL")
    if (-not $redisUrl) {
        $script:warnings += "⚠️  REDIS_URL not set (rate limiting will be disabled)"
        return
    }
    
    Write-Host "✅ REDIS_URL configured" -ForegroundColor Green
    $script:passed++
}

function Test-SecurityConfig {
    Write-Host "`n--- Security Configuration ---" -ForegroundColor Yellow
    
    Test-EnvVar -Name "JWT_SECRET" -Description "JWT signing secret" -Required -MinLength 32
    Test-EnvVar -Name "ENCRYPTION_KEY" -Description "Application encryption key" -Required -MinLength 64 -Pattern "^[0-9a-fA-F]{64}$"
    Test-EnvVar -Name "TAX_ID_ENCRYPTION_KEY" -Description "Tax ID encryption key" -Required -MinLength 64 -Pattern "^[0-9a-fA-F]{64}$"
    
    $allowedOrigins = [System.Environment]::GetEnvironmentVariable("ALLOWED_ORIGINS")
    if ($allowedOrigins -eq "*") {
        $script:warnings += "⚠️  ALLOWED_ORIGINS set to wildcard (*) - SECURITY RISK in production"
    } elseif ($allowedOrigins) {
        Write-Host "✅ ALLOWED_ORIGINS = $allowedOrigins" -ForegroundColor Green
        $script:passed++
    } else {
        $script:warnings += "⚠️  ALLOWED_ORIGINS not set (defaulting to wildcard)"
    }
}

function Test-PaymentGateways {
    Write-Host "`n--- Payment Gateway Configuration ---" -ForegroundColor Yellow
    
    # Paystack
    Test-EnvVar -Name "PAYSTACK_SECRET_KEY" -Description "Paystack secret key" -Required -Pattern "^sk_(live|test)_"
    Test-EnvVar -Name "PAYSTACK_PUBLIC_KEY" -Description "Paystack public key" -Required -Pattern "^pk_(live|test)_"
    Test-EnvVar -Name "PAYSTACK_WEBHOOK_SECRET" -Description "Paystack webhook secret" -Required
    
    # Flutterwave
    Test-EnvVar -Name "FLW_SECRET_KEY" -Description "Flutterwave secret key" -Required -Pattern "^FLWSECK-"
    Test-EnvVar -Name "FLW_PUBLIC_KEY" -Description "Flutterwave public key" -Required -Pattern "^FLWPUBK-"
    Test-EnvVar -Name "FLW_SECRET_HASH" -Description "Flutterwave secret hash" -Required
    
    # Remita
    Test-EnvVar -Name "REMITA_MERCHANT_ID" -Description "Remita merchant ID" -Required
    Test-EnvVar -Name "REMITA_API_KEY" -Description "Remita API key" -Required
}

function Test-BusinessVerification {
    Write-Host "`n--- Business Verification (Youverify) ---" -ForegroundColor Yellow
    
    Test-EnvVar -Name "YOUVERIFY_API_KEY" -Description "Youverify API key" -Required
    
    $sandbox = [System.Environment]::GetEnvironmentVariable("YOUVERIFY_SANDBOX")
    if ($sandbox -eq "true") {
        $script:warnings += "⚠️  YOUVERIFY_SANDBOX enabled (use false in production)"
    }
}

function Test-NRSConfiguration {
    Write-Host "`n--- NRS E-Invoicing (DigiTax/FIRS) ---" -ForegroundColor Yellow
    
    Test-EnvVar -Name "DIGITAX_API_KEY" -Description "DigiTax API key" -Required
    Test-EnvVar -Name "DIGITAX_API_URL" -Description "DigiTax API URL" -Required -Pattern "^https://"
    Test-EnvVar -Name "DIGITAX_HMAC_SECRET" -Description "DigiTax HMAC secret"
    
    $mockMode = [System.Environment]::GetEnvironmentVariable("DIGITAX_MOCK_MODE")
    if ($mockMode -eq "true") {
        $script:warnings += "⚠️  DIGITAX_MOCK_MODE enabled (disable in production)"
    }
}

function Test-MonitoringConfig {
    Write-Host "`n--- Monitoring & Observability ---" -ForegroundColor Yellow
    
    $sentryDsn = [System.Environment]::GetEnvironmentVariable("SENTRY_DSN")
    if ($sentryDsn) {
        Write-Host "✅ SENTRY_DSN configured" -ForegroundColor Green
        $script:passed++
    } else {
        $script:warnings += "⚠️  SENTRY_DSN not set (error tracking disabled)"
    }
    
    $enableMetrics = [System.Environment]::GetEnvironmentVariable("ENABLE_METRICS")
    if ($enableMetrics -eq "true") {
        Write-Host "✅ ENABLE_METRICS = true" -ForegroundColor Green
        $script:passed++
    } else {
        $script:warnings += "⚠️  ENABLE_METRICS not enabled"
    }
}

function Test-OCRConfiguration {
    Write-Host "`n--- OCR Configuration ---" -ForegroundColor Yellow
    
    $enableOcr = [System.Environment]::GetEnvironmentVariable("ENABLE_OCR")
    if ($enableOcr -eq "true") {
        Write-Host "✅ ENABLE_OCR = true" -ForegroundColor Green
        $script:passed++
    } else {
        $script:warnings += "⚠️  ENABLE_OCR not enabled (OCR feature disabled)"
    }
}

function Test-NodeEnvironment {
    Write-Host "`n--- Node.js Environment ---" -ForegroundColor Yellow
    
    $nodeEnv = [System.Environment]::GetEnvironmentVariable("NODE_ENV")
    if ($nodeEnv -eq "production") {
        Write-Host "✅ NODE_ENV = production" -ForegroundColor Green
        $script:passed++
    } else {
        $script:errors += "❌ NODE_ENV must be 'production' (currently: $nodeEnv)"
        $script:failed++
    }
    
    $port = [System.Environment]::GetEnvironmentVariable("PORT")
    if ($port) {
        Write-Host "✅ PORT = $port" -ForegroundColor Green
        $script:passed++
    } else {
        $script:warnings += "⚠️  PORT not set (defaulting to 3000)"
    }
}

function Show-Summary {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "   Validation Summary" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "Passed:   $script:passed" -ForegroundColor Green
    Write-Host "Failed:   $script:failed" -ForegroundColor Red
    Write-Host "Warnings: $($script:warnings.Count)" -ForegroundColor Yellow
    
    if ($script:errors.Count -gt 0) {
        Write-Host "`n--- Errors ---" -ForegroundColor Red
        foreach ($error in $script:errors) {
            Write-Host $error -ForegroundColor Red
        }
    }
    
    if ($script:warnings.Count -gt 0) {
        Write-Host "`n--- Warnings ---" -ForegroundColor Yellow
        foreach ($warning in $script:warnings) {
            Write-Host $warning -ForegroundColor Yellow
        }
    }
    
    Write-Host "`n========================================`n" -ForegroundColor Cyan
    
    if ($script:failed -gt 0) {
        Write-Host "❌ VALIDATION FAILED - Fix errors before deploying" -ForegroundColor Red
        exit 1
    } elseif ($script:warnings.Count -gt 0 -and $Strict) {
        Write-Host "⚠️  VALIDATION PASSED WITH WARNINGS - Review warnings in strict mode" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "✅ VALIDATION PASSED - Ready for deployment" -ForegroundColor Green
        exit 0
    }
}

# Main execution
Write-ValidationHeader

# Load environment file if specified
if (Test-Path $EnvFile) {
    Write-Host "Loading environment from: $EnvFile`n" -ForegroundColor Cyan
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}

# Run validation tests
Test-NodeEnvironment
Test-DatabaseConnection
Test-RedisConnection
Test-SecurityConfig
Test-PaymentGateways
Test-BusinessVerification
Test-NRSConfiguration
Test-MonitoringConfig
Test-OCRConfiguration

# Show summary
Show-Summary
