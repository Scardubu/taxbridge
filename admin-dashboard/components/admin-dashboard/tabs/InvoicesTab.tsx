'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { formatCurrencyNGN, safeDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StatusPill } from '@/components/admin-dashboard/ui/StatusPill';
import { MetricCard } from '@/components/admin-dashboard/ui/MetricCard';
import { SectionHeader } from '@/components/admin-dashboard/ui/SectionHeader';
import { UBLViewer } from '@/components/UBLViewer';
import {
  MoreHorizontal, Eye, RefreshCw, FileText,
  CheckCircle2, Loader2, Clock, XCircle, HelpCircle, AlertTriangle, Search,
} from 'lucide-react';
import { logError } from '@/lib/logger';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  userId: string;
  customerName: string | null;
  customerTIN?: string | null;
  status: 'queued' | 'processing' | 'stamped' | 'failed';
  subtotal: number;
  vat: number;
  total: number;
  items: { name: string; phone: string; tin: string | null };
  ublXml: string | null;
  nrsReference: string | null;
  qrCode: string | null;
  createdAt: string;
  updatedAt: string;
  user: { name: string; phone: string; tin: string | null };
}

interface InvoiceListResponse {
  invoices: Invoice[];
  fallback?: boolean;
  warnings?: string[];
}

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

const STATUS_FILTERS = [
  { label: 'All',        value: ''          },
  { label: 'Queued',     value: 'queued'    },
  { label: 'Processing', value: 'processing'},
  { label: 'Stamped',    value: 'stamped'   },
  { label: 'Failed',     value: 'failed'    },
] as const;

// ─── Status helpers ────────────────────────────────────────────────────────────

function invoiceStatusToPill(status: Invoice['status']) {
  const map: Record<Invoice['status'], { status: React.ComponentProps<typeof StatusPill>['status']; icon: React.ReactNode }> = {
    stamped:    { status: 'success', icon: <CheckCircle2 className="h-3 w-3" /> },
    processing: { status: 'pending', icon: <Clock        className="h-3 w-3" /> },
    queued:     { status: 'draft',   icon: <Clock        className="h-3 w-3" /> },
    failed:     { status: 'error',   icon: <XCircle      className="h-3 w-3" /> },
  };
  return map[status] ?? { status: 'unknown' as const, icon: <HelpCircle className="h-3 w-3" /> };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoicesTab() {
  const { t } = useAdminI18n();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<{ variant: 'success' | 'destructive'; title: string; description?: string } | null>(null);
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);

  const url = statusFilter ? `/api/admin/invoices?status=${statusFilter}` : '/api/admin/invoices';
  const { data, error, mutate } = useSWR<InvoiceListResponse>(url, fetcher, { refreshInterval: 300_000 });

  const invoices = data?.invoices ?? [];
  const isFallback = Boolean(data?.fallback);

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.customerName?.toLowerCase().includes(q) ||
        inv.user.name.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q) ||
        inv.nrsReference?.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const stats = useMemo(() => ({
    total:      invoices.length,
    stamped:    invoices.filter(i => i.status === 'stamped').length,
    failed:     invoices.filter(i => i.status === 'failed').length,
    processing: invoices.filter(i => i.status === 'processing' || i.status === 'queued').length,
  }), [invoices]);

  const handleResubmit = async (invoiceId: string) => {
    try {
      setNotice(null);
      setResubmittingId(invoiceId);
      await fetchJson(`/api/admin/invoices/${invoiceId}/resubmit-duplo`, { method: 'POST' });
      mutate();
      setNotice({ variant: 'success', title: 'Resubmitted', description: `Invoice ${invoiceId} queued for resubmission.` });
    } catch (err) {
      logError('Resubmit error', err);
      setNotice({ variant: 'destructive', title: 'Resubmit Failed', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setResubmittingId(null);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to load invoices</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{error instanceof FetchError ? error.message : 'Unknown error'}</span>
          <Button size="sm" variant="outline" onClick={() => mutate()}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Notice */}
      {notice && (
        <Alert variant={notice.variant === 'success' ? 'default' : 'destructive'}
          className={notice.variant === 'success' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950' : ''}>
          <AlertTitle>{notice.title}</AlertTitle>
          {notice.description && <AlertDescription>{notice.description}</AlertDescription>}
        </Alert>
      )}

      {isFallback && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Showing cached data — live backend is unavailable.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Invoices"   value={stats.total.toLocaleString()}      icon={<FileText     className="h-5 w-5" />} iconVariant="blue"    />
        <MetricCard label="Stamped / NRS"    value={stats.stamped.toLocaleString()}    icon={<CheckCircle2 className="h-5 w-5" />} iconVariant="emerald" />
        <MetricCard label="In Progress"      value={stats.processing.toLocaleString()} icon={<Clock        className="h-5 w-5" />} iconVariant="amber"   />
        <MetricCard label="Failed"           value={stats.failed.toLocaleString()}     icon={<XCircle      className="h-5 w-5" />} iconVariant="rose"    />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Invoice Registry" description="All invoices submitted through TaxBridge." />
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search invoices…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          {/* Status filter */}
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            {STATUS_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={
                  value === statusFilter
                    ? 'px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => mutate()} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900">
                  <TableHead className="pl-4">Customer</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>NRS Ref</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-sm text-slate-500">
                      {search ? 'No invoices match your search.' : 'No invoices found.'}
                    </TableCell>
                  </TableRow>
                ) : filtered.map((inv) => {
                  const pill = invoiceStatusToPill(inv.status);
                  return (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                      onClick={() => { setSelectedInvoice(inv); setDialogOpen(true); }}
                    >
                      <TableCell className="pl-4 font-medium text-slate-900 dark:text-slate-100">
                        {inv.customerName || <span className="text-slate-400 italic">No name</span>}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">{inv.user.name}</TableCell>
                      <TableCell>
                        <StatusPill status={pill.status} label={inv.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCurrencyNGN(inv.subtotal)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCurrencyNGN(inv.vat)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold">{formatCurrencyNGN(inv.total)}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {inv.nrsReference
                          ? <span className="font-mono text-[11px]">{inv.nrsReference}</span>
                          : <span className="italic text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {safeDate(inv.createdAt, { dateStyle: 'short' })}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Invoice actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedInvoice(inv); setDialogOpen(true); }}>
                              <Eye className="mr-2 h-4 w-4" /> View UBL XML
                            </DropdownMenuItem>
                            {inv.status === 'failed' && (
                              <DropdownMenuItem
                                onClick={() => handleResubmit(inv.id)}
                                disabled={resubmittingId === inv.id}
                              >
                                {resubmittingId === inv.id
                                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  : <RefreshCw className="mr-2 h-4 w-4" />}
                                Resubmit to DigiTax
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* UBL Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Invoice UBL XML
              {selectedInvoice?.customerName && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  — {selectedInvoice.customerName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <p className="tb-label mb-1">Status</p>
                  <StatusPill status={invoiceStatusToPill(selectedInvoice.status).status} label={selectedInvoice.status} />
                </div>
                <div>
                  <p className="tb-label mb-1">Total</p>
                  <p className="font-semibold tabular-nums">{formatCurrencyNGN(selectedInvoice.total)}</p>
                </div>
                {selectedInvoice.nrsReference && (
                  <div className="col-span-2">
                    <p className="tb-label mb-1">NRS Reference</p>
                    <p className="font-mono text-xs">{selectedInvoice.nrsReference}</p>
                  </div>
                )}
              </div>
              {selectedInvoice.ublXml ? (
                <UBLViewer xml={selectedInvoice.ublXml} />
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  No UBL XML available for this invoice.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
