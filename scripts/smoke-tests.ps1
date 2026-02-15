#!/usr/bin/env pwsh
# Production Smoke Tests for TaxBridge
# Validates critical functionality after deployment

param(
    [string]$ApiUrl = "http://localhost:3000",
    [string]$AdminApiKey = "",
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"
$script:passed = 0
$script:failed = 0
$script:warnings = 0

function Write-TestHeader {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "   TaxBridge Production Smoke Tests" -ForegroundColor Cyan
    Write-Host "   API: $ApiUrl" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$Headers = @{},
        [int]$ExpectedStatus = 200
    )
    
    try {
        $requestParams = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            TimeoutSec = 10
        }
        
        if ($Body) {
            $requestParams.Body = ($Body | ConvertTo-Json -Depth 10)
            $requestParams.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @requestParams -UseBasicParsing
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "✅ $Name" -ForegroundColor Green
            if ($Verbose) {
                Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
                Write-Host "   Response: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
            }
            $script:passed++
            return $true
        } else {
            Write-Host "❌ $Name - Unexpected status: $($response.StatusCode)" -ForegroundColor Red
            $script:failed++
            return $false
        }
    } catch {
        Write-Host "❌ $Name - Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($Verbose) {
            Write-Host "   Details: $($_.Exception)" -ForegroundColor Gray
        }
        $script:failed++
        return $false
    }
}

function Test-HealthEndpoints {
    Write-Host "`n--- Health Check Endpoints ---" -ForegroundColor Yellow
    
    Test-Endpoint -Name "Overall Health" -Url "$ApiUrl/health"
    Test-Endpoint -Name "Database Health" -Url "$ApiUrl/health/db"
    Test-Endpoint -Name "Queue Health" -Url "$ApiUrl/health/queues"
    Test-Endpoint -Name "Integration Health" -Url "$ApiUrl/health/integrations"
}

function Test-TaxCalculations {
    Write-Host "`n--- Tax Calculation Endpoints ---" -ForegroundColor Yellow
    
    # PIT Calculation
    $pitBody = @{
        grossIncome = 5000000
        reliefs = @{
            cra = $true
            pension = 400000
            nhf = 125000
            lifeInsurance = 100000
        }
    }
    Test-Endpoint -Name "PIT Calculation" `
        -Url "$ApiUrl/api/v1/tax/calculate/pit" `
        -Method "POST" `
        -Body $pitBody
    
    # CIT Calculation (Extended with Development Levy)
    $citBody = @{
        revenue = 200000000
        expenses = 100000000
        employeeCount = 15
        digitalIncome = 0
    }
    Test-Endpoint -Name "CIT Calculation (Extended)" `
        -Url "$ApiUrl/api/v1/tax/calculate/cit" `
        -Method "POST" `
        -Body $citBody
    
    # VAT Calculation
    $vatBody = @{
        amount = 1000000
        category = "standard"
    }
    Test-Endpoint -Name "VAT Calculation" `
        -Url "$ApiUrl/api/v1/tax/calculate/vat" `
        -Method "POST" `
        -Body $vatBody
}

function Test-TaxRulesAPI {
    Write-Host "`n--- Tax Rules API ---" -ForegroundColor Yellow
    
    Test-Endpoint -Name "Get All Tax Rules" -Url "$ApiUrl/api/v1/tax/rules"
    Test-Endpoint -Name "Get CIT Rules" -Url "$ApiUrl/api/v1/tax/rules/cit"
    Test-Endpoint -Name "Get PIT Rules" -Url "$ApiUrl/api/v1/tax/rules/pit"
    Test-Endpoint -Name "Get VAT Rules" -Url "$ApiUrl/api/v1/tax/rules/vat"
}

function Test-NRSStatus {
    Write-Host "`n--- NRS E-Invoicing Status ---" -ForegroundColor Yellow
    
    Test-Endpoint -Name "NRS Health" -Url "$ApiUrl/api/v1/nrs/health"
    Test-Endpoint -Name "NRS Status Summary" -Url "$ApiUrl/api/v1/nrs/status"
}

function Test-RateLimiting {
    Write-Host "`n--- Rate Limiting (Production Only) ---" -ForegroundColor Yellow
    
    $nodeEnv = [System.Environment]::GetEnvironmentVariable("NODE_ENV")
    if ($nodeEnv -ne "production") {
        Write-Host "⚠️  Skipping rate limit test (NODE_ENV=$nodeEnv)" -ForegroundColor Yellow
        $script:warnings++
        return
    }
    
    # Make rapid requests to test rate limiting
    $rateLimitHit = $false
    for ($i = 1; $i -le 110; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "$ApiUrl/api/v1/tax/rules" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 429) {
                $rateLimitHit = $true
                break
            }
        } catch {
            if ($_.Exception.Response.StatusCode.Value__ -eq 429) {
                $rateLimitHit = $true
                break
            }
        }
    }
    
    if ($rateLimitHit) {
        Write-Host "✅ Rate Limiting Active" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "⚠️  Rate Limiting Not Triggered (may not be configured)" -ForegroundColor Yellow
        $script:warnings++
    }
}

function Test-CORS {
    Write-Host "`n--- CORS Configuration ---" -ForegroundColor Yellow
    
    try {
        $headers = @{
            "Origin" = "https://example.com"
            "Access-Control-Request-Method" = "POST"
        }
        
        $response = Invoke-WebRequest -Uri "$ApiUrl/api/v1/tax/rules" `
            -Method OPTIONS `
            -Headers $headers `
            -UseBasicParsing
        
        if ($response.Headers["Access-Control-Allow-Origin"]) {
            Write-Host "✅ CORS Headers Present" -ForegroundColor Green
            $script:passed++
        } else {
            Write-Host "⚠️  CORS Headers Not Found" -ForegroundColor Yellow
            $script:warnings++
        }
    } catch {
        Write-Host "⚠️  CORS Test Failed: $($_.Exception.Message)" -ForegroundColor Yellow
        $script:warnings++
    }
}

function Test-SecurityHeaders {
    Write-Host "`n--- Security Headers ---" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/health" -UseBasicParsing
        
        $securityHeaders = @(
            "X-Request-ID",
            "X-Content-Type-Options",
            "X-Frame-Options"
        )
        
        foreach ($header in $securityHeaders) {
            if ($response.Headers[$header]) {
                Write-Host "✅ $header Present" -ForegroundColor Green
                $script:passed++
            } else {
                Write-Host "⚠️  $header Missing" -ForegroundColor Yellow
                $script:warnings++
            }
        }
    } catch {
        Write-Host "❌ Security Header Check Failed: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

function Test-APIDocumentation {
    Write-Host "`n--- API Documentation ---" -ForegroundColor Yellow
    
    # Test if OpenAPI/Swagger documentation is available
    Test-Endpoint -Name "API Documentation" -Url "$ApiUrl/documentation" -ExpectedStatus 200
}

function Measure-PerformanceMetrics {
    Write-Host "`n--- Performance Metrics ---" -ForegroundColor Yellow
    
    $testEndpoints = @(
        @{ Name = "Health Check"; Url = "$ApiUrl/health" },
        @{ Name = "Tax Rules"; Url = "$ApiUrl/api/v1/tax/rules" }
    )
    
    foreach ($endpoint in $testEndpoints) {
        try {
            $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            $response = Invoke-WebRequest -Uri $endpoint.Url -UseBasicParsing -TimeoutSec 10
            $stopwatch.Stop()
            
            $responseTime = $stopwatch.ElapsedMilliseconds
            
            if ($responseTime -lt 500) {
                Write-Host "✅ $($endpoint.Name): ${responseTime}ms (P95 < 500ms)" -ForegroundColor Green
                $script:passed++
            } elseif ($responseTime -lt 1000) {
                Write-Host "⚠️  $($endpoint.Name): ${responseTime}ms (slightly slow)" -ForegroundColor Yellow
                $script:warnings++
            } else {
                Write-Host "❌ $($endpoint.Name): ${responseTime}ms (too slow)" -ForegroundColor Red
                $script:failed++
            }
        } catch {
            Write-Host "❌ $($endpoint.Name): Error - $($_.Exception.Message)" -ForegroundColor Red
            $script:failed++
        }
    }
}

function Show-Summary {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "   Test Summary" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "Passed:   $script:passed" -ForegroundColor Green
    Write-Host "Failed:   $script:failed" -ForegroundColor Red
    Write-Host "Warnings: $script:warnings" -ForegroundColor Yellow
    
    $total = $script:passed + $script:failed
    if ($total -gt 0) {
        $passRate = [math]::Round(($script:passed / $total) * 100, 2)
        Write-Host "`nPass Rate: $passRate%" -ForegroundColor Cyan
    }
    
    Write-Host "`n========================================`n" -ForegroundColor Cyan
    
    if ($script:failed -gt 0) {
        Write-Host "❌ SMOKE TESTS FAILED - Critical issues detected" -ForegroundColor Red
        exit 1
    } elseif ($script:warnings -gt 5) {
        Write-Host "⚠️  SMOKE TESTS PASSED WITH WARNINGS - Review warnings" -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "✅ SMOKE TESTS PASSED - System operational" -ForegroundColor Green
        exit 0
    }
}

# Main execution
Write-TestHeader

# Run all test suites
Test-HealthEndpoints
Test-TaxCalculations
Test-TaxRulesAPI
Test-NRSStatus
Test-RateLimiting
Test-CORS
Test-SecurityHeaders
Test-APIDocumentation
Measure-PerformanceMetrics

# Show summary
Show-Summary
