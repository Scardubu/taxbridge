import { NextResponse } from 'next/server';
import { BackendAPIError, requestBackend } from '@/lib/backend';
import { logError } from '@/lib/logger';

function tryParseJson(value?: string): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function extractUpstreamError(details?: string): { upstreamError?: string; upstreamCode?: string } {
  const parsed = tryParseJson(details);
  if (!parsed || typeof parsed !== 'object') return { upstreamError: details };

  const record = parsed as Record<string, unknown>;
  const upstreamError = typeof record.error === 'string' ? record.error : undefined;
  const upstreamCode = typeof record.code === 'string' ? record.code : undefined;
  return { upstreamError, upstreamCode };
}

export async function GET() {
  try {
    const data = await requestBackend('/stats');
    return NextResponse.json(data);
  } catch (error) {
    logError('admin/api/stats: Error fetching stats', error);

    const status = error instanceof BackendAPIError ? error.status : 500;
    const { upstreamError, upstreamCode } =
      error instanceof BackendAPIError ? extractUpstreamError(error.details) : { upstreamError: undefined, upstreamCode: undefined };

    const code = upstreamCode || (upstreamError === 'Admin API disabled' ? 'ADMIN_API_DISABLED' : undefined);
    const message =
      code === 'ADMIN_API_DISABLED'
        ? 'Admin analytics is not enabled for this environment.'
        : upstreamError || (error instanceof BackendAPIError ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        error: 'Failed to fetch admin statistics',
        code,
        message,
      },
      { status }
    );
  }
}
