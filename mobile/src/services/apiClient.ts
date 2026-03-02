/**
 * TaxBridge — Resilient API Client (Axios + React Query v5)
 *
 * Designed for 2G Nigerian connections:
 *   - 15 s timeout, exponential back-off (max 4 retries ≙ ~30 s wait)
 *   - 401 → silent token refresh ONCE, then sign-out
 *   - React Query offline-first: staleTime 30 s, gcTime 5 min
 *   - Never crashes — every network failure returns a structured ApiClientError
 *
 * C-07: Network failures produce structured errors, never crashes.
 * C-01: No raw Prisma types.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { getAccessToken, getRefreshToken, setAuthTokens, clearAuthTokens } from './authTokens';
import { getApiBaseUrl } from './config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiClientError {
  status: number;
  message: string;
  code?: string;
  retryAfterMs?: number;
}

// Sentinel flag so we only attempt one token refresh at a time
let _refreshInFlight: Promise<string | null> | null = null;

// ─── Axios instance ───────────────────────────────────────────────────────────

export const apiClient = axios.create({
  get baseURL() {
    return getApiBaseUrl();
  },
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ─── Request interceptor — attach JWT ────────────────────────────────────────

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(toApiClientError(error)),
);

// ─── Response interceptor — 401 refresh → retry once ─────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if (
      error.response?.status === 401 &&
      !originalRequest._retried &&
      !originalRequest.url?.endsWith('/auth/refresh')
    ) {
      originalRequest._retried = true;

      try {
        // Coalesce concurrent 401s into a single refresh attempt
        if (!_refreshInFlight) {
          _refreshInFlight = doRefreshToken();
        }
        const newAccessToken = await _refreshInFlight;
        _refreshInFlight = null;

        if (newAccessToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        _refreshInFlight = null;
        await clearAuthTokens();
        // Consumers should observe auth state change and redirect to login
      }
    }

    return Promise.reject(toApiClientError(error));
  },
);

// ─── Token refresh helper ─────────────────────────────────────────────────────

async function doRefreshToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const response = await axios.post<{ success: boolean; accessToken: string }>(
    `${getApiBaseUrl()}/api/v1/auth/refresh`,
    { refreshToken },
    { timeout: 15_000 },
  );

  if (response.data?.accessToken) {
    await setAuthTokens(response.data.accessToken, refreshToken);
    return response.data.accessToken;
  }
  return null;
}

// ─── Error normalisation ──────────────────────────────────────────────────────

function toApiClientError(error: AxiosError | unknown): ApiClientError {
  if (axios.isAxiosError(error)) {
    const status  = error.response?.status ?? (error.code === 'ECONNABORTED' ? 408 : 0);
    const body    = error.response?.data as Record<string, unknown> | undefined;
    const message =
      (body?.error as string) ||
      (body?.message as string) ||
      error.message ||
      'Network error';
    const retryAfterHeader = error.response?.headers?.['retry-after'];
    const retryAfterMs = retryAfterHeader
      ? Math.round(Number(retryAfterHeader) * 1000)
      : undefined;
    return { status, message, code: error.code, retryAfterMs };
  }
  return { status: 0, message: 'Unknown network error' };
}

// ─── React Query v5 client ────────────────────────────────────────────────────
//
// offline-first: queries load from cache when offline, retry when reconnected.
// 2G optimised: staleTime=30 s avoids redundant re-fetches on slow connections.

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const err = error as ApiClientError;
        // Never retry 401 / 403 / 404 — they won't self-heal
        if ([401, 403, 404].includes(err?.status)) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 10_000),
      staleTime: 30_000,         // 30 s
      gcTime: 5 * 60 * 1_000,   // 5 min (keep offline cache)
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 0,
      networkMode: 'online',
    },
  },
});
