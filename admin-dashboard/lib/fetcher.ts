import { withTaxBridgeHeaders } from './api-contract';

export class FetchError extends Error {
  status: number;
  url: string;
  body?: unknown;

  constructor(status: number, url: string, message: string, body?: unknown) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

function extractMessage(body: unknown): string | undefined {
  if (!body) return undefined;

  if (typeof body === 'string') {
    return body;
  }

  if (typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const maybeMessage = record.message;
    const maybeError = record.error;

    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError;
  }

  return undefined;
}

async function safeReadJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!value) return null;
  try {
    return decodeURIComponent(value.slice(prefix.length));
  } catch {
    return value.slice(prefix.length);
  }
}

function isMutatingMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function canReplayBody(body: BodyInit | null | undefined): boolean {
  if (body == null || typeof body === 'string') return true;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true;
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return true;
  return ArrayBuffer.isView(body);
}

function buildRequestHeaders(input: HeadersInit | undefined, method: string): Headers {
  const headers = withTaxBridgeHeaders(input || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (isMutatingMethod(method)) {
    const csrfToken = readCookie('csrf_token');
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }
  return headers;
}

async function refreshAdminSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const credentials = options?.credentials ?? 'same-origin';
  const execute = () => fetch(url, {
    ...options,
    method,
    credentials,
    headers: buildRequestHeaders(options?.headers, method),
  });

  let response = await execute();
  const isAuthRoute = url.startsWith('/api/auth/');
  const shouldRetry = response.status === 401
    && !isAuthRoute
    && canReplayBody(options?.body);

  if (shouldRetry && await refreshAdminSession()) {
    // The refresh endpoint rotates both HttpOnly tokens and the CSRF nonce.
    // Rebuild headers so the retry uses the newly issued CSRF cookie.
    response = await execute();
  }

  const body = await safeReadJson(response);
  if (!response.ok) {
    const message = extractMessage(body) || `Request failed (${response.status})`;
    throw new FetchError(response.status, url, message, body);
  }
  return body as T;
}
