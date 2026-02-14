#!/usr/bin/env pwsh
# TaxBridge Admin Dashboard - Vercel Production Deployment
# Phase F5 - Admin Dashboard Deployment Automation

$ErrorActionPreference = "Stop"

Write-Host "🚀 TaxBridge Admin Dashboard - Vercel Deployment" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
Write-Host "🔍 Checking Vercel CLI..." -ForegroundColor Yellow
$vercelCheck = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelCheck) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Vercel CLI" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Vercel CLI ready" -ForegroundColor Green
Write-Host ""

# Navigate to admin dashboard directory
Set-Location $PSScriptRoot

# Preflight: check for uncommitted changes
Write-Host "🔍 Checking git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain 2>$null
if ($gitStatus) {
    Write-Host "⚠️  Uncommitted changes detected:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    $proceed = Read-Host "Deploy with uncommitted changes? (y/N)"
    if ($proceed -ne 'y') {
        Write-Host "Aborting. Commit changes first." -ForegroundColor Red
        exit 1
    }
}

# Verify build exists
if (-not (Test-Path ".next")) {
    Write-Host "❌ Build not found. Running build first..." -ForegroundColor Red
    Write-Host ""
    
    $env:NEXT_PUBLIC_API_URL = "https://taxbridge-api-ker8.onrender.com"
    $env:NEXT_PUBLIC_ENV = "production"
    
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Build directory found" -ForegroundColor Green
Write-Host ""

# Deploy to Vercel
Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Yellow
Write-Host ""

# Validate Vercel project linkage
if (-not (Test-Path ".vercel/project.json")) {
    Write-Host "⚠️  Vercel project not linked. Run 'vercel link' first." -ForegroundColor Yellow
    vercel link
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Vercel link failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "📋 Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  API URL: https://taxbridge-api-ker8.onrender.com" -ForegroundColor Gray
Write-Host "  Environment: production" -ForegroundColor Gray
Write-Host "  Build: Next.js 16.1.1 (Turbopack)" -ForegroundColor Gray
Write-Host "  Routes: 20 (15 static + 7 API)" -ForegroundColor Gray
Write-Host ""

Write-Host "🔑 Make sure these environment variables are set in Vercel:" -ForegroundColor Yellow
Write-Host "  NEXT_PUBLIC_API_URL=https://taxbridge-api-ker8.onrender.com" -ForegroundColor Gray
Write-Host "  NEXT_PUBLIC_ENV=production" -ForegroundColor Gray
Write-Host "  NODE_ENV=production" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to continue with deployment..."

# Deploy to production
vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Admin Dashboard Deployed Successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Post-deploy verification: check security headers
    Write-Host "🔍 Verifying security headers..." -ForegroundColor Yellow
    try {
        $adminUrl = "https://taxbridge.vercel.app"
        $response = Invoke-WebRequest -Uri $adminUrl -Method HEAD -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        $headers = $response.Headers
        $checks = @(
            @{ Name = 'X-Content-Type-Options'; Expected = 'nosniff' },
            @{ Name = 'X-Frame-Options'; Expected = 'DENY' },
            @{ Name = 'Strict-Transport-Security'; Expected = $null }
        )
        foreach ($check in $checks) {
            $val = $headers[$check.Name]
            if ($val) {
                Write-Host "  [PASS] $($check.Name): $val" -ForegroundColor Green
            } else {
                Write-Host "  [WARN] $($check.Name) not present" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "  ⚠️  Could not verify security headers: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    Write-Host ""
    
    Write-Host "📋 Post-Deployment Checklist:" -ForegroundColor Cyan
    Write-Host "  [ ] Verify dashboard loads at production URL" -ForegroundColor Gray
    Write-Host "  [ ] Test backend health integration" -ForegroundColor Gray
    Write-Host "  [ ] Verify all routes are accessible" -ForegroundColor Gray
    Write-Host "  [ ] Test invoice management flows" -ForegroundColor Gray
    Write-Host "  [ ] Verify user authentication" -ForegroundColor Gray
    Write-Host "  [ ] Run smoke tests: .\scripts\7-Post-Deployment-Smoke-Tests.ps1" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}
