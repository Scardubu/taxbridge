import { NextResponse } from 'next/server';
import { BackendAPIError, requestBackend } from '@/lib/backend';

export async function GET() {
  try {
    const data = await requestBackend('/launch-metrics');
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof BackendAPIError ? error.details || error.message : 'Unknown error';
    const status = error instanceof BackendAPIError ? error.status : 500;

    return NextResponse.json(
      {
        error: 'Failed to fetch launch metrics',
        message,
      },
      { status }
    );
  }
}
