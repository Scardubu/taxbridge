/**
 * TaxBridge Auth Store (Zustand)
 * Handles JWT lifecycle, user session, and secure storage
 */

import { create } from 'zustand';
import { authApi, type User } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthState {
  status:  AuthStatus;
  user:    User | null;
  error:   string | null;
  mfaChallengeToken: string | null;

  // Actions
  login:    (email: string, password: string) => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  cancelMfa: () => void;
  register: (data: RegisterData) => Promise<void>;
  logout:   () => Promise<void>;
  loadSession: () => Promise<void>;
  clearError:  () => void;
  updateUser:  (patch: Partial<User>) => void;
}

interface RegisterData {
  email:        string;
  password:     string;
  name:         string;
  businessName?: string;
  tin?:         string;
  businessType?: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'idle',
  user:   null,
  error:  null,
  mfaChallengeToken: null,

  login: async (email, password) => {
    set({ status: 'loading', error: null, mfaChallengeToken: null });
    try {
      await authApi.clearTokens();
      const res = await authApi.login({ email, password });
      if ('mfaRequired' in res && res.mfaRequired) {
        set({
          status: 'unauthenticated',
          user: null,
          error: null,
          mfaChallengeToken: res.challengeToken,
        });
        return;
      }

      await authApi.storeTokens(res.accessToken, res.refreshToken);
      set({
        status: 'authenticated',
        user: res.user,
        error: null,
        mfaChallengeToken: null,
      });
    } catch (err: any) {
      set({
        status: 'error',
        user: null,
        error: err?.message ?? 'Login failed. Check your credentials.',
      });
      throw err;
    }
  },

  verifyMfa: async (code) => {
    const challengeToken = get().mfaChallengeToken;
    if (!challengeToken) throw new Error('No active MFA challenge');

    set({ status: 'loading', error: null });
    try {
      const tokens = await authApi.verifyMfa(challengeToken, code.trim());
      await authApi.storeTokens(tokens.accessToken, tokens.refreshToken);
      set({
        status: 'authenticated',
        user: tokens.user,
        error: null,
        mfaChallengeToken: null,
      });
    } catch (err: unknown) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Two-factor verification failed.',
      });
      throw err;
    }
  },

  cancelMfa: () => set({
    status: 'unauthenticated',
    user: null,
    error: null,
    mfaChallengeToken: null,
  }),

  register: async (data) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.register(data);
      await authApi.storeTokens(res.data.accessToken, res.data.refreshToken);
      set({ status: 'authenticated', user: res.data.user, error: null, mfaChallengeToken: null });
    } catch (err: any) {
      set({
        status: 'error',
        error: err?.message ?? 'Registration failed. Please try again.',
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort — always clear local session even if API call fails
    } finally {
      await authApi.clearTokens();
      set({ status: 'unauthenticated', user: null, error: null, mfaChallengeToken: null });
    }
  },

  loadSession: async () => {
    if (get().status === 'authenticated') return;
    set({ status: 'loading' });
    try {
      const res = await authApi.me();
      set({ status: 'authenticated', user: res.data, error: null });
    } catch {
      await authApi.clearTokens();
      set({ status: 'unauthenticated', user: null });
    }
  },

  clearError: () => set({ error: null }),

  updateUser: (patch) => set(state => ({
    user: state.user ? { ...state.user, ...patch } : null,
  })),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const useIsAuthenticated = () =>
  useAuthStore(s => s.status === 'authenticated');

export const useCurrentUser = () =>
  useAuthStore(s => s.user);

export const useAuthStatus = () =>
  useAuthStore(s => s.status);
