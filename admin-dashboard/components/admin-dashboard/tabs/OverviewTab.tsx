'use client';

import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { MetricCard } from '@/components/admin-dashboard/ui/MetricCard';
import { StatusPill } from '@/components/admin-dashboard/ui/StatusPill';
import { SectionHeader } from '@/components/admin-dashboard/ui/SectionHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HealthCard } from '@/components/HealthCard';
import { LaunchMetricsWidget, type LaunchMetricsData } from '@/components/LaunchMetricsWidget';
import { DuploHealthChart } from '@/components/charts/DuploHealthChart';
import { RemitaTransactionChart } from '@/components/charts/RemitaTransactionChart';
import { InvoiceChart, type InvoiceChartDataPoint } from '@/components/charts/InvoiceChart';
import { PaymentChart, type PaymentChartDataPoint } from '@/components/charts/PaymentChart';
import { AIInsightsPanel } from '@/components/AIInsightsPanel';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';
import { formatCompactNumber, safeDate } from '@/lib/utils';
import { useTaxBridgeSSE } from '@/hooks/useTaxBridgeSSE';
import { useBackendWarmup } from '@/hooks/useBackendWarmup';
import { SkeletonCard } from '@/components/ui/skeleton-table';
import {
  Users, FileText, CreditCard, ShieldCheck,
  AlertTriangle, TrendingUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalUsers: number;
  totalInvoices: number;
  totalPayments: number;
  duploStatus: 'healthy' | 'degraded' | 'error';
  duploLatency: number | null;
  remitaStatus: 'healthy' | 'degraded' | 'error';
  remitaLatency: number | null;
  duploSuccessTrend: Array<{ timestamp: string; successRate: number; latency: number; submissions: number }>;
  remitaTransactions: Array<{ date: string; successful: number; failed: number; pending: number; total: number }>;
  warnings?: string[];
}

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

function extractErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const r = body as Record<string, unknown>;
  return typeof r.code === 'string' ? r.code : undefined;
}

function isAuthBlocked(err: FetchError): boolean {
  const code = extractErrorCode(err.body);
  return (
    code === 'ADMIN_API_DISABLED' ||
    code === 'BACKEND_NOT_CONFIGURED' ||
    err.status === 401 ||
    err.status === 403
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OverviewTab() {
  const { t } = useAdminI18n();
  const { isWaking, isWarm } = useBackendWarmup();

  const shouldRetry = (err: unknown) => {
    if (err instanceof FetchError) {
      const code = extractErrorCode(err.body);
      if (code === 'ADMIN_API_DISABLED' || code === 'BACKEND_NOT_CONFIGURED') return false;
      if (err.status === 401 || err.status === 403) return false;
      return err.status >= 500;
    }
    return true;
  };

  const {
    data: stats,
    error: statsError,
    isLoading,
    mutate: mutateStats,
  } = useSWR<DashboardStats, FetchError>('/api/admin/stats', fetcher, {
    refreshInterval: 300_000,
    shouldRetryOnError: shouldRetry,
    errorRetryCount: 3,
    revalidateOnFocus: false,
  });

  const isBlocked = statsError instanceof FetchError && isAuthBlocked(statsError);

  const {
    data: launchMetrics,
    error: launchError,
    isLoading: isLaunchLoading,
    mutate: mutateLaunch,
  } = useSWR<LaunchMetricsData, FetchError>(isBlocked ? null : '/api/admin/launch-metrics', fetcher, {
    refreshInterval: 300_000,
    shouldRetryOnError: shouldRetry,
    errorRetryCount: 3,
    revalidateOnFocus: false,
  });

  const handleSSEEvent = useCallback(() => {
    void mutateStats();
    void mutateLaunch();
  }, [mutateStats, mutateLaunch]);

  useTaxBridgeSSE({
    eventTypes: ['stats:updated', 'invoice:created', 'payment:completed', 'user:registered'],
    onEvent: handleSSEEvent,
  });

  const fallback = useMemo<DashboardStats>(() => ({
    totalUsers: 0, totalInvoices: 0, totalPayments: 0,
    duploStatus: 'degraded', duploLatency: null,
    remitaStatus: 'degraded', remitaLatency: null,
    duploSuccessTrend: [], remitaTransactions: [],
  }), []);

  const d = stats ?? fallback;
  const lastChecked = stats ? new Date().toLocaleTimeString() : '';
  const lastLaunchRefresh = safeDate(launchMetrics?.timestamp, { timeStyle: 'medium' }) || '';
  const anomalies = launchMetrics?.anomalies ?? [];

  const invoiceChartData = useMemo<InvoiceChartDataPoint[]>(() => [], []);
  const paymentChartData = useMemo<PaymentChartDataPoint[]>(() => [], []);

  // ── Error state ──────────────────────────────────────────────────────────
  if (statsError && !isBlocked) {
    const msg = (() => {
      if (statsError instanceof FetchError) {
        const code = extractErrorCode(statsError.body);
        if (code === 'ADMIN_API_DISABLED') return t('dashboard.unavailable.adminDisabled');
        if (code === 'BACKEND_NOT_CONFIGURED') return t('dashboard.unavailable.backendNotConfigured');
        if (statsError.status === 403) return t('dashboard.unavailable.forbidden');
        if (statsError.status === 401) return t('dashboard.unavailable.unauthorized');
        return statsError.message;
      }
      return t('dashboard.unavailable.body');
    })();
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('dashboard.unavailable.title')}</AlertTitle>
        <AlertDescription>{msg}</AlertDescription>
      </Alert>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (!isBlocked && (isLoading || !stats)) {
    return (
      <div className="space-y-6 animate-fade-in" role="status" aria-label="Loading overview">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
              <div className="h-48 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading dashboard data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Backend warm-up banner */}
      {isWaking && !isWarm && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {t('status.checking')} — Backend is warming up, data will appear shortly.
          </AlertDescription>
        </Alert>
      )}

      {/* Limited-data banner */}
      {isBlocked && (
        <Alert className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <AlertTitle>{t('dashboard.limited.title')}</AlertTitle>
          <AlertDescription>
            {statsError instanceof FetchError && extractErrorCode(statsError.body) === 'BACKEND_NOT_CONFIGURED'
              ? t('dashboard.stats.backendNotConfigured')
              : t('dashboard.limited.body')}
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {(d.warnings ?? []).length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">{t('dashboard.warnings.title')}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-1">
              {d.warnings!.map((w, i) => (
                <li key={i} className="text-sm text-amber-800 dark:text-amber-200">• {w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* ── KPI row ── */}
      <section aria-label="Key performance indicators">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t('dashboard.metric.totalUsers')}
            value={formatCompactNumber(d.totalUsers ?? 0)}
            hint={lastChecked ? `Updated ${lastChecked}` : undefined}
            icon={<Users className="h-5 w-5" />}
            iconVariant="blue"
          />
          <MetricCard
            label={t('dashboard.metric.totalInvoices')}
            value={formatCompactNumber(d.totalInvoices ?? 0)}
            hint={lastChecked ? `Updated ${lastChecked}` : undefined}
            icon={<FileText className="h-5 w-5" />}
            iconVariant="emerald"
          />
          <MetricCard
            label={t('dashboard.metric.totalPayments')}
            value={formatCompactNumber(d.totalPayments ?? 0)}
            hint={t('dashboard.metric.trendUnavailable')}
            icon={<CreditCard className="h-5 w-5" />}
            iconVariant="violet"
          />
          <MetricCard
            label={t('dashboard.metric.complianceRate')}
            value={t('common.na')}
            hint={t('dashboard.metric.complianceUnavailable')}
            icon={<ShieldCheck className="h-5 w-5" />}
            iconVariant="amber"
          />
        </div>
      </section>

      {/* ── AI Insights Panel ── */}
      <section aria-label="AI platform intelligence">
        <Card>
          <CardContent className="pt-6">
            <AIInsightsPanel />
          </CardContent>
        </Card>
      </section>

      {/* ── Integration health ── */}
      <section aria-label="Integration health">
        <SectionHeader
          title={t('dashboard.section.integrationHealth')}
          description="Live service availability and response latency for critical tax rails."
          className="mb-4"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <HealthCard
            title={t('dashboard.integration.duplo.title')}
            status={d.duploStatus}
            latency={d.duploLatency}
            lastChecked={lastChecked}
            description={t('dashboard.integration.duplo.desc')}
          />
          <HealthCard
            title={t('dashboard.integration.remita.title')}
            status={d.remitaStatus}
            latency={d.remitaLatency}
            lastChecked={lastChecked}
            description={t('dashboard.integration.remita.desc')}
          />
        </div>
      </section>

      {/* ── Launch metrics + anomalies ── */}
      <section aria-label="Launch metrics and risk signals">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-100">
              {t('launch.title')}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {t('dashboard.section.launch.subtitle')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="text-xs">{t('dashboard.launch.targetNrr')}</Badge>
            <Badge variant="outline" className="text-xs">{t('dashboard.launch.targetGrr')}</Badge>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isBlocked || launchError ? (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">{t('dashboard.launch.unavailable.title')}</CardTitle>
                  <CardDescription>{t('dashboard.launch.unavailable.body')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    {launchError?.message ?? t('dashboard.stats.blockedFallback')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <LaunchMetricsWidget metrics={launchMetrics} isLoading={isLaunchLoading} />
            )}
          </div>

          {/* Risk / Anomalies */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{t('dashboard.risk.title')}</CardTitle>
                <Badge
                  variant={anomalies.length ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {anomalies.length
                    ? t('dashboard.risk.badge.open', { count: anomalies.length })
                    : t('dashboard.risk.badge.stable')}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.risk.subtitle')}</p>
            </CardHeader>
            <CardContent>
              {launchError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  {t('dashboard.risk.unavailable', { message: launchError.message || t('dashboard.risk.retry') })}
                </p>
              ) : anomalies.length === 0 ? (
                <div className="flex items-start gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {t('dashboard.risk.none', { time: lastLaunchRefresh || t('dashboard.risk.now') })}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {anomalies.map((item, i) => (
                    <li
                      key={`${item}-${i}`}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span className="flex-1 text-slate-700 dark:text-slate-300">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Charts ── */}
      <section aria-label="Platform charts">
        <SectionHeader
          title={t('dashboard.section.charts.title')}
          className="mb-4"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.invoiceTrends')}</CardTitle>
              <p className="text-xs text-slate-500">{t('dashboard.invoiceTrends.desc')}</p>
            </CardHeader>
            <CardContent><InvoiceChart data={invoiceChartData} /></CardContent>
          </Card>

          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.paymentAnalytics')}</CardTitle>
              <p className="text-xs text-slate-500">{t('dashboard.paymentAnalytics.desc')}</p>
            </CardHeader>
            <CardContent><PaymentChart data={paymentChartData} /></CardContent>
          </Card>

          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.section.metrics.duplo.title')}</CardTitle>
              <p className="text-xs text-slate-500">{t('dashboard.section.metrics.duplo.desc')}</p>
            </CardHeader>
            <CardContent><DuploHealthChart data={d.duploSuccessTrend} /></CardContent>
          </Card>

          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.section.metrics.remita.title')}</CardTitle>
              <p className="text-xs text-slate-500">{t('dashboard.section.metrics.remita.desc')}</p>
            </CardHeader>
            <CardContent><RemitaTransactionChart data={d.remitaTransactions} /></CardContent>
          </Card>
        </div>
      </section>

      {/* ── Activity feed placeholder ── */}
      <section aria-label="Recent activity">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">{t('dashboard.section.activity.title')}</CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">{t('dashboard.section.activity.subtitle')}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">{t('dashboard.section.activity.unavailable')}</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
