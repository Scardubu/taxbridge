# MODULE M04 — PAYMENTS & COMPLIANCE INTEGRATIONS
## TaxBridge AI Operating Context
**Token budget:** ~900 tokens | **Inject:** Payment tasks, NRS/filing tasks

---

## PURPOSE
Reference for all external integration engineering: payment gateways, NRS e-invoicing,
TIN/BVN verification, USSD/SMS channels, and the circuit breaker pattern.

## SCOPE
`backend/src/services/payments/`, `nrs-submission.ts`, `sms.ts`, `routes/ussd.ts`

---

## PAYMENT GATEWAY ARCHITECTURE

```
Priority order: Paystack → Flutterwave → Remita (government payments)

Circuit breaker per gateway:
  State machine: CLOSED → OPEN (3 failures in 60s) → HALF-OPEN (30s) → CLOSED/OPEN
  Redis key:     `circuit:{gateway}:open` TTL 60s
  Monitoring:    State exposed at GET /health/queues

Gateway selection (gateway-selector.ts):
  for each [paystack, flutterwave, remita]:
    if breaker.canAttempt(): use this gateway
  if all OPEN: throw PaymentGatewayUnavailableError
  — NEVER return success: false silently
```

---

## PAYMENT ENVIRONMENT VARIABLES

```
PAYSTACK_SECRET_KEY      — sk_live_... or sk_test_...
PAYSTACK_PUBLIC_KEY      — pk_live_...
FLUTTERWAVE_SECRET_KEY   — FLWSECK_...
FLUTTERWAVE_PUBLIC_KEY   — FLWPUBK_...
REMITA_MERCHANT_ID       — Remita merchant ID
REMITA_SERVICE_TYPE_ID   — Service type for tax payments
REMITA_API_KEY           — Remita API key
REMITA_BASE_URL          — https://remitademo.net or prod URL
```

---

## NRS E-INVOICING (DigiTax Integration)

```
Standard:   NRS 2026 E-Invoicing (UBL 2.1 / Peppol BIS 3.0)
Fields:     IRN (Invoice Reference Number), CSID (cryptographic stamp)
Endpoint:   DigiTax API (URL from DIGITAX_API_URL env var)
Mock mode:  DIGITAX_MOCK_MODE=true for testing without real NRS calls

Submission flow:
  1. Create invoice in DB with nrsStatus: 'PENDING'
  2. Enqueue to `nrs-submission` BullMQ queue
  3. Worker: POST to DigiTax API → receive IRN + CSID
  4. Update invoice: nrsStatus: 'STAMPED', irn: '...', csid: '...'
  5. On failure: increment retryCount, exponential backoff
  6. After 3 failures: move to DLQ, surface in Admin NRS Operations Center

Idempotency: nrsReference field (UUID) prevents duplicate submissions
Circuit:     Redis key `nrs:circuit:open` TTL 60s
Health:      GET /api/v1/nrs/health → { circuitBreakerOpen, pendingSubmissions, deadLetterCount }
```

---

## YOUVERIFY INTEGRATION (TIN/BVN/CAC Verification)

```
Purpose:    Validate TINs from OCR receipts, verify business CAC registration
Endpoint:   YOUVERIFY_API_URL + YOUVERIFY_API_KEY
Use cases:
  - phantom_vendor anomaly signal: check if vendor TIN is in CAC registry
  - Invoice TIN validation before NRS submission
  - User TIN verification during onboarding
Fallback:   If Youverify unavailable, mark as 'unverified' (don't block submission)
```

---

## SMS CHANNEL (Africa's Talking Primary)

```
Provider failover: Africa's Talking → Infobip → Termii

Environment variables:
  AFRICAS_TALKING_API_KEY     AFRICAS_TALKING_USERNAME
  INFOBIP_API_KEY             INFOBIP_BASE_URL
  TERMII_API_KEY

Phone normalisation (REQUIRED before every send):
  08012345678   →  +2348012345678
  2348012345678 →  +2348012345678
  +2348012345678 → unchanged

SMS templates (160-char limit — one SMS unit):
  deadline_reminder  — EN + Pidgin variants
  irn_confirmation   — Invoice stamped by NRS
  pit_breakdown      — Multi-part (3 parts): summary → bands → total
  welcome            — New user registration
```

---

## USSD CHANNEL (*347*123#)

```
Provider:   Africa's Talking USSD
Shortcode:  *347*123# (registered with MTN, Airtel, Glo, 9mobile)

Menu tree (depth → response):
  0        → Main menu (6 options)
  1        → File Tax Return sub-menu (VAT/WHT/PAYE)
  1*1      → Enter total sales (₦)
  1*1*NNN  → Compute VAT → save draft → send SMS confirmation
  2        → Check next deadline for this phone number
  3        → Enter income → compute PIT estimate
  3*N*1    → Send full PIT breakdown via SMS

Response action: 'CON' (continue session) or 'END' (terminate)
User lookup: by phone number → Nigerian E.164 format required
```

---

## INPUTS / OUTPUTS

```
Inputs:  Payment initiation requests, invoice data (for NRS), phone + message (SMS),
         USSD session objects (sessionId, phoneNumber, text, networkCode)
Outputs: Payment references, IRN stamps, CSID codes, SMS delivery receipts,
         USSD response strings (CON/END + menu text)
```

---

## DEPENDENCIES

```
Internal: backend/src/services/circuit-breaker.ts, queues/index.ts, prisma client
External: Paystack API, Flutterwave API, Remita API, DigiTax/NRS API,
          Youverify API, Africa's Talking, Infobip, Termii
```
