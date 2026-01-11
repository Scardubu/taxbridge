import { NextRequest, NextResponse } from 'next/server';
import { BackendAPIError, requestBackend } from '@/lib/backend';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    const data = await requestBackend(`/analytics?${new URLSearchParams({ range }).toString()}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    const status = error instanceof BackendAPIError ? error.status : 500;
    const message = error instanceof BackendAPIError ? error.details || error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch analytics data', message },
      { status }
    );
  }
}
