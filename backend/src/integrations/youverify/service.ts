/**
 * Youverify Verification Service
 *
 * Handles TIN, BVN, and CAC verification via the Youverify API.
 * Supports sandbox/mock mode for development.
 *
 * @see https://docs.youverify.co
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../lib/logger';
import { metrics } from '../../services/metrics';
import type {
  YouverifyConfig,
  YouverifyTINResponse,
  YouverifyBVNResponse,
  YouverifyCACResponse,
  VerificationResult,
  BusinessVerificationRequest,
  BusinessVerificationResult,
} from './types';

const log = createLogger('youverify');

export class YouverifyService {
  private client: AxiosInstance;

  constructor(private config: YouverifyConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        token: config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  private isMockMode(): boolean {
    return (
      this.config.sandbox ||
      String(process.env.YOUVERIFY_MOCK_MODE || 'false').toLowerCase() === 'true'
    );
  }

  // ---------------------------------------------------------------------------
  // TIN Verification
  // ---------------------------------------------------------------------------

  async verifyTIN(tin: string): Promise<VerificationResult> {
    log.info('Verifying TIN', { tin: `${tin.substring(0, 4)}****` });

    if (this.isMockMode()) {
      return this.mockTINResult(tin);
    }

    const startTime = Date.now();

    try {
      const response = await this.client.post<YouverifyTINResponse>(
        '/v2/api/identity/ng/tin',
        {
          id: tin,
          isSubjectConsent: true,
          metadata: { requestId: `TIN-${Date.now()}` },
        },
      );

      const duration = Date.now() - startTime;
      const { data } = response.data;

      if (!data || response.data.status !== 'found') {
        log.warn('TIN not found', { tin: `${tin.substring(0, 4)}****` });
        return {
          verified: false,
          confidence: 0,
          details: { name: '', status: 'inactive' },
          reference: response.data.id || '',
        };
      }

      const result: VerificationResult = {
        verified: data.status === 'verified',
        confidence: data.confidence || 85,
        details: {
          name: data.fullName || '',
          issuedDate: data.issuedDate,
          status: data.status === 'verified' ? 'active' : 'inactive',
        },
        reference: response.data.id,
      };

      log.info('TIN verification complete', { verified: result.verified, duration });
      return result;
    } catch (error: any) {
      log.error('TIN verification failed', { error: error.message });
      throw new Error(`TIN verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // BVN Verification
  // ---------------------------------------------------------------------------

  async verifyBVN(bvn: string, firstName: string, lastName: string): Promise<VerificationResult> {
    log.info('Verifying BVN', { bvn: `${bvn.substring(0, 3)}****` });

    if (this.isMockMode()) {
      return this.mockBVNResult(bvn, firstName, lastName);
    }

    const startTime = Date.now();

    try {
      const response = await this.client.post<YouverifyBVNResponse>(
        '/v2/api/identity/ng/bvn',
        {
          id: bvn,
          firstName,
          lastName,
          isSubjectConsent: true,
          metadata: { requestId: `BVN-${Date.now()}` },
        },
      );

      const duration = Date.now() - startTime;
      const { data } = response.data;

      if (!data || response.data.status !== 'found') {
        log.warn('BVN not found', { bvn: `${bvn.substring(0, 3)}****` });
        return {
          verified: false,
          confidence: 0,
          details: { name: '', status: 'inactive' },
          reference: response.data.id || '',
        };
      }

      const result: VerificationResult = {
        verified: data.status === 'verified',
        confidence: data.confidence || 90,
        details: {
          name: `${data.firstName} ${data.lastName}`,
          status: data.status === 'verified' ? 'active' : 'inactive',
        },
        reference: response.data.id,
      };

      log.info('BVN verification complete', { verified: result.verified, duration });
      return result;
    } catch (error: any) {
      log.error('BVN verification failed', { error: error.message });
      throw new Error(`BVN verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // CAC Verification
  // ---------------------------------------------------------------------------

  async verifyCACNumber(cacNumber: string): Promise<VerificationResult> {
    log.info('Verifying CAC', { cacNumber });

    if (this.isMockMode()) {
      return this.mockCACResult(cacNumber);
    }

    const startTime = Date.now();

    try {
      const response = await this.client.post<YouverifyCACResponse>(
        '/v2/api/identity/ng/company/cac',
        {
          id: cacNumber,
          isSubjectConsent: true,
          metadata: { requestId: `CAC-${Date.now()}` },
        },
      );

      const duration = Date.now() - startTime;
      const { data } = response.data;

      if (!data || response.data.status !== 'found') {
        log.warn('CAC not found', { cacNumber });
        return {
          verified: false,
          confidence: 0,
          details: { name: '', status: 'inactive' },
          reference: response.data.id || '',
        };
      }

      const result: VerificationResult = {
        verified: data.status === 'verified',
        confidence: data.confidence || 95,
        details: {
          name: data.companyName || '',
          issuedDate: data.registrationDate,
          status: data.status === 'verified' ? 'active' : 'inactive',
          extra: {
            rcNumber: data.rcNumber,
            address: data.address,
            directors: data.directors,
          },
        },
        reference: response.data.id,
      };

      log.info('CAC verification complete', { verified: result.verified, duration });
      return result;
    } catch (error: any) {
      log.error('CAC verification failed', { error: error.message });
      throw new Error(`CAC verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Composite Business Verification
  // ---------------------------------------------------------------------------

  async verifyBusiness(request: BusinessVerificationRequest): Promise<BusinessVerificationResult> {
    const verifications: BusinessVerificationResult['verifications'] = {};
    const errors: string[] = [];

    // Run requested verifications in parallel
    const tasks: Promise<void>[] = [];

    if (request.tinVerification && request.tin) {
      tasks.push(
        this.verifyTIN(request.tin)
          .then((r) => { verifications.tin = r; })
          .catch((e) => { errors.push(`TIN: ${e.message}`); }),
      );
    }

    if (request.bvnVerification && request.bvn) {
      tasks.push(
        this.verifyBVN(request.bvn, request.firstName || '', request.lastName || '')
          .then((r) => { verifications.bvn = r; })
          .catch((e) => { errors.push(`BVN: ${e.message}`); }),
      );
    }

    if (request.cacVerification && request.cacNumber) {
      tasks.push(
        this.verifyCACNumber(request.cacNumber)
          .then((r) => { verifications.cac = r; })
          .catch((e) => { errors.push(`CAC: ${e.message}`); }),
      );
    }

    await Promise.all(tasks);

    // Determine overall status
    const results = Object.values(verifications);
    const allVerified = results.length > 0 && results.every((r) => r.verified);
    const someVerified = results.some((r) => r.verified);

    let overallStatus: BusinessVerificationResult['overallStatus'];
    if (results.length === 0) {
      overallStatus = 'PENDING';
    } else if (allVerified) {
      overallStatus = 'VERIFIED';
    } else if (someVerified) {
      overallStatus = 'PARTIAL';
    } else {
      overallStatus = 'FAILED';
    }

    if (errors.length > 0) {
      log.warn('Some verifications failed', { errors });
    }

    return { verifications, overallStatus };
  }

  // ---------------------------------------------------------------------------
  // Mock Results (sandbox / development)
  // ---------------------------------------------------------------------------

  private mockTINResult(tin: string): VerificationResult {
    const ref = `YV-TIN-MOCK-${crypto.randomBytes(4).toString('hex')}`;
    return {
      verified: true,
      confidence: 95,
      details: {
        name: 'Mock Business Ltd',
        issuedDate: '2020-01-15',
        status: 'active',
      },
      reference: ref,
    };
  }

  private mockBVNResult(bvn: string, firstName: string, lastName: string): VerificationResult {
    const ref = `YV-BVN-MOCK-${crypto.randomBytes(4).toString('hex')}`;
    return {
      verified: true,
      confidence: 98,
      details: {
        name: `${firstName || 'John'} ${lastName || 'Doe'}`,
        status: 'active',
      },
      reference: ref,
    };
  }

  private mockCACResult(cacNumber: string): VerificationResult {
    const ref = `YV-CAC-MOCK-${crypto.randomBytes(4).toString('hex')}`;
    return {
      verified: true,
      confidence: 100,
      details: {
        name: 'Mock Trading Company Ltd',
        issuedDate: '2018-06-20',
        status: 'active',
        extra: {
          rcNumber: cacNumber,
          address: '123 Mock Street, Lagos',
          directors: [{ name: 'John Doe', designation: 'Director' }],
        },
      },
      reference: ref,
    };
  }
}

// Singleton instance
export const youverifyService = new YouverifyService({
  apiKey: process.env.YOUVERIFY_API_KEY || '',
  baseUrl: process.env.YOUVERIFY_BASE_URL || 'https://api.youverify.co',
  sandbox: String(process.env.YOUVERIFY_SANDBOX || 'true').toLowerCase() === 'true',
});
