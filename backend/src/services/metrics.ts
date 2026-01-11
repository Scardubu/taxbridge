import * as Sentry from '@sentry/node';

interface LatencyTracker {
  sumMs: number;
  count: number;
}

function createLatencyTracker(): LatencyTracker {
  return { sumMs: 0, count: 0 };
}

function recordLatency(tracker: LatencyTracker, durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }
  tracker.sumMs += durationMs;
  tracker.count += 1;
}

function getAverageMs(tracker: LatencyTracker): number {
  return tracker.count === 0 ? 0 : tracker.sumMs / tracker.count;
}

class MetricsService {
  private duplo = {
    oauth: { total: 0, failures: 0, latency: createLatencyTracker() },
    submission: { total: 0, success: 0, failures: 0, latency: createLatencyTracker(), lastMissingFields: 0 },
    status: { total: 0, failures: 0, latency: createLatencyTracker() }
  };

  private remita = {
    payment: { total: 0, success: 0, failures: 0, amountSum: 0, latency: createLatencyTracker() },
    status: { total: 0, failures: 0, latency: createLatencyTracker() },
    webhook: { processed: 0, failed: 0 }
  };

  private ubl = {
    validations: 0,
    failures: 0,
    lastMissingFields: 0,
    lastRunAt: 0
  };

  private sentryAvailable(): boolean {
    try {
      return Boolean(Sentry.getCurrentHub().getClient());
    } catch {
      return false;
    }
  }

  private withSentryMetrics(action: () => void): void {
    if (!this.sentryAvailable()) {
      return;
    }

    try {
      action();
    } catch {
      // Ignore metric emission failures
    }
  }

  recordDuploOAuth(success: boolean, durationMs: number): void {
    if (durationMs >= 0) {
      recordLatency(this.duplo.oauth.latency, durationMs);
    }

    this.duplo.oauth.total += 1;
    if (!success) {
      this.duplo.oauth.failures += 1;
    }

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('duplo.oauth.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) {
        Sentry.metrics.distribution('duplo.oauth.latency_ms', durationMs, { unit: 'millisecond' });
      }
    });
  }

  recordDuploSubmission(success: boolean, durationMs: number, missingFields = 0): void {
    this.duplo.submission.total += 1;
    recordLatency(this.duplo.submission.latency, durationMs);
    this.duplo.submission.lastMissingFields = missingFields;

    if (success) {
      this.duplo.submission.success += 1;
    } else {
      this.duplo.submission.failures += 1;
    }

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('duplo.submission.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) {
        Sentry.metrics.distribution('duplo.submission.latency_ms', durationMs, { unit: 'millisecond' });
      }
      if (missingFields > 0) {
        Sentry.metrics.gauge('ubl.validation.missing_fields', missingFields);
      }
    });
  }

  recordDuploStatus(success: boolean, durationMs: number): void {
    this.duplo.status.total += 1;
    recordLatency(this.duplo.status.latency, durationMs);
    if (!success) {
      this.duplo.status.failures += 1;
    }

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('duplo.status.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) {
        Sentry.metrics.distribution('duplo.status.latency_ms', durationMs, { unit: 'millisecond' });
      }
    });
  }

  recordRemitaPayment(success: boolean, amount: number, durationMs: number): void {
    this.remita.payment.total += 1;
    recordLatency(this.remita.payment.latency, durationMs);
    if (success) {
      this.remita.payment.success += 1;
      this.remita.payment.amountSum += amount;
    } else {
      this.remita.payment.failures += 1;
    }

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('remita.payment.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) {
        Sentry.metrics.distribution('remita.payment.latency_ms', durationMs, { unit: 'millisecond' });
      }
      if (success && amount > 0) {
        Sentry.metrics.distribution('remita.payment.amount_naira', amount, { unit: 'naira' });
      }
    });
  }

  recordRemitaStatus(success: boolean, durationMs: number): void {
    this.remita.status.total += 1;
    recordLatency(this.remita.status.latency, durationMs);
    if (!success) {
      this.remita.status.failures += 1;
    }

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('remita.status.total', 1, { tags: { success: success.toString() } });
      if (durationMs >= 0) {
        Sentry.metrics.distribution('remita.status.latency_ms', durationMs, { unit: 'millisecond' });
      }
    });
  }

  recordRemitaWebhook(success: boolean): void {
    if (success) {
      this.remita.webhook.processed += 1;
    } else {
      this.remita.webhook.failed += 1;
    }

    this.withSentryMetrics(() => {
      Sentry.metrics.increment('remita.webhook.total', 1, { tags: { success: success.toString() } });
    });
  }

  recordUBLValidation(result: { valid: boolean; missingCount: number }): void {
    this.ubl.validations += 1;
    this.ubl.lastRunAt = Date.now();
    this.ubl.lastMissingFields = result.missingCount;
    if (!result.valid) {
      this.ubl.failures += 1;
    }

    this.withSentryMetrics(() => {
      if (!result.valid) {
        Sentry.metrics.increment('ubl.validation.errors', 1);
      }
      Sentry.metrics.gauge('ubl.validation.missing_fields', result.missingCount);
    });
  }

  formatPrometheusMetrics(): string {
    const duploSuccessRatio = this.duplo.submission.total === 0
      ? 1
      : this.duplo.submission.success / this.duplo.submission.total;

    const remitaPaymentSuccessRatio = this.remita.payment.total === 0
      ? 1
      : this.remita.payment.success / this.remita.payment.total;

    const lines = [
      '# HELP duplo_submission_total Total number of Duplo invoice submissions',
      '# TYPE duplo_submission_total counter',
      `duplo_submission_total ${this.duplo.submission.total}`,
      '# HELP duplo_submission_success_total Successful Duplo submissions',
      '# TYPE duplo_submission_success_total counter',
      `duplo_submission_success_total ${this.duplo.submission.success}`,
      '# HELP duplo_submission_success_ratio Duplo submission success ratio',
      '# TYPE duplo_submission_success_ratio gauge',
      `duplo_submission_success_ratio ${duploSuccessRatio.toFixed(4)}`,
      '# HELP duplo_submission_failure_total Failed Duplo submissions',
      '# TYPE duplo_submission_failure_total counter',
      `duplo_submission_failure_total ${this.duplo.submission.failures}`,
      '# HELP duplo_submission_duration_ms_average Average Duplo submission duration in ms',
      '# TYPE duplo_submission_duration_ms_average gauge',
      `duplo_submission_duration_ms_average ${getAverageMs(this.duplo.submission.latency).toFixed(2)}`,
      '# HELP duplo_submission_missing_fields Gauge of last observed missing mandatory fields count',
      '# TYPE duplo_submission_missing_fields gauge',
      `duplo_submission_missing_fields ${this.duplo.submission.lastMissingFields}`,
      '# HELP duplo_oauth_failure_total Failed Duplo OAuth token exchanges',
      '# TYPE duplo_oauth_failure_total counter',
      `duplo_oauth_failure_total ${this.duplo.oauth.failures}`,
      '# HELP duplo_status_failure_total Failed Duplo status checks',
      '# TYPE duplo_status_failure_total counter',
      `duplo_status_failure_total ${this.duplo.status.failures}`,
      '# HELP remita_payment_total Total Remita RRR generations',
      '# TYPE remita_payment_total counter',
      `remita_payment_total ${this.remita.payment.total}`,
      '# HELP remita_payment_success_total Successful Remita RRR generations',
      '# TYPE remita_payment_success_total counter',
      `remita_payment_success_total ${this.remita.payment.success}`,
      '# HELP remita_payment_success_ratio Remita payment success ratio',
      '# TYPE remita_payment_success_ratio gauge',
      `remita_payment_success_ratio ${remitaPaymentSuccessRatio.toFixed(4)}`,
      '# HELP remita_payment_amount_naira_sum Total amount initialized via Remita (naira)',
      '# TYPE remita_payment_amount_naira_sum counter',
      `remita_payment_amount_naira_sum ${this.remita.payment.amountSum.toFixed(2)}`,
      '# HELP remita_status_failure_total Failed Remita status checks',
      '# TYPE remita_status_failure_total counter',
      `remita_status_failure_total ${this.remita.status.failures}`,
      '# HELP remita_webhook_processed_total Remita webhook events processed',
      '# TYPE remita_webhook_processed_total counter',
      `remita_webhook_processed_total ${this.remita.webhook.processed}`,
      '# HELP remita_webhook_failed_total Remita webhook events failed validation',
      '# TYPE remita_webhook_failed_total counter',
      `remita_webhook_failed_total ${this.remita.webhook.failed}`,
      '# HELP ubl_validation_total Number of automated UBL validation checks',
      '# TYPE ubl_validation_total counter',
      `ubl_validation_total ${this.ubl.validations}`,
      '# HELP ubl_validation_failure_total Number of failed automated UBL validation checks',
      '# TYPE ubl_validation_failure_total counter',
      `ubl_validation_failure_total ${this.ubl.failures}`,
      '# HELP ubl_validation_missing_fields Gauge of missing mandatory UBL fields from last check',
      '# TYPE ubl_validation_missing_fields gauge',
      `ubl_validation_missing_fields ${this.ubl.lastMissingFields}`,
      '# HELP ubl_validation_last_run Timestamp of last automated UBL validation (unix seconds)',
      '# TYPE ubl_validation_last_run gauge',
      `ubl_validation_last_run ${this.ubl.lastRunAt ? Math.floor(this.ubl.lastRunAt / 1000) : 0}`
    ];

    return lines.join('\n');
  }
}

export const metrics = new MetricsService();
