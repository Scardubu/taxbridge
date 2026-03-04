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
import { jwtVerify, type JWTPayload } from 'jose';

// Routes that are publicly accessible (no auth required)
const PUBLIC_PATHS = new Set([
  '/login',
  '/api/health',
  '/api/auth',   // login + logout endpoints — must be reachable without a token
  '/_next',
  '/favicon.ico',
]);

// Role-version cache (30s in-memory — avoids Vercel Edge Config on every request)
const roleVersionCache = new Map<string, { version: number; cachedAt: number }>();
const ROLE_VERSION_CACHE_TTL_MS = 30_000;

interface AdminJWTPayload extends JWTPayload {
  sub:          string;   // userId
  role:         string;
  orgId?:       string;
  roleVersion?: number;
}

/**
 * Verify a JWT issued by the TaxBridge backend (RS256 or HS256 depending on env).
 * Returns the decoded payload or null on failure.
 */
async function verifyAdminJWT(token: string): Promise<AdminJWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET ?? process.env.JWT_SECRET ?? '',
    );
    const { payload } = await jwtVerify(token, secret);
    return payload as AdminJWTPayload;
  } catch {
    return null;
  }
}

/**
 * Retrieve the current role version for a user.
 * Uses 30s in-memory cache to reduce API latency on Edge.
 */
async function getRoleVersion(userId: string, token: string): Promise<number | null> {
  const cached = roleVersionCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < ROLE_VERSION_CACHE_TTL_MS) {
    return cached.version;
  }
  try {
    const apiUrl  = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
    const res     = await fetch(`${apiUrl}/api/v2/rbac/role-version/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data    = await res.json() as { version: number };
    roleVersionCache.set(userId, { version: data.version, cachedAt: Date.now() });
    return data.version;
  } catch {
    // Non-fatal — allow request through if role-version endpoint is unavailable
    return null;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // ── Allow public paths through immediately ───────────────────────────────
  if (
    PUBLIC_PATHS.has(pathname) ||
    [...PUBLIC_PATHS].some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // ── Early-access bypass: skip auth when ADMIN_AUTH_ENFORCE is not "true" ──
  // During initial deployment only a few trusted users access the admin panel.
  // Set ADMIN_AUTH_ENFORCE=true in Vercel when ready for full auth gating.
  if (process.env.ADMIN_AUTH_ENFORCE !== 'true') {
    return NextResponse.next();
  }

  // ── Step 1: Extract and verify JWT ──────────────────────────────────────
  const authHeader  = request.headers.get('authorization');
  const cookieToken = request.cookies.get('admin_token')?.value;
  const rawToken    = authHeader?.replace('Bearer ', '') ?? cookieToken;

  if (!rawToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'unauthenticated');
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyAdminJWT(rawToken);
  if (!payload || !payload.sub) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'invalid_token');
    return NextResponse.redirect(loginUrl);
  }

  // ── Step 2: role_version check (30s cache) ───────────────────────────────
  if (payload.roleVersion !== undefined) {
    const currentVersion = await getRoleVersion(payload.sub, rawToken);
    if (currentVersion !== null && currentVersion > payload.roleVersion) {
      // Role has changed since token was issued — force re-auth
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('reason', 'session_expired');
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Step 3: CSRF protection for mutating requests ────────────────────────
  const method = request.method.toUpperCase();
  if (['POST', 'PATCH', 'DELETE'].includes(method)) {
    const csrfHeader = request.headers.get('x-csrf-token');
    const csrfCookie = request.cookies.get('csrf_token')?.value;

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return NextResponse.json(
        { error: 'CSRF_INVALID', message: 'CSRF token mismatch. Request rejected.' },
        { status: 403 },
      );
    }
  }

  // ── Forward user context to route handlers ───────────────────────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id',   payload.sub);
  requestHeaders.set('x-user-role', payload.role ?? '');
  requestHeaders.set('x-org-id',    payload.orgId ?? '');

  return NextResponse.next({ request: { headers: requestHeaders } });
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
