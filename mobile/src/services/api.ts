import type { NewInvoiceInput } from '../types/invoice';

import { getApiBaseUrl, setApiBaseUrl } from './config';
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from './authTokens';

export type CreateInvoiceResponse = {
  invoiceId: string;
  status: string;
};

export { getApiBaseUrl, setApiBaseUrl };

export type CreateInvoiceOptions = {
  idempotencyKey?: string;
};

type RequestOptions = {
  idempotencyKey?: string;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
  retries?: number;
  retryBaseDelayMs?: number;
};

export class ApiError extends Error {
  status: number;
  retryAfterMs?: number;

  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function parseErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.error === 'string') return parsed.error;
    if (typeof parsed?.message === 'string') return parsed.message;
    if (typeof parsed?.error?.message === 'string') return parsed.error.message;
  } catch {
    // fall back to plain text
  }
  return text;
}

function parseRetryAfterMs(retryAfter: string | null): number | undefined {
  if (!retryAfter) return undefined;

  // If it's an integer, it's seconds.
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  // Otherwise, it may be an HTTP date.
  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }

  return undefined;
}

async function refreshAccessToken(baseUrl: string): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) {
        await clearAuthTokens();
        return null;
      }

      const data = (await res.json()) as { accessToken?: string };
      if (!data?.accessToken) {
        await clearAuthTokens();
        return null;
      }

      await setAuthTokens({ accessToken: data.accessToken, refreshToken });
      return data.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getRetryDelayMs(attempt: number, baseDelayMs: number): number {
  const jitter = Math.round(Math.random() * 100);
  return Math.min(8000, baseDelayMs * 2 ** attempt + jitter);
}

async function requestJson(method: string, path: string, body?: any, options: RequestOptions = {}) {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}/api/v1${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {})
  };

  if (!options.skipAuth) {
    const accessToken = await getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const doFetch = () =>
    fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

  const maxRetries =
    options.retries ?? (method === 'GET' || options.idempotencyKey ? 2 : 0);
  const baseDelayMs = options.retryBaseDelayMs ?? 400;

  let attempt = 0;

  while (true) {
    let res: Response;
    try {
      res = await doFetch();
    } catch (err) {
      if (attempt < maxRetries) {
        await sleep(getRetryDelayMs(attempt, baseDelayMs));
        attempt += 1;
        continue;
      }
      throw err;
    }

    if (res.status === 401 && !options.skipAuth && options.retryOnUnauthorized !== false) {
      const nextToken = await refreshAccessToken(baseUrl);
      if (nextToken) {
        headers.Authorization = `Bearer ${nextToken}`;
        res = await doFetch();
      }
    }

    if (res.ok) {
      return res.json();
    }

    const retryAfterMs = parseRetryAfterMs(res.headers.get('Retry-After'));
    if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
      await sleep(retryAfterMs ?? getRetryDelayMs(attempt, baseDelayMs));
      attempt += 1;
      continue;
    }

    const detail = await parseErrorBody(res);
    throw new ApiError(res.status, `API error ${res.status}: ${detail}`, retryAfterMs);
  }
}

export async function createInvoice(
  input: NewInvoiceInput,
  options: CreateInvoiceOptions = {}
): Promise<CreateInvoiceResponse> {
  return (await requestJson(
    'POST',
    '/invoices',
    {
      customerName: input.customerName,
      items: input.items
    },
    {
      idempotencyKey: options.idempotencyKey
    }
  )) as CreateInvoiceResponse;
}

export const api = {
  post: (path: string, body?: any, options?: RequestOptions) => requestJson('POST', path, body, options),
  get: (path: string, options?: RequestOptions) => requestJson('GET', path, undefined, options)
};
