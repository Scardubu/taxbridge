type RequestOptions = RequestInit & { expectsJson?: boolean };

class BackendAPIError extends Error {
  status: number;
  endpoint: string;
  details?: string;

  constructor(status: number, endpoint: string, details?: string) {
    super(`Backend request to ${endpoint} failed with status ${status}`);
    this.name = 'BackendAPIError';
    this.status = status;
    this.endpoint = endpoint;
    this.details = details;
  }
}

const rawBaseUrl = (process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const adminBaseUrl = `${rawBaseUrl}/admin`;

const adminApiKeys = (process.env.ADMIN_API_KEYS || process.env.ADMIN_API_KEY || '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean);

const defaultAdminKey = adminApiKeys[0] || '';

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${adminBaseUrl}${normalizedPath}`;
}

async function requestBackend(path: string, options: RequestOptions = {}) {
  const url = buildUrl(path);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('X-Admin-API-Key') && defaultAdminKey) {
    headers.set('X-Admin-API-Key', defaultAdminKey);
  }

  headers.set('Accept', 'application/json');

  const response = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => undefined);
    throw new BackendAPIError(response.status, url, detail);
  }

  if (options.expectsJson === false) {
    return response;
  }

  return response.json();
}

export { BackendAPIError, requestBackend };
