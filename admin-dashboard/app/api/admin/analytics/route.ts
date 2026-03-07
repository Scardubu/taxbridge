import { NextRequest, NextResponse } from 'next/server';
import { requestBackend } from '@/lib/backend';
import { fallbackJson, getBackendFailureContext } from '@/lib/adminApiFallback';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    const data = await requestBackend(`/analytics?${new URLSearchParams({ range }).toString()}`);
    return NextResponse.json(data);
  } catch (error) {
    logError('admin/api/analytics: Error fetching analytics', error);
    const { status, code, message, backendUnavailable } = getBackendFailureContext(
      error,
      'Admin analytics is not enabled for this environment.'
    );

    if (backendUnavailable) {
      return fallbackJson({
        overview: {
          totalUsers: 0,
          totalInvoices: 0,
          totalPayments: 0,
          complianceRate: 0,
          monthlyGrowth: 0,
        },
        duploMetrics: {
          successTrend: [],
          errorBreakdown: [],
          dailySubmissions: [],
        },
        remitaMetrics: {
          transactionTrend: [],
          paymentBreakdown: [],
          dailyVolume: [],
        },
        complianceMetrics: {
          exemptionUtilization: [],
          withholdingTaxTracking: [],
          nrsComplianceTrend: [],
        },
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch analytics data', message, ...(code && { code }) },
      { status }
    );
  }
}
