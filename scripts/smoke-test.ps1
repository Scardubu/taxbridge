#!/usr/bin/env pwsh
# TaxBridge Post-Deployment Smoke Tests
# Validates all critical API endpoints and services after deployment
#
# Usage:
#   .\scripts\smoke-test.ps1                                          # Uses default staging URL
#   .\scripts\smoke-test.ps1 -BackendUrl https://api.taxbridge.ng     # Custom backend URL
#   .\scripts\smoke-test.ps1 -BackendUrl https://api.taxbridge.ng -AdminUrl https://admin.taxbridge.ng

param(
    [Parameter(Mandatory=$false)]
    [string]$BackendUrl = "https://taxbridge-api-ker8.onrender.com",

    [Parameter(Mandatory=$false)]
    [string]$AdminUrl = "https://taxbridge.vercel.app",

    [Parameter(Mandatory=$false)]
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Counters
$script:Passed = 0
$script:Failed = 0
$script:Warned = 0
$script:StartTime = Get-Date

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "--- $Title ---" -ForegroundColor Cyan
}

function Test-Http {
    param(
        [string]$Url,
        [string]$Name,
        [string]$Method = "GET",
        [int]$ExpectedStatus = 200,
        [string]$Body = "",
        [hashtable]$Headers = @{},
        [bool]$Critical = $true
    )

    $params = @{
        Uri            = $Url
        Method         = $Method
        TimeoutSec     = 15
        UseBasicParsing = $true
        ErrorAction    = "Stop"
    }
    if ($Headers.Count -gt 0) { $params.Headers = $Headers }
    if ($Body) {
        $params.Body = $Body
        if (-not $Headers.ContainsKey("Content-Type")) {
            $params.Headers["Content-Type"] = "application/json"
        }
    }

    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest @params
        $sw.Stop()
        $ms = $sw.ElapsedMilliseconds

        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "  [PASS] $Name (${ms}ms)" -ForegroundColor Green
            $script:Passed++
            return $true
        } else {
            Write-Host "  [FAIL] $Name — expected $ExpectedStatus, got $($response.StatusCode)" -ForegroundColor Red
            if ($Critical) { $script:Failed++ } else { $script:Warned++ }
            return $false
        }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        # Some endpoints return 401/405 intentionally — treat as expected if matching
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  [PASS] $Name (expected $ExpectedStatus)" -ForegroundColor Green
            $script:Passed++
            return $true
        }

        $msg = if ($statusCode) { "HTTP $statusCode" } else { $_.Exception.Message }
        Write-Host "  [FAIL] $Name — $msg" -ForegroundColor Red
        if ($Critical) { $script:Failed++ } else { $script:Warned++ }
        return $false
    }
}

function Test-JsonField {
    param(
        [string]$Url,
        [string]$Name,
        [string[]]$Fields
    )

    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 15
        $missing = @()
        foreach ($f in $Fields) {
            if ($null -eq $response.$f) { $missing += $f }
        }
        if ($missing.Count -eq 0) {
            Write-Host "  [PASS] $Name — all fields present" -ForegroundColor Green
            $script:Passed++
            return $true
        } else {
            Write-Host "  [WARN] $Name — missing: $($missing -join ', ')" -ForegroundColor Yellow
            $script:Warned++
            return $false
        }
    } catch {
        Write-Host "  [FAIL] $Name — $($_.Exception.Message)" -ForegroundColor Red
        $script:Failed++
        return $false
    }
}

# ============================================================
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  TaxBridge Post-Deployment Smoke Tests" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Backend:  $BackendUrl"
Write-Host "  Admin:    $AdminUrl"
Write-Host "  Time:     $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# ============================================================
Write-Section "1. Backend Health"
# ============================================================
Test-Http -Url "$BackendUrl/health" -Name "GET /health"
Test-JsonField -Url "$BackendUrl/health" -Name "/health JSON shape" -Fields @("status", "timestamp")
Test-Http -Url "$BackendUrl/health/live" -Name "GET /health/live" -Critical $false
Test-Http -Url "$BackendUrl/health/ready" -Name "GET /health/ready" -Critical $false
Test-Http -Url "$BackendUrl/health/db" -Name "GET /health/db" -Critical $false
Test-Http -Url "$BackendUrl/health/integrations" -Name "GET /health/integrations" -Critical $false

# ============================================================
Write-Section "2. Auth Endpoints (expect 4xx without credentials)"
# ============================================================
Test-Http -Url "$BackendUrl/api/v1/business/profile" -Name "GET /business/profile (401)" -ExpectedStatus 401
Test-Http -Url "$BackendUrl/api/v1/invoices" -Name "GET /invoices (401)" -ExpectedStatus 401
Test-Http -Url "$BackendUrl/api/v1/payments" -Name "GET /payments (401)" -ExpectedStatus 401

# ============================================================
Write-Section "3. Tax Calculator (POST endpoints — expect 400 without body)"
# ============================================================
$taxEndpoints = @("pit", "vat", "cit", "cgt", "wht", "paye")
foreach ($tax in $taxEndpoints) {
    # POST with empty body should return 400 (validation error), not 500
    Test-Http -Url "$BackendUrl/api/v1/tax/calculate/$tax" `
              -Name "POST /tax/calculate/$tax (400 validation)" `
              -Method "POST" `
              -Body "{}" `
              -ExpectedStatus 400 `
              -Critical $false
}

# ============================================================
Write-Section "4. Payment Gateways"
# ============================================================
Test-Http -Url "$BackendUrl/api/v1/payments/gateways" -Name "GET /payments/gateways (401)" -ExpectedStatus 401 -Critical $false

# ============================================================
Write-Section "5. Admin Dashboard"
# ============================================================
if ($AdminUrl) {
    Test-Http -Url $AdminUrl -Name "Admin home page"
}

# ============================================================
Write-Section "6. Security Checks"
# ============================================================
# HTTPS
if ($BackendUrl.StartsWith("https://")) {
    Write-Host "  [PASS] Backend uses HTTPS" -ForegroundColor Green
    $script:Passed++
} else {
    Write-Host "  [WARN] Backend not using HTTPS" -ForegroundColor Yellow
    $script:Warned++
}

# CORS — OPTIONS preflight
try {
    $corsResponse = Invoke-WebRequest -Uri "$BackendUrl/health" -Method OPTIONS -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    $corsHeader = $corsResponse.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader) {
        Write-Host "  [PASS] CORS headers present: $corsHeader" -ForegroundColor Green
        $script:Passed++
    } else {
        Write-Host "  [WARN] No CORS header on OPTIONS" -ForegroundColor Yellow
        $script:Warned++
    }
} catch {
    Write-Host "  [WARN] CORS preflight check inconclusive" -ForegroundColor Yellow
    $script:Warned++
}

# ============================================================
Write-Section "7. Response Time"
# ============================================================
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    Invoke-WebRequest -Uri "$BackendUrl/health" -Method Get -UseBasicParsing -TimeoutSec 15 | Out-Null
    $sw.Stop()
    $ms = $sw.ElapsedMilliseconds
    if ($ms -lt 500) {
        Write-Host "  [PASS] Health endpoint: ${ms}ms (excellent)" -ForegroundColor Green
        $script:Passed++
    } elseif ($ms -lt 2000) {
        Write-Host "  [WARN] Health endpoint: ${ms}ms (acceptable — cold start?)" -ForegroundColor Yellow
        $script:Warned++
    } else {
        Write-Host "  [FAIL] Health endpoint: ${ms}ms (too slow)" -ForegroundColor Red
        $script:Failed++
    }
} catch {
    Write-Host "  [FAIL] Could not measure response time" -ForegroundColor Red
    $script:Failed++
}

# ============================================================
# Summary
# ============================================================
$elapsed = (Get-Date) - $script:StartTime

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Smoke Test Results" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Passed:   $($script:Passed)" -ForegroundColor Green
Write-Host "  Warnings: $($script:Warned)" -ForegroundColor Yellow
Write-Host "  Failed:   $($script:Failed)" -ForegroundColor Red
Write-Host "  Duration: $([math]::Round($elapsed.TotalSeconds, 1))s"
Write-Host ""

if ($script:Failed -gt 0) {
    Write-Host "  RESULT: FAILED — $($script:Failed) critical issue(s)" -ForegroundColor Red
    Write-Host "  Action: Investigate failures before routing production traffic." -ForegroundColor Red
    exit 1
} elseif ($script:Warned -gt 0) {
    Write-Host "  RESULT: PASSED WITH WARNINGS" -ForegroundColor Yellow
    Write-Host "  Action: Review warnings; non-blocking for deployment." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "  RESULT: ALL PASSED" -ForegroundColor Green
    Write-Host "  Action: Safe to proceed with production traffic." -ForegroundColor Green
    exit 0
}
