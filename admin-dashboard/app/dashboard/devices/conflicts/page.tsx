'use client';

import { useState } from 'react';
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
import { useAdminI18n } from '@/lib/i18n';
import { fetchConflicts, type Conflict } from '@/lib/api/devices';
import { AlertCircle, FileText, Smartphone, RefreshCw } from 'lucide-react';

export default function ConflictsPage() {
  const { t } = useAdminI18n();
  const [page, setPage] = useState(1);
  const [resolutionFilter, setResolutionFilter] = useState<string>('unresolved');
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);

  const { data: conflictsData, error: conflictsError, mutate } = useSWR(
    ['conflicts', page, resolutionFilter],
    () => fetchConflicts({ page, resolution: resolutionFilter }),
    { refreshInterval: 30000 }
  );

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const renderDiff = (local: Record<string, unknown>, server: Record<string, unknown>) => {
    const keys = new Set([...Object.keys(local), ...Object.keys(server)]);
    return (
      <div className="space-y-2">
        {Array.from(keys).map((key) => {
          const localVal = local[key];
          const serverVal = server[key];
          const isDifferent = JSON.stringify(localVal) !== JSON.stringify(serverVal);

          return (
            <div key={key} className="grid grid-cols-3 gap-2 text-sm border-b pb-2">
              <div className="font-medium text-slate-700">{key}</div>
              <div className={isDifferent ? 'text-orange-600 font-medium' : 'text-slate-600'}>
                {JSON.stringify(localVal)}
              </div>
              <div className={isDifferent ? 'text-blue-600 font-medium' : 'text-slate-600'}>
                {JSON.stringify(serverVal)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('conflicts.title')}</h1>
          <p className="text-slate-600 mt-2">{t('conflicts.subtitle')}</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <select
                value={resolutionFilter}
                onChange={(e) => {
                  setResolutionFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="unresolved">{t('conflicts.filter.unresolved')}</option>
                <option value="">{t('conflicts.filter.all')}</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => mutate()}
                className="ml-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('common.refresh')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Conflicts Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('conflicts.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {conflictsError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t('conflicts.error')}</AlertDescription>
              </Alert>
            )}

            {!conflictsData && !conflictsError && (
              <div className="text-center py-8 text-slate-600">{t('conflicts.loading')}</div>
            )}

            {conflictsData && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('conflicts.table.invoice')}</TableHead>
                      <TableHead>{t('conflicts.table.device')}</TableHead>
                      <TableHead>{t('conflicts.table.created')}</TableHead>
                      <TableHead className="text-center">{t('conflicts.table.localVersion')}</TableHead>
                      <TableHead className="text-center">{t('conflicts.table.serverVersion')}</TableHead>
                      <TableHead>{t('conflicts.table.resolution')}</TableHead>
                      <TableHead>{t('conflicts.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflictsData.conflicts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-600">
                          {t('conflicts.empty')}
                        </TableCell>
                      </TableRow>
                    )}
                    {conflictsData.conflicts.map((conflict) => (
                      <TableRow key={conflict.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <div>
                              <div className="font-medium text-sm">{conflict.invoice.customerName}</div>
                              <div className="text-xs text-slate-600">{formatCurrency(conflict.invoice.total)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-slate-400" />
                            <div>
                              <div className="font-mono text-xs">{conflict.device.deviceId.slice(0, 12)}...</div>
                              <Badge variant="outline" className="text-xs capitalize mt-1">
                                {conflict.device.platform}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{formatTimestamp(conflict.createdAt)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-orange-50 text-orange-700">
                            v{conflict.clientVersion}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            v{conflict.serverVersion}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {conflict.resolution ? (
                            <Badge className="bg-green-100 text-green-800">
                              {t('conflicts.badge.resolved')}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">{t('conflicts.badge.unresolved')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedConflict(conflict)}
                          >
                            {t('conflicts.action.viewDiff')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {conflictsData.pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-slate-600">
                      Page {conflictsData.pagination.page} of {conflictsData.pagination.pages} ({conflictsData.pagination.total} total)
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
                        disabled={page >= conflictsData.pagination.pages}
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

      {/* Diff Viewer Dialog */}
      <Dialog open={!!selectedConflict} onOpenChange={(open) => !open && setSelectedConflict(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('conflicts.action.viewDiff')}</DialogTitle>
            <DialogDescription>
              {selectedConflict && `${selectedConflict.invoice.customerName} - ${selectedConflict.entity}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {selectedConflict && (
              <>
                <div className="grid grid-cols-3 gap-2 text-sm font-medium border-b pb-2 sticky top-0 bg-white">
                  <div className="text-slate-700">Field</div>
                  <div className="text-orange-600">Local (v{selectedConflict.clientVersion})</div>
                  <div className="text-blue-600">Server (v{selectedConflict.serverVersion})</div>
                </div>
                {renderDiff(selectedConflict.localData, selectedConflict.serverData)}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedConflict(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
