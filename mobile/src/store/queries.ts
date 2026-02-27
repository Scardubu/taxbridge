/**
 * TaxBridge Query Hooks (TanStack Query v5)
 * Caching, pagination, mutations, offline-aware
 */

import {
  useQuery, useMutation, useQueryClient,
  useInfiniteQuery, QueryClient,
} from '@tanstack/react-query';
import {
  invoiceApi, expenseApi, taxApi, dashboardApi, ocrApi,
  type CreateInvoiceRequest, type CreateExpenseRequest,
  type Invoice, type Expense, type DashboardComposite,
} from '../api/client';
import NetInfo from '@react-native-community/netinfo';

// ─── QueryClient singleton ────────────────────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:    5 * 60 * 1000,   // 5 min — aggressive caching for offline
      gcTime:       30 * 60 * 1000,  // 30 min in memory
      retry:        2,
      retryDelay:   (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false,   // Mobile — no window focus concept
      networkMode: 'offlineFirst',   // Return cache even when offline
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const queryKeys = {
  dashboard:        ['dashboard', 'stats']                    as const,
  dashboardComposite: ['dashboard', 'composite']              as const,
  invoices:         (params?: object) => ['invoices', params] as const,
  invoice:          (id: string) => ['invoice', id]           as const,
  expenses:         (params?: object) => ['expenses', params] as const,
  expense:          (id: string) => ['expense', id]           as const,
  taxForecast:      ['tax', 'forecast']                       as const,
  anomalies:        ['tax', 'anomalies']                      as const,
  nrsHealth:        ['nrs', 'health']                         as const,
  cashflowRisk:     ['tax', 'cashflow-risk']                  as const,
} as const;

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * C-14: Composite dashboard hook — ONE call for all home screen data.
 * Replaces useDashboardStats + useTaxForecast + useNrsHealth waterfall.
 */
export function useDashboard() {
  return useQuery<DashboardComposite>({
    queryKey: queryKeys.dashboardComposite,
    queryFn:  async () => {
      const res = await dashboardApi.composite();
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
    retry:     (failureCount, err: any) => {
      // retry up to 2× but not on 401/403
      if (err?.statusCode === 401 || err?.statusCode === 403) return false;
      return failureCount < 2;
    },
    // Return stale cache while re-fetching (offline-first feel)
    placeholderData: (prev) => prev,
  });
}

/** Legacy hook — kept for backward compat; prefer useDashboard() */
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn:  () => dashboardApi.stats().then(r => r.data),
    staleTime: 2 * 60 * 1000,  // 2 min — dashboard refreshes faster
  });
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export function useInvoices(params?: { status?: string }) {
  return useInfiniteQuery({
    queryKey: queryKeys.invoices(params),
    queryFn:  ({ pageParam }) =>
      invoiceApi.list({ ...params, cursor: pageParam as string | undefined })
        .then(r => r),
    getNextPageParam: (lastPage) => lastPage.meta?.cursor,
    initialPageParam: undefined as string | undefined,
    select: (data) => ({
      ...data,
      invoices: data.pages.flatMap(p => p.data),
    }),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn:  () => invoiceApi.get(id).then(r => r.data),
    enabled:  Boolean(id),
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) =>
      invoiceApi.create(data).then(r => r.data),
    onSuccess: (invoice) => {
      // Optimistically insert into list cache
      qc.setQueriesData<any>(
        { queryKey: ['invoices'], exact: false },
        (old: any) => old
          ? { ...old, pages: [{ data: [invoice, ...(old.pages[0]?.data ?? [])], meta: old.pages[0]?.meta }, ...old.pages.slice(1)] }
          : old
      );
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: queryKeys.dashboardComposite });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateInvoiceRequest> }) =>
      invoiceApi.update(id, data).then(r => r.data),
    onSuccess: (invoice) => {
      qc.setQueryData(queryKeys.invoice(invoice.id), invoice);
      qc.invalidateQueries({ queryKey: ['invoices'], exact: false });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoiceApi.delete(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.invoice(id) });
      qc.invalidateQueries({ queryKey: ['invoices'], exact: false });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: queryKeys.dashboardComposite });
    },
  });
}

export function useSubmitNrs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoiceApi.submitNrs(id).then(r => r.data),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.invoice(id) });
      qc.invalidateQueries({ queryKey: queryKeys.nrsHealth });
    },
  });
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export function useExpenses(params?: { category?: string }) {
  return useInfiniteQuery({
    queryKey: queryKeys.expenses(params),
    queryFn:  ({ pageParam }) =>
      expenseApi.list({ ...params, cursor: pageParam as string | undefined })
        .then(r => r),
    getNextPageParam: (lastPage) => lastPage.meta?.cursor,
    initialPageParam: undefined as string | undefined,
    select: (data) => ({
      ...data,
      expenses: data.pages.flatMap(p => p.data),
    }),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpenseRequest) =>
      expenseApi.create(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'], exact: false });
      qc.invalidateQueries({ queryKey: queryKeys.taxForecast });
      qc.invalidateQueries({ queryKey: queryKeys.anomalies });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      qc.invalidateQueries({ queryKey: queryKeys.dashboardComposite });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expenseApi.delete(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['expenses'], exact: false });
      qc.invalidateQueries({ queryKey: queryKeys.taxForecast });
    },
  });
}

// ─── OCR ──────────────────────────────────────────────────────────────────────

export function useScanReceipt() {
  return useMutation({
    mutationFn: ({ base64, mimeType }: { base64: string; mimeType?: string }) =>
      ocrApi.scanReceipt(base64, mimeType).then(r => r.data),
    retry: 1,
  });
}

// ─── Tax Intelligence ─────────────────────────────────────────────────────────

export function useTaxForecast() {
  return useQuery({
    queryKey: queryKeys.taxForecast,
    queryFn:  () => taxApi.forecast().then(r => r.data),
    staleTime: 10 * 60 * 1000,  // 10 min — forecast doesn't change frequently
    retry: 1,
  });
}

export function useAnomalies() {
  return useQuery({
    queryKey: queryKeys.anomalies,
    queryFn:  () => taxApi.anomalies().then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useNrsHealth() {
  return useQuery({
    queryKey: queryKeys.nrsHealth,
    queryFn:  () => taxApi.nrsHealth().then(r => r.data),
    refetchInterval: 30 * 1000,  // Poll every 30s — surface circuit breaker state
    staleTime: 0,
    retry: 1,
  });
}

export function useCashflowRisk() {
  return useQuery({
    queryKey: queryKeys.cashflowRisk,
    queryFn:  () => taxApi.cashflowRisk().then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
