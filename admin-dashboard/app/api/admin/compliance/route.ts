import { NextRequest, NextResponse } from 'next/server';
import { BackendAPIError, requestBackend } from '@/lib/backend';
import { logError } from '@/lib/logger';

function tryParseJson(value?: string): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function extractUpstreamError(details?: string): { upstreamError?: string; upstreamCode?: string } {
  const parsed = tryParseJson(details);
  if (!parsed || typeof parsed !== 'object') return { upstreamError: details };

  const record = parsed as Record<string, unknown>;
  const upstreamError = typeof record.error === 'string' ? record.error : undefined;
  const upstreamCode = typeof record.code === 'string' ? record.code : undefined;
  return { upstreamError, upstreamCode };
}

// Mock data for Stage 1 beta (DigiTax is in mock mode)
function getMockCompliance() {
  return {
    overview: {
      complianceRate: 94.2,
      totalInvoices: 156,
      compliantInvoices: 147,
      pendingReview: 6,
      nonCompliant: 3,
    },
    nrsStatus: {
      status: 'mock',
      lastSync: new Date().toISOString(),
      pendingSubmissions: 12,
    },
    recentIssues: [
      {
        id: '1',
        type: 'missing_tin',
        description: 'Customer TIN not provided for B2B invoice',
        invoiceId: 'INV-2026-0145',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        resolved: false,
      },
      {
        id: '2',
        type: 'submission_failed',
        description: 'NRS submission timeout (mock mode)',
        invoiceId: 'INV-2026-0142',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        resolved: true,
      },
      {
        id: '3',
        type: 'format_error',
        description: 'UBL validation warning: optional field missing',
        invoiceId: 'INV-2026-0138',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        resolved: true,
      },
    ],
    exemptionStats: [
      { exemption: 'Zero-rated (Export)', count: 23, percentage: 14.7 },
      { exemption: 'Exempt (Medical)', count: 8, percentage: 5.1 },
      { exemption: 'Exempt (Educational)', count: 5, percentage: 3.2 },
      { exemption: 'Standard VAT (7.5%)', count: 120, percentage: 76.9 },
    ],
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || '30d';

  try {
    const data = await requestBackend(`/compliance?period=${period}`);
    return NextResponse.json(data);
  } catch (error) {
    logError('admin/api/compliance: Error fetching compliance data', error);

    const status = error instanceof BackendAPIError ? error.status : 500;
    const { upstreamError, upstreamCode } =
      error instanceof BackendAPIError ? extractUpstreamError(error.details) : { upstreamError: undefined, upstreamCode: undefined };

    const code = upstreamCode || (upstreamError === 'Admin API disabled' ? 'ADMIN_API_DISABLED' : undefined) || (error instanceof BackendAPIError ? error.code : undefined);

    // Return mock data for Stage 1 if backend endpoint not available
    if (status === 404 || code === 'ADMIN_API_DISABLED') {
      return NextResponse.json(getMockCompliance());
    }

    const message =
      code === 'ADMIN_API_DISABLED'
        ? 'Compliance monitoring is not enabled for this environment.'
        : upstreamError || (error instanceof BackendAPIError ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        error: 'Failed to fetch compliance data',
        code,
        message,
      },
      { status }
    );
  }
}
