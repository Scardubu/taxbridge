# TaxBridge Security Architecture & NDPA Compliance

## Status: ✅ Production-Ready

**Last Updated:** January 11, 2026  
**NDPA/NDPC Compliance:** 2023 Act · 2026 Enforcement Active  
**Security Cost:** $0-15/month (Cloudflare Free + Sentry Free Tier)

---

## Overview

This document defines the enterprise-grade security architecture protecting TaxBridge user data, financial transactions, and ensuring full compliance with the **Nigeria Data Protection Act (NDPA) 2023** and **Nigeria Data Protection Commission (NDPC)** enforcement requirements.

---

## 1. Security Layers

### 1.1 Network Security (Cloudflare)

**Infrastructure:** [`infra/cloudflare/config.tf`](../infra/cloudflare/config.tf)

| Feature | Implementation | Cost |
|---------|----------------|------|
| DDoS Protection | Cloudflare proxy for api/admin subdomains | Free |
| WAF Rules | Block bots (threat score > 14), geo-restrict webhooks | Free |
| Rate Limiting | 100 req/min API, 20 req/min webhooks | Free |
| SSL/TLS | TLS 1.3 minimum, HSTS preload | Free |

**Key Protections:**
- Duplo webhook endpoint locked to Nigerian IPs
- Remita webhook endpoint restricted to NG/GB geolocations
- Automatic HTTPS redirects
- HTTP/3 enabled for low-latency markets

---

### 1.2 Application Security

**Middleware:** [`backend/src/middleware/validation.ts`](../backend/src/middleware/validation.ts)

| Threat | Protection | Implementation |
|--------|------------|----------------|
| SQL Injection | Prisma parameterized queries + input sanitization | `sanitizeSQLInput()` |
| XSS | DOMPurify sanitization on all user inputs | `sanitizeHTML()` |
| CSRF | Origin validation + CORS whitelist | Fastify CORS |
| Path Traversal | Relative path stripping | `sanitizeFilePath()` |
| UBL Injection | XML schema validation (55 mandatory fields) | `validateUBL()` |

**Input Validation Schemas (Zod):**
- Nigerian phone numbers: `+234[789]\d{9}`
- TIN format: `\d{8}-\d{4}`
- NIN format: `\d{11}` (encrypted at rest)
- Invoice amounts: Max ₦1B

---

### 1.3 Authentication & Authorization

**Service:** [`backend/src/services/auth.ts`](../backend/src/services/auth.ts)

#### Password Policy
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- Hashed with bcrypt (cost=12)

#### Multi-Factor Authentication (MFA)
- TOTP via Speakeasy + QRCode
- 30-second time window with 2-step tolerance
- Required for admin accounts (optional for users)

#### Session Management
- Access token: 15 minutes (JWT)
- Refresh token: 7 days (JWT)
- Token blacklist in Redis on logout
- Account lockout after 5 failed login attempts (30-minute cooldown)

#### Device Tracking
- Last login timestamp
- Device ID fingerprinting
- Audit trail for all authentication events

---

### 1.4 Data Protection

**Service:** [`backend/src/services/encryption.ts`](../backend/src/services/encryption.ts)

#### Encryption at Rest (AES-256-GCM)
Sensitive fields auto-encrypted via Prisma middleware:
- TIN (Tax Identification Number)
- NIN (National Identification Number)
- Duplo Client ID/Secret
- Remita Merchant ID/API Key
- ECDSA private keys (for UBL signing)

**Storage Format:** `{iv}:{authTag}:{encrypted}`

#### Encryption in Transit
- TLS 1.3 enforced (Cloudflare + Nginx)
- Certificate auto-renewal (Let's Encrypt)
- HSTS preload header

#### Key Management
- Master key from `ENCRYPTION_KEY` environment variable
- Derived via scrypt with salt
- Key rotation procedure documented in runbook

---

## 2. NDPA 2023 / NDPC 2026 Compliance

### 2.1 Legal Basis
TaxBridge processes personal data under:
- **Contract necessity:** Invoice generation, payment processing
- **Legal obligation:** Tax Act 2025 compliance
- **Consent:** SMS marketing, AI/ML analytics (opt-in)

### 2.2 User Rights Implementation

**Service:** [`backend/src/services/privacy.ts`](../backend/src/services/privacy.ts)

| Right | Implementation | Endpoint |
|-------|----------------|----------|
| Access (DSAR) | Export personal data, invoices, payments, consents | `GET /api/v1/privacy/export` |
| Erasure | Anonymize user record, redact invoice customer names | `POST /api/v1/privacy/delete` |
| Portability | CSV export of all user data | `GET /api/v1/privacy/download` |
| Rectification | Profile update endpoints | `PATCH /api/v1/user/profile` |

### 2.3 Consent Management

**Model:** `UserConsent` ([schema](../backend/prisma/schema.prisma))

Tracked consent types:
- `data_processing` (mandatory for registration)
- `sms_marketing` (opt-in checkbox)
- `ai_analytics` (AI chatbot usage)

Consent workflow:
1. Explicit checkbox during registration
2. Stored in `user_consents` table with timestamp
3. Revocable via user settings
4. Audit trail in `audit_logs`

### 2.4 Data Retention

| Data Type | Retention Period | Legal Basis |
|-----------|------------------|-------------|
| Invoices | 7 years | Tax Act 2025 (6 years) + 1 year buffer |
| Payments | 7 years | Financial records requirement |
| Audit logs | 2 years | Security incident investigation |
| SMS logs | 6 months | Delivery verification |
| Deleted accounts | Anonymized immediately | NDPA right to erasure |

**Automated Deletion:**
- Cron job runs weekly
- Identifies expired records
- Anonymizes or hard-deletes per policy
- Logs deletion in audit trail

### 2.5 Breach Notification

**Procedure:**
1. Detection via Sentry alerts or security logs
2. **72-hour notification** to NDPC (as per NDPA 2023)
3. User notification email/SMS template (stored in `docs/templates/`)
4. Incident report filed with NDPC

**Test breach scenario** included in [security tests](../backend/security-tests/run-tests.sh)

---

## 3. Audit & Monitoring

### 3.1 Security Events Logging

**Function:** `logSecurityEvent()` in [`backend/src/lib/security.ts`](../backend/src/lib/security.ts)

Logged events:
- `USER_REGISTERED`
- `FAILED_LOGIN`
- `ADMIN_AUTH_INVALID_KEY`
- `TOKEN_REFRESH`
- `USER_DATA_DELETION`

Storage:
- Redis (24-hour TTL for fast access)
- PostgreSQL `audit_logs` table (long-term)

### 3.2 Sentry Integration

**Middleware:** [`backend/src/middleware/sentry.ts`](../backend/src/middleware/sentry.ts)

Monitored security metrics:
- Authentication failures
- Duplo/Remita integration errors
- UBL validation failures (55 mandatory fields)
- Rate limit violations

Sensitive data scrubbing:
- Authorization headers redacted
- PII masked in error logs

---

## 4. Third-Party Integrations

### 4.1 Duplo (DigiTax) Security

**Client:** [`backend/src/integrations/duplo.ts`](../backend/src/integrations/duplo.ts)

- OAuth 2.0 client credentials flow
- Token caching in Redis (expires 1 hour)
- Webhook signature verification (HMAC-SHA256)
- Idempotency keys prevent duplicate submissions
- Health check endpoint: `/health/duplo`

### 4.2 Remita Payment Gateway

**Client:** [`backend/src/integrations/remita/adapter.ts`](../backend/src/integrations/remita/adapter.ts)

- SHA512 signature validation on webhooks
- RRR (Remita Retrieval Reference) uniqueness enforced
- Payment status polling with exponential backoff
- Webhook replay protection via idempotency cache
- Health check endpoint: `/health/remita`

### 4.3 Africa's Talking SMS

**Client:** [`backend/src/integrations/comms/client.ts`](../backend/src/integrations/comms/client.ts)

- API key rotation supported
- Phone number normalization (`+234` prefix)
- Delivery receipts tracked in `sms_deliveries` table
- Rate limiting: 5 SMS per 5 minutes per user

---

## 5. Security Testing

### 5.1 Automated Test Suite

**Script:** [`backend/security-tests/run-tests.sh`](../backend/security-tests/run-tests.sh)

Test coverage:
1. SQL injection payloads
2. XSS script tags
3. Invalid JWT tokens
4. Rate limiting (110 requests in 60 seconds)
5. Path traversal attempts
6. Weak password rejection
7. CSRF origin validation
8. File upload size limits (2MB)
9. Security header verification

**Run tests:**
```bash
cd backend/security-tests
bash run-tests.sh http://localhost:3000
```

### 5.2 Dependency Scanning

**Command:** `npm audit`

Critical/high vulnerabilities block CI/CD deployment.

---

## 6. Deployment Security

### 6.1 Secrets Management

Stored in:
- Render Dashboard (API/Worker)
- DigitalOcean droplet `/etc/taxbridge/.env`
- Vercel project settings (Admin Dashboard)

**Never committed to Git:**
- `.env` files
- Private keys (ECDSA, API keys)
- Database credentials

### 6.2 Production Checklist

- [x] Cloudflare WAF rules active
- [x] TLS 1.3 enforced
- [x] Rate limiting enabled
- [x] Sentry error tracking
- [x] UBL XSD validation (55 fields)
- [x] Prisma encryption middleware
- [x] Webhook signature verification
- [x] Security headers (CSP, HSTS, X-Frame-Options)
- [x] NDPC DPIA completed
- [x] Breach notification procedure documented

---

## 7. NDPA Compliance Checklist

### ✅ Data Protection Measures

- [x] Data encrypted at rest (AES-256-GCM)
- [x] Data encrypted in transit (TLS 1.3)
- [x] PII fields encrypted in database (TIN, NIN)
- [x] Secure key management (environment variables)
- [x] Access controls (MFA, RBAC)

### ✅ User Rights

- [x] Right to access (DSAR export)
- [x] Right to erasure (anonymization)
- [x] Right to portability (CSV export)
- [x] Right to rectification (profile updates)

### ✅ Consent Management

- [x] Explicit consent for data processing
- [x] Consent for marketing communications (SMS opt-in)
- [x] Consent for AI/ML processing (chatbot)
- [x] Easy consent withdrawal (user settings)

### ✅ Security Measures

- [x] MFA available (TOTP)
- [x] Account lockout after failed attempts (5 attempts, 30 min)
- [x] Password complexity requirements
- [x] Session management (15 min access, 7 day refresh)
- [x] Audit logging (2-year retention)

### ✅ Breach Notification

- [x] Breach detection systems (Sentry alerts)
- [x] 72-hour NDPC notification procedure
- [x] User notification templates
- [x] Incident response runbook

### ✅ Data Retention

- [x] 7-year retention for tax records
- [x] Automated deletion of expired data (weekly cron)
- [x] Anonymization of deleted accounts
- [x] Retention policy documented

---

## 8. Cost Breakdown

| Component | Provider | Monthly Cost |
|-----------|----------|--------------|
| Cloudflare (Free Tier) | DDoS, WAF, SSL | $0 |
| Sentry (Developer Tier) | Error tracking, APM | $0-6 |
| Let's Encrypt | SSL certificates | $0 |
| Redis (Render) | Token blacklist, rate limiting | $10* |
| **Total Security Spend** | | **$10-16/month** |

*Redis cost shared with queue infrastructure

---

## 9. Incident Response

### Severity Levels

| Level | Examples | Response Time |
|-------|----------|---------------|
| **P1 (Critical)** | Data breach, database exposure | Immediate (< 1 hour) |
| **P2 (High)** | Authentication bypass, mass account lockout | < 4 hours |
| **P3 (Medium)** | Failed Duplo/Remita webhooks, rate limit abuse | < 24 hours |
| **P4 (Low)** | UBL validation warnings, Sentry errors | < 72 hours |

### Contact Information

- **Security Lead:** [Insert contact]
- **NDPC Liaison:** [Insert contact]
- **Duplo Support:** support@duplo.co
- **Remita Support:** support@remita.net

---

## 10. Continuous Improvement

### Scheduled Reviews

- **Weekly:** Security log analysis (audit_logs, Sentry dashboard)
- **Monthly:** Dependency updates (`npm audit`)
- **Quarterly:** DPIA refresh, penetration testing
- **Annually:** NDPC compliance audit

### Upcoming Enhancements

- [ ] Web Application Firewall (WAF) custom rules for invoice endpoints
- [ ] Biometric authentication (fingerprint/Face ID) for mobile app
- [ ] Hardware security module (HSM) for ECDSA key storage
- [ ] SOC 2 Type II certification (2027)

---

## References

- Nigeria Data Protection Act (NDPA) 2023: [NDPC Website](https://ndpc.gov.ng)
- OWASP Top 10 (2021): [OWASP.org](https://owasp.org/Top10/)
- Peppol BIS Billing 3.0: [Peppol Docs](https://docs.peppol.eu)
- Cloudflare Security Best Practices: [Cloudflare Docs](https://developers.cloudflare.com)

---

**Document Approval:**

- [ ] Engineering Lead
- [ ] Legal Counsel
- [ ] NDPC Data Protection Officer (DPO)

**Next Review Date:** April 11, 2026
