'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { safeDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AdminEmptyState } from '@/components/admin-dashboard/ui/AdminEmptyState';
import { MetricCard } from '@/components/admin-dashboard/ui/MetricCard';
import { StatusPill } from '@/components/admin-dashboard/ui/StatusPill';
import { SectionHeader } from '@/components/admin-dashboard/ui/SectionHeader';
import { fetchDevices, fetchSyncStats, forceDeviceSync, type Device } from '@/lib/api/devices';
import { useTaxBridgeSSE } from '@/hooks/useTaxBridgeSSE';
import { Smartphone, RefreshCw, AlertCircle, CheckCircle2, Users } from 'lucide-react';

export function DevicesTab() {
  const [page, setPage]                       = useState(1);
  const [platform, setPlatform]               = useState('');
  const [activeOnly, setActiveOnly]           = useState(false);
  const [forceSyncDevice, setForceSyncDevice] = useState<Device | null>(null);
  const [forceSyncReason, setForceSyncReason] = useState('');
  const [isSyncing, setIsSyncing]             = useState(false);

  const { data: devicesData, error: devicesError, mutate: mutateDevices } = useSWR(
    ['devices', page, platform, activeOnly],
    () => fetchDevices({ page, platform: platform || undefined, active: activeOnly || undefined }),
    { refreshInterval: 300_000 },
  );

  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR(
    'sync-stats',
    fetchSyncStats,
    { refreshInterval: 300_000 },
  );

  const handleDeviceEvent = useCallback(() => {
    void mutateDevices();
    void mutateStats();
  }, [mutateDevices, mutateStats]);

  useTaxBridgeSSE({
    eventTypes: ['device:heartbeat', 'device:registered', 'sync:job_updated'],
    onEvent: handleDeviceEvent,
  });

  const handleForceSync = async () => {
    if (!forceSyncDevice) return;
    setIsSyncing(true);
    try {
      await forceDeviceSync(forceSyncDevice.id, forceSyncReason || undefined);
      setForceSyncDevice(null);
      setForceSyncReason('');
      void mutateDevices();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('Force sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const devices   = devicesData?.devices ?? [];
  const pagination = devicesData?.pagination;
  const syncStats = statsData?.stats;

  const PLATFORM_FILTERS = [
    { label: 'All',     value: '' },
    { label: 'iOS',     value: 'ios' },
    { label: 'Android', value: 'android' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Registered Devices"
          value={(pagination?.total ?? 0).toLocaleString()}
          icon={<Smartphone className="h-5 w-5" />}
          iconVariant="blue"
        />
        <MetricCard
          label="Active Devices"
          value={(syncStats?.devices.active ?? 0).toLocaleString()}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconVariant="emerald"
        />
        <MetricCard
          label="Pending Sync Jobs"
          value={(syncStats?.syncJobs.pending ?? 0).toLocaleString()}
          icon={<RefreshCw className="h-5 w-5" />}
          iconVariant="amber"
        />
        <MetricCard
          label="Unresolved Conflicts"
          value={(syncStats?.conflicts.unresolved ?? 0).toLocaleString()}
          icon={<AlertCircle className="h-5 w-5" />}
          iconVariant={syncStats?.conflicts.unresolved ? 'rose' : 'slate'}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Device Registry" description="Mobile devices syncing invoices and tax data." />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            {PLATFORM_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => { setPlatform(value); setPage(1); }}
                className={
                  value === platform
                    ? 'px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant={activeOnly ? 'default' : 'outline'}
            onClick={() => { setActiveOnly(v => !v); setPage(1); }}
          >
            Active only
          </Button>
          <Button size="sm" variant="outline" onClick={() => { void mutateDevices(); void mutateStats(); }} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(devicesError || statsError) && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Some data could not be loaded. Showing cached results.
          </AlertDescription>
        </Alert>
      )}

      {/* Devices table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900">
                  <TableHead className="pl-4">Device ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>App Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-6">
                      <AdminEmptyState
                        title={devicesError ? 'Device data is unavailable right now' : 'No devices registered yet'}
                        description={devicesError
                          ? 'Refresh the registry or check backend connectivity to restore live device visibility.'
                          : 'Connected mobile devices will appear here once invoice and sync activity begins.'}
                        icon={<Smartphone className="h-5 w-5" aria-hidden="true" />}
                      />
                    </TableCell>
                  </TableRow>
                ) : devices.map(device => (
                  <TableRow key={device.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900">
                    <TableCell className="pl-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {(device.deviceId || device.id).slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {device.user?.name || device.user?.email || '—'}
                    </TableCell>
                    <TableCell className="text-sm capitalize text-slate-600 dark:text-slate-400">
                      {device.platform ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {device.appVersion ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        status={device.active ? 'active' : 'unknown'}
                        label={device.active ? 'Active' : 'Inactive'}
                        pulse={device.active}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {device.lastHeartbeat ? safeDate(device.lastHeartbeat, { dateStyle: 'short', timeStyle: 'short' }) : <span className="italic text-slate-300">Never</span>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {safeDate(device.createdAt, { dateStyle: 'short' })}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setForceSyncDevice(device)}
                        className="h-7 px-2 text-xs"
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Force Sync
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {(pagination?.pages ?? 1) > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {page} of {pagination?.pages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= (pagination?.pages ?? 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Force Sync Dialog */}
      <Dialog open={!!forceSyncDevice} onOpenChange={open => { if (!open) { setForceSyncDevice(null); setForceSyncReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Sync Device</DialogTitle>
            <DialogDescription>
              Trigger an immediate sync for device{' '}
              <span className="font-mono text-xs">{forceSyncDevice?.id.slice(0, 8)}…</span>.
              An optional reason will be logged for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Reason (optional)"
              value={forceSyncReason}
              onChange={e => setForceSyncReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForceSyncDevice(null); setForceSyncReason(''); }}>
              Cancel
            </Button>
            <Button onClick={handleForceSync} disabled={isSyncing}>
              {isSyncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Force Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
