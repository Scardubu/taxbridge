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

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCurrentUser } from '@store/authStore';
import type { DashboardComposite } from '@api/client';

// ── Query key factory ─────────────────────────────────────────────────
export const dashboardQueryKey = (orgId: string, userId: string) =>
  ['dashboard', orgId, userId] as const;

// ── Stale-on-resume threshold (COMP-14) ──────────────────────────────
const STALE_RESUME_MS = 120_000; // 2 minutes

// ── Composite dashboard hook ──────────────────────────────────────────
export function useDashboard(): UseQueryResult<DashboardComposite> {
  const user = useCurrentUser();
  const orgId = user?.orgId ?? 'default';
  const userId = user?.id ?? 'anonymous';
  const queryClient = useQueryClient();
  const lastFetchTimeRef = useRef(Date.now());

  const query = useQuery<DashboardComposite>({
    queryKey: dashboardQueryKey(orgId, userId),
    queryFn: async () => {
      const { dashboardApi } = await import('@api/client');
      const res = await dashboardApi.composite();
      lastFetchTimeRef.current = Date.now();
      return res.data;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, err: any) => {
      if (err?.statusCode === 401 || err?.statusCode === 403) return false;
      return failureCount < 2;
    },
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && Date.now() - lastFetchTimeRef.current > STALE_RESUME_MS) {
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey(orgId, userId) });
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [orgId, userId, queryClient]);

  return query;
}

export default useDashboard;
