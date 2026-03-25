'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { cn, safeDate } from '@/lib/utils';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n, type AdminLanguage } from '@/lib/i18n';
import { useTaxBridgeSSE } from '@/hooks/useTaxBridgeSSE';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SystemStatus = 'healthy' | 'degraded' | 'error' | 'unknown';

interface IntegrationCheck {
  status?: string;
  latency?: number;
  error?: string;
  mode?: string;
  timestamp?: string;
}

interface IntegrationsHealthResponse {
  status?: string;
  integrations?: Record<string, IntegrationCheck>;
  timestamp?: string;
  error?: string;
}

interface EnterpriseShellProps {
  children: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const integrationsFetcher = (url: string) => fetchJson<IntegrationsHealthResponse>(url);

function asStatus(value: unknown): SystemStatus {
  if (value === 'healthy' || value === 'degraded' || value === 'error' || value === 'unknown')
    return value;
  return 'unknown';
}

function worstStatus(a: SystemStatus, b: SystemStatus): SystemStatus {
  const rank: Record<SystemStatus, number> = { healthy: 0, unknown: 1, degraded: 1, error: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function statusFromLatency(latency: number | undefined): SystemStatus {
  if (typeof latency !== 'number' || Number.isNaN(latency)) return 'healthy';
  if (latency >= 5000) return 'error';
  if (latency >= 1500) return 'degraded';
  return 'healthy';
}

const statusIcons: Record<SystemStatus, LucideIcon> = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  error: XCircle,
  unknown: HelpCircle,
};

const statusColors: Record<SystemStatus, string> = {
  healthy:  'text-emerald-600 dark:text-emerald-400',
  degraded: 'text-amber-500   dark:text-amber-400  animate-pulse',
  error:    'text-rose-600    dark:text-rose-400    animate-pulse',
  unknown:  'text-slate-400',
};

const statusLabels: Record<SystemStatus, string> = {
  healthy:  'All systems operational',
  degraded: 'Degraded performance',
  error:    'Service disruption',
  unknown:  'Checking…',
};

const bannerVariants: Record<Exclude<SystemStatus, 'healthy' | 'unknown'>, string> = {
  degraded: 'border-b border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  error:    'border-b border-rose-200  bg-rose-50  text-rose-800  dark:border-rose-800  dark:bg-rose-950  dark:text-rose-200',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EnterpriseShell({ children }: EnterpriseShellProps) {
  const { t, lang, setLang } = useAdminI18n();
  const [currentTime, setCurrentTime] = useState('');

  // ── Health data ──────────────────────────────────────────────────────────
  const {
    data: integrationsHealth,
    error: integrationsError,
    isLoading: isHealthLoading,
    mutate: revalidateIntegrations,
  } = useSWR<IntegrationsHealthResponse>(
    '/api/admin/health/integrations',
    integrationsFetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, keepPreviousData: true },
  );

  const handleHealthEvent = useCallback(() => void revalidateIntegrations(), [revalidateIntegrations]);

  const { connected: sseConnected } = useTaxBridgeSSE({
    eventTypes: ['integration:health', 'remita:status_change', 'digitax:status_change', 'system:health'],
    onEvent: handleHealthEvent,
  });

  // ── Clock ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () =>
      setCurrentTime(
        new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }),
      );
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Derived status ───────────────────────────────────────────────────────
  const { systemStatus, bannerDetails, lastCheckedLabel } = useMemo(() => {
    if (isHealthLoading && !integrationsHealth) {
      return { systemStatus: 'unknown' as SystemStatus, bannerDetails: undefined, lastCheckedLabel: undefined };
    }
    if (integrationsError) {
      const msg =
        integrationsError instanceof FetchError
          ? integrationsError.message
          : integrationsError instanceof Error
          ? integrationsError.message
          : 'Unavailable';
      return { systemStatus: 'error' as SystemStatus, bannerDetails: msg, lastCheckedLabel: undefined };
    }

    const overall = asStatus(integrationsHealth?.status);
    const ints = integrationsHealth?.integrations ?? {};
    const digitax = ints.digitax ?? ints.duplo;
    const remita = ints.remita;

    const dtStatus = worstStatus(asStatus(digitax?.status), statusFromLatency(digitax?.latency));
    const rmStatus = worstStatus(asStatus(remita?.status), statusFromLatency(remita?.latency));
    const computed = worstStatus(overall, worstStatus(dtStatus, rmStatus));

    const parts: string[] = [];
    if (digitax) {
      const lat = typeof digitax.latency === 'number' ? ` (${digitax.latency}ms)` : '';
      const err = digitax.error ? `: ${digitax.error}` : '';
      parts.push(`DigiTax: ${dtStatus}${lat}${err}`);
    }
    if (remita) {
      const lat = typeof remita.latency === 'number' ? ` (${remita.latency}ms)` : '';
      const err = remita.error ? `: ${remita.error}` : '';
      parts.push(`Remita: ${rmStatus}${lat}${err}`);
    }

    const ts = integrationsHealth?.timestamp;
    return {
      systemStatus: computed,
      bannerDetails: parts.length ? parts.join(' · ') : integrationsHealth?.error,
      lastCheckedLabel: safeDate(ts, { hour: '2-digit', minute: '2-digit' }) || undefined,
    };
  }, [integrationsError, integrationsHealth, isHealthLoading]);

  const StatusIcon = statusIcons[systemStatus];
  const showBanner = systemStatus === 'degraded' || systemStatus === 'error';

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── System status banner (degraded / error only) ── */}
      {showBanner && (
        <div
          role="alert"
          aria-live="assertive"
          className={cn('px-4 py-2 text-sm', bannerVariants[systemStatus as 'degraded' | 'error'])}
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <StatusIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="font-semibold">{statusLabels[systemStatus]}</span>
            {bannerDetails && <span className="opacity-80">{bannerDetails}</span>}
            {lastCheckedLabel && (
              <span className="opacity-60">· Last checked {lastCheckedLabel}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Top navigation bar ── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="TaxBridge Admin — go to dashboard"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm dark:bg-slate-700">
              TB
            </span>
            <span className="hidden sm:block">
              <span className="block text-[15px] font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                TaxBridge
              </span>
              <span className="block text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                Admin Console
              </span>
            </span>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* WAT clock */}
            <div
              className="hidden items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 md:flex"
              aria-label={`Current time: ${currentTime} WAT`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span data-numeric="true">{currentTime} WAT</span>
            </div>

            {/* Language selector */}
            <label className="hidden md:flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <span className="sr-only">Interface language</span>
              <select
                aria-label="Interface language"
                value={lang}
                onChange={(e) => setLang(e.target.value as AdminLanguage)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="en">English</option>
                <option value="pidgin">Pidgin</option>
              </select>
            </label>

            {/* System health pill */}
            <div
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              aria-label={`System status: ${statusLabels[systemStatus]}`}
            >
              <StatusIcon
                className={cn('h-3.5 w-3.5 shrink-0', statusColors[systemStatus])}
                aria-hidden="true"
              />
              <span className={cn('font-medium', statusColors[systemStatus])}>
                {systemStatus === 'healthy' ? 'Operational' : systemStatus === 'unknown' ? 'Checking…' : statusLabels[systemStatus]}
              </span>
            </div>

            {/* SSE live indicator */}
            <div
              title={sseConnected ? 'Real-time stream connected' : 'Polling mode — stream unavailable'}
              aria-label={sseConnected ? 'Live data stream active' : 'Data stream disconnected, using polling'}
              className="flex items-center gap-1.5 px-2 py-1.5"
            >
              <span
                className={cn('h-2 w-2 rounded-full', {
                  'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)] animate-pulse': sseConnected,
                  'bg-slate-300 dark:bg-slate-600': !sseConnected,
                })}
              />
              <span className="hidden text-xs text-slate-400 dark:text-slate-500 lg:inline">
                {sseConnected ? 'Live' : 'Poll'}
              </span>
            </div>

            {/* Operator avatar */}
            <div
              aria-label="Operator account"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white shadow transition-shadow hover:shadow-md"
            >
              AD
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        tabIndex={-1}
      >
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white/50 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} TaxBridge · Nigeria Revenue Service Compliant</span>
          <span data-numeric="true">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? '2.0.0'}
          </span>
        </div>
      </footer>
    </div>
  );
}
