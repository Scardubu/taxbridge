import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';
import { fetchHealthEndpoint, getErrorMessage, HAS_BACKEND_URL } from '@/lib/backendHealth';

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

    const { data, ok } = await fetchHealthEndpoint('/health/integrations');

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
      status: ok ? 200 : 200,
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
