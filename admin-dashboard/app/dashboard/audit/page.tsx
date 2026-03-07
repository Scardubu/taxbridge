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
  resource: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AuditResponse {
  data: AuditEvent[];
  meta: { nextCursor: string | null; hasNextPage: boolean; total: number | null; pageSize: number };
}

const ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'FILE', 'AMEND', 'APPROVE', 'OVERRIDE',
  'REVOKE', 'INVITE', 'EXPORT', 'ACCESS_DENIED', 'ROLE_CHANGE',
  'LOGIN', 'LOGOUT', 'NRS_STAMP', 'PAYMENT_RECEIVED', 'SECURITY_ALERT',
];

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (actionFilter.length > 0) params.set('action', actionFilter.join(','));
  if (cursor) params.set('cursor', cursor);
  params.set('pageSize', '50');

  const queryKey = `/api/v2/admin/audit?${params.toString()}`;
  const { data, error, isLoading } = useSWR<AuditResponse>(queryKey, fetchJson);

  const events = data?.data ?? [];

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/admin/audit/export', {
        headers: { 'Authorization': `Bearer ${document.cookie.match(/token=([^;]+)/)?.[1] ?? ''}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* handled */ }
  }, []);

  const toggleAction = useCallback((action: string) => {
    setActionFilter(prev =>
      prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]
    );
    setCursor(null);
  }, []);

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

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
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
                      <th className="text-left p-2">Resource</th>
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
                        <td className="p-2">{event.resource ?? '—'}</td>
                        <td className="p-2 max-w-[300px] truncate font-mono text-xs">
                          {JSON.stringify(event.metadata).slice(0, 100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data?.meta?.hasNextPage && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" onClick={() => setCursor(data.meta.nextCursor)}>
                  Load More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
