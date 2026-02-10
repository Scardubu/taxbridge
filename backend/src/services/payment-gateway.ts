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

  /**
   * Initialize a payment via the selected gateway
   */
  async initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const gateway = this.resolveGateway(params.gateway);

    log.info('Initializing payment', {
      gateway,
      invoiceId: params.invoiceId,
      amount: params.amount,
    });

    try {
      switch (gateway) {
        case 'paystack':
          return await this.initPaystack(params);
        case 'flutterwave':
          return await this.initFlutterwave(params);
        case 'remita':
          return await this.initRemita(params);
        default:
          return { success: false, gateway, reference: '', paymentUrl: null, error: `Unknown gateway: ${gateway}` };
      }
    } catch (err: any) {
      log.error('Payment initialization failed, attempting fallback', { gateway, error: err.message });

      // Attempt fallback if primary fails
      if (gateway === this.primaryGateway && gateway !== this.fallbackGateway) {
        const fallback = this.fallbackGateway;
        if (this.isGatewayConfigured(fallback)) {
          log.info('Falling back to secondary gateway', { fallback });
          try {
            switch (fallback) {
              case 'paystack':
                return await this.initPaystack(params);
              case 'flutterwave':
                return await this.initFlutterwave(params);
              case 'remita':
                return await this.initRemita(params);
            }
          } catch (fallbackErr: any) {
            log.error('Fallback gateway also failed', { fallback, error: fallbackErr.message });
          }
        }
      }

      return {
        success: false,
        gateway,
        reference: '',
        paymentUrl: null,
        error: err.message || 'Payment initialization failed',
      };
    }
  }

  /**
   * Verify a payment via the gateway that was used to create it
   */
  async verifyPayment(gateway: GatewayName, reference: string, invoiceId?: string): Promise<VerifyPaymentResult> {
    log.info('Verifying payment', { gateway, reference });

    switch (gateway) {
      case 'paystack':
        return await this.verifyPaystack(reference);
      case 'flutterwave':
        return await this.verifyFlutterwave(reference);
      case 'remita':
        return await this.verifyRemita(reference, invoiceId || '');
      default:
        return { status: 'failed', gateway, error: `Unknown gateway: ${gateway}` };
    }
  }

  /**
   * List available (configured) gateways
   */
  getAvailableGateways(): GatewayName[] {
    const all: GatewayName[] = ['paystack', 'flutterwave', 'remita'];
    return all.filter((g) => this.isGatewayConfigured(g));
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
