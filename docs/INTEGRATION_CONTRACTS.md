# TaxBridge Integration Contracts

This document defines the API contracts between mobile app, backend, and external services.

## Mobile ↔ Backend API Contracts

### 1. Invoice Creation

**Endpoint:** `POST /api/v1/invoices`

**Request:**
```json
{
  "customerName": "string",
  "items": [
    {
      "description": "string",
      "quantity": "number (positive)",
      "unitPrice": "number (positive, 2 decimals)"
    }
  ]
}
```

**Response (Success - 201):**
```json
{
  "invoiceId": "uuid",
  "status": "queued"
}
```

**Response (Error - 400/500):**
```json
{
  "error": "string",
  "code": "string (optional)",
  "details": "object (optional)"
}
```

**Validation Rules:**
- `customerName`: Required, min 2 chars, max 200 chars
- `items`: Required array, min 1 item, max 50 items
- Each item must have `description`, `quantity`, and `unitPrice`
- `quantity`: Must be positive number
- `unitPrice`: Must be positive number with max 2 decimal places

**Retry Logic:**
- Mobile app retries on 5xx errors with exponential backoff
- Max 3 retry attempts
- Idempotency key generated from invoice UUID

---

### 2. Invoice Sync

**Endpoint:** `POST /api/v1/invoices/sync`

**Request:**
```json
{
  "invoices": [
    {
      "id": "uuid",
      "customerName": "string",
      "items": [...],
      "subtotal": "number",
      "vat": "number",
      "total": "number",
      "createdAt": "ISO 8601 datetime",
      "updatedAt": "ISO 8601 datetime"
    }
  ]
}
```

**Response (Success - 200):**
```json
{
  "synced": [
    {
      "id": "uuid",
      "status": "success",
      "nrsReference": "string (optional)",
      "qrCode": "string (optional)"
    }
  ],
  "failed": [
    {
      "id": "uuid",
      "status": "failed",
      "error": "string"
    }
  ]
}
```

**Retry Logic:**
- Mobile app syncs when network becomes available
- Uses exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max 5 attempts before marking as permanently failed
- Only syncs invoices with status "pending_sync"

---

### 3. Receipt OCR

**Endpoint:** `POST /api/v1/ocr/extract`

**Request (multipart/form-data):**
```
image: binary (JPEG/PNG, max 10MB)
userId: uuid
```

**Response (Success - 200):**
```json
{
  "items": [
    {
      "description": "string",
      "quantity": "number",
      "unitPrice": "number"
    }
  ],
  "total": "number (optional)",
  "merchant": "string (optional)",
  "confidence": "number (0-1)"
}
```

**Response (Error - 400):**
```json
{
  "error": "Invalid image format | Image too large | OCR extraction failed"
}
```

---

## Backend ↔ DigiTax (NRS Access Point)

### 1. Submit Invoice for Stamping

**Endpoint:** `POST /v1/einvoice/submit`

**Request Headers:**
```
Authorization: Bearer <oauth_token>
Content-Type: application/xml
X-Signature: HMAC-SHA256 of request body
```

**Request Body:**
```xml
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <!-- UBL 3.0 / Peppol BIS Billing 3.0 compliant XML -->
  <cbc:ID>INV-2024-001</cbc:ID>
  <cbc:IssueDate>2024-01-15</cbc:IssueDate>
  <!-- ... full UBL structure -->
</Invoice>
```

**Response (Success - 200):**
```json
{
  "csid": "string (Certificate Serial ID)",
  "irn": "string (Invoice Reference Number)",
  "qrCode": "string (base64 encoded QR code)",
  "status": "STAMPED",
  "timestamp": "ISO 8601 datetime"
}
```

**Response (Error - 400/401/500):**
```json
{
  "error": "string",
  "code": "INVALID_UBL | AUTH_FAILED | INTERNAL_ERROR",
  "details": "object (optional)"
}
```

**Mock Mode:**
- When `DIGITAX_MOCK_MODE=true`, backend returns synthetic response
- Mock CSID format: `MOCK-{timestamp}`
- Mock IRN format: `MOCK-IRN-{invoiceId}`
- QR code contains mock data: `MOCK|{invoiceId}|{total}`

**Retry Logic:**
- Backend retries on 5xx errors with exponential backoff
- Max 3 attempts before moving to Dead Letter Queue (DLQ)
- 401/403 errors trigger OAuth token refresh
- 400 errors (validation failures) are not retried

---

## Backend ↔ Remita (Payment Gateway)

### 1. Generate RRR (Remita Retrieval Reference)

**Endpoint:** `POST /remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit`

**Request:**
```json
{
  "serviceTypeId": "string",
  "amount": "string (decimal, 2 places)",
  "orderId": "string (invoice ID)",
  "payerName": "string",
  "payerEmail": "string",
  "payerPhone": "string",
  "description": "string"
}
```

**Response (Success - 200):**
```json
{
  "statuscode": "025",
  "RRR": "string (Remita Reference)",
  "statusMessage": "string"
}
```

**Response (Error):**
```json
{
  "statuscode": "string",
  "statusMessage": "string"
}
```

**Mock Mode:**
- When `REMITA_MOCK_MODE=true`, backend returns synthetic response
- Mock RRR format: `MOCK-{timestamp}-{invoiceId}`
- Status code: "025" (success)

---

### 2. Payment Notification Webhook

**Endpoint:** `POST /api/v1/payments/webhook/remita`

**Request Headers:**
```
X-Remita-Signature: HMAC-SHA512 of request body using webhook secret
Content-Type: application/json
```

**Request Body:**
```json
{
  "RRR": "string",
  "transactionId": "string",
  "amount": "string",
  "status": "PAID | FAILED",
  "paymentDate": "string (ISO 8601)",
  "channel": "CARD | BANK_TRANSFER | USSD"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Payment processed"
}
```

**Webhook Verification:**
- Backend validates HMAC signature using `REMITA_WEBHOOK_SECRET`
- Invalid signatures are rejected with 401
- Duplicate notifications (same RRR + transactionId) are idempotent

---

## Integration Testing Checklist

### Phase A: System Consolidation

- [x] Mobile API client respects `getApiBaseUrl()` for all endpoints
- [x] Backend validates all incoming requests with Zod schemas
- [ ] Mobile app handles offline mode correctly:
  - [ ] Invoices save to SQLite when offline
  - [ ] Sync queue processes when online
  - [ ] Sync retries respect exponential backoff
- [ ] Backend handles idempotent invoice creation:
  - [ ] Duplicate invoice IDs return existing record
  - [x] Idempotency cache expires after 24 hours

### Phase B: Hardening & Performance

- [ ] Mobile app retry logic:
  - [ ] Retries 5xx errors up to 3 times
  - [ ] Does not retry 4xx errors (client errors)
  - [ ] Uses exponential backoff: 1s, 2s, 4s
- [ ] Backend queue processing:
  - [ ] BullMQ concurrency set to 5
  - [ ] Jobs move to DLQ after 3 failed attempts
  - [ ] DLQ monitor alerts on >10 failed jobs
- [ ] API rate limiting:
  - [ ] Anonymous: 100 req/min
  - [ ] Authenticated: 1000 req/min
  - [ ] Webhook endpoints: 200 req/min

### Phase F: Production Readiness

- [ ] DigiTax integration (production):
  - [ ] OAuth token refresh works
  - [ ] UBL 3.0 XML validation passes
  - [ ] CSID/IRN stored in database
  - [ ] QR code generated and returned to mobile
- [ ] Remita integration (production):
  - [ ] RRR generation succeeds
  - [ ] Webhook signature validation passes
  - [ ] Payment status updates trigger mobile sync
- [ ] Health check endpoints:
  - [ ] `/health` returns 200 when DB + Redis healthy
  - [ ] `/health/digitax` validates DigiTax connectivity (legacy `/health/duplo` alias supported)
  - [ ] `/health/remita` validates Remita gateway
  - [ ] `/health/db` checks database connection
  - [ ] `/health/queues` checks BullMQ queue status

---

## Contract Testing Scripts

### 1. Mobile → Backend Contract Test

```bash
# From mobile directory
yarn test:integration --testNamePattern="API Contract Tests"
```

**Tests:**
- Invoice creation request/response schema
- Invoice sync request/response schema
- OCR extraction request/response schema
- Error response format consistency

### 2. Backend → DigiTax Contract Test

```bash
# From backend directory
npm run test:api -- --testNamePattern="DigiTax"
```

**Tests:**
- UBL 3.0 XML generation
- OAuth token acquisition
- Invoice submission with valid UBL
- Error handling for invalid UBL
- Mock mode fallback

### 3. Backend → Remita Contract Test

```bash
# From backend directory
npm run test:api -- --testNamePattern="Remita"
```

**Tests:**
- RRR generation with valid payload
- Webhook signature verification
- Payment status update flow
- Mock mode fallback

---

## Version Compatibility Matrix

| Component | Version | API Version | Compatible With |
|-----------|---------|-------------|-----------------|
| Mobile App | 5.0.2 | v1 | Backend ≥ 5.0.0 |
| Backend API | 5.0.2 | v1 | Mobile ≥ 5.0.0 |
| DigiTax API | - | v1 | Backend ≥ 5.0.0 |
| Remita API | - | v1 | Backend ≥ 5.0.0 |

**Breaking Changes:**
- API v2 will be introduced when:
  - UBL 4.0 is adopted
  - Major schema changes to invoice structure
  - Authentication mechanism changes (e.g., OAuth 2.1)

**Deprecation Policy:**
- API v1 will be supported for 6 months after v2 release
- Mobile apps must upgrade within 3 months of v2 release
- Deprecation warnings sent via in-app notifications

---

## Error Code Standards

### Mobile Error Codes

| Code | Description | User Action |
|------|-------------|-------------|
| `NETWORK_ERROR` | No internet connection | "Check internet connection and try again" |
| `SERVER_ERROR` | Backend unavailable (5xx) | "Service temporarily unavailable. Retrying..." |
| `VALIDATION_ERROR` | Invalid input (400) | Display specific field errors |
| `AUTH_ERROR` | Authentication failed (401) | "Please log in again" |
| `NOT_FOUND` | Resource not found (404) | "Invoice not found" |
| `SYNC_FAILED` | Sync permanently failed | "Manual sync required. Contact support" |

### Backend Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_INPUT` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Resource already exists (duplicate) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `EXTERNAL_SERVICE_ERROR` | 502 | DigiTax/Remita unavailable |
| `TIMEOUT` | 504 | Request took too long |

---

## SLA & Performance Targets

### Mobile App

- **App Launch:** < 3s (cold start)
- **Invoice Creation:** < 5s (offline mode)
- **Sync Latency:** < 10s (for 10 invoices)
- **OCR Processing:** < 8s (per receipt)

### Backend API

- **P50 Latency:** < 100ms
- **P95 Latency:** < 300ms
- **P99 Latency:** < 500ms
- **Error Rate:** < 1%
- **Uptime:** 99.5% (measured monthly)

### External Services

- **DigiTax:** P95 < 2s, Error rate < 5%
- **Remita:** P95 < 3s, Error rate < 5%

---

## Monitoring & Alerting

### Critical Alerts (PagerDuty)

- Backend error rate > 5% (5-minute window)
- Backend P95 latency > 500ms (5-minute window)
- DLQ size > 100 jobs
- Database connection pool exhausted
- DigiTax/Remita consecutive failures > 10

### Warning Alerts (Slack)

- Backend error rate > 2% (10-minute window)
- Backend P95 latency > 300ms (10-minute window)
- DLQ size > 50 jobs
- Redis connection failures
- Mobile sync failure rate > 10%

---

**Last Updated:** January 16, 2026  
**Maintained By:** TaxBridge Engineering Team
