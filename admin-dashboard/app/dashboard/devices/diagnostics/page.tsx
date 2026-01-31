'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAdminI18n } from '@/lib/i18n';
import { fetchDevices, fetchPendingSyncJobs, fetchConflicts } from '@/lib/api/devices';
import { AlertCircle, RefreshCw, Smartphone, Wifi, WifiOff } from 'lucide-react';

type SyncState = 'idle' | 'syncing' | 'conflict';

type PendingDomainCounts = {
  invoices: number;
  receipts: number;
  customers: number;
  other: number;
};

export default function SyncDiagnosticsPage() {
  const { t } = useAdminI18n();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const { data: devicesData, error: devicesError, mutate: mutateDevices } = useSWR(
    ['devices', 'diagnostics'],
    () => fetchDevices({ page: 1, limit: 200 }),
    { refreshInterval: 30000 }
  );

  const { data: pendingData, error: pendingError, mutate: mutatePending } = useSWR(
    'pending-sync-jobs',
    () => fetchPendingSyncJobs({ limit: 200 }),
    { refreshInterval: 30000 }
  );

  const { data: conflictsData, error: conflictsError, mutate: mutateConflicts } = useSWR(
    ['conflicts', 'unresolved'],
    () => fetchConflicts({ page: 1, limit: 200, resolution: 'unresolved' }),
    { refreshInterval: 30000 }
  );

  const selectedDevice = useMemo(() => {
    const id = selectedDeviceId || devicesData?.devices?.[0]?.id;
    return devicesData?.devices.find((device) => device.id === id) || null;
  }, [devicesData, selectedDeviceId]);

  const devicePendingJobs = useMemo(() => {
    if (!selectedDevice || !pendingData?.jobs) return [];
    return pendingData.jobs.filter((job) => job.deviceId === selectedDevice.id);
  }, [pendingData, selectedDevice]);

  const pendingDomainCounts: PendingDomainCounts = useMemo(() => {
    const counts: PendingDomainCounts = { invoices: 0, receipts: 0, customers: 0, other: 0 };

    devicePendingJobs.forEach((job) => {
      const entity = job.entity.toLowerCase();
      if (entity.includes('invoice')) {
        counts.invoices += 1;
      } else if (entity.includes('receipt')) {
        counts.receipts += 1;
      } else if (entity.includes('customer') || entity.includes('client')) {
        counts.customers += 1;
      } else {
        counts.other += 1;
      }
    });

    return counts;
  }, [devicePendingJobs]);

  const deviceConflicts = useMemo(() => {
    if (!selectedDevice || !conflictsData?.conflicts) return [];
    return conflictsData.conflicts.filter((conflict) => conflict.deviceId === selectedDevice.id);
  }, [conflictsData, selectedDevice]);

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return t('common.na');
    return new Date(timestamp).toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isDeviceActive = (lastHeartbeat: string) => {
    const now = new Date();
    const heartbeat = new Date(lastHeartbeat);
    const diffMins = (now.getTime() - heartbeat.getTime()) / 60000;
    return diffMins < 10;
  };

  const syncState: SyncState = useMemo(() => {
    if (deviceConflicts.length > 0) return 'conflict';
    if (devicePendingJobs.length > 0) return 'syncing';
    return 'idle';
  }, [deviceConflicts.length, devicePendingJobs.length]);

  const lastSyncTimestamp = useMemo(() => {
    const latestJob = devicePendingJobs
      .map((job) => job.createdAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    return latestJob || selectedDevice?.lastHeartbeat || null;
  }, [devicePendingJobs, selectedDevice]);

  const handleRefresh = () => {
    mutateDevices();
    mutatePending();
    mutateConflicts();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('devices.diagnostics.title')}</h1>
            <p className="text-slate-600 mt-2">{t('devices.diagnostics.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>

        {(devicesError || pendingError || conflictsError) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('devices.diagnostics.error')}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('devices.diagnostics.selectDevice')}</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              title={t('devices.diagnostics.selectDevice')}
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
              className="w-full md:w-[360px] px-3 py-2 border rounded-md text-sm"
            >
              {devicesData?.devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.deviceId.slice(0, 12)}… · {device.user.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {!selectedDevice && !devicesError && (
          <div className="text-center py-12 text-slate-600">{t('devices.diagnostics.empty')}</div>
        )}

        {selectedDevice && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('devices.diagnostics.deviceIdentity')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-slate-100 p-2">
                      <Smartphone className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-500">{t('devices.table.deviceId')}</div>
                      <div className="font-mono text-sm text-slate-900">{selectedDevice.deviceId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedDevice.active ? (
                      <Badge className="bg-green-100 text-green-800">{t('devices.diagnostics.status.active')}</Badge>
                    ) : (
                      <Badge variant="secondary">{t('devices.diagnostics.status.inactive')}</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {selectedDevice.platform}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {t('devices.diagnostics.userLabel')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedDevice.user.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t('devices.diagnostics.userEmail', { email: selectedDevice.user.email })}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t('devices.diagnostics.userPhone', { phone: selectedDevice.user.phone || t('common.na') })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t('devices.diagnostics.deviceStatus')}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                      {isDeviceActive(selectedDevice.lastHeartbeat) ? (
                        <>
                          <Wifi className="h-4 w-4 text-green-600" />
                          {t('devices.diagnostics.status.online')}
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-4 w-4 text-slate-400" />
                          {t('devices.diagnostics.status.offline')}
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t('devices.diagnostics.lastHeartbeat', { time: formatTimestamp(selectedDevice.lastHeartbeat) })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t('devices.diagnostics.syncState')}
                    </div>
                    <div className="mt-2">
                      {syncState === 'conflict' && (
                        <Badge className="bg-orange-100 text-orange-800">{t('devices.diagnostics.state.conflict')}</Badge>
                      )}
                      {syncState === 'syncing' && (
                        <Badge className="bg-blue-100 text-blue-800">{t('devices.diagnostics.state.syncing')}</Badge>
                      )}
                      {syncState === 'idle' && (
                        <Badge className="bg-slate-100 text-slate-700">{t('devices.diagnostics.state.idle')}</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t('devices.diagnostics.lastSync', { time: formatTimestamp(lastSyncTimestamp) })}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t('devices.diagnostics.pendingJobs')}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {devicePendingJobs.length}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t('devices.diagnostics.pendingByDomain')}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t('devices.diagnostics.conflicts')}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-orange-700">
                      {deviceConflicts.length}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t('devices.diagnostics.conflictsDesc')}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {t('devices.diagnostics.lastSyncLabel')}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {formatTimestamp(lastSyncTimestamp)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t('devices.diagnostics.lastSyncHint')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('devices.diagnostics.pendingByDomain')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{t('devices.diagnostics.domain.invoices')}</span>
                  <Badge variant="outline">{pendingDomainCounts.invoices}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{t('devices.diagnostics.domain.receipts')}</span>
                  <Badge variant="outline">{pendingDomainCounts.receipts}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{t('devices.diagnostics.domain.customers')}</span>
                  <Badge variant="outline">{pendingDomainCounts.customers}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{t('devices.diagnostics.domain.other')}</span>
                  <Badge variant="outline">{pendingDomainCounts.other}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
