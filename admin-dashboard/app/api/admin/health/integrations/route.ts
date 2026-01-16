import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

/**
 * GET /api/admin/health/integrations
 * Fetches combined health status of all external integrations
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/health/integrations`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.ok ? 200 : 503,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: 'error',
        integrations: {
          duplo: { status: 'error', error: 'Check failed' },
          remita: { status: 'error', error: 'Check failed' },
        },
        error: getErrorMessage(error) || 'Failed to check integrations health',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
