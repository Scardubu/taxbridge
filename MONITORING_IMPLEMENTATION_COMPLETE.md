# TaxBridge Comprehensive Monitoring & Observability

## Implementation Date: January 11, 2026

---

## Overview

This document summarizes the production-grade monitoring and alerting system implemented for TaxBridge, with specific focus on Duplo (DigiTax e-invoicing APP) and Remita (payment gateway) integrations, plus UBL 3.0/Peppol BIS Billing 3.0 validation.

---

## 🎯 Monitoring Stack (Cost-Optimized, Free Tier First)

| Component | Provider | Monthly Cost | Features |
|-----------|----------|--------------|----------|
| **Application Performance** | Sentry Free | $0 | 5K events/month, 1K sessions/month; `tracesSampleRate=0.2` |
| **Uptime Monitoring** | Uptime Robot Free | $0 | 50 monitors, 5-min intervals, HTTP/Ping/Port checks |
| **Logs** | Better Stack Free | $0 | 3 GB/month ingestion, 3-day retention |
| **Metrics** | Prometheus + Grafana (Self-hosted) | $6/month | DO Droplet s-1vcpu-1gb; all metrics |
| **Real User Monitoring** | LogRocket Free (Optional) | $0 | 1K sessions/month, 1-month retention |
| **Total Base** | | **$0-6/month** | MVP tier; scales to $50-100/month for 10K users |

### Cost Scaling Path
- **MVP (0-1K users)**: $0-6/month (free tiers + self-hosted Prometheus)
- **Growth (1K-5K users)**: $30-50/month (Better Stack Pro $24, Sentry Team optional)
- **Scale (5K-10K users)**: $50-100/month (add LogRocket Team $69 for RUM)

---

## ✅ Files Created & Modified

### Backend Services

| File | Purpose |
|------|---------|
| [backend/src/middleware/sentry.ts](backend/src/middleware/sentry.ts) | Sentry SDK integration; Duplo/Remita/UBL health checks |
| [backend/src/services/metrics.ts](backend/src/services/metrics.ts) | Custom metrics for Duplo/Remita/UBL; Prometheus format export |
| [backend/src/lib/ubl/mandatoryFields.ts](backend/src/lib/ubl/mandatoryFields.ts) | Shared UBL field validation (55 mandatory fields) |
| [backend/src/tools/ubl-validate.ts](backend/src/tools/ubl-validate.ts) | **Modified**: Refactored to use shared field analysis |

### Integration Instrumentation

| File | Changes |
|------|---------|
| [backend/src/integrations/duplo.ts](backend/src/integrations/duplo.ts) | Added OAuth, submission, status latency tracking; UBL missing fields metrics |
| [backend/src/integrations/remita.ts](backend/src/integrations/remita.ts) | Added payment, status check latency tracking |
| [backend/src/integrations/remita/adapter.ts](backend/src/integrations/remita/adapter.ts) | Instrumented RRR generation, verification with success/failure metrics |
| [backend/src/routes/payments.ts](backend/src/routes/payments.ts) | Added webhook success/failure tracking |

### Server & Core

| File | Changes |
|------|---------|
| [backend/src/server.ts](backend/src/server.ts) | Integrated Sentry middleware; augmented `/health` with Duplo/Remita/UBL; extended `/metrics`; fatal error capture |
| [backend/package.json](backend/package.json) | Added `@sentry/node@^8.31.0`, `@sentry/tracing@^7.120.3` |

### Infrastructure & Documentation

| File | Purpose |
|------|---------|
| [infra/monitoring/grafana-dashboard.json](infra/monitoring/grafana-dashboard.json) | 12-panel Grafana dashboard: Duplo/Remita metrics, UBL validation, API health |
| [infra/monitoring/alert-rules.yml](infra/monitoring/alert-rules.yml) | Prometheus alert rules: ServiceDown, DuploSubmissionFailureHigh, RemitaPaymentFailureHigh, UBLValidationFailure |
| [docs/runbook.md](docs/runbook.md) | On-call runbook with incident procedures, escalation paths, Duplo/Remita troubleshooting |

---

## 📊 Metrics Exposed

### Duplo (DigiTax E-Invoicing)

| Metric | Type | Description |
|--------|------|-------------|
| `duplo_submission_total` | Counter | Total e-invoice submissions |
| `duplo_submission_success_total` | Counter | Successful submissions |
| `duplo_submission_failure_total` | Counter | Failed submissions |
| `duplo_submission_success_ratio` | Gauge | Success rate (0-1) |
| `duplo_submission_duration_ms_average` | Gauge | Average latency in milliseconds |
| `duplo_submission_missing_fields` | Gauge | Last observed missing UBL mandatory fields (0-55) |
| `duplo_oauth_failure_total` | Counter | Failed OAuth token exchanges |
| `duplo_status_failure_total` | Counter | Failed IRN status checks |

**Integration Details**:
- OAuth 2.0 token caching (55min TTL)
- POST `/v1/einvoice/submit` with UBL 3.0 XML
- GET `/v1/einvoice/status/{irn}` for stamp verification
- Sandbox: free; Production: ₦20-50/invoice

### Remita (Payment Gateway)

| Metric | Type | Description |
|--------|------|-------------|
| `remita_payment_total` | Counter | Total RRR generation attempts |
| `remita_payment_success_total` | Counter | Successful RRR generations |
| `remita_payment_success_ratio` | Gauge | Success rate (0-1) |
| `remita_payment_amount_naira_sum` | Counter | Total payment amount initialized (₦) |
| `remita_status_failure_total` | Counter | Failed payment status checks |
| `remita_webhook_processed_total` | Counter | Webhook events successfully processed |
| `remita_webhook_failed_total` | Counter | Webhook validation failures |

**Integration Details**:
- POST `/ecomm/init.reg` for RRR generation (SHA512 hash)
- GET `/ecomm/status.reg` for payment verification
- Webhook: HMAC-SHA512 signature verification
- Transaction fees: 1-2%

### UBL 3.0 / Peppol BIS Billing 3.0

| Metric | Type | Description |
|--------|------|-------------|
| `ubl_validation_total` | Counter | Number of automated validation checks |
| `ubl_validation_failure_total` | Counter | Failed validation checks |
| `ubl_validation_missing_fields` | Gauge | Missing mandatory fields from last check (0-55) |
| `ubl_validation_last_run` | Gauge | Timestamp of last automated check (unix seconds) |

**Validation Checks**:
- 55 mandatory fields per Peppol BIS Billing 3.0
- NGN currency requirement
- 7.5% VAT rate validation
- XSD schema compliance (UBL 2.1)

---

## 🚨 Alert Rules Configured

### Critical Alerts

| Alert | Condition | Threshold | Action |
|-------|-----------|-----------|--------|
| **ServiceDown** | `up == 0` | > 2 min | Page on-call engineer |
| **DatabaseConnectionDown** | `taxbridge_component_status{component="database"} == 0` | > 1 min | Check Supabase; restart backend |
| **RedisConnectionDown** | `taxbridge_component_status{component="redis"} < 0.5` | > 2 min | Restart Redis service |
| **DuploOAuthFailureHigh** | `rate(duplo_oauth_failure_total[5m]) > 0.1` | > 5 min | Verify credentials; check Duplo status |
| **RemitaPaymentFailureHigh** | `remita_payment_success_ratio < 0.9` | > 10 min | Test RRR generation; contact Remita support |

### Warning Alerts

| Alert | Condition | Threshold | Action |
|-------|-----------|-----------|--------|
| **DuploSubmissionFailureHigh** | `duplo_submission_success_ratio < 0.9` | > 10 min | Check UBL validation; review logs |
| **UBLValidationFailure** | `ubl_validation_missing_fields > 0` | > 2 min | Fix generator; redeploy |
| **HighMemoryUsage** | `(heap_used / heap_total) * 100 > 85` | > 5 min | Identify memory leak; restart service |
| **HighErrorRate** | `taxbridge_error_rate_percent > 5` | > 5 min | Investigate error logs |
| **RemitaWebhookValidationFailure** | `rate(remita_webhook_failed_total[5m]) > 0.02` | > 5 min | Verify webhook secret; check signature logic |

---

## 🔍 Health Check Endpoints

### Enhanced `/health` Endpoint

**URL**: `GET /health`

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2026-01-11T10:30:00.000Z",
  "uptime": 86400,
  "version": "1.0.0",
  "latency": {
    "database": 45,
    "redis": 12
  },
  "integrations": {
    "duplo": {
      "status": "healthy",
      "provider": "duplo",
      "latency": 150,
      "timestamp": "2026-01-11T10:30:00.000Z"
    },
    "remita": {
      "status": "healthy",
      "provider": "remita",
      "latency": 200,
      "timestamp": "2026-01-11T10:30:00.000Z"
    }
  },
  "ubl": {
    "status": "valid",
    "missingFields": [],
    "xsdValid": true,
    "timestamp": "2026-01-11T10:30:00.000Z"
  }
}
```

### Integration-Specific Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health/duplo` | Duplo OAuth connectivity check |
| `GET /health/remita` | Remita gateway availability check |
| `GET /health/integrations` | Combined Duplo + Remita status |

### Prometheus Metrics Endpoint

**URL**: `GET /metrics`

**Response** (text/plain):
```
# Core metrics (uptime, requests, errors, memory)
taxbridge_uptime_seconds 86400
taxbridge_requests_total 1500000
taxbridge_errors_total 7500
taxbridge_error_rate_percent 0.5
...

# Duplo metrics
duplo_submission_total 25000
duplo_submission_success_total 24500
duplo_submission_success_ratio 0.98
duplo_submission_duration_ms_average 1250.50
duplo_submission_missing_fields 0
...

# Remita metrics
remita_payment_total 18000
remita_payment_success_total 17550
remita_payment_success_ratio 0.975
remita_payment_amount_naira_sum 450000000.00
...

# UBL metrics
ubl_validation_total 120
ubl_validation_failure_total 2
ubl_validation_missing_fields 0
ubl_validation_last_run 1704960600
```

---

## 📈 Grafana Dashboard Panels

### Dashboard: TaxBridge Production Metrics 2026

**Panels (12 total)**:

1. **API Health Overview** (Stat): Database + Redis status (0=error, 0.5=degraded, 1=healthy)
2. **Duplo E-Invoicing Success Rate** (Stat): `duplo_submission_success_ratio * 100` (thresholds: <90% red, <95% yellow)
3. **Remita Payment Success Rate** (Stat): `remita_payment_success_ratio * 100`
4. **Duplo Submission Latency** (Graph): `duplo_submission_duration_ms_average` over time
5. **Remita Payment Volume** (Graph): `rate(remita_payment_total[5m])` by status
6. **UBL Validation Errors** (Graph): `ubl_validation_missing_fields` (alert if > 0)
7. **Duplo OAuth Failures** (Stat): `duplo_oauth_failure_total` (thresholds: 0=green, 5=yellow, 10=red)
8. **Remita Webhook Processing** (Graph): `rate(remita_webhook_processed_total[5m])` vs `rate(remita_webhook_failed_total[5m])`
9. **Memory Usage (%)** (Graph): `(heap_used / heap_total) * 100` (threshold: 85% critical)
10. **API Request Rate (req/s)** (Graph): `rate(taxbridge_requests_total[1m])`
11. **Error Rate (%)** (Graph): `taxbridge_error_rate_percent` (threshold: 5% critical)
12. **Remita Payment Amount (₦)** (Stat): `remita_payment_amount_naira_sum` (cumulative)

**Access**: https://grafana.taxbridge.ng

---

## 📚 On-Call Runbook

**Location**: [docs/runbook.md](docs/runbook.md)

**Sections**:
1. Critical Alerts (ServiceDown, DatabaseConnectionDown, RedisConnectionDown)
2. Integration Alerts (DuploOAuthFailureHigh, DuploSubmissionFailureHigh, UBLValidationFailure, RemitaPaymentFailureHigh, RemitaWebhookValidationFailure)
3. Performance Alerts (HighMemoryUsage, SlowAPIResponseTime, QueueBacklog)
4. Operational Procedures (Rollback, Manual Resubmission, Force Queue Processing)
5. Monitoring Dashboards (Grafana, Sentry, Uptime Robot, Logs)
6. Regular Maintenance (Weekly/Monthly checklists)
7. Escalation & Contacts (On-call engineer, Duplo support, Remita support)
8. Cost Alerts (Budget: <$70/month)

---

## 🔐 Sentry Integration

### Features Enabled
- **Error Tracking**: All backend exceptions captured with context (request, user, tags)
- **Performance Monitoring**: HTTP request tracing (`tracesSampleRate=0.2` in production)
- **Before Send Hook**: 
  - Strips sensitive headers (authorization, cookies)
  - Filters out `/health` endpoint noise
  - Tags errors with `integration: duplo` or `integration: remita`
- **Distributed Tracing**: Each request gets a unique transaction ID

### Environment Variables
```bash
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ENVIRONMENT=production
VERSION=1.0.0  # Git tag for release tracking
```

### Configuration
- **Free Tier**: 5K error events/month, 1K performance sessions/month
- **Sample Rate**: 20% of requests traced in production (100% in dev)
- **Integrations**: HTTP tracing, PostgreSQL query tracking

---

## 🧪 Testing & Validation

### Backend Tests Enhanced
- **UBL Validation Script**: `npm run ubl:validate` validates sample invoice against 55 mandatory fields
- **Health Endpoints**: All `/health/*` endpoints return structured JSON with integration status
- **Metrics Endpoint**: `/metrics` returns Prometheus-compatible format

### Manual Testing
```bash
# Test Duplo health
curl https://api.taxbridge.ng/health/duplo

# Test Remita health
curl https://api.taxbridge.ng/health/remita

# Test UBL validation
curl https://api.taxbridge.ng/health | jq '.ubl'

# Scrape metrics
curl https://api.taxbridge.ng/metrics
```

---

## 📦 Dependencies Added

**Backend**:
```json
{
  "@sentry/node": "^8.31.0",
  "@sentry/tracing": "^7.120.3"
}
```

**Installation**:
```bash
cd backend
npm install @sentry/node@^8.31.0 @sentry/tracing@^7.120.3
```

---

## 🚀 Deployment Checklist

- [ ] Set `SENTRY_DSN` and `SENTRY_ENVIRONMENT` in production environment
- [ ] Verify Duplo production credentials (`DUPLO_CLIENT_ID`, `DUPLO_CLIENT_SECRET`)
- [ ] Verify Remita production credentials (`REMITA_MERCHANT_ID`, `REMITA_API_KEY`)
- [ ] Enable `ENABLE_METRICS=true` in production
- [ ] Deploy Grafana dashboard from `infra/monitoring/grafana-dashboard.json`
- [ ] Deploy Prometheus alert rules from `infra/monitoring/alert-rules.yml`
- [ ] Configure Uptime Robot monitors for:
  - `https://api.taxbridge.ng/health`
  - `https://api.taxbridge.ng/health/duplo`
  - `https://api.taxbridge.ng/health/remita`
- [ ] Test alert notifications (Slack webhook, email, SMS)
- [ ] Review on-call rotation schedule
- [ ] Print runbook and keep accessible

---

## 💰 Monthly Cost Breakdown (Updated January 2026)

| Component | Provider | Cost | Notes |
|-----------|----------|------|-------|
| **Base Infrastructure** | | | |
| Backend API | Render Starter | $7 | Auto-scales CPU>70% |
| Queue Worker | Render Starter | $7 | Separate instance |
| Database | Supabase Pro | $25 | 14-day backups |
| Redis | Render Redis | $10 | `allkeys-lru` eviction |
| OCR Service | DigitalOcean | $6 | s-1vcpu-1gb droplet |
| Storage | DO Spaces / CF R2 | $0-5 | 10GB free (R2) |
| **Monitoring** | | | |
| Sentry | Free | $0 | 5K events/month |
| Uptime Robot | Free | $0 | 50 monitors |
| Logs (Better Stack) | Free | $0 | 3GB/month, 3-day retention |
| Metrics (Prometheus) | Self-hosted | $0 | Runs on OCR droplet |
| Grafana | Self-hosted | $0 | Runs on OCR droplet |
| **Optional** | | | |
| LogRocket RUM | Free | $0 | 1K sessions/month |
| **Total (Base)** | | **$55/month** | |
| **Total (w/ Scale)** | | **$105/month** | Better Stack Pro ($24), LogRocket Team ($69) for 10K users |

**Transaction Costs** (variable):
- Duplo: ₦20-50/invoice (~$0.02-0.05)
- Remita: 1-2% of payment amount

**Target**: <$70/month for 10K users (base infra + free tier monitoring).

---

## 📝 Summary

✅ **Sentry** integrated for error tracking and performance monitoring  
✅ **Custom metrics** for Duplo, Remita, UBL validation exposed via `/metrics`  
✅ **Grafana dashboard** with 12 panels tracking all critical integrations  
✅ **Prometheus alert rules** for critical/warning thresholds  
✅ **Enhanced health checks** (`/health`, `/health/duplo`, `/health/remita`) with UBL validation  
✅ **On-call runbook** with incident procedures and escalation paths  
✅ **Cost-optimized stack** leveraging free tiers: $0-6/month MVP, $50-100/month at scale  
✅ **Instrumented integrations** with latency, success/failure tracking  
✅ **UBL field validation** (55 mandatory fields) automated in health checks  

---

## Next Steps

1. **Deploy to staging**: Test Sentry/Prometheus integration
2. **Configure Uptime Robot**: Add monitors for all health endpoints
3. **Set up Slack webhooks**: Connect Prometheus Alertmanager to #ops-alerts
4. **Train on-call team**: Walk through runbook procedures
5. **Simulate incidents**: Test alert delivery and runbook effectiveness
6. **Enable Better Stack**: Ingest logs once volume exceeds 3GB/month
7. **Review metrics weekly**: Identify optimization opportunities

---

**Implementation Complete**: January 11, 2026  
**Next Review**: Monthly (February 11, 2026)
