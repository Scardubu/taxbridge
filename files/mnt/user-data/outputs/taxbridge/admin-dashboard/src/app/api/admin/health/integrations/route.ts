import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_API_URL ?? 'https://taxbridge-api-ker8.onrender.com';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/health/integrations`, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 30 },
    });

    if (!res.ok) throw new Error(`Backend ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    console.warn('[api/admin/health/integrations] Backend cold-starting:', err);
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
      {
        status: 200,
        headers: { 'X-Fallback': 'true', 'Cache-Control': 'no-store' },
      }
    );
  }
}
