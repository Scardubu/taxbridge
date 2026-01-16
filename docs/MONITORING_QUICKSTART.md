# TaxBridge Production Monitoring Quick Reference

**Version:** 5.0.2  
**Phase B Deliverable**

---

## Health & Metrics Endpoints

### 1. Basic Health Check

**Endpoint:** `GET /health`  
**Purpose:** Quick liveness check for load balancers  
**Response Time:** ~50ms  
**Authentication:** None required

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "5.0.2",
  "latency": {
    "database": 15,
    "redis": 3
  },
  "integrations": {
    "duplo": { "status": "healthy", "provider": "duplo", "timestamp": "..." },
    "remita": { "status": "healthy", "provider": "remita", "timestamp": "..." }
  },
  "ubl": {
    "status": "healthy",
    "missingFields": [],
    "xsdValid": true,
    "timestamp": "..."
  }
}
```

---

### 2. Detailed Health Check

**Endpoint:** `GET /health/detailed`  
**Purpose:** Comprehensive system health report  
**Response Time:** ~200ms  
**Authentication:** None required (consider adding auth in production)

```bash
curl http://localhost:3000/health/detailed
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "5.0.2",
  "metrics": {
    "timestamp": "...",
    "uptime": 3600
  },
  "issues": []
}
```

---

### 3. Readiness Check

**Endpoint:** `GET /ready`  
**Purpose:** Kubernetes readiness probe  
**Response Time:** ~30ms  
**Authentication:** None required

```bash
curl http://localhost:3000/ready
```

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2026-01-15T10:30:00.000Z"
}
```

**Use in Kubernetes:**
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

---

### 4. Production Metrics (NEW in Phase B)

**Endpoint:** `GET /metrics`  
**Purpose:** Connection pool health, DLQ status, server metrics  
**Response Time:** ~100ms  
**Authentication:** ⚠️ Add auth before production deployment

```bash
curl http://localhost:3000/metrics
```

**Response:**
```json
{
  "timestamp": "2026-01-15T10:30:00.000Z",
  "uptime": 3600,
  "server": {
    "requestCount": 15234,
    "errorCount": 42,
    "errorRate": "0.28%"
  },
  "connectionPools": {
    "postgres": {
      "activeConnections": 3,
      "idleConnections": 7,
      "maxConnections": 10,
      "utilizationPercent": 30,
      "slowQueries": 12
    },
    "redis": {
      "status": "ready",
      "connected": true,
      "ready": true,
      "commandsSent": 0
    },
    "timestamp": "2026-01-15T10:30:00.000Z"
  },
  "queues": {
    "invoice-sync": {
      "failedCount": 2,
      "waitingCount": 15
    },
    "payment-webhook": {
      "failedCount": 0,
      "waitingCount": 3
    },
    "email-queue": {
      "failedCount": 1,
      "waitingCount": 5
    },
    "sms-queue": {
      "failedCount": 0,
      "waitingCount": 2
    }
  }
}
```

---

## Monitoring Dashboards

### Grafana / Datadog Integration

**Metrics to track:**

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Postgres pool utilization | `/metrics → connectionPools.postgres.utilizationPercent` | > 80% |
| Redis connection status | `/metrics → connectionPools.redis.connected` | `false` |
| Slow query count | `/metrics → connectionPools.postgres.slowQueries` | > 50/hour |
| DLQ invoice-sync | `/metrics → queues.invoice-sync.failedCount` | > 10 |
| DLQ payment-webhook | `/metrics → queues.payment-webhook.failedCount` | > 5 |
| DLQ email-queue | `/metrics → queues.email-queue.failedCount` | > 20 |
| DLQ sms-queue | `/metrics → queues.sms-queue.failedCount` | > 15 |
| Server error rate | `/metrics → server.errorRate` | > 5% |

### Prometheus Scraping (Future)

Add to `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'taxbridge'
    static_configs:
      - targets: ['api.taxbridge.ng:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

---

## Alert Configuration

### Sentry (Already Integrated)

**Automatic alerts for:**
- DLQ threshold exceeded (any queue)
- Postgres pool utilization > 80%
- Unhandled exceptions
- Circuit breaker trips

**Configuration:**
```bash
SENTRY_DSN="https://your-dsn@sentry.io/project"
SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE="0.1"  # 10% in production
```

### Custom Webhook Alerts

**DLQ alerts to Slack/PagerDuty:**
```bash
DLQ_ALERT_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

**Webhook payload:**
```json
{
  "queueName": "invoice-sync",
  "failedCount": 12,
  "threshold": 10,
  "timestamp": "2026-01-15T10:30:00.000Z",
  "failedJobs": [
    {
      "jobId": "inv-123",
      "failedReason": "DigiTax API timeout",
      "attemptsMade": 5
    }
  ]
}
```

---

## Common Monitoring Queries

### 1. Check Pool Health

```bash
# Quick check
curl -s http://localhost:3000/metrics | jq '.connectionPools'

# Alert if utilization > 80%
curl -s http://localhost:3000/metrics | jq -e '.connectionPools.postgres.utilizationPercent > 80'
```

### 2. Check DLQ Status

```bash
# All queues
curl -s http://localhost:3000/metrics | jq '.queues'

# Specific queue
curl -s http://localhost:3000/metrics | jq '.queues["invoice-sync"]'

# Alert if any queue has > threshold failures
curl -s http://localhost:3000/metrics | jq -e '.queues["invoice-sync"].failedCount > 10'
```

### 3. Monitor Error Rate

```bash
# Current error rate
curl -s http://localhost:3000/metrics | jq -r '.server.errorRate'

# Alert if > 5%
curl -s http://localhost:3000/metrics | jq -e '(.server.errorCount / .server.requestCount) > 0.05'
```

### 4. Slow Query Monitoring

```bash
# Count of slow queries
curl -s http://localhost:3000/metrics | jq '.connectionPools.postgres.slowQueries'

# Alert if > 50 slow queries
curl -s http://localhost:3000/metrics | jq -e '.connectionPools.postgres.slowQueries > 50'
```

---

## Troubleshooting

### High Pool Utilization (> 80%)

**Symptoms:**
- `/metrics` shows `utilizationPercent > 80`
- Requests timing out
- 503 errors

**Diagnosis:**
```bash
# Check active connections
curl -s http://localhost:3000/metrics | jq '.connectionPools.postgres'

# Check slow queries
curl -s http://localhost:3000/metrics | jq '.connectionPools.postgres.slowQueries'
```

**Resolution:**
1. Increase `DATABASE_POOL_MAX` (current: 10)
2. Review slow queries (may need indexing)
3. Check for connection leaks (should use singleton)

---

### DLQ Threshold Exceeded

**Symptoms:**
- Sentry alert: "DLQ Alert: invoice-sync has 12 failed jobs"
- `/metrics` shows high `failedCount`

**Diagnosis:**
```bash
# Check DLQ status
curl -s http://localhost:3000/metrics | jq '.queues["invoice-sync"]'

# View Sentry for error details
```

**Resolution:**
1. Check DigiTax/Remita integration health
2. Review BullMQ logs for failure reasons
3. Manual retry via admin API (when implemented)
4. Increase retry attempts if transient failures

---

### Redis Connection Issues

**Symptoms:**
- `/metrics` shows `redis.connected: false`
- Queue jobs not processing
- 503 errors

**Diagnosis:**
```bash
# Check Redis status
curl -s http://localhost:3000/metrics | jq '.connectionPools.redis'

# Verify Redis connectivity
redis-cli -u $REDIS_URL ping
```

**Resolution:**
1. Restart Redis connection (server restart)
2. Check Redis server health
3. Verify `REDIS_URL` environment variable

---

## Monitoring Best Practices

### 1. Polling Frequency

| Endpoint | Recommended Interval | Purpose |
|----------|----------------------|---------|
| `/health` | 10 seconds | Load balancer health checks |
| `/ready` | 5 seconds | Kubernetes readiness probe |
| `/metrics` | 30-60 seconds | Metrics collection (Prometheus/Grafana) |
| `/health/detailed` | On-demand | Manual troubleshooting |

### 2. Alert Fatigue Prevention

- ✅ Set appropriate thresholds (not too sensitive)
- ✅ Use graduated alerts (warning → critical)
- ✅ Aggregate similar alerts (e.g., DLQ across all queues)
- ✅ Auto-resolve when metrics return to normal

### 3. Log Correlation

**Include request ID in all logs:**
```bash
# Server automatically adds X-Request-ID to responses
curl -i http://localhost:3000/health | grep X-Request-ID
```

**Search logs by request ID:**
```bash
# Grep logs
grep "req-abc123" backend/logs/production.log

# Sentry
# Search: "context.requestId:req-abc123"
```

---

## Production Deployment Checklist

### Monitoring Setup

- [ ] Sentry DSN configured
- [ ] DLQ webhook URL configured (Slack/PagerDuty)
- [ ] Prometheus scraping enabled (if using)
- [ ] Grafana dashboards created
- [ ] Alert thresholds tuned for production traffic
- [ ] On-call rotation configured
- [ ] Runbook updated with monitoring URLs

### Post-Deployment Validation

- [ ] `/health` returns 200
- [ ] `/metrics` returns valid JSON
- [ ] Pool utilization < 50% under normal load
- [ ] No DLQ alerts in first 24 hours
- [ ] Error rate < 2%
- [ ] Response times meet SLA (P95 < 300ms)

---

**TaxBridge Team** | Production Observability 🔍
