'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminI18n } from '@/lib/i18n';
import { fetchSyncStats, fetchPendingSyncJobs } from '@/lib/api/devices';
import { 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  XCircle, 
  Clock,
  TrendingUp,
  Activity
} from 'lucide-react';

export default function SyncMonitorPage() {
  const { t } = useAdminI18n();

  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR(
    'sync-stats',
    fetchSyncStats,
    { refreshInterval: 10000 }
  );

  const { data: pendingData, error: pendingError, mutate: mutatePending } = useSWR(
    'pending-sync-jobs',
    () => fetchPendingSyncJobs({ limit: 100 }),
    { refreshInterval: 10000 }
  );

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-orange-600 animate-spin" />;
      case 'conflict':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Activity className="h-4 w-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary'; className?: string }> = {
      synced: { variant: 'default', className: 'bg-green-100 text-green-800' },
      failed: { variant: 'destructive' },
      pending: { variant: 'outline', className: 'bg-blue-50 text-blue-700' },
      processing: { variant: 'outline', className: 'bg-orange-50 text-orange-700' },
      conflict: { variant: 'outline', className: 'bg-yellow-50 text-yellow-700' },
    };

    const config = variants[status] || { variant: 'secondary' as const };
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {status}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('sync.title')}</h1>
            <p className="text-slate-600 mt-2">{t('sync.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => { mutateStats(); mutatePending(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>

        {/* Stats Overview */}
        {statsData && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('sync.stats.totalJobs')}</CardTitle>
                <Activity className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData.stats.syncJobs.total}</div>
                <p className="text-xs text-slate-600 mt-1">
                  All-time sync operations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('sync.stats.syncedJobs')}</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{statsData.stats.syncJobs.synced}</div>
                <p className="text-xs text-slate-600 mt-1">
                  {Math.round((statsData.stats.syncJobs.synced / statsData.stats.syncJobs.total) * 100)}% success rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('sync.stats.failedJobs')}</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{statsData.stats.syncJobs.failed}</div>
                <p className="text-xs text-slate-600 mt-1">
                  {Math.round((statsData.stats.syncJobs.failed / statsData.stats.syncJobs.total) * 100)}% failure rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('sync.stats.conflictJobs')}</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{statsData.stats.syncJobs.conflict}</div>
                <p className="text-xs text-slate-600 mt-1">
                  Requires manual resolution
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">{t('sync.tabs.pending')}</TabsTrigger>
            <TabsTrigger value="stats">{t('sync.tabs.stats')}</TabsTrigger>
          </TabsList>

          {/* Pending Jobs Tab */}
          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('sync.tabs.pending')}</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{t('sync.error')}</AlertDescription>
                  </Alert>
                )}

                {!pendingData && !pendingError && (
                  <div className="text-center py-8 text-slate-600">{t('sync.loading')}</div>
                )}

                {pendingData && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('sync.pending.table.id')}</TableHead>
                        <TableHead>{t('sync.pending.table.device')}</TableHead>
                        <TableHead>{t('sync.pending.table.entity')}</TableHead>
                        <TableHead>{t('sync.pending.table.action')}</TableHead>
                        <TableHead>{t('sync.pending.table.status')}</TableHead>
                        <TableHead>{t('sync.pending.table.created')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingData.jobs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-600">
                            {t('sync.pending.empty')}
                          </TableCell>
                        </TableRow>
                      )}
                      {pendingData.jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}...</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-mono text-xs">{job.device.deviceId.slice(0, 12)}...</div>
                              <Badge variant="outline" className="text-xs mt-1 capitalize">
                                {job.device.platform}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{job.entity}</TableCell>
                          <TableCell className="capitalize">{job.action}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(job.status)}
                              {getStatusBadge(job.status)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{formatTimestamp(job.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            {statsData && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Platform Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {statsData.stats.devices.byPlatform.map((platform) => (
                          <div key={platform.platform} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">{platform.platform}</Badge>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-sm text-slate-600">{platform.count} devices</div>
                              <div className="text-sm font-medium">
                                {Math.round((platform.count / statsData.stats.devices.total) * 100)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Activity (24h)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {statsData.stats.recentActivity.map((activity) => (
                          <div key={activity.status} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(activity.status)}
                              {getStatusBadge(activity.status)}
                            </div>
                            <div className="text-sm font-medium">{activity.count} jobs</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Job Status Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-5">
                      <div className="text-center">
                        <div className="text-sm text-slate-600 mb-2">Pending</div>
                        <div className="text-2xl font-bold text-blue-600">{statsData.stats.syncJobs.pending}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-slate-600 mb-2">Processing</div>
                        <div className="text-2xl font-bold text-orange-600">{statsData.stats.syncJobs.processing}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-slate-600 mb-2">Synced</div>
                        <div className="text-2xl font-bold text-green-600">{statsData.stats.syncJobs.synced}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-slate-600 mb-2">Failed</div>
                        <div className="text-2xl font-bold text-red-600">{statsData.stats.syncJobs.failed}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-slate-600 mb-2">Conflicts</div>
                        <div className="text-2xl font-bold text-yellow-600">{statsData.stats.syncJobs.conflict}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
