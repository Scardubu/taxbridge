import { NextResponse } from 'next/server';
import { BackendAPIError } from '@/lib/backend';

export const BACKEND_WARMUP_WARNING = 'backend_warming_up';

function tryParseJson(value?: string): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function getBackendFailureContext(error: unknown, defaultMessage: string) {
  const status = error instanceof BackendAPIError ? error.status : 500;

  const parsed = error instanceof BackendAPIError ? tryParseJson(error.details) : undefined;
  const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined;

  const upstreamError = typeof record?.error === 'string'
    ? record.error
    : error instanceof BackendAPIError
      ? error.details
      : undefined;

  const upstreamCode = typeof record?.code === 'string' ? record.code : undefined;
  const code =
    upstreamCode ||
    (upstreamError === 'Admin API disabled' ? 'ADMIN_API_DISABLED' : undefined) ||
    (error instanceof BackendAPIError ? error.code : undefined);

  const message =
    code === 'ADMIN_API_DISABLED'
      ? defaultMessage
      : upstreamError || (error instanceof Error ? error.message : 'Unknown error');

  const backendUnavailable =
    status >= 500 || code === 'BACKEND_NOT_CONFIGURED' || code === 'ADMIN_API_DISABLED';

  return {
    status,
    code,
    message,
    backendUnavailable,
  };
}

export function fallbackJson<T extends Record<string, unknown>>(payload: T) {
  return NextResponse.json(
    {
      fallback: true,
      warnings: [BACKEND_WARMUP_WARNING],
      ...payload,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Fallback': 'true',
      },
    }
  );
}
