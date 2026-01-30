import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '../services/authTokens';

interface AuthContextValue {
  isAuthenticated: boolean;
  isHydrated: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const token = await getAccessToken();
      setIsAuthenticated(Boolean(token));
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const value = useMemo(
    () => ({ isAuthenticated, isHydrated, refreshAuth }),
    [isAuthenticated, isHydrated, refreshAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
