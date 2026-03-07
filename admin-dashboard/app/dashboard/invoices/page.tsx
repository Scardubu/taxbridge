'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { safeDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UBLViewer } from '@/components/UBLViewer';
import { MoreHorizontal, Eye, RefreshCw, FileText, CheckCircle2, Loader2, Clock, XCircle, HelpCircle } from 'lucide-react';
import { logError } from '@/lib/logger';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';

interface Invoice {
  id: string;
  userId: string;
  customerName: string | null;
  customerTIN?: string | null;
  customerEndpointId?: string | null;
  status: 'queued' | 'processing' | 'stamped' | 'failed';
  subtotal: number;
  vat: number;
  total: number;
  items: {
    name: string;
    phone: string;
    tin: string | null;
  };
  ublXml: string | null;
  nrsReference: string | null;
  qrCode: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    name: string;
    phone: string;
    tin: string | null;
  };
}

interface InvoiceListResponse {
  invoices: Invoice[];
  fallback?: boolean;
  warnings?: string[];
}

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

export default function InvoicesPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<
    | { variant: 'success' | 'destructive' | 'warning'; title: string; description?: string }
    | null
  >(null);
  const [resubmittingInvoiceId, setResubmittingInvoiceId] = useState<string | null>(null);
  const { t } = useAdminI18n();

  const { data, error, mutate } = useSWR<InvoiceListResponse>('/api/admin/invoices', fetcher, {
    refreshInterval: 30000,
  });
  const invoices = data?.invoices ?? [];
  const isFallback = Boolean(data?.fallback);
  const warnings = data?.warnings ?? [];

  const handleDuploResubmit = async (invoiceId: string) => {
    try {
      setNotice(null);
      setResubmittingInvoiceId(invoiceId);

      await fetchJson(`/api/admin/invoices/${invoiceId}/resubmit-duplo`, { method: 'POST' });
      mutate();
      setNotice({
        variant: 'success',
        title: t('invoices.notice.resubmitted.title'),
        description: t('invoices.notice.resubmitted.body'),
      });
    } catch (error) {
      logError('admin/dashboard/invoices: Error resubmitting invoice', error, { invoiceId }, { suppressInProd: true });
      const description =
        error instanceof FetchError
          ? error.message
          : error instanceof Error
            ? error.message
            : t('common.unexpectedError');

      setNotice({
        variant: 'destructive',
        title: t('invoices.notice.resubmitFailed.title'),
        description,
      });
    } finally {
      setResubmittingInvoiceId((current) => (current === invoiceId ? null : current));
    }
  };

  const errorMessage = useMemo(() => {
    if (!error) return undefined;
    if (error instanceof FetchError) return error.message;
    if (error instanceof Error) return error.message;
    return t('invoices.error.loadFailed');
  }, [error, t]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'stamped':
        return <CheckCircle2 className="h-3 w-3 text-green-600" aria-hidden="true" />;
      case 'processing':
        return <Loader2 className="h-3 w-3 text-blue-600 animate-spin" aria-hidden="true" />;
      case 'queued':
        return <Clock className="h-3 w-3 text-yellow-600" aria-hidden="true" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-600" aria-hidden="true" />;
      default:
        return <HelpCircle className="h-3 w-3 text-gray-500" aria-hidden="true" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'stamped':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500';
      case 'queued':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'stamped':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'queued':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTitle>{t('invoices.error.title')}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  if (!invoices) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-muted rounded-lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (invoices.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {isFallback && warnings.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTitle className="text-amber-900">{t('dashboard.warnings.dataTitle')}</AlertTitle>
              <AlertDescription className="text-amber-800">
                <div className="space-y-1">
                  {warnings.map((warning, idx) => (
                    <p key={`${warning}-${idx}`}>
                      {t(`dashboard.warnings.code.${warning}` as Parameters<typeof t>[0], { defaultValue: warning })}
                    </p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">{t('invoices.title')}</h1>
              <p className="text-muted-foreground">{t('invoices.subtitle')}</p>
            </div>
            <Button onClick={() => mutate()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('common.refresh')}
            </Button>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">{t('invoices.empty.title')}</h2>
              <p className="text-muted-foreground text-center max-w-md">
                {isFallback ? t('invoices.empty.warmup') : t('invoices.empty.message')}
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {isFallback && warnings.length > 0 && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTitle className="text-amber-900">{t('dashboard.warnings.dataTitle')}</AlertTitle>
            <AlertDescription className="text-amber-800">
              <div className="space-y-1">
                {warnings.map((warning, idx) => (
                  <p key={`${warning}-${idx}`}>
                    {t(`dashboard.warnings.code.${warning}` as Parameters<typeof t>[0], { defaultValue: warning })}
                  </p>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert variant={notice.variant}>
            <AlertTitle>{notice.title}</AlertTitle>
            {notice.description && <AlertDescription>{notice.description}</AlertDescription>}
          </Alert>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('invoices.title')}</h1>
            <p className="text-muted-foreground">
              {t('invoices.subtitle')}
            </p>
          </div>
          <Button onClick={() => mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.refresh')}
          </Button>
        </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('invoices.stats.total')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('invoices.stats.stamped')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {invoices.filter(inv => inv.status === 'stamped').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('invoices.stats.processing')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {invoices.filter(inv => inv.status === 'processing').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('invoices.stats.failed')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {invoices.filter(inv => inv.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('invoices.table.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invoices.table.id')}</TableHead>
                <TableHead>{t('invoices.table.customer')}</TableHead>
                <TableHead>{t('invoices.table.user')}</TableHead>
                <TableHead>{t('invoices.table.status')}</TableHead>
                <TableHead>{t('invoices.table.total')}</TableHead>
                <TableHead>{t('invoices.table.nrsReference')}</TableHead>
                <TableHead>{t('invoices.table.created')}</TableHead>
                <TableHead>{t('invoices.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-xs">
                    {invoice.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{invoice.customerName || t('common.na')}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{invoice.user.name}</div>
                      <div className="text-sm text-muted-foreground">{invoice.user.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(invoice.status)} className="flex items-center gap-1.5 w-fit">
                      {getStatusIcon(invoice.status)}
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>₦{(invoice.total ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {invoice.nrsReference || t('common.pending')}
                  </TableCell>
                  <TableCell>
                    {safeDate(invoice.createdAt, { dateStyle: 'short' })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setDialogOpen(true);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {t('invoices.actions.viewDetails')}
                        </DropdownMenuItem>
                        {invoice.status === 'failed' && (
                          <DropdownMenuItem
                            onClick={() => handleDuploResubmit(invoice.id)}
                            disabled={resubmittingInvoiceId === invoice.id}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {resubmittingInvoiceId === invoice.id ? t('invoices.actions.resubmitting') : t('invoices.actions.resubmit')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('invoices.dialog.title')}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">{t('invoices.dialog.basic')}</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>{t('invoices.table.id')}:</strong> {selectedInvoice.id}</div>
                    <div><strong>{t('invoices.dialog.customer')}:</strong> {selectedInvoice.customerName || t('common.na')}</div>
                    <div><strong>{t('invoices.dialog.customerTIN')}:</strong> {selectedInvoice.customerTIN || t('common.na')}</div>
                    <div><strong>{t('invoices.dialog.status')}:</strong> 
                      <Badge variant={getStatusVariant(selectedInvoice.status)} className="ml-2">
                        {selectedInvoice.status}
                      </Badge>
                    </div>
                    <div><strong>{t('invoices.dialog.subtotal')}:</strong> ₦{(selectedInvoice.subtotal ?? 0).toLocaleString()}</div>
                    <div><strong>{t('invoices.dialog.vat')}:</strong> ₦{(selectedInvoice.vat ?? 0).toLocaleString()}</div>
                    <div><strong>{t('invoices.table.total')}:</strong> ₦{(selectedInvoice.total ?? 0).toLocaleString()}</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">{t('invoices.table.user')}</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>{t('invoices.dialog.userName')}:</strong> {selectedInvoice.user.name}</div>
                    <div><strong>{t('invoices.dialog.userPhone')}:</strong> {selectedInvoice.user.phone}</div>
                    <div><strong>{t('invoices.dialog.userTIN')}:</strong> {selectedInvoice.user.tin || t('common.na')}</div>
                    <div><strong>{t('invoices.table.nrsReference')}:</strong> {selectedInvoice.nrsReference || t('common.pending')}</div>
                    <div><strong>{t('invoices.table.created')}:</strong> {safeDate(selectedInvoice.createdAt)}</div>
                    <div><strong>{t('invoices.dialog.updated')}:</strong> {safeDate(selectedInvoice.updatedAt)}</div>
                  </div>
                </div>
              </div>

              {/* UBL XML Section */}
              {selectedInvoice.ublXml && (
                <div>
                  <h3 className="font-semibold mb-2">{t('invoices.ublAnalysis')}</h3>
                  <UBLViewer xml={selectedInvoice.ublXml} />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {selectedInvoice.status === 'failed' && (
                  <Button 
                    onClick={() => handleDuploResubmit(selectedInvoice.id)}
                    className="flex items-center gap-2"
                    disabled={resubmittingInvoiceId === selectedInvoice.id}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {resubmittingInvoiceId === selectedInvoice.id ? t('invoices.actions.resubmitting') : t('invoices.actions.resubmit')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
