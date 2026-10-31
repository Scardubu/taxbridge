import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ segments: string[] }> };

const ALLOWED_PATHS = new Set([
  'devices', 'sync/stats', 'conflicts', 'sync/pending',
  'device/force-sync', 'conflicts/resolve',
]);

async function proxyAdminRequest(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { segments } = await context.params;
  const path = segments.join('/');
  if (!ALLOWED_PATHS.has(path)) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const accessToken = (await cookies()).get('admin_token')?.value;
  if (!accessToken) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const backendUrl = process.env.BACKEND_API_URL ?? process.env.BACKEND_URL ?? '';
  const adminKey = process.env.ADMIN_API_KEY ??
    process.env.ADMIN_API_KEYS?.split(',').map(value => value.trim()).find(Boolean) ?? '';
  if (!backendUrl || !adminKey) {
    return NextResponse.json({ error: 'ADMIN_PROXY_NOT_CONFIGURED' }, { status: 503 });
  }

  const headers = new Headers({
    Accept: 'application/json',
    Authorization: 'Bearer ' + accessToken,
    'X-Admin-API-Key': adminKey,
  });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const body = request.method === 'GET' ? undefined : await request.arrayBuffer();

  try {
    const upstream = await fetch(
      backendUrl.replace(/\/$/, '') + '/api/admin/' + path + request.nextUrl.search,
      {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      },
    );
    return new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch {
    return NextResponse.json({ error: 'ADMIN_BACKEND_UNAVAILABLE' }, { status: 503 });
  }
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyAdminRequest(request, context);
}
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return proxyAdminRequest(request, context);
}
