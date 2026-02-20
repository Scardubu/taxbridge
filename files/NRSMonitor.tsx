'use client';

import { useEffect, useRef, useState } from 'react';

interface QueueHealth {
  waiting: number;
  active: number;
  failed: number;
  completed: number;
  delayed: number;
  successRate: number | null;
  healthy: boolean;
}

interface QueueData {
  nrs: QueueHealth;
  timestamp: string;
}

const POLL_MS = 10_000;

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-slate-50">
      <span
        className="text-2xl font-black tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function SuccessRing({ rate }: { rate: number | null }) {
  const pct = rate != null ? Math.round(rate * 100) : null;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = pct != null ? (pct / 100) * circ : 0;
  const color = pct == null ? '#94A3B8' : pct >= 95 ? '#10B981' : pct >= 85 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black" style={{ color }}>
            {pct != null ? `${pct}%` : '—'}
          </span>
        </div>
      </div>
      <span className="text-xs text-slate-400 font-semibold">Success</span>
    </div>
  );
}

export function NRSMonitor() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [err, setErr] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = async () => {
    try {
      const res = await fetch('/api/admin/health/queues', {
        cache: 'no-store',
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json: QueueData = await res.json();
      setData(json);
      setLastUpdate(new Date());
      setErr(false);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch_();
    intervalRef.current = setInterval(fetch_, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const nrs = data?.nrs;
  const isCircuitOpen = nrs ? nrs.failed > 10 && (nrs.successRate ?? 1) < 0.5 : false;

  return (
    <div
      className="rounded-2xl bg-white border border-slate-100 p-5"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">NRS Submission Queue</h3>
            <p className="text-xs text-slate-400">
              {loading ? 'Loading…' : err ? 'Connection error' : `Polling every ${POLL_MS / 1000}s`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Circuit breaker badge */}
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: isCircuitOpen ? '#FEE2E2' : '#D1FAE5',
              color: isCircuitOpen ? '#DC2626' : '#059669',
            }}
          >
            {isCircuitOpen ? '🔴 Circuit Open' : '🟢 Healthy'}
          </span>

          {/* Live dot */}
          {!loading && !err && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-4 gap-2 flex-1">
            <StatBox label="Waiting" value={nrs?.waiting ?? 0} color="#3B82F6" />
            <StatBox label="Active"  value={nrs?.active  ?? 0} color="#F59E0B" />
            <StatBox label="Failed"  value={nrs?.failed  ?? 0} color={nrs?.failed ? '#EF4444' : '#94A3B8'} />
            <StatBox label="Done"    value={nrs?.completed ?? 0} color="#10B981" />
          </div>
          <SuccessRing rate={nrs?.successRate ?? null} />
        </div>
      )}

      {/* Low success-rate warning */}
      {nrs?.successRate != null && nrs.successRate < 0.9 && (
        <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-semibold text-amber-700">
            NRS success rate below 90% — check failed jobs and NRS API status
          </span>
        </div>
      )}

      {/* Last updated */}
      {lastUpdate && (
        <p className="text-xs text-slate-300 mt-3 text-right">
          Updated {lastUpdate.toLocaleTimeString('en-NG')}
        </p>
      )}
    </div>
  );
}
