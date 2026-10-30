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

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split(';').map(value => value.trim())
    .find(value => value.startsWith('csrf_token='));
  return entry ? decodeURIComponent(entry.slice('csrf_token='.length)) : null;
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = withTaxBridgeHeaders(options?.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const method = (options?.method ?? 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !headers.has('X-CSRF-Token')) {
    const csrfToken = readCsrfCookie();
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }

  const response = await fetch(url, {
    ...options,
    credentials: options?.credentials ?? 'same-origin',
    headers,
  });

  const body = await safeReadJson(response);

  if (!response.ok) {
    const message = extractMessage(body) || `Request failed (${response.status})`;
    throw new FetchError(response.status, url, message, body);
  }

  return body as T;
}
