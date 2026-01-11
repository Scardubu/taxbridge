import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/**
 * GET /api/admin/health/integrations
 * Fetches combined health status of all external integrations
 */
export async function GET(request: NextRequest) {
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
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        integrations: {
          duplo: { status: 'error', error: 'Check failed' },
          remita: { status: 'error', error: 'Check failed' },
        },
        error: error.message || 'Failed to check integrations health',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
