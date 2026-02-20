export const swrConfig = {
  onErrorRetry: (
    error: { status?: number; body?: unknown },
    _key: string,
    _config: unknown,
    revalidate: (opts: { retryCount: number }) => void,
    { retryCount }: { retryCount: number }
  ) => {
    if (error?.status === 404) return;

    const body = error?.body;
    if (body && typeof body === 'object' && (body as Record<string, unknown>).fallback) {
      return;
    }

    if (retryCount >= 3) return;

    setTimeout(
      () => revalidate({ retryCount }),
      Math.min(1000 * 2 ** retryCount, 30000)
    );
  },
  revalidateOnFocus: false,
  dedupingInterval: 10000,
};
