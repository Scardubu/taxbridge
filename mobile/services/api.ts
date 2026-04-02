import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import { TokenService } from './tokenService';
import { useAuthStore } from '../stores/authStore';

type JsonRecord = Record<string, unknown>;

let deviceIdPromise: Promise<string> | null = null;
let refreshPromise: Promise<string | null> | null = null;

function getRequestTimeoutMs(): number {
  const raw = Number(process.env.API_TIMEOUT ?? 30000);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 30000;
  }

  return raw;
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'https://api.taxbridge.ng';
}

async function getDeviceId(): Promise<string> {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      const generated = typeof Crypto.randomUUID === 'function'
        ? Crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return Device.osInternalBuildId ?? Device.deviceName ?? generated;
    })();
  }
  return deviceIdPromise;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await TokenService.getRefreshToken();
    if (!refreshToken) return null;

    const response = await fetch(`${getBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TaxBridge-Version': '13',
        'X-Device-ID': await getDeviceId(),
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken) {
      return null;
    }

    await TokenService.setTokens(data.accessToken, data.refreshToken ?? refreshToken);
    return data.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function executeRequest(path: string, options: RequestInit = {}, accessToken?: string | null): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
        'X-TaxBridge-Version': '13',
        'X-Device-ID': await getDeviceId(),
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, hasRetried = false): Promise<T> {
  const accessToken = await TokenService.getAccessToken();
  const response = await executeRequest(path, options, accessToken);

  if (response.status === 401 && !hasRetried) {
    try {
      const newAccessToken = await refreshAccessToken();
      if (!newAccessToken) {
        throw new Error('session_expired');
      }
      const retryResponse = await executeRequest(path, options, newAccessToken);
      if (!retryResponse.ok) {
        const retryPayload = (await retryResponse.json().catch(() => ({ message: retryResponse.statusText }))) as JsonRecord;
        throw new Error(typeof retryPayload.message === 'string' ? retryPayload.message : 'api_error');
      }
      return retryResponse.json() as Promise<T>;
    } catch {
      await TokenService.clearTokens();
      await useAuthStore.getState().logout();
      throw new Error('session_expired');
    }
  }

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({ message: response.statusText }))) as JsonRecord;
    throw new Error(typeof errorPayload.message === 'string' ? errorPayload.message : 'api_error');
  }

  return response.json() as Promise<T>;
}
