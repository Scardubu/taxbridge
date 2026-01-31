'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminI18n } from '@/lib/i18n';
import { fetchConflicts, resolveConflict, type Conflict } from '@/lib/api/devices';
import { AlertCircle, FileText, Smartphone, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ConflictsPage() {
  const { t } = useAdminI18n();
  const [page, setPage] = useState(1);
  const [resolutionFilter, setResolutionFilter] = useState<string>('unresolved');
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  
  // Resolution flow state
  const [resolutionStrategy, setResolutionStrategy] = useState<'local_wins' | 'server_wins' | 'merged'>('server_wins');
  const [adminReason, setAdminReason] = useState('');
  const [adminUserId, setAdminUserId] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [resolutionSuccess, setResolutionSuccess] = useState(false);

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

  const handleResolveConflict = async () => {
    if (!selectedConflict) return;
    
    if (!adminUserId.trim()) {
      setResolutionError('Admin User ID is required');
      return;
    }
    
    if (adminReason.trim().length < 10) {
      setResolutionError('Admin reason must be at least 10 characters');
      return;
    }
    
    setIsResolving(true);
    setResolutionError(null);
    
    try {
      await resolveConflict({
        conflictId: selectedConflict.id,
        resolution: resolutionStrategy,
        adminReason: adminReason.trim(),
        adminUserId: adminUserId.trim(),
        // For merged resolution, we'd need a UI to build mergedData
        // For now, Phase 6 focuses on local_wins/server_wins
        mergedData: undefined
      });
      
      setResolutionSuccess(true);
      
      // Refresh conflicts list after successful resolution
      setTimeout(() => {
        mutate();
        setSelectedConflict(null);
        setResolutionSuccess(false);
        setAdminReason('');
        setAdminUserId('');
      }, 2000);
    } catch (error: unknown) {
      setResolutionError(error instanceof Error ? error.message : 'Failed to resolve conflict');
    } finally {
      setIsResolving(false);
    }
  };

  const handleOpenResolutionDialog = (conflict: Conflict) => {
    setSelectedConflict(conflict);
    setResolutionStrategy('server_wins');
    setAdminReason('');
    setAdminUserId('');
    setResolutionError(null);
    setResolutionSuccess(false);
  };

  const handleCloseResolutionDialog = () => {
    if (!isResolving) {
      setSelectedConflict(null);
      setResolutionError(null);
      setResolutionSuccess(false);
    }
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
                title="Resolution Filter"
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
                            onClick={() => handleOpenResolutionDialog(conflict)}
                            disabled={!!conflict.resolution}
                          >
                            {conflict.resolution ? t('conflicts.action.resolved') : t('conflicts.action.resolve')}
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

      {/* Conflict Resolution Dialog */}
      <Dialog open={!!selectedConflict} onOpenChange={(open) => !open && handleCloseResolutionDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('conflicts.resolve.title')}</DialogTitle>
            <DialogDescription>
              {selectedConflict && `${selectedConflict.invoice.customerName} - ${selectedConflict.entity}`}
            </DialogDescription>
          </DialogHeader>

          {resolutionSuccess && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {t('conflicts.resolve.success')}
              </AlertDescription>
            </Alert>
          )}

          {resolutionError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{resolutionError}</AlertDescription>
            </Alert>
          )}

          {selectedConflict && !resolutionSuccess && (
            <div className="space-y-6 py-4">
              {/* Field-Level Diff */}
              <div>
                <h3 className="text-sm font-semibold mb-3">{t('conflicts.resolve.diffTitle')}</h3>
                <div className="border rounded-lg p-4 bg-slate-50">
                  <div className="grid grid-cols-3 gap-2 text-xs font-medium border-b pb-2 mb-2 sticky top-0 bg-slate-50">
                    <div className="text-slate-700">{t('conflicts.resolve.field')}</div>
                    <div className="text-orange-600">{t('conflicts.resolve.localData')} (v{selectedConflict.clientVersion})</div>
                    <div className="text-blue-600">{t('conflicts.resolve.serverData')} (v{selectedConflict.serverVersion})</div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {renderDiff(selectedConflict.localData, selectedConflict.serverData)}
                  </div>
                </div>
              </div>

              {/* Resolution Strategy */}
              <div>
                <Label htmlFor="resolution-strategy" className="text-sm font-semibold mb-2 block">
                  {t('conflicts.resolve.strategyLabel')}
                </Label>
                <Select 
                  value={resolutionStrategy} 
                  onValueChange={(val) => setResolutionStrategy(val as typeof resolutionStrategy)}
                >
                  <SelectTrigger id="resolution-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="server_wins">
                      {t('conflicts.resolve.strategy.serverWins')}
                    </SelectItem>
                    <SelectItem value="local_wins">
                      {t('conflicts.resolve.strategy.localWins')}
                    </SelectItem>
                    <SelectItem value="merged" disabled>
                      {t('conflicts.resolve.strategy.merged')} ({t('conflicts.resolve.mergedComingSoon')})
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-600 mt-1">
                  {resolutionStrategy === 'server_wins' && t('conflicts.resolve.strategy.serverWinsDesc')}
                  {resolutionStrategy === 'local_wins' && t('conflicts.resolve.strategy.localWinsDesc')}
                  {resolutionStrategy === 'merged' && t('conflicts.resolve.strategy.mergedDesc')}
                </p>
              </div>

              {/* Admin Confirmation */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  {t('conflicts.resolve.confirmationTitle')}
                </h3>
                
                <div>
                  <Label htmlFor="admin-user-id" className="text-sm">
                    {t('conflicts.resolve.adminUserId')} *
                  </Label>
                  <Input
                    id="admin-user-id"
                    value={adminUserId}
                    onChange={(e) => setAdminUserId(e.target.value)}
                    placeholder={t('conflicts.resolve.adminUserIdPlaceholder')}
                    className="mt-1"
                    disabled={isResolving}
                  />
                </div>

                <div>
                  <Label htmlFor="admin-reason" className="text-sm">
                    {t('conflicts.resolve.adminReason')} * (min 10 characters)
                  </Label>
                  <Textarea
                    id="admin-reason"
                    value={adminReason}
                    onChange={(e) => setAdminReason(e.target.value)}
                    placeholder={t('conflicts.resolve.adminReasonPlaceholder')}
                    className="mt-1"
                    rows={3}
                    disabled={isResolving}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {adminReason.length}/10 characters minimum
                  </p>
                </div>

                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900 text-sm">
                    {t('conflicts.resolve.warning')}
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}

          <DialogFooter>
            {!resolutionSuccess && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleCloseResolutionDialog}
                  disabled={isResolving}
                >
                  {t('common.cancel')}
                </Button>
                <Button 
                  onClick={handleResolveConflict}
                  disabled={isResolving || adminReason.trim().length < 10 || !adminUserId.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isResolving ? t('conflicts.resolve.resolving') : t('conflicts.resolve.confirm')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
