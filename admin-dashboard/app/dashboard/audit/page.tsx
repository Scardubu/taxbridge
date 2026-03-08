'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchJson } from '@/lib/fetcher';
import { Download, Filter } from 'lucide-react';

interface AuditEvent {
  id: string;
  orgId: string | null;
  userId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  resource?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  success: boolean;
  logs: AuditEvent[];
  pagination: { page: number; limit: number; total: number; pages: number };
  fallback?: boolean;
}

const ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'FILE', 'AMEND', 'APPROVE', 'OVERRIDE',
  'REVOKE', 'INVITE', 'EXPORT', 'ACCESS_DENIED', 'ROLE_CHANGE',
  'LOGIN', 'LOGOUT', 'NRS_STAMP', 'PAYMENT_RECEIVED', 'SECURITY_ALERT',
];

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (actionFilter.length > 0) params.set('action', actionFilter.join(','));
  params.set('page', String(page));
  params.set('limit', '50');

  const queryKey = `/api/admin/audit?${params.toString()}`;
  const { data, error, isLoading } = useSWR<AuditResponse>(queryKey, fetchJson);

  const events = data?.logs ?? [];

  const handleExport = useCallback(async () => {
    try {
      const blob = new Blob(
        [events.map((event) => JSON.stringify(event)).join('\n')],
        { type: 'application/x-ndjson' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* handled */ }
  }, [events]);

  const toggleAction = useCallback((action: string) => {
    setActionFilter(prev =>
      prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]
    );
    setPage(1);
  }, []);

  const pagination = data?.pagination;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export NDJSON
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter by Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map(action => (
                <Button
                  key={action}
                  size="sm"
                  variant={actionFilter.includes(action) ? 'default' : 'outline'}
                  onClick={() => toggleAction(action)}
                >
                  {action}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load audit events</AlertDescription>
          </Alert>
        )}

        {data?.fallback && (
          <Alert>
            <AlertDescription>Audit data is currently in fallback mode while backend admin services warm up or remain unavailable.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Events {pagination ? `(${pagination.total})` : ''}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : events.length === 0 ? (
              <p className="text-muted-foreground">No audit events match filters</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">Action</th>
                      <th className="text-left p-2">User</th>
                      <th className="text-left p-2">Target</th>
                      <th className="text-left p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(event => (
                      <tr key={event.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</td>
                        <td className="p-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            event.action === 'SECURITY_ALERT' ? 'bg-destructive/10 text-destructive' :
                            event.action === 'ACCESS_DENIED' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {event.action}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-xs">{event.userId?.slice(0, 8) ?? '—'}</td>
                        <td className="p-2">
                          {event.targetType ?? event.resource ?? '—'}
                          {(event.targetId ?? event.resourceId) ? (
                            <span className="ml-2 font-mono text-xs text-slate-500">
                              {(event.targetId ?? event.resourceId)?.slice(0, 8)}
                            </span>
                          ) : null}
                        </td>
                        <td className="p-2 max-w-[300px] truncate font-mono text-xs">
                          {JSON.stringify(event.metadata ?? event.details ?? {}).slice(0, 100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagination && pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Page {pagination.page} of {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    Previous
                  </Button>
                  <Button variant="outline" disabled={pagination.page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
