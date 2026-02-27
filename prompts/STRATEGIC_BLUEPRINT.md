# TAXBRIDGE STRATEGIC BLUEPRINT
## Engineering Decision Authority Document
**Version:** 3.0.0 | **Repo:** github.com/Scardubu/taxbridge | **Date:** 2026-02-20

---

## 1. SYSTEM VISION

TaxBridge is a Nigerian-first, offline-resilient, AI-augmented tax compliance platform for
SMEs, sole proprietors, accountants, and enterprises. It removes the friction between
Nigerian businesses and their legal tax obligations by embedding compliance into daily
business operations — invoicing, expense tracking, payroll — rather than treating it as a
separate year-end event.

**North Star Metric:** Time-to-first-compliance-action < 5 minutes from install.

---

## 2. CORE OBJECTIVES (Ranked by Business Impact)

| # | Objective | Metric | Owner Layer |
|---|-----------|--------|-------------|
| 1 | Zero tax filing errors | 0 NTA 2025 miscalculations in production | Backend / contracts |
| 2 | NRS submission > 97% success | IRN stamp rate monitored in real time | Backend / queues |
| 3 | Offline-first reliability | 100% core features work with no network | Mobile / SQLite |
| 4 | First value < 60 seconds | Tax insight shown before onboarding exits | Mobile / UX |
| 5 | Bilingual compliance | All compliance text in EN + Pidgin | i18n / contracts |
| 6 | West Africa readiness | Country config system (NG active, GH/KE stubbed) | contracts |

---

## 3. PLATFORM PHILOSOPHY (Governing Rules for All Engineering Decisions)

```
RULE-01  Offline first, sync second.
         No feature may block on network. Cache aggressively. Sync on reconnect.

RULE-02  NRS terminology is law.
         Zero FIRS references anywhere in code, copy, or comments. NRS/DigiTax only.

RULE-03  Prisma types are stubbed as `any`.
         Commit 218972e fixed 52 TS errors by removing Prisma.XxxWhereInput namespaces.
         Never reintroduce typed Prisma namespace types. Use JSDoc for documentation.

RULE-04  Never break what works.
         All 423+ backend tests must pass before any PR merges. No exceptions.

RULE-05  Tax calculations are sacred.
         The tax engine at packages/contracts has 97.29% coverage. Any change to tax
         logic requires boundary tests citing the NTA 2025 section being implemented.

RULE-06  Graceful degradation over hard failures.
         Admin cold-start routes return 200 + fallback data. OCR falls back to Tesseract.
         Payments fail over Paystack → Flutterwave → Remita. SMSs fail over three providers.

RULE-07  Bilingual or bust.
         Every user-facing string must have both `en` and `pidgin` variants.
         Missing translations are BUG priority, not tech debt.

RULE-08  Secrets never in code.
         All API keys, DSNs, and credentials live in environment variables.
         Validated at startup via validate-production-readiness.ps1.
```

---

## 4. COMPLIANCE ALIGNMENT MAP

```
Nigerian Regulatory Layer → TaxBridge Implementation
─────────────────────────────────────────────────────
NTA 2025 (Tax calculations)
  └─► packages/contracts/src/tax-engine/
      ├─ pit.ts      (6-band PIT: 7%–24%)
      ├─ vat.ts      (7.5%, ₦100M threshold)
      ├─ cit.ts      (0%/20%/30% by turnover tier)
      ├─ paye.ts     (employer PAYE + CRA §33)
      ├─ wht.ts      (5%–10% by payment type)
      └─ penalties.ts (late filing formulas)

NRS 2026 E-Invoicing Standard
  └─► backend/src/services/nrs-submission.ts
      ├─ UBL 2.1 XML generation
      ├─ IRN generation (NRS-assigned)
      ├─ CSID (cryptographic stamp)
      └─ DigiTax API integration

NDPC 2023 (Data Privacy)
  └─► backend/src/middleware/encryption.ts
      ├─ AES-256-GCM at rest
      ├─ TIN/BVN field-level encryption
      ├─ Audit log for all data access
      └─ 5-year retention enforcement (§67 NTA)

NDPR (Data Protection Regulation)
  └─► backend/src/routes/vault.ts
      └─ Data export (§30 portability right)
          └─ Account deletion with anonymization

Payment Regulations
  └─► backend/src/services/payments/
      ├─ paystack.ts     (primary)
      ├─ flutterwave.ts  (secondary failover)
      ├─ remita.ts       (government payments)
      └─ circuit-breaker.ts (3-gateway failover)
```

---

## 5. MONETIZATION STRATEGY

```
TIER 1 — Free (Customer Acquisition)
  ├─ 3 invoices/month
  ├─ Basic PIT calculator
  ├─ TaxAcademy lessons (read-only)
  └─ USSD access (*347*123#)

TIER 2 — Starter (₦2,500/month)
  ├─ Unlimited invoices + NRS stamps
  ├─ OCR receipt scanning (50 scans/month)
  ├─ VAT filing wizard
  ├─ Bank statement import (1 bank)
  └─ 2 team members

TIER 3 — Professional (₦7,500/month)
  ├─ Everything in Starter
  ├─ Unlimited OCR scans
  ├─ Full payroll + PAYE module
  ├─ Document vault (5GB)
  ├─ Multi-bank reconciliation
  ├─ AI anomaly detection
  ├─ Tax Health Score
  └─ 5 team members

TIER 4 — Enterprise (₦25,000/month)
  ├─ Everything in Professional
  ├─ Multi-entity support
  ├─ Accountant portal (unlimited clients)
  ├─ Dedicated support WhatsApp line
  ├─ Custom NRS submission priority
  ├─ Revenue share referral (15%)
  └─ Unlimited team members

Referral Program (all tiers)
  ├─ 1–4 referrals:  10% discount/referral
  ├─ 5–9 referrals:  20% discount + 1 free month
  └─ 10+ referrals:  15% revenue share (paid monthly)
```

---

## 6. SYSTEM ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  Mobile App      │  │  Admin Dashboard  │  │  USSD *347*123# │  │
│  │  (Expo SDK 54)   │  │  (Next.js 15)     │  │  (Feature phone)│  │
│  │  React Native    │  │  taxbridge.vercel │  │  Africa's Talk. │  │
│  │  SQLite offline  │  │  .app             │  │                 │  │
│  └────────┬─────────┘  └────────┬──────────┘  └────────┬────────┘  │
│           │                     │                       │           │
└───────────┼─────────────────────┼───────────────────────┼───────────┘
            │                     │                       │
            ▼                     ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                                  │
│              Fastify 5 + JWT Auth + Rate Limiting                   │
│              taxbridge-api-ker8.onrender.com                        │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  Tax Engine  │  AI Layer    │  Compliance  │  Communication         │
│  /api/v1/    │  /api/v1/    │  /api/v1/    │  /api/v1/             │
│  tax/*       │  insights/*  │  nrs/*       │  sms/*, ussd/*        │
│  calculate/* │  anomalies/* │  vault/*     │  notifications/*      │
│  file/*      │  ocr/*       │  filing/*    │                       │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│                         SERVICE LAYER                                │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │ Tax Engine  │  │ NRS Submit   │  │ BullMQ      │  │ Payments │ │
│  │ (contracts) │  │ DigiTax API  │  │ 6 Queues    │  │ Paystack │ │
│  │ NTA 2025    │  │ Circuit Brk  │  │ DLQ + retry │  │ Flutter  │ │
│  │ 97.29% cov  │  │ IRN stamp    │  │ Prometheus  │  │ Remita   │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                                   │
│                                                                     │
│  ┌──────────────────────┐    ┌────────────────────┐                │
│  │ PostgreSQL (Render)   │    │ Redis 7 (Render)    │                │
│  │ Prisma 5.22 ORM       │    │ BullMQ queues       │                │
│  │ AES-256-GCM encrypted │    │ Session cache       │                │
│  │ 5yr retention (NTA)   │    │ Anomaly results 15m │                │
│  └──────────────────────┘    └────────────────────┘                │
├─────────────────────────────────────────────────────────────────────┤
│                         EXTERNAL SERVICES                            │
│                                                                     │
│  DigiTax/NRS    Youverify    Google Vision    Sentry    Prometheus  │
│  (e-invoice)    (TIN/BVN)    (OCR primary)    (errors)  (metrics)  │
│  Africa's Talk  Infobip      Termii            Cloudflare R2        │
│  (USSD/SMS)     (SMS bkup)   (SMS bkup)       (vault storage)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. RESPONSIBILITY SEPARATION

```
packages/contracts/     — Shared types, tax engine logic, country configs
                          OWNS: All tax calculation truth. No UI, no DB.

backend/                — API, business logic, integrations, queues
                          OWNS: Auth, filing workflows, NRS, payments, OCR, SMS.
                          MUST NOT: Import mobile or admin code.

mobile/                 — Offline-first React Native app
                          OWNS: Local SQLite, UI, i18n, camera, biometric.
                          MUST NOT: Contain tax calculation logic (use contracts).

admin-dashboard/        — Next.js operations and analytics portal
                          OWNS: Admin UI, charts, support tools, accountant portal.
                          MUST NOT: Duplicate business logic from backend.

ml/ocr_service/         — Python OCR microservice (Tesseract + classification)
                          OWNS: Image processing, ML categorization.
                          INTERFACE: REST API consumed by backend only.

prompts/                — AI operating context (THIS DIRECTORY)
                          OWNS: Prompt modules, loaders, embeddings index.
                          CONSUMED BY: AI coding agents, Claude, Cursor, Copilot.
```

---

## 8. SCALABILITY ROADMAP

```
NOW (v3.0.0)      Nigeria only. Single-tenant. EAS + Render + Vercel.
                  Target: 10,000 active SME users.

Q3 2026           Multi-entity accounts. Accountant portal GA.
                  Target: 50,000 users. Upgrade Render to paid tier.

Q4 2026           Ghana (GH config activation). Partial Twi i18n.
                  Target: 5,000 GH users. Separate GH tax engine.

Q1 2027           Kenya (KE config). Swahili i18n. M-Pesa payments.
                  Target: 15,000 KE users.

Q2 2027           Enterprise tier. Multi-tenant SaaS architecture.
                  Migrate from Render to AWS ECS / RDS.

Q3 2027           Senegal (SN config). French + Wolof i18n.
                  West Africa regulatory API hub.
```

---

## 9. ENGINEERING DECISION CHECKLIST

Before implementing any feature, answer these 7 questions:

```
□ Does it work offline? (Mobile: SQLite. Backend: queue it.)
□ Is every user-facing string in en.json AND pidgin.json?
□ Does it use `any` for Prisma types (not Prisma.XxxWhereInput)?
□ Does it reference NRS, not FIRS?
□ Does it maintain 423+ backend tests passing?
□ Is it backward-compatible with existing mobile app versions?
□ Is there a graceful fallback if the network call fails?
```

All 7 must be YES before a PR is opened.
