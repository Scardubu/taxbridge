/**
 * Admin login proxy.
 * Credentials are sent only to an explicitly configured environment backend.
 * Access/refresh tokens are HttpOnly; the CSRF nonce is readable by same-origin
 * JavaScript for the proxy's double-submit validation.
 */
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isSameOriginAuthRequest } from '@/lib/auth-origin';

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginAuthRequest(request.headers.get('origin'), request.nextUrl.origin)) {
    return NextResponse.json(
      { error: 'ORIGIN_NOT_ALLOWED' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let email: string | undefined;
  let password: string | undefined;
  try {
    const body = await request.json() as { email?: string; password?: string };
    email = body.email?.trim();
    password = body.password;
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  if (!email || email.length > 254 || !password || password.length > 1024) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'A valid email and password are required.' },
      { status: 400 },
    );
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json({ error: 'AUTH_BACKEND_NOT_CONFIGURED' }, { status: 503 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const code = (err as Error)?.name === 'TimeoutError' ? 504 : 502;
    return NextResponse.json(
      { error: 'BACKEND_UNREACHABLE', message: 'Unable to reach authentication service. Please try again.' },
      { status: code },
    );
  }

  let data: Record<string, unknown>;
  try {
    data = await backendRes.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'BACKEND_PARSE_ERROR', message: 'Unexpected response from authentication service.' },
      { status: 502 },
    );
  }

  if (!backendRes.ok) {
    const message =
      typeof data.message === 'string' ? data.message :
      typeof data.error === 'string' ? data.error :
      'Invalid email or password.';
    return NextResponse.json({ error: 'AUTH_FAILED', message }, { status: backendRes.status });
  }

  const accessToken = typeof data.accessToken === 'string' ? data.accessToken : null;
  const refreshToken = typeof data.refreshToken === 'string' ? data.refreshToken : null;
  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { error: 'NO_SESSION_TOKENS', message: 'Authentication service did not return a complete session.' },
      { status: 502 },
    );
  }

  const expiresIn = typeof data.expiresIn === 'number' && Number.isFinite(data.expiresIn)
    ? Math.min(ACCESS_TOKEN_MAX_AGE_SECONDS, Math.max(60, Math.floor(data.expiresIn)))
    : ACCESS_TOKEN_MAX_AGE_SECONDS;
  const csrfToken = randomBytes(32).toString('base64url');
  const response = NextResponse.json({ success: true, message: 'Logged in successfully.' });

  response.cookies.set('admin_token', accessToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: expiresIn,
    path: '/',
  });
  response.cookies.set('admin_refresh_token', refreshToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    path: '/api/auth',
  });
  response.cookies.set('csrf_token', csrfToken, {
    httpOnly: false,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    path: '/',
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
