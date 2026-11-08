import { metrics } from '../services/metrics';

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

/**
 * Duplo NRS Gateway integration boundary.
 *
 * The previous OAuth2 + raw UBL XML endpoints are not the approved NRS
 * Gateway contract. Live signing remains disabled until the approved gateway
 * domain, API key, represented-business mapping, NRS identifiers and IRN
 * template are provisioned and validated.
 */
export class DuploClient {
  getBaseURL(): string {
    return process.env.DUPLO_GATEWAY_URL || '';
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'error' | 'unconfigured' | 'mock'; latency: number | null }> {
    return { status: 'unconfigured', latency: null };
  }

  async submitEInvoice(_ublXml: string): Promise<DuploSubmitResponse> {
    metrics.recordDuploSubmission(false, 0, 0);
    throw new Error('NRS_GATEWAY_MIGRATION_REQUIRED');
  }

  async getEInvoiceStatus(_irn: string): Promise<DuploStatusResponse> {
    throw new Error('NRS_GATEWAY_MIGRATION_REQUIRED');
  }
}

export const duploClient = new DuploClient();
