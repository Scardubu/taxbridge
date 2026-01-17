'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UBLViewer } from '@/components/UBLViewer';
import { MoreHorizontal, Eye, RefreshCw } from 'lucide-react';
import { logError } from '@/lib/logger';
import { FetchError, fetchJson } from '@/lib/fetcher';

interface Invoice {
  id: string;
  userId: string;
  customerName: string | null;
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

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

export default function InvoicesPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<
    | { variant: 'success' | 'destructive' | 'warning'; title: string; description?: string }
    | null
  >(null);
  const [resubmittingInvoiceId, setResubmittingInvoiceId] = useState<string | null>(null);

  const { data: invoices, error, mutate } = useSWR<Invoice[]>('/api/admin/invoices', fetcher, {
    refreshInterval: 30000,
  });

  const handleDuploResubmit = async (invoiceId: string) => {
    try {
      setNotice(null);
      setResubmittingInvoiceId(invoiceId);

      await fetchJson(`/api/admin/invoices/${invoiceId}/resubmit-duplo`, { method: 'POST' });
      mutate();
      setNotice({
        variant: 'success',
        title: 'Resubmitted',
        description: 'Invoice was queued for re-submission to Duplo.',
      });
    } catch (error) {
      logError('admin/dashboard/invoices: Error resubmitting invoice', error, { invoiceId }, { suppressInProd: true });
      const description =
        error instanceof FetchError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'An unexpected error occurred.';

      setNotice({
        variant: 'destructive',
        title: 'Resubmit failed',
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
    return 'Failed to load invoices.';
  }, [error]);

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
          <AlertTitle>Failed to load invoices</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  if (!invoices) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="h-96 bg-slate-200 rounded-lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {notice && (
          <Alert variant={notice.variant}>
            <AlertTitle>{notice.title}</AlertTitle>
            {notice.description && <AlertDescription>{notice.description}</AlertDescription>}
          </Alert>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Invoice Management</h1>
            <p className="text-muted-foreground">
              Manage and monitor NRS e-invoice submissions
            </p>
          </div>
          <Button onClick={() => mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stamped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {invoices.filter(inv => inv.status === 'stamped').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {invoices.filter(inv => inv.status === 'processing').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
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
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>NRS Reference</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-xs">
                    {invoice.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{invoice.customerName || 'N/A'}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{invoice.user.name}</div>
                      <div className="text-sm text-muted-foreground">{invoice.user.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(invoice.status)} className="flex items-center gap-1 w-fit">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(invoice.status)}`} />
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>₦{invoice.total.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {invoice.nrsReference || 'Pending'}
                  </TableCell>
                  <TableCell>
                    {new Date(invoice.createdAt).toLocaleDateString()}
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
                          View Details
                        </DropdownMenuItem>
                        {invoice.status === 'failed' && (
                          <DropdownMenuItem
                            onClick={() => handleDuploResubmit(invoice.id)}
                            disabled={resubmittingInvoiceId === invoice.id}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {resubmittingInvoiceId === invoice.id ? 'Resubmitting…' : 'Resubmit to Duplo'}
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
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Basic Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>ID:</strong> {selectedInvoice.id}</div>
                    <div><strong>Customer:</strong> {selectedInvoice.customerName || 'N/A'}</div>
                    <div><strong>Status:</strong> 
                      <Badge variant={getStatusVariant(selectedInvoice.status)} className="ml-2">
                        {selectedInvoice.status}
                      </Badge>
                    </div>
                    <div><strong>Subtotal:</strong> ₦{selectedInvoice.subtotal.toLocaleString()}</div>
                    <div><strong>VAT:</strong> ₦{selectedInvoice.vat.toLocaleString()}</div>
                    <div><strong>Total:</strong> ₦{selectedInvoice.total.toLocaleString()}</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">User Information</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Name:</strong> {selectedInvoice.user.name}</div>
                    <div><strong>Phone:</strong> {selectedInvoice.user.phone}</div>
                    <div><strong>TIN:</strong> {selectedInvoice.user.tin || 'N/A'}</div>
                    <div><strong>NRS Reference:</strong> {selectedInvoice.nrsReference || 'Pending'}</div>
                    <div><strong>Created:</strong> {new Date(selectedInvoice.createdAt).toLocaleString()}</div>
                    <div><strong>Updated:</strong> {new Date(selectedInvoice.updatedAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* UBL XML Section */}
              {selectedInvoice.ublXml && (
                <div>
                  <h3 className="font-semibold mb-2">UBL 3.0 XML Analysis</h3>
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
                    {resubmittingInvoiceId === selectedInvoice.id ? 'Resubmitting…' : 'Resubmit to Duplo'}
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
