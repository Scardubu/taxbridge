import type { SWRConfiguration } from 'swr';

export const swrConfig: SWRConfiguration = {
  onErrorRetry: (
    error: any,
    _key: string,
    _config: SWRConfiguration,
    revalidate: (opts: { retryCount: number }) => void,
    { retryCount }: { retryCount: number }
  ) => {
    // Never retry on 404
    if (error?.status === 404) return;
    // Never retry if backend returned a graceful fallback 200
    if (error?.info?.fallback) return;
    // Cap at 3 retries to stop infinite console spam on cold start
    if (retryCount >= 3) return;
    // Exponential backoff: 2s, 4s, 8s
    setTimeout(() => revalidate({ retryCount }), Math.min(1000 * 2 ** retryCount, 30_000));
  },
  revalidateOnFocus: false,
  dedupingInterval: 10_000,
};
