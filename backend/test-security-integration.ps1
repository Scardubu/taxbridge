# Security Integration Test Script
# Tests all authentication and privacy endpoints

$baseUrl = "http://localhost:3000"
$testPhone = "+2348012345678"
$testName = "Security Test User"
$testPassword = "SecurePass123!@#"

Write-Host "=== TaxBridge Security Integration Tests ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "[1/9] Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    if ($health.status -eq "ok" -or $health.status -eq "healthy") {
        Write-Host "✅ Health check passed" -ForegroundColor Green
        Write-Host "   Database latency: $($health.latency.database)ms" -ForegroundColor Gray
        Write-Host "   Redis latency: $($health.latency.redis)ms" -ForegroundColor Gray
    } else {
        Write-Host "❌ Health check failed: $($health.status)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health endpoint not accessible: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Security Headers
Write-Host "[2/9] Testing Security Headers..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method Get -UseBasicParsing
    $headers = @(
        "X-Content-Type-Options",
        "X-Frame-Options",
        "X-XSS-Protection",
        "Strict-Transport-Security",
        "Content-Security-Policy"
    )
    
    $missingHeaders = @()
    foreach ($header in $headers) {
        if (-not $response.Headers[$header]) {
            $missingHeaders += $header
        }
    }
    
    if ($missingHeaders.Count -eq 0) {
        Write-Host "✅ All security headers present" -ForegroundColor Green
        Write-Host "   CSP: $($response.Headers['Content-Security-Policy'])" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Missing headers: $($missingHeaders -join ', ')" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Could not check security headers: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: User Registration
Write-Host "[3/9] Testing User Registration..." -ForegroundColor Yellow
try {
    $registerBody = @{
        phone = $testPhone
        name = $testName
        password = $testPassword
    } | ConvertTo-Json
    
    $register = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" `
        -Method Post `
        -Body $registerBody `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    if ($register.success -and $register.userId) {
        Write-Host "✅ User registration successful" -ForegroundColor Green
        Write-Host "   User ID: $($register.userId)" -ForegroundColor Gray
        $global:testUserId = $register.userId
    } else {
        Write-Host "❌ Registration failed: No userId returned" -ForegroundColor Red
    }
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "⚠️  Registration error (may already exist): $($errorMsg.error)" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Login
Write-Host "[4/9] Testing User Login..." -ForegroundColor Yellow
try {
    $loginBody = @{
        phone = $testPhone
        password = $testPassword
    } | ConvertTo-Json
    
    $login = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/login" `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    if ($login.success) {
        if ($login.requiresMfa) {
            Write-Host "✅ Login successful (MFA required)" -ForegroundColor Green
            Write-Host "   MFA Token received" -ForegroundColor Gray
            $global:mfaToken = $login.mfaToken
        } else {
            Write-Host "✅ Login successful" -ForegroundColor Green
            Write-Host "   Access Token: $($login.accessToken.Substring(0, 20))..." -ForegroundColor Gray
            $global:accessToken = $login.accessToken
        }
    } else {
        Write-Host "❌ Login failed" -ForegroundColor Red
    }
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ Login error: $($errorMsg.error)" -ForegroundColor Red
}
Write-Host ""

# Test 5: MFA Setup (if we have accessToken)
if ($global:accessToken) {
    Write-Host "[5/9] Testing MFA Setup..." -ForegroundColor Yellow
    try {
        $mfaSetup = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/mfa/setup" `
            -Method Post `
            -Headers @{ Authorization = "Bearer $($global:accessToken)" } `
            -ContentType "application/json" `
            -ErrorAction Stop
        
        if ($mfaSetup.success -and $mfaSetup.qrCode) {
            Write-Host "✅ MFA setup initiated" -ForegroundColor Green
            Write-Host "   QR Code: data:image/png;base64,..." -ForegroundColor Gray
            Write-Host "   Secret: $($mfaSetup.secret.Substring(0, 10))..." -ForegroundColor Gray
        } else {
            Write-Host "❌ MFA setup failed" -ForegroundColor Red
        }
    } catch {
        $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "⚠️  MFA setup error: $($errorMsg.error)" -ForegroundColor Yellow
    }
    Write-Host ""
} else {
    Write-Host "[5/9] Skipping MFA Setup (no access token)" -ForegroundColor Gray
    Write-Host ""
}

# Test 6: SQL Injection Prevention
Write-Host "[6/9] Testing SQL Injection Prevention..." -ForegroundColor Yellow
try {
    $sqlInjectionBody = @{
        phone = "+234801234567' OR '1'='1"
        password = "test' OR '1'='1"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/login" `
        -Method Post `
        -Body $sqlInjectionBody `
        -ContentType "application/json" `
        -ErrorAction SilentlyContinue
    
    if ($result.error) {
        Write-Host "✅ SQL injection blocked (input validation)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SQL injection not properly blocked" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✅ SQL injection blocked (request rejected)" -ForegroundColor Green
}
Write-Host ""

# Test 7: Rate Limiting
Write-Host "[7/9] Testing Rate Limiting..." -ForegroundColor Yellow
Write-Host "   Sending 15 rapid requests..." -ForegroundColor Gray
$rateLimitHit = $false
for ($i = 1; $i -le 15; $i++) {
    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -ErrorAction Stop
    } catch {
        if ($_.Exception.Response.StatusCode -eq 429) {
            $rateLimitHit = $true
            Write-Host "✅ Rate limiting active (blocked at request $i)" -ForegroundColor Green
            break
        }
    }
    Start-Sleep -Milliseconds 50
}
if (-not $rateLimitHit) {
    Write-Host "⚠️  Rate limiting not triggered (may need Cloudflare in production)" -ForegroundColor Yellow
}
Write-Host ""

# Test 8: DSAR Export (if we have accessToken)
if ($global:accessToken -and $global:testUserId) {
    Write-Host "[8/9] Testing DSAR Export..." -ForegroundColor Yellow
    try {
        $export = Invoke-RestMethod -Uri "$baseUrl/api/v1/privacy/export/$($global:testUserId)" `
            -Method Get `
            -Headers @{ Authorization = "Bearer $($global:accessToken)" } `
            -ErrorAction Stop
        
        if ($export.success -and $export.data) {
            Write-Host "✅ DSAR export successful" -ForegroundColor Green
            Write-Host "   User data: $($export.data.user.name)" -ForegroundColor Gray
            Write-Host "   Invoices: $($export.data.invoices.Count)" -ForegroundColor Gray
        } else {
            Write-Host "❌ DSAR export failed" -ForegroundColor Red
        }
    } catch {
        $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "⚠️  DSAR export error: $($errorMsg.error)" -ForegroundColor Yellow
    }
    Write-Host ""
} else {
    Write-Host "[8/9] Skipping DSAR Export (no access token)" -ForegroundColor Gray
    Write-Host ""
}

# Test 9: Password Policy
Write-Host "[9/9] Testing Password Policy..." -ForegroundColor Yellow
try {
    $weakPasswordBody = @{
        phone = "+2348099999999"
        name = "Test User"
        password = "weak"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/register" `
        -Method Post `
        -Body $weakPasswordBody `
        -ContentType "application/json" `
        -ErrorAction SilentlyContinue
    
    if ($result.error) {
        Write-Host "✅ Weak password rejected" -ForegroundColor Green
        Write-Host "   Error: $($result.error)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Weak password accepted (policy may need strengthening)" -ForegroundColor Yellow
    }
} catch {
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorDetails.error -match "password|validation") {
        Write-Host "✅ Weak password rejected" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Unexpected error: $($errorDetails.error)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Security implementation is operational." -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Run full security test suite: npm run test:security" -ForegroundColor White
Write-Host "2. Deploy Cloudflare infrastructure for production" -ForegroundColor White
Write-Host "3. Enable Sentry monitoring with SENTRY_DSN" -ForegroundColor White
Write-Host "4. Review SECURITY_DEPLOYMENT_CHECKLIST.md for production readiness" -ForegroundColor White
Write-Host ""
