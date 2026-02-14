# FILE: scripts/7-Post-Deployment-Smoke-Tests.ps1
# PURPOSE: Comprehensive verification after production deployment

param(
    [string]$ApiUrl = "https://taxbridge-api-ker8.onrender.com",
    [string]$AdminUrl = "https://taxbridge.vercel.app",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$global:testsPassed = 0
$global:testsFailed = 0

function Write-TestHeader {
    param([string]$Title)
    Write-Host "`n=======================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [string]$Method = "GET",
        [hashtable]$Headers = @{}
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            TimeoutSec = 15
            UseBasicParsing = $true
        }
        
        $response = Invoke-WebRequest @params -ErrorAction Stop
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "  [PASS] $Name" -ForegroundColor Green -NoNewline
            Write-Host " ($($response.StatusCode))" -ForegroundColor Gray
            $global:testsPassed++
            
            if ($Verbose -and $response.Content -and $response.Content -is [string]) {
                $preview = $response.Content.Substring(0, [Math]::Min(100, $response.Content.Length))
                Write-Host "    Response: $preview..." -ForegroundColor Gray
            }
            
            return @{ Success = $true; Response = $response }
        } else {
            Write-Host "  [FAIL] $Name" -ForegroundColor Red -NoNewline
            Write-Host " (Expected: $ExpectedStatus, Got: $($response.StatusCode))" -ForegroundColor Yellow
            $global:testsFailed++
            return @{ Success = $false; Response = $response }
        }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  [PASS] $Name" -ForegroundColor Green -NoNewline
            Write-Host " ($statusCode)" -ForegroundColor Gray
            $global:testsPassed++
            return @{ Success = $true }
        }
        
        Write-Host "  [FAIL] $Name" -ForegroundColor Red -NoNewline
        Write-Host " (Error: $($_.Exception.Message))" -ForegroundColor Yellow
        $global:testsFailed++
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# ===========================================================
# START SMOKE TESTS
# ===========================================================

Write-Host ">>> TaxBridge Post-Deployment Smoke Tests <<<" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "API: $ApiUrl" -ForegroundColor Gray
Write-Host "Admin: $AdminUrl" -ForegroundColor Gray

# 1. BACKEND API HEALTH
Write-TestHeader "Backend API Health Checks"

Test-Endpoint -Name "Liveness Check" -Url "$ApiUrl/health/live"
Test-Endpoint -Name "Readiness Check" -Url "$ApiUrl/health/ready"
Test-Endpoint -Name "Full Health Check" -Url "$ApiUrl/health"
Test-Endpoint -Name "Detailed Health" -Url "$ApiUrl/health/detailed"
Test-Endpoint -Name "Metrics Endpoint" -Url "$ApiUrl/metrics"

# 2. API ROUTES
Write-TestHeader "Backend API Routes"

Test-Endpoint -Name "404 Not Found Handler" -Url "$ApiUrl/nonexistent-route" -ExpectedStatus 404
Test-Endpoint -Name "Swagger Docs" -Url "$ApiUrl/docs"

# CORS Preflight Test
Write-Host "  Testing CORS Preflight..." -NoNewline
try {
    $corsResponse = Invoke-WebRequest -Uri "$ApiUrl/health" -Method OPTIONS -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    $hasAccessControl = $corsResponse.Headers.ContainsKey("Access-Control-Allow-Origin") -or $corsResponse.Headers.ContainsKey("access-control-allow-origin")
    
    if ($hasAccessControl) {
        Write-Host " [PASS]" -ForegroundColor Green
        $global:testsPassed++
    } else {
        Write-Host " [WARN] (No CORS headers)" -ForegroundColor Yellow
    }
} catch {
    Write-Host " [FAIL] ($($_.Exception.Message))" -ForegroundColor Red
    $global:testsFailed++
}

# POST Body Test (Tax Calculation)
Write-Host "  Testing POST with Body..." -NoNewline
try {
    $body = @{
        grossIncome = 5000000
        reliefs = @{
            cra = $true
            pension = 400000
            nhf = 125000
        }
    } | ConvertTo-Json
    
    $postResponse = Invoke-RestMethod -Uri "$ApiUrl/api/v1/tax/calculate/pit" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10 -ErrorAction Stop
    
    if ($postResponse.success -and $postResponse.data) {
        Write-Host " [PASS]" -ForegroundColor Green
        $global:testsPassed++
    } else {
        Write-Host " [WARN] (Unexpected response)" -ForegroundColor Yellow
    }
} catch {
    # Expected to fail without auth, but should return proper error
    $statusCode = $null
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    
    if ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host " [PASS] (Auth required)" -ForegroundColor Green
        $global:testsPassed++
    } else {
        Write-Host " [FAIL] ($($_.Exception.Message))" -ForegroundColor Red
        $global:testsFailed++
    }
}

# 3. DATABASE & REDIS CONNECTIVITY
Write-TestHeader "Database & Redis Connectivity"

try {
    $detailedHealth = Invoke-RestMethod -Uri "$ApiUrl/health/detailed" -TimeoutSec 10 -ErrorAction Stop
    
    # Database connectivity
    if ($detailedHealth.checks.database) {
        $dbStatus = $detailedHealth.checks.database.status
        if ($dbStatus -eq "healthy") {
            Write-Host "  [PASS] Database Connection" -ForegroundColor Green -NoNewline
            Write-Host " ($($detailedHealth.checks.database.responseTime)ms)" -ForegroundColor Gray
            $global:testsPassed++
        } else {
            Write-Host "  [FAIL] Database Connection" -ForegroundColor Red -NoNewline
            Write-Host " (Status: $dbStatus)" -ForegroundColor Yellow
            $global:testsFailed++
        }
    } else {
        Write-Host "  [WARN] Database Connection" -ForegroundColor Yellow -NoNewline
        Write-Host " (Unable to verify)" -ForegroundColor Gray
    }
    
    # Redis connectivity
    if ($detailedHealth.checks.redis) {
        $redisStatus = $detailedHealth.checks.redis.status
        if ($redisStatus -eq "healthy") {
            Write-Host "  [PASS] Redis Connection" -ForegroundColor Green -NoNewline
            Write-Host " ($($detailedHealth.checks.redis.responseTime)ms)" -ForegroundColor Gray
            $global:testsPassed++
        } else {
            Write-Host "  [FAIL] Redis Connection" -ForegroundColor Red -NoNewline
            Write-Host " (Status: $redisStatus)" -ForegroundColor Yellow
            $global:testsFailed++
        }
    } else {
        Write-Host "  [WARN] Redis Connection" -ForegroundColor Yellow -NoNewline
        Write-Host " (Unable to verify)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [FAIL] Unable to check connectivity" -ForegroundColor Red
    $global:testsFailed++
}

# 4. INTEGRATION HEALTH
Write-TestHeader "Integration Health Checks"

Test-Endpoint -Name "DigiTax Health" -Url "$ApiUrl/health/digitax"
Test-Endpoint -Name "Remita Health" -Url "$ApiUrl/health/remita"

# 4. ADMIN CONSOLE
Write-TestHeader "Admin Console Availability"

Test-Endpoint -Name "Admin Homepage" -Url $AdminUrl
Test-Endpoint -Name "Admin Favicon" -Url "$AdminUrl/favicon.ico"

# 5. PERFORMANCE BENCHMARKS
Write-TestHeader "Performance Benchmarks"

$endpoints = @(
    @{ Name = "Health Endpoint"; Url = "$ApiUrl/health"; Target = 500 },
    @{ Name = "Liveness Check"; Url = "$ApiUrl/health/live"; Target = 200 },
    @{ Name = "Metrics Endpoint"; Url = "$ApiUrl/metrics"; Target = 1000 }
)

foreach ($endpoint in $endpoints) {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        $null = Invoke-WebRequest -Uri $endpoint.Url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        $stopwatch.Stop()
        $responseTime = $stopwatch.ElapsedMilliseconds
        
        if ($responseTime -le $endpoint.Target) {
            Write-Host "  [PASS] $($endpoint.Name)" -ForegroundColor Green -NoNewline
            Write-Host " (${responseTime}ms, target: $($endpoint.Target)ms)" -ForegroundColor Gray
            $global:testsPassed++
        } else {
            Write-Host "  [WARN] $($endpoint.Name)" -ForegroundColor Yellow -NoNewline
            Write-Host " (${responseTime}ms, target: $($endpoint.Target)ms)" -ForegroundColor Yellow
        }
    } catch {
        $stopwatch.Stop()
        Write-Host "  [FAIL] $($endpoint.Name)" -ForegroundColor Red -NoNewline
        Write-Host " (Failed to measure)" -ForegroundColor Yellow
        $global:testsFailed++
    }
}

# 6. SECURITY HEADERS
Write-TestHeader "Security Headers"

try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/health" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    $headers = $response.Headers
    
    $securityHeaders = @(
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection",
        "Strict-Transport-Security",
        "Referrer-Policy"
    )
    
    foreach ($header in $securityHeaders) {
        if ($headers.ContainsKey($header)) {
            $headerValue = $headers[$header]
            Write-Host "  [PASS] $header" -ForegroundColor Green -NoNewline
            Write-Host " ($headerValue)" -ForegroundColor Gray
            $global:testsPassed++
        } else {
            Write-Host "  [FAIL] $header" -ForegroundColor Red -NoNewline
            Write-Host " (Missing)" -ForegroundColor Yellow
            $global:testsFailed++
        }
    }
} catch {
    Write-Host "  [FAIL] Unable to verify security headers" -ForegroundColor Red
    $global:testsFailed++
}

# ===========================================================
# SUMMARY
# ===========================================================

Write-TestHeader "Test Summary"

$totalTests = $global:testsPassed + $global:testsFailed
$passRate = if ($totalTests -gt 0) {
    [math]::Round(($global:testsPassed / $totalTests) * 100, 1)
} else {
    0
}

Write-Host ""
Write-Host "  Total Tests:  $totalTests" -ForegroundColor White
Write-Host "  Passed:       $global:testsPassed" -ForegroundColor Green
Write-Host "  Failed:       $global:testsFailed" -ForegroundColor $(if ($global:testsFailed -gt 0) { "Red" } else { "Gray" })
Write-Host "  Pass Rate:    $passRate%" -ForegroundColor $(if ($passRate -ge 90) { "Green" } elseif ($passRate -ge 70) { "Yellow" } else { "Red" })
Write-Host ""

if ($global:testsFailed -eq 0) {
    Write-Host "[OK] All smoke tests passed! Deployment verified." -ForegroundColor Green
    exit 0
} else {
    Write-Host "[WARN] $global:testsFailed smoke test(s) failed. Review and investigate." -ForegroundColor Yellow
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check Render.com logs: https://dashboard.render.com" -ForegroundColor White
    Write-Host "  2. Check Vercel logs: https://vercel.com/dashboard" -ForegroundColor White
    Write-Host "  3. Verify environment variables are set correctly" -ForegroundColor White
    Write-Host "  4. Check database migrations: cd backend && npx prisma migrate status" -ForegroundColor White
    exit 1
}
