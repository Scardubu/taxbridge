'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { safeDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MetricCard } from '@/components/admin-dashboard/ui/MetricCard';
import { StatusPill } from '@/components/admin-dashboard/ui/StatusPill';
import { SectionHeader } from '@/components/admin-dashboard/ui/SectionHeader';
import { Users as UsersIcon, Search, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { FetchError, fetchJson } from '@/lib/fetcher';

interface User {
  id: string;
  businessName: string;
  email: string;
  phone: string;
  tin?: string;
  status: 'active' | 'pending' | 'suspended';
  onboardingComplete: boolean;
  invoiceCount: number;
  createdAt: string;
  lastActive?: string;
}

interface UsersData {
  users: User[];
  total: number;
  stats: { total: number; active: number; pending: number; suspended: number };
}

type StatusFilter = 'all' | 'active' | 'pending' | 'suspended';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All',       value: 'all'       },
  { label: 'Active',    value: 'active'    },
  { label: 'Pending',   value: 'pending'   },
  { label: 'Suspended', value: 'suspended' },
];

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

function extractCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const r = body as Record<string, unknown>;
  return typeof r.code === 'string' ? r.code : undefined;
}

export function UsersTab() {
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, error, isLoading, mutate } = useSWR<UsersData>('/api/admin/users', fetcher, {
    refreshInterval: 300_000,
    shouldRetryOnError: (err) => {
      if (err instanceof FetchError) {
        const code = extractCode(err.body);
        if (code === 'ADMIN_API_DISABLED' || code === 'BACKEND_NOT_CONFIGURED') return false;
        if (err.status === 401 || err.status === 403) return false;
        return err.status >= 500;
      }
      return true;
    },
    errorRetryCount: 3,
    revalidateOnFocus: false,
  });

  const filtered = useMemo(() => {
    let list = data?.users ?? [];
    if (statusFilter !== 'all') list = list.filter(u => u.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        u =>
          u.businessName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.includes(q) ||
          (u.tin ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [data?.users, search, statusFilter]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Failed to load users</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{error instanceof FetchError ? error.message : 'Unknown error'}</span>
          <Button size="sm" variant="outline" onClick={() => mutate()}>Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6 animate-slide-up">

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Businesses"   value={isLoading ? '—' : (stats?.total     ?? 0).toLocaleString()} loading={isLoading} icon={<UsersIcon    className="h-5 w-5" />} iconVariant="blue"    />
        <MetricCard label="Active"             value={isLoading ? '—' : (stats?.active    ?? 0).toLocaleString()} loading={isLoading} icon={<CheckCircle2 className="h-5 w-5" />} iconVariant="emerald" />
        <MetricCard label="Pending Onboarding" value={isLoading ? '—' : (stats?.pending   ?? 0).toLocaleString()} loading={isLoading} icon={<Clock        className="h-5 w-5" />} iconVariant="amber"   />
        <MetricCard label="Suspended"          value={isLoading ? '—' : (stats?.suspended ?? 0).toLocaleString()} loading={isLoading} icon={<XCircle      className="h-5 w-5" />} iconVariant="rose"    />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Business Registry" description="All registered businesses on the TaxBridge platform." />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search businesses…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search businesses"
              className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            {STATUS_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={
                  value === statusFilter
                    ? 'px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors'
                }
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => mutate()} disabled={isLoading} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {!isLoading && (
        <p className="text-xs text-slate-500" aria-live="polite">
          Showing {filtered.length.toLocaleString()} of {(data?.users ?? []).length.toLocaleString()} businesses
        </p>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900">
                  <TableHead className="pl-4">Business</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>TIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((_, j) => (
                          <TableCell key={j}>
                            <div className="h-4 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filtered.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12 text-center text-sm text-slate-500">
                        {search ? 'No businesses match your search.' : 'No businesses found.'}
                      </TableCell>
                    </TableRow>
                  )
                  : filtered.map(user => (
                    <TableRow key={user.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900">
                      <TableCell className="pl-4 font-medium text-slate-900 dark:text-slate-100">
                        {user.businessName}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">{user.email}</TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">{user.phone}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {user.tin ?? <span className="italic text-slate-300">—</span>}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          status={user.status === 'active' ? 'active' : user.status === 'pending' ? 'pending' : 'error'}
                          label={user.status}
                          pulse={user.status === 'active'}
                        />
                      </TableCell>
                      <TableCell>
                        {user.onboardingComplete
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Complete" />
                          : <Clock        className="h-4 w-4 text-amber-400"   aria-label="Incomplete" />}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {user.invoiceCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {safeDate(user.createdAt, { dateStyle: 'short' })}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {user.lastActive ? safeDate(user.lastActive, { dateStyle: 'short' }) : <span className="italic text-slate-300">Never</span>}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
