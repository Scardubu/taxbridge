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
};

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

  let res = await doFetch();

  if (res.status === 401 && !options.skipAuth && options.retryOnUnauthorized !== false) {
    const nextToken = await refreshAccessToken(baseUrl);
    if (nextToken) {
      headers.Authorization = `Bearer ${nextToken}`;
      res = await doFetch();
    }
  }

  if (!res.ok) {
    const detail = await parseErrorBody(res);
    throw new Error(`API error ${res.status}: ${detail}`);
  }

  return res.json();
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
