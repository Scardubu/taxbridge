/**
 * TaxBridge Auth Store (Zustand)
 * Handles JWT lifecycle, user session, and secure storage
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authApi, type User, type ApiError } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthState {
  status:  AuthStatus;
  user:    User | null;
  error:   string | null;

  // Actions
  login:    (email: string, password: string) => Promise<void>;
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

  login: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.login({ email, password });
      await authApi.storeTokens(res.data.accessToken, res.data.refreshToken);
      set({ status: 'authenticated', user: res.data.user, error: null });
    } catch (err: any) {
      set({
        status: 'error',
        error: err?.message ?? 'Login failed. Check your credentials.',
      });
      throw err;
    }
  },

  register: async (data) => {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.register(data);
      await authApi.storeTokens(res.data.accessToken, res.data.refreshToken);
      set({ status: 'authenticated', user: res.data.user, error: null });
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
      set({ status: 'unauthenticated', user: null, error: null });
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
