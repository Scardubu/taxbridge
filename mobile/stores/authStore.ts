import { create } from 'zustand';
import { TokenService } from '../services/tokenService';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthUser {
  id?: string;
  email?: string;
  name?: string;
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  setAuthenticated: (user: AuthUser | null) => void;
  setLoading: () => void;
  setError: (message: string | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'idle',
  user: null,
  error: null,
  setAuthenticated: (user) => {
    set({
      status: user ? 'authenticated' : 'unauthenticated',
      user,
      error: null,
    });
  },
  setLoading: () => {
    set({ status: 'loading', error: null });
  },
  setError: (message) => {
    set({ status: 'error', error: message });
  },
  logout: async () => {
    await TokenService.clearTokens();
    set({ status: 'unauthenticated', user: null, error: null });
  },
}));

export const useIsAuthenticated = () =>
  useAuthStore((state) => state.status === 'authenticated');

export const useCurrentUser = () =>
  useAuthStore((state) => state.user);

export const useAuthStatus = () =>
  useAuthStore((state) => state.status);
