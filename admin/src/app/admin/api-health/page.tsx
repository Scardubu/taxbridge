'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, Skeleton } from '../../../components/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface HealthPayload {
  status?: string;
  timestamp?: string;
  checks?: Record<string, string>;
}

interface MetricsPayload {
  raw: string;
}

interface ParsedMetrics {
  nrsCircuitState: number | null;
  dlqDepth: number | null;
  p99LatencySeconds: number | null;
  lastNrsStampAt: string | null;
}

async function fetchHealth(path: string): Promise<HealthPayload> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }

  return response.json() as Promise<HealthPayload>;
}

async function fetchMetrics(path: string): Promise<MetricsPayload> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }

  return { raw: await response.text() };
}

function parseMetricValue(raw: string, name: string): number | null {
  const line = raw.split('\n').find((entry) => entry.startsWith(`${name} `));
  if (!line) return null;
  const value = Number(line.slice(name.length + 1));
  return Number.isFinite(value) ? value : null;
}

function parseHistogramP99(raw: string, name: string): number | null {
  const line = raw.split('\n').find((entry) => entry.startsWith(`${name}_bucket`) && entry.includes('le="10"'));
  if (!line) return null;
  const match = line.match(/\s([0-9.]+)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseLastNrsStamp(raw: string): string | null {
  const candidate = raw.split('\n').find((entry) => entry.toLowerCase().includes('nrs') && entry.toLowerCase().includes('stamp') && entry.toLowerCase().includes('last'));
  if (!candidate) return null;
  const match = candidate.match(/"([^"]+)"$/);
  return match?.[1] ?? null;
}

function getCircuitDisplay(value: number | null): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; icon: string } {
  if (value === 0) return { label: 'Closed', tone: 'success', icon: '●' };
  if (value === 1) return { label: 'Half-open', tone: 'warning', icon: '◐' };
  if (value === 2) return { label: 'Open', tone: 'danger', icon: '▲' };
  return { label: 'Unknown', tone: 'neutral', icon: '○' };
}

function formatLatency(seconds: number | null): string {
  if (seconds === null) return 'n/a';
  return `${Math.round(seconds * 1000)}ms`;
}

function formatDepth(value: number | null): string {
  if (value === null) return 'n/a';
  return `${value}`;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function StatusCard({ title, value, detail, status }: { title: string; value: string; detail: string; status: { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; icon: string } }) {
  return (
    <Card>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.08 }}>{title}</div>
          <Badge tone={status.tone}><span aria-hidden="true">{status.icon}</span> {status.label}</Badge>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)' }}>{value}</div>
        <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>{detail}</div>
      </div>
    </Card>
  );
}

export default function ApiHealthPage() {
  const [monitoring, setMonitoring] = useState<HealthPayload | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchHealth('/api/v2/monitoring/health'),
      fetchMetrics('/api/v2/monitoring/metrics'),
    ])
      .then(([monitoringHealth, metricsPayload]) => {
        setMonitoring(monitoringHealth);
        setMetrics(metricsPayload);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadHealth();
    const interval = window.setInterval(loadHealth, 30_000);
    return () => window.clearInterval(interval);
  }, [loadHealth]);

  const parsedMetrics = useMemo<ParsedMetrics>(() => {
    const raw = metrics?.raw ?? '';
    return {
      nrsCircuitState: parseMetricValue(raw, 'nrs_circuit_state'),
      dlqDepth: parseMetricValue(raw, 'dlq_depth'),
      p99LatencySeconds: parseHistogramP99(raw, 'http_request_duration_seconds'),
      lastNrsStampAt: parseLastNrsStamp(raw),
    };
  }, [metrics]);

  const circuit = getCircuitDisplay(parsedMetrics.nrsCircuitState);
  const platformStatus = monitoring?.status === 'healthy'
    ? { label: 'Healthy', tone: 'success' as const, icon: '●' }
    : monitoring?.status === 'degraded'
      ? { label: 'Degraded', tone: 'warning' as const, icon: '▲' }
      : { label: 'Unknown', tone: 'neutral' as const, icon: '○' };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>API Health</h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginTop: 6, maxWidth: 720 }}>
            Operational overview for monitoring health, NRS circuit state, queue pressure, and latency. Refreshes every 30 seconds.
          </p>
        </div>
        <button className="tb-button tb-button-secondary" onClick={loadHealth} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <Card>
          <div role="alert" style={{ color: '#991B1B', fontWeight: 600 }}>{error}</div>
        </Card>
      )}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <div style={{ display: 'grid', gap: 12 }}>
                <Skeleton width="40%" height={12} />
                <Skeleton width="55%" height={30} />
                <Skeleton width="80%" height={12} />
              </div>
            </Card>
          ))
        ) : (
          <>
            <StatusCard
              title="NRS Circuit State"
              value={circuit.label}
              detail="Circuit breaker state for downstream NRS stamping calls"
              status={circuit}
            />
            <StatusCard
              title="DLQ Depth"
              value={formatDepth(parsedMetrics.dlqDepth)}
              detail="Current dead-letter queue backlog across monitored queues"
              status={parsedMetrics.dlqDepth !== null && parsedMetrics.dlqDepth > 10 ? { label: 'Attention', tone: 'warning', icon: '▲' } : { label: 'Stable', tone: 'success', icon: '●' }}
            />
            <StatusCard
              title="Last NRS Stamp"
              value={formatTimestamp(parsedMetrics.lastNrsStampAt)}
              detail="Most recent recorded NRS stamping activity from available metrics"
              status={parsedMetrics.lastNrsStampAt ? { label: 'Recorded', tone: 'info', icon: '◉' } : { label: 'Unavailable', tone: 'neutral', icon: '○' }}
            />
            <StatusCard
              title="P99 Latency"
              value={formatLatency(parsedMetrics.p99LatencySeconds)}
              detail="Approximate request latency derived from Prometheus histogram buckets"
              status={parsedMetrics.p99LatencySeconds !== null && parsedMetrics.p99LatencySeconds > 2 ? { label: 'Slow', tone: 'warning', icon: '▲' } : { label: 'Within target', tone: 'success', icon: '●' }}
            />
            <StatusCard
              title="Platform Health"
              value={monitoring?.status ?? 'unknown'}
              detail={`Snapshot taken ${formatTimestamp(monitoring?.timestamp)}`}
              status={platformStatus}
            />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr)' }}>
        <Card title="Monitoring Checks" description="Database and Redis check outcomes from the canonical health endpoint.">
          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <Skeleton height={14} width="65%" />
              <Skeleton height={14} width="45%" />
              <Skeleton height={120} width="100%" />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone={platformStatus.tone}><span aria-hidden="true">{platformStatus.icon}</span> {platformStatus.label}</Badge>
                <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Updated {formatTimestamp(monitoring?.timestamp)}</span>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {Object.entries(monitoring?.checks ?? {}).map(([name, value]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                    <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{name}</span>
                    <Badge tone={value === 'ok' ? 'success' : 'warning'}><span aria-hidden="true">{value === 'ok' ? '●' : '▲'}</span> {value}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Raw Metrics" description="Prometheus output from the protected metrics endpoint for debugging and verification.">
          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <Skeleton height={14} width="40%" />
              <Skeleton height={180} width="100%" />
            </div>
          ) : (
            <pre style={{ background: 'var(--surface-muted)', padding: 16, borderRadius: 16, overflowX: 'auto', fontSize: 12, color: 'var(--foreground-soft)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {metrics?.raw ?? 'No metrics available'}
            </pre>
          )}
        </Card>
      </div>
    </div>
  );
}
