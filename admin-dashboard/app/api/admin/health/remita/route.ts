import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

/**
 * GET /api/admin/health/remita
 * Fetches Remita integration health status
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/health/remita`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.ok ? 200 : 503,
    });
  } catch (error: unknown) {
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
