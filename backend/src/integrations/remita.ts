import axios from 'axios';
import crypto from 'crypto';
import { CacheManager } from '../lib/cache';
import { createLogger } from '../lib/logger';
import { metrics } from '../services/metrics';

const log = createLogger('remita');

// Cache instance for Remita payment status (short TTL to ensure freshness)
const remitaCache = new CacheManager('remita');
const STATUS_CACHE_TTL = 60; // 1 minute cache for payment status

export interface RemitaPaymentRequest {
  merchantId: string;
  serviceTypeId: string;
  orderId: string;
  amount: number;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  description?: string;
}

export interface RemitaInitResponse {
  rrr: string;
  status: string;
  paymentUrl: string;
  transactionDate: string;
}

export interface RemitaStatusResponse {
  rrr: string;
  status: 'pending' | 'successful' | 'failed';
  amount: number;
  transactionDate?: string;
  paymentDate?: string;
  transactionReference?: string;
  responseCode?: string;
  responseMessage?: string;
}

export interface RemitaHealthResponse {
  status: string;
  timestamp: string;
  gateway: string;
}

export class RemitaClient {
  private baseURL: string;
  private merchantId: string;
  private apiKey: string;
  private serviceTypeId: string;

  constructor() {
    this.baseURL = (process.env.REMITA_API_URL || 'https://remitademo.net').replace(/\/$/, '');
    this.merchantId = process.env.REMITA_MERCHANT_ID || '';
    this.apiKey = process.env.REMITA_API_KEY || '';
    this.serviceTypeId = process.env.REMITA_SERVICE_TYPE_ID || '';
  }

  private isMockMode(): boolean {
    return String(process.env.REMITA_MOCK_MODE || 'false').toLowerCase() === 'true';
  }

  // Accept either https://host or https://host/remita and normalize to https://host/remita
  private remitaBase(): string {
    const base = this.baseURL.replace(/\/$/, '');
    return base.endsWith('/remita') ? base : `${base}/remita`;
  }

  private generateInitHash(orderId: string, amount: number): string {
    const payload = `${this.merchantId}${this.serviceTypeId}${orderId}${amount}${this.apiKey}`;
    return crypto.createHash('sha512').update(payload).digest('hex');
  }

  private generateStatusHash(rrr: string, amount: number): string {
    const payload = `${this.merchantId}${rrr}${amount}${this.apiKey}`;
    return crypto.createHash('sha512').update(payload).digest('hex');
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'error'; latency: number | null }> {
    const startTime = Date.now();

    if (this.isMockMode()) {
      return { status: 'healthy', latency: 2 };
    }
    
    try {
      // Use a test RRR check as health check
      const testRRR = 'TEST123456789';
      const response = await axios.get(
        `${this.remitaBase()}/ecomm/status.reg`,
        {
          params: {
            merchantId: this.merchantId,
            rrr: testRRR,
            hash: this.generateStatusHash(testRRR, 0),
          },
          timeout: 10000,
        }
      );

      const latency = Math.max(1, Date.now() - startTime);
      return {
        status: response.status === 200 ? 'healthy' : 'degraded',
        latency,
      };
    } catch (error) {
      return {
        status: 'error',
        latency: null,
      };
    }
  }

  async initializePayment(paymentData: RemitaPaymentRequest): Promise<RemitaInitResponse> {
    let initStart = Date.now();
    try {
      const hash = this.generateInitHash(paymentData.orderId, paymentData.amount);
      
      const requestData = {
        merchantId: this.merchantId,
        serviceTypeId: this.serviceTypeId,
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        payerName: paymentData.payerName,
        payerEmail: paymentData.payerEmail,
        payerPhone: paymentData.payerPhone,
        description: paymentData.description || 'TaxBridge Invoice Payment',
        hash,
      };

      initStart = Date.now();
      const response = await axios.post<RemitaInitResponse>(
        `${this.remitaBase()}/ecomm/init.reg`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      metrics.recordRemitaPayment(true, paymentData.amount, Date.now() - initStart);
      return response.data;
    } catch (error) {
      metrics.recordRemitaPayment(false, paymentData.amount, Date.now() - initStart);
      log.error('Failed to initialize Remita payment', { err: error });
      throw new Error('Payment initialization failed');
    }
  }

  async getPaymentStatus(rrr: string, amount: number): Promise<RemitaStatusResponse> {
    // Check cache first for recent status queries
    const cacheKey = `status:${rrr}`;
    try {
      const cachedStatus = await remitaCache.get<RemitaStatusResponse>(cacheKey);
      if (cachedStatus && cachedStatus.status !== 'pending') {
        // Only return cached if it's a final status (successful/failed)
        return cachedStatus;
      }
    } catch {
      // Cache miss or error, continue with API call
    }

    let statusStart = Date.now();

    try {
      const hash = this.generateStatusHash(rrr, amount);
      
      statusStart = Date.now();
      const response = await axios.get<RemitaStatusResponse>(
        `${this.remitaBase()}/ecomm/status.reg`,
        {
          params: {
            merchantId: this.merchantId,
            rrr,
            hash,
          },
          timeout: 10000,
        }
      );

      // Cache the result (longer TTL for final statuses)
      const ttl = response.data.status === 'pending' ? STATUS_CACHE_TTL : STATUS_CACHE_TTL * 5;
      try {
        await remitaCache.set(cacheKey, response.data, ttl);
      } catch {
        // Cache set failed, continue without caching
      }

      metrics.recordRemitaStatus(true, Date.now() - statusStart);
      return response.data;
    } catch (error) {
      metrics.recordRemitaStatus(false, Date.now() - statusStart);
      log.error('Failed to get Remita payment status', { err: error });
      throw new Error('Payment status check failed');
    }
  }

  async getTransactionHistory(startDate: string, endDate: string): Promise<RemitaStatusResponse[]> {
    try {
      const response = await axios.get<RemitaStatusResponse[]>(
        `${this.remitaBase()}/ecomm/transactions`,
        {
          params: {
            merchantId: this.merchantId,
            startDate,
            endDate,
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      log.error('Failed to get Remita transaction history', { err: error });
      throw new Error('Transaction history fetch failed');
    }
  }
}

export const remitaClient = new RemitaClient();
