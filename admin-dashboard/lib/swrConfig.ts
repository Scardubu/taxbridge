/** Error codes that are permanent config issues — no point retrying */
const PERMANENT_ERROR_CODES = new Set([
  'ADMIN_API_DISABLED',
  'BACKEND_NOT_CONFIGURED',
]);

/** HTTP statuses that should never be retried (permanent or auth failures) */
const NO_RETRY_STATUSES = new Set([401, 403, 404]);

export const swrConfig = {
  onErrorRetry: (
    error: { status?: number; body?: unknown },
    _key: string,
    _config: unknown,
    revalidate: (opts: { retryCount: number }) => void,
    { retryCount }: { retryCount: number }
  ) => {
    const status = error?.status;

    // Never retry on permanent HTTP status codes
    if (status !== undefined && NO_RETRY_STATUSES.has(status)) return;

    // Never retry on permanent configuration errors (503 ADMIN_API_DISABLED, etc.)
    const body = error?.body;
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      if (record.fallback) return;
      if (typeof record.code === 'string' && PERMANENT_ERROR_CODES.has(record.code)) return;
    }

    // Stop after 3 transient-error retries
    if (retryCount >= 3) return;

    setTimeout(
      () => revalidate({ retryCount }),
      Math.min(1000 * 2 ** retryCount, 30_000)
    );
  },
  revalidateOnFocus: false,
  dedupingInterval: 10_000,
};
