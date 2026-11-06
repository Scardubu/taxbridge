import { FetchError, fetchJson } from '@/lib/fetcher';

type MockResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
};

function jsonResponse(body: unknown, status = 200): Response {
  const response: MockResponse = {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
    json: async () => body,
  };
  return response as Response;
}

describe('admin fetcher session security', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    document.cookie = 'csrf_token=csrf-test-nonce; path=/';
  });

  afterEach(() => {
    document.cookie = 'csrf_token=; Max-Age=0; path=/';
    jest.clearAllMocks();
  });

  it('attaches the readable CSRF nonce to mutating API requests', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await expect(fetchJson('/api/admin/device/force-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'device-1', reason: 'operator request' }),
    })).resolves.toEqual({ success: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('X-CSRF-Token')).toBe('csrf-test-nonce');
    expect(init.credentials).toBe('same-origin');
  });

  it('refreshes once after an API 401 and retries with the newly rotated CSRF nonce', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'UNAUTHENTICATED' }, 401))
      .mockImplementationOnce(async (url: string) => {
        expect(url).toBe('/api/auth/refresh');
        document.cookie = 'csrf_token=csrf-rotated-nonce; path=/';
        return jsonResponse({ success: true });
      })
      .mockResolvedValueOnce(jsonResponse({ success: true, devices: [] }));

    await expect(fetchJson('/api/admin/devices')).resolves.toEqual({
      success: true,
      devices: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, retryInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(new Headers(retryInit.headers).get('X-CSRF-Token')).toBe('csrf-rotated-nonce');
  });

  it('does not recurse when the refresh endpoint rejects the session', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'UNAUTHENTICATED' }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'SESSION_REFRESH_REJECTED' }, 401));

    await expect(fetchJson('/api/admin/devices')).rejects.toMatchObject({
      name: 'FetchError',
      status: 401,
    } satisfies Partial<FetchError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not attempt a refresh for the login/refresh/logout endpoints', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'AUTH_FAILED' }, 401));

    await expect(fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@example.test', password: 'incorrect-password' }),
    })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
