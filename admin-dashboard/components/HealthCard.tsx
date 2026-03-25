import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { useAdminI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface HealthCardProps {
  title: string;
  status: 'healthy' | 'degraded' | 'error';
  latency?: number | null;
  lastChecked?: string;
  description?: string;
}

export function HealthCard({ title, status, latency, lastChecked, description }: HealthCardProps) {
  const { t } = useAdminI18n();
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />;
      case 'degraded':
        return <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" aria-hidden="true" />;
      case 'error':
        return <XCircle className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />;
      default:
        return <HelpCircle className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'degraded':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const isLatencyDefined = (value: number | null | undefined): value is number =>
    value !== null && value !== undefined;

  const getLatencyColor = (latency: number | null | undefined) => {
    if (!isLatencyDefined(latency)) return 'text-slate-600';
    if (latency < 200) return 'text-green-600';
    if (latency < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatLatencyDisplay = (latency: number | null | undefined) =>
    isLatencyDefined(latency) ? `${latency}ms` : t('healthcard.latency.na');

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'healthy':
        return t('healthcard.status.healthy');
      case 'degraded':
        return t('healthcard.status.degraded');
      case 'error':
        return t('healthcard.status.error');
      default:
        return t('healthcard.status.unknown');
    }
  };

  const statusTone =
    status === 'error'
      ? 'border-rose-200/80 bg-rose-50/70'
      : status === 'degraded'
        ? 'border-amber-200/80 bg-amber-50/70'
        : 'border-emerald-200/80 bg-emerald-50/50';

  return (
    <Card className={cn('overflow-hidden', statusTone)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Integration</p>
          <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon(status)}
          <Badge variant={getStatusVariant(status)} className="text-[11px] font-semibold">
            {t(`healthcard.badge.${status}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div data-numeric="true" className={`text-3xl font-semibold tracking-[-0.03em] ${getLatencyColor(latency)}`}>
          {formatLatencyDisplay(latency)}
        </div>
        <p className="text-sm text-muted-foreground leading-6">
          {description || getStatusMessage(status)}
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-white/60 pt-3 text-xs text-slate-500">
          <span>{getStatusMessage(status)}</span>
          {lastChecked && (
            <span data-numeric="true">{t('healthcard.latency.lastChecked', { time: lastChecked })}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
