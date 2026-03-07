import { NextRequest, NextResponse } from 'next/server';
import { requestBackend } from '@/lib/backend';
import { fallbackJson, getBackendFailureContext } from '@/lib/adminApiFallback';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPage = searchParams.get('page') || '1';
    const rawLimit = searchParams.get('limit') || '50';
    const status = searchParams.get('status') || '';

    // Validate and sanitize numeric params
    const page = Math.max(1, Math.min(parseInt(rawPage, 10) || 1, 10000));
    const limit = Math.max(1, Math.min(parseInt(rawLimit, 10) || 50, 100));

    const queryParams = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(status && { status }),
    });

    const data = await requestBackend(`/invoices?${queryParams.toString()}`);
    return NextResponse.json(data.invoices || data);
  } catch (error) {
    logError('admin/api/invoices: Error fetching invoices', error);
    const { status, code, message, backendUnavailable } = getBackendFailureContext(
      error,
      'Admin invoices are not enabled for this environment.'
    );

    if (backendUnavailable) {
      return fallbackJson({
        invoices: [],
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch invoices', message, ...(code && { code }) },
      { status }
    );
  }
}
