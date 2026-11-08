/**
 * Browser-facing admin integration boundary.
 *
 * Do not call legacy Duplo OAuth/XML endpoints from the dashboard. The
 * approved NRS Gateway requires server-side credentials and per-business
 * identity; those must never be exposed to browser code.
 */
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
  async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'error' | 'unconfigured'; latency: number | null }> {
    return { status: 'unconfigured', latency: null };
  }

  async submitEInvoice(_ublXml: string): Promise<DuploSubmitResponse> {
    throw new Error('NRS_GATEWAY_MIGRATION_REQUIRED');
  }

  async getEInvoiceStatus(_irn: string): Promise<DuploStatusResponse> {
    throw new Error('NRS_GATEWAY_MIGRATION_REQUIRED');
  }
}

export const duploClient = new DuploClient();
