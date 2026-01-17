import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

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

/**
 * GET /api/admin/health
 * Fetches overall backend health status
 */
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    const data = await safeJson(response);

    return NextResponse.json(data, {
      status: response.ok ? 200 : 503,
    });
  } catch (error: unknown) {
    logError('admin/api/health: Error fetching backend health', error);
    return NextResponse.json(
      {
        status: 'error',
        error: getErrorMessage(error) || 'Failed to reach backend',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
