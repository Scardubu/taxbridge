'use client';

import { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { Navigation } from './Navigation';
import { cn } from '@/lib/utils';
import { FetchError, fetchJson } from '@/lib/fetcher';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type SystemStatus = 'healthy' | 'degraded' | 'error' | 'unknown';

type IntegrationCheck = {
  status?: string;
  latency?: number;
  error?: string;
  mode?: string;
  timestamp?: string;
};

type IntegrationsHealthResponse = {
  status?: string;
  integrations?: Record<string, IntegrationCheck>;
  timestamp?: string;
  error?: string;
};

const integrationsFetcher = (url: string) => fetchJson<IntegrationsHealthResponse>(url);

function asStatus(value: unknown): SystemStatus {
  if (value === 'healthy' || value === 'degraded' || value === 'error' || value === 'unknown') return value;
  return 'unknown';
}

function worstStatus(a: SystemStatus, b: SystemStatus): SystemStatus {
  const rank: Record<SystemStatus, number> = {
    healthy: 0,
    degraded: 1,
    error: 2,
    unknown: 1,
  };
  return rank[a] >= rank[b] ? a : b;
}

function statusFromLatency(latency: number | undefined): SystemStatus {
  if (typeof latency !== 'number' || Number.isNaN(latency)) return 'healthy';

  // Heuristics for operator visibility (tune as needed)
  if (latency >= 5000) return 'error';
  if (latency >= 1500) return 'degraded';
  return 'healthy';
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [currentTime, setCurrentTime] = useState<string>('');

  const {
    data: integrationsHealth,
    error: integrationsError,
    isLoading: isIntegrationsLoading,
  } = useSWR<IntegrationsHealthResponse>('/api/admin/health/integrations', integrationsFetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Lagos'
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const derived = useMemo(() => {
    if (isIntegrationsLoading && !integrationsHealth) {
      return {
        systemStatus: 'unknown' as SystemStatus,
        statusText: 'Checking System Health…',
        bannerDetails: undefined as string | undefined,
        lastCheckedLabel: undefined as string | undefined,
      };
    }

    if (integrationsError) {
      const message =
        integrationsError instanceof FetchError
          ? integrationsError.message
          : integrationsError instanceof Error
            ? integrationsError.message
            : 'Health check unavailable';

      return {
        systemStatus: 'error' as SystemStatus,
        statusText: 'Health Check Unavailable',
        bannerDetails: message,
        lastCheckedLabel: undefined as string | undefined,
      };
    }

    const overall = asStatus(integrationsHealth?.status);
    const integrations = integrationsHealth?.integrations || {};
    const digitax = integrations.digitax ?? integrations.duplo;
    const remita = integrations.remita;

    const digitaxBase = asStatus(digitax?.status);
    const remitaBase = asStatus(remita?.status);

    const digitaxLatencyStatus = statusFromLatency(digitax?.latency);
    const remitaLatencyStatus = statusFromLatency(remita?.latency);

    const digitaxFinal = worstStatus(digitaxBase, digitaxLatencyStatus);
    const remitaFinal = worstStatus(remitaBase, remitaLatencyStatus);
    const computedOverall = worstStatus(overall, worstStatus(digitaxFinal, remitaFinal));

    const details: string[] = [];
    if (digitax) {
      const suffix = typeof digitax.latency === 'number' ? ` (${digitax.latency}ms)` : '';
      const mode = digitax.mode === 'mock' ? ' [mock]' : '';
      const errorText = digitax.error ? `: ${digitax.error}` : '';
      details.push(`DigiTax: ${digitaxFinal}${suffix}${mode}${errorText}`);
    }
    if (remita) {
      const suffix = typeof remita.latency === 'number' ? ` (${remita.latency}ms)` : '';
      const mode = remita.mode === 'mock' ? ' [mock]' : '';
      const errorText = remita.error ? `: ${remita.error}` : '';
      details.push(`Remita: ${remitaFinal}${suffix}${mode}${errorText}`);
    }

    const ts = integrationsHealth?.timestamp;
    const lastCheckedLabel = ts ? new Date(ts).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : undefined;

    return {
      systemStatus: computedOverall,
      statusText:
        computedOverall === 'healthy'
          ? 'All Systems Operational'
          : computedOverall === 'degraded'
            ? 'Performance Degraded'
            : computedOverall === 'error'
              ? 'Service Disruption'
              : 'System Status Unknown',
      bannerDetails: details.length ? details.join(' • ') : integrationsHealth?.error,
      lastCheckedLabel,
    };
  }, [integrationsError, integrationsHealth, isIntegrationsLoading]);

  const getStatusConfig = (status: SystemStatus) => {
    switch (status) {
      case 'healthy':
        return { color: 'bg-green-500', text: 'All Systems Operational', bgClass: '' };
      case 'degraded':
        return { color: 'bg-yellow-500', text: 'Performance Degraded', bgClass: 'bg-yellow-50' };
      case 'error':
        return { color: 'bg-red-500', text: 'Service Disruption', bgClass: 'bg-red-50' };
      case 'unknown':
        return { color: 'bg-slate-400', text: 'Checking System Health…', bgClass: 'bg-slate-50' };
    }
  };

  const systemStatus = derived.systemStatus;
  const statusConfig = getStatusConfig(systemStatus);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* System Status Banner (shown when not healthy) */}
      {systemStatus !== 'healthy' && systemStatus !== 'unknown' && (
        <div
          className={cn(
            statusConfig.bgClass,
            'border-b px-4 py-2',
            systemStatus === 'error' ? 'border-red-200' : 'border-yellow-200'
          )}
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-center gap-1 sm:gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${statusConfig.color} animate-pulse`} />
            <span className={`font-medium ${systemStatus === 'error' ? 'text-red-700' : 'text-yellow-700'}`}>
              {derived.statusText}
            </span>
            {derived.bannerDetails && (
              <span className={systemStatus === 'error' ? 'text-red-700/80' : 'text-yellow-700/80'}>
                {derived.bannerDetails}
              </span>
            )}
            {derived.lastCheckedLabel && (
              <span className={systemStatus === 'error' ? 'text-red-700/70' : 'text-yellow-700/70'}>
                • Last checked {derived.lastCheckedLabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">TB</span>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-bold text-slate-900">TaxBridge</h1>
                <p className="text-xs text-slate-500">Admin Console</p>
              </div>
            </div>

            {/* Navigation */}
            <Navigation />

            {/* Status & User Menu */}
            <div className="flex items-center gap-6">
              {/* Time Display */}
              <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{currentTime} WAT</span>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                <div className={`h-2 w-2 ${statusConfig.color} rounded-full ${systemStatus === 'healthy' ? '' : 'animate-pulse'}`} />
                <span className="text-sm font-medium text-slate-700">{derived.statusText}</span>
              </div>

              {/* User Avatar */}
              <div className="h-9 w-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm cursor-pointer hover:shadow-lg transition-shadow">
                AD
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-sm text-slate-500">
            <p>© 2026 TaxBridge Nigeria. NRS 2026 Compliant.</p>
            <div className="flex items-center gap-4">
              <span>v1.0.0</span>
              <span>•</span>
              <a href="#" className="hover:text-slate-700">Documentation</a>
              <span>•</span>
              <a href="#" className="hover:text-slate-700">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
