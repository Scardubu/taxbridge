import crypto from 'crypto';
import axios from 'axios';
import { getRedisConnection } from '../../queue/client';
import { metrics } from '../../services/metrics';

interface RemitaConfig {
  merchantId: string;
  apiKey: string;
  apiUrl: string;
  serviceTypeId: string;
}

interface RRRResponse {
  success: boolean;
  rrr?: string;
  paymentUrl?: string;
  error?: string;
}

interface PaymentStatus {
  status: 'pending' | 'paid' | 'failed';
  amount?: number;
  transactionRef?: string;
  paymentDate?: string;
}

export class RemitaAdapter {
  constructor(private config: RemitaConfig) {}

  private getBaseUrl(): string {
    return String(this.config.apiUrl || '').replace(/\/$/, '');
  }

  private isMockMode(): boolean {
    return String(process.env.REMITA_MOCK_MODE || 'false').toLowerCase() === 'true';
  }

  private generateHash(data: string): string {
    return crypto
      .createHash('sha512')
      .update(this.config.apiKey + data)
      .digest('hex');
  }

  async generateRRR(params: {
    amount: number;
    payerName: string;
    payerEmail: string;
    payerPhone: string;
    description: string;
    orderId: string;
  }): Promise<RRRResponse> {
    const { amount, payerName, payerEmail, payerPhone, description, orderId } = params;

    // Mock mode: generate an RRR without calling Remita.
    // IMPORTANT: This does NOT mark a payment as successful; it only simulates RRR creation.
    if (this.isMockMode()) {
      const startTime = Date.now();
      await new Promise((r) => setTimeout(r, 150));
      const duration = Date.now() - startTime;

      const rrr = `MOCK-${Date.now()}-${orderId}`;
      metrics.recordRemitaPayment(true, amount, duration);
      return {
        success: true,
        rrr,
        paymentUrl: `https://remita.net/mock/pay/${encodeURIComponent(rrr)}`
      };
    }

    // Remita requires amount in kobo (multiply by 100)
    const amountInKobo = Math.round(amount * 100);

    // Generate hash: merchantId + serviceTypeId + orderId + amount + apiKey
    const hashString = `${this.config.merchantId}${this.config.serviceTypeId}${orderId}${amountInKobo}${this.config.apiKey}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.getBaseUrl()}/remita/exapp/api/v1/send/api/echannelsvc/merchant/api/paymentinit`,
        {
          serviceTypeId: this.config.serviceTypeId,
          amount: amountInKobo,
          orderId,
          payerName,
          payerEmail,
          payerPhone,
          description,
          hash
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `remitaConsumerKey=${this.config.merchantId},remitaConsumerToken=${hash}`
          }
        }
      );

      const duration = Date.now() - startTime;

      if (response.data.statuscode === '025' || response.data.statuscode === '00') {
        const rrr = response.data.RRR || response.data.rrr;
        metrics.recordRemitaPayment(true, amount, duration);
        return {
          success: true,
          rrr,
          paymentUrl: `https://remita.net/remita/ecomm/${this.config.merchantId}/${rrr}/${hash}/payinit.reg`
        };
      } else {
        metrics.recordRemitaPayment(false, amount, duration);
        return {
          success: false,
          error: response.data.statusMessage || 'RRR generation failed'
        };
      }
    } catch (error: any) {
      metrics.recordRemitaPayment(false, amount, Date.now() - startTime);
      console.error('Remita RRR generation error:', error?.message || error);
      return {
        success: false,
        error: error.response?.data?.statusMessage || 'Network error'
      };
    }
  }

  async verifyPayment(rrr: string, orderId: string): Promise<PaymentStatus> {
    const redis = getRedisConnection();
    const cacheKey = `remita:payment:${rrr}`;

    // Mock mode: never returns "paid" without a verified webhook-driven state transition.
    // This keeps the system compliant with "no paid status without confirmation".
    if (this.isMockMode()) {
      return { status: 'pending' };
    }

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Redis cache read failed for Remita verifyPayment', err);
    }

    const hashString = `${rrr}${this.config.apiKey}${this.config.merchantId}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    let verifyStart = Date.now();

    try {
      verifyStart = Date.now();
      const response = await axios.get(
        `${this.getBaseUrl()}/remita/exapp/api/v1/send/api/echannelsvc/${this.config.merchantId}/${rrr}/${hash}/status.reg`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const duration = Date.now() - verifyStart;
      const { message, amount, RRR, transactiontime } = response.data;

      if (message === '00' || message === '01') { // Success codes
        metrics.recordRemitaStatus(true, duration);
        return {
          status: 'paid',
          amount: parseFloat(amount) / 100, // Convert from kobo to naira
          transactionRef: RRR,
          paymentDate: transactiontime
        };
      } else {
        metrics.recordRemitaStatus(false, duration);
        return { status: 'pending' };
      }
    } catch (error: any) {
      metrics.recordRemitaStatus(false, Date.now() - verifyStart);
      console.error('Remita verification error:', error?.message || error);
      return { status: 'failed' };
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha512', this.config.apiKey)
      .update(payload)
      .digest('hex');
    return hash === signature;
  }
}

export const remitaAdapter = new RemitaAdapter({
  merchantId: process.env.REMITA_MERCHANT_ID || '',
  apiKey: process.env.REMITA_API_KEY || '',
  apiUrl: process.env.REMITA_API_URL || 'https://remitademo.net',
  serviceTypeId: process.env.REMITA_SERVICE_TYPE_ID || ''
});
