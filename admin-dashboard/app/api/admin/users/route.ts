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

// Mock data for Stage 1 beta (backend endpoint not yet implemented)
function getMockUsers() {
  return {
    users: [
      {
        id: '1',
        businessName: 'Adebayo Enterprises Ltd',
        email: 'adebayo@example.com',
        phone: '+234 801 234 5678',
        tin: '12345678-0001',
        status: 'active',
        onboardingComplete: true,
        invoiceCount: 45,
        createdAt: '2026-01-15T10:00:00Z',
        lastActive: '2026-01-21T08:30:00Z',
      },
      {
        id: '2',
        businessName: 'Lagos Tech Solutions',
        email: 'info@lagostech.ng',
        phone: '+234 802 345 6789',
        status: 'active',
        onboardingComplete: true,
        invoiceCount: 23,
        createdAt: '2026-01-16T14:00:00Z',
        lastActive: '2026-01-20T16:45:00Z',
      },
      {
        id: '3',
        businessName: 'Abuja Trading Co',
        email: 'trading@abuja.com',
        phone: '+234 803 456 7890',
        status: 'pending',
        onboardingComplete: false,
        invoiceCount: 0,
        createdAt: '2026-01-20T09:00:00Z',
      },
    ],
    total: 3,
    stats: {
      total: 3,
      active: 2,
      pending: 1,
      suspended: 0,
    },
  };
}

export async function GET() {
  try {
    const data = await requestBackend('/users');
    return NextResponse.json(data);
  } catch (error) {
    logError('admin/api/users: Error fetching users', error);

    const status = error instanceof BackendAPIError ? error.status : 500;
    const { upstreamError, upstreamCode } =
      error instanceof BackendAPIError ? extractUpstreamError(error.details) : { upstreamError: undefined, upstreamCode: undefined };

    const code = upstreamCode || (upstreamError === 'Admin API disabled' ? 'ADMIN_API_DISABLED' : undefined) || (error instanceof BackendAPIError ? error.code : undefined);

    // Return mock data for Stage 1 if backend endpoint not available
    if (status === 404 || code === 'ADMIN_API_DISABLED') {
      return NextResponse.json(getMockUsers());
    }

    const message =
      code === 'ADMIN_API_DISABLED'
        ? 'User management is not enabled for this environment.'
        : upstreamError || (error instanceof BackendAPIError ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        code,
        message,
      },
      { status }
    );
  }
}
