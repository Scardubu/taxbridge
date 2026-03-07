'use client';

/**
 * Admin Analytics — TaxBridge V13 Sovereign
 *
 * 5 panels: revenue trends | compliance rate | risk distribution |
 *           NRS stamp health | platform growth
 *
 * - Fetches from GET /api/v2/analytics/* — never calls Prisma/buildIntelligenceInput (service boundary)
 * - Promise.all for all 5 fetch calls; every .catch(() => FALLBACK_*)
 * - Charts via Recharts; all panels implement WCAG 2.2 AA:
 *     C-15: colour + label + shape three-channel rule (never colour alone)
 */

import { useEffect, useState } from 'react';

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts';

// ─── WCAG-AA palette: 4.5:1 contrast; each slice has colour + glyph ──────────
const RISK_COLORS: Record<string, { fill: string; glyph: string; label: string }> = {
  low:      { fill: '#16A34A', glyph: '●', label: 'Low Risk'      },
  medium:   { fill: '#D97706', glyph: '■', label: 'Medium Risk'   },
  high:     { fill: '#EA580C', glyph: '▲', label: 'High Risk'     },
  critical: { fill: '#DC2626', glyph: '★', label: 'Critical Risk' },
};

const NRS_COLORS: Record<string, string> = {
  success: '#16A34A',
  failed:  '#DC2626',
  pending: '#D97706',
};

// ─── Fallback data ────────────────────────────────────────────────────────────
const FALLBACK_REVENUE    = { trend: [] as any[], totalRevenue: 0, period: '' };
const FALLBACK_COMPLIANCE = { rate: 0, breakdown: {} as Record<string, number> };
const FALLBACK_RISK       = { distribution: [] as any[] };
const FALLBACK_NRS        = { trend: [] as any[], successRate: 0 };
const FALLBACK_GROWTH     = { trend: [] as any[], totalUsers: 0, totalOrgs: 0 };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
      aria-label={title}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 20, margin: '0 0 20px' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function LoadingPanel({ title }: { title: string }) {
  return (
    <Panel title={title}>
      <div
        style={{ height: 200, background: '#F3F4F6', borderRadius: 8, animation: 'pulse 1.5s infinite' }}
        aria-busy="true"
        aria-label={`Loading ${title}`}
      />
    </Panel>
  );
}

// ─── Custom legend with glyph + colour + label (three-channel) ───────────────
function ThreeChannelLegend({ items }: { items: Array<{ fill: string; glyph: string; label: string }> }) {
  return (
    <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {items.map((item) => (
        <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: item.fill, fontWeight: 700, fontSize: 14 }} aria-hidden="true">
            {item.glyph}
          </span>
          <span style={{ fontSize: 13, color: '#374151' }}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [revenue,    setRevenue]    = useState<typeof FALLBACK_REVENUE   | null>(null);
  const [compliance, setCompliance] = useState<typeof FALLBACK_COMPLIANCE | null>(null);
  const [risk,       setRisk]       = useState<typeof FALLBACK_RISK      | null>(null);
  const [nrs,        setNrs]        = useState<typeof FALLBACK_NRS       | null>(null);
  const [growth,     setGrowth]     = useState<typeof FALLBACK_GROWTH    | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJson('/api/v2/analytics/revenue',    FALLBACK_REVENUE),
      fetchJson('/api/v2/analytics/compliance', FALLBACK_COMPLIANCE),
      fetchJson('/api/v2/analytics/risk',       FALLBACK_RISK),
      fetchJson('/api/v2/analytics/nrs-health', FALLBACK_NRS),
      fetchJson('/api/v2/analytics/growth',     FALLBACK_GROWTH),
    ]).then(([rev, comp, rsk, n, g]) => {
      setRevenue(rev);
      setCompliance(comp);
      setRisk(rsk);
      setNrs(n);
      setGrowth(g);
    }).catch(() => {
      setRevenue(FALLBACK_REVENUE);
      setCompliance(FALLBACK_COMPLIANCE);
      setRisk(FALLBACK_RISK);
      setNrs(FALLBACK_NRS);
      setGrowth(FALLBACK_GROWTH);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))' }}>
        {['Revenue Trends', 'Compliance Rate', 'Risk Distribution', 'NRS Stamp Health', 'Platform Growth']
          .map((t) => <LoadingPanel key={t} title={t} />)}
      </div>
    );
  }

  const riskItems = (risk?.distribution ?? []).map((d: any) => ({
    ...d,
    ...(RISK_COLORS[d.band] ?? { fill: '#6B7280', glyph: '●', label: d.band }),
  }));

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 28 }}>
        Analytics
      </h1>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))' }}>

        {/* Panel 1: Revenue Trends — line chart */}
        <Panel title="Revenue Trends">
          {(revenue?.trend?.length ?? 0) === 0 ? (
            <p style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>No revenue data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenue!.trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₦${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => [`₦${(v / 1e6).toFixed(2)}M`, 'Revenue']} />
                  <Line
                    type="monotone"
                    dataKey="totalRevenue"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Revenue (NGN)"
                  />
                </LineChart>
              </ResponsiveContainer>
              <ThreeChannelLegend items={[{ fill: '#2563EB', glyph: '●', label: 'Monthly Revenue' }]} />
            </>
          )}
        </Panel>

        {/* Panel 2: Compliance Rate — bar chart by tax type */}
        <Panel title="Compliance Rate">
          {Object.keys(compliance?.breakdown ?? {}).length === 0 ? (
            <p style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>No compliance data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={Object.entries(compliance!.breakdown).map(([k, v]) => ({ name: k, rate: v }))}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Compliance']} />
                  <Bar dataKey="rate" fill="#16A34A" radius={[4, 4, 0, 0]} name="Compliance Rate">
                    <LabelList dataKey="rate" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <ThreeChannelLegend items={[{ fill: '#16A34A', glyph: '■', label: 'Compliance Rate by Tax Type' }]} />
              <p style={{ fontSize: 13, color: '#374151', marginTop: 8 }}>
                Overall: <strong>{compliance!.rate.toFixed(1)}%</strong>
              </p>
            </>
          )}
        </Panel>

        {/* Panel 3: Risk Distribution — pie chart with three-channel legend */}
        <Panel title="Risk Distribution">
          {riskItems.length === 0 ? (
            <p style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>No risk data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={riskItems}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    labelLine={false}
                    label={({ name, percent }: any) =>
                      percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                    }
                  >
                    {riskItems.map((entry: any, i: number) => (
                      <Cell key={`risk-${i}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
              <ThreeChannelLegend items={riskItems} />
            </>
          )}
        </Panel>

        {/* Panel 4: NRS Stamp Health — stacked bar */}
        <Panel title="NRS Stamp Health">
          {(nrs?.trend?.length ?? 0) === 0 ? (
            <p style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>No NRS data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={nrs!.trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="success" stackId="a" fill={NRS_COLORS.success} name="✓ Success" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed"  stackId="a" fill={NRS_COLORS.failed}  name="✕ Failed"  radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pending" stackId="a" fill={NRS_COLORS.pending} name="⏳ Pending" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <ThreeChannelLegend items={[
                { fill: NRS_COLORS.success, glyph: '●', label: 'Success'  },
                { fill: NRS_COLORS.failed,  glyph: '▲', label: 'Failed'   },
                { fill: NRS_COLORS.pending, glyph: '■', label: 'Pending'  },
              ]} />
              <p style={{ fontSize: 13, color: '#374151', marginTop: 8 }}>
                Success rate: <strong>{nrs!.successRate.toFixed(1)}%</strong>
              </p>
            </>
          )}
        </Panel>

        {/* Panel 5: Platform Growth — line chart (users + orgs) */}
        <Panel title="Platform Growth">
          {(growth?.trend?.length ?? 0) === 0 ? (
            <p style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>No growth data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={growth!.trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="users" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} name="Users" />
                  <Line type="monotone" dataKey="orgs"  stroke="#0EA5E9" strokeWidth={2} dot={{ r: 3, fill: '#0EA5E9' }} strokeDasharray="5 3" name="Orgs" />
                </LineChart>
              </ResponsiveContainer>
              <ThreeChannelLegend items={[
                { fill: '#7C3AED', glyph: '●', label: `Users (total: ${growth!.totalUsers.toLocaleString()})` },
                { fill: '#0EA5E9', glyph: '■', label: `Orgs  (total: ${growth!.totalOrgs.toLocaleString()})`  },
              ]} />
            </>
          )}
        </Panel>

      </div>
    </div>
  );
}
