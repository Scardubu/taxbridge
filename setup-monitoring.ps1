#!/usr/bin/env pwsh
# TaxBridge Production Monitoring Setup
# Phase F6 - Monitoring and Health Check Configuration

$ErrorActionPreference = "Stop"

Write-Host "📊 TaxBridge Production Monitoring Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Production endpoints
$backendUrl = "https://taxbridge-api-ker8.onrender.com"
$adminUrl = "https://taxbridge-admin.vercel.app"  # Replace with actual URL after deployment

# Health check endpoints
$healthEndpoints = @(
    @{ Name = "Live"; Url = "$backendUrl/health/live"; Critical = $true },
    @{ Name = "Ready"; Url = "$backendUrl/health/ready"; Critical = $true },
    @{ Name = "Database"; Url = "$backendUrl/health/db"; Critical = $true },
    @{ Name = "Queues"; Url = "$backendUrl/health/queues"; Critical = $true },
    @{ Name = "DigiTax (Mock)"; Url = "$backendUrl/health/digitax"; Critical = $false },
    @{ Name = "Remita (Mock)"; Url = "$backendUrl/health/remita"; Critical = $false }
)

Write-Host "🔍 Testing Production Health Endpoints..." -ForegroundColor Yellow
Write-Host ""

$allHealthy = $true
$results = @()

foreach ($endpoint in $healthEndpoints) {
    Write-Host "Testing: $($endpoint.Name)..." -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $endpoint.Url -Method GET -TimeoutSec 10 -UseBasicParsing
        
        if ($response.StatusCode -eq 200) {
            Write-Host " ✅ HEALTHY" -ForegroundColor Green
            $results += @{
                Name = $endpoint.Name
                Status = "Healthy"
                StatusCode = $response.StatusCode
                Critical = $endpoint.Critical
            }
        } else {
            Write-Host " ⚠️ DEGRADED (Status: $($response.StatusCode))" -ForegroundColor Yellow
            if ($endpoint.Critical) {
                $allHealthy = $false
            }
            $results += @{
                Name = $endpoint.Name
                Status = "Degraded"
                StatusCode = $response.StatusCode
                Critical = $endpoint.Critical
            }
        }
    } catch {
        Write-Host " ❌ FAILED" -ForegroundColor Red
        if ($endpoint.Critical) {
            $allHealthy = $false
        }
        $results += @{
            Name = $endpoint.Name
            Status = "Failed"
            Error = $_.Exception.Message
            Critical = $endpoint.Critical
        }
    }
}

Write-Host ""
Write-Host "📊 Health Check Summary:" -ForegroundColor Cyan
Write-Host ""

foreach ($result in $results) {
    $icon = if ($result.Status -eq "Healthy") { "✅" } elseif ($result.Status -eq "Degraded") { "⚠️" } else { "❌" }
    $critical = if ($result.Critical) { "[CRITICAL]" } else { "[NON-CRITICAL]" }
    
    Write-Host "$icon $($result.Name) - $($result.Status) $critical" -ForegroundColor $(
        if ($result.Status -eq "Healthy") { "Green" }
        elseif ($result.Status -eq "Degraded") { "Yellow" }
        else { "Red" }
    )
    
    if ($result.StatusCode) {
        Write-Host "   Status Code: $($result.StatusCode)" -ForegroundColor Gray
    }
    if ($result.Error) {
        Write-Host "   Error: $($result.Error)" -ForegroundColor Gray
    }
}

Write-Host ""

if ($allHealthy) {
    Write-Host "✅ All critical health checks passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Some critical health checks failed!" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Monitoring Setup Recommendations:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. UptimeRobot Configuration:" -ForegroundColor Yellow
Write-Host "   - Monitor: $backendUrl/health/ready (HTTP, 5min interval)" -ForegroundColor Gray
Write-Host "   - Monitor: $backendUrl/health/db (HTTP, 5min interval)" -ForegroundColor Gray
Write-Host "   - Monitor: $adminUrl (HTTP, 5min interval)" -ForegroundColor Gray
Write-Host "   - Alert: Email + SMS on downtime" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Render Dashboard Monitoring:" -ForegroundColor Yellow
Write-Host "   - Enable auto-deploy from main branch" -ForegroundColor Gray
Write-Host "   - Set up deploy notifications" -ForegroundColor Gray
Write-Host "   - Monitor resource usage (CPU, Memory)" -ForegroundColor Gray
Write-Host "   - Review logs daily" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Scheduled Health Checks (PowerShell):" -ForegroundColor Yellow
Write-Host "   - Run this script daily via Task Scheduler" -ForegroundColor Gray
Write-Host "   - Log results to monitoring.log" -ForegroundColor Gray
Write-Host "   - Alert on 3+ consecutive failures" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Optional: Sentry Integration:" -ForegroundColor Yellow
Write-Host "   - Backend error tracking" -ForegroundColor Gray
Write-Host "   - Admin dashboard error tracking" -ForegroundColor Gray
Write-Host "   - Mobile app crash reporting" -ForegroundColor Gray
Write-Host ""

# Generate monitoring log
$logEntry = @"
========================================
TaxBridge Production Health Check
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
========================================

"@

foreach ($result in $results) {
    $logEntry += "$($result.Name): $($result.Status)"
    if ($result.StatusCode) {
        $logEntry += " (HTTP $($result.StatusCode))"
    }
    if ($result.Error) {
        $logEntry += " - Error: $($result.Error)"
    }
    $logEntry += "`n"
}

$logEntry += "`nOverall Status: $(if ($allHealthy) { 'HEALTHY' } else { 'DEGRADED' })`n`n"

# Append to log file
$logEntry | Out-File -FilePath "monitoring.log" -Append -Encoding UTF8

Write-Host "📝 Health check logged to: monitoring.log" -ForegroundColor Cyan
Write-Host ""

# Create Task Scheduler command
Write-Host "📅 To schedule daily monitoring, run:" -ForegroundColor Yellow
Write-Host '   $action = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument "-File `"' + $PSScriptRoot + '\setup-monitoring.ps1`""' -ForegroundColor Gray
Write-Host '   $trigger = New-ScheduledTaskTrigger -Daily -At 9am' -ForegroundColor Gray
Write-Host '   Register-ScheduledTask -TaskName "TaxBridge Health Check" -Action $action -Trigger $trigger' -ForegroundColor Gray
Write-Host ""

if (-not $allHealthy) {
    exit 1
}
