# TaxBridge V5 - Production Deployment Checklist

**Version:** 5.0.2  
**Phase:** B Complete → C Preparation  
**Last Updated:** January 15, 2026

---

## Phase B Completion Status: ✅ COMPLETE

All critical production-readiness improvements have been implemented and documented.

---

## Pre-Deployment Requirements

### 1. Database Migration

- [ ] **Execute encryption key version migration**
  ```bash
  cd backend
  psql $DATABASE_URL < prisma/migrations/add_encryption_key_version.sql
  ```

- [ ] **Verify migration success**
  ```bash
  psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='encryption_key_version';"
  # Should return: encryption_key_version
  ```

- [ ] **Update Prisma schema**
  ```bash
  cd backend
  npx prisma generate
  npx prisma migrate deploy  # If using Prisma migrations
  ```

---

### 2. Environment Configuration

#### Required Variables (Must Set)

- [ ] `ENCRYPTION_KEY` - 64-char hex string (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] `JWT_SECRET` - 64-char hex string
- [ ] `JWT_REFRESH_SECRET` - 64-char hex string
- [ ] `DATABASE_URL` - PostgreSQL connection string with pool params
- [ ] `REDIS_URL` - Redis connection string

**Verification:**
```bash
# Backend will fail to start if required vars missing
cd backend
npm run build  # Should succeed
```

#### Optional Configuration (Recommended for Production)

**Rate Limiting (15 variables):**
```bash
RATE_LIMIT_API_WINDOW=60
RATE_LIMIT_API_MAX=100
RATE_LIMIT_API_BLOCK=300
RATE_LIMIT_USSD_WINDOW=60
RATE_LIMIT_USSD_MAX=10
RATE_LIMIT_USSD_BLOCK=300
RATE_LIMIT_SMS_WINDOW=300
RATE_LIMIT_SMS_MAX=5
RATE_LIMIT_SMS_BLOCK=900
RATE_LIMIT_AUTH_WINDOW=900
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_AUTH_BLOCK=1800
RATE_LIMIT_WEBHOOK_WINDOW=60
RATE_LIMIT_WEBHOOK_MAX=50
RATE_LIMIT_WEBHOOK_BLOCK=300
```

**Monitoring (9 variables):**
```bash
ENABLE_DLQ_MONITORING=true
ENABLE_POOL_MONITORING=true
DLQ_CHECK_INTERVAL_MS=300000
DLQ_THRESHOLD_INVOICE_SYNC=10
DLQ_THRESHOLD_PAYMENT=5
DLQ_THRESHOLD_EMAIL=20
DLQ_THRESHOLD_SMS=15
DLQ_ALERT_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK"
POOL_METRICS_INTERVAL_MS=60000
POOL_UTILIZATION_WARNING=0.8
```

**Connection Pooling:**
```bash
DATABASE_POOL_MAX=10
DATABASE_POOL_TIMEOUT_MS=5000
PRISMA_SLOW_QUERY_MS=500
```

**Sentry:**
```bash
SENTRY_DSN="https://your-dsn@sentry.io/project"
SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE="0.1"  # 10% in production
```

- [ ] All production environment variables configured
- [ ] Secrets stored securely (not in code)
- [ ] Environment validated with `npm run build`

---

### 3. Load Testing (Staging)

- [ ] **Smoke test passes** (5 min)
  ```bash
  cd backend/load-test
  k6 run k6-smoke.js -e BASE_URL=https://api-staging.taxbridge.ng
  ```

- [ ] **Load test passes** (27 min)
  ```bash
  k6 run k6-script.js -e BASE_URL=https://api-staging.taxbridge.ng
  # Verify: P95 < 300ms, errors < 10%
  ```

- [ ] **Soak test passes** (60 min)
  ```bash
  k6 run k6-soak.js -e BASE_URL=https://api-staging.taxbridge.ng
  # Verify: No response time degradation
  ```

- [ ] **Spike test passes** (5 min)
  ```bash
  k6 run k6-spike.js -e BASE_URL=https://api-staging.taxbridge.ng
  # Verify: Circuit breaker trips appropriately
  ```

- [ ] **Offline sync burst test passes** (8 min)
  ```bash
  k6 run k6-offline-sync-burst.js -e BASE_URL=https://api-staging.taxbridge.ng
  # Verify: Queue absorbs load, circuit breaker active
  ```

**Results Documentation:**
- [ ] Save all test results (`*.json`)
- [ ] Verify all thresholds met
- [ ] Document any performance issues
- [ ] Tune configuration if needed

---

### 4. Monitoring Setup

- [ ] **Sentry configured**
  - DSN set in production environment
  - Test alert: `curl https://api.taxbridge.ng/test-sentry-error`
  - Verify alert received in Sentry dashboard

- [ ] **DLQ webhook configured** (optional)
  - Slack/PagerDuty webhook URL set
  - Test alert: Manually trigger DLQ threshold

- [ ] **Metrics endpoint accessible**
  ```bash
  curl https://api.taxbridge.ng/metrics
  # Should return JSON with connectionPools and queues
  ```

- [ ] **Grafana/Prometheus configured** (if using)
  - Scraping `/metrics` endpoint every 30-60s
  - Dashboards created for key metrics
  - Alerts configured

**Alert Validation:**
- [ ] Test DLQ threshold alert (manually fail jobs)
- [ ] Test pool utilization alert (simulate high load)
- [ ] Test Sentry error reporting
- [ ] Verify on-call rotation receives alerts

---

### 5. Secret Rotation Procedures

- [ ] **JWT rotation script tested**
  ```bash
  cd infra/scripts
  chmod +x rotate-jwt-secrets.sh
  ./rotate-jwt-secrets.sh
  # Verify new secrets generated
  # Test dual-secret validation works
  ```

- [ ] **Webhook rotation script tested**
  ```bash
  chmod +x rotate-webhook-secrets.sh
  ./rotate-webhook-secrets.sh
  # Verify new secrets generated
  ```

- [ ] **Rotation runbook created**
  - Document rotation schedule (e.g., quarterly)
  - Document rollback procedure
  - Assign rotation responsibility

---

## Deployment Process

### Step 1: Pre-Deployment Backup

- [ ] **Database backup**
  ```bash
  pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
  ```

- [ ] **Redis snapshot** (if persistent)
  ```bash
  redis-cli -u $REDIS_URL BGSAVE
  ```

- [ ] **Code backup**
  ```bash
  git tag v5.0.2-pre-deployment
  git push origin v5.0.2-pre-deployment
  ```

### Step 2: Deploy Backend

- [ ] **Pull latest code**
  ```bash
  git checkout main
  git pull origin main
  ```

- [ ] **Install dependencies**
  ```bash
  cd backend
  npm ci --production
  ```

- [ ] **Build**
  ```bash
  npm run build
  # Verify: 0 TypeScript errors
  ```

- [ ] **Run migration**
  ```bash
  psql $DATABASE_URL < prisma/migrations/add_encryption_key_version.sql
  ```

- [ ] **Start server** (with new env vars)
  ```bash
  # Update .env with all new variables
  npm start
  ```

- [ ] **Verify startup**
  ```bash
  # Check logs for:
  # ✅ "Prisma Client initialized with encryption middleware and pooling"
  # ✅ "DLQ monitoring enabled"
  # ✅ "Connection pool monitoring enabled"
  # ✅ "Server listening on port 3000"
  ```

### Step 3: Smoke Testing (Production)

- [ ] **Health check**
  ```bash
  curl https://api.taxbridge.ng/health
  # Expect: {"status":"ok", ...}
  ```

- [ ] **Metrics endpoint**
  ```bash
  curl https://api.taxbridge.ng/metrics
  # Expect: Valid JSON with connectionPools, queues, server
  ```

- [ ] **Readiness check**
  ```bash
  curl https://api.taxbridge.ng/ready
  # Expect: {"status":"ready"}
  ```

- [ ] **Invoice creation**
  ```bash
  # Create test invoice via mobile app or API
  # Verify: Invoice stamped successfully
  # Verify: No queue errors in /metrics
  ```

- [ ] **Payment flow**
  ```bash
  # Initiate test payment
  # Verify: RRR generated
  # Verify: Webhook processed
  ```

### Step 4: Monitoring Validation (First 24 Hours)

**Hour 0-1:**
- [ ] Monitor `/metrics` every 5 minutes
- [ ] Verify pool utilization < 50%
- [ ] Verify DLQ counts = 0
- [ ] Check Sentry for errors

**Hour 1-24:**
- [ ] Monitor `/metrics` every 30 minutes
- [ ] Verify no DLQ threshold alerts
- [ ] Verify error rate < 2%
- [ ] Verify slow query count acceptable
- [ ] Check Sentry dashboard

**Metrics to Track:**
| Metric | Target | Alert If |
|--------|--------|----------|
| Pool utilization | < 70% | > 80% |
| DLQ invoice-sync | 0 | > 10 |
| DLQ payment-webhook | 0 | > 5 |
| Error rate | < 1% | > 5% |
| Slow queries | < 20/hour | > 50/hour |
| Response time P95 | < 250ms | > 300ms |

### Step 5: Rollback Plan (If Needed)

**Triggers for Rollback:**
- Pool utilization > 90% sustained
- Error rate > 10%
- DLQ threshold alerts > 3 in 1 hour
- Response time P95 > 500ms

**Rollback Procedure:**
```bash
# 1. Revert code
git revert HEAD~1
git push origin main

# 2. Revert database migration (if needed)
psql $DATABASE_URL << EOF
ALTER TABLE users DROP COLUMN encryption_key_version;
EOF

# 3. Restart with old .env
# Remove new environment variables
npm start

# 4. Verify old version running
curl https://api.taxbridge.ng/health
```

---

## Post-Deployment

### Immediate (Day 1)

- [ ] **Update documentation**
  - Mark Phase B as COMPLETE in project tracker
  - Update runbook with new monitoring endpoints
  - Share deployment summary with team

- [ ] **Verify integrations**
  - DigiTax submission working
  - Remita payment flow working
  - SMS notifications sending
  - Email queue processing

- [ ] **Monitor metrics**
  - No DLQ alerts
  - Pool utilization stable
  - Error rate < 2%

### Week 1

- [ ] **Performance review**
  - Review slow query logs
  - Optimize indexes if needed
  - Tune pool settings if needed
  - Adjust rate limits based on traffic

- [ ] **Security audit**
  - Verify all secrets rotated
  - Check for any hardcoded credentials
  - Review Sentry for security-related errors

### Month 1

- [ ] **Capacity planning**
  - Review pool utilization trends
  - Plan for scaling if needed
  - Update rate limits for growth

- [ ] **First secret rotation**
  - Execute JWT rotation script
  - Test dual-secret validation
  - Remove old secrets after 24 hours

---

## Success Criteria

### Must Have (Blockers)

- [x] All Phase B code merged
- [ ] Database migration executed
- [ ] Environment variables configured
- [ ] Load tests pass on staging
- [ ] Health endpoints return 200
- [ ] Metrics endpoint returns valid data
- [ ] No errors in first hour

### Should Have (Important)

- [ ] DLQ monitoring operational
- [ ] Pool monitoring operational
- [ ] Sentry alerts configured
- [ ] Load tests pass with green thresholds
- [ ] Response time P95 < 300ms

### Nice to Have (Optional)

- [ ] Grafana dashboards created
- [ ] Prometheus scraping configured
- [ ] DLQ webhook notifications working
- [ ] Automated alerts to on-call

---

## Risk Mitigation

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| Migration fails | High | Test on staging first; have rollback SQL ready | DevOps |
| Environment vars missing | High | Pre-deployment validation script | DevOps |
| Pool exhaustion | Medium | Monitor closely; tune DATABASE_POOL_MAX | Backend |
| DLQ threshold alerts | Medium | Investigate root cause; tune thresholds | Backend |
| Load test failures | High | Fix issues before production deployment | QA |

---

## Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| **Backend Lead** | backend@taxbridge.ng | CTO |
| **DevOps** | devops@taxbridge.ng | Infrastructure Manager |
| **On-Call Engineer** | oncall@taxbridge.ng | Engineering Manager |
| **Product Manager** | pm@taxbridge.ng | CEO |

---

## Sign-Off

- [ ] **Backend Lead:** Code reviewed and approved
- [ ] **DevOps:** Infrastructure ready
- [ ] **QA:** Load tests pass
- [ ] **Security:** Secrets management reviewed
- [ ] **Product:** Deployment authorized

**Deployment Date:** _________________  
**Deployed By:** _________________  
**Deployment Status:** _________________

---

**Next Phase:** C - UI/UX Polish & Mobile App Optimization

---

**TaxBridge Engineering Team**  
*Compliance without fear. Technology without exclusion.* 🇳🇬
