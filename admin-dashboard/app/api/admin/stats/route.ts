import { NextResponse } from 'next/server';
import { BackendAPIError, requestBackend } from '@/lib/backend';
import { logError } from '@/lib/logger';

export async function GET() {
  try {
    const data = await requestBackend('/stats');
    return NextResponse.json(data);
  } catch (error) {
    logError('admin/api/stats: Error fetching stats', error);
    const message = error instanceof BackendAPIError ? error.details || error.message : 'Unknown error';
    const status = error instanceof BackendAPIError ? error.status : 500;
    return NextResponse.json(
      {
        error: 'Failed to fetch admin statistics',
        message,
      },
      { status }
    );
  }
}
