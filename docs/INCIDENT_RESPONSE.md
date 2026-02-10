# 🚨 INCIDENT RESPONSE PLAYBOOK
## TaxBridge Production Incident Management

**Version**: 1.0  
**Last Updated**: February 10, 2026  
**Owner**: TaxBridge Engineering

---

## 📋 SEVERITY LEVELS

| Level | Name | Description | Response Time | Examples |
|-------|------|-------------|---------------|----------|
| **P1** | Critical | Service down, data loss risk, payment failures | **15 min** | Database unreachable, payment gateway down, data corruption |
| **P2** | Major | Degraded service, partial outage | **1 hour** | Slow queries (>5s), Redis connection failures, NRS submission errors |
| **P3** | Minor | Non-critical feature broken | **4 hours** | PDF generation failure, OCR errors, notification delays |
| **P4** | Low | Cosmetic issues, minor bugs | **24 hours** | UI glitches, log formatting, non-blocking warnings |

---

## 🔔 ALERT CHANNELS

### Automated Alerts (Sentry)
- **Critical**: Sentry → Slack #taxbridge-alerts → PagerDuty on-call
- **Warning**: Sentry → Slack #taxbridge-alerts
- **Info**: Sentry dashboard only

### Health Check Alerts (Uptime Robot)
- **Endpoint**: `GET /health`
- **Interval**: 60 seconds
- **Alert**: Slack + Email after 2 consecutive failures

### Manual Escalation
1. Slack: `#taxbridge-incidents`
2. Email: `incidents@taxbridge.ng`
3. Phone: On-call engineer (see rotation schedule)

---

## 🏃 INCIDENT WORKFLOW

### 1. Detection & Triage (0–15 min)

```
Alert Received → Acknowledge → Assess Severity → Assign Owner
```

**Steps**:
1. Acknowledge the alert in Sentry/Slack
2. Check health endpoints:
   ```bash
   curl https://api.taxbridge.ng/health
   curl https://api.taxbridge.ng/health/live
   curl https://api.taxbridge.ng/health/ready
   ```
3. Check error logs:
   ```bash
   # Render logs
   render logs --service taxbridge-backend --tail 100
   
   # Or via Sentry
   # Navigate to Issues → filter by level:error
   ```
4. Determine severity level (P1–P4)
5. Create incident channel: `#inc-YYYYMMDD-brief-description`

### 2. Investigation (15–60 min)

**Database Issues**:
```bash
# Check connection pool
curl https://api.taxbridge.ng/health/metrics | jq '.database'

# Check slow queries (via query logger)
curl -H "Authorization: Bearer $TOKEN" \
  https://api.taxbridge.ng/api/v1/metrics/production | jq '.queryStats'

# Direct DB check
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

**Redis Issues**:
```bash
# Check Redis health
redis-cli -u $REDIS_URL PING
redis-cli -u $REDIS_URL INFO stats | grep -E "keyspace_hits|keyspace_misses|evicted"
redis-cli -u $REDIS_URL INFO memory | grep used_memory_human
```

**Payment Gateway Issues**:
```bash
# Check gateway health
curl https://api.taxbridge.ng/health/integrations | jq '.paystack, .flutterwave, .remita'

# Check recent payment failures
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.taxbridge.ng/api/v1/payments?status=FAILED&limit=10"
```

**Queue/Worker Issues**:
```bash
# Check BullMQ queue health
curl https://api.taxbridge.ng/health | jq '.queues'

# Check DLQ (Dead Letter Queue)
curl -H "Authorization: Bearer $TOKEN" \
  https://api.taxbridge.ng/api/v1/admin/dlq/stats
```

### 3. Mitigation (Immediate Actions)

**Service Restart**:
```bash
# Render: trigger manual deploy (restart)
render deploy --service taxbridge-backend

# Or via dashboard: Services → taxbridge-backend → Manual Deploy
```

**Database Connection Reset**:
```bash
# Kill idle connections
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
  AND query_start < NOW() - INTERVAL '10 minutes';
"
```

**Redis Cache Clear**:
```bash
# Clear all cached API responses
redis-cli -u $REDIS_URL KEYS "api_response:*" | xargs redis-cli -u $REDIS_URL DEL

# Or flush specific prefix
redis-cli -u $REDIS_URL EVAL "
  local keys = redis.call('keys', ARGV[1])
  for i=1,#keys do redis.call('del', keys[i]) end
  return #keys
" 0 'api_response:*'
```

**Payment Gateway Failover**:
```bash
# Switch primary gateway (update env var)
# Paystack → Flutterwave or vice versa
render env set PRIMARY_PAYMENT_GATEWAY=flutterwave --service taxbridge-backend
render deploy --service taxbridge-backend
```

**Emergency Feature Toggle**:
```bash
# Disable NRS submission (if FIRS is down)
render env set DIGITAX_MOCK_MODE=true --service taxbridge-backend

# Disable SMS notifications
render env set ENABLE_DEADLINE_REMINDERS=false --service taxbridge-backend
```

### 4. Resolution & Recovery

1. **Verify fix**: Run health checks, test affected endpoints
2. **Monitor**: Watch Sentry for 30 minutes post-fix
3. **Communicate**: Update `#inc-*` channel with resolution
4. **Document**: Fill in incident report template (below)

### 5. Post-Incident Review (Within 48 hours)

Schedule a blameless post-mortem:
- What happened?
- Timeline of events
- Root cause analysis
- What went well?
- What could be improved?
- Action items with owners and deadlines

---

## 🔄 ROLLBACK PROCEDURES

### Backend Rollback
```bash
# Option 1: Render dashboard
# Services → taxbridge-backend → Deploys → select previous deploy → Rollback

# Option 2: Git revert + redeploy
git revert HEAD
git push origin main
# Render auto-deploys from main

# Option 3: Manual rollback script
./infra/scripts/rollback.sh <previous-commit-hash>
```

### Database Rollback
```bash
# Revert last migration
cd backend
npx prisma migrate resolve --rolled-back <migration-name>

# Restore from backup (Supabase)
# Dashboard → Database → Backups → Restore to point-in-time
```

### Mobile App Rollback
```bash
# EAS Update (OTA rollback)
eas update --branch production --message "Rollback to previous version"

# Full binary rollback requires new App Store / Play Store submission
```

---

## 📊 KEY METRICS TO MONITOR

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| API p95 latency | <200ms | 200–500ms | >500ms |
| Error rate | <0.1% | 0.1–1% | >1% |
| DB query avg | <100ms | 100–500ms | >500ms |
| Redis hit rate | >70% | 50–70% | <50% |
| Payment success | >95% | 90–95% | <90% |
| Queue depth | <100 | 100–1000 | >1000 |
| DB connections | <8/10 | 8–9/10 | 10/10 |
| Memory usage | <70% | 70–85% | >85% |

---

## 📝 INCIDENT REPORT TEMPLATE

```markdown
# Incident Report: [Brief Title]

**Date**: YYYY-MM-DD
**Severity**: P1/P2/P3/P4
**Duration**: X hours Y minutes
**Impact**: [Number of affected users/transactions]
**Incident Commander**: [Name]

## Timeline
- HH:MM — Alert triggered
- HH:MM — Acknowledged by [name]
- HH:MM — Root cause identified
- HH:MM — Fix deployed
- HH:MM — Service restored
- HH:MM — Monitoring confirmed stable

## Root Cause
[Description of what caused the incident]

## Resolution
[What was done to fix it]

## Impact
- Users affected: X
- Transactions affected: X
- Revenue impact: ₦X
- Data loss: Yes/No

## Action Items
| # | Action | Owner | Due Date | Status |
|---|--------|-------|----------|--------|
| 1 | [Action] | [Name] | YYYY-MM-DD | Open |

## Lessons Learned
- [What went well]
- [What could be improved]
```

---

## 📞 CONTACTS

| Role | Name | Contact |
|------|------|---------|
| Engineering Lead | TBD | engineering@taxbridge.ng |
| DevOps | TBD | devops@taxbridge.ng |
| Database Admin | TBD | dba@taxbridge.ng |
| Security | TBD | security@taxbridge.ng |

---

## 🔗 QUICK LINKS

- **Sentry Dashboard**: https://sentry.io/organizations/taxbridge/
- **Render Dashboard**: https://dashboard.render.com/
- **Supabase Dashboard**: https://supabase.com/dashboard/
- **Redis Cloud**: https://app.redislabs.com/
- **Uptime Robot**: https://uptimerobot.com/dashboard
- **Health Endpoint**: https://api.taxbridge.ng/health
- **Swagger Docs**: https://api.taxbridge.ng/docs
