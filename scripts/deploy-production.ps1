#!/usr/bin/env pwsh
<#
.SYNOPSIS
    [DEPRECATED] TaxBridge Production Deployment Script
.DESCRIPTION
    ⚠️  DEPRECATED: Use the root deploy-production.ps1 instead.
    
    This script has been superseded by the canonical deployment script at:
        .\deploy-production.ps1 -Environment production
    
    For mobile-only deployments, use:
        .\scripts\deploy-mobile-production.ps1
        
    For admin dashboard, use:
        .\admin-dashboard\deploy-vercel.ps1
        
    Keeping this file temporarily for backward compatibility.
    
.PARAMETER SkipTests
    Skip running test suite (not recommended for production)
.PARAMETER SkipBuild
    Skip building workspaces (use existing builds)
.PARAMETER DryRun
    Simulate deployment without actually deploying
.EXAMPLE
    # DEPRECATED - use root script instead:
    .\deploy-production.ps1 -Environment production
#>

Write-Host "⚠️  WARNING: This script is DEPRECATED" -ForegroundColor Yellow
Write-Host "    Use: .\deploy-production.ps1 -Environment production" -ForegroundColor Yellow
Write-Host ""

param(
    [switch]$SkipTests,
    [switch]$SkipBuild,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 TaxBridge Production Deployment" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're on the correct branch
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "master" -and $currentBranch -ne "main") {
    Write-Host "⚠️  WARNING: Not on master/main branch (current: $currentBranch)" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y") {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

# Step 1: Environment Validation
Write-Host "📋 Step 1: Validating Environment" -ForegroundColor Green
Write-Host "-----------------------------------" -ForegroundColor Gray

# Check Node.js version
$nodeVersion = node --version
Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Gray

if ($nodeVersion -notmatch "v20\.") {
    Write-Host "⚠️  WARNING: Node.js 20.x recommended (current: $nodeVersion)" -ForegroundColor Yellow
}

# Check npm version
$npmVersion = npm --version
Write-Host "✓ npm: $npmVersion" -ForegroundColor Gray

# Check for required environment files
$envFiles = @(
    "backend\.env",
    "admin-dashboard\.env.production",
    "mobile\.env.production"
)

foreach ($file in $envFiles) {
    if (Test-Path $file) {
        Write-Host "✓ Found: $file" -ForegroundColor Gray
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
        Write-Host "   Copy from .env.production.example and configure" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""

# Step 2: Run Tests
if (-not $SkipTests) {
    Write-Host "🧪 Step 2: Running Test Suite" -ForegroundColor Green
    Write-Host "------------------------------" -ForegroundColor Gray
    
    Push-Location backend
    try {
        Write-Host "Running backend tests..." -ForegroundColor Gray
        npm test -- --selectProjects unit --silent
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Backend tests failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "✓ Backend tests passed" -ForegroundColor Gray
    } finally {
        Pop-Location
    }
    
    Write-Host ""
} else {
    Write-Host "⏭️  Step 2: Skipping Tests" -ForegroundColor Yellow
    Write-Host ""
}

# Step 3: Build All Workspaces
if (-not $SkipBuild) {
    Write-Host "🔨 Step 3: Building Workspaces" -ForegroundColor Green
    Write-Host "-------------------------------" -ForegroundColor Gray
    
    # Build contracts first (dependency for backend)
    Write-Host "Building @taxbridge/contracts..." -ForegroundColor Gray
    Push-Location packages/contracts
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Contracts build failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "✓ Contracts built" -ForegroundColor Gray
    } finally {
        Pop-Location
    }
    
    # Build backend
    Write-Host "Building backend..." -ForegroundColor Gray
    Push-Location backend
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Backend build failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "✓ Backend built" -ForegroundColor Gray
    } finally {
        Pop-Location
    }
    
    # Build admin dashboard
    Write-Host "Building admin dashboard..." -ForegroundColor Gray
    Push-Location admin-dashboard
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Admin dashboard build failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "✓ Admin dashboard built" -ForegroundColor Gray
    } finally {
        Pop-Location
    }
    
    Write-Host ""
} else {
    Write-Host "⏭️  Step 3: Skipping Build" -ForegroundColor Yellow
    Write-Host ""
}

# Step 4: Deploy Backend to Render
Write-Host "🌐 Step 4: Deploying Backend" -ForegroundColor Green
Write-Host "-----------------------------" -ForegroundColor Gray

if ($DryRun) {
    Write-Host "🔍 DRY RUN: Would deploy backend to Render" -ForegroundColor Cyan
} else {
    Write-Host "Pushing to Render (via git push)..." -ForegroundColor Gray
    git push origin master
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Git push failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Backend deployment triggered on Render" -ForegroundColor Gray
    Write-Host "  Monitor at: https://dashboard.render.com" -ForegroundColor Gray
}

Write-Host ""

# Step 5: Deploy Admin Dashboard to Vercel
Write-Host "🎨 Step 5: Deploying Admin Dashboard" -ForegroundColor Green
Write-Host "-------------------------------------" -ForegroundColor Gray

if ($DryRun) {
    Write-Host "🔍 DRY RUN: Would deploy admin dashboard to Vercel" -ForegroundColor Cyan
} else {
    Push-Location admin-dashboard
    try {
        Write-Host "Deploying to Vercel..." -ForegroundColor Gray
        
        # Check if vercel CLI is installed
        $vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
        if (-not $vercelInstalled) {
            Write-Host "⚠️  Vercel CLI not found. Install with: npm i -g vercel" -ForegroundColor Yellow
            Write-Host "   Skipping Vercel deployment" -ForegroundColor Yellow
        } else {
            vercel --prod --yes
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ Vercel deployment failed" -ForegroundColor Red
                exit 1
            }
            Write-Host "✓ Admin dashboard deployed to Vercel" -ForegroundColor Gray
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""

# Step 6: Mobile App Build (EAS)
Write-Host "📱 Step 6: Mobile App Build Status" -ForegroundColor Green
Write-Host "-----------------------------------" -ForegroundColor Gray

Write-Host "Mobile app builds are managed via EAS Build" -ForegroundColor Gray
Write-Host "To build for production:" -ForegroundColor Gray
Write-Host "  cd mobile" -ForegroundColor Cyan
Write-Host "  eas build --platform android --profile production" -ForegroundColor Cyan
Write-Host "  eas submit --platform android --latest" -ForegroundColor Cyan
Write-Host ""

# Step 7: Post-Deployment Verification
Write-Host "✅ Step 7: Post-Deployment Verification" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Gray

if ($DryRun) {
    Write-Host "🔍 DRY RUN: Would verify deployments" -ForegroundColor Cyan
} else {
    Write-Host "Waiting 30 seconds for deployments to stabilize..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
    
    # Check backend health
    Write-Host "Checking backend health..." -ForegroundColor Gray
    try {
        $response = Invoke-RestMethod -Uri "https://taxbridge-api-ker8.onrender.com/health/live" -Method Get -TimeoutSec 10
        if ($response.status -eq "ok") {
            Write-Host "✓ Backend is healthy" -ForegroundColor Gray
        } else {
            Write-Host "⚠️  Backend health check returned unexpected status" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Backend health check failed: $_" -ForegroundColor Red
    }
    
    # Check admin dashboard
    Write-Host "Checking admin dashboard..." -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "https://taxbridge.vercel.app" -Method Head -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Admin dashboard is accessible" -ForegroundColor Gray
        }
    } catch {
        Write-Host "⚠️  Admin dashboard check failed: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "=======================" -ForegroundColor Green
Write-Host ""
Write-Host "Production URLs:" -ForegroundColor Cyan
Write-Host "  Backend API:      https://taxbridge-api-ker8.onrender.com" -ForegroundColor White
Write-Host "  Admin Dashboard:  https://taxbridge.vercel.app" -ForegroundColor White
Write-Host "  API Docs:         https://taxbridge-api-ker8.onrender.com/docs" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Monitor Render dashboard for backend deployment status" -ForegroundColor White
Write-Host "  2. Run smoke tests: .\scripts\7-Post-Deployment-Smoke-Tests.ps1" -ForegroundColor White
Write-Host "  3. Monitor Sentry for errors" -ForegroundColor White
Write-Host "  4. Review production metrics at /metrics endpoint" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "ℹ️  This was a DRY RUN - no actual deployments were made" -ForegroundColor Cyan
}
