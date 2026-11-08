/**
 * Paystack Payment Gateway Adapter
 *
 * Handles transaction initialization, verification, and webhook signature
 * verification for the Paystack payment gateway.
 *
 * @see https://paystack.com/docs/api/
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../lib/logger';
import { metrics } from '../../services/metrics';
import type {
  PaystackConfig,
  PaystackInitializeRequest,
  PaystackInitializeResponse,
  PaystackVerifyResponse,
  PaystackInitResult,
  PaystackVerifyResult,
} from './types';

const log = createLogger('paystack');

export class PaystackAdapter {
  private client: AxiosInstance;

  constructor(private config: PaystackConfig) {
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
    return String(process.env.PAYSTACK_MOCK_MODE || 'false').toLowerCase() === 'true';
  }

  /**
   * Generate a unique payment reference
   */
  generateReference(invoiceId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `TB-${timestamp}-${random}`;
  }

  /**
   * Initialize a Paystack transaction
   */
  async initializeTransaction(params: {
    amount: number; // In Naira
    email: string;
    invoiceId: string;
    callbackUrl?: string;
    channels?: PaystackInitializeRequest['channels'];
  }): Promise<PaystackInitResult> {
    const reference = this.generateReference(params.invoiceId);
    const amountInKobo = Math.round(params.amount * 100);

    if (this.isMockMode()) {
      const startTime = Date.now();
      await new Promise((r) => setTimeout(r, 100));
      const duration = Date.now() - startTime;

      try { metrics.recordPaystackPayment(true, params.amount, duration); } catch {}

      return {
        success: true,
        reference,
        authorizationUrl: `https://checkout.paystack.com/mock/${reference}`,
        accessCode: `mock_${reference}`,
      };
    }

    const startTime = Date.now();

    try {
      const payload: PaystackInitializeRequest = {
        amount: amountInKobo,
        email: params.email,
        reference,
        callback_url: params.callbackUrl,
        channels: params.channels,
        currency: 'NGN',
        metadata: {
          invoiceId: params.invoiceId,
          source: 'taxbridge',
        },
      };

      const response = await this.client.post<PaystackInitializeResponse>(
        '/transaction/initialize',
        payload,
      );

      const duration = Date.now() - startTime;

      if (response.data.status) {
        try { metrics.recordPaystackPayment(true, params.amount, duration); } catch {}
        return {
          success: true,
          reference: response.data.data.reference,
          authorizationUrl: response.data.data.authorization_url,
          accessCode: response.data.data.access_code,
        };
      }

      try { metrics.recordPaystackPayment(false, params.amount, duration); } catch {}
      return {
        success: false,
        error: response.data.message || 'Transaction initialization failed',
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      try { metrics.recordPaystackPayment(false, params.amount, duration); } catch {}
      log.error('Paystack initialization error', { error: error?.message || String(error) });
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Network error',
      };
    }
  }

  /**
   * Verify a Paystack transaction
   */
  async verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
    if (this.isMockMode()) {
      return { status: 'pending' };
    }

    const startTime = Date.now();

    try {
      const response = await this.client.get<PaystackVerifyResponse>(
        `/transaction/verify/${encodeURIComponent(reference)}`,
      );

      const duration = Date.now() - startTime;
      const { data } = response.data;

      if (data.status === 'success') {
        try { metrics.recordPaystackStatus(true, duration); } catch {}
        return {
          status: 'success',
          amount: data.amount / 100, // Convert kobo to Naira
          currency: data.currency,
          reference: data.reference,
          channel: data.channel,
          paidAt: data.paid_at || undefined,
          cardType: data.authorization?.card_type,
          last4: data.authorization?.last4,
          bank: data.authorization?.bank,
        };
      }

      try { metrics.recordPaystackStatus(false, duration); } catch {}
      return {
        status: data.status === 'abandoned' ? 'abandoned' : 'failed',
        reference: data.reference,
      };
    } catch (error: any) {
      try { metrics.recordPaystackStatus(false, Date.now() - startTime); } catch {}
      log.error('Paystack verification error', { error: error?.message || String(error) });
      return {
        status: 'pending',
        error: error.response?.data?.message || error.message || 'Verification failed',
      };
    }
  }

  /**
   * Verify Paystack webhook signature
   * @see https://paystack.com/docs/payments/webhooks/#verify-event-origin
   */
  /**
   * Verify Paystack webhook signatures over the unmodified request body.
   * Supports legacy x-paystack-signature and timestamped Paystack-Signature.
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    nowSeconds = Math.floor(Date.now() / 1000),
  ): boolean {
    if (!signature) return false;
    const rawBody = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');

    if (signature.includes('t=')) {
      if (!this.config.webhookSecret.startsWith('whsec_')) return false;
      const fields = signature.split(',').map((field) => field.trim());
      const timestampText = fields.find((field) => field.startsWith('t='))?.slice(2) ?? '';
      if (!/^\d+$/.test(timestampText)) return false;
      const timestamp = Number(timestampText);
      if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;

      const signedPayload = Buffer.concat([Buffer.from(timestampText + '.', 'utf8'), rawBody]);
      const expected = crypto.createHmac('sha512', this.config.webhookSecret).update(signedPayload).digest();
      const candidates = fields
        .filter((field) => field.startsWith('v1='))
        .map((field) => field.slice(3).split(':').slice(1).join(':'))
        .filter((candidate) => /^[a-f0-9]{128}$/i.test(candidate));

      return candidates.some((candidate) => {
        const received = Buffer.from(candidate, 'hex');
        return received.length === expected.length && crypto.timingSafeEqual(expected, received);
      });
    }

    if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
    const expected = crypto.createHmac('sha512', this.config.secretKey).update(rawBody).digest();
    const received = Buffer.from(signature, 'hex');
    return received.length === expected.length && crypto.timingSafeEqual(expected, received);
  }
}

export const paystackAdapter = new PaystackAdapter({
  secretKey: process.env.PAYSTACK_SECRET_KEY || '',
  publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
  webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
});
