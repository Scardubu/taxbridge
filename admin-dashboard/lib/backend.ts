type RequestOptions = RequestInit & { expectsJson?: boolean; timeoutMs?: number };

export class BackendAPIError extends Error {
  status: number;
  endpoint: string;
  code?: string;
  details?: string;

  constructor(status: number, endpoint: string, details?: string, code?: string) {
    super(`Backend request to ${endpoint} failed with status ${status}`);
    this.name = 'BackendAPIError';
    this.status = status;
    this.endpoint = endpoint;
    this.details = details;
    this.code = code;
  }
}

// Resolve backend URL — build-time env injection from next.config.ts ensures
// these are set even if the Vercel project settings don't include them explicitly.
const rawBaseUrl = (
  process.env.BACKEND_API_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://taxbridge-api-ker8.onrender.com'
).replace(/\/$/, '');
const adminBaseUrl = `${rawBaseUrl}/admin`;
const defaultTimeoutMs = 10_000;

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
  // Guard: no admin key configured — permanent config error, do NOT retry
  if (!defaultAdminKey) {
    throw new BackendAPIError(
      503,
      path,
      'ADMIN_API_KEY environment variable is not set. Configure it in your deployment settings.',
      'ADMIN_API_DISABLED'
    );
  }

  const url = buildUrl(path);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Admin-API-Key', defaultAdminKey);
  headers.set('Accept', 'application/json');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
      signal: options.signal ?? controller.signal,
    });

    if (!response.ok) {
      let detail: string | undefined;
      let code: string | undefined;
      try {
        const body = await response.json();
        detail = body?.message || body?.error;
        code = body?.code;
      } catch {
        detail = await response.text().catch(() => undefined);
      }
      throw new BackendAPIError(response.status, url, detail, code);
    }

    if (options.expectsJson === false) {
      return response;
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export { requestBackend };
