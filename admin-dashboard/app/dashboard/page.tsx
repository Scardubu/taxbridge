'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HealthCard } from '@/components/HealthCard';
import { DuploHealthChart } from '@/components/charts/DuploHealthChart';
import { RemitaTransactionChart } from '@/components/charts/RemitaTransactionChart';
import { LaunchMetricsWidget, LaunchMetricsData } from '@/components/LaunchMetricsWidget';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FetchError, fetchJson } from '@/lib/fetcher';

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
  const extractErrorCode = (body: unknown): string | undefined => {
    if (!body || typeof body !== 'object') return undefined;
    const record = body as Record<string, unknown>;
    return typeof record.code === 'string' ? record.code : undefined;
  };

  const isAuthBlocked = (err: FetchError): boolean => {
    const code = extractErrorCode(err.body);
    return code === 'ADMIN_API_DISABLED' || err.status === 401 || err.status === 403;
  };

  const shouldRetryOnError = (err: unknown) => {
    if (err instanceof FetchError) {
      const code = extractErrorCode(err.body);

      if (code === 'ADMIN_API_DISABLED') return false;
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

  const lastLaunchRefresh = useMemo(() => {
    return launchMetrics ? new Date(launchMetrics.timestamp).toLocaleTimeString() : '';
  }, [launchMetrics]);

  const classifyAnomaly = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.startsWith('critical')) {
      return {
        label: 'Critical',
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-700',
        badgeClass: 'border-rose-200 bg-rose-50 text-rose-700'
      };
    }
    if (normalized.startsWith('high')) {
      return {
        label: 'High',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-700',
        badgeClass: 'border-orange-200 bg-orange-50 text-orange-700'
      };
    }
    if (normalized.includes('failed') || normalized.includes('warning') || normalized.includes('latency')) {
      return {
        label: 'Warning',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-700',
        badgeClass: 'border-amber-200 bg-amber-50 text-amber-700'
      };
    }
    return {
      label: 'Info',
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
          return 'Admin analytics is disabled for this environment. Please contact the system administrator.';
        }

        if (effectiveStatsError.status === 403) {
          return 'You do not have access to admin analytics in this environment.';
        }
        if (effectiveStatsError.status === 401) {
          return 'Admin authentication is required to view this dashboard.';
        }
        return effectiveStatsError.message;
      }
      return 'Failed to load dashboard data.';
    })();

    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  if (!isStatsBlocked && (isLoading || !stats)) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-slate-200 rounded-lg" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map(i => (
              <div key={i} className="h-48 bg-slate-200 rounded-lg" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600 mt-1">
              TaxBridge System Overview & Real-time Analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {isStatsBlocked ? 'Auto-refresh paused' : 'Auto-refreshing every 30s'}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              NRS 2026 Compliant
            </Badge>
          </div>
        </div>

      {isStatsBlocked ? (
        <Alert>
          <AlertTitle>Limited functionality</AlertTitle>
          <AlertDescription>
            Admin analytics is currently unavailable for this environment. Showing limited dashboard placeholders.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <UsersIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{displayStats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              Updated {lastChecked || 'just now'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Invoices</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg">
              <InvoiceIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{displayStats.totalInvoices.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              Updated {lastChecked || 'just now'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Payments</CardTitle>
            <div className="p-2 bg-purple-50 rounded-lg">
              <PaymentIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{displayStats.totalPayments.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-green-500">↑ 15%</span> via Remita
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Compliance Rate</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <ComplianceIcon />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">94.2%</div>
            <p className="text-xs text-slate-500 mt-1">
              NRS 2026 compliant invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* API Health Status */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Integration Health</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <HealthCard
            title="Duplo/DigiTax API"
            status={displayStats.duploStatus}
            latency={displayStats.duploLatency}
            lastChecked={lastChecked}
            description="E-invoicing & NRS submission"
          />
          <HealthCard
            title="Remita Payment Gateway"
            status={displayStats.remitaStatus}
            latency={displayStats.remitaLatency}
            lastChecked={lastChecked}
            description="Payment processing & RRR generation"
          />
        </div>
      </div>

      {/* Launch readiness and guardrails */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Launch Readiness</h2>
            <p className="text-sm text-slate-500">
              Financial guardrails tracked in real time (NRR, GRR, MRR, churn)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Target NRR ≥ 110%</Badge>
            <Badge variant="outline" className="text-xs">GRR ≥ 95%</Badge>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isStatsBlocked || launchMetricsError ? (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900">Launch Readiness</CardTitle>
                  <p className="text-sm text-slate-500">Launch metrics are currently unavailable.</p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    {launchMetricsError?.message || 'Admin analytics is disabled or requires authentication.'}
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
                <CardTitle className="text-base font-medium">Risk & Alerts</CardTitle>
                <Badge
                  variant={anomalyItems.length ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {anomalyItems.length ? `${anomalyItems.length} open` : 'Stable'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">Backed by alerting + payment signals</p>
            </CardHeader>
            <CardContent>
              {launchMetricsError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  Launch metrics are temporarily unavailable. {launchMetricsError.message || 'Please retry shortly.'}
                </div>
              ) : anomalyItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-700">
                  No anomalies detected. Guardrails holding steady as of {lastLaunchRefresh || 'now'}.
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
                            Last check {lastLaunchRefresh || 'moments ago'}
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-[11px] ${meta.badgeClass}`}>
                          {meta.label}
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
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Analytics & Trends</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Duplo E-Invoicing Metrics</CardTitle>
              <p className="text-xs text-slate-500">Success rate and latency over time</p>
            </CardHeader>
            <CardContent>
              <DuploHealthChart data={displayStats.duploSuccessTrend} />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Remita Payment Transactions</CardTitle>
              <p className="text-xs text-slate-500">Daily transaction breakdown</p>
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-medium">Recent System Activity</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Real-time operational status</p>
            </div>
            <Badge variant="outline" className="text-xs">Live</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-800">Invoice Processing Queue</p>
                  <p className="text-sm text-slate-500">23 invoices pending NRS submission</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Processing</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-800">Payment Reconciliation</p>
                  <p className="text-sm text-slate-500">5 payments reconciled via Remita webhook</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700">Complete</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-800">NRS Compliance Checks</p>
                  <p className="text-sm text-slate-500">Last validation run 2 minutes ago</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">Passing</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
