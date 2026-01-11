import axios from 'axios';
import crypto from 'crypto';

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

class RemitaClient {
  private baseURL: string;
  private merchantId: string;
  private apiKey: string;
  private serviceTypeId: string;

  constructor() {
    this.baseURL = process.env.REMITA_API_URL || 'https://remitademo.net/remita';
    this.merchantId = process.env.REMITA_MERCHANT_ID || '';
    this.apiKey = process.env.REMITA_API_KEY || '';
    this.serviceTypeId = process.env.REMITA_SERVICE_TYPE_ID || '';
  }

  private generateHash(orderId: string, amount: number): string {
    const hashString = `${this.merchantId}${this.serviceTypeId}${orderId}${amount}${this.apiKey}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'error'; latency: number | null }> {
    const startTime = Date.now();
    
    try {
      // Use a test RRR check as health check
      const testRRR = 'TEST123456789';
      const response = await axios.get(
        `${this.baseURL}/ecomm/status.reg`,
        {
          params: {
            merchantId: this.merchantId,
            rrr: testRRR,
            hash: this.generateHash(testRRR, 0),
          },
          timeout: 10000,
        }
      );

      const latency = Date.now() - startTime;
      return {
        status: response.status === 200 ? 'healthy' : 'degraded',
        latency,
      };
    } catch (_error) {
      return {
        status: 'error',
        latency: null,
      };
    }
  }

  async initializePayment(paymentData: RemitaPaymentRequest): Promise<RemitaInitResponse> {
    try {
      const hash = this.generateHash(paymentData.orderId, paymentData.amount);
      
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

      const response = await axios.post<RemitaInitResponse>(
        `${this.baseURL}/ecomm/init.reg`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to initialize Remita payment:', error);
      throw new Error('Payment initialization failed');
    }
  }

  async getPaymentStatus(rrr: string, amount: number): Promise<RemitaStatusResponse> {
    try {
      const hash = this.generateHash(rrr, amount);
      
      const response = await axios.get<RemitaStatusResponse>(
        `${this.baseURL}/ecomm/status.reg`,
        {
          params: {
            merchantId: this.merchantId,
            rrr,
            hash,
          },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get Remita payment status:', error);
      throw new Error('Payment status check failed');
    }
  }

  async getTransactionHistory(startDate: string, endDate: string): Promise<RemitaStatusResponse[]> {
    try {
      const response = await axios.get<RemitaStatusResponse[]>(
        `${this.baseURL}/ecomm/transactions`,
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
      console.error('Failed to get Remita transaction history:', error);
      throw new Error('Transaction history fetch failed');
    }
  }
}

export const remitaClient = new RemitaClient();
