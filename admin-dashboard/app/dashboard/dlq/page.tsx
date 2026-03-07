'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchJson } from '@/lib/fetcher';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface DLQJob {
  id: string;
  queue: string;
  jobId: string;
  failReason: string;
  attempts: number;
  lastAttempt: string;
  payload: Record<string, unknown>;
}

interface DLQResponse {
  data: DLQJob[];
  meta: { nextCursor: string | null; hasNextPage: boolean; total: number | null; pageSize: number };
}

const DLQ_KEY = '/api/v2/admin/dlq';

export default function DLQPage() {
  const [retrying, setRetrying] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const { data, error, isLoading } = useSWR<DLQResponse>(DLQ_KEY, fetchJson, { refreshInterval: 30_000 });

  const handleRetry = useCallback(async (id: string) => {
    setRetrying(id);
    try {
      await fetchJson(`/api/v2/admin/dlq/${id}/retry`, { method: 'POST' });
      mutate(DLQ_KEY);
    } catch { /* toast handled by fetcher */ }
    setRetrying(null);
  }, []);

  const handleResolve = useCallback(async (id: string) => {
    setResolving(id);
    try {
      await fetchJson(`/api/v2/admin/dlq/${id}/resolve`, { method: 'POST' });
      mutate(DLQ_KEY);
    } catch { /* toast handled by fetcher */ }
    setResolving(null);
  }, []);

  const jobs = data?.data ?? [];
  const depth = jobs.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dead Letter Queue</h1>
          {depth > 10 && (
            <Alert variant="destructive" className="w-auto">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>DLQ depth {depth} — 2FA required for bulk retry</AlertDescription>
            </Alert>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load DLQ data</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Failed Jobs ({depth})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : jobs.length === 0 ? (
              <p className="text-muted-foreground">No failed jobs</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Queue</th>
                      <th className="text-left p-2">Job ID</th>
                      <th className="text-left p-2">Fail Reason</th>
                      <th className="text-left p-2">Attempts</th>
                      <th className="text-left p-2">Last Attempt</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{job.queue}</td>
                        <td className="p-2 font-mono text-xs">{job.jobId}</td>
                        <td className="p-2 max-w-[300px] truncate" title={job.failReason}>{job.failReason}</td>
                        <td className="p-2">{job.attempts}</td>
                        <td className="p-2">{new Date(job.lastAttempt).toLocaleString()}</td>
                        <td className="p-2 space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retrying === job.id}
                            onClick={() => handleRetry(job.id)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={resolving === job.id}
                            onClick={() => handleResolve(job.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
