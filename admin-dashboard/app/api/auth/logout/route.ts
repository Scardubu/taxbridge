/**
 * Revoke the current user's sessions at the backend and clear browser cookies.
 * Backend logout advances role_version and therefore revokes all devices.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isSameOriginAuthRequest } from '@/lib/auth-origin';

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
  if (!isSameOriginAuthRequest(request.headers.get('origin'), request.nextUrl.origin)) {
    return NextResponse.json(
      { error: 'ORIGIN_NOT_ALLOWED' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const refreshToken = request.cookies.get('admin_refresh_token')?.value;
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json({ error: 'AUTH_BACKEND_NOT_CONFIGURED' }, { status: 503 });
  }

  let backendError: string | null = null;
  if (refreshToken) {
    try {
      const result = await fetch(`${backendUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
      if (!result.ok && result.status !== 401) {
        backendError = `AUTH_BACKEND_LOGOUT_FAILED_${result.status}`;
      }
    } catch {
      backendError = 'AUTH_BACKEND_UNAVAILABLE';
    }
  }

  // Always remove the local browser session after an explicit logout attempt.
  const response = backendError
    ? NextResponse.json({ success: false, error: backendError, localSessionCleared: true }, { status: 502 })
    : NextResponse.json({ success: true, localSessionCleared: true, scope: refreshToken ? 'all_sessions' : 'local' });
  clearSessionCookies(response);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
