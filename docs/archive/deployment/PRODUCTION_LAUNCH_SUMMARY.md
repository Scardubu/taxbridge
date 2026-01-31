# TaxBridge Production Launch Summary

**Version:** 1.0  
**Status:** Pre-Launch Preparation  
**Target Launch Date:** Q1 2026  
**Document Owner:** Engineering & Operations Team  
**Last Updated:** January 2026

---

## Executive Summary

This document consolidates all pre-launch checklists, financial guardrails, deployment procedures, and rollback plans for TaxBridge's production launch. It serves as the **single source of truth** for the launch war room and on-call teams.

**Launch Readiness Status:** ✅ All systems go pending final pre-launch validation

**Critical Success Metrics:**
- **NRR ≥ 106%** (Net Revenue Retention)
- **GRR ≥ 90%** (Gross Revenue Retention)
- **LTV:CAC ≥ 4:1** (Lifetime Value to Customer Acquisition Cost)
- **P95 Latency < 200ms** (Backend API response time)
- **Uptime ≥ 99.9%** (3 nines reliability)

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [Pre-Flight Checklist](#2-pre-flight-checklist)
3. [Launch Phase Gates](#3-launch-phase-gates)
4. [Financial Guardrails](#4-financial-guardrails)
5. [Technical Architecture](#5-technical-architecture)
6. [Monitoring & Observability](#6-monitoring--observability)
7. [Rollback Procedures](#7-rollback-procedures)
8. [Incident Response](#8-incident-response)
9. [Team Roster](#9-team-roster)
10. [First 72 Hours Timeline](#10-first-72-hours-timeline)
11. [Regulatory Compliance](#11-regulatory-compliance)
12. [Community & Partnerships](#12-community--partnerships)

---

## 1. Quick Reference

### Critical URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Admin Dashboard** | https://admin.taxbridge.ng | Real-time metrics, health checks |
| **Backend API** | https://api.taxbridge.ng | Core application backend |
| **Mobile App** | https://taxbridge.ng/app | Download links (iOS/Android) |
| **Grafana** | https://grafana.taxbridge.ng | Dashboards, alerts |
| **Sentry** | https://sentry.io/taxbridge | Error tracking |
| **Mixpanel** | https://mixpanel.com/taxbridge | User analytics |
| **Status Page** | https://status.taxbridge.ng | Public uptime status |

### Emergency Contacts

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| **Incident Commander** | [Name] | +234-XXX-XXXX | ic@taxbridge.ng | @incident-cmd |
| **Backend Lead** | [Name] | +234-XXX-XXXX | backend@taxbridge.ng | @backend-lead |
| **DevOps Lead** | [Name] | +234-XXX-XXXX | devops@taxbridge.ng | @devops-lead |
| **Mobile Lead** | [Name] | +234-XXX-XXXX | mobile@taxbridge.ng | @mobile-lead |
| **Community Lead** | [Name] | +234-XXX-XXXX | community@taxbridge.ng | @community-lead |

### Critical Commands

```bash
# Health check (all services)
curl https://api.taxbridge.ng/health

# View real-time logs (backend)
heroku logs --tail --app taxbridge-api-prod

# Restart backend service
heroku restart --app taxbridge-api-prod

# Rollback to previous release
heroku rollback v42 --app taxbridge-api-prod

# Check database connections
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pg_stat_activity;"

# Redis queue depth
redis-cli -u $REDIS_URL LLEN "bull:invoice-sync:wait"

# Trigger pre-launch checks
bash infra/scripts/pre-launch-check.sh staging
```

### Credentials Vault

**Location:** 1Password (TaxBridge Production Vault)

**Secrets:**
- `DATABASE_URL` (PostgreSQL connection string)
- `REDIS_URL` (Upstash Redis URL)
- `REMITA_API_KEY` (payment gateway)
- `DIGITAX_CLIENT_ID` / `DIGITAX_CLIENT_SECRET` (e-invoicing)
- `AFRICASTALKING_API_KEY` (SMS notifications)
- `SENTRY_DSN` (error tracking)
- `MIXPANEL_TOKEN` (analytics)
- `ADMIN_API_KEY` (dashboard authentication)

---

## 2. Pre-Flight Checklist

### 2.1 Infrastructure (50+ checks)

**From `infra/scripts/pre-launch-check.sh`:**

#### Section 1: Required Tools
- [ ] `bash` 4.0+
- [ ] `curl` with SSL
- [ ] `jq` for JSON parsing
- [ ] `psql` (PostgreSQL client)
- [ ] `redis-cli` (Redis client)
- [ ] `node` 18.x+
- [ ] `npm` 9.x+
- [ ] `git` 2.x+

#### Section 2: Core Services
- [ ] PostgreSQL reachable (`DATABASE_URL`)
- [ ] Redis reachable (`REDIS_URL`)
- [ ] Backend API responding (`/health` → 200)
- [ ] Admin dashboard accessible (HTTPS)

#### Section 3: External Integrations
- [ ] DigiTax API reachable (e-invoicing)
- [ ] Remita API reachable (payments)
- [ ] Africa's Talking SMS working
- [ ] Sentry receiving errors
- [ ] Mixpanel receiving events

#### Section 4: Security & Compliance
- [ ] All `.env` files excluded from git
- [ ] `ADMIN_API_KEY` rotated (< 90 days old)
- [ ] HTTPS enforced (no HTTP fallback)
- [ ] CORS configured (whitelist only)
- [ ] Rate limiting enabled (100 req/min/IP)
- [ ] SQL injection protection (Prisma ORM)
- [ ] XSS protection headers set
- [ ] NDPC DPIA completed and signed
- [ ] ML model file < 10MB (`ML_MODEL_PATH`)
- [ ] TensorFlow.js installed (`@tensorflow/tfjs-node`)

#### Section 5: Database Schema
- [ ] All critical tables exist:
  - `users`
  - `invoices`
  - `payments`
  - `sync_queue`
  - `audit_logs`
  - `alerts`
- [ ] Database indexes: 10+ indexes on high-traffic columns
- [ ] Prisma migrations applied (no pending)

#### Section 6: API Endpoints
- [ ] `/health` (backend) → 200
- [ ] `/metrics` (Prometheus) → 200
- [ ] `/api/admin/stats` → 200 (with valid `ADMIN_API_KEY`)
- [ ] `/api/admin/launch-metrics` → JSON with NRR/GRR
- [ ] `/api/invoices` → 401 (auth required)
- [ ] `/api/payments/remita/webhook` → 200 (POST with valid signature)

#### Section 7: Queue Infrastructure
- [ ] Invoice sync worker running (`bull:invoice-sync:wait` exists)
- [ ] Email campaign queue initialized (`bull:email-campaign:wait`)
- [ ] SMS campaign queue initialized (`bull:sms-campaign:wait`)
- [ ] Failed job count < 10 (per queue)

#### Section 8: Monitoring & Alerts
- [ ] Sentry DSN configured (`SENTRY_DSN`)
- [ ] Sentry receiving test errors
- [ ] Grafana dashboard accessible
- [ ] Prometheus scraping `/metrics`
- [ ] Mixpanel receiving test events
- [ ] PagerDuty integration active (critical alerts)

#### Section 9: Mobile App
- [ ] EAS build completed (Android + iOS)
- [ ] App submitted to Play Store (review pending)
- [ ] App submitted to App Store (review pending)
- [ ] Deep links configured (`taxbridge://`)
- [ ] Offline mode tested (SQLite sync)
- [ ] Unit tests passing (139 tests)

#### Section 10: Documentation
- [ ] `README.md` up to date
- [ ] `docs/PRD.md` finalized
- [ ] `docs/launch-plan.md` reviewed
- [ ] `docs/launch-day-runbook.md` rehearsed
- [ ] `docs/community-strategy.md` approved
- [ ] `PRODUCTION_LAUNCH_SUMMARY.md` (this doc) circulated

#### Section 11: Partnership & Community Readiness
- [ ] SMEDAN partnership documented (`docs/community-strategy.md`)
- [ ] Ambassador roster: 5+ pilot ambassadors (`partnerships/ambassadors.csv`)
- [ ] Referral code generator endpoint active (`/api/referral/generate`)
- [ ] Growth service queues initialized (email, SMS)

---

## 3. Launch Phase Gates

### Phase 1: Controlled Pilot (Month 0-1)

**Target:** 100 users (invite-only)

**Entry Criteria:**
- All pre-flight checks pass (Section 2)
- 5 pilot ambassadors trained
- SMEDAN partnership signed

**Success Metrics:**
| Metric | Target | Current |
|--------|--------|---------|
| Active users | 100 | - |
| Invoices created | 500 | - |
| NRR | ≥100% | - |
| GRR | ≥85% | - |
| Crash-free rate | ≥99% | - |
| P95 latency | <200ms | - |
| Support tickets | <20 | - |

**Exit Criteria:**
- All success metrics met
- No P0/P1 bugs
- NPS ≥ 40

### Phase 2: Regional Expansion (Month 2-3)

**Target:** 1,000 users (Lagos, Kano, Onitsha)

**Entry Criteria:**
- Phase 1 gates passed
- 10 ambassadors onboarded
- 2 trade associations partnered

**Success Metrics:**
| Metric | Target | Current |
|--------|--------|---------|
| Active users | 1,000 | - |
| Invoices created | 5,000 | - |
| NRR | ≥103% | - |
| GRR | ≥88% | - |
| Referral rate | ≥20% | - |
| Crash-free rate | ≥99.5% | - |
| P95 latency | <200ms | - |

**Exit Criteria:**
- All success metrics met
- No P0 bugs, <3 P1 bugs
- NPS ≥ 50

### Phase 3: National Launch (Month 4-6)

**Target:** 10,000 users (all 6 geopolitical zones)

**Entry Criteria:**
- Phase 2 gates passed
- 20 ambassadors active
- 5 partnerships (SMEDAN + 3 trade associations + 1 NGO)

**Success Metrics:**
| Metric | Target | Current |
|--------|--------|---------|
| Active users | 10,000 | - |
| Invoices created | 50,000 | - |
| **NRR** | **≥106%** | - |
| **GRR** | **≥90%** | - |
| **LTV:CAC** | **≥4:1** | - |
| MRR | ≥₦5M | - |
| Referral rate | ≥30% | - |
| Crash-free rate | ≥99.9% | - |
| P95 latency | <200ms | - |
| Uptime | ≥99.9% | - |

**Exit Criteria:**
- **All success metrics met (financial guardrails critical)**
- No P0 bugs, <2 P1 bugs
- NPS ≥ 60
- Revenue positive (MRR > burn rate)

### Phase 4: Scale & Optimize (Month 7-12)

**Target:** 50,000 users, ₦20M MRR

**Focus Areas:**
- Enterprise sales (B2B partnerships)
- API monetization (developers)
- Premium feature adoption (80% free → paid conversion)
- International expansion (Ghana, Kenya)

---

## 4. Financial Guardrails

### 4.1 Critical Thresholds (Phase 3 Launch Gate)

| Metric | Formula | Target | Watch | Risk |
|--------|---------|--------|-------|------|
| **NRR** | Current MRR (prev users) / Prev Total MRR | **≥106%** | 100-105% | <100% |
| **GRR** | Min(Current, Prev) MRR / Prev Total MRR | **≥90%** | 85-89% | <85% |
| **LTV:CAC** | (ARPU × Avg Lifetime) / CAC | **≥4:1** | 3:1-4:1 | <3:1 |
| **Churn Rate** | Lost users / Total users (monthly) | **<5%** | 5-7% | >7% |
| **CAC** | (Marketing + Sales) / New Users | **<₦2,000** | ₦2K-₦3K | >₦3K |
| **Burn Multiple** | Net Burn / Net New ARR | **<1.5x** | 1.5x-2x | >2x |

### 4.2 Revenue Drivers (Tracked in LaunchMetricsWidget)

**Expansion Revenue:**
- Free → Premium upgrades (₦5K/month)
- API usage overages (₦10K/month for 10K+ calls)
- Enterprise licenses (₦50K/month for 10+ users)

**New MRR:**
- New user signups converting to paid (target: 30% conversion after 30 days)

**Contraction Revenue:**
- Downgrades (Premium → Free, rare)

**Churned MRR:**
- Account deletions
- Payment failures (auto-retry 3x, then churn)

### 4.3 Dashboard Monitoring

**Admin Dashboard (`/dashboard`):**
- Real-time NRR/GRR/MRR tiles (refreshes every 60s)
- Revenue drivers panel (expansion, new, contraction, churned)
- 30-day comparison window (MoM growth)
- Anomaly feed (critical/high/warning alerts)

**Mixpanel Cohorts:**
- Segment users by:
  - Signup date (cohort analysis)
  - Revenue tier (free, premium, enterprise)
  - Region (Lagos, Kano, Onitsha, etc.)
  - Segment (trader, freelancer, transporter)

---

## 5. Technical Architecture

### 5.1 System Overview

```
┌─────────────────┐
│   Mobile App    │ (React Native 0.81 + Expo 54)
│  iOS / Android  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Load Balancer  │ (Nginx / Cloudflare)
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│   Backend API   │◄────►│  PostgreSQL  │ (Supabase / Render)
│ Fastify 5.6.2   │      │   15.x       │
└────────┬────────┘      └──────────────┘
         │
         │ Redis
         ▼
┌─────────────────┐
│   BullMQ Queues │ (Upstash Redis 7.x)
│ - invoice-sync  │
│ - email-campaign│
│ - sms-campaign  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Workers        │
│ - InvoiceSyncW  │
│ - EmailWorker   │
│ - SMSWorker     │
└─────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   External Integrations             │
│ - DigiTax (e-invoicing via APP)     │
│ - Remita (payments)                 │
│ - Africa's Talking (SMS)            │
│ - Sentry (errors)                   │
│ - Mixpanel (analytics)              │
└─────────────────────────────────────┘
```

### 5.2 Key Components

**Backend (`backend/src/`):**
- `server.ts` – Fastify app initialization
- `routes/admin.ts` – Admin endpoints (`/stats`, `/launch-metrics`)
- `routes/invoices.ts` – Invoice CRUD
- `routes/payments.ts` – Remita webhook handling
- `services/growth.ts` – Campaign automation (NEW)
- `services/analytics.ts` – Chatbot metrics, compliance
- `queue/index.ts` – Invoice sync worker
- `integrations/digitax/` – NRS e-invoicing via APP
- `integrations/remita/` – Payment gateway

**Admin Dashboard (`admin-dashboard/`):**
- `app/dashboard/page.tsx` – Main dashboard
- `components/LaunchMetricsWidget.tsx` – NRR/GRR/MRR tiles (NEW)
- `components/HealthCard.tsx` – Service health checks
- `components/RemitaTransactionChart.tsx` – Payment analytics

**Mobile App (`mobile/src/`):**
- `screens/Onboarding/` – 6-step user onboarding
- `screens/Invoices/` – Invoice creation, history
- `screens/Receipts/` – OCR capture, digitization
- `services/sync.ts` – Offline-first sync logic (SQLite → API)

### 5.3 Data Flow (Invoice Creation)

1. User creates invoice in mobile app (offline mode)
2. Invoice stored in local SQLite database
3. Background sync job queues invoice to API (when online)
4. Backend validates invoice, stores in PostgreSQL
5. BullMQ worker picks up invoice from `invoice-sync` queue
6. Worker generates UBL 3.0 XML
7. Worker submits to DigiTax (NRS e-invoicing via APP)
8. DigiTax returns CSID, IRN, QR code
9. Worker updates invoice in database, sends SMS notification
10. Mobile app syncs updated invoice (CSID, IRN visible to user)

---

## 6. Monitoring & Observability

### 6.1 Metrics Dashboards (Grafana)

**Dashboard 1: System Health**
- Backend API:
  - Request rate (req/s)
  - P50/P95/P99 latency
  - Error rate (4xx, 5xx)
  - Active connections
- Database:
  - Query latency
  - Connection pool usage
  - Slow queries (>1s)
- Redis:
  - Memory usage
  - Queue depth (invoice-sync, email, SMS)
  - Keyspace hits/misses

**Dashboard 2: Business Metrics**
- Users:
  - Active users (DAU, WAU, MAU)
  - New signups
  - Churn rate
- Revenue:
  - NRR, GRR, MRR
  - Revenue drivers (expansion, new, contraction, churned)
- Invoices:
  - Created (daily, weekly)
  - Submitted to NRS (success rate)
  - Failed submissions (error breakdown)
- Payments:
  - RRR generated
  - Payments completed
  - Remita webhook latency

**Dashboard 3: Mobile App**
- Crash-free rate (iOS, Android)
- App launch time (P95)
- Screen load time (P95)
- Offline sync success rate
- OCR accuracy rate

### 6.2 Alerts (PagerDuty)

**P0 (Critical – Page immediately):**
- Backend API down (>5min)
- Database connection lost
- Redis down (queues blocked)
- NRR < 100% for 2 consecutive days
- Crash-free rate < 95%

**P1 (High – Notify Slack):**
- P95 latency > 500ms (sustained 10min)
- Error rate > 5% (sustained 5min)
- Invoice sync failure rate > 10%
- Remita webhook failures > 20/hour
- GRR < 90% for 2 consecutive days

**P2 (Medium – Log & review):**
- Failed job count > 50 (any queue)
- Database slow queries > 100/hour
- SMS delivery failures > 10%
- Churn rate > 7% (monthly)

### 6.3 Log Aggregation (Sentry)

**Error Tracking:**
- Backend: All unhandled exceptions auto-reported
- Mobile: Crash reports, ANRs (Android), OOMs
- Admin Dashboard: React error boundaries

**Structured Logging:**
```typescript
logger.info('Invoice created', {
  userId: '123',
  invoiceId: '456',
  amount: 50000,
  currency: 'NGN'
});
```

**Log Levels:**
- `error` – Exceptions, API failures
- `warn` – Validation errors, deprecated features
- `info` – Business events (invoice created, payment completed)
- `debug` – Verbose (queue jobs, retries)

---

## 7. Rollback Procedures

### 7.1 Backend Rollback (Heroku)

**Trigger Conditions:**
- P0 incident (API down, data corruption)
- NRR drop > 5% within 24 hours
- Critical bug discovered post-deploy

**Procedure:**
```bash
# Step 1: Identify last stable release
heroku releases --app taxbridge-api-prod

# Step 2: Rollback to previous version
heroku rollback v42 --app taxbridge-api-prod

# Step 3: Verify health
curl https://api.taxbridge.ng/health

# Step 4: Notify team (Slack #incidents)
# Step 5: Schedule RCA (Root Cause Analysis)
```

**Expected Downtime:** 2-5 minutes

### 7.2 Database Rollback (Prisma Migrations)

**Trigger Conditions:**
- Migration breaks queries
- Data integrity violation

**Procedure:**
```bash
# Step 1: Identify failing migration
npx prisma migrate status

# Step 2: Rollback to previous migration (manual SQL)
psql $DATABASE_URL -c "DELETE FROM _prisma_migrations WHERE migration_name='20260115_add_churn_fields';"

# Step 3: Revert schema.prisma changes (git revert)
git revert <commit-hash>

# Step 4: Deploy schema fix
git push heroku main

# Step 5: Re-run migrations
npx prisma migrate deploy
```

**Expected Downtime:** 10-15 minutes

### 7.3 Mobile App Rollback (EAS)

**Trigger Conditions:**
- Crash-free rate < 90%
- Login failures > 20%

**Procedure:**
```bash
# Step 1: Pull previous build from EAS
eas build:list --platform all

# Step 2: Publish rollback (OTA update)
eas update --branch production --message "Rollback to v1.2.3"

# Step 3: Monitor crash rate (Sentry)
# Step 4: If OTA fails, publish hotfix to stores
```

**Expected Resolution:** 30-60 minutes (OTA), 24-48 hours (store approval)

### 7.4 Rollback Decision Matrix

| Severity | Impact | Decision Maker | Max Downtime | Rollback Type |
|----------|--------|----------------|--------------|---------------|
| P0 | API down | Incident Commander | 5 min | Backend + DB |
| P1 | High error rate | Backend Lead | 15 min | Backend only |
| P2 | Feature broken | Product Manager | N/A | Feature flag off |

---

## 8. Incident Response

### 8.1 Incident Severity Levels

**P0 (Critical):**
- **Definition:** Core functionality unavailable for all users
- **Examples:** Backend API down, database unreachable, payment failures
- **Response Time:** < 5 minutes
- **Escalation:** Page Incident Commander immediately

**P1 (High):**
- **Definition:** Core functionality degraded for subset of users
- **Examples:** Slow API responses, intermittent errors, invoice sync delays
- **Response Time:** < 15 minutes
- **Escalation:** Notify Slack #incidents, page if unresolved in 30min

**P2 (Medium):**
- **Definition:** Non-core functionality broken, workaround available
- **Examples:** OCR accuracy low, export CSV failing, mobile app analytics down
- **Response Time:** < 1 hour
- **Escalation:** Log in Jira, address in next sprint

**P3 (Low):**
- **Definition:** Cosmetic issues, minor bugs
- **Examples:** UI misalignment, typos, missing translations
- **Response Time:** < 1 day
- **Escalation:** Backlog review

### 8.2 Incident Response Workflow

```
1. Detect (Grafana alert / User report)
   ↓
2. Triage (Determine severity: P0-P3)
   ↓
3. Notify (Slack #incidents, PagerDuty for P0/P1)
   ↓
4. Investigate (Logs, metrics, user impact)
   ↓
5. Mitigate (Rollback, feature flag, hotfix)
   ↓
6. Communicate (Status page, email, Slack)
   ↓
7. Resolve (Verify fix, monitor for 1 hour)
   ↓
8. RCA (Root Cause Analysis within 24 hours)
```

### 8.3 RCA Template

**Incident ID:** INC-2026-001  
**Date:** 2026-01-15  
**Severity:** P1  
**Duration:** 45 minutes (12:30pm - 1:15pm WAT)  
**Affected Users:** ~200 (Lagos region)

**Summary:**
[Brief description of incident]

**Timeline:**
- 12:30pm: Alert triggered (P95 latency > 500ms)
- 12:35pm: Team paged
- 12:45pm: Root cause identified (database connection pool exhausted)
- 1:00pm: Mitigation deployed (increased pool size from 10 → 20)
- 1:15pm: Incident resolved, monitoring resumed

**Root Cause:**
[Technical explanation]

**Impact:**
- 200 users experienced slow invoice creation (>5s load time)
- 0 data loss
- 0 payments failed

**Action Items:**
- [ ] Increase DB connection pool to 30 (owner: Backend Lead, due: 2026-01-16)
- [ ] Add alert for pool usage > 80% (owner: DevOps, due: 2026-01-17)
- [ ] Stress test with 1000 concurrent users (owner: QA, due: 2026-01-20)

**Lessons Learned:**
[What went well, what didn't, how to improve]

---

## 9. Team Roster

### 9.1 On-Call Schedule (Week of Jan 15-21, 2026)

| Day | Primary | Secondary | Escalation |
|-----|---------|-----------|------------|
| Mon | Backend Lead | DevOps Lead | Incident Commander |
| Tue | Backend Lead | Mobile Lead | Incident Commander |
| Wed | DevOps Lead | Backend Lead | Incident Commander |
| Thu | DevOps Lead | Mobile Lead | Incident Commander |
| Fri | Mobile Lead | Backend Lead | Incident Commander |
| Sat | Mobile Lead | DevOps Lead | Incident Commander |
| Sun | Incident Commander | Backend Lead | CTO |

### 9.2 Communication Channels

**Slack:**
- `#incidents` – Real-time incident coordination
- `#on-call` – Shift handoffs, notes
- `#engineering` – General eng discussions
- `#launch-war-room` – Launch week only

**PagerDuty:**
- **P0:** Page on-call engineer (SMS + call)
- **P1:** Slack notification to #incidents
- **P2:** Email to engineering team

**Email:**
- `incidents@taxbridge.ng` – Incident reports
- `on-call@taxbridge.ng` – On-call roster

### 9.3 Runbook Links

- [Backend Deployment Runbook](../backend/DEPLOYMENT.md)
- [Database Migration Runbook](../backend/db/MIGRATIONS.md)
- [Monitoring Runbook](../docs/MONITORING_IMPLEMENTATION.md)
- [Security Incident Response](../docs/SECURITY_ARCHITECTURE.md)
- [Launch Day Runbook](../docs/launch-day-runbook.md)

---

## 10. First 72 Hours Timeline

### Hour 0-6: Launch (Soft Launch to Pilot Users)

**9:00am:** War room convenes (Zoom + Slack)

**9:15am:** Final pre-launch check (`pre-launch-check.sh`)
- [ ] All services healthy
- [ ] Database backups confirmed (< 1 hour old)
- [ ] Redis queues empty (no stuck jobs)
- [ ] Monitoring alerts active

**10:00am:** Enable public signups
- [ ] Update feature flag: `PUBLIC_SIGNUPS=true`
- [ ] Deploy backend config
- [ ] Test signup flow (3 test users)

**10:30am:** Notify pilot ambassadors (WhatsApp)
- [ ] Send invite links (5 ambassadors × 20 users each = 100 target)

**11:00am:** Monitor dashboards
- [ ] Grafana: System health (every 15 min)
- [ ] Sentry: Error rate (should be ~0)
- [ ] Mixpanel: Signup events (expect 10-20/hour)

**12:00pm:** Lunch break (staggered, maintain 2 engineers on watch)

**1:00pm:** First metrics review
- [ ] Active users: Target 20+
- [ ] Invoices created: Target 50+
- [ ] Crash-free rate: Target 100%
- [ ] P95 latency: Target <200ms

**3:00pm:** Community engagement
- [ ] Post launch announcement (Twitter, Instagram, LinkedIn)
- [ ] Ambassadors share success stories (WhatsApp)

**5:00pm:** Evening peak monitoring
- [ ] Check for traffic spikes (Lagos traders closing shops)

**6:00pm:** End of Day 1 summary (Slack #launch-war-room)
- [ ] Total users onboarded
- [ ] Incidents (P0/P1/P2 count)
- [ ] NRR/GRR baseline (if applicable)
- [ ] Action items for Day 2

### Hour 6-24: Stabilization

**7:00pm:** Reduced monitoring cadence (every 30 min)

**9:00pm:** On-call handoff (Primary → Secondary)

**11:59pm:** Day 1 metrics snapshot
- [ ] Export data to spreadsheet (DAU, invoices, payments)

**12:00am - 6:00am:** Night shift (automated alerts only, wake on P0)

**6:00am:** Morning review (Day 2)
- [ ] Check overnight incidents
- [ ] Review failed jobs (queues)
- [ ] Test mobile app sync (simulate overnight usage)

**9:00am:** Day 2 war room (Zoom + Slack)
- [ ] Review Day 1 performance
- [ ] Prioritize bugs (P0/P1 fixes only)
- [ ] Communicate progress to stakeholders

### Hour 24-48: Growth Phase

**Day 2 Focus:**
- [ ] Scale ambassador outreach (from 5 to 10 ambassadors)
- [ ] Host first tax clinic (Lagos pilot)
- [ ] Monitor NRR/GRR (start cohort tracking)
- [ ] Address any P1 bugs discovered

**Day 2 Metrics Review (3:00pm):**
- [ ] Active users: Target 50+
- [ ] Invoices created: Target 200+
- [ ] Referral signups: Target 5+ (10% of new users)
- [ ] Crash-free rate: Target 99%+

**Day 2 End of Day (6:00pm):**
- [ ] Update launch plan (track Phase 1 gates)
- [ ] Schedule Day 3 retrospective

### Hour 48-72: Optimization

**Day 3 Focus:**
- [ ] Analyze user feedback (support tickets, NPS surveys)
- [ ] Optimize slow queries (if any detected)
- [ ] Increase ambassador targets (20 users each → 30)
- [ ] Prepare Phase 2 expansion plan (Lagos → Kano)

**Day 3 Metrics Review (3:00pm):**
- [ ] Active users: Target 100 (Phase 1 gate)
- [ ] Invoices created: Target 500+
- [ ] NRR: Target ≥100% (baseline)
- [ ] GRR: Target ≥85% (baseline)
- [ ] Crash-free rate: Target 99%+

**Day 3 Retrospective (5:00pm):**
- [ ] What went well?
- [ ] What didn't go well?
- [ ] Action items for Phase 2
- [ ] Celebrate wins 🎉

---

## 11. Regulatory Compliance

### 11.1 Nigeria Revenue Service (NRS)

**e-Invoicing Mandate:**
- All invoices must be submitted to NRS via **accredited Access Point Provider (APP)**
- TaxBridge uses **DigiTax** as APP (NITDA-accredited)
- Invoice format: **UBL 3.0 / Peppol BIS Billing 3.0**

**Compliance Checklist:**
- [ ] UBL 3.0 XML generation validated (XSD schema)
- [ ] CSID (Clearance Status ID) stored for all invoices
- [ ] IRN (Invoice Reference Number) displayed to users
- [ ] QR code generated and embedded in invoice PDF
- [ ] Submission logs retained (7 years per Tax Act 2025)

**Audit Trails:**
- All invoice CRUD operations logged in `audit_logs` table
- Fields: `action`, `userId`, `invoiceId`, `metadata`, `timestamp`
- Immutable logs (no UPDATE/DELETE permissions)

### 11.2 NDPC / NDPR (Data Protection)

**DPIA Status:** ✅ Completed and signed (see `docs/DPIA.pdf`)

**Data Minimization:**
- Only collect: name, phone, email, TIN (optional), business name
- No NIN storage (user responsibility to provide for tax filing)
- Payment data: encrypted at rest (AES-256)

**User Rights:**
- **Access:** Users can export all data (JSON/CSV via app)
- **Rectification:** Users can edit profile anytime
- **Deletion:** Account deletion requests honored within 30 days (with 7-year audit retention)

**Security Measures:**
- Encryption: TLS 1.3 (in transit), AES-256 (at rest)
- Access control: Role-based (admin, user, auditor)
- Audit logs: Immutable, retained 7 years

### 11.3 Stablecoin Compliance (Future)

**Phase 4+ (Not MVP):**
- Accept USDC/USDT for invoice payments
- Tax treatment: Stablecoin payments logged as NGN equivalent (exchange rate at payment time)
- Audit trail: Blockchain tx hash stored in `payment.metadata`

---

## 12. Community & Partnerships

### 12.1 SMEDAN Partnership

**Status:** MoU in negotiation (Q1 2026)

**Collaboration:**
- Co-host 10 tax clinics (SMEDAN-funded venues)
- Feature TaxBridge in SMEDAN newsletter (150K subscribers)
- Joint webinar series: "MSMEs & Tax Compliance"

**Ambassador Contact:** Fatima Abubakar (SMEDAN Liaison)

### 12.2 Ambassador Program

**Current Roster (5 Pilot Ambassadors):**
1. Iyabo Adeyemi (Lagos – Yaba Market)
2. Chukwudi Okafor (Onitsha – Main Market)
3. Aisha Bello (Kano – Kantin Kwari)
4. Emeka Nwankwo (Port Harcourt – Fintech Hub)
5. Fatima Abubakar (Abuja – SMEDAN Liaison)

**Target:** 20 ambassadors by Month 6, 50 by Year 1

**Monthly Stipend:** ₦50,000 (performance-based)

### 12.3 WhatsApp Community

**Main Channel:** TaxBridge Users
- **Target Size:** 2,000 members by Month 3
- **Moderation:** 3 community managers (9am-9pm coverage)
- **Content:** Daily tax tips, weekly Q&A, monthly AMAs

### 12.4 Events Calendar (Month 1-3)

**Week 1:**
- Launch announcement (Twitter, Instagram, LinkedIn)
- Pilot clinic: Lagos Yaba Market (Jan 22, 2026)

**Week 2:**
- Pilot clinic: Kano Kantin Kwari (Jan 29, 2026)
- Webinar: "New e-Invoicing Rules Explained" (Feb 1, 2026)

**Week 3:**
- Pilot clinic: Onitsha Main Market (Feb 5, 2026)

**Week 4:**
- NPS survey sent (30-day cohort)
- Retrospective: Phase 1 performance

---

## 13. Appendices

### Appendix A: Glossary

- **NRR:** Net Revenue Retention (revenue from existing users, including expansion)
- **GRR:** Gross Revenue Retention (revenue from existing users, excluding expansion)
- **LTV:** Lifetime Value (average revenue per user over their lifetime)
- **CAC:** Customer Acquisition Cost (marketing + sales cost per new user)
- **MRR:** Monthly Recurring Revenue
- **CSID:** Clearance Status ID (NRS e-invoicing reference)
- **IRN:** Invoice Reference Number (NRS-issued unique ID)
- **UBL:** Universal Business Language (XML invoice format)
- **APP:** Access Point Provider (accredited NRS e-invoicing gateway)

### Appendix B: References

- [PRD (Product Requirements Document)](../docs/PRD.md)
- [Launch Plan (4-Phase Roadmap)](../docs/launch-plan.md)
- [Launch Day Runbook (Hourly Checklist)](../docs/launch-day-runbook.md)
- [Monitoring Implementation](../docs/MONITORING_IMPLEMENTATION.md)
- [Security Architecture](../docs/SECURITY_ARCHITECTURE.md)
- [Community Strategy](../docs/community-strategy.md)

### Appendix C: Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-15 | Initial draft (pre-launch) | Engineering Team |
| - | - | Next review: Post-launch (Month 1) | - |

---

**END OF DOCUMENT**

---

**War Room Zoom Link:** [zoom.us/taxbridge-launch-war-room](#)  
**Slack Channel:** #launch-war-room  
**PagerDuty:** [taxbridge.pagerduty.com](#)  
**Status Page:** [status.taxbridge.ng](#)

**Last Updated:** January 2026  
**Next Review:** Post-Launch (Month 1)
