import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_API_URL ?? 'https://taxbridge-api-ker8.onrender.com';

const FALLBACK = {
  fallback: true,
  metrics: {
    firstWeekUsers: null,
    invoicesCreated: null,
    paymentsProcessed: null,
    ocrScans: null,
    nrsSubmissions: null,
    taxCalculations: null,
    uptimePercent: null,
  },
};

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/admin/launch-metrics`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY ?? ''}` },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`Backend ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    console.warn('[api/admin/launch-metrics] Backend unavailable:', err);
    return NextResponse.json(FALLBACK, {
      status: 200,
      headers: { 'X-Fallback': 'true', 'Cache-Control': 'no-store' },
    });
  }
}
