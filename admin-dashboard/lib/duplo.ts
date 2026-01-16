import axios from 'axios';

export interface DuploTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface DuploHealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export interface DuploSubmitResponse {
  irn: string;
  status: 'success' | 'pending' | 'failed';
  qr_code: string;
  timestamp: string;
}

export interface DuploStatusResponse {
  irn: string;
  status: 'stamped' | 'pending' | 'rejected';
  stamp_date?: string;
  rejection_reason?: string;
}

class DuploClient {
  private baseURL: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.baseURL = process.env.DUPLO_API_URL || 'https://api.duplo.co';
    this.clientId = process.env.DUPLO_CLIENT_ID || '';
    this.clientSecret = process.env.DUPLO_CLIENT_SECRET || '';
  }

  private async getAccessToken(): Promise<string> {
    // Check if current token is valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<DuploTokenResponse>(
        `${this.baseURL}/oauth2/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000; // Refresh 1 minute early

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Duplo access token:', error);
      throw new Error('Authentication failed');
    }
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'error'; latency: number | null }> {
    const startTime = Date.now();
    
    try {
      const token = await this.getAccessToken();
      const response = await axios.get<DuploHealthResponse>(
        `${this.baseURL}/v1/health`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000, // 10 second timeout
        }
      );

      const latency = Date.now() - startTime;
      return {
        status: response.data.status === 'ok' ? 'healthy' : 'degraded',
        latency,
      };
    } catch {
      return {
        status: 'error',
        latency: null,
      };
    }
  }

  async submitEInvoice(ublXml: string): Promise<DuploSubmitResponse> {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post<DuploSubmitResponse>(
        `${this.baseURL}/v1/einvoice/submit`,
        ublXml,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/xml',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to submit e-invoice:', error);
      throw new Error('E-invoice submission failed');
    }
  }

  async getEInvoiceStatus(irn: string): Promise<DuploStatusResponse> {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get<DuploStatusResponse>(
        `${this.baseURL}/v1/einvoice/status/${irn}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get e-invoice status:', error);
      throw new Error('Status check failed');
    }
  }
}

export const duploClient = new DuploClient();
