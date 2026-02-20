import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_API_URL ?? 'https://taxbridge-api-ker8.onrender.com';

const FALLBACK = {
  fallback: true,
  totalUsers: null,
  totalInvoices: null,
  totalRevenue: null,
  activeBusinesses: null,
  nrsSuccessRate: null,
  lastUpdated: null,
};

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/admin/stats`, {
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_API_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Backend ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    console.warn('[api/admin/stats] Backend unavailable — returning fallback:', err);
    return NextResponse.json(FALLBACK, {
      status: 200,
      headers: { 'X-Fallback': 'true', 'Cache-Control': 'no-store' },
    });
  }
}
