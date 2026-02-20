'use client';

/**
 * NRS Operations Center — TaxBridge V3.0
 *
 * Real-time admin view of all NRS (Nigeria Revenue Service) submission activity.
 * Surfaces queue health, failed submissions, and IRN audit data.
 *
 * Data refresh: every 10 s (queues/summary) | 30 s (failed submissions)
 * Cold-start safe: all SWR calls use fallbackData to avoid blank renders.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SkeletonCard } from '@/components/ui/skeleton-table';
import { fetchJson, FetchError } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';
import { safeDate } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueueInfo {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  status: 'healthy' | 'degraded' | 'unavailable';
}

interface QueueHealthResponse {
  success: boolean;
  data: {
    status: string;
    queues: Record<string, QueueInfo>;
  };
  timestamp: string;
}

interface NrsSummary {
  success: boolean;
  data: {
    total: number;
    last24h: { successful: number; failed: number; pending: number };
  };
  timestamp: string;
}

interface FailedInvoice {
  id: string;
  invoiceNumber: string;
  nrsStatus: string;
  nrsSubmittedAt: string | null;
  nrsError: string | null;
  totalAmount: number;
  updatedAt: string;
  userId: string;
}

interface FailedSubmissionsResponse {
  success: boolean;
  data: {
    invoices: FailedInvoice[];
    pagination: { page: number; limit: number; total: number; pages: number };
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const adminFetcher = <T,>(url: string): Promise<T> =>
  fetchJson<T>(url, {
    headers: { 'x-admin-api-key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '' },
  });

function statusBadge(status: string) {
  const map: Record<string, string> = {
    healthy:     'bg-green-100 text-green-800',
    degraded:    'bg-yellow-100 text-yellow-800',
    unavailable: 'bg-gray-100 text-gray-600',
    SUBMITTED:   'bg-green-100 text-green-800',
    FAILED:      'bg-red-100 text-red-800',
    PENDING:     'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG').format(n);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NRSHealthBanner({ summary }: { summary: NrsSummary | undefined }) {
  const { t } = useAdminI18n();
  if (!summary) return <SkeletonCard className="h-20 mb-6" />;
  const { successful, failed, pending } = summary.data.last24h;
  const allGood = failed === 0 && pending < 5;
  return (
    <Alert className={`mb-6 border ${allGood ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <AlertTitle className="font-semibold">
        {t('nrsOps.health.title')}
      </AlertTitle>
      <AlertDescription className="mt-1 flex gap-6 text-sm">
        <span className="text-green-700">✓ {t('nrsOps.health.successful', { count: fmt(successful) })}</span>
        <span className={failed > 0 ? 'text-red-700 font-medium' : 'text-gray-500'}>
          ✗ {t('nrsOps.health.failed', { count: fmt(failed) })}
        </span>
        <span className="text-yellow-700">⏳ {t('nrsOps.health.pending', { count: fmt(pending) })}</span>
        <span className="text-gray-500">{t('nrsOps.health.total', { count: fmt(summary.data.total) })}</span>
      </AlertDescription>
    </Alert>
  );
}

function QueueStatusGrid({ health }: { health: QueueHealthResponse | undefined }) {
  const { t } = useAdminI18n();
  if (!health) return <SkeletonCard className="h-48 mb-6" />;
  const queues = Object.values(health.data.queues);
  if (queues.length === 0) {
    return (
      <div className="mb-6 text-sm text-gray-500 bg-gray-50 border rounded p-4">
        {t('nrsOps.queue.unavailable')}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
      {queues.map((q) => (
        <Card key={q.name} className="border">
          <CardHeader className="py-3 px-4 pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-gray-500 truncate">
              {q.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              {statusBadge(q.status)}
              {q.failed > 0 && (
                <span className="text-xs text-red-600 font-medium">{t('nrsOps.queue.failedCount', { count: q.failed })}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs text-gray-500">
              <div><div className="font-medium text-gray-800 text-sm">{fmt(q.waiting)}</div>{t('nrsOps.queue.waiting')}</div>
              <div><div className="font-medium text-gray-800 text-sm">{fmt(q.active)}</div>{t('nrsOps.queue.active')}</div>
              <div><div className="font-medium text-gray-800 text-sm">{fmt(q.completed)}</div>{t('nrsOps.queue.done')}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FailedSubmissionsTable({
  data,
  onResubmit,
  resubmitting,
}: {
  data: FailedSubmissionsResponse | undefined;
  onResubmit: (id: string) => void;
  resubmitting: string | null;
}) {
  const { t } = useAdminI18n();
  if (!data) return <SkeletonCard className="h-64" />;
  const invoices = data.data.invoices;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          {t('nrsOps.table.heading')}
        </h3>
        <span className="text-xs text-gray-400">
          {t('nrsOps.table.totalCount', { count: data.data.pagination.total })}
        </span>
      </div>
      {invoices.length === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-50 rounded p-6 text-center">
          {t('nrsOps.table.empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{t('nrsOps.table.col.invoice')}</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{t('nrsOps.table.col.status')}</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{t('nrsOps.table.col.amount')}</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{t('nrsOps.table.col.error')}</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{t('nrsOps.table.col.updated')}</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{t('nrsOps.table.col.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">{statusBadge(inv.nrsStatus)}</td>
                  <td className="px-4 py-3">{fmt(inv.totalAmount)}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="text-xs text-red-600 truncate block" title={inv.nrsError || ''}>
                      {inv.nrsError || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {safeDate(inv.updatedAt, { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onResubmit(inv.id)}
                      disabled={resubmitting === inv.id}
                      className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {resubmitting === inv.id ? t('nrsOps.table.queuing') : t('nrsOps.table.resubmit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NrsOperationsPage() {
  const { t } = useAdminI18n();
  const [resubmitting, setResubmitting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  // Real-time queue health — 10 s refresh
  const { data: queueHealth } = useSWR<QueueHealthResponse>(
    `${API_BASE}/api/admin/nrs/queue-status`,
    adminFetcher,
    {
      refreshInterval: 10_000,
      fallbackData: { success: true, data: { status: 'unavailable', queues: {} }, timestamp: '' },
      onErrorRetry: (_err, _key, _cfg, revalidate, { retryCount }) => {
        if (retryCount < 5) setTimeout(() => revalidate({ retryCount }), 5_000);
      },
    },
  );

  // NRS summary stats — 10 s refresh
  const { data: summary } = useSWR<NrsSummary>(
    `${API_BASE}/api/admin/nrs/summary`,
    adminFetcher,
    {
      refreshInterval: 10_000,
      fallbackData: {
        success: true,
        data: { total: 0, last24h: { successful: 0, failed: 0, pending: 0 } },
        timestamp: '',
      },
    },
  );

  // Failed submissions — 30 s refresh
  const { data: failedData, mutate: refetchFailed } = useSWR<FailedSubmissionsResponse>(
    `${API_BASE}/api/admin/nrs/failed-submissions?limit=20`,
    adminFetcher,
    {
      refreshInterval: 30_000,
      fallbackData: {
        success: true,
        data: { invoices: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } },
      },
    },
  );

  async function handleResubmit(invoiceId: string) {
    setResubmitting(invoiceId);
    setToast(null);
    try {
      await fetchJson(`${API_BASE}/api/admin/nrs/resubmit/${invoiceId}`, {
        method: 'POST',
        headers: { 'x-admin-api-key': process.env.NEXT_PUBLIC_ADMIN_API_KEY || '' },
      });
      setToast({ message: `Invoice ${invoiceId.slice(0, 8)}… re-queued`, ok: true });
      await refetchFailed();
    } catch (err: unknown) {
      const msg = err instanceof FetchError ? err.message : 'Resubmit failed';
      setToast({ message: msg, ok: false });
    } finally {
      setResubmitting(null);
      setTimeout(() => setToast(null), 5_000);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('nrsOps.pageTitle')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('nrsOps.pageDesc')}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {t('nrsOps.autoRefresh')}
          </Badge>
        </div>

        {/* Toast notification */}
        {toast && (
          <div
            className={`mb-4 px-4 py-3 rounded text-sm font-medium ${
              toast.ok
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Health Banner */}
        <NRSHealthBanner summary={summary} />

        {/* Queue Grid */}
        <Card className="mb-6 border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t('nrsOps.queue.section')}</CardTitle>
          </CardHeader>
          <CardContent>
            <QueueStatusGrid health={queueHealth} />
          </CardContent>
        </Card>

        {/* Failed Submissions */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t('nrsOps.table.section')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FailedSubmissionsTable
              data={failedData}
              onResubmit={handleResubmit}
              resubmitting={resubmitting}
            />
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="mt-4 text-xs text-gray-400 text-center">
          {t('nrsOps.footer')}
        </p>
      </div>
    </DashboardLayout>
  );
}
