import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

/**
 * GET /api/admin/health/integrations
 * Fetches combined health status of all external integrations
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function safeJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
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

    const data = await safeJson(response);

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        {
          status: 'error',
          integrations: {
            duplo: { status: 'error', error: 'Invalid response' },
            remita: { status: 'error', error: 'Invalid response' },
          },
          error: 'Invalid response from backend health endpoint',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json(data, {
      status: response.ok ? 200 : 503,
    });
  } catch (error: unknown) {
    logError('admin/api/health/integrations: Error fetching integrations health', error);
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
