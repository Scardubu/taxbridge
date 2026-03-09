/**
 * admin/src/middleware.ts — TaxBridge V13 Sovereign
 *
 * Edge Runtime middleware for admin Next.js 15 App Router.
 *
 * Responsibilities:
 *   1. JWT verification (RS256 in prod, HS256 in dev) via jose
 *   2. role_version cache (30s TTL) — reject stale tokens
 *   3. CSRF: compare X-CSRF-Token header vs csrf_token cookie → 403 CSRF_INVALID on mismatch
 *   4. Redirect unauthenticated requests to /admin/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { importSPKI, jwtVerify, type JWTPayload } from 'jose';

export const config = {
  matcher: ['/admin/:path*'],
};

// ─── Env ────────────────────────────────────────────────────────────────────
const JWT_SECRET     = process.env.JWT_SECRET     ?? 'dev-secret-change-in-prod';
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;          // RS256 PEM in prod

// ─── role_version cache (30s TTL) ───────────────────────────────────────────
// Simple in-memory map; Edge Runtime restarts clear it automatically.
const roleVersionCache = new Map<string, { version: number; expiresAt: number }>();
const ROLE_VERSION_TTL_MS = 30_000;

let jwtPublicKeyPromise: ReturnType<typeof importSPKI> | null = null;

async function getCachedRoleVersion(userId: string): Promise<number | null> {
  const entry = roleVersionCache.get(userId);
  if (entry && Date.now() < entry.expiresAt) return entry.version;

  // Fetch from backend API
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${apiBase}/api/v1/admin/role-version/${userId}`, {
      headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY ?? '' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json() as { roleVersion: number };
    roleVersionCache.set(userId, {
      version:   data.roleVersion,
      expiresAt: Date.now() + ROLE_VERSION_TTL_MS,
    });
    return data.roleVersion;
  } catch {
    return null;
  }
}

// ─── JWT verification ────────────────────────────────────────────────────────
async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    if (JWT_PUBLIC_KEY) {
      // RS256 — production / Edge-safe via jose
      jwtPublicKeyPromise ??= importSPKI(JWT_PUBLIC_KEY, 'RS256');
      const key = await jwtPublicKeyPromise;
      const { payload } = await jwtVerify(token, key, { algorithms: ['RS256'] });
      return payload;
    } else {
      // HS256 — local dev
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
      return payload;
    }
  } catch {
    return null;
  }
}

// ─── CSRF check ───────────────────────────────────────────────────────────────
function isCsrfValid(request: NextRequest): boolean {
  // Skip CSRF for GET/HEAD/OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;

  const headerToken = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf_token')?.value;

  if (!headerToken || !cookieToken) return false;
  return headerToken === cookieToken;
}

// ─── Main middleware ──────────────────────────────────────────────────────────
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // Allow login page through
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // CSRF check (before auth — rejects invalid mutations early)
  if (!isCsrfValid(request)) {
    return NextResponse.json(
      { error: 'CSRF_INVALID' },
      { status: 403 },
    );
  }

  // Extract token from Authorization header or cookie
  const authHeader = request.headers.get('authorization');
  const cookieToken = request.cookies.get('admin_token')?.value;
  const rawToken = authHeader?.replace(/^Bearer\s+/i, '') ?? cookieToken;

  if (!rawToken) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // Verify JWT
  const payload = await verifyToken(rawToken);
  if (!payload) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // role_version staleness check
  const userId = payload.sub ?? (payload.userId as string);
  const tokenRoleVersion = (payload.role_version as number) ?? 0;
  if (userId) {
    const currentVersion = await getCachedRoleVersion(userId);
    if (currentVersion !== null && currentVersion !== tokenRoleVersion) {
      // Token is stale — force re-login
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('admin_token');
      return response;
    }
  }

  // Check user has at least ADMIN role
  const role = payload.role as string;
  const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'OWNER'];
  if (!adminRoles.includes(role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  // Pass through with identity headers for server components
  const response = NextResponse.next();
  response.headers.set('x-user-id',   userId ?? '');
  response.headers.set('x-user-role', role ?? '');
  return response;
}
