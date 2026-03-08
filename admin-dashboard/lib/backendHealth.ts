import { logError } from '@/lib/logger';

const BACKEND_URL = (
  process.env.BACKEND_API_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://taxbridge-api-ker8.onrender.com'
).replace(/\/$/, '');

export const HAS_BACKEND_URL = Boolean(
  process.env.BACKEND_API_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL
);

const DEFAULT_TIMEOUT_MS = 8000;

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function safeJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return undefined;
  }
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export interface HealthFetchOptions {
  timeoutMs?: number;
  fallbackPaths?: string[];
}

/**
 * Fetch a backend health endpoint without admin API key authentication.
 * Health endpoints are public and don't require X-Admin-API-Key.
 */
export async function fetchHealthEndpoint(
  path: string,
  options: HealthFetchOptions = {}
): Promise<{ data: unknown; ok: boolean; status: number }> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, fallbackPaths = [] } = options;
  const paths = [path, ...fallbackPaths];

  for (const currentPath of paths) {
    try {
      const url = `${BACKEND_URL}${currentPath.startsWith('/') ? currentPath : `/${currentPath}`}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 404 && fallbackPaths.length > 0) {
        continue;
      }

      const data = await safeJson(response);
      return { data, ok: response.ok, status: response.status };
    } catch (error) {
      logError(`backendHealth: Error fetching ${currentPath}`, error);
      if (currentPath === paths[paths.length - 1]) {
        throw error;
      }
    }
  }

  throw new Error('All health endpoint paths failed');
}

export { BACKEND_URL };
