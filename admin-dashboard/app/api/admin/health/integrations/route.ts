import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';

const BACKEND_URL =
  process.env.BACKEND_API_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3000';
const HAS_BACKEND_URL = Boolean(
  process.env.BACKEND_API_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL
);
const TIMEOUT_MS = 8000;

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
    if (!HAS_BACKEND_URL && process.env.VERCEL) {
      return NextResponse.json(
        {
          fallback: true,
          status: 'starting',
          message: 'Backend is warming up (Render cold start ~30s)',
          integrations: {
            database: { status: 'unknown', latency: null },
            redis: { status: 'unknown', latency: null },
            digitax: { status: 'unknown' },
            paystack: { status: 'unknown' },
            flutterwave: { status: 'unknown' },
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/health/integrations`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = await safeJson(response);

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        {
          fallback: true,
          status: 'starting',
          message: 'Backend is warming up (Render cold start ~30s)',
          integrations: {
            database: { status: 'unknown', latency: null },
            redis: { status: 'unknown', latency: null },
            digitax: { status: 'unknown' },
            paystack: { status: 'unknown' },
            flutterwave: { status: 'unknown' },
          },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(data, {
      status: response.ok ? 200 : 200,
    });
  } catch (error: unknown) {
    logError('admin/api/health/integrations: Error fetching integrations health', error);
    return NextResponse.json(
      {
        fallback: true,
        status: 'starting',
        message: 'Backend is warming up (Render cold start ~30s)',
        integrations: {
          database: { status: 'unknown', latency: null },
          redis: { status: 'unknown', latency: null },
          digitax: { status: 'unknown' },
          paystack: { status: 'unknown' },
          flutterwave: { status: 'unknown' },
        },
        error: getErrorMessage(error) || 'Failed to check integrations health',
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Fallback': 'true',
        },
      }
    );
  }
}
