/**
 * Refresh the admin session using the HttpOnly refresh-token cookie.
 * The backend performs atomic one-time rotation and replay detection.
 */
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

function getBackendUrl(): string | null {
  const configured = process.env.BACKEND_API_URL || process.env.BACKEND_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) {
      return null;
    }
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function clearSessionCookies(response: NextResponse): void {
  response.cookies.set('admin_token', '', { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: 0, path: '/' });
  response.cookies.set('admin_refresh_token', '', { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: 0, path: '/api/auth' });
  response.cookies.set('csrf_token', '', { httpOnly: false, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: 0, path: '/' });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'ORIGIN_NOT_ALLOWED' }, { status: 403 });
  }

  const refreshToken = request.cookies.get('admin_refresh_token')?.value;
  if (!refreshToken) {
    const response = NextResponse.json({ error: 'REFRESH_SESSION_MISSING' }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json({ error: 'AUTH_BACKEND_NOT_CONFIGURED' }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const code = (err as Error)?.name === 'TimeoutError' ? 504 : 503;
    return NextResponse.json({ error: 'AUTH_BACKEND_UNAVAILABLE' }, { status: code });
  }

  let data: Record<string, unknown>;
  try {
    data = await backendRes.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'AUTH_BACKEND_INVALID_RESPONSE' }, { status: 502 });
  }

  if (!backendRes.ok) {
    const message = typeof data.message === 'string' ? data.message : 'Session refresh was rejected.';
    const response = NextResponse.json({ error: 'SESSION_REFRESH_REJECTED', message }, { status: backendRes.status });
    if (backendRes.status === 401 || backendRes.status === 403) clearSessionCookies(response);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const accessToken = typeof data.accessToken === 'string' ? data.accessToken : null;
  const replacementRefreshToken = typeof data.refreshToken === 'string' ? data.refreshToken : null;
  if (!accessToken || !replacementRefreshToken) {
    return NextResponse.json({ error: 'AUTH_BACKEND_INVALID_SESSION' }, { status: 502 });
  }

  const expiresIn = typeof data.expiresIn === 'number' && Number.isFinite(data.expiresIn)
    ? Math.min(ACCESS_TOKEN_MAX_AGE_SECONDS, Math.max(60, Math.floor(data.expiresIn)))
    : ACCESS_TOKEN_MAX_AGE_SECONDS;
  const csrfToken = randomBytes(32).toString('base64url');
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_token', accessToken, {
    httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: expiresIn, path: '/',
  });
  response.cookies.set('admin_refresh_token', replacementRefreshToken, {
    httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS, path: '/api/auth',
  });
  response.cookies.set('csrf_token', csrfToken, {
    httpOnly: false, secure: COOKIE_SECURE, sameSite: 'lax', maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS, path: '/',
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
