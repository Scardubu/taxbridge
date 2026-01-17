import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

/**
 * GET /api/admin/health/duplo
 * Fetches DigiTax integration health status (canonical: /health/digitax; legacy alias: /health/duplo)
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function GET() {
  try {
    const fetchHealth = async (path: string) =>
      fetch(`${BACKEND_URL}${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });

    let response = await fetchHealth('/health/digitax');
    if (response.status === 404) {
      response = await fetchHealth('/health/duplo');
    }

    const data = await safeJson(response);

    return NextResponse.json(data, {
      status: response.ok ? 200 : 503,
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
