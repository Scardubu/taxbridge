'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAdminI18n } from '@/lib/i18n';
import { safeDate } from '@/lib/utils';
import { fetchDevices, fetchSyncStats, forceDeviceSync, type Device } from '@/lib/api/devices';
import { Smartphone, RefreshCw, AlertCircle, CheckCircle2, Users } from 'lucide-react';

export default function DevicesPage() {
  const { t } = useAdminI18n();
  const [page, setPage] = useState(1);
  const [platform, setPlatform] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [forceSyncDevice, setForceSyncDevice] = useState<Device | null>(null);
  const [forceSyncReason, setForceSyncReason] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: devicesData, error: devicesError, mutate: mutateDevices } = useSWR(
    ['devices', page, platform, activeOnly],
    () => fetchDevices({ page, platform: platform || undefined, active: activeOnly || undefined }),
    { refreshInterval: 30000 }
  );

  const { data: statsData, error: statsError } = useSWR(
    'sync-stats',
    fetchSyncStats,
    { refreshInterval: 30000 }
  );

  const handleForceSync = async () => {
    if (!forceSyncDevice) return;

    setIsSyncing(true);
    try {
      await forceDeviceSync(forceSyncDevice.id, forceSyncReason || undefined);
      setForceSyncDevice(null);
      setForceSyncReason('');
      mutateDevices();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Force sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '—';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isDeviceActive = (lastHeartbeat: string | null | undefined) => {
    if (!lastHeartbeat) return false;
    const heartbeat = new Date(lastHeartbeat);
    if (isNaN(heartbeat.getTime())) return false;
    const now = new Date();
    const diffMins = (now.getTime() - heartbeat.getTime()) / 60000;
    return diffMins < 10; // Active if heartbeat within 10 minutes
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('devices.title')}</h1>
          <p className="text-slate-600 mt-2">{t('devices.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/devices/sync">
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('sync.title')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/devices/conflicts">
              <AlertCircle className="h-4 w-4 mr-1" />
              {t('conflicts.title')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/devices/diagnostics">
              {t('devices.diagnostics.cta')}
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        {statsData && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('devices.stats.total')}</CardTitle>
                <Smartphone className="h-4 w-4 text-slate-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData.stats.devices.total}</div>
                <p className="text-xs text-slate-600 mt-1">
                  {statsData.stats.devices.byPlatform.map(p => `${p.count} ${p.platform}`).join(', ')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('devices.stats.active')}</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{statsData.stats.devices.active}</div>
                <p className="text-xs text-slate-600 mt-1">
                  {Math.round((statsData.stats.devices.active / statsData.stats.devices.total) * 100)}% online
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('devices.stats.pending')}</CardTitle>
                <RefreshCw className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{statsData.stats.syncJobs.pending}</div>
                <p className="text-xs text-slate-600 mt-1">
                  {statsData.stats.syncJobs.processing} processing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('devices.stats.conflicts')}</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{statsData.stats.conflicts.unresolved}</div>
                <p className="text-xs text-slate-600 mt-1">
                  {statsData.stats.conflicts.resolved} resolved
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div>
                <label htmlFor="platform-select" className="text-sm font-medium">{t('devices.filter.platform')}</label>
                <select
                  id="platform-select"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">{t('devices.filter.all')}</option>
                  <option value="android">{t('devices.filter.android')}</option>
                  <option value="ios">{t('devices.filter.ios')}</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="rounded"
                />
                {t('devices.filter.active')}
              </label>

              <Button
                variant="outline"
                size="sm"
                onClick={() => mutateDevices()}
                className="ml-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('common.refresh')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Devices Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('devices.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {devicesError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t('devices.error')}</AlertDescription>
              </Alert>
            )}

            {!devicesData && !devicesError && (
              <div className="text-center py-8 text-slate-600">{t('devices.loading')}</div>
            )}

            {devicesData && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('devices.table.deviceId')}</TableHead>
                      <TableHead>{t('devices.table.platform')}</TableHead>
                      <TableHead>{t('devices.table.user')}</TableHead>
                      <TableHead>{t('devices.table.lastHeartbeat')}</TableHead>
                      <TableHead>{t('devices.table.status')}</TableHead>
                      <TableHead className="text-right">{t('devices.table.syncJobs')}</TableHead>
                      <TableHead className="text-right">{t('devices.table.conflicts')}</TableHead>
                      <TableHead>{t('devices.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devicesData.devices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-600">
                          {t('devices.empty')}
                        </TableCell>
                      </TableRow>
                    )}
                    {devicesData.devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-mono text-xs">{device.deviceId.slice(0, 12)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {device.platform}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-slate-400" />
                            <div>
                              <div className="font-medium text-sm">{device.user.name}</div>
                              <div className="text-xs text-slate-600">{device.user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{formatTimestamp(device.lastHeartbeat)}</TableCell>
                        <TableCell>
                          {isDeviceActive(device.lastHeartbeat) ? (
                            <Badge className="bg-green-100 text-green-800">
                              {t('devices.badge.active')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{t('devices.badge.inactive')}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{device._count.syncJobs}</TableCell>
                        <TableCell className="text-right">
                          {device._count.conflicts > 0 ? (
                            <Badge variant="destructive">{device._count.conflicts}</Badge>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setForceSyncDevice(device)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {t('devices.action.forceSync')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {devicesData.pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-slate-600">
                      Page {devicesData.pagination.page} of {devicesData.pagination.pages} ({devicesData.pagination.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        {t('common.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= devicesData.pagination.pages}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Force Sync Modal */}
      <Dialog open={!!forceSyncDevice} onOpenChange={(open) => !open && setForceSyncDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('devices.forceSync.title')}</DialogTitle>
            <DialogDescription>
              {forceSyncDevice && t('devices.forceSync.message').replace('{deviceId}', forceSyncDevice.deviceId.slice(0, 12))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">{t('devices.forceSync.reason')}</label>
              <Input
                value={forceSyncReason}
                onChange={(e) => setForceSyncReason(e.target.value)}
                placeholder={t('devices.forceSync.reasonPlaceholder')}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceSyncDevice(null)} disabled={isSyncing}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleForceSync} disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('devices.forceSync.syncing')}
                </>
              ) : (
                t('common.confirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
