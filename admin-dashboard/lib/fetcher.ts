import { withTaxBridgeHeaders } from './api-contract';

export type FetchErrorCode =
  | 'SESSION_EXPIRED'
  | 'REFRESHING_SESSION'
  | 'SESSION_RESTORED'
  | 'REAUTHENTICATION_REQUIRED'
  | 'CSRF_REJECTED'
  | 'BACKEND_UNAVAILABLE'
  | 'PERMISSION_DENIED'
  | 'HTTP_ERROR';

export class FetchError extends Error {
  status: number;
  url: string;
  code?: FetchErrorCode;
  body?: unknown;

  constructor(status: number, url: string, message: string, body?: unknown, code?: FetchErrorCode) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.url = url;
    this.code = code;
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

function classifyErrorCode(status: number, body: unknown): FetchErrorCode {
  if (status === 401) return 'SESSION_EXPIRED';
  if (status === 403) {
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      if (record.error === 'CSRF_INVALID' || String(record.message).toLowerCase().includes('csrf')) {
        return 'CSRF_REJECTED';
      }
    }
    return 'PERMISSION_DENIED';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'BACKEND_UNAVAILABLE';
  }
  return 'HTTP_ERROR';
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

function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function canReplayBody(body: BodyInit | null | undefined): boolean {
  if (body == null || typeof body === 'string') return true;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true;
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return true;
  return ArrayBuffer.isView(body);
}

function isSafeOrIdempotent(method: string, headers: Headers): boolean {
  if (isSafeMethod(method)) return true;
  return headers.has('x-idempotency-key') || headers.has('idempotency-key');
}

function buildRequestHeaders(input: HeadersInit | undefined, method: string): Headers {
  const headers = withTaxBridgeHeaders(input || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const csrfToken = readCookie('csrf_token');
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  return headers;
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

let refreshInFlight: Promise<boolean> | null = null;

async function performSessionRefresh(): Promise<boolean> {
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

function refreshAdminSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  const run = async (): Promise<boolean> => {
    // Web Locks serialize refresh-token rotation across browser tabs. The
    // second tab reads the replacement cookie only after the first rotation
    // has completed, avoiding a false replay signal for a legitimate session.
    if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks?.request) {
      try {
        return await navigator.locks.request(
          'taxbridge-admin-refresh-token',
          { mode: 'exclusive' },
          performSessionRefresh,
        );
      } catch {
        return false;
      }
    }
    return performSessionRefresh();
  };

  refreshInFlight = run().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
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

  let response: Response;
  try {
    response = await execute();
  } catch (error) {
    throw new FetchError(
      503,
      url,
      'Backend authentication or API service unreachable.',
      undefined,
      'BACKEND_UNAVAILABLE',
    );
  }

  const isAuthRoute = url.startsWith('/api/auth/');
  const shouldRetry = response.status === 401 && !isAuthRoute;

  if (shouldRetry) {
    const initialHeaders = buildRequestHeaders(options?.headers, method);
    const safeToRetry = isSafeOrIdempotent(method, initialHeaders) && canReplayBody(options?.body);

    const refreshed = await refreshAdminSession();
    if (refreshed) {
      if (safeToRetry) {
        // The refresh endpoint rotates both HttpOnly tokens and the CSRF nonce.
        // Rebuild headers so the retry uses the newly issued CSRF cookie.
        try {
          response = await execute();
        } catch {
          throw new FetchError(
            503,
            url,
            'Backend unavailable on session refresh retry.',
            undefined,
            'BACKEND_UNAVAILABLE',
          );
        }
      } else {
        throw new FetchError(
          401,
          url,
          'Session refreshed, but this action cannot be safely replayed automatically. Please submit again.',
          undefined,
          'REAUTHENTICATION_REQUIRED',
        );
      }
    } else {
      throw new FetchError(
        401,
        url,
        'Your session has expired. Please sign in again.',
        undefined,
        'REAUTHENTICATION_REQUIRED',
      );
    }
  }

  const body = await safeReadJson(response);
  if (!response.ok) {
    const code = classifyErrorCode(response.status, body);
    let message = extractMessage(body);

    if (!message) {
      switch (code) {
        case 'CSRF_REJECTED':
          message = 'Security validation failed (CSRF token mismatch). Please refresh the page.';
          break;
        case 'PERMISSION_DENIED':
          message = 'Permission denied. Administrator privileges required.';
          break;
        case 'BACKEND_UNAVAILABLE':
          message = 'The backend service is currently unreachable. Please try again.';
          break;
        case 'SESSION_EXPIRED':
          message = 'Session expired. Please sign in again.';
          break;
        default:
          message = `Request failed (${response.status})`;
      }
    }

    throw new FetchError(response.status, url, message, body, code);
  }

  return body as T;
}
