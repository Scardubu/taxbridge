import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { useAdminI18n } from '@/lib/i18n';

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

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      status === 'error' ? 'border-red-200 bg-red-50/50' : 
      status === 'degraded' ? 'border-yellow-200 bg-yellow-50/50' : 
      'border-green-200 bg-green-50/30'
    }`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-700">{title}</CardTitle>
        <div className="flex items-center space-x-2">
          {getStatusIcon(status)}
          <Badge variant={getStatusVariant(status)} className="text-xs font-semibold">
            {t(`healthcard.badge.${status}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${getLatencyColor(latency)}`}>
          {formatLatencyDisplay(latency)}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {description || getStatusMessage(status)}
        </p>
        {lastChecked && (
          <p className="text-xs text-slate-500 mt-2">
            {t('healthcard.latency.lastChecked', { time: lastChecked })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
