import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  const format = new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric' });
  return `${format.format(new Date(start))} – ${format.format(new Date(end))}`;
}

const MetricTile = ({
  label,
  value,
  subtitle,
  status
}: {
  label: string;
  value: string;
  subtitle: string;
  status: StatusState;
}) => (
  <div className="p-4 border rounded-xl bg-white shadow-sm">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <Badge variant="outline" className={`text-[11px] border ${statusStyles[status]}`}>
        {status === 'healthy' ? 'Healthy' : status === 'watch' ? 'Monitor' : 'Risk'}
      </Badge>
    </div>
    <p className="text-3xl font-semibold text-slate-900">{value}</p>
    <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
  </div>
);

export function LaunchMetricsWidget({ metrics, isLoading }: LaunchMetricsWidgetProps) {
  if (isLoading || !metrics) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">Launch Readiness</CardTitle>
          <p className="text-sm text-slate-500">Loading latest retention and MRR data…</p>
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

  const windowLabel = formatWindowRange(metrics.window.current.start, metrics.window.current.end);

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Launch Readiness</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Monitoring guardrails for {windowLabel}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">Realtime</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Net Revenue Retention"
            value={formatPercent(metrics.nrr)}
            subtitle={`${formatDelta(metrics.nrr - 106)} vs 106% goal`}
            status={nrrStatus}
          />
          <MetricTile
            label="Gross Revenue Retention"
            value={formatPercent(metrics.grr)}
            subtitle={`${formatDelta(metrics.grr - 90)} vs guardrail`}
            status={grrStatus}
          />
          <MetricTile
            label="Monthly Recurring Revenue"
            value={formatCurrency(metrics.mrr)}
            subtitle={`${formatPercentChange(mrrGrowth)} vs last month`}
            status={mrrStatus}
          />
          <MetricTile
            label="Paid Accounts"
            value={metrics.paidUsers.toLocaleString()}
            subtitle={`${formatPercentChange(paidUserGrowth)} vs last month`}
            status={userStatus}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="p-4 rounded-xl border bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue Drivers</p>
            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <dt>Expansion</dt>
                <dd className="font-medium text-emerald-600">{formatCurrency(metrics.expansionRevenue)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>New MRR</dt>
                <dd className="font-medium text-blue-600">{formatCurrency(metrics.newRevenue)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Contraction</dt>
                <dd className="font-medium text-amber-600">{formatCurrency(metrics.contractionRevenue)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Churned Accounts</dt>
                <dd className="font-medium text-rose-600">{metrics.churnedUsers.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="p-4 rounded-xl border bg-white">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Window Comparison</p>
            <div className="mt-4 grid gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Current window</span>
                <span className="font-medium text-slate-900">{windowLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Previous MRR</span>
                <span className="font-medium">{formatCurrency(metrics.mrrPrev)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Previous paid accounts</span>
                <span className="font-medium">{metrics.paidUsersPrev.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Last refresh</span>
                <span className="font-medium">{new Date(metrics.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
