/**
 * TaxBridge Admin Dashboard — Edge Proxy (Next.js 16)
 * Renamed from middleware.ts → proxy.ts per Next.js 16 convention.
 * GAP-12 / G-SYN-03 / V12 directive §P1.A
 *
 * Exact check order (deviation = production incident):
 * 1. jwtVerify via jose (Edge Runtime — jose only, no Node crypto)
 * 2. Check role_version against cache → redirect /login?reason=session_expired if stale
 * 3. For POST|PATCH|DELETE: verify X-CSRF-Token === csrf_token cookie → 403 CSRF_INVALID
 *
 * C-24: RBAC via middleware only — no inline req.user.role in handlers.
 * C-43: Edge Runtime compatible — no PrismaClient here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { importSPKI, jwtVerify, type JWTPayload } from 'jose';

// Routes that are publicly accessible (no auth required)
const PUBLIC_PATHS = new Set([
  '/login',
  '/api/health',
  '/api/auth',   // login + logout endpoints — must be reachable without a token
  '/_next',
  '/favicon.ico',
]);

const JWT_ISSUER = 'taxbridge-api';
const JWT_AUDIENCE = 'taxbridge-client';
const BACKEND_URL = (process.env.BACKEND_API_URL || process.env.BACKEND_URL || '').replace(/\/$/, '');
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? '';

interface AdminJWTPayload extends JWTPayload {
  sub: string;
  role: string;
  orgId: string;
  role_version: number;
}
interface RefreshedTokens { accessToken: string; refreshToken: string; }

async function verifyAdminJWT(token: string): Promise<AdminJWTPayload | null> {
  try {
    const production = process.env.NODE_ENV === 'production';
    const key = production
      ? await importSPKI(atob(process.env.JWT_PUBLIC_KEY ?? ''), 'RS256')
      : new TextEncoder().encode(process.env.JWT_SECRET ?? '');
    const { payload } = await jwtVerify(token, key, {
      algorithms: production ? ['RS256'] : ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud'],
    });
    const roleVersion = payload.role_version;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.orgId !== 'string' ||
      typeof payload.role !== 'string' ||
      !['ADMIN', 'SUPER_ADMIN'].includes(payload.role.toUpperCase()) ||
      typeof roleVersion !== 'number' ||
      !Number.isSafeInteger(roleVersion) ||
      roleVersion < 0 ||
      payload.type === 'refresh'
    ) return null;
    return payload as AdminJWTPayload;
  } catch {
    return null;
  }
}

async function getRoleVersion(userId: string): Promise<number | null> {
  if (!BACKEND_URL || !INTERNAL_API_KEY) return null;
  try {
    const res = await fetch(
      BACKEND_URL + '/api/v1/admin/role-version/' + encodeURIComponent(userId),
      {
        headers: { 'X-Internal-Key': INTERNAL_API_KEY },
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { roleVersion?: unknown };
    return typeof data.roleVersion === 'number' && Number.isSafeInteger(data.roleVersion)
      ? data.roleVersion
      : null;
  } catch {
    return null;
  }
}

type RefreshAdminSessionResult =
  | { status: 'ok'; tokens: RefreshedTokens }
  | { status: 'invalid' }
  | { status: 'unavailable' };

async function refreshAdminSession(refreshToken: string): Promise<RefreshAdminSessionResult> {
  if (!BACKEND_URL) return { status: 'unavailable' };
  try {
    const response = await fetch(BACKEND_URL + '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) return { status: 'invalid' };
    if (!response.ok) return { status: 'unavailable' };
    const data = await response.json() as Record<string, unknown>;
    if (typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') {
      return { status: 'unavailable' };
    }
    return {
      status: 'ok',
      tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

function loginRedirect(request: NextRequest, reason: string): NextResponse {
  const url = new URL('/login', request.url);
  url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const publicPath =
    pathname === '/login' ||
    pathname === '/api/health' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/');
  if (publicPath) return NextResponse.next();

  let rawToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?? request.cookies.get('admin_token')?.value;
  const refreshToken = request.cookies.get('admin_refresh_token')?.value;
  let payload = rawToken ? await verifyAdminJWT(rawToken) : null;
  let refreshed: RefreshedTokens | null = null;

  if (!payload && refreshToken) {
    const refreshResult = await refreshAdminSession(refreshToken);
    if (refreshResult.status === 'unavailable') {
      return NextResponse.json(
        { error: 'AUTH_DEPENDENCY_UNAVAILABLE', message: 'Session refresh is unavailable.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (refreshResult.status === 'invalid') {
      return loginRedirect(request, 'session_expired');
    }
    refreshed = refreshResult.tokens;
    rawToken = refreshed.accessToken;
    payload = await verifyAdminJWT(refreshed.accessToken);
  }
  if (!payload || !rawToken) return loginRedirect(request, 'unauthenticated');

  const currentVersion = await getRoleVersion(payload.sub);
  if (currentVersion === null) {
    return NextResponse.json(
      { error: 'AUTH_DEPENDENCY_UNAVAILABLE', message: 'Session validation is unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (currentVersion !== payload.role_version) return loginRedirect(request, 'session_expired');

  const method = request.method.toUpperCase();
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
    const origin = request.headers.get('origin');
    if (origin) {
      try {
        if (new URL(origin).origin !== request.nextUrl.origin) {
          return NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'CSRF_INVALID' }, { status: 403 });
      }
    }
    const csrfHeader = request.headers.get('x-csrf-token');
    const csrfCookie = request.cookies.get('csrf_token')?.value;
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
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
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (refreshed) {
    response.cookies.set('admin_token', refreshed.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });
    response.cookies.set('admin_refresh_token', refreshed.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static assets)
     * - _next/image (image optimisation)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
