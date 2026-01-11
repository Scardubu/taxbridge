import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/**
 * GET /api/admin/health/duplo
 * Fetches Duplo/DigiTax integration health status
 */
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/health/duplo`, {
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
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        provider: 'duplo',
        error: error.message || 'Failed to check Duplo health',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
