'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HealthCard } from '@/components/HealthCard';
import { DuploHealthChart } from '@/components/charts/DuploHealthChart';
import { RemitaTransactionChart } from '@/components/charts/RemitaTransactionChart';
import { InvoiceChart, InvoiceChartDataPoint } from '@/components/charts/InvoiceChart';
import { PaymentChart, PaymentChartDataPoint } from '@/components/charts/PaymentChart';
import { LaunchMetricsWidget, LaunchMetricsData } from '@/components/LaunchMetricsWidget';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';
import { SkeletonCard } from '@/components/ui/skeleton-table';
import { useBackendWarmup } from '@/hooks/useBackendWarmup';

interface DashboardStats {
  totalUsers: number;
  totalInvoices: number;
  totalPayments: number;
  duploStatus: 'healthy' | 'degraded' | 'error';
  duploLatency: number | null;
  remitaStatus: 'healthy' | 'degraded' | 'error';
  remitaLatency: number | null;
  duploSuccessTrend: Array<{
    timestamp: string;
    successRate: number;
    latency: number;
    submissions: number;
  }>;
  remitaTransactions: Array<{
    date: string;
    successful: number;
    failed: number;
    pending: number;
    total: number;
  }>;
  warnings?: string[];
}

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

// Metric Card Icons
const UsersIcon = () => (
  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const InvoiceIcon = () => (
  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PaymentIcon = () => (
  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const ComplianceIcon = () => (
  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

export default function DashboardPage() {
  const { t } = useAdminI18n();
  const { isWaking, isWarm } = useBackendWarmup();

  const extractErrorCode = (body: unknown): string | undefined => {
    if (!body || typeof body !== 'object') return undefined;
    const record = body as Record<string, unknown>;
    return typeof record.code === 'string' ? record.code : undefined;
  };

  const isAuthBlocked = (err: FetchError): boolean => {
    const code = extractErrorCode(err.body);
    return code === 'ADMIN_API_DISABLED' || code === 'BACKEND_NOT_CONFIGURED' || err.status === 401 || err.status === 403;
  };

  const shouldRetryOnError = (err: unknown) => {
    if (err instanceof FetchError) {
      const code = extractErrorCode(err.body);

      if (code === 'ADMIN_API_DISABLED') return false;
      if (code === 'BACKEND_NOT_CONFIGURED') return false;
      if (err.status === 401 || err.status === 403) return false;
      return err.status >= 500;
    }
    return true;
  };

  const {
    data: stats,
    error: statsError,
    isLoading,
  } = useSWR<DashboardStats, FetchError>('/api/admin/stats', fetcher, {
    refreshInterval: 30000,
    shouldRetryOnError,
    errorRetryCount: 3,
    revalidateOnFocus: false,
  });

  const isStatsBlocked = statsError instanceof FetchError && isAuthBlocked(statsError);

  const {
    data: launchMetrics,
    error: launchMetricsErrorRaw,
    isLoading: isLaunchMetricsLoading
  } = useSWR<LaunchMetricsData, FetchError>(isStatsBlocked ? null : '/api/admin/launch-metrics', fetcher, {
    refreshInterval: 60000,
    shouldRetryOnError,
    errorRetryCount: 3,
    revalidateOnFocus: false,
  });

  const effectiveStatsError = statsError;
  const launchMetricsError = launchMetricsErrorRaw;

  const fallbackStats = useMemo<DashboardStats>(() => {
    return {
      totalUsers: 0,
      totalInvoices: 0,
      totalPayments: 0,
      duploStatus: 'degraded',
      duploLatency: null,
      remitaStatus: 'degraded',
      remitaLatency: null,
      duploSuccessTrend: [],
      remitaTransactions: [],
    };
  }, []);

  const displayStats = stats ?? fallbackStats;

  const lastChecked = useMemo(() => {
    return stats ? new Date().toLocaleTimeString() : '';
  }, [stats]);

  // Invoice chart data derived from real stats when available
  const invoiceChartData = useMemo<InvoiceChartDataPoint[]>(() => {
    if (!stats) return [];
    // Real chart data should come from backend analytics endpoint
    // Currently no per-month breakdown is available in stats — show empty state
    return [];
  }, [stats]);

  // Payment chart data derived from real stats when available
  const paymentChartData = useMemo<PaymentChartDataPoint[]>(() => {
    if (!stats) return [];
    // Real chart data should come from backend analytics endpoint
    // Currently no per-day breakdown is available in stats — show empty state
    return [];
  }, [stats]);

  const lastLaunchRefresh = useMemo(() => {
    return launchMetrics ? new Date(launchMetrics.timestamp).toLocaleTimeString() : '';
  }, [launchMetrics]);

  const classifyAnomaly = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.startsWith('critical')) {
      return {
        labelKey: 'severity.critical',
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-700',
        badgeClass: 'border-rose-200 bg-rose-50 text-rose-700'
      };
    }
    if (normalized.startsWith('high')) {
      return {
        labelKey: 'severity.high',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-700',
        badgeClass: 'border-orange-200 bg-orange-50 text-orange-700'
      };
    }
    if (normalized.includes('failed') || normalized.includes('warning') || normalized.includes('latency')) {
      return {
        labelKey: 'severity.warning',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-700',
        badgeClass: 'border-amber-200 bg-amber-50 text-amber-700'
      };
    }
    return {
      labelKey: 'severity.info',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-700',
      badgeClass: 'border-blue-200 bg-blue-50 text-blue-700'
    };
  };

  const anomalyItems = launchMetrics?.anomalies ?? [];

  if (effectiveStatsError && !isStatsBlocked) {
    const message = (() => {
      if (effectiveStatsError instanceof FetchError) {
        const code = extractErrorCode(effectiveStatsError.body);

        if (code === 'ADMIN_API_DISABLED') {
          return t('dashboard.unavailable.adminDisabled');
        }
        if (code === 'BACKEND_NOT_CONFIGURED') {
          return t('dashboard.unavailable.backendNotConfigured');
        }

        if (effectiveStatsError.status === 403) {
          return t('dashboard.unavailable.forbidden');
        }
        if (effectiveStatsError.status === 401) {
          return t('dashboard.unavailable.unauthorized');
        }
        return effectiveStatsError.message;
      }
      return t('dashboard.unavailable.body');
    })();

    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTitle>{t('dashboard.unavailable.title')}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  if (!isStatsBlocked && (isLoading || !stats)) {
    return (
      <DashboardLayout>
        <div className="space-y-6" role="status" aria-label="Loading dashboard">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map(i => (
              <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-6">
                <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
                <div className="h-48 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
          <span className="sr-only">Loading dashboard data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {isWaking && !isWarm && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-amber-800">
            <span className="animate-spin" aria-hidden="true">⏳</span>
            <span>{t('status.checking')}</span>
          </div>
        )}
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {isStatsBlocked ? t('dashboard.autoRefresh.paused') : t('dashboard.autoRefresh.active')}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {t('dashboard.complianceBadge')}
            </Badge>
          </div>
        </div>

      {isStatsBlocked ? (
        <Alert>
          <AlertTitle>{t('dashboard.limited.title')}</AlertTitle>
          <AlertDescription>
            {(() => {
              if (statsError instanceof FetchError) {
                const code = extractErrorCode(statsError.body);
                if (code === 'BACKEND_NOT_CONFIGURED') {
                  return t('dashboard.stats.backendNotConfigured');
                }
              }
              return t('dashboard.limited.body');
            })()}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* System Warnings */}
      {displayStats.warnings && displayStats.warnings.length > 0 && (
        <Alert variant="default" className="border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <AlertTitle className="text-amber-900 font-semibold mb-2">{t('dashboard.warnings.title')}</AlertTitle>
              <AlertDescription className="text-amber-800">
                <div className="space-y-1.5">
                  {displayStats.warnings.map((warning, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-700 mt-3 italic">
                  {t('dashboard.warnings.body')}
                </p>
              </AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('dashboard.metric.totalUsers')}</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <UsersIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{(displayStats.totalUsers ?? 0).toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              {t('dashboard.metric.updated', { time: lastChecked || t('dashboard.metric.justNow') })}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('dashboard.metric.totalInvoices')}</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg">
              <InvoiceIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{(displayStats.totalInvoices ?? 0).toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              {t('dashboard.metric.updated', { time: lastChecked || t('dashboard.metric.justNow') })}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('dashboard.metric.totalPayments')}</CardTitle>
            <div className="p-2 bg-purple-50 rounded-lg">
              <PaymentIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{(displayStats.totalPayments ?? 0).toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              {t('dashboard.metric.trendUnavailable')}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('dashboard.metric.complianceRate')}</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <ComplianceIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{t('common.na')}</div>
            <p className="text-xs text-slate-500 mt-1">
              {t('dashboard.metric.complianceUnavailable')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* API Health Status */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.section.integrationHealth')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <HealthCard
            title={t('dashboard.integration.duplo.title')}
            status={displayStats.duploStatus}
            latency={displayStats.duploLatency}
            lastChecked={lastChecked}
            description={t('dashboard.integration.duplo.desc')}
          />
          <HealthCard
            title={t('dashboard.integration.remita.title')}
            status={displayStats.remitaStatus}
            latency={displayStats.remitaLatency}
            lastChecked={lastChecked}
            description={t('dashboard.integration.remita.desc')}
          />
        </div>
      </div>

      {/* Launch readiness and guardrails */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{t('launch.title')}</h2>
            <p className="text-sm text-slate-500">
              {t('dashboard.section.launch.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{t('dashboard.launch.targetNrr')}</Badge>
            <Badge variant="outline" className="text-xs">{t('dashboard.launch.targetGrr')}</Badge>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isStatsBlocked || launchMetricsError ? (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900">{t('dashboard.launch.unavailable.title')}</CardTitle>
                  <p className="text-sm text-slate-500">{t('dashboard.launch.unavailable.body')}</p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    {launchMetricsError?.message || t('dashboard.stats.blockedFallback')}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <LaunchMetricsWidget metrics={launchMetrics} isLoading={isLaunchMetricsLoading} />
            )}
          </div>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">{t('dashboard.risk.title')}</CardTitle>
                <Badge
                  variant={anomalyItems.length ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {anomalyItems.length
                    ? t('dashboard.risk.badge.open', { count: anomalyItems.length })
                    : t('dashboard.risk.badge.stable')}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t('dashboard.risk.subtitle')}</p>
            </CardHeader>
            <CardContent>
              {launchMetricsError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {t('dashboard.risk.unavailable', { message: launchMetricsError.message || t('dashboard.risk.retry') })}
                </div>
              ) : anomalyItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-700">
                  {t('dashboard.risk.none', { time: lastLaunchRefresh || t('dashboard.risk.now') })}
                </div>
              ) : (
                <ul className="space-y-3">
                  {anomalyItems.map((item, index) => {
                    const meta = classifyAnomaly(item);
                    return (
                      <li
                        key={`${item}-${index}`}
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50"
                      >
                        <div className={`rounded-full p-2 ${meta.iconBg}`}>
                          <svg
                            className={`w-4 h-4 ${meta.iconColor}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v4m0 4h.01M10.29 3.86l-7.4 12.8A1 1 0 003.7 18h16.6a1 1 0 00.86-1.52l-7.4-12.8a1 1 0 00-1.72 0z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{item}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {t('dashboard.risk.lastCheck', { time: lastLaunchRefresh || t('dashboard.risk.moments') })}
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-[11px] ${meta.badgeClass}`}>
                          {t(meta.labelKey)}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.section.charts.title')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Invoice Trends */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">{t('dashboard.invoiceTrends')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('dashboard.invoiceTrends.desc')}</p>
            </CardHeader>
            <CardContent>
              <InvoiceChart data={invoiceChartData} />
            </CardContent>
          </Card>

          {/* Payment Analytics */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">{t('dashboard.paymentAnalytics')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('dashboard.paymentAnalytics.desc')}</p>
            </CardHeader>
            <CardContent>
              <PaymentChart data={paymentChartData} />
            </CardContent>
          </Card>

          {/* Duplo Health */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">{t('dashboard.section.metrics.duplo.title')}</CardTitle>
              <p className="text-xs text-slate-500">{t('dashboard.section.metrics.duplo.desc')}</p>
            </CardHeader>
            <CardContent>
              <DuploHealthChart data={displayStats.duploSuccessTrend} />
            </CardContent>
          </Card>

          {/* Remita Transactions */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">{t('dashboard.section.metrics.remita.title')}</CardTitle>
              <p className="text-xs text-slate-500">{t('dashboard.section.metrics.remita.desc')}</p>
            </CardHeader>
            <CardContent>
              <RemitaTransactionChart data={displayStats.remitaTransactions} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div>
            <CardTitle className="text-base font-medium">{t('dashboard.section.activity.title')}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">{t('dashboard.section.activity.subtitle')}</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">{t('dashboard.section.activity.unavailable')}</p>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
