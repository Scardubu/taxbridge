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
  RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Server, Database, Wifi, HardDrive, Activity,
  Clock, Zap, Globe, AlertCircle,
} from 'lucide-react';
import { FetchError, fetchJson } from '@/lib/fetcher';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'error';
  services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'error';
    latency?: number;
    message?: string;
    lastCheck: string;
  }>;
  metrics: {
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    activeConnections: number;
  };
  integrations: {
    digitax: { status: 'connected' | 'mock' | 'error'; latency?: number };
    remita:  { status: 'connected' | 'mock' | 'error'; latency?: number };
    supabase: { status: 'connected' | 'error'; latency?: number };
    redis:    { status: 'connected' | 'error'; latency?: number };
  };
  recentEvents: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

function extractCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const r = body as Record<string, unknown>;
  return typeof r.code === 'string' ? r.code : undefined;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const serviceIcons: Record<string, React.ElementType> = {
  'API Server': Server,
  'Database':   Database,
  'Cache':      Zap,
  'Job Queue':  Activity,
  default:      Globe,
};

const integrationNames: Record<string, string> = {
  digitax:  'DigiTax (NRS)',
  remita:   'Remita',
  supabase: 'Database',
  redis:    'Cache',
};

const eventTypeColors = {
  info:    'text-blue-600   bg-blue-50   border-blue-100   dark:bg-blue-950   dark:border-blue-900   dark:text-blue-300',
  warning: 'text-amber-600  bg-amber-50  border-amber-100  dark:bg-amber-950  dark:border-amber-900  dark:text-amber-300',
  error:   'text-rose-600   bg-rose-50   border-rose-100   dark:bg-rose-950   dark:border-rose-900   dark:text-rose-300',
};

const eventTypeIcons = {
  info:    AlertCircle,
  warning: AlertTriangle,
  error:   XCircle,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SystemTab() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, error, isLoading, mutate } = useSWR<SystemHealth>(
    '/api/admin/health',
    fetcher,
    {
      refreshInterval: autoRefresh ? 30_000 : 0,
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
        <AlertTitle>Failed to load system health</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{error instanceof FetchError ? error.message : 'Unknown error'}</span>
          <Button size="sm" variant="outline" onClick={() => mutate()}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const m = data?.metrics;

  return (
    <div className="space-y-8 animate-slide-up">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="System Health"
          description="Infrastructure status, resource utilisation, and integration readiness."
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(v => !v)}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => mutate()} aria-label="Refresh now">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overall status banner */}
      {!isLoading && data && (
        <div
          className={
            data.overall === 'healthy'
              ? 'flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-800 dark:bg-emerald-950'
              : data.overall === 'degraded'
              ? 'flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-950'
              : 'flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 dark:border-rose-800 dark:bg-rose-950'
          }
          role="status"
        >
          {data.overall === 'healthy'
            ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            : data.overall === 'degraded'
            ? <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            : <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />}
          <div>
            <p className={`font-semibold capitalize ${
              data.overall === 'healthy' ? 'text-emerald-800 dark:text-emerald-200' :
              data.overall === 'degraded' ? 'text-amber-800 dark:text-amber-200' :
              'text-rose-800 dark:text-rose-200'
            }`}>
              {data.overall === 'healthy' ? 'All systems operational' :
               data.overall === 'degraded' ? 'Degraded performance detected' :
               'Service disruption in progress'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {data.services.filter(s => s.status !== 'healthy').length} service{data.services.filter(s => s.status !== 'healthy').length !== 1 ? 's' : ''} with issues
            </p>
          </div>
        </div>
      )}

      {/* Resource KPIs */}
      <section aria-label="Resource utilisation">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Uptime"
            value={isLoading ? '—' : m?.uptime != null ? formatUptime(m.uptime) : 'N/A'}
            loading={isLoading}
            icon={<Clock className="h-5 w-5" />}
            iconVariant="emerald"
          />
          <MetricCard
            label="CPU Usage"
            value={isLoading ? '—' : m?.cpuUsage != null ? `${m.cpuUsage.toFixed(1)}%` : 'N/A'}
            loading={isLoading}
            icon={<Activity className="h-5 w-5" />}
            iconVariant={m && m.cpuUsage > 80 ? 'rose' : m && m.cpuUsage > 60 ? 'amber' : 'blue'}
          />
          <MetricCard
            label="Memory Usage"
            value={isLoading ? '—' : m?.memoryUsage != null ? `${m.memoryUsage.toFixed(1)}%` : 'N/A'}
            loading={isLoading}
            icon={<HardDrive className="h-5 w-5" />}
            iconVariant={m && m.memoryUsage > 85 ? 'rose' : m && m.memoryUsage > 70 ? 'amber' : 'violet'}
          />
          <MetricCard
            label="Active Connections"
            value={isLoading ? '—' : m?.activeConnections != null ? m.activeConnections.toLocaleString() : 'N/A'}
            loading={isLoading}
            icon={<Wifi className="h-5 w-5" />}
            iconVariant="slate"
          />
        </div>
      </section>

      {/* Resource usage bars */}
      {!isLoading && m && (
        <section aria-label="Resource detail">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resource Utilisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {([
                { label: 'CPU',    value: m.cpuUsage,    threshold: 80 },
                { label: 'Memory', value: m.memoryUsage, threshold: 85 },
                { label: 'Disk',   value: m.diskUsage,   threshold: 90 },
              ] as const).map(({ label, value, threshold }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
                    <span
                      className={`tabular-nums font-semibold ${value > threshold ? 'text-rose-600' : value > threshold * 0.75 ? 'text-amber-600' : 'text-emerald-600'}`}
                      data-numeric="true"
                    >
                      {value.toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={value}
                    className="h-2"
                    aria-label={`${label} usage: ${value.toFixed(1)}%`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Services */}
      <section aria-label="Service statuses">
        <SectionHeader title="Services" className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-2">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
              ))
            : data?.services.map(svc => {
                const Icon = serviceIcons[svc.name] ?? serviceIcons.default;
                return (
                  <div
                    key={svc.name}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{svc.name}</p>
                        <StatusPill status={svc.status} />
                      </div>
                      {svc.latency != null && (
                        <p className="mt-0.5 text-xs text-slate-500" data-numeric="true">
                          {svc.latency}ms latency
                        </p>
                      )}
                      {svc.message && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">{svc.message}</p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400">
                        Checked {safeDate(svc.lastCheck, { timeStyle: 'short' }) || 'recently'}
                      </p>
                    </div>
                  </div>
                );
              })}
        </div>
      </section>

      {/* Integrations */}
      <section aria-label="Integration statuses">
        <SectionHeader title="Integrations" className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-2">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
              ))
            : data && Object.entries(data.integrations).map(([key, int]) => {
                const status =
                  int.status === 'connected' ? 'healthy' :
                  int.status === 'mock'      ? 'degraded' :
                  'error';
                return (
                  <div
                    key={key}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <Globe className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {integrationNames[key] ?? key}
                        </p>
                        <StatusPill
                          status={status}
                          label={int.status === 'connected' ? 'Connected' : int.status === 'mock' ? 'Mock' : 'Error'}
                        />
                      </div>
                      {int.latency != null && (
                        <p className="mt-0.5 text-xs text-slate-500" data-numeric="true">
                          {int.latency}ms
                        </p>
                      )}
                      {int.status === 'mock' && (
                        <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                          Running in mock/sandbox mode
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
      </section>

      {/* Recent events */}
      {(data?.recentEvents?.length ?? 0) > 0 && (
        <section aria-label="Recent system events">
          <SectionHeader title="Recent Events" className="mb-4" />
          <Card>
            <CardContent className="pt-4">
              <ul className="space-y-2.5">
                {data!.recentEvents.map(evt => {
                  const evtColors  = eventTypeColors[evt.type];
                  const EvtIcon    = eventTypeIcons[evt.type];
                  return (
                    <li
                      key={evt.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${evtColors}`}
                    >
                      <EvtIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{evt.message}</span>
                      <time
                        className="shrink-0 text-xs opacity-70"
                        dateTime={evt.timestamp}
                      >
                        {safeDate(evt.timestamp, { timeStyle: 'short' })}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
