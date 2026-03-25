'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { safeDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { MetricCard } from '@/components/admin-dashboard/ui/MetricCard';
import { StatusPill } from '@/components/admin-dashboard/ui/StatusPill';
import { SectionHeader } from '@/components/admin-dashboard/ui/SectionHeader';
import {
  Shield, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Clock, FileCheck, AlertCircle, TrendingUp, Calendar, Building2,
} from 'lucide-react';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComplianceData {
  overview: {
    complianceRate: number;
    totalInvoices: number;
    compliantInvoices: number;
    pendingReview: number;
    nonCompliant: number;
  };
  nrsStatus: {
    status: 'connected' | 'mock' | 'error';
    lastSync?: string;
    pendingSubmissions: number;
  };
  recentIssues: Array<{
    id: string;
    type: 'missing_tin' | 'invalid_amount' | 'format_error' | 'submission_failed';
    description: string;
    invoiceId: string;
    createdAt: string;
    resolved: boolean;
  }>;
  exemptionStats: Array<{
    exemption: string;
    count: number;
    percentage: number;
  }>;
}

const PERIODS = [
  { label: '7 days',  value: '7d'  },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
] as const;

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

function extractCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const r = body as Record<string, unknown>;
  return typeof r.code === 'string' ? r.code : undefined;
}

const issueTypeConfig = {
  missing_tin:       { label: 'Missing TIN',        icon: AlertCircle,   color: 'text-amber-600'  },
  invalid_amount:    { label: 'Invalid Amount',      icon: AlertTriangle, color: 'text-rose-600'   },
  format_error:      { label: 'Format Error',        icon: XCircle,       color: 'text-rose-600'   },
  submission_failed: { label: 'Submission Failed',   icon: AlertTriangle, color: 'text-rose-600'   },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function ComplianceTab() {
  const { t } = useAdminI18n();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, error, isLoading, mutate } = useSWR<ComplianceData>(
    `/api/admin/compliance?period=${period}`,
    fetcher,
    {
      refreshInterval: 300_000,
      shouldRetryOnError: (err) => {
        if (err instanceof FetchError) {
          const code = extractCode(err.body);
          if (code === 'ADMIN_API_DISABLED' || code === 'BACKEND_NOT_CONFIGURED') return false;
          if (err.status === 401 || err.status === 403) return false;
          return err.status >= 500;
        }
        return true;
      },
      errorRetryCount: 3,
      revalidateOnFocus: false,
    },
  );

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to load compliance data</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{error instanceof FetchError ? error.message : 'Unknown error'}</span>
          <Button size="sm" variant="outline" onClick={() => mutate()}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const ov = data?.overview;
  const nrs = data?.nrsStatus;
  const compliancePct = ov ? Math.round(ov.complianceRate * 100) : 0;

  return (
    <div className="space-y-8 animate-slide-up">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="NRS Compliance"
          description="Invoice compliance status, NRS connection health, and recent issues."
        />
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            {PERIODS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className={
                  value === period
                    ? 'px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => mutate()} disabled={isLoading} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <section aria-label="Compliance overview">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Compliance Rate"
            value={isLoading ? '—' : `${compliancePct}%`}
            loading={isLoading}
            icon={<Shield className="h-5 w-5" />}
            iconVariant={compliancePct >= 90 ? 'emerald' : compliancePct >= 75 ? 'amber' : 'rose'}
          />
          <MetricCard
            label="Compliant Invoices"
            value={isLoading ? '—' : (ov?.compliantInvoices ?? 0).toLocaleString()}
            loading={isLoading}
            icon={<CheckCircle2 className="h-5 w-5" />}
            iconVariant="emerald"
          />
          <MetricCard
            label="Pending Review"
            value={isLoading ? '—' : (ov?.pendingReview ?? 0).toLocaleString()}
            loading={isLoading}
            icon={<Clock className="h-5 w-5" />}
            iconVariant="amber"
          />
          <MetricCard
            label="Non-Compliant"
            value={isLoading ? '—' : (ov?.nonCompliant ?? 0).toLocaleString()}
            loading={isLoading}
            icon={<XCircle className="h-5 w-5" />}
            iconVariant="rose"
          />
        </div>
      </section>

      {/* ── NRS connection status ── */}
      <section aria-label="NRS connection status">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">NRS Connection Status</CardTitle>
              {nrs && (
                <StatusPill
                  status={nrs.status === 'connected' ? 'healthy' : nrs.status === 'mock' ? 'degraded' : 'error'}
                  label={nrs.status === 'connected' ? 'Connected' : nrs.status === 'mock' ? 'Mock Mode' : 'Error'}
                  pulse={nrs.status === 'connected'}
                  size="md"
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="tb-label mb-1">Status</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                    {nrs?.status ?? 'Unknown'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="tb-label mb-1">Last Sync</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {nrs?.lastSync ? safeDate(nrs.lastSync, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="tb-label mb-1">Pending Submissions</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100" data-numeric="true">
                    {(nrs?.pendingSubmissions ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Compliance rate bar ── */}
      {!isLoading && ov && (
        <section aria-label="Compliance rate breakdown">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Invoice Compliance Rate</CardTitle>
                <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100"
                  data-numeric="true">
                  {compliancePct}%
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={compliancePct}
                className="h-2.5"
                aria-label={`Compliance rate: ${compliancePct}%`}
              />
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950">
                  <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm tabular-nums">
                    {ov.compliantInvoices.toLocaleString()}
                  </p>
                  <p className="text-emerald-600 dark:text-emerald-400">Compliant</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950">
                  <p className="font-bold text-amber-700 dark:text-amber-300 text-sm tabular-nums">
                    {ov.pendingReview.toLocaleString()}
                  </p>
                  <p className="text-amber-600 dark:text-amber-400">Pending</p>
                </div>
                <div className="rounded-lg bg-rose-50 p-2 dark:bg-rose-950">
                  <p className="font-bold text-rose-700 dark:text-rose-300 text-sm tabular-nums">
                    {ov.nonCompliant.toLocaleString()}
                  </p>
                  <p className="text-rose-600 dark:text-rose-400">Non-Compliant</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Recent issues ── */}
      <section aria-label="Recent compliance issues">
        <SectionHeader title="Recent Issues" className="mb-4" />
        <Card>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : !data?.recentIssues?.length ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                <FileCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  No compliance issues in the selected period.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentIssues.map((issue) => {
                  const cfg = issueTypeConfig[issue.type] ?? { label: issue.type, icon: AlertCircle, color: 'text-slate-600' };
                  const IssueIcon = cfg.icon;
                  return (
                    <li
                      key={issue.id}
                      className="flex items-start gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <IssueIcon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.color}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{cfg.label}</p>
                          <StatusPill status={issue.resolved ? 'success' : 'warning'} label={issue.resolved ? 'Resolved' : 'Open'} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {issue.description} · Invoice #{issue.invoiceId}
                        </p>
                      </div>
                      <time
                        className="shrink-0 text-xs text-slate-400 dark:text-slate-500"
                        dateTime={issue.createdAt}
                      >
                        {safeDate(issue.createdAt, { dateStyle: 'short' })}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Exemption stats ── */}
      {(data?.exemptionStats?.length ?? 0) > 0 && (
        <section aria-label="Exemption statistics">
          <SectionHeader title="Exemption Utilization" className="mb-4" />
          <Card>
            <CardContent className="pt-4">
              <ul className="space-y-3">
                {data!.exemptionStats.map((stat) => (
                  <li key={stat.exemption} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {stat.exemption}
                      </span>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {stat.count.toLocaleString()} ({stat.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={stat.percentage} className="h-1.5" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
