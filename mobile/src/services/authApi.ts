import { api } from './api';
import { clearAuthTokens, setAuthTokens } from './authTokens';

export type RegisterResponse = {
  success: true;
  userId: string;
  message?: string;
};

export type LoginResponse =
  | ({ success: true; accessToken: string; refreshToken: string } & Record<string, any>)
  | { success: true; requiresMfa: true; mfaToken: string };

export async function register(phone: string, name: string, password: string): Promise<RegisterResponse> {
  return (await api.post(
    '/auth/register',
    { phone, name, password },
    { skipAuth: true, retryOnUnauthorized: false }
  )) as RegisterResponse;
}

export async function verifyPhone(userId: string, otp: string): Promise<void> {
  const res = (await api.post(
    '/auth/verify-phone',
    { userId, otp },
    { skipAuth: true, retryOnUnauthorized: false }
  )) as { accessToken?: string; refreshToken?: string };

  if (res?.accessToken) {
    await setAuthTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  }
}

export async function login(phone: string, password: string, deviceId?: string): Promise<LoginResponse> {
  const res = (await api.post(
    '/auth/login',
    { phone, password, deviceId },
    { skipAuth: true, retryOnUnauthorized: false }
  )) as any;

  if (res?.accessToken && res?.refreshToken) {
    await setAuthTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  }

  return res as LoginResponse;
}

export async function mfaLogin(mfaToken: string, totpCode: string): Promise<void> {
  const res = (await api.post(
    '/auth/mfa/login',
    { mfaToken, totpCode },
    { skipAuth: true, retryOnUnauthorized: false }
  )) as { accessToken?: string; refreshToken?: string };

  if (res?.accessToken && res?.refreshToken) {
    await setAuthTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout', {}, { retryOnUnauthorized: false });
  } finally {
    await clearAuthTokens();
  }
}
