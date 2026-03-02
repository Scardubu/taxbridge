import * as Sentry from '@sentry/node';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// ── V12 §17.1: prom-client Registry singleton ──────────────────────────
// Exactly one Registry instance for the entire backend process.
// Enforcement gate: `grep -rn "new Registry()" backend/src` → 1 match.
export const registry = new Registry();

registry.setDefaultLabels({ app: 'taxbridge' });

// ── Prometheus metric definitions ──────────────────────────────────────

// Duplo / DigiTax APP
const duploOAuthTotal = new Counter({ name: 'duplo_oauth_total', help: 'Total Duplo OAuth token exchanges', labelNames: ['success'] as const, registers: [registry] });
const duploOAuthDuration = new Histogram({ name: 'duplo_oauth_duration_ms', help: 'Duplo OAuth latency (ms)', buckets: [50, 100, 250, 500, 1000, 2500, 5000], registers: [registry] });
const duploSubmissionTotal = new Counter({ name: 'duplo_submission_total', help: 'Total Duplo invoice submissions', labelNames: ['success'] as const, registers: [registry] });
const duploSubmissionDuration = new Histogram({ name: 'duplo_submission_duration_ms', help: 'Duplo submission latency (ms)', buckets: [100, 250, 500, 1000, 2500, 5000, 10000], registers: [registry] });
const duploSubmissionMissingFields = new Gauge({ name: 'duplo_submission_missing_fields', help: 'Last observed missing mandatory UBL fields count', registers: [registry] });
const duploStatusTotal = new Counter({ name: 'duplo_status_total', help: 'Total Duplo status checks', labelNames: ['success'] as const, registers: [registry] });
const duploStatusDuration = new Histogram({ name: 'duplo_status_duration_ms', help: 'Duplo status check latency (ms)', buckets: [50, 100, 250, 500, 1000, 2500], registers: [registry] });

// Remita
const remitaPaymentTotal = new Counter({ name: 'remita_payment_total', help: 'Total Remita RRR generations', labelNames: ['success'] as const, registers: [registry] });
const remitaPaymentDuration = new Histogram({ name: 'remita_payment_duration_ms', help: 'Remita payment latency (ms)', buckets: [100, 250, 500, 1000, 2500, 5000], registers: [registry] });
const remitaPaymentAmountSum = new Counter({ name: 'remita_payment_amount_naira_sum', help: 'Total amount initialized via Remita (naira)', registers: [registry] });
const remitaStatusTotal = new Counter({ name: 'remita_status_total', help: 'Total Remita status checks', labelNames: ['success'] as const, registers: [registry] });
const remitaStatusDuration = new Histogram({ name: 'remita_status_duration_ms', help: 'Remita status check latency (ms)', buckets: [50, 100, 250, 500, 1000, 2500], registers: [registry] });
const remitaWebhookTotal = new Counter({ name: 'remita_webhook_total', help: 'Remita webhook events', labelNames: ['success'] as const, registers: [registry] });

// Paystack
const paystackPaymentTotal = new Counter({ name: 'paystack_payment_total', help: 'Total Paystack transactions', labelNames: ['success'] as const, registers: [registry] });
const paystackPaymentDuration = new Histogram({ name: 'paystack_payment_duration_ms', help: 'Paystack payment latency (ms)', buckets: [100, 250, 500, 1000, 2500, 5000], registers: [registry] });
const paystackStatusTotal = new Counter({ name: 'paystack_status_total', help: 'Total Paystack status checks', labelNames: ['success'] as const, registers: [registry] });
const paystackWebhookTotal = new Counter({ name: 'paystack_webhook_total', help: 'Paystack webhook events', labelNames: ['success'] as const, registers: [registry] });

// Flutterwave
const flutterwavePaymentTotal = new Counter({ name: 'flutterwave_payment_total', help: 'Total Flutterwave transactions', labelNames: ['success'] as const, registers: [registry] });
const flutterwavePaymentDuration = new Histogram({ name: 'flutterwave_payment_duration_ms', help: 'Flutterwave payment latency (ms)', buckets: [100, 250, 500, 1000, 2500, 5000], registers: [registry] });
const flutterwaveStatusTotal = new Counter({ name: 'flutterwave_status_total', help: 'Total Flutterwave status checks', labelNames: ['success'] as const, registers: [registry] });
const flutterwaveWebhookTotal = new Counter({ name: 'flutterwave_webhook_total', help: 'Flutterwave webhook events', labelNames: ['success'] as const, registers: [registry] });

// UBL
const ublValidationTotal = new Counter({ name: 'ubl_validation_total', help: 'Automated UBL validation checks', labelNames: ['valid'] as const, registers: [registry] });
const ublValidationMissingFields = new Gauge({ name: 'ubl_validation_missing_fields', help: 'Missing mandatory UBL fields from last check', registers: [registry] });
const ublValidationLastRun = new Gauge({ name: 'ubl_validation_last_run', help: 'Timestamp of last automated UBL validation (unix seconds)', registers: [registry] });

// ── MetricsService (preserves existing public API) ─────────────────────

class MetricsService {
  private sentryAvailable(): boolean {
    try {
      return Boolean(Sentry.getCurrentHub().getClient());
    } catch {
      return false;
    }
  }

  private withSentryMetrics(action: () => void): void {
    if (!this.sentryAvailable()) return;
    try { action(); } catch { /* Ignore metric emission failures */ }
  }

  recordDuploOAuth(success: boolean, durationMs: number): void {
    duploOAuthTotal.inc({ success: success.toString() });
    if (durationMs >= 0) duploOAuthDuration.observe(durationMs);

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('duplo.oauth.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) Sentry.metrics.distribution('duplo.oauth.latency_ms', durationMs, { unit: 'millisecond' });
    });
  }

  recordDuploSubmission(success: boolean, durationMs: number, missingFields = 0): void {
    duploSubmissionTotal.inc({ success: success.toString() });
    if (durationMs >= 0) duploSubmissionDuration.observe(durationMs);
    duploSubmissionMissingFields.set(missingFields);

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('duplo.submission.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) Sentry.metrics.distribution('duplo.submission.latency_ms', durationMs, { unit: 'millisecond' });
      if (missingFields > 0) Sentry.metrics.gauge('ubl.validation.missing_fields', missingFields);
    });
  }

  recordDuploStatus(success: boolean, durationMs: number): void {
    duploStatusTotal.inc({ success: success.toString() });
    if (durationMs >= 0) duploStatusDuration.observe(durationMs);

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('duplo.status.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) Sentry.metrics.distribution('duplo.status.latency_ms', durationMs, { unit: 'millisecond' });
    });
  }

  recordRemitaPayment(success: boolean, amount: number, durationMs: number): void {
    remitaPaymentTotal.inc({ success: success.toString() });
    if (durationMs >= 0) remitaPaymentDuration.observe(durationMs);
    if (success && amount > 0) remitaPaymentAmountSum.inc(amount);

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('remita.payment.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) Sentry.metrics.distribution('remita.payment.latency_ms', durationMs, { unit: 'millisecond' });
      if (success && amount > 0) Sentry.metrics.distribution('remita.payment.amount_naira', amount, { unit: 'naira' });
    });
  }

  recordRemitaStatus(success: boolean, durationMs: number): void {
    remitaStatusTotal.inc({ success: success.toString() });
    if (durationMs >= 0) remitaStatusDuration.observe(durationMs);

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('remita.status.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) Sentry.metrics.distribution('remita.status.latency_ms', durationMs, { unit: 'millisecond' });
    });
  }

  recordRemitaWebhook(success: boolean): void {
    remitaWebhookTotal.inc({ success: success.toString() });

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('remita.webhook.total', 1, { tags: { success: success.toString() } });
    });
  }

  // --- Paystack metrics ---

  recordPaystackPayment(success: boolean, amount: number, durationMs: number): void {
    paystackPaymentTotal.inc({ success: success.toString() });
    if (durationMs >= 0) paystackPaymentDuration.observe(durationMs);

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('paystack.payment.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) Sentry.metrics.distribution('paystack.payment.latency_ms', durationMs, { unit: 'millisecond' });
    });
  }

  recordPaystackStatus(success: boolean, durationMs: number): void {
    paystackStatusTotal.inc({ success: success.toString() });

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('paystack.status.total', 1, { tags: { success: success.toString() } });
    });
  }

  recordPaystackWebhook(success: boolean): void {
    paystackWebhookTotal.inc({ success: success.toString() });

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('paystack.webhook.total', 1, { tags: { success: success.toString() } });
    });
  }

  // --- Flutterwave metrics ---

  recordFlutterwavePayment(success: boolean, amount: number, durationMs: number): void {
    flutterwavePaymentTotal.inc({ success: success.toString() });
    if (durationMs >= 0) flutterwavePaymentDuration.observe(durationMs);

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('flutterwave.payment.total', 1, { tags: { success: success.toString() } });
    });
  }

  recordFlutterwaveStatus(success: boolean, durationMs: number): void {
    flutterwaveStatusTotal.inc({ success: success.toString() });

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('flutterwave.status.total', 1, { tags: { success: success.toString() } });
    });
  }

  recordFlutterwaveWebhook(success: boolean): void {
    flutterwaveWebhookTotal.inc({ success: success.toString() });

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('flutterwave.webhook.total', 1, { tags: { success: success.toString() } });
    });
  }

  recordUBLValidation(result: { valid: boolean; missingCount: number }): void {
    ublValidationTotal.inc({ valid: result.valid.toString() });
    ublValidationMissingFields.set(result.missingCount);
    ublValidationLastRun.set(Math.floor(Date.now() / 1000));

    this.withSentryMetrics(() => {
      if (!result.valid) Sentry.metrics.increment('ubl.validation.errors', 1);
      Sentry.metrics.gauge('ubl.validation.missing_fields', result.missingCount);
    });
  }

  /**
   * Returns Prometheus exposition format from the prom-client Registry.
   * Used by GET /metrics?format=prometheus in server.ts.
   */
  async formatPrometheusMetrics(): Promise<string> {
    return registry.metrics();
  }
}

export const metrics = new MetricsService();
