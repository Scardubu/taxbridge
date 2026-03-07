'use client';

/**
 * Admin DLQ — TaxBridge V13 Sovereign
 *
 * - List DLQ jobs with status, queue, failure reason
 * - Retry (single job)
 * - Resolve (mark resolved)
 * - Bulk retry > 10 requires require2FA (enforced by backend — 403 if not verified)
 * - Fetches from backend API — never calls Prisma directly
 */

import { useState, useCallback, useEffect } from 'react';

interface DLQJob {
  id:          string;
  queue:       string;
  jobId:       string;
  failReason:  string;
  attempts:    number;
  lastAttempt: string;
  status:      'FAILED' | 'RESOLVED' | 'RETRYING';
}

interface DLQResponse {
  data:       DLQJob[];
  meta: {
    total:       number;
    nextCursor:  string | null;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function fetchDLQ(): Promise<DLQResponse> {
  const res = await fetch(`${API_BASE}/api/v2/dlq`, { credentials: 'include' });
  if (!res.ok) throw new Error(`DLQ fetch failed: ${res.status}`);
  return res.json() as Promise<DLQResponse>;
}

async function retryJob(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v2/dlq/${id}/retry`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(body?.error ?? `Retry failed: ${res.status}`);
  }
}

async function resolveJob(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v2/dlq/${id}/resolve`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(body?.error ?? `Resolve failed: ${res.status}`);
  }
}

async function bulkRetry(ids: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v2/dlq/bulk-retry`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ ids }),
  });
  if (res.status === 403) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(body?.error === 'TOTP_REQUIRED'
      ? '2FA verification required for bulk retry of > 10 jobs. Please verify your TOTP first.'
      : `Forbidden: ${body?.error ?? res.status}`);
  }
  if (!res.ok) throw new Error(`Bulk retry failed: ${res.status}`);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  FAILED:   { bg: '#FEE2E2', color: '#991B1B', label: '✕ Failed'   },
  RESOLVED: { bg: '#DCFCE7', color: '#15803D', label: '✓ Resolved' },
  RETRYING: { bg: '#FEF3C7', color: '#92400E', label: '⟳ Retrying' },
};

export default function DLQPage() {
  const [jobs,      setJobs]      = useState<DLQJob[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [working,   setWorking]   = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDLQ();
      setJobs(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleRetry = useCallback(async (id: string) => {
    setWorking(id);
    try {
      await retryJob(id);
      showToast('Job queued for retry');
      await loadJobs();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setWorking(null);
    }
  }, [loadJobs, showToast]);

  const handleResolve = useCallback(async (id: string) => {
    setWorking(id);
    try {
      await resolveJob(id);
      showToast('Job marked as resolved');
      await loadJobs();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setWorking(null);
    }
  }, [loadJobs, showToast]);

  const handleBulkRetry = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setWorking('bulk');
    try {
      await bulkRetry(ids);
      showToast(`${ids.length} job(s) queued for retry`);
      setSelected(new Set());
      await loadJobs();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setWorking(null);
    }
  }, [selected, loadJobs, showToast]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const failedJobs = jobs.filter((j) => j.status === 'FAILED');

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position:        'fixed',
            bottom:          24,
            right:           24,
            background:      '#1E3A5F',
            color:           '#fff',
            padding:         '12px 20px',
            borderRadius:    10,
            fontSize:        13,
            fontWeight:      600,
            zIndex:          9999,
            boxShadow:       '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Dead Letter Queue</h1>
          <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
            {failedJobs.length} failed job{failedJobs.length !== 1 ? 's' : ''}
            {failedJobs.length > 10 && (
              <span style={{ color: '#DC2626', fontWeight: 700 }}> — ▲ Requires 2FA for bulk retry</span>
            )}
          </p>
        </div>

        {selected.size > 0 && (
          <button
            onClick={handleBulkRetry}
            disabled={working === 'bulk'}
            style={{
              padding:         '8px 16px',
              backgroundColor: selected.size > 10 ? '#DC2626' : '#1E3A5F',
              color:           '#fff',
              border:          'none',
              borderRadius:    8,
              fontWeight:      600,
              fontSize:        13,
              cursor:          working === 'bulk' ? 'wait' : 'pointer',
              opacity:         working === 'bulk' ? 0.7 : 1,
            }}
            title={selected.size > 10 ? 'Requires 2FA — backend will enforce' : undefined}
          >
            {working === 'bulk' ? 'Retrying…' : `⟳ Retry ${selected.size} selected${selected.size > 10 ? ' (2FA required)' : ''}`}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" style={{ background: '#FEE2E2', color: '#991B1B', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          {error}
          <button onClick={loadJobs} style={{ marginLeft: 16, textDecoration: 'underline', background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} aria-label="DLQ jobs">
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              <th scope="col" style={{ padding: '10px 16px', width: 36 }}>
                <span className="sr-only">Select</span>
              </th>
              {['Status', 'Queue', 'Job ID', 'Fail Reason', 'Attempts', 'Last Attempt', 'Actions'].map((h) => (
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
            {loading && (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#6B7280' }} aria-live="polite">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && jobs.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>
                  ✓ No jobs in the dead letter queue
                </td>
              </tr>
            )}
            {jobs.map((job) => {
              const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE.FAILED;
              const isWorking = working === job.id;
              return (
                <tr
                  key={job.id}
                  style={{ borderBottom: '1px solid #F3F4F6', background: selected.has(job.id) ? '#EFF6FF' : undefined }}
                >
                  <td style={{ padding: '10px 16px' }}>
                    {job.status === 'FAILED' && (
                      <input
                        type="checkbox"
                        checked={selected.has(job.id)}
                        onChange={() => toggleSelect(job.id)}
                        aria-label={`Select job ${job.jobId}`}
                      />
                    )}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ background: badge.bg, color: badge.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#111827', fontWeight: 600 }}>
                    {job.queue}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#6B7280', fontFamily: 'monospace', fontSize: 11 }}>
                    {job.jobId.slice(0, 12)}…
                  </td>
                  <td style={{ padding: '10px 16px', color: '#374151', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.failReason}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#6B7280', textAlign: 'center' }}>
                    {job.attempts}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#6B7280', fontSize: 11 }}>
                    {formatDate(job.lastAttempt)}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {job.status === 'FAILED' && (
                        <>
                          <button
                            onClick={() => handleRetry(job.id)}
                            disabled={!!working}
                            style={{
                              padding: '4px 10px', fontSize: 12, fontWeight: 600,
                              background: '#EFF6FF', color: '#1D4ED8',
                              border: '1px solid #BFDBFE', borderRadius: 6, cursor: working ? 'wait' : 'pointer',
                              opacity: working ? 0.6 : 1,
                            }}
                            aria-label={`Retry job ${job.jobId}`}
                          >
                            {isWorking ? '…' : '⟳ Retry'}
                          </button>
                          <button
                            onClick={() => handleResolve(job.id)}
                            disabled={!!working}
                            style={{
                              padding: '4px 10px', fontSize: 12, fontWeight: 600,
                              background: '#F0FDF4', color: '#15803D',
                              border: '1px solid #BBF7D0', borderRadius: 6, cursor: working ? 'wait' : 'pointer',
                              opacity: working ? 0.6 : 1,
                            }}
                            aria-label={`Resolve job ${job.jobId}`}
                          >
                            ✓ Resolve
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
