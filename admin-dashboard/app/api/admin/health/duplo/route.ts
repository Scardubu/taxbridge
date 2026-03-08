import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { fetchHealthEndpoint, getErrorMessage } from '@/lib/backendHealth';

/**
 * GET /api/admin/health/duplo
 * Fetches DigiTax integration health status (canonical: /health/digitax; legacy alias: /health/duplo)
 */
export async function GET() {
  try {
    const { data, ok } = await fetchHealthEndpoint('/health/digitax', {
      fallbackPaths: ['/health/duplo'],
      timeoutMs: 10000,
    });

    return NextResponse.json(data, {
      status: ok ? 200 : 503,
    });
  } catch (error: unknown) {
    logError('admin/api/health/duplo: Error fetching DigiTax health', error);
    return NextResponse.json(
      {
        status: 'error',
        provider: 'digitax',
        error: getErrorMessage(error) || 'Failed to check DigiTax health',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
