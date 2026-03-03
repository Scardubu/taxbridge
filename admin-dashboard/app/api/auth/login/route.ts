/**
 * TaxBridge Admin — Auth Login API Route
 * Proxies login to the backend API and sets the admin_token cookie.
 *
 * POST /api/auth/login
 * Body: { email: string; password: string }
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ??
  process.env.BACKEND_API_URL ??
  'https://taxbridge-api-ker8.onrender.com';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export async function POST(request: NextRequest): Promise<NextResponse> {
  let email: string | undefined;
  let password: string | undefined;

  try {
    const body = await request.json() as { email?: string; password?: string };
    email    = body.email?.trim();
    password = body.password;
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Email and password are required.' },
      { status: 400 },
    );
  }

  // ── Proxy to backend login endpoint ────────────────────────────────────────
  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
      signal:  AbortSignal.timeout(10_000),
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

  // ── Propagate backend errors ────────────────────────────────────────────────
  if (!backendRes.ok) {
    const message =
      typeof data.message === 'string' ? data.message :
      typeof data.error   === 'string' ? data.error :
      'Invalid email or password.';
    return NextResponse.json({ error: 'AUTH_FAILED', message }, { status: backendRes.status });
  }

  const accessToken = typeof data.accessToken === 'string' ? data.accessToken : null;
  if (!accessToken) {
    return NextResponse.json(
      { error: 'NO_TOKEN', message: 'Authentication service did not return a token.' },
      { status: 502 },
    );
  }

  // ── Set HttpOnly cookie and return success ──────────────────────────────────
  const response = NextResponse.json(
    { success: true, message: 'Logged in successfully.' },
    { status: 200 },
  );

  response.cookies.set('admin_token', accessToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE_SECONDS,
    path:     '/',
  });

  return response;
}
