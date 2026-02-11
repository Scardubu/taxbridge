'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Database,
  HardDrive,
  Wifi,
  Zap,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface SystemMetric {
  label: string;
  value: number;
  max: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  latency?: number;
  message?: string;
}

interface SystemHealthCardProps {
  title: string;
  description?: string;
  metrics?: SystemMetric[];
  services?: ServiceStatus[];
  variant?: 'metrics' | 'services' | 'combined';
}

// =============================================================================
// Helpers
// =============================================================================

const statusIcon = (status: string) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'degraded':
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'error':
    case 'critical':
      return <XCircle className="w-4 h-4 text-rose-500" />;
    default:
      return <Activity className="w-4 h-4 text-slate-400" />;
  }
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'degraded':
    case 'warning':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'error':
    case 'critical':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const progressColor = (status: string) => {
  switch (status) {
    case 'healthy':
      return '[&>div]:bg-emerald-500';
    case 'warning':
      return '[&>div]:bg-amber-500';
    case 'critical':
      return '[&>div]:bg-rose-500';
    default:
      return '[&>div]:bg-slate-400';
  }
};

const serviceIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('database') || lower.includes('postgres') || lower.includes('prisma'))
    return <Database className="w-4 h-4 text-slate-500" />;
  if (lower.includes('redis') || lower.includes('cache'))
    return <Zap className="w-4 h-4 text-slate-500" />;
  if (lower.includes('disk') || lower.includes('storage'))
    return <HardDrive className="w-4 h-4 text-slate-500" />;
  if (lower.includes('network') || lower.includes('api') || lower.includes('http'))
    return <Wifi className="w-4 h-4 text-slate-500" />;
  return <Activity className="w-4 h-4 text-slate-500" />;
};

// =============================================================================
// Component
// =============================================================================

export function SystemHealthCard({
  title,
  description,
  metrics,
  services,
  variant = 'combined',
}: SystemHealthCardProps) {
  const showMetrics = variant === 'metrics' || variant === 'combined';
  const showServices = variant === 'services' || variant === 'combined';

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-xs text-slate-500">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metrics section */}
        {showMetrics && metrics && metrics.length > 0 && (
          <div className="space-y-3">
            {metrics.map((metric) => {
              const pct = metric.max > 0 ? (metric.value / metric.max) * 100 : 0;
              return (
                <div key={metric.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      {statusIcon(metric.status)}
                      {metric.label}
                    </span>
                    <span className="font-medium text-slate-900">
                      {metric.value}{metric.unit}
                      <span className="text-slate-400 font-normal"> / {metric.max}{metric.unit}</span>
                    </span>
                  </div>
                  <Progress
                    value={Math.min(pct, 100)}
                    className={`h-1.5 ${progressColor(metric.status)}`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        {showMetrics && showServices && metrics && metrics.length > 0 && services && services.length > 0 && (
          <div className="border-t border-slate-100" />
        )}

        {/* Services section */}
        {showServices && services && services.length > 0 && (
          <div className="space-y-2">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-50/50"
              >
                <div className="flex items-center gap-2">
                  {serviceIcon(svc.name)}
                  <span className="text-sm text-slate-700">{svc.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {svc.latency !== undefined && (
                    <span className={`text-xs font-mono ${
                      svc.latency < 200 ? 'text-emerald-600' :
                      svc.latency < 500 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {svc.latency}ms
                    </span>
                  )}
                  <Badge className={`text-[10px] px-1.5 py-0 ${statusBadgeClass(svc.status)}`}>
                    {svc.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {(!metrics || metrics.length === 0) && (!services || services.length === 0) && (
          <p className="text-sm text-slate-400 text-center py-4">No data available</p>
        )}
      </CardContent>
    </Card>
  );
}
