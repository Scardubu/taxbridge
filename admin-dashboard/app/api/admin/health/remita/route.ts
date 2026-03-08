import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { fetchHealthEndpoint, getErrorMessage } from '@/lib/backendHealth';

/**
 * GET /api/admin/health/remita
 * Fetches Remita integration health status
 */
export async function GET() {
  try {
    const { data, ok } = await fetchHealthEndpoint('/health/remita', {
      timeoutMs: 10000,
    });

    return NextResponse.json(data, {
      status: ok ? 200 : 503,
    });
  } catch (error: unknown) {
    logError('admin/api/health/remita: Error fetching Remita health', error);
    return NextResponse.json(
      {
        status: 'error',
        provider: 'remita',
        error: getErrorMessage(error) || 'Failed to check Remita health',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
