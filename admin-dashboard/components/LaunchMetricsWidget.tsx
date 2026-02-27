'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminI18n } from '@/lib/i18n';
import { safeDate } from '@/lib/utils';

export interface LaunchMetricsData {
  timestamp: string;
  window: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  mrr: number;
  mrrPrev: number;
  paidUsers: number;
  paidUsersPrev: number;
  nrr: number;
  grr: number;
  churnedUsers: number;
  expansionRevenue: number;
  contractionRevenue: number;
  newRevenue: number;
  anomalies: string[];
  warnings?: string[];
}

interface LaunchMetricsWidgetProps {
  metrics?: LaunchMetricsData;
  isLoading?: boolean;
}

type StatusState = 'healthy' | 'watch' | 'risk';

const statusStyles: Record<StatusState, string> = {
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  risk: 'bg-rose-50 text-rose-700 border-rose-200'
};

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

function formatCurrency(value?: number) {
  return currencyFormatter.format(Math.max(0, value || 0));
}

function formatPercent(value?: number) {
  if (value === undefined || Number.isNaN(value)) {
    return '0.0%';
  }
  return `${percentFormatter.format(value)}%`;
}

function formatDelta(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return '0 pts';
  }
  const sign = value > 0 ? '+' : '−';
  const magnitude = Math.abs(value);
  return `${sign}${percentFormatter.format(magnitude)} pts`;
}

function formatPercentChange(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return '0%';
  }
  const sign = value > 0 ? '+' : '−';
  const magnitude = Math.abs(value);
  return `${sign}${percentFormatter.format(magnitude)}%`;
}

function getStatus(value: number, thresholds: { healthy: number; watch: number }): StatusState {
  if (value >= thresholds.healthy) return 'healthy';
  if (value >= thresholds.watch) return 'watch';
  return 'risk';
}

function formatWindowRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${safeDate(start, opts)} – ${safeDate(end, opts)}`;
}

const MetricTile = ({
  label,
  value,
  subtitle,
  status,
  badgeText,
}: {
  label: string;
  value: string;
  subtitle: string;
  status: StatusState;
  badgeText: string;
}) => (
  <div className="p-4 border rounded-xl bg-white shadow-sm">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <Badge variant="outline" className={`text-[11px] border ${statusStyles[status]}`}>
        {badgeText}
      </Badge>
    </div>
    <p className="text-3xl font-semibold text-slate-900">{value}</p>
    <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
  </div>
);

export function LaunchMetricsWidget({ metrics, isLoading }: LaunchMetricsWidgetProps) {
  const { t } = useAdminI18n();

  if (isLoading || !metrics) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">{t('launch.title')}</CardTitle>
          <p className="text-sm text-slate-500">{t('launch.loading')}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 animate-pulse">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-xl bg-slate-200" />
            ))}
          </div>
          <div className="mt-6 h-28 rounded-xl bg-slate-200 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const nrrStatus = getStatus(metrics.nrr, { healthy: 110, watch: 100 });
  const grrStatus = getStatus(metrics.grr, { healthy: 95, watch: 90 });
  const mrrGrowth = metrics.mrrPrev > 0 ? ((metrics.mrr - metrics.mrrPrev) / metrics.mrrPrev) * 100 : 0;
  const paidUserGrowth = metrics.paidUsersPrev > 0
    ? ((metrics.paidUsers - metrics.paidUsersPrev) / metrics.paidUsersPrev) * 100
    : metrics.paidUsers > 0
      ? 100
      : 0;
  const mrrStatus = getStatus(mrrGrowth, { healthy: 10, watch: 0 });
  const userStatus = getStatus(100 - (metrics.churnedUsers / Math.max(metrics.paidUsersPrev || 1, 1)) * 100, {
    healthy: 97,
    watch: 94
  });

  // Guard against missing window data during cold-start (admin resilience pattern)
  const windowLabel = metrics.window?.current
    ? formatWindowRange(metrics.window.current.start, metrics.window.current.end)
    : '';

  const statusBadgeText = (status: StatusState) =>
    status === 'healthy'
      ? t('launch.badge.healthy')
      : status === 'watch'
        ? t('launch.badge.watch')
        : t('launch.badge.risk');

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">{t('launch.title')}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {t('launch.window', { window: windowLabel })}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">{t('launch.realtime')}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warnings Display */}
        {metrics.warnings && metrics.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-900">{t('dashboard.warnings.dataTitle')}</p>
                <div className="mt-1 space-y-0.5">
                  {metrics.warnings.map((warning, idx) => (
                    <p key={idx} className="text-xs text-amber-800">• {t(`dashboard.warnings.code.${warning}` as Parameters<typeof t>[0], { defaultValue: warning })}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label={t('launch.tile.nrr')}
            value={formatPercent(metrics.nrr)}
            subtitle={t('launch.delta.vsGoal', { delta: formatDelta(metrics.nrr - 106) })}
            status={nrrStatus}
            badgeText={statusBadgeText(nrrStatus)}
          />
          <MetricTile
            label={t('launch.tile.grr')}
            value={formatPercent(metrics.grr)}
            subtitle={t('launch.delta.vsGuardrail', { delta: formatDelta(metrics.grr - 90) })}
            status={grrStatus}
            badgeText={statusBadgeText(grrStatus)}
          />
          <MetricTile
            label={t('launch.tile.mrr')}
            value={formatCurrency(metrics.mrr)}
            subtitle={t('launch.delta.vsLastMonth', { delta: formatPercentChange(mrrGrowth) })}
            status={mrrStatus}
            badgeText={statusBadgeText(mrrStatus)}
          />
          <MetricTile
            label={t('launch.tile.paid')}
            value={(metrics.paidUsers ?? 0).toLocaleString()}
            subtitle={t('launch.delta.vsLastMonth', { delta: formatPercentChange(paidUserGrowth) })}
            status={userStatus}
            badgeText={statusBadgeText(userStatus)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="p-4 rounded-xl border bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('launch.drivers.title')}</p>
            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <dt>{t('launch.drivers.expansion')}</dt>
                <dd className="font-medium text-emerald-600">{formatCurrency(metrics.expansionRevenue)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>{t('launch.drivers.new')}</dt>
                <dd className="font-medium text-blue-600">{formatCurrency(metrics.newRevenue)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>{t('launch.drivers.contraction')}</dt>
                <dd className="font-medium text-amber-600">{formatCurrency(metrics.contractionRevenue)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>{t('launch.drivers.churn')}</dt>
                <dd className="font-medium text-rose-600">{(metrics.churnedUsers ?? 0).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('launch.comparison.title')}</p>
            <div className="mt-4 grid gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t('launch.comparison.currentWindow')}</span>
                <span className="font-medium text-slate-900">{windowLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t('launch.comparison.previousMrr')}</span>
                <span className="font-medium">{formatCurrency(metrics.mrrPrev)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t('launch.comparison.previousPaid')}</span>
                <span className="font-medium">{(metrics.paidUsersPrev ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t('launch.comparison.lastRefresh')}</span>
                <span className="font-medium">{safeDate(metrics.timestamp, { timeStyle: 'short' })}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
