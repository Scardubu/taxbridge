/**
 * TaxBridge Admin Dashboard — Next.js 16 Edge Proxy.
 * Protected routes require backend-issued RS256 access tokens and a current
 * role version. No production bypass or stale role-version cache is allowed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { importSPKI, jwtVerify, type JWTPayload } from 'jose';

const JWT_ISSUER = process.env.JWT_ISSUER ?? 'taxbridge-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'taxbridge-clients';
const PUBLIC_PATHS = ['/login', '/api/health', '/api/auth', '/_next', '/favicon.ico'];
const BACKEND_URL = (
  process.env.BACKEND_API_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://taxbridge-api-ker8.onrender.com'
).replace(/\/$/, '');

interface AdminJWTPayload extends JWTPayload {
  sub: string;
  role: string;
  orgId: string;
  role_version: number;
  type: 'access';
}

let publicKeyPromise: ReturnType<typeof importSPKI> | undefined;

async function getPublicKey() {
  if (!publicKeyPromise) {
    const encoded = process.env.JWT_PUBLIC_KEY;
    if (!encoded) throw new Error('JWT_PUBLIC_KEY is required');
    const pem = atob(encoded);
    if (!pem.includes('BEGIN PUBLIC KEY')) throw new Error('JWT_PUBLIC_KEY must be base64-encoded SPKI PEM');
    publicKeyPromise = importSPKI(pem, 'RS256');
  }
  return publicKeyPromise;
}

async function verifyAdminJWT(token: string): Promise<AdminJWTPayload | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['RS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud', 'type', 'orgId', 'role', 'role_version'],
    });
    if (
      typeof payload.sub !== 'string' || !payload.sub ||
      typeof payload.orgId !== 'string' || !payload.orgId ||
      typeof payload.role !== 'string' || !payload.role ||
      payload.type !== 'access' ||
      typeof payload.role_version !== 'number' ||
      !Number.isSafeInteger(payload.role_version) ||
      payload.role_version < 0
    ) return null;
    return payload as AdminJWTPayload;
  } catch {
    return null;
  }
}

async function getRoleVersion(userId: string): Promise<number | null> {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) return null;
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/v1/admin/role-version/${encodeURIComponent(userId)}`,
      {
        headers: { 'X-Internal-Key': internalKey },
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    const data = await response.json() as { roleVersion?: unknown };
    return typeof data.roleVersion === 'number' && Number.isSafeInteger(data.roleVersion)
      ? data.roleVersion
      : null;
  } catch {
    return null;
  }
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function loginRedirect(request: NextRequest, reason: string): NextResponse {
  const url = new URL('/login', request.url);
  url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();

  if (process.env.ADMIN_AUTH_ENFORCE !== 'true') {
    return process.env.VERCEL_ENV === 'production'
      ? NextResponse.json({ error: 'ADMIN_AUTH_NOT_CONFIGURED' }, { status: 503 })
      : NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1] ?? request.cookies.get('admin_token')?.value;
  if (!token) return loginRedirect(request, 'unauthenticated');

  const payload = await verifyAdminJWT(token);
  if (!payload) return loginRedirect(request, 'invalid_token');

  const role = payload.role.toUpperCase();
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const currentRoleVersion = await getRoleVersion(payload.sub);
  if (currentRoleVersion === null) {
    return NextResponse.json({ error: 'ROLE_VERSION_UNAVAILABLE' }, { status: 503 });
  }
  if (currentRoleVersion !== payload.role_version) {
    return loginRedirect(request, 'session_expired');
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) {
    const header = request.headers.get('x-csrf-token');
    const cookie = request.cookies.get('csrf_token')?.value;
    if (!header || !cookie || header !== cookie) {
      return NextResponse.json(
        { error: 'CSRF_INVALID', message: 'CSRF token mismatch. Request rejected.' },
        { status: 403 },
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.sub);
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-org-id', payload.orgId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
