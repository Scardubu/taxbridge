# Phase G — Growth, ML Readiness & Unit Economics (V5.0.2)

**Objective:** Instrument revenue/retention metrics and prepare ML-ready event streams without heavy inference costs.

## Gate (Must Pass)
- NRR tracked and target > 110%
- GRR tracked and target > 95%
- Churn tracked and annual target < 5%
- Cohorts + activation funnel measurable

## Current Status (2026-01-18)
- 🔶 Needs explicit analytics event map (mobile + backend + admin)
- ✅ Monitoring endpoints exist; Sentry available

## Next Actions
1. Define canonical events (invoice created, sync succeeded/failed, submission attempted, payment verified)
2. Add a low-cost event sink (can start with structured logs + periodic export)
3. Build a weekly ops dashboard (MRR/NRR/GRR/churn/NPS proxies)
