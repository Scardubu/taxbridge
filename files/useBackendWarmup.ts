'use client';

import { useEffect, useState } from 'react';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://taxbridge-api-ker8.onrender.com';

/** Ping backend every 14 min to prevent Render free-tier cold starts */
const PING_INTERVAL = 14 * 60 * 1000;

export function useBackendWarmup() {
  const [isWarm, setIsWarm] = useState(false);
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      if (cancelled) return;
      setIsWaking(true);
      try {
        const res = await fetch(`${BACKEND_URL}/health`, {
          signal: AbortSignal.timeout(15_000),
          cache: 'no-store',
        });
        if (!cancelled) setIsWarm(res.ok);
      } catch {
        if (!cancelled) setIsWarm(false);
      } finally {
        if (!cancelled) setIsWaking(false);
      }
    };

    ping();
    const interval = setInterval(ping, PING_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { isWarm, isWaking };
}
