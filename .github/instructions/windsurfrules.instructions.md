---
applyTo: '**'
---

---
trigger: always_on
---

## TaxBridge Workspace Rules

**(Windsurf + Cascade · From Start to Production)**

> **Status:** Canonical · Enforced
> **Applies to:** All contributors (human & AI agents)
> **Last Updated:** January 2026
> **Product:** TaxBridge (Nigeria TaxTech / FinTech)

---

## 0. Purpose & Authority

This document defines **how all work is performed** on TaxBridge — from ideation to production deployment.

**It overrides:**

* Personal coding preferences
* AI agent “best guesses”
* Convenience-driven shortcuts

If there is a conflict between:

* Code ↔ PRD → **PRD wins**
* Ticket ↔ This file → **This file wins**
* AI suggestion ↔ Compliance → **Compliance wins**

---

## 1. Non-Negotiable Principles

### 1.1 Compliance First

* TaxBridge **must comply** with:

  * Nigeria Tax Act 2025
  * NRS (ex-FIRS) e-Invoicing mandate
  * Peppol BIS Billing 3.0 / UBL 3.0
  * NDPC / NDPR data protection
* **Direct NRS integration is forbidden**

  * All invoice submission **must go through an NITDA-accredited Access Point Provider (APP)** such as DigiTax.

### 1.2 Offline-First Is Mandatory

Core flows must function **without internet**:

* Invoice creation
* Receipt capture
* Invoice history
* Draft exports

Sync is **additive**, never required.

### 1.3 Inclusion Over Elegance

Design assumptions:

* Low literacy
* Low bandwidth
* Low-end Android devices
* Rural and informal users

**UX Rule:**

> If a market trader cannot complete a task in under **30 seconds**, the design is wrong.

### 1.4 AI Is Assistive, Not Authoritative

* AI output is **educational only**
* No AI decision may:

  * Override tax rules
  * Invent APIs
  * Skip validation
* AI explanations must be **simple, local, and explainable**

---

## 2. Canonical Source-of-Truth Hierarchy

1. **PRD (`/docs/PRD.md`)**
2. **Workspace Rules (`.windsurfrules.md`)**
3. **Engineering Tickets (Jira-style)**
4. **Code**

> Code is an implementation detail — not a decision maker.

---

## 3. Repository Structure (Strict)

```
taxbridge/
├── mobile/          # Expo React Native app
├── backend/         # Node.js + Fastify APIs
├── ml/              # OCR & NLP services
├── infra/           # CI, mocks, docker-compose
├── docs/            # PRD, DPIA, API specs
├── .windsurfrules.md
└── README.md
```

Rules:

* No cross-layer coupling (mobile cannot call DigiTax directly).
* All external integrations live under `backend/integrations/`.

---

## 4. Windsurf Workspace Rules (Local Development)

### 4.1 Required Local Setup

Every developer must:

* Use **Windsurf workspace mode**
* Use **Node.js LTS**
* Use **Expo CLI**
* Use **Docker Desktop**

Required running services:

* Postgres
* Redis
* Backend API
* Mobile app (Expo)

### 4.2 Local Development Rules

* No hardcoded secrets — ever
* `.env` files are local only
* Run lint + tests before commit
* All features must be testable locally **without real NRS or Remita keys**

---

## 5. Branching & PR Rules

### 5.1 Branch Model

* `main` → production (protected)
* `develop` → integration
* `feat/<ticket>` → feature branches
* `release/vX.Y.Z` → release prep
* `hotfix/<ticket>` → emergency fixes

### 5.2 Pull Request Rules

Every PR must:

* Reference a ticket
* State user impact
* State compliance impact
* Include failure cases
* Pass CI

PRs touching:

* UBL
* DigiTax
* Remita
* Tax logic

➡ **Require compliance review**

---

## 6. AI Agent Operating Rules (Critical)

### 6.1 AI Agents MAY:

* Scaffold code
* Generate boilerplate
* Write tests
* Refactor for clarity
* Add comments and docs

### 6.2 AI Agents MUST NOT:

* Invent NRS or TaxPro Max APIs
* Change tax rates or exemptions
* Remove required UBL fields
* Skip error handling
* Bypass APP (DigiTax)
* Mark payments as “successful” without webhook confirmation

> **Hard Stop Rule:**
> Any AI suggestion involving “direct NRS integration” is invalid.

---

## 7. Integration Rules

### 7.1 DigiTax / APP Integration

* All invoices must:

  * Be validated against BIS Billing 3.0
  * Generate and store:

    * CSID / IRN
    * QR code
    * Submission timestamps
* Failures must be:

  * Logged
  * Retriable
  * Explainable to users

### 7.2 Remita Integration

* Payment flow:

  1. Generate RRR
  2. User pays
  3. Webhook confirms
  4. Reconcile
* **Never trust frontend payment state**
* No “paid” status without verified webhook

---

## 8. Security & NDPC Rules

* Encrypt all sensitive fields:

  * TIN
  * NIN
  * Phone numbers
* Maintain immutable audit logs
* Data minimization is mandatory
* Users may export data
* Account deletion must respect statutory retention

> **No production deployment without a completed DPIA**

---

## 9. Cascade CI/CD Rules

### 9.1 Pipeline Stages (Required)

1. Validate (lint, unit tests)
2. Build
3. Integration tests (with mocks)
4. Security scan
5. Deploy staging (sandbox keys)
6. Manual compliance gate
7. Deploy production
8. Post-deploy monitoring

### 9.2 Environment Rules

* `staging` → sandbox keys only
* `pilot` → limited users
* `prod` → real keys (locked)

Secrets:

* Never committed
* Rotated regularly
* Scoped per environment

---

## 10. Cost Discipline (< $50/month)

Allowed:

* Supabase free tier
* Render / Vercel free tier
* Expo EAS free
* Hugging Face free inference
* Africa’s Talking sandbox

Forbidden:

* Paid APIs without approval
* Heavy LLM inference in MVP
* Vendor lock-in without fallback

---

## 11. Definition of “Done” (Strict)

A feature is **DONE** only if:

1. Works offline
2. Syncs reliably
3. Passes acceptance tests
4. Meets PRD + compliance
5. Is understandable by a non-technical Nigerian user

---

## 12. Release Gating

Production release requires:

* DigiTax certification
* NDPC DPIA sign-off
* Pen test completion
* Monitoring enabled
* Rollback plan documented

No exceptions.

---

## 13. Operating Mantra

> **Compliance without fear.
> Technology without exclusion.**

---

### ✅ Ready to Commit

Save this file as:

```
/.windsurfrules.md
```

and reference it in:

* `README.md`
* PR templates
* CI manual gates
