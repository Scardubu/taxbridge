# Remita Payment Integration - Quick Start Guide

````markdown
# Remita Payment Integration - Quick Start & Production Guide

This document covers the sandbox quickstart and production hardening guidance for the Remita integration used by TaxBridge.

---

## 📦 What’s Included

- Backend: Remita adapter, payment routes (generate RRR, webhook handler, status check), Prisma Payment model, idempotency cache and queue integration.
- Mobile: `PaymentScreen` with form validation and deep-linking to Remita.
- Tests: unit tests for adapter and E2E script for sandbox flows.

---

## 🚀 Quickstart (Sandbox)

1. Start backend:

```bash
cd backend
yarn dev
# Server runs on http://localhost:3000
```

2. Run sandbox E2E flow:

```bash
cd backend
npx ts-node src/tools/remita-e2e-test.ts
```

3. Start mobile (optional):

```bash
cd mobile
yarn start
```

---

## 🔧 Important Environment Variables

Set these in your deployment secrets (do NOT commit):

- `REMITA_MERCHANT_ID`
- `REMITA_API_KEY` (used for request signing and webhook HMAC — keep secret)
- `REMITA_SERVICE_TYPE_ID`
- `REMITA_API_URL` (sandbox vs production host)
- `REDIS_URL`, `DATABASE_URL`
- `START_PAYMENT_WORKER` (optional; default `false` — prefer separate worker)

Example `.env` (production):

```env
REMITA_MERCHANT_ID=xxxxxxxx
REMITA_API_KEY=very_secret_value
REMITA_SERVICE_TYPE_ID=123456
REMITA_API_URL=https://login.remita.net
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://user:pass@db:5432/taxbridge
START_PAYMENT_WORKER=false
```

---

## Webhook Setup & Security (Production)

1. Configure Remita to POST payment notifications to:

   `https://<your-api-domain>/webhooks/remita/payment`

2. Signature verification

   - The application verifies webhooks using HMAC-SHA512 with `REMITA_API_KEY`.
   - Remita should provide a signature header (example header: `X-Remita-Signature`). Our handler computes:

     ```text
     signature = HMAC_SHA512(REMITA_API_KEY, JSON.stringify(payload))
     ```

   - The handler rejects requests where the computed HMAC does not match the header.

3. TLS / network

   - Webhook endpoints MUST be exposed over HTTPS with a valid certificate.
   - Terminate TLS at the gateway (nginx, load balancer) and forward to internal service.
   - If Remita publishes webhook IP ranges, consider firewall rules to accept only those IPs.

4. Idempotency and performance

   - Webhooks are de-duplicated using the `IdempotencyCache` table (the route computes a request hash and stores it to avoid reprocessing).
   - The webhook handler verifies signature and enqueues a background job to process the payment (quick 200 OK response). Heavy work is performed by the worker.

---

## Worker Deployment (Recommended)

- Run the payment worker as a separate service that consumes the `payment-webhook` queue (BullMQ). This isolates workload and improves reliability.
- Deployment options:
  - Systemd service running `yarn queue:worker` or a node process that imports `src/queue/paymentWorker.ts`.
  - Docker container with env and a Redis host.
  - Kubernetes Deployment/Job with concurrency controls.

Example systemd unit (outline):

```ini
[Unit]
Description=TaxBridge Payment Worker
After=network.target

[Service]
EnvironmentFile=/etc/taxbridge.env
WorkingDirectory=/srv/taxbridge/backend
ExecStart=/usr/bin/yarn queue:worker
Restart=on-failure
User=svc-taxbridge

[Install]
WantedBy=multi-user.target
```

If you must run in the same process, set `START_PAYMENT_WORKER=true`. Note: running worker in-process is simpler but less robust for production.

---

## Reverse Proxy / TLS Example (nginx)

```nginx
server {
  listen 80;
  server_name api.taxbridge.example;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name api.taxbridge.example;

  ssl_certificate /etc/letsencrypt/live/api.taxbridge.example/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.taxbridge.example/privkey.pem;

  location /webhooks/remita/payment {
    proxy_pass http://127.0.0.1:3000/webhooks/remita/payment;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

---

## Monitoring & Alerts

- Instrument application errors with Sentry (exceptions, unhandled rejections).
- Export metrics (Prometheus) for:
  - Webhook request rate and signature failures
  - Queue length and job failures
  - Payment success/failure rates
- Alert on sustained worker failures or backlog growth.

---

## Testing & Sandbox Tips

- Use Remita sandbox credentials and `REMITA_API_URL` to test RRR generation.
- Use `ngrok` or similar to expose local server for webhook testing:

```bash
ngrok http 3000
# Configure webhook to https://<ngrok-id>.ngrok.io/webhooks/remita/payment
```

- Local signature generation example:

```js
const crypto = require('crypto');
const payload = JSON.stringify({ rrr: 'RRR-123', orderId: 'INV-...' });
const signature = crypto.createHmac('sha512', process.env.REMITA_API_KEY).update(payload).digest('hex');

// Send POST with header X-Remita-Signature: <signature>
```

---

## Post-deploy Checklist

- Verify production credentials and rotate keys regularly.
- Confirm webhooks are being delivered and processed (inspect `payments`, `audit_logs`, queue metrics).
- Reconcile payments with Remita reports on a schedule.
- Run load and failure tests for concurrent payment attempts.

---

**Last Updated**: January 6, 2026
**Status**: ✅ Production Ready
**Version**: 1.1.0

````
| Invoice not found on payment | Ensure invoiceId exists and is stamped |
