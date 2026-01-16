# TaxBridge Production Launch Plan (V5)

**Date:** January 2026  
**Status:** Execution Ready  
**Objective:** Safe, phased rollout with real-time monitoring and financial discipline

---

## Phase 1: Soft Launch (Week 1-2) - 100 Users

### Goal
Validate production infrastructure with controlled user cohort.

### Target Users
- 50 market traders (Lagos, Kano)
- 30 freelancers (tech, creative)
- 20 small businesses (retail, services)

### Distribution
- Direct email/SMS invites
- Personal onboarding calls
- WhatsApp support group

### Activities
1. **Day 1-2:** Send invites to 100 pre-qualified users
2. **Day 3-5:** Conduct 1:1 onboarding calls (30 mins each)
3. **Day 6-10:** Daily check-ins via WhatsApp
4. **Day 11-14:** Collect feedback surveys

### Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Signup completion | 80%+ | | |
| Invoices created | 80%+ users | | |
| NRS submission success | 95%+ | | |
| Critical bugs | 0 | | |
| P1/P2 bugs | <3 | | |
| Uptime | 99%+ | | |
| p95 latency | <500ms | | |
| NPS | ≥7 | | |
| GRR (if applicable) | >90% | | |

### Monitoring
- Real-time Grafana dashboard
- Hourly Sentry error review
- Daily Mixpanel cohort analysis
- Manual payment reconciliation

### Contingency Plan
**Trigger:** Uptime <95%, critical bugs, or NRS success <90%

**Actions:**
1. Pause new signups immediately
2. Alert all stakeholders via Slack
3. Roll back to last stable deployment
4. Notify active users via SMS
5. Conduct emergency RCA within 4 hours
6. Fix and redeploy within 24 hours

**Extend Phase 1 if:**
- Churn >5%
- NPS <7
- >3 P1 bugs unresolved

### Go/No-Go Decision (Day 14)
**Criteria to proceed to Phase 2:**
- ✅ All success metrics met
- ✅ Zero critical bugs
- ✅ Infrastructure stable (99%+ uptime)
- ✅ NRR >100% (if measurable)
- ✅ User feedback positive (NPS ≥7)

---

## Phase 2: Limited Public Launch (Week 3-4) - 1,000 Users

### Goal
Scale infrastructure and validate acquisition channels.

### Distribution
- App store launch (iOS, Android)
- Social media ads (₦200K budget)
- Market union partnerships (3 unions)
- SMEDAN collaboration

### Marketing Strategy
- **Channels:** Facebook, Instagram, Twitter, LinkedIn
- **Budget:** ₦200,000 (₦20/user CAC target)
- **Creative:** Video testimonials from Phase 1 users
- **Copy:** "Tax Without Fear" campaign
- **Landing Page:** taxbridge.ng/launch

### A/B Tests
1. Onboarding flow: English vs Pidgin first
2. Pricing: Show premium features vs hide until upgrade
3. CTA: "Start Free" vs "Try TaxBridge"

### Activities
1. **Day 15-16:** App store submission
2. **Day 17-18:** Launch marketing campaigns
3. **Day 19-21:** Monitor acquisition funnel
4. **Day 22-28:** Iterate based on data

### Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Total signups | 1,000 | | |
| WAU | 60%+ | | |
| Invoices/user | 3+ | | |
| Payment success | 95%+ | | |
| p95 latency | <500ms | | |
| Uptime | 99%+ | | |
| CAC | ≤₦1,500 | | |
| GRR | >90% | | |
| NRR | >100% | | |

### Monitoring
- Mixpanel funnel analysis (signup → invoice → payment)
- Daily revenue dashboard
- Cohort retention tracking
- CAC/LTV calculation

### Contingency Plan
**Trigger:** Error rate >2% for 3+ hours, viral negative feedback

**Actions:**
1. Pause paid marketing spend
2. Enable feature flags to disable problematic features
3. Scale infrastructure if capacity issues
4. Fix critical issues within 4 hours
5. Resume marketing after stability confirmed

**Pivot if:**
- Non-Lagos users <30% (adjust regional targeting)
- USSD usage <10% (increase USSD promotion)
- Churn >5% in first week

### Go/No-Go Decision (Day 28)
**Criteria to proceed to Phase 3:**
- ✅ 1,000+ users achieved
- ✅ WAU ≥60%
- ✅ NRR >106%
- ✅ Infrastructure scaled successfully
- ✅ CAC payback trajectory <15 months

---

## Phase 3: Regional Expansion (Week 5-8) - 10,000 Users

### Goal
Expand to 5 states and validate product-market fit.

### Target States
1. Lagos (continue growth)
2. Kano (Northern market)
3. Rivers (Port Harcourt)
4. Enugu (Eastern market)
5. Kaduna (Northern expansion)

### Localization
- Hausa translations (add to i18n)
- Igbo translations (add to i18n)
- Regional payment methods
- Local market union partnerships

### Strategy
- **Ambassadors:** Recruit 5 ambassadors (1 per state)
- **Partnerships:** SMEDAN state chapters, market unions
- **USSD:** Promote USSD menu for low-data users
- **Events:** 5 tax clinics (1 per state)

### Activities
1. **Week 5:** Launch in Kano + Rivers
2. **Week 6:** Launch in Enugu + Kaduna
3. **Week 7:** Host tax clinics
4. **Week 8:** Iterate based on regional feedback

### Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Total users | 10,000 | | |
| Non-Lagos users | 50%+ | | |
| USSD engagement | 30%+ | | |
| Invoices/user | 3+ | | |
| MRR | ₦500K-1M | | |
| Uptime | 99.5%+ | | |
| NRR | >106% | | |
| GRR | >90% | | |
| CAC | ≤₦1,500 | | |

### Infrastructure
- Enable CDN (Cloudflare)
- Add autoscaling (Render)
- Regional SMS routing
- Database read replicas

### Contingency Plan
**Trigger:** Regional adoption <30%, infrastructure bottlenecks

**Actions:**
1. Increase ambassador stipends
2. Adjust regional marketing spend
3. Add infrastructure capacity
4. Localize more content

**Pivot if:**
- Non-Lagos <30%: Focus on Lagos until saturated
- USSD <10%: Increase USSD education
- MRR <₦500K: Reassess pricing/conversion

### Go/No-Go Decision (Week 8)
**Criteria to proceed to Phase 4:**
- ✅ 10,000+ users achieved
- ✅ Non-Lagos ≥50%
- ✅ MRR ≥₦500K
- ✅ NRR ≥110%
- ✅ Infrastructure stable at scale

---

## Phase 4: National Launch (Month 3-6) - 50,000+ Users

### Goal
Achieve nationwide presence and break-even.

### Distribution
- National TV ads (AIT, Channels TV)
- Bank partnerships (GTBank, Access, Zenith)
- Fintech collaborations (Paystack, Flutterwave)
- Government MoUs (FIRS, SMEDAN)

### Marketing Budget
- ₦5M initial (Month 3)
- ₦10M scale (Month 4-6)
- Target CAC: ≤₦1,500

### Pilot Programs
- Stablecoin compliance pilots (for cross-border)
- Multi-entity support (for growing businesses)
- AI tax savings assistant

### Activities
1. **Month 3:** Launch national TV campaign
2. **Month 4:** Bank integrations (GTBank pilot)
3. **Month 5:** Stablecoin audit rails (sandbox)
4. **Month 6:** Break-even celebration

### Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Total users | 50,000+ | | |
| MAU | 35,000+ | | |
| MRR | ₦4M-6M | | |
| Break-even | Achieved | | |
| Tax tracked | ₦20B+ | | |
| Uptime | 99.9%+ | | |
| NRR | 110-120% | | |
| GRR | >92% | | |
| CAC payback | ≤15 months | | |
| Burn multiple | <1.5 | | |

### Infrastructure
- Multi-region deployment
- 24/7 on-call rotation
- Quarterly pen tests
- Disaster recovery drills

### Contingency Plan
**Trigger:** MRR <projection for 2 consecutive fortnights

**Actions:**
1. Cut paid spend by 20%
2. Focus on retention (NRR/GRR)
3. Accelerate upsell features
4. Reassess pricing
5. Extend runway planning

### Financial Guardrails
- If burn multiple >1.5: Freeze hiring
- If CAC payback >18 months: Pause paid acquisition
- If churn >4%: Focus on retention features
- If NRR <106%: Increase upsell focus

---

## Phase 5: Pan-African Preparation (Month 6-12) - 100,000 Users

### Goal
Prepare for Ghana/Kenya expansion and achieve profitability.

### Activities
1. **Month 7-8:** Ghana sandbox pilot (10 users)
2. **Month 9-10:** Kenya sandbox pilot (10 users)
3. **Month 11-12:** Regulatory compliance (Ghana Revenue Authority, KRA)

### Expansion Strategy
- Replicate Nigeria playbook
- Leverage stablecoin rails for FX smoothing
- Partner with local fintechs (Paystack Ghana, etc.)
- Explore Mono-style data integrations

### Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Nigeria users | 100,000+ | | |
| MRR | ₦10M+ | | |
| LTV:CAC | ≥4:1 | | |
| Profitability | Achieved | | |
| Ghana pilot | 10 users | | |
| Kenya pilot | 10 users | | |

---

## Risk Register

### Critical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| NRS/DigiTax downtime | High | Low | Retry logic, user notifications |
| Remita payment failures | High | Medium | Multiple payment gateways |
| Database outage | High | Low | Daily backups, read replicas |
| Security breach | High | Low | Pen tests, audit logs, encryption |
| Regulatory change | Medium | Medium | Legal monitoring, compliance team |
| Competitor launch | Medium | High | Differentiation (offline-first, Pidgin) |

### Amber Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| Uptime | <98% | Scale infrastructure |
| p95 latency | >700ms | Optimize queries, add caching |
| NRR | <100% | Focus on retention |
| GRR | <88% | Reduce involuntary churn |
| CAC payback | >18 months | Pause paid acquisition |
| Burn multiple | >1.5 | Cut costs |

---

## Communication Plan

### Internal
- Daily standups (9am WAT)
- Weekly exec reviews (Friday 4pm WAT)
- Monthly board updates

### External
- Launch announcement (press release)
- Weekly blog posts
- Monthly community webinars
- Quarterly transparency reports

### Crisis Communication
- Status page: status.taxbridge.ng
- Twitter: @taxbridgeNG
- Email blasts for major incidents
- SMS for critical user-facing issues

---

## Post-Launch Reviews

### Day 1 Review
- Signup funnel analysis
- Error log review
- Infrastructure performance
- User feedback summary

### Week 1 Review
- Cohort retention (D1, D3, D7)
- MRR/ARR calculation
- CAC/LTV analysis
- Feature usage heatmap

### Month 1 Review
- Go/No-Go for Phase 2
- Financial performance vs. plan
- Roadmap adjustments
- Team retrospective

---

## Success Criteria Summary

### Month 1
- 1,000 users
- ₦100K MRR
- NPS ≥7
- Churn <5%
- LTV:CAC ≥3:1
- GRR >90%

### Month 3
- 10,000 users
- ₦500K-1M MRR
- NRR >106%
- CAC payback ≤15 months

### Month 6
- 50,000+ users
- ₦4M+ MRR
- Break-even
- NRR 110-120%

---

**Next Steps:**
1. Finalize Phase 1 user list (100 users)
2. Set up Grafana/Sentry/Mixpanel dashboards
3. Conduct pre-launch checklist (see `infra/scripts/pre-launch-check.sh`)
4. Schedule launch date (pending checklist completion)
