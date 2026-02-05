# Security Hardening Quick Reference

## Installation & Setup

### 1. Install Security Dependencies
```bash
cd backend
npm install
```

### 2. Generate Security Secrets
```bash
# Generate encryption key
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Update .env
Add to `.env.production`:
```env
ENCRYPTION_KEY=<generated>
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
```

### 4. Run Database Migrations
```bash
cd backend
npx prisma migrate dev --name add_security_fields
npx prisma generate
```

---

## Testing

### Run Security Test Suite
```bash
npm run test:security
```

### Run Dependency Audit
```bash
npm run security:audit
```

### Run All Security Checks
```bash
npm run security:check
```

---

## Cloudflare Deployment

```bash
cd infra/cloudflare
terraform init
terraform plan \
  -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN" \
  -var="cloudflare_account_id=$CLOUDFLARE_ACCOUNT_ID" \
  -var="backend_ip=<render-ip>" \
  -var="admin_ip=<vercel-ip>" \
  -var="ocr_ip=<droplet-ip>"
terraform apply
```

---

## Key Features

### Authentication
- **Password Policy:** 8+ chars, 1 uppercase, 1 number
- **MFA:** TOTP via Speakeasy
- **Session:** 15min access, 7day refresh
- **Lockout:** 5 failed attempts, 30min cooldown

### Data Protection
- **Encryption:** AES-256-GCM
- **Fields:** TIN, NIN, API keys, ECDSA keys
- **Transit:** TLS 1.3 minimum

### Network Security
- **DDoS:** Cloudflare proxy
- **WAF:** Bot blocking, geo-restrictions
- **Rate Limit:** 100 req/min API
- **Headers:** CSP, HSTS, X-Frame-Options

### NDPA Compliance
- **DSAR:** `/api/v1/privacy/export`
- **Erasure:** `/api/v1/privacy/delete`
- **Consent:** `UserConsent` model
- **Retention:** 7-year invoices

---

## Cost

- **Cloudflare Free Tier:** $0/month
- **Sentry Developer:** $0-6/month
- **Total:** $0-6/month

---

## Documentation

- [Full Security Architecture](docs/SECURITY_ARCHITECTURE.md)
- [Implementation Summary](SECURITY_IMPLEMENTATION_SUMMARY.md)
- [Deployment Checklist](infra/DEPLOYMENT_CHECKLIST.md)
