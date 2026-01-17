import { NextRequest, NextResponse } from 'next/server';
import { BackendAPIError, requestBackend } from '@/lib/backend';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';
    const status = searchParams.get('status') || '';

    const queryParams = new URLSearchParams({
      page,
      limit,
      ...(status && { status }),
    });

    const data = await requestBackend(`/invoices?${queryParams.toString()}`);
    return NextResponse.json(data.invoices || data);
  } catch (error) {
    logError('admin/api/invoices: Error fetching invoices', error);
    const statusCode = error instanceof BackendAPIError ? error.status : 500;
    const message = error instanceof BackendAPIError ? error.details || error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch invoices', message },
      { status: statusCode }
    );
  }
}
