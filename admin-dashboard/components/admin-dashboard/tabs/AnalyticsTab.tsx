'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AdminEmptyState } from '@/components/admin-dashboard/ui/AdminEmptyState';
import { MetricCard } from '@/components/admin-dashboard/ui/MetricCard';
import { SectionHeader } from '@/components/admin-dashboard/ui/SectionHeader';
import { DuploHealthChart } from '@/components/charts/DuploHealthChart';
import { RemitaTransactionChart } from '@/components/charts/RemitaTransactionChart';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { RefreshCw, TrendingUp, Users, FileText, CreditCard, AlertTriangle, Download } from 'lucide-react';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';
import { chartColors } from '@/lib/colors';
import { downloadCsvFile, formatCompactNumber } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  fallback?: boolean;
  warnings?: string[];
  overview: {
    totalUsers: number;
    totalInvoices: number;
    totalPayments: number;
    complianceRate: number;
    monthlyGrowth: number;
  };
  duploMetrics: {
    successTrend: Array<{ timestamp: string; successRate: number; latency: number; submissions: number }>;
    errorBreakdown: Array<{ error: string; count: number; percentage: number }>;
    dailySubmissions: Array<{ date: string; successful: number; failed: number }>;
  };
  remitaMetrics: {
    transactionTrend: Array<{ date: string; successful: number; failed: number; pending: number; total: number }>;
    paymentBreakdown: Array<{ status: string; count: number; amount: number }>;
    dailyVolume: Array<{ date: string; volume: number; count: number }>;
  };
  complianceMetrics: {
    exemptionUtilization: Array<{ exemption: string; count: number; percentage: number }>;
    withholdingTaxTracking: Array<{ month: string; wthAmount: number; invoiceCount: number }>;
    nrsComplianceTrend: Array<{ date: string; compliant: number; nonCompliant: number }>;
  };
}

const DATE_RANGES = [
  { label: '7 days',  value: '7d'  },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
] as const;

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

const PIE_COLORS = [chartColors.success, chartColors.warning, chartColors.error, chartColors.info];

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyticsTab() {
  const { t } = useAdminI18n();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, error, isLoading, mutate } = useSWR<AnalyticsData>(
    `/api/admin/analytics?range=${dateRange}`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false },
  );

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to load analytics</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{error instanceof FetchError ? error.message : 'Unknown error'}</span>
          <Button size="sm" variant="outline" onClick={() => mutate()}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const ov = data?.overview;
  const duplo = data?.duploMetrics;
  const remita = data?.remitaMetrics;
  const compliance = data?.complianceMetrics;
  const hasDuploTrend = (duplo?.successTrend?.length ?? 0) > 0;
  const hasDuploSubmissions = (duplo?.dailySubmissions?.length ?? 0) > 0;
  const hasDuploErrors = (duplo?.errorBreakdown?.length ?? 0) > 0;
  const hasRemitaTrend = (remita?.transactionTrend?.length ?? 0) > 0;
  const hasRemitaVolume = (remita?.dailyVolume?.length ?? 0) > 0;
  const hasComplianceTrend = (compliance?.nrsComplianceTrend?.length ?? 0) > 0;
  const hasWithholdingTrend = (compliance?.withholdingTaxTracking?.length ?? 0) > 0;
  const exportDisabled = isLoading || !data || !!data.fallback;

  const handleExport = () => {
    if (!data || data.fallback) return;

    const rows: Array<Array<string | number>> = [
      ['Section', 'Metric', 'Value', 'Context'],
      ['Overview', 'Total Users', ov?.totalUsers ?? 0, dateRange],
      ['Overview', 'Total Invoices', ov?.totalInvoices ?? 0, dateRange],
      ['Overview', 'Total Payments', ov?.totalPayments ?? 0, dateRange],
      ['Overview', 'Compliance Rate (%)', ov?.complianceRate != null ? Number((ov.complianceRate * 100).toFixed(1)) : 0, dateRange],
      ['Overview', 'Monthly Growth (%)', ov?.monthlyGrowth ?? 0, dateRange],
      [],
      ['DigiTax Success Trend', 'Timestamp', 'Success Rate (%)', 'Latency (ms) / Submissions'],
      ...(duplo?.successTrend ?? []).map((point) => [
        'DigiTax Success Trend',
        point.timestamp,
        Number((point.successRate * 100).toFixed(1)),
        `${point.latency}ms / ${point.submissions}`,
      ]),
      [],
      ['DigiTax Errors', 'Error Type', 'Count', 'Percentage (%)'],
      ...(duplo?.errorBreakdown ?? []).map((item) => [
        'DigiTax Errors',
        item.error,
        item.count,
        Number(item.percentage.toFixed(1)),
      ]),
      [],
      ['Remita Volume', 'Date', 'Volume (NGN)', 'Count'],
      ...(remita?.dailyVolume ?? []).map((point) => [
        'Remita Volume',
        point.date,
        point.volume,
        point.count,
      ]),
      [],
      ['Compliance', 'Date/Month', 'Primary Value', 'Secondary Value'],
      ...(compliance?.nrsComplianceTrend ?? []).map((point) => [
        'Compliance Trend',
        point.date,
        point.compliant,
        point.nonCompliant,
      ]),
      ...(compliance?.withholdingTaxTracking ?? []).map((point) => [
        'Withholding Tax',
        point.month,
        point.wthAmount,
        point.invoiceCount,
      ]),
    ];

    downloadCsvFile(`taxbridge-analytics-${dateRange}.csv`, rows);
  };

  return (
    <div className="space-y-8 animate-slide-up">

      {/* Header toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Platform Analytics"
          description="Revenue, compliance, and integration performance metrics."
        />
        <div className="flex items-center gap-2">
          {/* Date range toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-900">
            {DATE_RANGES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setDateRange(value)}
                className={
                  value === dateRange
                    ? 'px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => mutate()}
            disabled={isLoading}
            aria-label="Refresh analytics"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Export analytics data"
            onClick={handleExport}
            disabled={exportDisabled}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {data?.fallback && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Showing cached data — live backend is unavailable.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Overview KPIs ── */}
      <section aria-label="Analytics overview">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Users"
            value={isLoading ? '—' : formatCompactNumber(ov?.totalUsers ?? 0)}
            loading={isLoading}
            icon={<Users className="h-5 w-5" />}
            iconVariant="blue"
            trend={ov?.monthlyGrowth != null ? { value: ov.monthlyGrowth, direction: ov.monthlyGrowth >= 0 ? 'up' : 'down', label: 'vs last month' } : undefined}
          />
          <MetricCard
            label="Total Invoices"
            value={isLoading ? '—' : formatCompactNumber(ov?.totalInvoices ?? 0)}
            loading={isLoading}
            icon={<FileText className="h-5 w-5" />}
            iconVariant="emerald"
          />
          <MetricCard
            label="Total Payments"
            value={isLoading ? '—' : formatCompactNumber(ov?.totalPayments ?? 0)}
            loading={isLoading}
            icon={<CreditCard className="h-5 w-5" />}
            iconVariant="violet"
          />
          <MetricCard
            label="Compliance Rate"
            value={isLoading ? '—' : ov?.complianceRate != null ? `${(ov.complianceRate * 100).toFixed(1)}%` : 'N/A'}
            loading={isLoading}
            icon={<TrendingUp className="h-5 w-5" />}
            iconVariant={ov?.complianceRate != null && ov.complianceRate >= 0.9 ? 'emerald' : 'amber'}
          />
        </div>
      </section>

      {/* ── DigiTax / Duplo metrics ── */}
      <section aria-label="DigiTax integration metrics">
        <SectionHeader
          title="DigiTax (Duplo) Integration"
          description="Submission success, error patterns, and throughput for NRS stamping operations."
          className="mb-4"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Success Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ) : !hasDuploTrend ? (
                <AdminEmptyState
                  title="No DigiTax trend data yet"
                  description="Success-rate history will appear here once submission activity is recorded for the selected period."
                  className="min-h-[12rem]"
                />
              ) : (
                <DuploHealthChart data={duplo?.successTrend ?? []} />
              )}
            </CardContent>
          </Card>

          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Daily Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ) : !hasDuploSubmissions ? (
                <AdminEmptyState
                  title="No submission volumes yet"
                  description="Daily successful and failed submissions will appear here after invoices begin flowing through DigiTax."
                  className="min-h-[12rem]"
                />
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <BarChart data={duplo?.dailySubmissions ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="successful" fill={chartColors.success} radius={[3, 3, 0, 0]} name="Successful" />
                    <Bar dataKey="failed"     fill={chartColors.error}   radius={[3, 3, 0, 0]} name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Error Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ) : !hasDuploErrors ? (
                <AdminEmptyState
                  title="No submission errors recorded"
                  description="When DigiTax rejects or fails submissions, the reason mix will appear here for exception review."
                  className="min-h-[12rem]"
                />
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <PieChart>
                    <Pie
                      data={duplo!.errorBreakdown}
                      dataKey="count"
                      nameKey="error"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }: { name: string; percent: number }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {duplo!.errorBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Remita metrics ── */}
      <section aria-label="Remita integration metrics">
        <SectionHeader
          title="Remita Payment Rail"
          description="Track payment activity, throughput, and value movement across the remittance rail."
          className="mb-4"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Transaction Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ) : !hasRemitaTrend ? (
                <AdminEmptyState
                  title="No Remita transaction trend yet"
                  description="Payment outcomes will appear here once remittance events are recorded for the selected period."
                  className="min-h-[12rem]"
                />
              ) : (
                <RemitaTransactionChart data={remita?.transactionTrend ?? []} />
              )}
            </CardContent>
          </Card>

          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Daily Volume (₦)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ) : !hasRemitaVolume ? (
                <AdminEmptyState
                  title="No payment volume recorded"
                  description="Daily processed amount will appear here once Remita settlements are flowing through the platform."
                  className="min-h-[12rem]"
                />
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <LineChart data={remita?.dailyVolume ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Volume']}
                    />
                    <Line type="monotone" dataKey="volume" stroke={chartColors.info} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Compliance metrics ── */}
      <section aria-label="Compliance analytics">
        <SectionHeader
          title="NRS Compliance Metrics"
          description="Spot filing performance, non-compliance risk, and withholding-tax movement at a glance."
          className="mb-4"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">NRS Compliance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ) : !hasComplianceTrend ? (
                <AdminEmptyState
                  title="No compliance trend available"
                  description="Compliant versus non-compliant invoice history will appear here as filing data accumulates."
                  className="min-h-[12rem]"
                />
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <BarChart data={compliance?.nrsComplianceTrend ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="compliant"    fill={chartColors.success} radius={[3, 3, 0, 0]} name="Compliant" />
                    <Bar dataKey="nonCompliant" fill={chartColors.error}   radius={[3, 3, 0, 0]} name="Non-Compliant" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Withholding Tax Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              ) : !hasWithholdingTrend ? (
                <AdminEmptyState
                  title="No withholding-tax history yet"
                  description="Monthly withholding-tax totals will appear here once invoices with WHT activity are recorded."
                  className="min-h-[12rem]"
                />
              ) : (
                <ResponsiveContainer width="100%" height={192}>
                  <LineChart data={compliance?.withholdingTaxTracking ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [`₦${v.toLocaleString()}`, 'WHT Amount']}
                    />
                    <Line type="monotone" dataKey="wthAmount" stroke={chartColors.warning} strokeWidth={2} dot={false} name="WHT" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
