import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'error';
  provider?: string;
  latency?: number;
  timestamp: string;
  error?: string;
  mode?: string;
}

interface IntegrationsResponse {
  status: 'healthy' | 'degraded' | 'error';
  integrations: {
    duplo: HealthResponse;
    remita: HealthResponse;
  };
  timestamp: string;
}

/**
 * GET /api/admin/health
 * Fetches overall backend health status
 */
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
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
        error: error.message || 'Failed to reach backend',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
