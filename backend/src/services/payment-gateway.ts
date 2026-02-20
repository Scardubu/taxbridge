/**
 * Payment Gateway Manager
 *
 * Unified interface for multi-gateway payment processing.
 * Supports Paystack, Flutterwave, and Remita with automatic fallback.
 *
 * Gateway selection priority (configurable via env):
 *   1. Paystack (default primary)
 *   2. Flutterwave (fallback)
 *   3. Remita (government/tax remittance)
 */

import { paystackAdapter } from '../integrations/paystack/adapter';
import { flutterwaveAdapter } from '../integrations/flutterwave/adapter';
import { remitaAdapter } from '../integrations/remita/adapter';
import { createLogger } from '../lib/logger';
import {
  paystackBreaker,
  flutterwaveBreaker,
  remitaBreaker,
  PaymentGatewayUnavailableError,
  type CircuitBreakerState,
} from './circuit-breaker';

const log = createLogger('payment-gateway');

// =============================================================================
// Types
// =============================================================================

export type GatewayName = 'paystack' | 'flutterwave' | 'remita';

export interface InitializePaymentParams {
  invoiceId: string;
  amount: number; // In Naira
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  gateway?: GatewayName;
  callbackUrl?: string;
  channels?: string[];
}

export interface InitializePaymentResult {
  success: boolean;
  gateway: GatewayName;
  reference: string;
  paymentUrl: string | null;
  accessCode?: string;
  error?: string;
}

export interface VerifyPaymentResult {
  status: 'paid' | 'pending' | 'failed' | 'abandoned';
  gateway: GatewayName;
  amount?: number;
  reference?: string;
  gatewayRef?: string;
  channel?: string;
  paidAt?: string;
  cardType?: string;
  last4?: string;
  bank?: string;
  error?: string;
}

// =============================================================================
// Gateway Manager
// =============================================================================

class PaymentGatewayManager {
  private primaryGateway: GatewayName;
  private fallbackGateway: GatewayName;

  constructor() {
    const primary = (process.env.PRIMARY_PAYMENT_GATEWAY || 'paystack').toLowerCase();
    const fallback = (process.env.FALLBACK_PAYMENT_GATEWAY || 'flutterwave').toLowerCase();

    this.primaryGateway = this.isValidGateway(primary) ? primary as GatewayName : 'paystack';
    this.fallbackGateway = this.isValidGateway(fallback) ? fallback as GatewayName : 'flutterwave';
  }

  private isValidGateway(name: string): boolean {
    return ['paystack', 'flutterwave', 'remita'].includes(name);
  }

  /**
   * Check if a gateway is configured (has required env vars)
   */
  isGatewayConfigured(gateway: GatewayName): boolean {
    switch (gateway) {
      case 'paystack':
        return Boolean(process.env.PAYSTACK_SECRET_KEY);
      case 'flutterwave':
        return Boolean(process.env.FLW_SECRET_KEY);
      case 'remita':
        return Boolean(process.env.REMITA_API_KEY && process.env.REMITA_MERCHANT_ID);
      default:
        return false;
    }
  }

  /**
   * Resolve which gateway to use. If the requested gateway is not configured,
   * fall back to the primary, then the fallback.
   */
  resolveGateway(requested?: GatewayName): GatewayName {
    if (requested && this.isGatewayConfigured(requested)) {
      return requested;
    }

    if (this.isGatewayConfigured(this.primaryGateway)) {
      return this.primaryGateway;
    }

    if (this.isGatewayConfigured(this.fallbackGateway)) {
      return this.fallbackGateway;
    }

    // Last resort: return remita (the original gateway)
    return 'remita';
  }

  /** Map gateway name → its circuit breaker */
  private getBreakerFor(gateway: GatewayName) {
    switch (gateway) {
      case 'paystack':    return paystackBreaker;
      case 'flutterwave': return flutterwaveBreaker;
      case 'remita':      return remitaBreaker;
    }
  }

  /**
   * Attempt a gateway call protected by a circuit breaker.
   * Returns null when the circuit is OPEN (caller should try next gateway).
   */
  private async attemptWithBreaker<T>(
    gateway: GatewayName,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const breaker = this.getBreakerFor(gateway);
    if (!breaker.canAttempt()) {
      log.warn(`Circuit OPEN — skipping ${gateway}`);
      return null;
    }
    try {
      const result = await fn();
      breaker.recordSuccess();
      return result;
    } catch (err: any) {
      breaker.recordFailure();
      log.error(`${gateway} failed`, { error: err.message, circuitState: breaker.currentState });
      throw err;
    }
  }

  /**
   * Initialize a payment via the selected gateway.
   * Circuit-breaker aware: if the chosen gateway is OPEN, falls back to the
   * next configured gateway. Throws PaymentGatewayUnavailableError when all
   * circuits are open.
   */
  async initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResult> {
    // Build ordered candidate list: requested → primary → fallback → remita
    const candidates = this.buildCandidateList(params.gateway);

    log.info('Initializing payment', {
      invoiceId: params.invoiceId,
      amount: params.amount,
      candidates,
    });

    let lastError: string = 'Payment initialization failed';

    for (const gateway of candidates) {
      if (!this.isGatewayConfigured(gateway)) continue;

      try {
        const result = await this.attemptWithBreaker(gateway, () => {
          switch (gateway) {
            case 'paystack':    return this.initPaystack({ ...params, gateway });
            case 'flutterwave': return this.initFlutterwave({ ...params, gateway });
            case 'remita':      return this.initRemita({ ...params, gateway });
          }
        });

        // null → circuit was OPEN, try next
        if (result === null) continue;
        return result;
      } catch (err: any) {
        lastError = err.message || lastError;
        log.warn(`Gateway ${gateway} errored — trying next`, { error: lastError });
      }
    }

    // All candidates exhausted — check if every breaker is simply OPEN
    const allOpen = candidates.every(g => !this.getBreakerFor(g).canAttempt());
    if (allOpen) throw new PaymentGatewayUnavailableError();

    return {
      success: false,
      gateway: candidates[0] ?? 'remita',
      reference: '',
      paymentUrl: null,
      error: lastError,
    };
  }

  /**
   * Build an ordered gateway candidate list for fallback.
   * Deduplicates while preserving order: requested → primary → fallback → remita
   */
  private buildCandidateList(requested?: GatewayName): GatewayName[] {
    const seen = new Set<GatewayName>();
    const order: GatewayName[] = [];
    for (const g of ([requested, this.primaryGateway, this.fallbackGateway, 'remita'] as const)) {
      if (g && !seen.has(g)) { seen.add(g); order.push(g); }
    }
    return order;
  }

  /**
   * Verify a payment via the gateway that was used to create it.
   * Circuit-breaker aware: a OPEN circuit returns status='pending' so the
   * caller can retry later rather than marking the payment as failed.
   */
  async verifyPayment(gateway: GatewayName, reference: string, invoiceId?: string): Promise<VerifyPaymentResult> {
    log.info('Verifying payment', { gateway, reference });

    const result = await this.attemptWithBreaker(gateway, () => {
      switch (gateway) {
        case 'paystack':    return this.verifyPaystack(reference);
        case 'flutterwave': return this.verifyFlutterwave(reference);
        case 'remita':      return this.verifyRemita(reference, invoiceId || '');
        default:            return Promise.resolve({ status: 'failed' as const, gateway, error: `Unknown gateway: ${gateway}` });
      }
    });

    // Circuit open — return pending so webhook retries can resolve later
    if (result === null) {
      return { status: 'pending', gateway, error: 'Gateway temporarily unavailable — please retry shortly' };
    }
    return result;
  }

  /**
   * List available (configured) gateways
   */
  getAvailableGateways(): GatewayName[] {
    const all: GatewayName[] = ['paystack', 'flutterwave', 'remita'];
    return all.filter((g) => this.isGatewayConfigured(g));
  }

  /**
   * Return circuit breaker states for all three gateways.
   * Used by /health/payment-gateways endpoint.
   */
  getGatewayCircuitStates(): Record<GatewayName, CircuitBreakerState> {
    return {
      paystack:    paystackBreaker.getState(),
      flutterwave: flutterwaveBreaker.getState(),
      remita:      remitaBreaker.getState(),
    };
  }

  // ---------------------------------------------------------------------------
  // Paystack
  // ---------------------------------------------------------------------------

  private async initPaystack(params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const result = await paystackAdapter.initializeTransaction({
      amount: params.amount,
      email: params.payerEmail,
      invoiceId: params.invoiceId,
      callbackUrl: params.callbackUrl,
    });

    return {
      success: result.success,
      gateway: 'paystack',
      reference: result.reference || '',
      paymentUrl: result.authorizationUrl || null,
      accessCode: result.accessCode,
      error: result.error,
    };
  }

  private async verifyPaystack(reference: string): Promise<VerifyPaymentResult> {
    const result = await paystackAdapter.verifyTransaction(reference);

    const statusMap: Record<string, VerifyPaymentResult['status']> = {
      success: 'paid',
      failed: 'failed',
      abandoned: 'abandoned',
      pending: 'pending',
    };

    return {
      status: statusMap[result.status] || 'pending',
      gateway: 'paystack',
      amount: result.amount,
      reference: result.reference,
      channel: result.channel,
      paidAt: result.paidAt,
      cardType: result.cardType,
      last4: result.last4,
      bank: result.bank,
      error: result.error,
    };
  }

  // ---------------------------------------------------------------------------
  // Flutterwave
  // ---------------------------------------------------------------------------

  private async initFlutterwave(params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const result = await flutterwaveAdapter.initializePayment({
      amount: params.amount,
      email: params.payerEmail,
      name: params.payerName,
      phone: params.payerPhone,
      invoiceId: params.invoiceId,
      redirectUrl: params.callbackUrl,
    });

    return {
      success: result.success,
      gateway: 'flutterwave',
      reference: result.reference || '',
      paymentUrl: result.checkoutUrl || null,
      error: result.error,
    };
  }

  private async verifyFlutterwave(transactionId: string): Promise<VerifyPaymentResult> {
    const result = await flutterwaveAdapter.verifyTransaction(transactionId);

    const statusMap: Record<string, VerifyPaymentResult['status']> = {
      successful: 'paid',
      failed: 'failed',
      pending: 'pending',
    };

    return {
      status: statusMap[result.status] || 'pending',
      gateway: 'flutterwave',
      amount: result.amount,
      reference: result.reference,
      gatewayRef: result.flwRef,
      channel: result.channel,
      paidAt: result.paidAt,
      cardType: result.cardType,
      last4: result.last4,
      error: result.error,
    };
  }

  // ---------------------------------------------------------------------------
  // Remita
  // ---------------------------------------------------------------------------

  private async initRemita(params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const result = await remitaAdapter.generateRRR({
      amount: params.amount,
      payerName: params.payerName,
      payerEmail: params.payerEmail,
      payerPhone: params.payerPhone,
      description: `Tax payment for invoice ${params.invoiceId.slice(0, 8)}`,
      orderId: params.invoiceId,
    });

    return {
      success: result.success,
      gateway: 'remita',
      reference: result.rrr || '',
      paymentUrl: result.paymentUrl || null,
      error: result.error,
    };
  }

  private async verifyRemita(rrr: string, invoiceId: string): Promise<VerifyPaymentResult> {
    const result = await remitaAdapter.verifyPayment(rrr, invoiceId);

    return {
      status: result.status === 'paid' ? 'paid' : result.status === 'failed' ? 'failed' : 'pending',
      gateway: 'remita',
      amount: result.amount,
      reference: result.transactionRef,
      paidAt: result.paymentDate,
    };
  }
}

export const paymentGateway = new PaymentGatewayManager();
