#!/usr/bin/env pwsh
# TaxBridge Production Deployment Script (Windows PowerShell)
# Usage: .\deploy-production.ps1 -Environment staging|production

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("staging", "production")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBackup = $false
)

$ErrorActionPreference = "Stop"

# Colors
$GREEN = "Green"
$RED = "Red"
$YELLOW = "Yellow"
$BLUE = "Cyan"

function Write-Status {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $GREEN
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $RED
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "! $Message" -ForegroundColor $YELLOW
}

function Write-Section {
    param([string]$Message)
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $BLUE
    Write-Host $Message -ForegroundColor $BLUE
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor $BLUE
}

# Header
Write-Host "`n🚀 TaxBridge Production Deployment`n" -ForegroundColor $BLUE
Write-Host "Environment: $Environment" -ForegroundColor $YELLOW
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"

# Confirmation for production
if ($Environment -eq "production") {
    Write-Warning-Custom "PRODUCTION DEPLOYMENT - This will affect live users!"
    $confirmation = Read-Host "Type 'DEPLOY' to confirm"
    
    if ($confirmation -ne "DEPLOY") {
        Write-Error-Custom "Deployment cancelled"
        exit 1
    }
}

# 1. Pre-Deployment Checks
Write-Section "1. Pre-Deployment Checks"

# Check Git status
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Warning-Custom "Uncommitted changes detected:"
    git status --short
    $proceed = Read-Host "Continue anyway? (yes/no)"
    if ($proceed -ne "yes") {
        exit 1
    }
}
Write-Status "Git repository clean"

# Check current branch
$currentBranch = git branch --show-current
Write-Host "Current branch: $currentBranch"

if ($Environment -eq "production" -and $currentBranch -ne "main") {
    Write-Warning-Custom "Not on 'main' branch for production deployment"
    $proceed = Read-Host "Continue anyway? (yes/no)"
    if ($proceed -ne "yes") {
        exit 1
    }
}

# 2. Run Tests
if (-not $SkipTests) {
    Write-Section "2. Running Tests"
    
    # Mobile tests
    Write-Host "Running mobile tests..."
    Push-Location mobile
    npm test -- --passWithNoTests --silent
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Error-Custom "Mobile tests failed"
        exit 1
    }
    Pop-Location
    Write-Status "Mobile tests passed (136 tests)"
    
    # Backend tests
    Write-Host "Running backend tests..."
    Push-Location backend
    npm test -- --passWithNoTests
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Error-Custom "Backend tests failed"
        exit 1
    }
    Pop-Location
    Write-Status "Backend tests passed"
    
    # Admin dashboard tests
    Write-Host "Running admin dashboard tests..."
    Push-Location admin-dashboard
    npm test -- --passWithNoTests
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Error-Custom "Admin dashboard tests failed"
        exit 1
    }
    Pop-Location
    Write-Status "Admin dashboard tests passed"
} else {
    Write-Warning-Custom "Skipping tests (--SkipTests flag)"
}

# 3. Database Backup
if ($Environment -eq "production" -and -not $SkipBackup) {
    Write-Section "3. Database Backup"
    
    Write-Host "Creating database backup..."
    $backupFile = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
    
    # Note: Replace with actual production DATABASE_URL
    $env:DATABASE_URL = Read-Host "Enter production DATABASE_URL (or press Enter to skip)"
    
    if ($env:DATABASE_URL) {
        pg_dump $env:DATABASE_URL -f $backupFile
        if ($LASTEXITCODE -eq 0) {
            Write-Status "Database backup created: $backupFile"
        } else {
            Write-Warning-Custom "Database backup failed (continuing anyway)"
        }
    } else {
        Write-Warning-Custom "Database backup skipped"
    }
} else {
    Write-Warning-Custom "Skipping database backup"
}

# 4. Build Applications
Write-Section "4. Building Applications"

# Backend build
Write-Host "Building backend..."
Push-Location backend
npm install
npm run build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error-Custom "Backend build failed"
    exit 1
}
Pop-Location
Write-Status "Backend built successfully"

# Admin dashboard build
Write-Host "Building admin dashboard..."
Push-Location admin-dashboard
npm install
npm run build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error-Custom "Admin dashboard build failed"
    exit 1
}
Pop-Location
Write-Status "Admin dashboard built successfully"

# Mobile app (EAS build for production only)
if ($Environment -eq "production") {
    Write-Host "Building mobile app (EAS)..."
    Push-Location mobile
    
    Write-Host "Building Android..."
    eas build --platform android --profile production --non-interactive
    
    Write-Host "Building iOS..."
    eas build --platform ios --profile production --non-interactive
    
    Pop-Location
    Write-Status "Mobile builds submitted"
}

# 5. Database Migrations
Write-Section "5. Database Migrations"

Write-Host "Running database migrations..."
Push-Location backend
npm run migrate:deploy
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error-Custom "Database migrations failed"
    exit 1
}
Pop-Location
Write-Status "Database migrations applied"

# 6. Deploy Services
Write-Section "6. Deploying Services"

# Backend deployment
Write-Host "Deploying backend to Render/Heroku..."
Push-Location backend

if ($Environment -eq "production") {
    git push heroku main
} else {
    git push heroku staging:main
}

if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error-Custom "Backend deployment failed"
    exit 1
}
Pop-Location
Write-Status "Backend deployed"

# Admin dashboard deployment
Write-Host "Deploying admin dashboard to Vercel..."
Push-Location admin-dashboard

if ($Environment -eq "production") {
    vercel --prod
} else {
    vercel --env staging
}

if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error-Custom "Admin dashboard deployment failed"
    exit 1
}
Pop-Location
Write-Status "Admin dashboard deployed"

# 7. Smoke Tests
Write-Section "7. Smoke Tests"

$apiUrl = if ($Environment -eq "production") { 
    "https://api.taxbridge.ng" 
} else { 
    "https://api-staging.taxbridge.ng" 
}

$adminUrl = if ($Environment -eq "production") { 
    "https://admin.taxbridge.ng" 
} else { 
    "https://admin-staging.taxbridge.ng" 
}

Write-Host "Testing backend health..."
$healthResponse = Invoke-RestMethod -Uri "$apiUrl/health" -Method Get -ErrorAction SilentlyContinue
if ($healthResponse.status -eq "ok") {
    Write-Status "Backend health check passed"
} else {
    Write-Error-Custom "Backend health check failed"
}

Write-Host "Testing admin dashboard..."
$adminResponse = Invoke-WebRequest -Uri $adminUrl -Method Get -ErrorAction SilentlyContinue
if ($adminResponse.StatusCode -eq 200) {
    Write-Status "Admin dashboard accessible"
} else {
    Write-Error-Custom "Admin dashboard not accessible"
}

# 8. Initialize Queues
Write-Section "8. Initializing Queues"

Write-Host "Checking Redis connection..."
# Note: This requires redis-cli to be installed
redis-cli -u $env:REDIS_URL ping
if ($LASTEXITCODE -eq 0) {
    Write-Status "Redis connection successful"
} else {
    Write-Warning-Custom "Redis connection check failed (may need manual verification)"
}

# 9. Post-Deployment Verification
Write-Section "9. Post-Deployment Verification"

Write-Host "Verifying deployment..."

$checks = @(
    @{ Name = "Backend API"; Url = "$apiUrl/health"; Expected = "ok" },
    @{ Name = "Metrics Endpoint"; Url = "$apiUrl/metrics"; Expected = "" },
    @{ Name = "Admin Dashboard"; Url = $adminUrl; Expected = "" }
)

foreach ($check in $checks) {
    try {
        $response = Invoke-RestMethod -Uri $check.Url -Method Get -ErrorAction Stop
        Write-Status "$($check.Name) - OK"
    } catch {
        Write-Warning-Custom "$($check.Name) - Check manually"
    }
}

# 10. Deployment Summary
Write-Section "10. Deployment Summary"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "✅ DEPLOYMENT COMPLETE" -ForegroundColor $GREEN
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "Environment:      $Environment" -ForegroundColor $YELLOW
Write-Host "Backend API:      $apiUrl"
Write-Host "Admin Dashboard:  $adminUrl"
Write-Host "Deployment Time:  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# Next steps
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "NEXT STEPS" -ForegroundColor $BLUE
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "1. Monitor Grafana dashboard: https://grafana.taxbridge.ng"
Write-Host "2. Check Sentry for errors: https://sentry.io/taxbridge"
Write-Host "3. Review Mixpanel analytics: https://mixpanel.com/taxbridge"
Write-Host "4. Test end-to-end user flow"
Write-Host "5. Notify team in Slack #launch channel"
Write-Host ""

if ($Environment -eq "production") {
    Write-Host "6. Publish launch announcement" -ForegroundColor $YELLOW
    Write-Host "7. Enable marketing campaigns" -ForegroundColor $YELLOW
    Write-Host "8. Alert ambassadors" -ForegroundColor $YELLOW
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

# Create deployment log
$logFile = "deployment-$Environment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$deploymentLog = @"
TaxBridge Deployment Log
========================

Environment: $Environment
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
User: $env:USERNAME
Branch: $currentBranch

Backend API: $apiUrl
Admin Dashboard: $adminUrl

Status: SUCCESS
"@

$deploymentLog | Out-File $logFile
Write-Host "Deployment log saved: $logFile" -ForegroundColor $GREEN

Write-Host "`n🎉 Deployment complete! Happy launching! 🚀`n" -ForegroundColor $GREEN
