/**
 * Circuit Breaker — TaxBridge V3.0
 *
 * Generic circuit breaker implementation for external service calls.
 *
 * State machine:
 *   CLOSED → [N failures in window] → OPEN
 *   OPEN → [cooldown elapsed] → HALF_OPEN
 *   HALF_OPEN → [probe succeeds] → CLOSED
 *   HALF_OPEN → [probe fails] → OPEN
 *
 * Usage:
 *   const breaker = new CircuitBreaker('paystack');
 *   if (breaker.canAttempt()) { /* call gateway *\/ }
 *   breaker.recordSuccess() / breaker.recordFailure()
 */

import { createLogger } from '../lib/logger';

const log = createLogger('circuit-breaker');

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerState {
  name:       string;
  state:      CircuitState;
  failures:   number;
  lastFailure: number | null;
  openedAt:   number | null;
}

export class CircuitBreaker {
  private failures    = 0;
  private lastFailureTime: number = 0;
  private state: CircuitState = 'CLOSED';
  private openedAt: number = 0;

  constructor(
    private readonly name: string,
    /** Number of failures within the window that trips the breaker */
    private readonly failureThreshold: number = 3,
    /** How long the circuit stays OPEN before probing (ms) */
    private readonly cooldownMs: number = 30_000,
    /** Sliding window within which failures are counted (ms) */
    private readonly windowMs: number = 60_000,
  ) {}

  /**
   * Returns true when the gateway should be attempted.
   * CLOSED: always allowed.
   * OPEN: only after cooldown (transitions to HALF_OPEN).
   * HALF_OPEN: one probe allowed.
   */
  canAttempt(): boolean {
    if (this.state === 'CLOSED') return true;

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.cooldownMs) {
        log.info(`Circuit HALF_OPEN — probing ${this.name}`);
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    // HALF_OPEN: single probe already allowed by the OPEN→HALF_OPEN transition
    return true;
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      log.info(`Circuit CLOSED — ${this.name} probe succeeded`);
    }
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    const now = Date.now();

    // Reset failure count if outside the sliding window
    if (this.lastFailureTime > 0 && now - this.lastFailureTime > this.windowMs) {
      this.failures = 0;
    }

    this.failures++;
    this.lastFailureTime = now;

    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state    = 'CLOSED' === this.state ? 'OPEN' : 'OPEN';
      this.openedAt = now;
      log.warn(`Circuit OPEN — ${this.name} tripped (${this.failures} failures)`);
    }
  }

  getState(): CircuitBreakerState {
    return {
      name:        this.name,
      state:       this.state,
      failures:    this.failures,
      lastFailure: this.lastFailureTime || null,
      openedAt:    this.openedAt || null,
    };
  }

  /** Expose current state string for logging/monitoring */
  get currentState(): CircuitState {
    return this.state;
  }
}

// ─── Singleton instances — one per payment gateway ────────────────────────────
// Exported so payment-gateway.ts can import them directly.

export const paystackBreaker    = new CircuitBreaker('paystack');
export const flutterwaveBreaker = new CircuitBreaker('flutterwave');
export const remitaBreaker      = new CircuitBreaker('remita');

/** Custom error raised when all gateways are in OPEN state */
export class PaymentGatewayUnavailableError extends Error {
  readonly code = 'PAYMENT_GATEWAY_UNAVAILABLE';
  constructor(message = 'All payment gateways are temporarily unavailable. Please retry in 30 seconds.') {
    super(message);
    this.name = 'PaymentGatewayUnavailableError';
  }
}
