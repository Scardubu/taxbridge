# Production Deployment Verification Script
# Verifies all critical endpoints and services are operational post-deployment

param(
    [Parameter(Mandatory=$true)]
    [string]$BackendUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$AdminUrl = "",
    
    [Parameter(Mandatory=$false)]
    [string]$MobileUrl = ""
)

Write-Host "🚀 TaxBridge Production Deployment Verification" -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host ""

$ErrorCount = 0
$WarningCount = 0
$SuccessCount = 0

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Name,
        [int]$ExpectedStatus = 200
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "  ✅ $Name" -ForegroundColor Green
            $script:SuccessCount++
            return $true
        } else {
            Write-Host "  ❌ $Name - Unexpected status: $($response.StatusCode)" -ForegroundColor Red
            $script:ErrorCount++
            return $false
        }
    } catch {
        Write-Host "  ❌ $Name - Failed: $($_.Exception.Message)" -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
}

function Test-JsonEndpoint {
    param(
        [string]$Url,
        [string]$Name,
        [string[]]$RequiredFields
    )
    
    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 10
        
        $missingFields = @()
        foreach ($field in $RequiredFields) {
            if (-not $response.PSObject.Properties[$field]) {
                $missingFields += $field
            }
        }
        
        if ($missingFields.Count -eq 0) {
            Write-Host "  ✅ $Name - All fields present" -ForegroundColor Green
            $script:SuccessCount++
            return $true
        } else {
            Write-Host "  ⚠️  $Name - Missing fields: $($missingFields -join ', ')" -ForegroundColor Yellow
            $script:WarningCount++
            return $false
        }
    } catch {
        Write-Host "  ❌ $Name - Failed: $($_.Exception.Message)" -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
}

# Backend Health Checks
Write-Host "🔍 Backend Health Checks ($BackendUrl)" -ForegroundColor Cyan
Test-Endpoint -Url "$BackendUrl/health" -Name "Health Endpoint"
Test-JsonEndpoint -Url "$BackendUrl/health" -Name "Health Response" -RequiredFields @("status", "timestamp")
Test-Endpoint -Url "$BackendUrl/health/integrations" -Name "Integrations Health"
Write-Host ""

# API Endpoints
Write-Host "🔍 Critical API Endpoints" -ForegroundColor Cyan
Test-Endpoint -Url "$BackendUrl/api/v1/tax/calculate/pit" -Name "Tax Calculator (PIT)" -ExpectedStatus 405
Test-Endpoint -Url "$BackendUrl/api/v1/payments/gateways" -Name "Payment Gateways" -ExpectedStatus 401
Write-Host ""

# Admin Dashboard (if provided)
if ($AdminUrl) {
    Write-Host "🔍 Admin Dashboard ($AdminUrl)" -ForegroundColor Cyan
    Test-Endpoint -Url $AdminUrl -Name "Admin Home Page"
    Test-Endpoint -Url "$AdminUrl/dashboard" -Name "Dashboard Page"
    Write-Host ""
}

# Mobile App (if provided)
if ($MobileUrl) {
    Write-Host "🔍 Mobile App ($MobileUrl)" -ForegroundColor Cyan
    Test-Endpoint -Url $MobileUrl -Name "Mobile App"
    Write-Host ""
}

# SSL/TLS Check
Write-Host "🔒 Security Checks" -ForegroundColor Cyan
if ($BackendUrl.StartsWith("https://")) {
    Write-Host "  ✅ Backend using HTTPS" -ForegroundColor Green
    $script:SuccessCount++
} else {
    Write-Host "  ⚠️  Backend not using HTTPS" -ForegroundColor Yellow
    $script:WarningCount++
}

if ($AdminUrl -and $AdminUrl.StartsWith("https://")) {
    Write-Host "  ✅ Admin using HTTPS" -ForegroundColor Green
    $script:SuccessCount++
} elseif ($AdminUrl) {
    Write-Host "  ⚠️  Admin not using HTTPS" -ForegroundColor Yellow
    $script:WarningCount++
}
Write-Host ""

# Response Time Check
Write-Host "⚡ Performance Checks" -ForegroundColor Cyan
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
try {
    Invoke-WebRequest -Uri "$BackendUrl/health" -Method Get -UseBasicParsing | Out-Null
    $stopwatch.Stop()
    $responseTime = $stopwatch.ElapsedMilliseconds
    
    if ($responseTime -lt 500) {
        Write-Host "  ✅ Response time: ${responseTime}ms (excellent)" -ForegroundColor Green
        $script:SuccessCount++
    } elseif ($responseTime -lt 1000) {
        Write-Host "  ⚠️  Response time: ${responseTime}ms (acceptable)" -ForegroundColor Yellow
        $script:WarningCount++
    } else {
        Write-Host "  ❌ Response time: ${responseTime}ms (too slow)" -ForegroundColor Red
        $script:ErrorCount++
    }
} catch {
    Write-Host "  ❌ Could not measure response time" -ForegroundColor Red
    $script:ErrorCount++
}
Write-Host ""

# Final Report
Write-Host "=" * 60
Write-Host "📊 Verification Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Passed: $SuccessCount" -ForegroundColor Green
Write-Host "  ⚠️  Warnings: $WarningCount" -ForegroundColor Yellow
Write-Host "  ❌ Errors: $ErrorCount" -ForegroundColor Red
Write-Host ""

if ($ErrorCount -gt 0) {
    Write-Host "❌ DEPLOYMENT VERIFICATION FAILED" -ForegroundColor Red
    Write-Host "Fix critical errors before proceeding to production" -ForegroundColor Red
    exit 1
} elseif ($WarningCount -gt 0) {
    Write-Host "⚠️  DEPLOYMENT VERIFICATION PASSED WITH WARNINGS" -ForegroundColor Yellow
    Write-Host "Review warnings before full production rollout" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "✅ DEPLOYMENT VERIFICATION PASSED" -ForegroundColor Green
    Write-Host "All systems operational - ready for production traffic" -ForegroundColor Green
    exit 0
}
