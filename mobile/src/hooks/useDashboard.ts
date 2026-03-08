/**
 * useDashboard — TaxBridge V13 Sovereign
 *
 * C-14: Single composite GET /api/v1/dashboard — never 3+ separate requests.
 * gcTime 5 min, staleTime 30s.
 * AppState 'active' → invalidate queries (resume-from-background refresh).
 */

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCurrentUser } from '@store/authStore';
import type { DashboardComposite } from '@api/client';

type RawDashboardComposite = {
  orgId?: string;
  userId?: string;
  risk?: {
    score?: number;
    band?: 'low' | 'medium' | 'high' | 'critical';
  };
  anomalies?: Array<{
    id?: string;
    signal?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    title?: string;
    description?: string;
    message?: string;
  }>;
  nrsHealth?: {
    status?: 'healthy' | 'degraded' | 'unknown';
    latencyMs?: number | null;
    pendingSubmissions?: number;
    deadLetterCount?: number;
    circuitBreakerOpen?: boolean;
    lastChecked?: string;
  };
  filings?: {
    upcoming?: Array<{
      id?: string;
      taxType?: string;
      period?: string;
      deadline?: string;
      daysLeft?: number;
    }>;
    overdue?: Array<{
      id?: string;
      taxType?: string;
      period?: string;
      deadline?: string;
      daysOverdue?: number;
    }>;
  };
  summary?: {
    totalRevenue?: number;
    totalVatOwed?: number;
    totalPaid?: number;
    invoiceCount?: number;
    unstampedCount?: number;
  };
  stats?: DashboardComposite['stats'];
  forecast?: DashboardComposite['forecast'];
  topAnomalies?: DashboardComposite['topAnomalies'];
  upcomingDeadlines?: DashboardComposite['upcomingDeadlines'];
  taxBreakdown?: DashboardComposite['taxBreakdown'];
  sparkData?: DashboardComposite['sparkData'];
  cachedAt?: string;
  computedAt?: string;
  cacheHit?: boolean;
};

function normalizeDashboard(raw: RawDashboardComposite): DashboardComposite {
  const normalizedAnomalies = raw.topAnomalies ?? (raw.anomalies ?? []).map((anomaly, index) => ({
    expenseId: anomaly.id ?? `${anomaly.signal ?? 'anomaly'}-${index}`,
    amount: 0,
    category: anomaly.signal ?? 'general',
    anomalyReason: anomaly.description ?? anomaly.message ?? anomaly.title ?? 'Anomaly detected',
    suggestedAction: anomaly.title ?? 'Review this issue',
    anomalyReason_pidgin: anomaly.description ?? anomaly.message ?? anomaly.title,
    severity: anomaly.severity === 'critical' ? 'high' : anomaly.severity ?? 'medium',
  }));

  const normalizedDeadlines = raw.upcomingDeadlines ?? [
    ...(raw.filings?.overdue ?? []).map((filing, index) => ({
      id: filing.id ?? `overdue-${filing.taxType ?? 'filing'}-${index}`,
      type: filing.taxType ?? 'Filing',
      dueDate: filing.deadline ?? new Date().toISOString(),
      daysRemaining: -Math.abs(filing.daysOverdue ?? 0),
      penaltyIfLate: undefined,
      status: 'overdue' as const,
    })),
    ...(raw.filings?.upcoming ?? []).map((filing, index) => ({
      id: filing.id ?? `upcoming-${filing.taxType ?? 'filing'}-${index}`,
      type: filing.taxType ?? 'Filing',
      dueDate: filing.deadline ?? new Date().toISOString(),
      daysRemaining: filing.daysLeft ?? 0,
      penaltyIfLate: undefined,
      status: 'upcoming' as const,
    })),
  ].sort((left, right) => left.daysRemaining - right.daysRemaining);

  return {
    stats: raw.stats ?? {
      totalInvoices: raw.summary?.invoiceCount ?? 0,
      totalRevenue: raw.summary?.totalRevenue ?? 0,
      pendingNrs: raw.summary?.unstampedCount ?? raw.nrsHealth?.pendingSubmissions ?? 0,
      vatLiability: raw.summary?.totalVatOwed ?? 0,
      taxHealthScore: raw.risk?.score != null ? Math.max(0, 100 - raw.risk.score) : 0,
      recentAnomalies: normalizedAnomalies.length,
    },
    forecast: raw.forecast ?? null,
    nrsHealth: {
      circuitBreakerOpen: raw.nrsHealth?.circuitBreakerOpen ?? raw.nrsHealth?.status === 'degraded',
      pendingSubmissions: raw.nrsHealth?.pendingSubmissions ?? raw.summary?.unstampedCount ?? 0,
      deadLetterCount: raw.nrsHealth?.deadLetterCount ?? 0,
      status: raw.nrsHealth?.status === 'unknown' ? 'degraded' : raw.nrsHealth?.status ?? 'degraded',
    },
    topAnomalies: normalizedAnomalies,
    upcomingDeadlines: normalizedDeadlines,
    cachedAt: raw.cachedAt ?? raw.computedAt ?? new Date().toISOString(),
    taxBreakdown: raw.taxBreakdown ?? [
      { key: 'vat', label: 'VAT', value: raw.summary?.totalVatOwed ?? 0 },
      { key: 'paid', label: 'Paid', value: raw.summary?.totalPaid ?? 0 },
    ],
    sparkData: raw.sparkData ?? [],
  };
}

// ── Query key factory ─────────────────────────────────────────────────
export const dashboardQueryKey = (orgId: string, userId: string) =>
  ['dashboard', orgId, userId] as const;

// ── Stale-on-resume threshold (COMP-14) ──────────────────────────────
const STALE_RESUME_MS = 120_000; // 2 minutes

// ── Composite dashboard hook ──────────────────────────────────────────
export function useDashboard(): UseQueryResult<DashboardComposite> {
  const user = useCurrentUser();
  const orgId = user?.tin ?? user?.businessName ?? 'default';
  const userId = user?.id ?? 'anonymous';
  const queryClient = useQueryClient();
  const lastFetchTimeRef = useRef(Date.now());

  const query = useQuery<DashboardComposite>({
    queryKey: dashboardQueryKey(orgId, userId),
    queryFn: async () => {
      const { dashboardApi } = await import('@api/client');
      const res = await dashboardApi.composite();
      lastFetchTimeRef.current = Date.now();
      return normalizeDashboard(res.data);
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
