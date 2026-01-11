import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface NetworkContextType {
  isConnected: boolean;
  isOnline: boolean;
  connectionType: string | null;
  // actively verify connectivity by performing a lightweight fetch
  forceCheck: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isOnline: true,
  connectionType: null,
});

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [networkState, setNetworkState] = useState<NetworkContextType>({
    isConnected: true,
    isOnline: true,
    connectionType: null,
    forceCheck: async () => true,
  });

  const pingUrl = 'https://clients3.google.com/generate_204';
  const intervalMs = 15000;

  useEffect(() => {
    let mounted = true;

    // helper to perform a short fetch with timeout
    async function checkReachable(timeout = 3000) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(pingUrl, { method: 'GET', signal: controller.signal });
        clearTimeout(id);
        return res && (res.status === 204 || res.status === 200);
      } catch {
        return false;
      }
    }

    // NetInfo listener updates initial connectivity state
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!mounted) return;
      setNetworkState((prev) => ({
        ...prev,
        isConnected: state.isConnected ?? true,
        // keep current isOnline until verified by forceCheck
        isOnline: state.isInternetReachable ?? prev.isOnline,
        connectionType: state.type,
      }));
    });

    // expose forceCheck implementation
    const forceCheck = async () => {
      const ok = await checkReachable();
      setNetworkState((prev) => ({ ...prev, isOnline: ok }));
      return ok;
    };

    // update the stored forceCheck in state
    setNetworkState((prev) => ({ ...prev, forceCheck }));

    // periodic verification to ensure `isOnline` is accurate (helps captive portals/restrictive nets)
    const iv = setInterval(async () => {
      const ok = await checkReachable();
      if (!mounted) return;
      setNetworkState((prev) => ({ ...prev, isOnline: ok }));
    }, intervalMs);

    return () => {
      mounted = false;
      clearInterval(iv);
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
}
