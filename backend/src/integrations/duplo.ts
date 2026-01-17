import axios from 'axios';
import { CacheManager } from '../lib/cache';
import { createLogger } from '../lib/logger';
import { analyzeMandatoryFields } from '../lib/ubl/mandatoryFields';
import { metrics } from '../services/metrics';

const log = createLogger('duplo');

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

// Cache instance for Duplo tokens (distributed cache via Redis)
const duploCache = new CacheManager('duplo');
const TOKEN_CACHE_KEY = 'oauth_token';
const TOKEN_TTL = 3300; // 55 minutes (token expires in 60min, refresh 5min early)
const STATUS_CACHE_TTL = 300; // 5 minutes for invoice status

export class DuploClient {
  private baseURL: string;
  private clientId: string;
  private clientSecret: string;
  // In-memory fallback for when Redis is unavailable
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.baseURL = process.env.DUPLO_API_URL || 'https://api.duplo.co';
    this.clientId = process.env.DUPLO_CLIENT_ID || '';
    this.clientSecret = process.env.DUPLO_CLIENT_SECRET || '';
  }

  private async getAccessToken(): Promise<string> {
    // Check in-memory cache first (fastest)
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Check Redis cache (distributed, survives restarts)
    try {
      const cachedToken = await duploCache.get<{ token: string; expiry: number }>(TOKEN_CACHE_KEY);
      if (cachedToken && Date.now() < cachedToken.expiry) {
        // Update in-memory cache
        this.accessToken = cachedToken.token;
        this.tokenExpiry = cachedToken.expiry;
        return cachedToken.token;
      }
    } catch (cacheError) {
      // Redis unavailable, continue with fresh token fetch
      log.warn('Redis cache unavailable, fetching fresh token', { err: cacheError });
    }

    let oauthStart = Date.now();

    try {
      oauthStart = Date.now();
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

      // Cache in Redis for distributed access
      try {
        await duploCache.set(
          TOKEN_CACHE_KEY,
          { token: this.accessToken, expiry: this.tokenExpiry },
          TOKEN_TTL
        );
      } catch (cacheError) {
        // Redis unavailable, token still works via in-memory
        log.warn('Failed to cache token in Redis', { err: cacheError });
      }

      metrics.recordDuploOAuth(true, Date.now() - oauthStart);
      return this.accessToken;
    } catch (error) {
      metrics.recordDuploOAuth(false, Date.now() - oauthStart);
      log.error('Failed to get Duplo access token', { err: error });
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
    } catch (error) {
      return {
        status: 'error',
        latency: null,
      };
    }
  }

  async submitEInvoice(ublXml: string): Promise<DuploSubmitResponse> {
    const submissionStart = Date.now();
    const mandatoryAnalysis = analyzeMandatoryFields(ublXml);

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
      metrics.recordDuploSubmission(true, Date.now() - submissionStart, mandatoryAnalysis.missingFields.length);
      return response.data;
    } catch (error) {
      metrics.recordDuploSubmission(false, Date.now() - submissionStart, mandatoryAnalysis.missingFields.length);
      log.error('Failed to submit e-invoice', { err: error });
      throw new Error('E-invoice submission failed');
    }
  }

  async getEInvoiceStatus(irn: string): Promise<DuploStatusResponse> {
    // Check cache first for status (non-final statuses can change)
    try {
      const cachedStatus = await duploCache.get<DuploStatusResponse>(`status:${irn}`);
      if (cachedStatus) {
        // Only return cached status if it's a final state
        if (cachedStatus.status === 'stamped' || cachedStatus.status === 'rejected') {
          return cachedStatus;
        }
        // For pending status, check if cache is still fresh (short TTL)
        return cachedStatus;
      }
    } catch (cacheError) {
      // Continue without cache
    }

    let statusStart = Date.now();

    try {
      const token = await this.getAccessToken();
      statusStart = Date.now();
      const response = await axios.get<DuploStatusResponse>(
        `${this.baseURL}/v1/einvoice/status/${irn}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        }
      );

      // Cache the result
      try {
        // Final statuses cached longer, pending cached shorter
        const ttl = (response.data.status === 'stamped' || response.data.status === 'rejected')
          ? 3600  // 1 hour for final statuses
          : STATUS_CACHE_TTL; // 5 min for pending
        await duploCache.set(`status:${irn}`, response.data, ttl);
      } catch (cacheError) {
        // Continue without caching
      }

      metrics.recordDuploStatus(true, Date.now() - statusStart);
      return response.data;
    } catch (error) {
      metrics.recordDuploStatus(false, Date.now() - statusStart);
      log.error('Failed to get e-invoice status', { err: error });
      throw new Error('Status check failed');
    }
  }
}

export const duploClient = new DuploClient();
