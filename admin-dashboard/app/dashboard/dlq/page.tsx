'use client';

import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchJson } from '@/lib/fetcher';
import { AlertTriangle } from 'lucide-react';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  dlqDepth?: number;
}

interface DLQResponse {
  fallback?: boolean;
  status?: string;
  error?: string;
  timestamp?: string;
  nrs: {
    waiting: number;
    active: number;
    failed: number;
    completed: number;
    delayed: number;
    successRate: number | null;
    healthy: boolean;
  };
  queues: QueueStats[];
}

const DLQ_KEY = '/api/admin/health/queues';

export default function DLQPage() {
  const { data, error, isLoading } = useSWR<DLQResponse>(DLQ_KEY, fetchJson, { refreshInterval: 30_000 });

  const queues = data?.queues ?? [];
  const nrs = data?.nrs;
  const derivedDepth = queues.reduce((sum, queue) => sum + (queue.dlqDepth ?? queue.failed), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dead Letter Queue</h1>
          {derivedDepth > 10 && (
            <Alert variant="destructive" className="w-auto">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Queue depth {derivedDepth} — incident review recommended</AlertDescription>
            </Alert>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load DLQ data</AlertDescription>
          </Alert>
        )}

        {data?.fallback && (
          <Alert>
            <AlertDescription>
              Queue telemetry is running in fallback mode while backend health services warm up or remain unavailable.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Derived DLQ Depth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{derivedDepth}</div>
              <p className="text-xs text-slate-500 mt-1">Failed or dead-lettered queue items across monitored queues.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">NRS Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600">{nrs?.failed ?? 0}</div>
              <p className="text-xs text-slate-500 mt-1">Submission failures currently recorded in the NRS queue.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">NRS Delayed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{nrs?.delayed ?? 0}</div>
              <p className="text-xs text-slate-500 mt-1">Jobs delayed but not yet terminally failed.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {typeof nrs?.successRate === 'number' ? `${Math.round(nrs.successRate * 100)}%` : '—'}
              </div>
              <p className="text-xs text-slate-500 mt-1">Based on completed versus failed NRS jobs.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Queue Failure Surface ({queues.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : queues.length === 0 ? (
              <p className="text-muted-foreground">No queue telemetry available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Queue</th>
                      <th className="text-left p-2">Waiting</th>
                      <th className="text-left p-2">Active</th>
                      <th className="text-left p-2">Delayed</th>
                      <th className="text-left p-2">Failed</th>
                      <th className="text-left p-2">Completed</th>
                      <th className="text-left p-2">DLQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queues.map((queue) => (
                      <tr key={queue.name} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{queue.name}</td>
                        <td className="p-2">{queue.waiting}</td>
                        <td className="p-2">{queue.active}</td>
                        <td className="p-2 text-amber-700">{queue.delayed}</td>
                        <td className="p-2 text-rose-700 font-medium">{queue.failed}</td>
                        <td className="p-2 text-emerald-700">{queue.completed}</td>
                        <td className="p-2 font-medium">{queue.dlqDepth ?? queue.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-4">
              Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'n/a'}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
