import { NextResponse } from 'next/server';
import { requestBackend } from '@/lib/backend';
import { fallbackJson, getBackendFailureContext } from '@/lib/adminApiFallback';
import { logError } from '@/lib/logger';

export async function GET() {
  try {
    const data = await requestBackend('/launch-metrics');
    return NextResponse.json(data);
  } catch (error) {
    logError('admin/api/launch-metrics: Error fetching launch metrics', error);
    const { status, code, message, backendUnavailable } = getBackendFailureContext(
      error,
      'Admin analytics is not enabled for this environment.'
    );

    if (!backendUnavailable) {
      return NextResponse.json(
        {
          error: 'Failed to fetch launch metrics',
          code,
          message,
        },
        { status }
      );
    }

    return fallbackJson(
      {
        timestamp: new Date().toISOString(),
        mrr: null,
        mrrPrev: null,
        paidUsers: null,
        paidUsersPrev: null,
        nrr: null,
        grr: null,
        churnedUsers: null,
        expansionRevenue: null,
        contractionRevenue: null,
        newRevenue: null,
        anomalies: [],
      }
    );
  }
}
