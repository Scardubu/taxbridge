# TaxBridge Launch Day Runbook (V5)

**Purpose:** Step-by-step operational playbook for production launch  
**Audience:** Engineering, Product, Ops teams  
**Status:** Execute on launch day

---

## Pre-Launch Preparation

### T-48 Hours: Final Checks

#### Code Freeze
- [ ] Merge all approved PRs to `main`
- [ ] Tag release: `git tag v1.0.0-launch && git push --tags`
- [ ] Lock `main` branch (GitHub settings)
- [ ] Notify team: "Code freeze in effect"

#### Infrastructure
- [ ] Run pre-launch checklist: `bash infra/scripts/pre-launch-check.sh`
- [ ] Verify all environment variables set (production)
- [ ] Test database backups (restore to staging)
- [ ] Verify Redis persistence enabled
- [ ] Test rollback procedure (staging)
- [ ] Scale up infrastructure (2x current capacity)

#### Monitoring
- [ ] Configure Grafana alerts (Slack + PagerDuty)
- [ ] Set up Sentry rate limits (avoid alert fatigue)
- [ ] Test Mixpanel event tracking
- [ ] Verify status page: status.taxbridge.ng
- [ ] Test SMS alerts (via Africa's Talking)

#### Team Readiness
- [ ] On-call schedule published (PagerDuty)
- [ ] War room scheduled (Zoom/Google Meet)
- [ ] Emergency contacts shared (Slack + phone)
- [ ] Runbook reviewed (all team members)

---

### T-24 Hours: Deploy & Smoke Test

#### Deployment
- [ ] Deploy backend to production
  ```bash
  git checkout main
  git pull origin main
  cd backend
  npm run build
  npm run migrate:prod
  npm run deploy:prod
  ```
- [ ] Deploy admin dashboard
  ```bash
  cd admin-dashboard
  npm run build
  vercel --prod
  ```
- [ ] Submit mobile app to stores (if not done)
  ```bash
  cd mobile
  eas build --platform all --profile production
  eas submit --platform all
  ```

#### Smoke Tests
- [ ] Backend health: `curl https://api.taxbridge.ng/health`
- [ ] Admin dashboard: https://admin.taxbridge.ng
- [ ] Create test invoice (end-to-end)
- [ ] Generate RRR (Remita)
- [ ] Submit to DigiTax (sandbox)
- [ ] Verify SMS delivery
- [ ] Test USSD menu (*123*456#)

#### Data Preparation
- [ ] Seed 100 Phase 1 users (staging → production)
- [ ] Verify user emails/phones
- [ ] Pre-generate invite codes
- [ ] Load FAQ data (chatbot)

#### Communications
- [ ] Pre-draft launch announcement (blog, Twitter)
- [ ] Notify 100 Phase 1 users (email + SMS)
- [ ] Alert SMEDAN/partners (courtesy heads-up)
- [ ] Prepare crisis communication templates

---

### T-12 Hours: Final Countdown

#### Pre-Position Assets
- [ ] Schedule social media posts (Buffer/Hootsuite)
- [ ] Queue email blasts (SendGrid)
- [ ] Prepare SMS campaigns (Africa's Talking)
- [ ] Stage blog post (WordPress)

#### Team Sync
- [ ] Final standup (9am WAT)
- [ ] Confirm on-call rotation
- [ ] Test war room Zoom link
- [ ] Review rollback procedure

#### Monitoring Setup
- [ ] Open Grafana dashboard (big screen)
- [ ] Open Sentry issues page
- [ ] Open Mixpanel live view
- [ ] Open Slack #launch channel
- [ ] Open status page admin

#### Regulatory Notifications
- [ ] Notify NDPC of launch (courtesy, if applicable)
- [ ] Alert FIRS technical contacts (DigiTax partners)
- [ ] Confirm compliance audit scheduled (within 30 days)

---

### T-1 Hour: Go Live Prep

#### Final Checks
- [ ] Verify all services healthy
  ```bash
  curl https://api.taxbridge.ng/health
  curl https://api.taxbridge.ng/health/duplo
  curl https://api.taxbridge.ng/health/remita
  ```
- [ ] Confirm database connections
- [ ] Verify Redis cache hit rate
- [ ] Check queue depths (BullMQ)
- [ ] Test payment flow (sandbox → production)

#### App Stores
- [ ] Verify iOS app published
- [ ] Verify Android app published
- [ ] Test install on 2 devices (iOS, Android)

#### Marketing Assets
- [ ] Blog post ready (draft.taxbridge.ng)
- [ ] Social posts queued
- [ ] Email blast loaded
- [ ] SMS campaign ready

#### Team Assembly
- [ ] Engineering lead online
- [ ] Product manager online
- [ ] Customer support online
- [ ] Marketing lead online
- [ ] CEO/Founder online

---

## T+0: Launch 🚀

### 00:00 - Go Public

#### App Stores
- [ ] Make iOS app public (App Store Connect)
- [ ] Make Android app public (Google Play Console)
- [ ] Update app metadata (description, screenshots)

#### Marketing Activation
- [ ] Publish blog post
  ```bash
  wp post publish <post-id> --url=taxbridge.ng
  ```
- [ ] Send social media posts (Twitter, LinkedIn, Instagram)
- [ ] Trigger email blast (100 Phase 1 users)
- [ ] Send SMS invites (100 Phase 1 users)

#### Monitoring War Room
- [ ] Open Grafana dashboard (share screen)
- [ ] Monitor Sentry errors (live)
- [ ] Watch Mixpanel signups (live)
- [ ] Track revenue dashboard (live)

#### First User Actions
- [ ] Watch for first signup (Mixpanel)
- [ ] Monitor first invoice created
- [ ] Track first NRS submission
- [ ] Celebrate first payment! 🎉

---

### 00:00 - 01:00: First Hour

#### Metrics to Watch

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Signups | 5-10 | | |
| Invoices created | 3-5 | | |
| Error rate | <1% | | |
| p95 latency | <500ms | | |
| Uptime | 100% | | |

#### Actions if Anomalies
- **Signup spike (>50/hour):** Scale infrastructure, monitor costs
- **Error rate >2%:** Investigate logs, pause marketing if needed
- **Latency >700ms:** Enable caching, add read replicas
- **DigiTax failures:** Switch to retry queue, notify users

---

### 01:00 - 06:00: Early Hours

#### Monitoring
- [ ] Review hourly metrics (Grafana)
- [ ] Check Sentry error trends
- [ ] Analyze user feedback (Twitter, WhatsApp)
- [ ] Monitor payment success rate

#### User Support
- [ ] Respond to WhatsApp messages (<15 mins)
- [ ] Answer Twitter mentions (<30 mins)
- [ ] Triage support tickets (Zendesk)
- [ ] Update FAQ based on questions

#### Performance Tuning
- [ ] Optimize slow queries (if p95 >500ms)
- [ ] Adjust rate limits (if needed)
- [ ] Clear cache (if stale data)
- [ ] Scale infrastructure (if CPU >70%)

---

### 06:00 - 24:00: First Day

#### Hourly Reviews
- [ ] Signup funnel analysis
- [ ] Invoice creation rate
- [ ] Payment success rate
- [ ] Error log digest
- [ ] User feedback summary

#### Marketing Adjustments
- [ ] Boost high-performing posts
- [ ] Pause low-performing ads
- [ ] A/B test variations
- [ ] Respond to influencer mentions

#### Engineering Tasks
- [ ] Hotfix critical bugs (if any)
- [ ] Deploy patches (if approved)
- [ ] Optimize bottlenecks
- [ ] Document incidents

---

## T+1: Day 1 Post-Launch

### Morning Review (9am WAT)

#### Metrics Dashboard

| Metric | Target | Actual | Variance |
|--------|--------|--------|----------|
| Total signups | 20-30 | | |
| Completed onboarding | 80%+ | | |
| Invoices created | 15-25 | | |
| Payments initiated | 5-10 | | |
| Error rate | <1% | | |
| Uptime | 99.9%+ | | |
| NPS (early) | ≥7 | | |

#### Team Standup
- [ ] Review signup cohort data
- [ ] Discuss user feedback themes
- [ ] Prioritize bug fixes
- [ ] Adjust marketing spend
- [ ] Plan Day 2 tasks

#### Communications
- [ ] Publish Day 1 summary (internal Slack)
- [ ] Update stakeholders (email)
- [ ] Thank early adopters (Twitter)
- [ ] Schedule Day 7 review meeting

---

## T+7: Week 1 Review

### Metrics Analysis

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Total signups | 50-100 | | |
| WAU | 60%+ | | |
| Invoices/user | 2+ | | |
| MRR | ₦5K-10K | | |
| Retention (D1, D3, D7) | 80%, 60%, 50% | | |
| NPS | ≥7 | | |
| Critical bugs | 0 | | |

### Go/No-Go for Phase 2
**Decision Criteria:**
- ✅ No critical bugs outstanding
- ✅ Uptime ≥99%
- ✅ User feedback positive (NPS ≥7)
- ✅ Infrastructure stable
- ✅ Payment flow working

**If No-Go:**
- Extend Phase 1 by 1-2 weeks
- Address all blockers
- Reschedule Phase 2 launch

---

## Crisis Management

### Severity Levels

#### P0 - Critical (Resolve <1 hour)
- **Examples:** Complete outage, data breach, payment failures (>50%)
- **Actions:**
  1. Page on-call engineer (PagerDuty)
  2. Assemble war room immediately
  3. Update status page: "Major Outage"
  4. Notify all users (SMS + email)
  5. Execute rollback if needed
  6. Conduct RCA within 4 hours

#### P1 - High (Resolve <4 hours)
- **Examples:** Partial outage, DigiTax failures (>20%), slow performance
- **Actions:**
  1. Notify engineering lead
  2. Update status page: "Degraded Performance"
  3. Investigate and fix
  4. Notify affected users
  5. Document incident

#### P2 - Medium (Resolve <24 hours)
- **Examples:** Minor UI bugs, email delivery delays, analytics issues
- **Actions:**
  1. Create Jira ticket
  2. Assign to relevant team
  3. Fix in next deploy
  4. Notify users if customer-facing

#### P3 - Low (Resolve <1 week)
- **Examples:** Cosmetic issues, documentation gaps, feature requests
- **Actions:**
  1. Add to backlog
  2. Prioritize for future sprint

---

### Incident Response Playbook

#### Step 1: Detection
- **Sources:** Sentry alert, Grafana alarm, user report, manual discovery
- **Action:** Acknowledge alert, assess severity

#### Step 2: Triage
- **Questions:**
  - How many users affected?
  - Is data at risk?
  - Can we rollback?
  - Do we need external help (DigiTax, Remita)?
- **Action:** Assign severity (P0-P3)

#### Step 3: Communication
- **Internal:** Post in #incidents Slack channel
- **External:** Update status page
- **Users:** SMS/email if customer-facing

#### Step 4: Resolution
- **Options:**
  - Rollback to last stable version
  - Hotfix and deploy
  - Scale infrastructure
  - Enable feature flags (disable problematic feature)
- **Action:** Execute fix, verify resolution

#### Step 5: Verification
- [ ] Run smoke tests
- [ ] Check metrics (Grafana)
- [ ] Confirm user reports resolved
- [ ] Update status page: "Resolved"

#### Step 6: Post-Mortem (within 24 hours)
- [ ] Document timeline
- [ ] Root cause analysis
- [ ] Action items (prevent recurrence)
- [ ] Share learnings (internal blog)

---

### Rollback Procedure

#### Prerequisites
- Database backup available (<1 hour old)
- Previous deployment tag known (e.g., `v0.9.9`)
- Redis snapshot available

#### Steps
1. **Stop current services:**
   ```bash
   render.com: Pause service (Web UI)
   ```

2. **Restore database (if needed):**
   ```bash
   pg_restore -d taxbridge_prod backup.dump
   ```

3. **Deploy previous version:**
   ```bash
   git checkout v0.9.9
   cd backend
   npm run deploy:prod
   ```

4. **Verify health:**
   ```bash
   curl https://api.taxbridge.ng/health
   ```

5. **Notify users:**
   ```
   SMS: "TaxBridge is back online after a brief interruption. 
   Sorry for the inconvenience."
   ```

6. **Document incident:**
   - Create post-mortem doc
   - Schedule RCA meeting

---

### Communication Templates

#### Major Outage (SMS)
```
TaxBridge Alert: We're experiencing technical issues. 
Our team is working to restore service. 
Updates: status.taxbridge.ng
```

#### Resolved (SMS)
```
TaxBridge Update: Service restored. Thank you for your patience. 
Need help? Reply HELP.
```

#### Regulatory Incident (NDPC)
```
Subject: TaxBridge Incident Notification

Dear NDPC Team,

We are notifying you of a [data breach/system failure] that occurred on [date] at [time].

Impact: [describe]
Users affected: [number]
Data exposed: [details]
Remediation: [actions taken]

We are available for further discussion.

Best,
TaxBridge Team
```

---

## Success Celebration 🎉

### Milestones

#### First 10 Users
- [ ] Share screenshot (Slack)
- [ ] Thank team members
- [ ] Order pizza 🍕

#### First 100 Users
- [ ] Team lunch (virtual/in-person)
- [ ] Bonuses (₦50K each)
- [ ] Press release

#### First ₦1M MRR
- [ ] Team outing
- [ ] Wellness day off
- [ ] Investor update

---

## Appendix

### Key Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Engineering Lead | [Name] | +234... | eng@taxbridge.ng |
| Product Manager | [Name] | +234... | product@taxbridge.ng |
| CEO | [Name] | +234... | ceo@taxbridge.ng |
| Customer Support | [Name] | +234... | support@taxbridge.ng |
| DigiTax Contact | [Name] | +234... | support@digitax.ng |
| Remita Support | [Name] | +234... | support@remita.net |

### Service URLs

| Service | URL | Admin |
|---------|-----|-------|
| Backend API | https://api.taxbridge.ng | - |
| Admin Dashboard | https://admin.taxbridge.ng | admin@taxbridge.ng |
| Status Page | https://status.taxbridge.ng | status@taxbridge.ng |
| Monitoring | https://grafana.taxbridge.ng | metrics@taxbridge.ng |

### Emergency Commands

```bash
# Check service health
curl https://api.taxbridge.ng/health

# View recent logs
render logs --tail 100

# Restart service
render restart taxbridge-backend

# Scale up
render scale --size=standard-2x

# Database backup
pg_dump -Fc taxbridge_prod > backup_$(date +%Y%m%d).dump

# Redis snapshot
redis-cli BGSAVE
```

---

**Remember:** Stay calm, communicate clearly, and celebrate every win! 🚀
