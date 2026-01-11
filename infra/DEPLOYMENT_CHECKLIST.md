# TaxBridge Production Deployment Checklist

## Infrastructure
- [ ] DNS entries for `api.taxbridge.ng`, `ocr.taxbridge.ng`, and CDN assets point to Render/DigitalOcean endpoints
- [ ] SSL certificates issued via Let's Encrypt (Render + DigitalOcean load balancer)
- [ ] Supabase Pro instance provisioned with nightly backups (enable PITR add-on when handling >50K invoices)
- [ ] Render Redis Starter plan online with `allkeys-lru` configured
- [ ] DigitalOcean (or AWS Lightsail nano) OCR node online with UBL XSD stored locally
- [ ] Cloudflare R2 or DigitalOcean Spaces bucket configured for invoice exports and attachment storage
- [ ] Uptime monitors enabled (API, OCR, Duplo, Remita)

## Security & Compliance
- [ ] Duplo and Remita production credentials rotated and stored in Render Dashboard and droplet `.env`
- [ ] REMITA webhook secret in Render env and matched on backend `/webhooks/remita`
- [ ] DigiTax rejection handling tested end-to-end (55 mandatory fields validated)
- [ ] CSP, rate limiting, and TLS 1.2+ confirmed in Nginx and Fastify config
- [ ] NDPC DPIA approved, retention schedules documented
- [ ] Audit logs enabled for invoices, payments, and user actions

## Integrations
- [ ] Duplo OAuth token exchange verified from production IP ranges
- [ ] `/v1/einvoice/submit` and `/v1/einvoice/status` smoke-tested with sandbox invoice then production sample
- [ ] Remita `POST /ecomm/init.reg` and `GET /ecomm/status.reg` verified with SHA512 signature
- [ ] Remita webhook received by staging URL, confirmed idempotent DB writes
- [ ] OCR service tested with noisy receipt samples, fallback to Tesseract.js validated

## Testing & Quality Gates
- [ ] Backend, mobile, and admin dashboard test suites passing (114+ tests)
- [ ] k6 load tests run for duploStressTest, remitaStressTest, apiSpikeTest, endToEndInvoicePaymentFlow
- [ ] Performance gates script (`backend/scripts/check-performance-gates.js`) run with p95 thresholds < requirements
- [ ] Security scanning (npm audit + Trivy) zero high severity findings
- [ ] Manual regression on offline mobile flows (invoice creation, sync, payment)

## Launch Readiness
- [ ] Support rotation aware of Duplo/Remita escalation paths
- [ ] Runbook updated with deployment + rollback steps
- [ ] Incident communication templates reviewed (failure to stamp, webhook delays, OCR downtime)
- [ ] App Store/Play Store listings ready with latest Expo build
- [ ] Slack #ops-alerts connected to Render + UptimeRobot webhooks
