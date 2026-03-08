import { NextRequest, NextResponse } from 'next/server';
import { requestBackend } from '@/lib/backend';
import { fallbackJson, getBackendFailureContext } from '@/lib/adminApiFallback';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1', 10) || 1, 10000));
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200));
    const action = searchParams.get('action') || '';
    const userId = searchParams.get('userId') || '';

    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(action && { action }),
      ...(userId && { userId }),
    });

    const data = await requestBackend(`/audit?${query.toString()}`);
    return NextResponse.json(data);
  } catch (error) {
    logError('admin/api/audit: Error fetching audit data', error);
    const { status, code, message, backendUnavailable } = getBackendFailureContext(
      error,
      'Admin audit data is not enabled for this environment.'
    );

    if (backendUnavailable) {
      return fallbackJson({
        success: true,
        logs: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0,
        },
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch audit data', message, ...(code && { code }) },
      { status }
    );
  }
}
