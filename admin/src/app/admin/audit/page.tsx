'use client';

/**
 * Admin Audit Log — TaxBridge V13 Sovereign
 *
 * - Cursor-paginated AuditEvent viewer
 * - NDJSON streaming export button (ADMIN+)
 * - Fetches from backend API — never calls Prisma directly
 */

import { useState, useCallback, useEffect } from 'react';

interface AuditEvent {
  id:         string;
  action:     string;
  userId?:    string;
  orgId?:     string;
  resourceId?: string;
  metadata?:  Record<string, unknown>;
  createdAt:  string;
}

interface AuditPage {
  data:       AuditEvent[];
  meta?: {
    nextCursor?: string | null;
    hasNextPage?: boolean;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function fetchAuditPage(cursor?: string): Promise<AuditPage> {
  const url = cursor
    ? `${API_BASE}/api/v2/audit?cursor=${encodeURIComponent(cursor)}&limit=50`
    : `${API_BASE}/api/v2/audit?limit=50`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Audit fetch failed: ${res.status}`);
  return res.json() as Promise<AuditPage>;
}

// ─── Action badge ─────────────────────────────────────────────────────────────
const ACTION_BADGE: Record<string, { bg: string; color: string }> = {
  FILE:             { bg: '#DBEAFE', color: '#1D4ED8' },
  LOGIN:            { bg: '#DCFCE7', color: '#15803D' },
  LOGOUT:           { bg: '#F3F4F6', color: '#374151' },
  ROLE_CHANGE:      { bg: '#FEF3C7', color: '#92400E' },
  ACCESS_DENIED:    { bg: '#FEE2E2', color: '#991B1B' },
  PAYMENT_RECEIVED: { bg: '#DCFCE7', color: '#15803D' },
  DOWNLOAD:         { bg: '#EDE9FE', color: '#6D28D9' },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_BADGE[action] ?? { bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{
      backgroundColor: cfg.bg,
      color:           cfg.color,
      borderRadius:    6,
      padding:         '2px 8px',
      fontSize:        12,
      fontWeight:      600,
      fontFamily:      'monospace',
    }}>
      {action}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── NDJSON export ────────────────────────────────────────────────────────────
async function handleExport() {
  const url = `${API_BASE}/api/v2/audit/export`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    alert('Export failed: ' + res.status);
    return;
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.ndjson`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const [events,     setEvents]     = useState<AuditEvent[]>([]);
  const [cursor,     setCursor]     = useState<string | null | undefined>(undefined);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [hasMore,    setHasMore]    = useState(true);
  const [exporting,  setExporting]  = useState(false);
  const [initialized, setInitialized] = useState(false);

  const loadPage = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchAuditPage(nextCursor);
      setEvents((prev) => nextCursor ? [...prev, ...page.data] : page.data);
      setCursor(page.meta?.nextCursor ?? null);
      setHasMore((page.meta?.nextCursor ?? null) !== null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load audit log');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!initialized && !loading) {
      void loadPage();
    }
  }, [initialized, loading, loadPage]);

  const onExport = async () => {
    setExporting(true);
    await handleExport();
    setExporting(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Audit Log</h1>
        <button
          onClick={onExport}
          disabled={exporting}
          style={{
            padding:         '8px 16px',
            backgroundColor: '#1E3A5F',
            color:           '#fff',
            border:          'none',
            borderRadius:    8,
            fontWeight:      600,
            fontSize:        13,
            cursor:          exporting ? 'wait' : 'pointer',
            opacity:         exporting ? 0.7 : 1,
          }}
          aria-label="Export audit log as NDJSON"
        >
          {exporting ? 'Exporting…' : '⬇ Export NDJSON'}
        </button>
      </div>

      {error && (
        <div role="alert" style={{ background: '#FEE2E2', color: '#991B1B', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} aria-label="Audit events">
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Timestamp', 'Action', 'Actor', 'Org', 'Target'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>
                  No audit events found.
                </td>
              </tr>
            )}
            {events.map((ev) => (
              <tr key={ev.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '10px 16px', color: '#6B7280', fontFamily: 'monospace', fontSize: 11 }}>
                  {formatDate(ev.createdAt)}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <ActionBadge action={ev.action} />
                </td>
                <td style={{ padding: '10px 16px', color: '#111827' }}>
                  {ev.userId ?? 'system'}
                </td>
                <td style={{ padding: '10px 16px', color: '#6B7280', fontFamily: 'monospace', fontSize: 11 }}>
                  {ev.orgId ? `${ev.orgId.slice(0, 8)}…` : '—'}
                </td>
                <td style={{ padding: '10px 16px', color: '#6B7280', fontFamily: 'monospace', fontSize: 11 }}>
                  {ev.resourceId ? `${ev.resourceId.slice(0, 8)}…` : '—'}
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6B7280' }} aria-live="polite">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Load more (cursor pagination) */}
      {hasMore && !loading && events.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => loadPage(cursor ?? undefined)}
            style={{
              padding:         '10px 24px',
              backgroundColor: '#F3F4F6',
              color:           '#111827',
              border:          '1px solid #E5E7EB',
              borderRadius:    8,
              fontWeight:      600,
              fontSize:        13,
              cursor:          'pointer',
            }}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
