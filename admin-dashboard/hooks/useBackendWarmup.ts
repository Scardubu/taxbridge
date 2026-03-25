'use client';

import { useEffect, useState } from 'react';
import { withTaxBridgeHeaders } from '@/lib/api-contract';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://taxbridge-api-ker8.onrender.com';

const PING_INTERVAL = 14 * 60 * 1000;

export function useBackendWarmup() {
  const [isWarm, setIsWarm] = useState(false);
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    const ping = async () => {
      try {
        setIsWaking(true);
        const response = await fetch(`${BACKEND_URL}/health`, {
          headers: withTaxBridgeHeaders(),
          signal: AbortSignal.timeout(15000),
          cache: 'no-store',
        });
        setIsWarm(response.ok);
      } catch {
        setIsWarm(false);
      } finally {
        setIsWaking(false);
      }
    };

    ping();
    const interval = setInterval(ping, PING_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return { isWarm, isWaking };
}
