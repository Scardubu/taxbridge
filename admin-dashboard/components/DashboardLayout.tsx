'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import useSWR from 'swr';
import { Navigation } from './Navigation';
import { cn, safeDate } from '@/lib/utils';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n, type AdminLanguage } from '@/lib/i18n';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

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
  const { t, lang, setLang } = useAdminI18n();

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
        statusTextKey: 'status.checking',
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
            : t('status.unavailable');

      return {
        systemStatus: 'error' as SystemStatus,
        statusTextKey: 'status.unavailable',
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
      const mode = digitax.mode === 'mock' ? t('integrations.mockSuffix') : '';
      const errorText = digitax.error ? `: ${digitax.error}` : '';
      details.push(`${t('integrations.digitax')}: ${digitaxFinal}${suffix}${mode}${errorText}`);
    }
    if (remita) {
      const suffix = typeof remita.latency === 'number' ? ` (${remita.latency}ms)` : '';
      const mode = remita.mode === 'mock' ? t('integrations.mockSuffix') : '';
      const errorText = remita.error ? `: ${remita.error}` : '';
      details.push(`${t('integrations.remita')}: ${remitaFinal}${suffix}${mode}${errorText}`);
    }

    const ts = integrationsHealth?.timestamp;
    const lastCheckedLabel = safeDate(ts, { hour: '2-digit', minute: '2-digit' }) || undefined;

    return {
      systemStatus: computedOverall,
      statusTextKey:
        computedOverall === 'healthy'
          ? 'status.healthy'
          : computedOverall === 'degraded'
            ? 'status.degraded'
            : computedOverall === 'error'
              ? 'status.error'
              : 'status.unknown',
      bannerDetails: details.length ? details.join(' • ') : integrationsHealth?.error,
      lastCheckedLabel,
    };
  }, [integrationsError, integrationsHealth, isIntegrationsLoading, t]);

  const getStatusConfig = useCallback((status: SystemStatus): {
    color: string;
    bgClass: string;
    Icon: LucideIcon;
  } => {
    switch (status) {
      case 'healthy':
        return { color: 'bg-green-500', bgClass: '', Icon: CheckCircle2 };
      case 'degraded':
        return { color: 'bg-yellow-500', bgClass: 'bg-yellow-50', Icon: AlertTriangle };
      case 'error':
        return { color: 'bg-red-500', bgClass: 'bg-red-50', Icon: XCircle };
      case 'unknown':
        return { color: 'bg-slate-400', bgClass: 'bg-slate-50', Icon: HelpCircle };
    }
  }, []);

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
            <statusConfig.Icon className={`h-4 w-4 shrink-0 ${systemStatus === 'error' ? 'text-red-600' : 'text-yellow-600'}`} aria-hidden="true" />
            <span className={`font-medium ${systemStatus === 'error' ? 'text-red-700' : 'text-yellow-700'}`}>
              {t(derived.statusTextKey)}
            </span>
            {derived.bannerDetails && (
              <span className={systemStatus === 'error' ? 'text-red-700/80' : 'text-yellow-700/80'}>
                {derived.bannerDetails}
              </span>
            )}
            {derived.lastCheckedLabel && (
              <span className={systemStatus === 'error' ? 'text-red-700/70' : 'text-yellow-700/70'}>
                • {t('status.lastChecked', { time: derived.lastCheckedLabel })}
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
                <div
                  className="h-10 w-10 rounded-xl shadow-lg bg-slate-900 text-white flex items-center justify-center text-sm font-bold"
                  aria-label={t('header.logoAlt')}
                >
                  TB
                </div>
              </div>
              <div className="ml-3 sm:ml-4">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">{t('header.brandName')}</h1>
                <p className="hidden sm:block text-xs text-slate-500">{t('header.adminConsole')}</p>
              </div>
            </div>

            {/* Navigation */}
            <Navigation />

            {/* Status & User Menu */}
            <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
              {/* Time Display */}
              <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{currentTime} {t('header.timeZone')}</span>
              </div>

              {/* Language */}
              <label className="hidden md:flex items-center gap-2 text-sm text-slate-600">
                <span className="sr-only">{t('header.language')}</span>
                <select
                  aria-label={t('header.language')}
                  value={lang}
                  onChange={(e) => setLang(e.target.value as AdminLanguage)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="en">{t('header.language.en')}</option>
                  <option value="pidgin">{t('header.language.pidgin')}</option>
                </select>
              </label>

              {/* Status Indicator — C-15: color + shape icon + text */}
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-slate-100 rounded-full">
                <statusConfig.Icon
                  className={cn('h-3.5 w-3.5 shrink-0', {
                    'text-green-600': systemStatus === 'healthy',
                    'text-yellow-600 animate-pulse': systemStatus === 'degraded',
                    'text-red-600 animate-pulse': systemStatus === 'error',
                    'text-slate-500': systemStatus === 'unknown',
                  })}
                  aria-hidden="true"
                />
                <span className="text-xs sm:text-sm font-medium text-slate-700">{t(derived.statusTextKey)}</span>
              </div>

              {/* User Avatar */}
              <div className="h-8 w-8 sm:h-9 sm:w-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm cursor-pointer hover:shadow-lg transition-shadow">
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
            <p>{t('footer.copyright')}</p>
            <div className="flex items-center gap-4">
              <span>{t('footer.version', { version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0' })}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
