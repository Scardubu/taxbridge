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

# Verify build exists
if (-not (Test-Path ".next")) {
    Write-Host "❌ Build not found. Running build first..." -ForegroundColor Red
    Write-Host ""
    
    $env:NEXT_PUBLIC_API_URL = "https://taxbridge-api.onrender.com"
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

# Set production environment variables
$env:VERCEL_ORG_ID = "your-org-id"  # Replace with actual org ID
$env:VERCEL_PROJECT_ID = "your-project-id"  # Replace with actual project ID

Write-Host "📋 Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  API URL: https://taxbridge-api.onrender.com" -ForegroundColor Gray
Write-Host "  Environment: production" -ForegroundColor Gray
Write-Host "  Build: Next.js 16.1.1 (Turbopack)" -ForegroundColor Gray
Write-Host "  Routes: 20 (15 static + 7 API)" -ForegroundColor Gray
Write-Host ""

Write-Host "🔑 Make sure these environment variables are set in Vercel:" -ForegroundColor Yellow
Write-Host "  NEXT_PUBLIC_API_URL=https://taxbridge-api.onrender.com" -ForegroundColor Gray
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
    Write-Host "📋 Post-Deployment Checklist:" -ForegroundColor Cyan
    Write-Host "  [ ] Verify dashboard loads at production URL" -ForegroundColor Gray
    Write-Host "  [ ] Test backend health integration" -ForegroundColor Gray
    Write-Host "  [ ] Verify all 20 routes are accessible" -ForegroundColor Gray
    Write-Host "  [ ] Test invoice management flows" -ForegroundColor Gray
    Write-Host "  [ ] Verify user authentication" -ForegroundColor Gray
    Write-Host "  [ ] Test analytics dashboard" -ForegroundColor Gray
    Write-Host "  [ ] Configure custom domain (if applicable)" -ForegroundColor Gray
    Write-Host "  [ ] Set up monitoring alerts" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}
