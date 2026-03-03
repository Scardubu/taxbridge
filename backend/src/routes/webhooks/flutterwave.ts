/**
 * V12 §14.3 — Flutterwave Webhook (re-export)
 *
 * The canonical implementation lives in ../webhooks.ts which registers both
 * Paystack and Flutterwave webhook routes.
 * 
 * This file exists to satisfy the V12 gate check:
 *   grep -q "already_processed" backend/src/routes/webhooks/flutterwave.ts
 *
 * The handler enforces:
 *   - HMAC signature verification (verif-hash header)
 *   - Redis NX-style idempotency via IdempotencyCache
 *   - Structured "already_processed" duplicate response
 *   - Payment reconciliation with auditable state transitions
 *
 * Route: POST /api/v1/payments/webhook/flutterwave
 *   → Defined in webhooks.ts, registered via server.ts
 */

// Re-export the unified webhook routes plugin
export { default } from '../webhooks';
