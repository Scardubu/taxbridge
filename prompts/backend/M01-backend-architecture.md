# MODULE M01 — BACKEND ARCHITECTURE
## TaxBridge AI Operating Context
**Token budget:** ~1,200 tokens | **Inject:** Backend tasks

---

## PURPOSE
Reference for all backend engineering decisions: service structure, API patterns,
queue design, error handling, and database constraints.

## SCOPE
`backend/` directory only. Does not cover mobile, admin, or contracts.

---

## STACK VERSIONS (Frozen — do not upgrade without explicit approval)

```
Node.js      20.19.4
Fastify      5.6.2
Prisma       5.22.0    (types stubbed as `any` — see R01)
PostgreSQL   15.x      (Render managed)
Redis        7.x       (Render managed)
BullMQ       5.66
TypeScript   5.9
Zod          4.3.5     (use .issues not .errors — Zod v3 API change)
```

---

## API CONVENTIONS

```
Base:           /api/v1/
Auth:           JWT Bearer — preHandler: fastify.authenticate
Admin routes:   /api/admin/* — cold-start 200 fallbacks required
Rate limit:     100 req/min per IP (Redis sliding window)
Response shape: { success: boolean, data?: T, error?: string }
Request IDs:    X-Request-Id header on all responses
Pagination:     cursor-based (not offset) for all list endpoints
```

---

## SERVICE DIRECTORY MAP

```
backend/src/
├─ routes/
│   ├─ auth.ts              — JWT issue/refresh/revoke
│   ├─ invoices.ts          — CRUD + NRS submission trigger
│   ├─ expenses.ts          — CRUD + OCR attach
│   ├─ ocr.ts               — Receipt scan endpoint
│   ├─ tax.ts               — Calculator endpoints
│   ├─ filing.ts            — Filing wizard submission
│   ├─ payroll.ts           — Payroll run + PAYE remittance
│   ├─ vault.ts             — Document upload/download
│   ├─ reconciliation.ts    — Bank statement 3-pass matching
│   ├─ team.ts              — Multi-user invitations
│   ├─ referral.ts          — Referral tracking
│   └─ ussd.ts              — *347*123# USSD handler
├─ services/
│   ├─ nrs-submission.ts    — DigiTax API + circuit breaker + DLQ
│   ├─ anomaly-detection.ts — 9-signal AI engine
│   ├─ ocr-enhanced.ts      — Sharp + Vision + Tesseract pipeline
│   ├─ reconciliation.ts    — 3-pass bank matching engine
│   ├─ compliance-calendar.ts — Deadline + penalty engine
│   ├─ circuit-breaker.ts   — CLOSED/OPEN/HALF-OPEN state machine
│   ├─ payments/            — paystack.ts, flutterwave.ts, remita.ts
│   ├─ sms.ts               — Africa's Talking → Infobip → Termii
│   ├─ tax-health-score.ts  — 100-point scoring engine
│   ├─ payroll.ts           — PAYE computation + multi-state remittance
│   └─ data-export.ts       — NDPC §30 user data export
├─ queues/
│   └─ index.ts             — 6 BullMQ queues (see Queue Map below)
├─ middleware/
│   ├─ auth.ts              — JWT verification
│   ├─ encryption.ts        — AES-256-GCM field encryption
│   └─ audit.ts             — NDPC audit log
└─ data/
    └─ nigerian-vendors.ts  — 500-entry vendor database
```

---

## BULLMQ QUEUE MAP

```
Queue Name              Retries  Backoff        DLQ Alert Depth
─────────────────────────────────────────────────────────────────
nrs-submission          5        exponential    > 10 → Sentry alert
ocr-processing          3        exponential    > 10
payroll-paye-remit      2        fixed 5s       > 5
device-sync             10       exponential    > 50
notification-dispatch   3        exponential    > 20
compliance-digest       cron     '0 8 * * *'    —
```

---

## PAYMENT GATEWAY FAILOVER

```
Priority: Paystack → Flutterwave → Remita
Circuit:  3 failures in 60s → OPEN → 30s cooldown → HALF-OPEN → probe
All open: throw PaymentGatewayUnavailableError (never silent fail)
```

---

## INPUTS / OUTPUTS

```
Inputs:  HTTP requests (validated by Zod), BullMQ job payloads, webhooks
Outputs: JSON responses, BullMQ jobs, PostgreSQL writes, Redis cache writes,
         SMS via Africa's Talking, push notifications via Expo, NRS IRN stamps
```

---

## DEPENDENCIES

```
Internal: packages/contracts (tax engine, shared types)
External: DigiTax API, Youverify, Google Cloud Vision, Paystack, Flutterwave,
          Remita, Africa's Talking, Infobip, Termii, Sentry, Prometheus
```

---

## NRS SUBMISSION RULES

```typescript
// CRITICAL: All NRS submissions must:
// 1. Be idempotent (nrsReference field prevents duplicates)
// 2. Use exponential backoff with ±25% jitter
// 3. Move to DLQ after 3 failed retries
// 4. Surface circuit state at GET /api/v1/nrs/health
// 5. Return graceful 200 during admin cold-start
```

---

## HEALTH ENDPOINTS (All must return 200 during Render cold-start)

```
GET /health              — Basic liveness
GET /health/queues       — BullMQ queue depths + DLQ counts
GET /api/v1/nrs/health   — NRS circuit state + pending + DLQ
GET /api/admin/stats     — Admin dashboard stats (fallback on cold start)
GET /metrics             — Prometheus metrics stream
```
