# Stage 1: Monitoring Checklist & Metrics Dashboard

**Date:** January 20, 2026  
**Status:** 📊 **MONITORING ACTIVE**  
**Duration:** 7 Days (January 20-27, 2026)  
**Target:** 100 Beta Testers

---

## 🎯 Monitoring Objectives

**Primary Goals:**
1. Ensure **99% crash-free sessions**
2. Validate **offline-first sync** reliability
3. Verify **backend infrastructure** stability
4. Identify **UX friction points**
5. Collect **actionable feedback** for Stage 2

**Success Criteria:** All metrics green for 3 consecutive days before Stage 2

---

## 📊 Daily Metrics Dashboard

### Critical Metrics (Check 2x Daily: 9 AM & 5 PM WAT)

| Metric | Target | Source | Alert Threshold |
|--------|--------|--------|-----------------|
| **Crash-Free Rate** | ≥99% | Play Console | <99% |
| **ANR Rate** | <0.5% | Play Console | ≥0.5% |
| **Backend Health** | 6/6 green | Render | <6/6 |
| **Sync Success** | ≥99% | Backend logs | <99% |
| **API P95 Latency** | <400ms | Render metrics | ≥400ms |
| **Error Rate** | <1% | Backend logs | ≥1% |
| **Active Testers** | ≥70 DAU | Play Console | <70 |

### Secondary Metrics (Check Daily: 9 AM WAT)

| Metric | Target | Source | Notes |
|--------|--------|--------|-------|
| **Installation Rate** | ≥80% | Play Console | Invitees who installed |
| **Uninstall Rate** | <10% | Play Console | Early churn indicator |
| **Session Duration** | ≥5 min | Play Console | Engagement proxy |
| **Invoice Creation** | ≥10/day | Backend analytics | Feature usage |
| **Receipt Scans** | ≥5/day | Backend analytics | OCR validation |
| **Feedback Submissions** | ≥3/day | Backend + email | User engagement |
| **Support Tickets** | <5 open | Manual tracking | Support load |

---

## 🔍 Monitoring Tools & Access

### 1. Google Play Console

**URL:** https://play.google.com/console  
**Navigation:** TaxBridge → Internal testing → Statistics

**Daily Checks:**

#### **Statistics Tab**
- Installations (total & daily)
- Crashes (count & trend)
- ANRs (count & trend)
- Active devices

#### **Release Tab**
- Rollout status
- Tester feedback
- Bug reports

#### **Quality → Android Vitals**
- Crash rate by Android version
- ANR rate by device model
- Battery usage patterns
- Slow rendering frames

**Screenshot Schedule:**
- Take daily screenshot of "Statistics" overview
- Save as: `playstore-metrics-YYYY-MM-DD.png`

---

### 2. Render Dashboard

**URL:** https://dashboard.render.com/web/srv-d62gsicr85hc73a34nc0  
**Services to Monitor:**
- `taxbridge-api` (Web Service)
- `taxbridge-worker` (Background Worker)
- `taxbridge-redis` (Redis Cache)

**Daily Checks:**

#### **Events Tab (Each Service)**
- Deployment events
- Crashes / restarts
- Health check failures
- Memory/CPU alerts

#### **Metrics Tab (taxbridge-api)**
- CPU usage (target: <70%)
- Memory usage (target: <80%)
- HTTP response time (P95: <400ms)
- HTTP status codes (5xx errors: <1%)

#### **Logs Tab (taxbridge-api)**
- Filter: `level:error` (should be <10/day)
- Filter: `component:sync` (check for sync failures)
- Filter: `digitax` or `remita` (mock mode confirmations)

**Daily Command (PowerShell):**

```powershell
# Run at 9 AM and 5 PM WAT
$PROD_URL = "https://taxbridge-api-ker8.onrender.com"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "`n=== TaxBridge Health Check: $timestamp ===" -ForegroundColor Cyan

$checks = @("live", "ready", "db", "queues", "digitax", "remita")
$results = @{}

foreach ($check in $checks) {
    try {
        $response = Invoke-RestMethod -Uri "$PROD_URL/health/$check" -TimeoutSec 5
        if ($response.status -in @("ok", "healthy")) {
            Write-Host "✅ /health/$check" -ForegroundColor Green
            $results[$check] = "PASS"
        } else {
            Write-Host "⚠️  /health/$check — Degraded" -ForegroundColor Yellow
            $results[$check] = "WARN"
        }
    } catch {
        Write-Host "❌ /health/$check — FAILED" -ForegroundColor Red
        $results[$check] = "FAIL"
    }
}

# Summary
$passed = ($results.Values | Where-Object { $_ -eq "PASS" }).Count
Write-Host "`n📊 Summary: $passed/6 health checks passing" -ForegroundColor $(if ($passed -eq 6) { "Green" } else { "Red" })

# Alert if any failures
if ($passed -lt 6) {
    Write-Host "🚨 ALERT: Health check failures detected — investigate immediately" -ForegroundColor Red
}
```

**Save output to log:**
```powershell
# Append to daily log file
$logFile = "c:\Users\USR\Documents\taxbridge\monitoring\health-checks-$(Get-Date -Format 'yyyy-MM-dd').log"
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null
"[$timestamp] Health Check: $passed/6 passing" | Out-File -Append $logFile
```

---

### 3. Supabase Dashboard

**URL:** https://supabase.com/dashboard  
**Project:** taxbridge-production

**Daily Checks:**

#### **Database Tab**
- Connection pool usage (target: <80%)
- Active queries (should be low, <10)
- Slow queries (>1s should be investigated)

#### **Storage Tab**
- Disk usage (free tier: 500 MB)
- Growth rate (estimate remaining time)

#### **Logs Tab**
- Filter: `error` (should be minimal)
- Check for authentication errors
- Check for migration errors

**Weekly Database Backup:**
```powershell
# Run every Sunday at 11 PM
$dbUrl = $env:DATABASE_URL  # Set from F6_DEPLOYMENT_EXECUTION_LOG.md
$backupFile = "taxbridge-backup-$(Get-Date -Format 'yyyy-MM-dd').sql"

# Using pg_dump (requires PostgreSQL client)
pg_dump $dbUrl > "c:\Users\USR\Documents\taxbridge\backups\$backupFile"

Write-Host "✅ Database backup saved: $backupFile" -ForegroundColor Green
```

---

### 4. Backend Analytics (Custom)

**Data Source:** Backend database queries

**Daily KPIs:**

```sql
-- Run in Supabase SQL Editor (or via psql)

-- 1. Total users registered
SELECT COUNT(*) as total_users, 
       COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '1 day' THEN 1 END) as new_today
FROM "User";

-- 2. Total invoices created
SELECT COUNT(*) as total_invoices,
       COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '1 day' THEN 1 END) as created_today
FROM "Invoice";

-- 3. Sync success rate (last 24h)
SELECT 
    COUNT(*) as total_syncs,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
    ROUND(100.0 * COUNT(CASE WHEN status = 'success' THEN 1 END) / COUNT(*), 2) as success_rate
FROM "SyncLog"
WHERE "createdAt" >= NOW() - INTERVAL '1 day';

-- 4. Active users (last 24h)
SELECT COUNT(DISTINCT "userId") as active_users_24h
FROM "Session"
WHERE "lastActivityAt" >= NOW() - INTERVAL '1 day';

-- 5. Error rate (last 24h)
SELECT 
    COUNT(*) as total_requests,
    COUNT(CASE WHEN "statusCode" >= 500 THEN 1 END) as server_errors,
    ROUND(100.0 * COUNT(CASE WHEN "statusCode" >= 500 THEN 1 END) / COUNT(*), 2) as error_rate
FROM "RequestLog"
WHERE "createdAt" >= NOW() - INTERVAL '1 day';

-- 6. Top errors (last 24h)
SELECT 
    "errorType",
    "errorMessage",
    COUNT(*) as occurrences
FROM "ErrorLog"
WHERE "createdAt" >= NOW() - INTERVAL '1 day'
GROUP BY "errorType", "errorMessage"
ORDER BY occurrences DESC
LIMIT 10;
```

**Save results to CSV:**
```powershell
# Export metrics daily
$date = Get-Date -Format "yyyy-MM-dd"
$metricsFile = "c:\Users\USR\Documents\taxbridge\monitoring\metrics-$date.csv"

# Run SQL queries and export (pseudo-code — adapt to your setup)
# psql $DATABASE_URL -c "SELECT ..." -o $metricsFile --csv
```

---

## 📋 Daily Monitoring Checklist

**Copy this checklist each day of Stage 1:**

### Morning Standup (9:00 AM WAT)

**Date:** _______________  
**Day:** ___ of 7

#### Critical Health Checks
- [ ] Play Console: Crash-free rate ≥99% (current: ____%)
- [ ] Play Console: ANR rate <0.5% (current: ____%)
- [ ] Render: All 6 health endpoints green (current: __/6)
- [ ] Render: No deployment failures in last 24h
- [ ] Supabase: Database responding (latency: ____ms)

#### User Metrics
- [ ] Active testers ≥70 (current: ____)
- [ ] New registrations ≥5 (current: ____)
- [ ] Invoices created ≥10 (current: ____)
- [ ] Receipt scans ≥5 (current: ____)
- [ ] Uninstall rate <10% (current: ____%)

#### Support & Feedback
- [ ] Triage new bug reports (count: ____)
- [ ] Respond to tester emails (<4h SLA)
- [ ] Update bug tracking board
- [ ] Close resolved tickets

#### Action Items from Yesterday
- [ ] ___________________________________
- [ ] ___________________________________
- [ ] ___________________________________

#### Today's Focus
- [ ] ___________________________________
- [ ] ___________________________________
- [ ] ___________________________________

---

### Evening Review (5:00 PM WAT)

#### Re-Check Critical Metrics
- [ ] Crash-free rate still ≥99%
- [ ] No new ANR reports
- [ ] Backend health still 6/6 green
- [ ] No spike in error logs

#### Issues Identified Today
- [ ] P0 (Critical): ___________________________________
- [ ] P1 (High): ___________________________________
- [ ] P2 (Medium): ___________________________________
- [ ] P3 (Low): ___________________________________

#### Tomorrow's Priorities
1. ___________________________________
2. ___________________________________
3. ___________________________________

---

## 🚨 Alert Triggers & Response

### P0 — Critical (Immediate Action Required)

| Alert | Threshold | Response Time | Action |
|-------|-----------|---------------|--------|
| **Crash rate >1%** | Crashes affecting >1 tester | <1 hour | Deploy hotfix (see STAGE_1_PLAYSTORE_UPLOAD_GUIDE.md) |
| **Backend down** | 0/6 health checks | <15 minutes | Check Render, restart services if needed |
| **Database unreachable** | Connection timeout | <30 minutes | Check Supabase status, verify credentials |
| **Data loss reported** | User cannot access data | <1 hour | Check sync logs, restore from backup if needed |

**P0 Response Protocol:**

1. **Alert:** Automated monitoring detects failure
2. **Triage:** Verify issue (not false positive)
3. **Escalate:** Notify team lead immediately
4. **Investigate:** Review logs, identify root cause
5. **Fix:** Deploy hotfix or emergency rollback
6. **Verify:** Confirm issue resolved
7. **Communicate:** Update testers if user-facing
8. **Document:** Post-mortem within 24 hours

---

### P1 — High (Action Within 4 Hours)

| Alert | Threshold | Response Time | Action |
|-------|-----------|---------------|--------|
| **Crash rate 0.5-1%** | Isolated crashes | <4 hours | Investigate, plan fix |
| **Sync failures >5%** | Sync errors spiking | <4 hours | Check queue health, Redis connection |
| **API latency >400ms** | P95 latency spike | <4 hours | Optimize queries, check Render CPU |
| **Support backlog >5** | Unanswered tickets | <4 hours | Triage and respond |

---

### P2 — Medium (Action Within 24 Hours)

| Alert | Threshold | Response Time | Action |
|-------|-----------|---------------|--------|
| **Active testers <70** | Low engagement | <24 hours | Send re-engagement email |
| **Installation rate <80%** | Low opt-in conversion | <24 hours | Simplify invitation process |
| **Session duration <5min** | Low engagement | <24 hours | Investigate UX issues |
| **Feature usage <expected** | Low adoption | <24 hours | Improve onboarding |

---

## 📊 Weekly Reporting Template

**Copy this template every Sunday evening:**

---

### TaxBridge Stage 1 — Week 1 Report

**Report Date:** January 27, 2026  
**Reporting Period:** January 20-27, 2026  
**Testers:** 100 (Internal)

#### Executive Summary

**Overall Health:** 🟢 Green / 🟡 Yellow / 🔴 Red

**Key Highlights:**
- ___________________________________
- ___________________________________
- ___________________________________

**Major Issues:**
- ___________________________________
- ___________________________________

**Go/No-Go Recommendation:** ✅ Proceed to Stage 2 / ⏸️ Extend Stage 1

---

#### Metrics Summary

| Metric | Target | Actual | Status | Trend |
|--------|--------|--------|--------|-------|
| **Crash-Free Rate** | ≥99% | ____% | 🟢/🟡/🔴 | ↑/→/↓ |
| **ANR Rate** | <0.5% | ____% | 🟢/🟡/🔴 | ↑/→/↓ |
| **Backend Uptime** | ≥99.5% | ____% | 🟢/🟡/🔴 | ↑/→/↓ |
| **Sync Success** | ≥99% | ____% | 🟢/🟡/🔴 | ↑/→/↓ |
| **API P95 Latency** | <400ms | ____ms | 🟢/🟡/🔴 | ↑/→/↓ |
| **Error Rate** | <1% | ____% | 🟢/🟡/🔴 | ↑/→/↓ |
| **Active Testers** | ≥70 | ____ | 🟢/🟡/🔴 | ↑/→/↓ |
| **Installation Rate** | ≥80% | ____% | 🟢/🟡/🔴 | ↑/→/↓ |
| **Uninstall Rate** | <10% | ____% | 🟢/🟡/🔴 | ↑/→/↓ |

---

#### User Engagement

- **Total Users Registered:** ____
- **Daily Active Users (Avg):** ____
- **Invoices Created:** ____
- **Receipts Scanned:** ____
- **Average Session Duration:** ____ minutes
- **Feature Adoption:**
  - Invoice creation: ____%
  - Receipt scanning: ____%
  - Payment tracking: ____%
  - Offline sync: ____%

---

#### Issues & Resolutions

**P0 — Critical (0 open)**
- [None / List issues]

**P1 — High (__ open)**
- Issue: ___________________________________
  - Status: Open / In Progress / Resolved
  - ETA: ___________________________________

**P2 — Medium (__ open)**
- [List top 3]

**P3 — Low (__ open)**
- [Backlog count]

---

#### Feedback Themes

**Top 3 Positive:**
1. ___________________________________
2. ___________________________________
3. ___________________________________

**Top 3 Improvement Areas:**
1. ___________________________________
2. ___________________________________
3. ___________________________________

**Top 3 Feature Requests:**
1. ___________________________________
2. ___________________________________
3. ___________________________________

---

#### Infrastructure Performance

**Backend:**
- Uptime: ____%
- Total Requests: ____
- Avg Response Time: ____ms
- Error Count: ____
- Peak Concurrency: ____ req/s

**Database:**
- Query Performance: P95 = ____ms
- Connection Pool Utilization: ____%
- Slow Queries (>1s): ____
- Disk Usage: ____% (____MB used)

**Redis:**
- Hit Rate: ____%
- Memory Usage: ____MB
- Commands/sec: ____

---

#### Next Week Priorities

1. ___________________________________
2. ___________________________________
3. ___________________________________

---

#### Go/No-Go Decision Criteria

**Pass Criteria:** All must be ✅

- [ ] Crash-free rate ≥99% for 3 consecutive days
- [ ] ANR rate <0.5% for 3 consecutive days
- [ ] Backend uptime ≥99.5% for 7 days
- [ ] Sync success ≥99% for 3 consecutive days
- [ ] 0 open P0 bugs
- [ ] <3 open P1 bugs
- [ ] Active testers ≥70 DAU average
- [ ] Tester satisfaction ≥4.0/5.0
- [ ] Team confidence: High

**Decision:** ___________________________________

**Signed Off By:**
- Product Lead: ___________________________________
- Engineering Lead: ___________________________________
- QA Lead: ___________________________________

**Date:** ___________________________________

---

## 🛠️ Monitoring Tools Setup

### PowerShell Monitoring Script

**Save as:** `c:\Users\USR\Documents\taxbridge\monitoring\health-monitor.ps1`

```powershell
# TaxBridge Stage 1 Health Monitor
# Run every 6 hours or manually

param(
    [switch]$Verbose
)

$PROD_URL = "https://taxbridge-api-ker8.onrender.com"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logDir = "c:\Users\USR\Documents\taxbridge\monitoring"
$logFile = Join-Path $logDir "health-checks-$(Get-Date -Format 'yyyy-MM-dd').log"

# Ensure log directory exists
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Write-Host "`n=== TaxBridge Production Health Check ===" -ForegroundColor Cyan
Write-Host "Timestamp: $timestamp" -ForegroundColor Gray
Write-Host "Target: $PROD_URL`n" -ForegroundColor Gray

$checks = @(
    @{ Name = "live"; Description = "Liveness Probe" },
    @{ Name = "ready"; Description = "Readiness Probe" },
    @{ Name = "db"; Description = "Database" },
    @{ Name = "queues"; Description = "Job Queues" },
    @{ Name = "digitax"; Description = "DigiTax Integration" },
    @{ Name = "remita"; Description = "Remita Integration" }
)

$results = @()

foreach ($check in $checks) {
    $endpoint = "/health/$($check.Name)"
    try {
        $response = Invoke-RestMethod -Uri "$PROD_URL$endpoint" -TimeoutSec 10 -ErrorAction Stop
        
        $status = $response.status
        $passed = $status -in @("ok", "healthy")
        
        if ($passed) {
            Write-Host "✅ $($check.Description)" -ForegroundColor Green
            $result = "PASS"
        } else {
            Write-Host "⚠️  $($check.Description) — Status: $status" -ForegroundColor Yellow
            $result = "WARN"
        }
        
        if ($Verbose) {
            Write-Host "   Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "❌ $($check.Description) — FAILED" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        $result = "FAIL"
    }
    
    $results += @{
        Endpoint = $check.Name
        Description = $check.Description
        Result = $result
        Timestamp = $timestamp
    }
}

# Summary
$passed = ($results | Where-Object { $_.Result -eq "PASS" }).Count
$total = $results.Count

Write-Host "`n📊 Summary: $passed/$total health checks passing" -ForegroundColor $(
    if ($passed -eq $total) { "Green" } 
    elseif ($passed -ge $total * 0.8) { "Yellow" }
    else { "Red" }
)

# Alert if failures
if ($passed -lt $total) {
    Write-Host "🚨 ALERT: Health check failures detected" -ForegroundColor Red
    Write-Host "   Failed checks: $(($results | Where-Object { $_.Result -ne 'PASS' } | ForEach-Object { $_.Description }) -join ', ')" -ForegroundColor Red
}

# Log results
$logEntry = "[$timestamp] Health Check: $passed/$total passing"
$logEntry | Out-File -Append $logFile
foreach ($result in $results) {
    "  - $($result.Endpoint): $($result.Result)" | Out-File -Append $logFile
}

Write-Host "`n📄 Log saved: $logFile" -ForegroundColor Gray
```

**Run manually:**
```powershell
.\monitoring\health-monitor.ps1 -Verbose
```

**Schedule with Task Scheduler (Optional):**
```powershell
# Create scheduled task (run every 6 hours)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-File c:\Users\USR\Documents\taxbridge\monitoring\health-monitor.ps1"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 6)

Register-ScheduledTask -TaskName "TaxBridge Health Monitor" `
    -Action $action -Trigger $trigger -Description "Monitor TaxBridge production health"
```

---

## 📧 Automated Alerts (Optional)

### Email Alert on Failure

**Add to health-monitor.ps1:**

```powershell
# After summary section
if ($passed -lt $total) {
    # Send email alert
    $emailParams = @{
        From = "alerts@taxbridge.ng"
        To = "team@taxbridge.ng"
        Subject = "🚨 TaxBridge Production Health Alert"
        Body = @"
TaxBridge production health check FAILED at $timestamp.

Failed Checks: $passed/$total passing

Details:
$(($results | Where-Object { $_.Result -ne 'PASS' } | ForEach-Object { "  - $($_.Description): $($_.Result)" }) -join "`n")

Please investigate immediately.

Dashboard: https://dashboard.render.com/web/srv-d62gsicr85hc73a34nc0
"@
        SmtpServer = "smtp.example.com"  # Configure your SMTP server
        Port = 587
        UseSsl = $true
        Credential = (Get-Credential)  # Store securely
    }
    
    Send-MailMessage @emailParams
}
```

---

## ✅ Final Pre-Stage-2 Checklist

**Before proceeding to Stage 2 (1,000 users):**

### Technical Readiness
- [ ] 7 consecutive days with crash-free ≥99%
- [ ] 7 consecutive days with backend uptime ≥99.5%
- [ ] 0 open P0 bugs
- [ ] <3 open P1 bugs
- [ ] All Stage 1 fixes deployed and verified
- [ ] Database optimized (indexes, query performance)
- [ ] Render plan upgraded if needed (Starter → Pro)
- [ ] Monitoring dashboards finalized
- [ ] Error tracking (Sentry) enabled
- [ ] Backup strategy validated

### Product Readiness
- [ ] Tester feedback incorporated
- [ ] UX improvements implemented
- [ ] Onboarding flow refined
- [ ] Feature documentation updated
- [ ] FAQ updated with common questions
- [ ] Known limitations documented
- [ ] Release notes prepared for Stage 2

### Operational Readiness
- [ ] Support team trained
- [ ] Escalation procedures documented
- [ ] Hotfix process validated
- [ ] Rollback plan tested
- [ ] Team capacity planned for 10x users
- [ ] Communication plan for Stage 2 invites

### Compliance & Security
- [ ] DigiTax sandbox credentials obtained (if exiting mock mode)
- [ ] Remita sandbox credentials obtained (if exiting mock mode)
- [ ] Privacy policy reviewed
- [ ] Terms of service reviewed
- [ ] Data retention policy confirmed
- [ ] Security audit passed (if required)

---

**Last Updated:** January 20, 2026  
**Next Review:** Daily throughout Stage 1  
**Owner:** Engineering & Product Team
