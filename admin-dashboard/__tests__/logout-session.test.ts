import { NextRequest } from 'next/server';
import { POST as logout } from '../app/api/auth/logout/route';

describe('admin logout local-session cleanup', () => {
  const previousBackendApiUrl = process.env.BACKEND_API_URL;
  const previousBackendUrl = process.env.BACKEND_URL;

  afterEach(() => {
    if (previousBackendApiUrl === undefined) delete process.env.BACKEND_API_URL;
    else process.env.BACKEND_API_URL = previousBackendApiUrl;
    if (previousBackendUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previousBackendUrl;
  });

  it('clears local cookies even when no backend URL is configured', async () => {
    delete process.env.BACKEND_API_URL;
    delete process.env.BACKEND_URL;

    const request = new NextRequest('https://admin.taxbridge.ng/api/auth/logout', {
      method: 'POST',
      headers: {
        Origin: 'https://admin.taxbridge.ng',
        Cookie: 'admin_token=old-access; admin_refresh_token=old-refresh; csrf_token=old-csrf',
      },
    });

    const response = await logout(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      error: 'AUTH_BACKEND_NOT_CONFIGURED',
      localSessionCleared: true,
      scope: 'local_only',
    });
    expect(response.cookies.get('admin_token')?.value).toBe('');
    expect(response.cookies.get('admin_refresh_token')?.value).toBe('');
    expect(response.cookies.get('csrf_token')?.value).toBe('');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects a cross-origin logout without clearing an unrelated session', async () => {
    const request = new NextRequest('https://admin.taxbridge.ng/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' },
    });

    const response = await logout(request);
    expect(response.status).toBe(403);
    expect(response.cookies.getAll()).toHaveLength(0);
  });

  it('rejects logout requests with a missing Origin header', async () => {
    const request = new NextRequest('https://admin.taxbridge.ng/api/auth/logout', {
      method: 'POST',
    });

    const response = await logout(request);
    expect(response.status).toBe(403);
    expect(response.cookies.getAll()).toHaveLength(0);
  });
});
