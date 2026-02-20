import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_API_URL ?? 'https://taxbridge-api-ker8.onrender.com';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/health/queues`, {
      signal: AbortSignal.timeout(6_000),
      next: { revalidate: 0 }, // Always fresh for live monitor
    });

    if (!res.ok) throw new Error(`Backend ${res.status}`);
    return NextResponse.json(await res.json());
  } catch {
    // Return zeroed state — NRSMonitor will show as unknown but won't crash
    return NextResponse.json(
      {
        fallback: true,
        nrs: {
          waiting: 0,
          active: 0,
          failed: 0,
          completed: 0,
          delayed: 0,
          successRate: null,
          healthy: false,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { 'X-Fallback': 'true' } }
    );
  }
}
