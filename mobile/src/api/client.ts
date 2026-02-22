/**
 * TaxBridge API Client
 * Production-grade: JWT auto-refresh, timeout, retry, normalized errors
 * Typed end-to-end with full response models
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://taxbridge-api-ker8.onrender.com';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES        = 3;
const RETRY_DELAY_BASE   = 1_000;

const SECURE_KEYS = {
  accessToken:  'tb_access_token',
  refreshToken: 'tb_refresh_token',
  userId:       'tb_user_id',
} as const;

// ─── Error Types ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code:       string,
    message:           string,
    public details?:   unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network connection unavailable') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHENTICATED', message);
    this.name = 'AuthError';
  }
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data:    T;
  meta?:   { page?: number; total?: number; cursor?: string };
}

export interface ApiErrorResponse {
  success: false;
  error:   string;
  code?:   string;
  details?: unknown;
}

// Auth
export interface LoginRequest  { email: string; password: string }
export interface RegisterRequest {
  email: string; password: string; name: string;
  businessName?: string; tin?: string; businessType?: string;
}
export interface AuthResponse {
  user:         User;
  accessToken:  string;
  refreshToken: string;
}
export interface User {
  id:           string;
  email:        string;
  name:         string;
  businessName?: string;
  tin?:         string;
  businessType?: string;
  role:         'user' | 'admin' | 'super-admin';
  createdAt:    string;
}

// Invoices
export interface Invoice {
  id:          string;
  userId:      string;
  invoiceNumber: string;
  clientName:  string;
  clientEmail?: string;
  clientTin?:  string;
  amount:      number;
  vatAmount:   number;
  status:      'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
  nrsStatus:   'PENDING' | 'STAMPED' | 'FAILED';
  irn?:        string;
  csid?:       string;
  dueDate:     string;
  createdAt:   string;
  items:       InvoiceItem[];
}
export interface InvoiceItem {
  description: string;
  quantity:    number;
  unitPrice:   number;
  vatRate:     number;
  total:       number;
}
export interface CreateInvoiceRequest {
  clientName:  string;
  clientEmail?: string;
  clientTin?:  string;
  dueDate:     string;
  items:       Omit<InvoiceItem, 'total'>[];
  notes?:      string;
}

// Expenses
export interface Expense {
  id:          string;
  userId:      string;
  amount:      number;
  vatAmount?:  number;
  vatEligible: boolean;
  category:    string;
  description?: string;
  vendorName?: string;
  vendorTin?:  string;
  date:        string;
  receiptUrl?: string;
  ocrData?:    OcrResult;
  createdAt:   string;
}
export interface CreateExpenseRequest {
  amount:      number;
  vatAmount?:  number;
  vatEligible?: boolean;
  category:    string;
  description?: string;
  vendorName?: string;
  vendorTin?:  string;
  date:        string;
}

// OCR
export interface OcrResult {
  merchantName:  string;
  amount:        number;
  vatAmount:     number;
  vatEligible:   boolean;
  date:          string;
  category:      string;
  tinDetected?:  string;
  confidence:    number;
  requiresReview: boolean;
  validationWarnings: string[];
}

// Tax
export interface TaxCalculation {
  income:    number;
  taxType:   'PIT' | 'VAT' | 'CIT' | 'CGT' | 'WHT' | 'PAYE';
  liability: number;
  breakdown: Record<string, number>;
  effectiveRate: number;
  nextDeadline?: string;
}

// Insights
export interface TaxForecast {
  forecastedLiability:        number;
  breakdown:                  { pit: number; vat: number; devLevy: number };
  vatReclaimable:             number;
  confidenceScore:            number;
  nextDeadline:               string;
  recommendedMonthlyProvision: number;
}
export interface Anomaly {
  expenseId:     string;
  amount:        number;
  category:      string;
  anomalyReason: string;
  suggestedAction: string;
}

// NRS
export interface NrsHealth {
  circuitBreakerOpen: boolean;
  pendingSubmissions: number;
  deadLetterCount:    number;
  status:             'healthy' | 'degraded';
}

// Cash Flow Risk
export interface CashFlowRisk {
  score:   number;  // 0–100 (higher = more risk)
  risk:    'LOW' | 'MEDIUM' | 'HIGH';
  factors: string[];
}

// Dashboard
export interface DashboardStats {
  totalInvoices:    number;
  totalRevenue:     number;
  pendingNrs:       number;
  vatLiability:     number;
  nextDeadline?:    { type: string; date: string; daysRemaining: number };
  taxHealthScore?:  number;
  recentAnomalies:  number;
}

// ─── Token Management ─────────────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return sessionStorage.getItem(SECURE_KEYS.accessToken);
  }
  return SecureStore.getItemAsync(SECURE_KEYS.accessToken);
}

async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(SECURE_KEYS.refreshToken);
  }
  return SecureStore.getItemAsync(SECURE_KEYS.refreshToken);
}

async function storeTokens(access: string, refresh: string): Promise<void> {
  if (Platform.OS === 'web') {
    sessionStorage.setItem(SECURE_KEYS.accessToken, access);
    localStorage.setItem(SECURE_KEYS.refreshToken, refresh);
    return;
  }
  await Promise.all([
    SecureStore.setItemAsync(SECURE_KEYS.accessToken, access),
    SecureStore.setItemAsync(SECURE_KEYS.refreshToken, refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    sessionStorage.removeItem(SECURE_KEYS.accessToken);
    localStorage.removeItem(SECURE_KEYS.refreshToken);
    localStorage.removeItem(SECURE_KEYS.userId);
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_KEYS.accessToken),
    SecureStore.deleteItemAsync(SECURE_KEYS.refreshToken),
    SecureStore.deleteItemAsync(SECURE_KEYS.userId),
  ]);
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken }),
        signal:  AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        await clearTokens();
        return null;
      }

      const body: ApiResponse<AuthResponse> = await res.json();
      await storeTokens(body.data.accessToken, body.data.refreshToken);
      return body.data.accessToken;
    } catch {
      await clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ─── Request ID Generator ─────────────────────────────────────────────────────

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Core Fetch ───────────────────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  retries?:  number;
  timeout?:  number;
}

async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const {
    skipAuth = false,
    retries = MAX_RETRIES,
    timeout = REQUEST_TIMEOUT_MS,
    ...fetchOptions
  } = options;

  const requestId = generateRequestId();
  const headers: Record<string, string> = {
    'Content-Type':   'application/json',
    'X-Request-Id':   requestId,
    'X-Client':       'taxbridge-mobile',
    'X-Client-Version': '3.0.0',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  if (!skipAuth) {
    let token = await getAccessToken();
    if (!token) {
      token = await refreshAccessToken();
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with ±25% jitter
      const baseDelay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
      const jitter    = baseDelay * (0.75 + Math.random() * 0.5);
      await new Promise(r => setTimeout(r, Math.min(jitter, 15_000)));
    }

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(`${API_URL}${path}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      // 401 — attempt token refresh once
      if (res.status === 401 && !skipAuth && attempt === 0) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          // Retry immediately with new token (don't count as retry)
          const retryRes = await fetch(`${API_URL}${path}`, {
            ...fetchOptions,
            headers,
            signal: AbortSignal.timeout(timeout),
          });
          if (retryRes.ok) {
            return retryRes.json() as Promise<T>;
          }
          if (retryRes.status === 401) {
            await clearTokens();
            throw new AuthError();
          }
        } else {
          throw new AuthError();
        }
      }

      if (!res.ok) {
        let errorBody: ApiErrorResponse | null = null;
        try { errorBody = await res.json(); } catch {}

        const message = errorBody?.error ?? `HTTP ${res.status}`;
        const code    = errorBody?.code   ?? `HTTP_${res.status}`;

        // Don't retry client errors (4xx) except 429
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new ApiError(res.status, code, message, errorBody?.details);
        }

        lastError = new ApiError(res.status, code, message, errorBody?.details);
        continue;  // Retry 5xx and 429
      }

      return res.json() as Promise<T>;

    } catch (err) {
      if (err instanceof ApiError || err instanceof AuthError) throw err;

      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new NetworkError('Request timed out');
        continue;
      }

      // Network unavailable
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new NetworkError();
      }

      lastError = err as Error;
    }
  }

  throw lastError ?? new NetworkError('Request failed after retries');
}

// ─── API Endpoints ────────────────────────────────────────────────────────────

export const authApi = {
  login: (data: LoginRequest) =>
    apiFetch<ApiResponse<AuthResponse>>('/api/v1/auth/login', {
      method:   'POST',
      body:     JSON.stringify(data),
      skipAuth: true,
      retries:  0,
    }),

  register: (data: RegisterRequest) =>
    apiFetch<ApiResponse<AuthResponse>>('/api/v1/auth/register', {
      method:   'POST',
      body:     JSON.stringify(data),
      skipAuth: true,
      retries:  0,
    }),

  logout: () =>
    apiFetch<ApiResponse<void>>('/api/v1/auth/logout', {
      method:  'POST',
      retries: 0,
    }),

  me: () =>
    apiFetch<ApiResponse<User>>('/api/v1/auth/me'),

  storeTokens,
  clearTokens,
};

export const invoiceApi = {
  list: (params?: { page?: number; status?: string; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set('page', String(params.page));
    if (params?.status) qs.set('status', params.status);
    if (params?.cursor) qs.set('cursor', params.cursor);
    return apiFetch<ApiResponse<Invoice[]>>(`/api/v1/invoices?${qs}`);
  },

  get: (id: string) =>
    apiFetch<ApiResponse<Invoice>>(`/api/v1/invoices/${id}`),

  create: (data: CreateInvoiceRequest) =>
    apiFetch<ApiResponse<Invoice>>('/api/v1/invoices', {
      method: 'POST',
      body:   JSON.stringify(data),
      retries: 1,
    }),

  update: (id: string, data: Partial<CreateInvoiceRequest>) =>
    apiFetch<ApiResponse<Invoice>>(`/api/v1/invoices/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<void>>(`/api/v1/invoices/${id}`, {
      method:  'DELETE',
      retries: 1,
    }),

  submitNrs: (id: string) =>
    apiFetch<ApiResponse<{ irn: string; csid: string }>>(`/api/v1/invoices/${id}/nrs-submit`, {
      method:  'POST',
      retries: 2,
      timeout: 60_000,  // NRS can be slow
    }),
};

export const expenseApi = {
  list: (params?: { page?: number; category?: string; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)     qs.set('page', String(params.page));
    if (params?.category) qs.set('category', params.category);
    if (params?.cursor)   qs.set('cursor', params.cursor);
    return apiFetch<ApiResponse<Expense[]>>(`/api/v1/expenses?${qs}`);
  },

  create: (data: CreateExpenseRequest) =>
    apiFetch<ApiResponse<Expense>>('/api/v1/expenses', {
      method: 'POST',
      body:   JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateExpenseRequest>) =>
    apiFetch<ApiResponse<Expense>>(`/api/v1/expenses/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<ApiResponse<void>>(`/api/v1/expenses/${id}`, {
      method:  'DELETE',
      retries: 1,
    }),
};

export const ocrApi = {
  scanReceipt: (base64Image: string, mimeType: string = 'image/jpeg') =>
    apiFetch<ApiResponse<OcrResult>>('/api/v1/ocr/receipt', {
      method:  'POST',
      body:    JSON.stringify({ image: base64Image, imageType: 'base64', mimeType }),
      retries: 1,
      timeout: 45_000,  // OCR processing
    }),
};

export const taxApi = {
  calculate: (params: {
    taxType: TaxCalculation['taxType'];
    income:  number;
    period?: string;
  }) =>
    apiFetch<ApiResponse<TaxCalculation>>('/api/v1/tax/calculate', {
      method: 'POST',
      body:   JSON.stringify(params),
    }),

  forecast: () =>
    apiFetch<ApiResponse<TaxForecast>>('/api/v1/insights/forecast'),

  anomalies: () =>
    apiFetch<ApiResponse<Anomaly[]>>('/api/v1/insights/anomalies'),

  nrsHealth: () =>
    apiFetch<ApiResponse<NrsHealth>>('/api/v1/nrs/health', {
      retries: 1,
    }),

  cashflowRisk: () =>
    apiFetch<ApiResponse<CashFlowRisk>>('/api/v1/insights/cashflow-risk'),
};

export const dashboardApi = {
  stats: () =>
    apiFetch<ApiResponse<DashboardStats>>('/api/v1/dashboard/stats'),
};

export const healthApi = {
  check: () =>
    apiFetch<{ status: string; version: string }>('/health', {
      skipAuth: true,
      retries:  1,
      timeout:  5_000,
    }),
};
