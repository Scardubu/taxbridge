/**
 * Circuit Breaker — Unit Tests
 * TaxBridge V3.0
 *
 * Covers:
 *   - CLOSED → OPEN state transition (failure threshold)
 *   - OPEN → HALF_OPEN transition (cooldown elapsed)
 *   - HALF_OPEN → CLOSED on probe success
 *   - HALF_OPEN → OPEN on probe failure
 *   - Sliding window reset for stale failures
 *   - Singleton exports (paystackBreaker, flutterwaveBreaker, remitaBreaker)
 *   - PaymentGatewayUnavailableError
 *
 * Setup: jest.setup.js mocks createLogger globally.
 */

import {
  CircuitBreaker,
  paystackBreaker,
  flutterwaveBreaker,
  remitaBreaker,
  PaymentGatewayUnavailableError,
} from '../services/circuit-breaker';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Advance Date.now() by `ms` milliseconds for this test block. */
function advanceTime(ms: number) {
  const original = Date.now;
  const frozen   = original() + ms;
  jest.spyOn(Date, 'now').mockReturnValue(frozen);
  return () => jest.spyOn(Date, 'now').mockRestore();
}

// =============================================================================
// CLOSED → OPEN transition
// =============================================================================

describe('CircuitBreaker — CLOSED to OPEN', () => {
  it('starts CLOSED and allows attempts', () => {
    const cb = new CircuitBreaker('test-gateway', 3, 30_000, 60_000);
    expect(cb.canAttempt()).toBe(true);
    expect(cb.currentState).toBe('CLOSED');
  });

  it('opens after reaching failure threshold', () => {
    const cb = new CircuitBreaker('test-gateway', 3, 30_000, 60_000);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.canAttempt()).toBe(true);  // still CLOSED at 2 failures
    cb.recordFailure();                  // threshold = 3 → trips
    expect(cb.currentState).toBe('OPEN');
    expect(cb.canAttempt()).toBe(false);
  });

  it('resets failure count after success', () => {
    const cb = new CircuitBreaker('test-gateway', 3, 30_000, 60_000);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();                  // reset
    cb.recordFailure();
    expect(cb.currentState).toBe('CLOSED');  // only 1 failure post-reset
  });

  it('exposes the correct state snapshot via getState()', () => {
    const cb   = new CircuitBreaker('my-service', 2, 5_000, 10_000);
    cb.recordFailure();
    cb.recordFailure();
    const snap = cb.getState();
    expect(snap.name).toBe('my-service');
    expect(snap.state).toBe('OPEN');
    expect(snap.failures).toBeGreaterThanOrEqual(2);
    expect(typeof snap.openedAt).toBe('number');
  });
});

// =============================================================================
// OPEN → HALF_OPEN (cooldown)
// =============================================================================

describe('CircuitBreaker — OPEN to HALF_OPEN after cooldown', () => {
  it('remains OPEN before cooldown expires', () => {
    const cb = new CircuitBreaker('gw', 1, 30_000);
    cb.recordFailure();  // trip immediately at threshold=1
    expect(cb.canAttempt()).toBe(false);
  });

  it('transitions to HALF_OPEN once cooldown elapses', () => {
    const cb = new CircuitBreaker('gw', 1, 30_000);
    cb.recordFailure();
    expect(cb.canAttempt()).toBe(false);   // still OPEN

    const restore = advanceTime(31_000);   // past cooldown
    expect(cb.canAttempt()).toBe(true);    // now HALF_OPEN
    expect(cb.currentState).toBe('HALF_OPEN');
    restore();
  });
});

// =============================================================================
// HALF_OPEN transitions
// =============================================================================

describe('CircuitBreaker — HALF_OPEN probe outcomes', () => {
  function openedBreaker(cooldownMs = 30_000) {
    const cb = new CircuitBreaker('gw', 1, cooldownMs);
    cb.recordFailure();             // → OPEN
    const restore = advanceTime(cooldownMs + 1_000);
    cb.canAttempt();                // → HALF_OPEN
    restore();
    return cb;
  }

  it('closes after a successful probe', () => {
    const cb = openedBreaker();
    cb.recordSuccess();
    expect(cb.currentState).toBe('CLOSED');
    expect(cb.canAttempt()).toBe(true);
  });

  it('re-opens after a failed probe', () => {
    const cb = openedBreaker();
    cb.recordFailure();             // probe failed
    expect(cb.currentState).toBe('OPEN');
    expect(cb.canAttempt()).toBe(false);
  });
});

// =============================================================================
// Sliding window — stale failure reset
// =============================================================================

describe('CircuitBreaker — sliding window', () => {
  it('resets failure count when last failure is outside the window', () => {
    const windowMs = 60_000;
    const cb = new CircuitBreaker('gw', 3, 30_000, windowMs);

    // Record 2 failures "a long time ago"
    const restore = advanceTime(-windowMs - 5_000);
    cb.recordFailure();
    cb.recordFailure();
    restore();

    // Wait for window to expire, then record one new failure
    cb.recordFailure();               // should reset the stale count to 1
    expect(cb.currentState).toBe('CLOSED');
  });
});

// =============================================================================
// Singleton exports
// =============================================================================

describe('singleton gateway breakers', () => {
  it('exports paystackBreaker as CircuitBreaker in CLOSED state', () => {
    expect(paystackBreaker).toBeInstanceOf(CircuitBreaker);
    expect(paystackBreaker.currentState).toBe('CLOSED');
  });

  it('exports flutterwaveBreaker as CircuitBreaker in CLOSED state', () => {
    expect(flutterwaveBreaker).toBeInstanceOf(CircuitBreaker);
    expect(flutterwaveBreaker.currentState).toBe('CLOSED');
  });

  it('exports remitaBreaker as CircuitBreaker in CLOSED state', () => {
    expect(remitaBreaker).toBeInstanceOf(CircuitBreaker);
    expect(remitaBreaker.currentState).toBe('CLOSED');
  });
});

// =============================================================================
// PaymentGatewayUnavailableError
// =============================================================================

describe('PaymentGatewayUnavailableError', () => {
  it('is an Error subclass', () => {
    const err = new PaymentGatewayUnavailableError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PaymentGatewayUnavailableError');
    expect(err.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
  });

  it('supports a custom message', () => {
    const msg = 'Custom unavailable message';
    const err = new PaymentGatewayUnavailableError(msg);
    expect(err.message).toBe(msg);
  });

  it('uses a sensible default message', () => {
    const err = new PaymentGatewayUnavailableError();
    expect(err.message).toMatch(/retry in 30 seconds/i);
  });
});

// =============================================================================
// Multiple-failure threshold edge cases
// =============================================================================

describe('CircuitBreaker — threshold edge cases', () => {
  it('threshold=1: trips on first failure', () => {
    const cb = new CircuitBreaker('strict', 1, 1_000);
    cb.recordFailure();
    expect(cb.currentState).toBe('OPEN');
  });

  it('threshold=5: stays CLOSED through 4 failures', () => {
    const cb = new CircuitBreaker('relaxed', 5, 30_000);
    for (let i = 0; i < 4; i++) cb.recordFailure();
    expect(cb.currentState).toBe('CLOSED');
    cb.recordFailure();
    expect(cb.currentState).toBe('OPEN');
  });

  it('interleaved successes prevent tripping', () => {
    const cb = new CircuitBreaker('interleaved', 3, 30_000);
    cb.recordFailure();
    cb.recordSuccess();  // reset to 0
    cb.recordFailure();
    cb.recordSuccess();  // reset to 0
    cb.recordFailure();
    expect(cb.currentState).toBe('CLOSED');
  });
});
