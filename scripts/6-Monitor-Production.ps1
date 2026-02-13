# FILE: scripts/6-Monitor-Production.ps1
# PURPOSE: Real-time production monitoring dashboard

param(
    [int]$RefreshInterval = 30,
    [switch]$Continuous
)

$apiUrl = "https://taxbridge-api-ker8.onrender.com"
$adminUrl = "https://taxbridge.vercel.app"

function Get-HealthStatus {
    param([string]$Url)
    
    try {
        $response = Invoke-RestMethod -Uri "$Url/health" -TimeoutSec 10 -ErrorAction Stop
        return @{
            Status = "✓"
            Color = "Green"
            Data = $response
        }
    } catch {
        return @{
            Status = "✗"
            Color = "Red"
            Data = $null
            Error = $_.Exception.Message
        }
    }
}

function Show-Dashboard {
    Clear-Host
    
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  TaxBridge Production Monitoring Dashboard" -ForegroundColor Cyan
    Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    
    # Backend API Status
    Write-Host "`n🔧 Backend API Status" -ForegroundColor Yellow
    Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    $backendHealth = Get-HealthStatus -Url $apiUrl
    Write-Host "  Status: " -NoNewline
    Write-Host $backendHealth.Status -ForegroundColor $backendHealth.Color
    
    if ($backendHealth.Data) {
        $data = $backendHealth.Data
        if ($data.uptime) {
            Write-Host "  Uptime: $([math]::Round($data.uptime / 3600, 2)) hours" -ForegroundColor White
        }
        if ($data.version) {
            Write-Host "  Version: $($data.version)" -ForegroundColor White
        }
        if ($data.latency) {
            $dbLatency = $data.latency.database
            $redisLatency = $data.latency.redis
            $dbColor = if ($dbLatency -lt 100) { "Green" } elseif ($dbLatency -lt 500) { "Yellow" } else { "Red" }
            $redisColor = if ($redisLatency -lt 50) { "Green" } elseif ($redisLatency -lt 200) { "Yellow" } else { "Red" }
            Write-Host "  Database Latency: " -NoNewline
            Write-Host "${dbLatency}ms" -ForegroundColor $dbColor
            Write-Host "  Redis Latency: " -NoNewline
            Write-Host "${redisLatency}ms" -ForegroundColor $redisColor
        }
        if ($data.integrations) {
            Write-Host "`n  Integrations:" -ForegroundColor Cyan
            if ($data.integrations.digitax) {
                $dtStatus = $data.integrations.digitax.status
                $dtColor = if ($dtStatus -eq "healthy") { "Green" } else { "Yellow" }
                Write-Host "    DigiTax: " -NoNewline
                Write-Host $dtStatus -ForegroundColor $dtColor
            }
            if ($data.integrations.remita) {
                $rmStatus = $data.integrations.remita.status
                $rmColor = if ($rmStatus -eq "healthy") { "Green" } else { "Yellow" }
                Write-Host "    Remita: " -NoNewline
                Write-Host $rmStatus -ForegroundColor $rmColor
            }
        }
    } else {
        Write-Host "  Error: $($backendHealth.Error)" -ForegroundColor Red
    }
    
    # Admin Console Status
    Write-Host "`n🖥️  Admin Console Status" -ForegroundColor Yellow
    Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    try {
        $adminResponse = Invoke-WebRequest -Uri $adminUrl -TimeoutSec 10 -UseBasicParsing
        if ($adminResponse.StatusCode -eq 200) {
            Write-Host "  Status: ✓" -ForegroundColor Green
            Write-Host "  Response Code: 200 OK" -ForegroundColor White
        }
    } catch {
        Write-Host "  Status: ✗" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Quick Metrics
    Write-Host "`n📊 Quick Metrics" -ForegroundColor Yellow
    Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    try {
        $metricsData = Invoke-RestMethod -Uri "$apiUrl/metrics" -TimeoutSec 10 -ErrorAction Stop
        
        if ($metricsData.server) {
            Write-Host "  Requests: $($metricsData.server.requestCount)" -ForegroundColor White
            Write-Host "  Errors: $($metricsData.server.errorCount)" -ForegroundColor White
            Write-Host "  Error Rate: $($metricsData.server.errorRate)" -ForegroundColor White
        }
        if ($metricsData.memory) {
            $heapMB = [math]::Round($metricsData.memory.heapUsed / 1MB, 1)
            $rssMB = [math]::Round($metricsData.memory.rss / 1MB, 1)
            Write-Host "  Heap Used: ${heapMB}MB" -ForegroundColor White
            Write-Host "  RSS: ${rssMB}MB" -ForegroundColor White
        }
        if ($metricsData.componentStatus) {
            Write-Host "`n  Component Status:" -ForegroundColor Cyan
            foreach ($prop in $metricsData.componentStatus.PSObject.Properties) {
                $statusColor = if ($prop.Value -eq "healthy") { "Green" } elseif ($prop.Value -eq "degraded") { "Yellow" } else { "Red" }
                Write-Host "    $($prop.Name): " -NoNewline
                Write-Host $prop.Value -ForegroundColor $statusColor
            }
        }
    } catch {
        Write-Host "  Metrics unavailable" -ForegroundColor Yellow
    }
    
    # Footer
    Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    if ($Continuous) {
        Write-Host "  Auto-refresh in $RefreshInterval seconds... (Ctrl+C to exit)" -ForegroundColor Gray
    }
    Write-Host ""
}

# Main loop
if ($Continuous) {
    while ($true) {
        Show-Dashboard
        Start-Sleep -Seconds $RefreshInterval
    }
} else {
    Show-Dashboard
}
