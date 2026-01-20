#!/usr/bin/env pwsh
<#
.SYNOPSIS
    TaxBridge F3 Staging Deployment Status Tracker

.DESCRIPTION
    Run this script at any point during F3 deployment to check status
    and get the next action to take.

.EXAMPLE
    .\backend\scripts\staging-deploy-status.ps1
    .\backend\scripts\staging-deploy-status.ps1 -BaseUrl https://taxbridge-api-staging.onrender.com
#>

param(
    [string]$BaseUrl = "",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

Write-Host "`n╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       TaxBridge F3 Staging Deployment - Status Check              ║" -ForegroundColor Cyan
Write-Host "║                     $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Check 1: Local Build
Write-Host "`n📦 Step 1: Local Build Status" -ForegroundColor Yellow
$distPath = "backend/dist"
if (Test-Path $distPath) {
    $distFiles = Get-ChildItem -Path $distPath -Recurse -File | Measure-Object
    Write-Host "  ✅ Build output exists ($($distFiles.Count) files)" -ForegroundColor Green
} else {
    Write-Host "  ⏳ Build not found. Run: yarn workspace @taxbridge/backend build" -ForegroundColor Yellow
}

# Check 2: Secrets Generated
Write-Host "`n🔐 Step 2: Secrets Generation" -ForegroundColor Yellow
Write-Host "  ℹ️  Secrets should be generated and saved securely." -ForegroundColor Cyan
Write-Host "  ℹ️  Run: node backend/scripts/generate-secrets.js" -ForegroundColor Cyan

# Check 3: Render Deployment
Write-Host "`n🚀 Step 3: Render Deployment" -ForegroundColor Yellow
if ($BaseUrl) {
    Write-Host "  Checking: $BaseUrl/health/live ..." -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/health/live" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ API is LIVE ($($response.StatusCode))" -ForegroundColor Green
            $healthData = $response.Content | ConvertFrom-Json
            Write-Host "    Status: $($healthData.status)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ⏳ API not reachable yet: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⏳ No BaseUrl provided. Deploy via Render Dashboard first." -ForegroundColor Yellow
    Write-Host "  ℹ️  Re-run with: .\staging-deploy-status.ps1 -BaseUrl https://your-staging-url" -ForegroundColor Cyan
}

# Check 4: Database Connection
Write-Host "`n💾 Step 4: Database Status" -ForegroundColor Yellow
if ($BaseUrl) {
    try {
        $dbResponse = Invoke-WebRequest -Uri "$BaseUrl/health/db" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        if ($dbResponse.StatusCode -eq 200) {
            Write-Host "  ✅ Database is connected" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⏳ Database check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⏳ Cannot check - API not deployed yet" -ForegroundColor Yellow
}

# Check 5: Redis/Queues
Write-Host "`n📊 Step 5: Redis/Queue Status" -ForegroundColor Yellow
if ($BaseUrl) {
    try {
        $queueResponse = Invoke-WebRequest -Uri "$BaseUrl/health/queues" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        if ($queueResponse.StatusCode -eq 200) {
            Write-Host "  ✅ Queues are connected" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⏳ Queue check failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⏳ Cannot check - API not deployed yet" -ForegroundColor Yellow
}

# Check 6: Integration Health
Write-Host "`n🔗 Step 6: Integration Health (Mock Mode)" -ForegroundColor Yellow
if ($BaseUrl) {
    $integrations = @("digitax", "remita")
    foreach ($int in $integrations) {
        try {
            $intResponse = Invoke-WebRequest -Uri "$BaseUrl/health/$int" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
            if ($intResponse.StatusCode -eq 200) {
                Write-Host "  ✅ $int is healthy (mock mode)" -ForegroundColor Green
            }
        } catch {
            Write-Host "  ⚠️  $int check: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ⏳ Cannot check - API not deployed yet" -ForegroundColor Yellow
}

# Summary
Write-Host "`n════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📋 NEXT ACTIONS:" -ForegroundColor Yellow

if (-not (Test-Path $distPath)) {
    Write-Host "  1. Run: yarn workspace @taxbridge/backend build" -ForegroundColor White
}

if (-not $BaseUrl) {
    Write-Host @"

  DEPLOYMENT STEPS:
  ─────────────────
  1. Create Supabase staging database at https://supabase.com/dashboard
     - Name: taxbridge-staging
     - Region: US West (Oregon)
     - Copy pooler connection string (port 6543)

  2. Go to https://dashboard.render.com/blueprints
     - Click "New Blueprint Instance"
     - Select repository: Scardubu/taxbridge
     - Select file: render.staging.yaml
     - Configure secrets (DATABASE_URL, JWT_*, etc.)
     - Deploy

  3. After deployment, run migrations in Render Shell:
     yarn workspace @taxbridge/backend prisma:migrate:deploy

  4. Validate health:
     .\staging-deploy-status.ps1 -BaseUrl https://taxbridge-api-staging.onrender.com

"@ -ForegroundColor Cyan
} else {
    Write-Host "  ✅ Run full health validation:" -ForegroundColor Green
    Write-Host "     yarn workspace @taxbridge/backend validate:health $BaseUrl" -ForegroundColor White
}

Write-Host "`n════════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
