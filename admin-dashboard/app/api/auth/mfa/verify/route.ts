import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

const BACKEND_URL = process.env.BACKEND_API_URL ?? process.env.BACKEND_URL ?? '';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let challengeToken: string | undefined;
  let code: string | undefined;
  try {
    const body = await request.json() as { challengeToken?: string; code?: string };
    challengeToken = body.challengeToken;
    code = body.code?.trim();
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST', message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!challengeToken || challengeToken.length > 8192 || !code || !/^(?:\d{6}|[a-fA-F0-9]{8})$/.test(code)) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Enter a valid authenticator or backup code.' }, { status: 400 });
  }
  if (!BACKEND_URL) return NextResponse.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeToken, code }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch (err) {
    const status = (err as Error)?.name === 'TimeoutError' ? 504 : 502;
    return NextResponse.json({ error: 'BACKEND_UNREACHABLE', message: 'Unable to reach authentication service. Please try again.' }, { status });
  }

  let data: Record<string, unknown>;
  try {
    data = await backendRes.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'BACKEND_PARSE_ERROR', message: 'Unexpected response from authentication service.' }, { status: 502 });
  }
  if (!backendRes.ok) {
    const message = typeof data.message === 'string' ? data.message : typeof data.error === 'string' ? data.error : 'Two-factor verification failed.';
    return NextResponse.json({ error: 'MFA_FAILED', message }, { status: backendRes.status, headers: { 'Cache-Control': 'no-store' } });
  }

  const accessToken = typeof data.accessToken === 'string' ? data.accessToken : null;
  const refreshToken = typeof data.refreshToken === 'string' ? data.refreshToken : null;
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: 'NO_TOKEN', message: 'Authentication service did not return a token.' }, { status: 502 });
  }

  const response = NextResponse.json(
    { success: true, message: 'Logged in successfully.' },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set('admin_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60,
    path: '/',
  });
  response.cookies.set('admin_refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
  response.cookies.set('csrf_token', randomUUID(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
  return response;
}
