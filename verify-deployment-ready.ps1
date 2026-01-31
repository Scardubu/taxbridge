#!/usr/bin/env pwsh
# TaxBridge Deployment Readiness Verification
# Quick pre-flight check before running deploy-production.ps1

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  TaxBridge Deployment Readiness Check" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0
$warnings = 0

function Check-Item {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$FailMsg,
        [switch]$Critical
    )
    
    Write-Host "Checking: $Name..." -NoNewline
    
    try {
        $result = & $Test
        if ($result) {
            Write-Host " PASS" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            if ($Critical) {
                Write-Host " FAIL" -ForegroundColor Red
                $script:failed++
                if ($FailMsg) { Write-Host "  - $FailMsg" -ForegroundColor Red }
            } else {
                Write-Host " WARN" -ForegroundColor Yellow
                $script:warnings++
                if ($FailMsg) { Write-Host "  - $FailMsg" -ForegroundColor Yellow }
            }
            return $false
        }
    } catch {
        Write-Host " ERROR" -ForegroundColor Red
        $script:failed++
        return $false
    }
}

Write-Host ""
Write-Host "--- 1. Deployment Script Validation ---" -ForegroundColor Cyan
Write-Host ""

Check-Item "deploy-production.ps1 exists" {
    Test-Path ".\deploy-production.ps1"
} -FailMsg "Deployment script not found" -Critical

Check-Item "deploy-production.ps1 syntax valid" {
    $scriptContent = Get-Content ".\deploy-production.ps1" -Raw
    $parseErrors = $null
    $null = [System.Management.Automation.PSParser]::Tokenize($scriptContent, [ref]$parseErrors)
    $parseErrors.Count -eq 0
} -FailMsg "Script has parse errors" -Critical

Write-Host ""
Write-Host "--- 2. Git Repository Status ---" -ForegroundColor Cyan
Write-Host ""

Check-Item "Git repository initialized" {
    Test-Path ".\.git"
} -FailMsg "Not a git repository" -Critical

$currentBranch = git branch --show-current 2>$null
Write-Host "Current branch: $currentBranch" -ForegroundColor Yellow

Check-Item "No uncommitted changes" {
    $status = git status --porcelain
    [string]::IsNullOrWhiteSpace($status)
} -FailMsg "Uncommitted changes detected"

Write-Host ""
Write-Host "--- 3. Build Artifacts ---" -ForegroundColor Cyan
Write-Host ""

Check-Item "Mobile package.json exists" {
    Test-Path ".\mobile\package.json"
} -Critical

Check-Item "Backend package.json exists" {
    Test-Path ".\backend\package.json"
} -Critical

Check-Item "Admin package.json exists" {
    Test-Path ".\admin-dashboard\package.json"
} -Critical

Write-Host ""
Write-Host "--- 4. Configuration Files ---" -ForegroundColor Cyan
Write-Host ""

Check-Item "Metro config exists" {
    Test-Path ".\mobile\metro.config.js"
} -FailMsg "React deduplication config missing" -Critical

Check-Item "EAS config exists" {
    Test-Path ".\eas.json"
} -FailMsg "EAS build configuration missing"

Check-Item "Production env example exists" {
    Test-Path ".\mobile\.env.production.example"
} -FailMsg "Environment template missing"

Write-Host ""
Write-Host "--- 5. Documentation ---" -ForegroundColor Cyan
Write-Host ""

Check-Item "Production Status doc exists" {
    Test-Path ".\PRODUCTION_STATUS.md"
} -Critical

Check-Item "Deployment Checklist exists" {
    Test-Path ".\PRODUCTION_DEPLOYMENT_CHECKLIST.md"
} -Critical

Check-Item "Final Readiness Report exists" {
    Test-Path ".\FINAL_PRODUCTION_READINESS_REPORT.md"
} -Critical

Write-Host ""
Write-Host "--- 6. Code Quality ---" -ForegroundColor Cyan
Write-Host ""

Check-Item "Mobile TypeScript config exists" {
    Test-Path ".\mobile\tsconfig.json"
} -Critical

Check-Item "Backend TypeScript config exists" {
    Test-Path ".\backend\tsconfig.json"
} -Critical

Write-Host ""
Write-Host "--- 7. Dependencies ---" -ForegroundColor Cyan
Write-Host ""

Check-Item "Mobile node_modules exists" {
    Test-Path ".\mobile\node_modules"
} -FailMsg "Run: cd mobile; npm install" -Critical

Check-Item "Backend node_modules exists" {
    Test-Path ".\backend\node_modules"
} -FailMsg "Run: cd backend; npm install" -Critical

Check-Item "Admin node_modules exists" {
    Test-Path ".\admin-dashboard\node_modules"
} -FailMsg "Run: cd admin-dashboard; npm install" -Critical

Write-Host ""
Write-Host "--- 8. Critical Source Files ---" -ForegroundColor Cyan
Write-Host ""

Check-Item "App.tsx exists" { Test-Path ".\mobile\App.tsx" } -Critical
Check-Item "PaymentScreen.tsx exists" { Test-Path ".\mobile\src\screens\PaymentScreen.tsx" } -Critical
Check-Item "SplashScreen.tsx exists" { Test-Path ".\mobile\src\screens\SplashScreen.tsx" } -Critical
Check-Item "backend server.ts exists" { Test-Path ".\backend\src\server.ts" } -Critical
Check-Item "admin page.tsx exists" { Test-Path ".\admin-dashboard\app\page.tsx" } -Critical

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Passed:   $passed" -ForegroundColor Green
Write-Host "Warnings: $warnings" -ForegroundColor Yellow
Write-Host "Failed:   $failed" -ForegroundColor Red

Write-Host ""

if ($failed -eq 0) {
    Write-Host "SUCCESS: System is ready for deployment!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Review PRODUCTION_DEPLOYMENT_CHECKLIST.md"
    Write-Host "2. Run: .\deploy-production.ps1 -Environment staging"
    Write-Host "3. Test staging deployment"
    Write-Host "4. Run: .\deploy-production.ps1 -Environment production"
    Write-Host ""
    exit 0
} else {
    Write-Host "FAILED: Please resolve critical issues before deploying" -ForegroundColor Red
    Write-Host ""
    exit 1
}
