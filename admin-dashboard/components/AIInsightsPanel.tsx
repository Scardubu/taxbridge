'use client';

import { useEffect, useState, useRef } from 'react';
import useSWR from 'swr';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnomalySummary {
  total: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

interface IntegrationHealth {
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latency?: number | null;
}

interface HealthData {
  fallback?: boolean;
  status?: string;
  integrations?: {
    database: IntegrationHealth;
    redis: IntegrationHealth;
    digitax: IntegrationHealth;
    paystack: IntegrationHealth;
    flutterwave: IntegrationHealth;
  };
}

interface StatsData {
  fallback?: boolean;
  totalUsers?: number | null;
  totalInvoices?: number | null;
  totalRevenue?: number | null;
  nrsSuccessRate?: number | null;
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw Object.assign(new Error('Fetch failed'), { status: r.status });
    return r.json();
  });

// ─── Sub-components ──────────────────────────────────────────────────────────

function PulsingDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-2.5 w-2.5"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  loading,
}: {
  label: string;
  value: string | null;
  sub?: string;
  accent: string;
  loading: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 bg-white border border-slate-100"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}
    >
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 translate-x-8 -translate-y-8"
        style={{ backgroundColor: accent }}
      />
      <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-2">
        {label}
      </p>
      {loading || value === null ? (
        <div className="h-8 w-24 rounded-lg bg-slate-100 animate-pulse" />
      ) : (
        <p className="text-2xl font-black text-slate-800 tabular-nums">{value}</p>
      )}
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function AnomalyBadge({
  count,
  label,
  bg,
  text,
}: {
  count: number;
  label: string;
  bg: string;
  text: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ backgroundColor: bg, color: text }}
    >
      {count} {label}
    </span>
  );
}

function IntegrationRow({
  name,
  health,
}: {
  name: string;
  health: IntegrationHealth | undefined;
}) {
  const statusColor =
    health?.status === 'healthy'
      ? '#10B981'
      : health?.status === 'degraded'
      ? '#F59E0B'
      : health?.status === 'down'
      ? '#EF4444'
      : '#94A3B8';

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm font-medium text-slate-600 capitalize">{name}</span>
      <div className="flex items-center gap-2.5">
        {health?.latency != null && (
          <span className="text-xs text-slate-400">{health.latency}ms</span>
        )}
        <PulsingDot color={statusColor} />
        <span className="text-xs font-semibold capitalize" style={{ color: statusColor }}>
          {health?.status ?? 'unknown'}
        </span>
      </div>
    </div>
  );
}

// ─── Animated counter ────────────────────────────────────────────────────────

function useCountUp(target: number | null, duration = 1200) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    const start = Date.now();
    const from = 0;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return value;
}

// ─── NRS Queue Ring ──────────────────────────────────────────────────────────

function NRSRing({ rate }: { rate: number | null }) {
  const pct = rate != null ? Math.round(rate * 100) : null;
  const counted = useCountUp(pct, 1400);
  const circumference = 2 * Math.PI * 36;
  const dash = pct != null ? (counted / 100) * circumference : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="36" fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle
            cx="44" cy="44" r="36" fill="none"
            stroke={pct !== null && pct >= 95 ? '#10B981' : pct !== null && pct >= 85 ? '#F59E0B' : '#EF4444'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 0.05s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {pct === null ? (
            <span className="text-xs text-slate-400">—</span>
          ) : (
            <span className="text-xl font-black text-slate-800">{counted}%</span>
          )}
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-500 text-center">NRS Success</p>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function AIInsightsPanel() {
  const { data: stats, isLoading: statsLoading } = useSWR<StatsData>(
    '/api/admin/stats',
    fetcher,
    { refreshInterval: 300_000 }
  );
  const { data: health } = useSWR<HealthData>(
    '/api/admin/health/integrations',
    fetcher,
    { refreshInterval: 300_000 }
  );

  // Mock anomaly summary — replace with real endpoint when /api/v1/admin/aggregate-anomalies exists
  const anomalySummary: AnomalySummary = { total: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const isColdStart = health?.fallback && health?.status === 'starting';

  return (
    <div className="space-y-5">
      {/* Cold-start banner */}
      {isColdStart && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>
            <strong>Backend warming up</strong> — Render cold start (~30s). Data will appear shortly.
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">AI Platform Intelligence</h2>
          <p className="text-xs text-slate-400">Live platform metrics &amp; anomaly detection</p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Users"
          value={stats?.totalUsers != null ? stats.totalUsers.toLocaleString() : null}
          accent="#10B981"
          loading={statsLoading}
        />
        <StatCard
          label="Total Invoices"
          value={stats?.totalInvoices != null ? stats.totalInvoices.toLocaleString() : null}
          accent="#3B82F6"
          loading={statsLoading}
        />
        <StatCard
          label="Platform Revenue"
          value={
            stats?.totalRevenue != null
              ? `₦${(stats.totalRevenue / 1_000_000).toFixed(1)}M`
              : null
          }
          sub="all time"
          accent="#8B5CF6"
          loading={statsLoading}
        />
        <div
          className="relative overflow-hidden rounded-2xl p-5 bg-white border border-slate-100 flex items-center justify-center"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}
        >
          <NRSRing rate={stats?.nrsSuccessRate ?? null} />
        </div>
      </div>

      {/* Lower row: anomalies + integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Anomaly summary */}
        <div
          className="rounded-2xl p-5 bg-white border border-slate-100"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-4">
            Anomaly Detection
          </p>

          {anomalySummary.total === 0 ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">All clear</p>
                <p className="text-xs text-slate-400">No anomalies detected across all businesses</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800">{anomalySummary.total}</span>
                <span className="text-sm text-slate-400">anomalies detected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <AnomalyBadge count={anomalySummary.HIGH} label="HIGH" bg="#FEE2E2" text="#DC2626" />
                <AnomalyBadge count={anomalySummary.MEDIUM} label="MEDIUM" bg="#FEF3C7" text="#D97706" />
                <AnomalyBadge count={anomalySummary.LOW} label="LOW" bg="#ECFDF5" text="#059669" />
              </div>
            </div>
          )}
        </div>

        {/* Integrations */}
        <div
          className="rounded-2xl p-5 bg-white border border-slate-100"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-3">
            Integration Health
          </p>
          <div>
            {(['database', 'redis', 'digitax', 'paystack', 'flutterwave'] as const).map((key) => (
              <IntegrationRow
                key={key}
                name={key}
                health={health?.integrations?.[key]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
