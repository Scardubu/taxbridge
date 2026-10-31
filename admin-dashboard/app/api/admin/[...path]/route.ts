import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const ALLOWED_ROUTES = new Set([
  'devices',
  'sync/pending',
  'sync/stats',
  'device/force-sync',
  'audit',
  'conflicts',
  'conflicts/resolve',
]);

function getAdminApiKey(): string | null {
  const keys = (process.env.ADMIN_API_KEYS ?? process.env.ADMIN_API_KEY ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  return keys[0] ?? null;
}

async function forward(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  // These headers are overwritten by proxy.ts after successful RS256 verification.
  const userId = request.headers.get('x-user-id');
  const role = (request.headers.get('x-user-role') ?? '').toUpperCase();
  if (!userId || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { path } = await context.params;
  const route = path.join('/');
  if (!ALLOWED_ROUTES.has(route)) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const adminApiKey = getAdminApiKey();
  if (!adminApiKey) {
    return NextResponse.json({ error: 'ADMIN_API_NOT_CONFIGURED' }, { status: 503 });
  }

  const backendUrl = (
    process.env.BACKEND_API_URL ||
    process.env.BACKEND_URL ||
    'https://taxbridge-api-ker8.onrender.com'
  ).replace(/\/$/, '');
  const target = new URL(`/api/admin/${route}`, backendUrl);
  target.search = request.nextUrl.search;

  const headers = new Headers({
    'X-Admin-API-Key': adminApiKey,
    'X-Admin-User-ID': userId,
    'X-TaxBridge-Version': '13',
    Accept: 'application/json',
  });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();

  try {
    const response = await fetch(target, {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'ADMIN_BACKEND_UNAVAILABLE' }, { status: 503 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, context);
}
