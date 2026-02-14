/**
 * Flutterwave Payment Gateway Adapter
 *
 * Handles payment initialization, verification, and webhook signature
 * verification for the Flutterwave (Rave) payment gateway.
 *
 * @see https://developer.flutterwave.com/docs
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../lib/logger';
import { metrics } from '../../services/metrics';
import type {
  FlutterwaveConfig,
  FlutterwaveInitializeRequest,
  FlutterwaveInitializeResponse,
  FlutterwaveVerifyResponse,
  FlutterwaveInitResult,
  FlutterwaveVerifyResult,
} from './types';

const log = createLogger('flutterwave');

export class FlutterwaveAdapter {
  private client: AxiosInstance;

  constructor(private config: FlutterwaveConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  private isMockMode(): boolean {
    return String(process.env.FLW_MOCK_MODE || 'false').toLowerCase() === 'true';
  }

  /**
   * Generate a unique transaction reference
   */
  generateReference(invoiceId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `TB-FLW-${timestamp}-${random}`;
  }

  /**
   * Initialize a Flutterwave payment
   */
  async initializePayment(params: {
    amount: number; // In Naira
    email: string;
    name?: string;
    phone?: string;
    invoiceId: string;
    redirectUrl?: string;
  }): Promise<FlutterwaveInitResult> {
    const reference = this.generateReference(params.invoiceId);

    if (this.isMockMode()) {
      const startTime = Date.now();
      await new Promise((r) => setTimeout(r, 100));
      const duration = Date.now() - startTime;

      metrics.recordFlutterwavePayment(true, params.amount, duration);

      return {
        success: true,
        reference,
        checkoutUrl: `https://checkout.flutterwave.com/mock/${reference}`,
      };
    }

    const startTime = Date.now();

    try {
      const payload: FlutterwaveInitializeRequest = {
        tx_ref: reference,
        amount: params.amount,
        currency: 'NGN',
        redirect_url: params.redirectUrl,
        customer: {
          email: params.email,
          name: params.name,
          phonenumber: params.phone,
        },
        meta: {
          invoiceId: params.invoiceId,
          source: 'taxbridge',
        },
        payment_options: 'card,banktransfer,ussd',
        customizations: {
          title: 'TaxBridge Payment',
          description: `Invoice payment via TaxBridge`,
          logo: 'https://taxbridge.ng/logo.png',
        },
      };

      const response = await this.client.post<FlutterwaveInitializeResponse>(
        '/v3/payments',
        payload,
      );

      const duration = Date.now() - startTime;

      if (response.data.status === 'success') {
        metrics.recordFlutterwavePayment(true, params.amount, duration);
        return {
          success: true,
          reference,
          checkoutUrl: response.data.data.link,
        };
      }

      metrics.recordFlutterwavePayment(false, params.amount, duration);
      return {
        success: false,
        error: response.data.message || 'Payment initialization failed',
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      metrics.recordFlutterwavePayment(false, params.amount, duration);
      log.error('Flutterwave initialization error', { error: error?.message || String(error) });
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Network error',
      };
    }
  }

  /**
   * Verify a Flutterwave transaction by its ID
   */
  async verifyTransaction(transactionId: string): Promise<FlutterwaveVerifyResult> {
    if (this.isMockMode()) {
      return { status: 'pending' };
    }

    const startTime = Date.now();

    try {
      const response = await this.client.get<FlutterwaveVerifyResponse>(
        `/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
      );

      const duration = Date.now() - startTime;
      const { data } = response.data;

      if (data.status === 'successful') {
        metrics.recordFlutterwaveStatus(true, duration);
        return {
          status: 'successful',
          amount: data.amount,
          reference: data.tx_ref,
          flwRef: data.flw_ref,
          channel: data.payment_type,
          paidAt: data.created_at,
          cardType: data.card?.type,
          last4: data.card?.last_4digits,
        };
      }

      metrics.recordFlutterwaveStatus(false, duration);
      return {
        status: data.status === 'pending' ? 'pending' : 'failed',
        reference: data.tx_ref,
      };
    } catch (error: any) {
      metrics.recordFlutterwaveStatus(false, Date.now() - startTime);
      log.error('Flutterwave verification error', { error: error?.message || String(error) });
      return {
        status: 'pending',
        error: error.response?.data?.message || error.message || 'Verification failed',
      };
    }
  }

  /**
   * Verify Flutterwave webhook signature using the secret hash
   * @see https://developer.flutterwave.com/docs/integration-guides/webhooks
   */
  verifyWebhookSignature(signatureHeader: string): boolean {
    return signatureHeader === this.config.secretHash;
  }
}

export const flutterwaveAdapter = new FlutterwaveAdapter({
  publicKey: process.env.FLW_PUBLIC_KEY || '',
  secretKey: process.env.FLW_SECRET_KEY || '',
  secretHash: process.env.FLW_SECRET_HASH || '',
  encryptionKey: process.env.FLW_ENCRYPTION_KEY || '',
  baseUrl: process.env.FLW_BASE_URL || 'https://api.flutterwave.com',
});
