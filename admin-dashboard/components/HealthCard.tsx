import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HealthCardProps {
  title: string;
  status: 'healthy' | 'degraded' | 'error';
  latency?: number | null;
  lastChecked?: string;
  description?: string;
}

export function HealthCard({ title, status, latency, lastChecked, description }: HealthCardProps) {
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
    isLatencyDefined(latency) ? `${latency}ms` : 'N/A';

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'All systems operational';
      case 'degraded':
        return 'Performance degraded';
      case 'error':
        return 'Service unavailable';
      default:
        return 'Unknown status';
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
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)} animate-pulse`} />
          <Badge variant={getStatusVariant(status)} className="text-xs font-semibold">
            {status.toUpperCase()}
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
            Latency • Last checked {lastChecked}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
