/**
 * V12 §8.1 — useDashboard composite hook
 *
 * Gate check: grep -q "queryKey.*dashboard" mobile/src/hooks/useDashboard.ts
 *
 * Query key includes orgId + userId so the cache is scoped per
 * tenant/user (C-14). gcTime 5 min, staleTime 30 s per V12 spec.
 *
 * This is the canonical import point. DashboardScreen should use:
 *   import { useDashboard } from '@hooks/useDashboard';
 *
 * Falls back to the composite endpoint defined in @store/queries.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCurrentUser } from '@store/authStore';
import type { DashboardComposite } from '@api/client';

// ── Query key factory ─────────────────────────────────────────────────
export const dashboardQueryKey = (orgId: string, userId: string) =>
  ['dashboard', orgId, userId] as const;

// ── Composite dashboard hook ──────────────────────────────────────────
export function useDashboard(): UseQueryResult<DashboardComposite> {
  const user = useCurrentUser();
  const orgId = user?.orgId ?? 'default';
  const userId = user?.id ?? 'anonymous';

  return useQuery<DashboardComposite>({
    queryKey: dashboardQueryKey(orgId, userId),
    queryFn: async () => {
      // Dynamic import to avoid circular dependency with API client
      const { dashboardApi } = await import('@api/client');
      const res = await dashboardApi.composite();
      return res.data;
    },
    staleTime: 30 * 1000,    // 30 seconds — V12 spec
    gcTime: 5 * 60 * 1000,   // 5 minutes — V12 spec
    retry: (failureCount, err: any) => {
      // Never retry auth failures
      if (err?.statusCode === 401 || err?.statusCode === 403) return false;
      return failureCount < 2;
    },
    // Return stale cache while re-fetching (offline-first feel)
    placeholderData: (prev) => prev,
  });
}

export default useDashboard;
