# TaxBridge On-Call Runbook

## Overview

This runbook provides step-by-step procedures for handling production incidents in TaxBridge. Follow the escalation path and contact information at the bottom if you cannot resolve an issue.

---

## Critical Alerts

### 1. Service Down

**Alert**: `ServiceDown`  
**Severity**: Critical  
**Symptoms**: API returns 503 or timeouts; health checks failing

**Investigation**:
```bash
# Check server status
curl -f https://api.taxbridge.ng/health

# Check logs
kubectl logs -f deployment/taxbridge-backend --tail=100
# OR on Render:
render logs service=taxbridge-api --tail=100

# Check infrastructure
curl -f https://api.taxbridge.ng/ready
```

**Resolution**:
1. If database down: Check Supabase dashboard for connection limits
2. If Redis down: Restart Redis service via Render dashboard
3. If deployment issue: Rollback via `infra/scripts/rollback.sh [version]`
4. If traffic spike: Scale up instances temporarily

**Escalation**: If unresponsive after 5 minutes, page on-call engineering lead.

---

### 2. Database Connection Lost

**Alert**: `DatabaseConnectionDown`  
**Severity**: Critical  
**Symptoms**: Persistent database connection errors; queries timing out

**Investigation**:
```bash
# Check Supabase status
curl https://status.supabase.com/

# Test connection from backend
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool exhaustion
# Look for "FATAL: sorry, too many clients already" in logs
```

**Resolution**:
1. Verify DATABASE_URL environment variable is correct
2. Check for connection pool leaks (unclosed connections)
3. Increase connection limit in Supabase dashboard (Pro plan: up to 200)
4. Restart backend service to reset pool

**Temporary Mitigation**: Enable read replica if available; route non-critical reads there.

---

### 3. Redis Connection Lost

**Alert**: `RedisConnectionDown`  
**Severity**: Critical  
**Symptoms**: Queue processing stops; cache misses spike

**Investigation**:
```bash
# Test Redis connectivity
redis-cli -u $REDIS_URL ping

# Check memory usage
redis-cli -u $REDIS_URL info memory

# Check eviction policy
redis-cli -u $REDIS_URL config get maxmemory-policy
```

**Resolution**:
1. Restart Redis service via Render dashboard
2. If memory full: Increase Redis plan or enable `allkeys-lru` eviction
3. Check for long-running Lua scripts blocking Redis

**Degraded Mode**: Application can function without Redis (loses caching, queues stop).

---

## Integration Alerts

### 4. Duplo OAuth Failure High

**Alert**: `DuploOAuthFailureHigh`  
**Severity**: Critical  
**Symptoms**: Cannot obtain Duplo access tokens; e-invoice submissions fail

**Investigation**:
```bash
# Test OAuth manually
curl -X POST https://api.duplo.co/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${DUPLO_CLIENT_ID}&client_secret=${DUPLO_CLIENT_SECRET}"

# Check logs for specific error
grep "Duplo.*OAuth" backend/logs/error.log
```

**Resolution**:
1. Verify `DUPLO_CLIENT_ID` and `DUPLO_CLIENT_SECRET` are correct
2. Check if Duplo API is down: https://status.duplo.co (if available)
3. Confirm IP whitelisting with Duplo support if using production
4. Rotate credentials if compromised

**Contact**: support@duplo.co, +234-XXX-XXXX

---

### 5. Duplo Submission Failure High

**Alert**: `DuploSubmissionFailureHigh`  
**Severity**: Warning  
**Symptoms**: E-invoices rejected by Duplo; success rate < 90%

**Investigation**:
```bash
# Check recent failed submissions
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  https://api.taxbridge.ng/api/admin/invoices?status=failed&limit=10

# Test sample UBL submission
cd backend && npm run ubl:validate

# Check for UBL validation errors
curl https://api.taxbridge.ng/health | jq '.ubl'
```

**Resolution**:
1. If UBL validation errors: Fix generator in `backend/src/lib/ubl/generator.ts`
2. Common issues:
   - Missing TIN or invalid format (10 digits required)
   - Currency not set to NGN
   - VAT rate not 7.5%
   - Missing mandatory fields (check 55 required fields)
3. Resubmit failed invoices: `POST /api/admin/invoices/:id/resubmit-duplo`

**Temporary Fix**: Enable `DIGITAX_MOCK_MODE=true` to bypass Duplo for testing.

---

### 6. UBL Validation Failure

**Alert**: `UBLValidationFailure`  
**Severity**: Warning  
**Symptoms**: Generated UBL XML missing mandatory fields

**Investigation**:
```bash
# Run validation tool
cd backend && npm run ubl:validate

# Check which fields are missing
curl https://api.taxbridge.ng/health | jq '.ubl.missingFields'

# Inspect sample invoice
node -e "const { generateUBL } = require('./dist/src/lib/ubl/generator'); console.log(generateUBL({...}))"
```

**Resolution**:
1. Review `backend/src/lib/ubl/generator.ts` for missing field generation
2. Cross-check against Peppol BIS Billing 3.0 spec: `backend/docs/ubl/peppol-bis-billing-3.0-validation.md`
3. Deploy fix and re-run validation
4. If XSD validation fails: Download latest schema with `npm run ubl:download-xsd`

---

### 7. Remita Payment Failure High

**Alert**: `RemitaPaymentFailureHigh`  
**Severity**: Critical  
**Symptoms**: RRR generation failing; users cannot pay invoices

**Investigation**:
```bash
# Test Remita connectivity
curl https://remitademo.net/health  # or login.remita.net for prod

# Check recent failures
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  https://api.taxbridge.ng/api/admin/payments?status=failed

# Test RRR generation manually
curl -X POST https://api.taxbridge.ng/api/v1/payments/generate \
  -H "Content-Type: application/json" \
  -d '{"invoiceId":"...","payerName":"Test","payerEmail":"test@test.com","payerPhone":"+2348012345678"}'
```

**Resolution**:
1. Verify `REMITA_MERCHANT_ID` and `REMITA_API_KEY` are correct
2. Check SHA512 hash generation in `backend/src/integrations/remita/adapter.ts`
3. Ensure amount is in kobo (multiply by 100)
4. Contact Remita support if gateway down

**Contact**: support@remita.net, +234-1-XXXXXXX

**Transaction Fees**: Remita charges 1-2% per successful transaction; budget accordingly.

---

### 8. Remita Webhook Validation Failure

**Alert**: `RemitaWebhookValidationFailure`  
**Severity**: Warning  
**Symptoms**: Webhook events rejected; payments stuck in "pending"

**Investigation**:
```bash
# Check recent webhook logs
grep "remita.*webhook" backend/logs/app.log | tail -20

# Verify signature manually
# Expected: HMAC-SHA512(payload, REMITA_API_KEY)
echo -n '{"rrr":"..."}' | openssl dgst -sha512 -hmac "$REMITA_API_KEY"
```

**Resolution**:
1. Confirm `REMITA_API_KEY` matches webhook secret in Remita dashboard
2. Check signature verification logic in `backend/src/integrations/remita/adapter.ts`
3. If webhook URL changed: Update in Remita merchant settings
4. For stuck payments: Manually query status with `GET /api/v1/payments/:invoiceId/status`

**Idempotency**: Webhooks are idempotent; safe to replay.

---

## Performance Alerts

### 9. High Memory Usage

**Alert**: `HighMemoryUsage`  
**Severity**: Warning  
**Symptoms**: Heap usage > 85%; potential OOM crash

**Investigation**:
```bash
# Check current memory usage
curl https://api.taxbridge.ng/metrics | grep taxbridge_memory

# Inspect heap snapshot (requires Node.js debugging)
kill -USR2 <PID>  # Trigger heap dump
```

**Resolution**:
1. Identify memory leak with heap profiler
2. Common causes:
   - Unclosed database connections
   - Caching too much data in Redis
   - Large UBL XML files held in memory
3. Restart service as temporary fix
4. Scale up instance if sustained traffic increase

**Prevention**: Enable `--max-old-space-size=512` to cap heap.

---

### 10. Slow API Response Time

**Alert**: `SlowAPIResponseTime`  
**Severity**: Warning  
**Symptoms**: p95 latency > 500ms; users report slow app

**Investigation**:
```bash
# Check endpoint latencies
curl https://api.taxbridge.ng/metrics | grep duration

# Identify slow queries
# Check Supabase slow query log

# Test specific endpoints
time curl -X GET https://api.taxbridge.ng/api/v1/invoices
```

**Resolution**:
1. Add database indexes for frequently queried fields
2. Enable query result caching in Redis
3. Optimize N+1 query patterns (use Prisma `.include()`)
4. Scale up backend instances

**Thresholds**:
- p50: < 100ms
- p95: < 300ms
- p99: < 1000ms

---

## Operational Procedures

### Deployment Rollback

```bash
cd infra/scripts
./rollback.sh v1.2.3  # Specify previous stable version

# Verify rollback
curl https://api.taxbridge.ng/health
```

### Manual Invoice Resubmission (Duplo)

```bash
curl -X POST https://api.taxbridge.ng/api/admin/invoices/:invoiceId/resubmit-duplo \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

### Manual Payment Status Check (Remita)

```bash
curl -X GET https://api.taxbridge.ng/api/v1/payments/:invoiceId/status \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Force Queue Processing

```bash
# Clear stuck jobs
redis-cli -u $REDIS_URL DEL bull:invoice-sync:waiting
redis-cli -u $REDIS_URL DEL bull:payment-webhook:waiting

# Restart worker
render restart service=taxbridge-worker
```

---

## Monitoring Dashboards

- **Grafana**: https://grafana.taxbridge.ng
- **Sentry**: https://sentry.io/organizations/taxbridge
- **Uptime Robot**: https://uptimerobot.com/dashboard
- **Logs**: https://logs.taxbridge.ng (Better Stack)

---

## Regular Maintenance

### Weekly
- [ ] Review error budget (target: 99.5% uptime)
- [ ] Check alert noise (reduce false positives)
- [ ] Rotate secrets if compromised

### Monthly
- [ ] Test rollback procedure
- [ ] Validate backup restoration
- [ ] Review performance trends (scale proactively)
- [ ] Audit Duplo/Remita transaction logs

---

## Escalation & Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| On-Call Engineer | Slack: #ops-alerts | 24/7 |
| Backend Lead | email@taxbridge.ng | Business hours |
| DevOps Lead | email@taxbridge.ng | 24/7 |
| Duplo Support | support@duplo.co | Business hours |
| Remita Support | support@remita.net | Business hours |

**Escalation Path**:
1. On-call engineer (0-15 min)
2. Backend lead (15-30 min)
3. CTO (30+ min)

---

## Cost Alerts

If monthly spend exceeds $70 budget:
1. Check for runaway queries (Supabase usage)
2. Verify Redis plan (upgrade if needed)
3. Review Duplo transaction fees (₦20-50/invoice)
4. Audit Remita transaction fees (1-2%)

**Target**: < $60/month base infra + variable transaction costs.
