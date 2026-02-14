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
            Status = "[OK]"
            Color = "Green"
            Data = $response
        }
    } catch {
        return @{
            Status = "[FAIL]"
            Color = "Red"
            Data = $null
            Error = $_.Exception.Message
        }
    }
}

function Get-DetailedHealth {
    param([string]$Url)
    
    try {
        $response = Invoke-RestMethod -Uri "$Url/health/detailed" -TimeoutSec 10 -ErrorAction Stop
        return $response
    } catch {
        return $null
    }
}

function Show-Dashboard {
    Clear-Host
    
    Write-Host "=============================================================" -ForegroundColor Cyan
    Write-Host "  TaxBridge Production Monitoring Dashboard" -ForegroundColor Cyan
    Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host "=============================================================" -ForegroundColor Cyan
    
    # Backend API Status
    Write-Host "`n[*] Backend API Status" -ForegroundColor Yellow
    Write-Host "-------------------------------------------------------------" -ForegroundColor Gray
    
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
        if ($data.environment) {
            Write-Host "  Environment: $($data.environment)" -ForegroundColor White
        }
        
        # Get detailed health information
        $detailedHealth = Get-DetailedHealth -Url $apiUrl
        if ($detailedHealth) {
            Write-Host "`n  Component Health:" -ForegroundColor Cyan
            
            # Database
            if ($detailedHealth.checks.database) {
                $dbStatus = $detailedHealth.checks.database.status
                $dbLatency = $detailedHealth.checks.database.responseTime
                $dbColor = if ($dbStatus -eq "healthy") { "Green" } elseif ($dbStatus -eq "degraded") { "Yellow" } else { "Red" }
                $latencyColor = if ($dbLatency -lt 100) { "Green" } elseif ($dbLatency -lt 500) { "Yellow" } else { "Red" }
                Write-Host "    Database: " -NoNewline
                Write-Host $dbStatus -ForegroundColor $dbColor -NoNewline
                Write-Host " (" -NoNewline -ForegroundColor Gray
                Write-Host "${dbLatency}ms" -NoNewline -ForegroundColor $latencyColor
                Write-Host ")" -ForegroundColor Gray
            }
            
            # Redis
            if ($detailedHealth.checks.redis) {
                $redisStatus = $detailedHealth.checks.redis.status
                $redisLatency = $detailedHealth.checks.redis.responseTime
                $redisColor = if ($redisStatus -eq "healthy") { "Green" } elseif ($redisStatus -eq "degraded") { "Yellow" } else { "Red" }
                $latencyColor = if ($redisLatency -lt 50) { "Green" } elseif ($redisLatency -lt 200) { "Yellow" } else { "Red" }
                Write-Host "    Redis: " -NoNewline
                Write-Host $redisStatus -ForegroundColor $redisColor -NoNewline
                Write-Host " (" -NoNewline -ForegroundColor Gray
                Write-Host "${redisLatency}ms" -NoNewline -ForegroundColor $latencyColor
                Write-Host ")" -ForegroundColor Gray
            }
            
            # System Metrics
            if ($detailedHealth.system) {
                Write-Host "`n  System Metrics:" -ForegroundColor Cyan
                
                # Memory
                if ($detailedHealth.system.memory) {
                    $memUsagePercent = [math]::Round($detailedHealth.system.memory.usagePercent, 1)
                    $memColor = if ($memUsagePercent -lt 70) { "Green" } elseif ($memUsagePercent -lt 85) { "Yellow" } else { "Red" }
                    Write-Host "    Memory Usage: " -NoNewline
                    Write-Host "$memUsagePercent%" -ForegroundColor $memColor
                    
                    $heapUsedMB = [math]::Round($detailedHealth.system.memory.heapUsed / 1MB, 1)
                    $heapTotalMB = [math]::Round($detailedHealth.system.memory.heapTotal / 1MB, 1)
                    Write-Host "    Heap: ${heapUsedMB}MB / ${heapTotalMB}MB" -ForegroundColor White
                }
                
                # CPU
                if ($detailedHealth.system.cpu) {
                    Write-Host "    CPU Cores: $($detailedHealth.system.cpu.cores)" -ForegroundColor White
                    if ($detailedHealth.system.cpu.loadAverage) {
                        $loadAvg = $detailedHealth.system.cpu.loadAverage -join ', '
                        Write-Host "    Load Average: $loadAvg" -ForegroundColor White
                    }
                }
            }
            
            # External APIs
            if ($detailedHealth.checks.externalApis) {
                Write-Host "`n  External API Connectivity:" -ForegroundColor Cyan
                
                foreach ($api in $detailedHealth.checks.externalApis.PSObject.Properties) {
                    $apiName = $api.Name
                    $apiData = $api.Value
                    $apiStatus = $apiData.status
                    $apiColor = if ($apiStatus -eq "healthy") { "Green" } elseif ($apiStatus -eq "degraded") { "Yellow" } else { "Red" }
                    
                    Write-Host "    ${apiName}: " -NoNewline
                    Write-Host $apiStatus -ForegroundColor $apiColor
                    
                    if ($apiData.latency) {
                        Write-Host "      Latency: $($apiData.latency)ms" -ForegroundColor Gray
                    }
                }
            }
        }
    } else {
        Write-Host "  Error: $($backendHealth.Error)" -ForegroundColor Red
    }
    
    # Admin Console Status
    Write-Host "`n[*] Admin Console Status" -ForegroundColor Yellow
    Write-Host "-------------------------------------------------------------" -ForegroundColor Gray
    
    try {
        $adminResponse = Invoke-WebRequest -Uri $adminUrl -TimeoutSec 10 -UseBasicParsing
        if ($adminResponse.StatusCode -eq 200) {
            Write-Host "  Status: [OK]" -ForegroundColor Green
            Write-Host "  Response Code: 200 OK" -ForegroundColor White
        }
    } catch {
        Write-Host "  Status: [FAIL]" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Quick Metrics
    Write-Host "`n[*] Quick Metrics" -ForegroundColor Yellow
    Write-Host "-------------------------------------------------------------" -ForegroundColor Gray
    
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
    Write-Host "`n=============================================================" -ForegroundColor Cyan
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
