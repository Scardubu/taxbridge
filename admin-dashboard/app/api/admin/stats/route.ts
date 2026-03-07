import { NextResponse } from 'next/server';
import { requestBackend } from '@/lib/backend';
import { fallbackJson, getBackendFailureContext } from '@/lib/adminApiFallback';
import { logError } from '@/lib/logger';

export async function GET() {
  try {
    const data = await requestBackend('/stats');
    return NextResponse.json(data);
  } catch (error) {
    logError('admin/api/stats: Error fetching stats', error);
    const { status, code, message, backendUnavailable } = getBackendFailureContext(
      error,
      'Admin analytics is not enabled for this environment.'
    );

    if (!backendUnavailable) {
      return NextResponse.json(
        {
          error: 'Failed to fetch admin statistics',
          code,
          message,
        },
        { status }
      );
    }

    return fallbackJson(
      {
        totalUsers: 0,
        totalInvoices: 0,
        totalPayments: 0,
        duploStatus: 'degraded' as const,
        duploLatency: null,
        remitaStatus: 'degraded' as const,
        remitaLatency: null,
        duploSuccessTrend: [],
        remitaTransactions: [],
      }
    );
  }
}
