import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Sentry from '@sentry/react-native';
import { TokenService } from './tokenService';
import { useAuthStore } from '../stores/authStore';
import { getDatabase } from './database';
import type { TaxCalculationResult } from '../types/taxEngine';

type JsonRecord = Record<string, unknown>;

let deviceIdPromise: Promise<string> | null = null;
let refreshPromise: Promise<string | null> | null = null;

function getRequestTimeoutMs(): number {
  const raw = Number(process.env.API_TIMEOUT ?? 30000);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 30000;
  }

  return raw;
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'https://api.taxbridge.ng';
}

const INSTALLATION_ID_KEY = 'taxbridge.installation_id.v1';

async function getDeviceId(): Promise<string> {
  deviceIdPromise ??= (async () => {
    const stored = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) return stored;
    const bytes = await Crypto.getRandomBytesAsync(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    const installationId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);
    return installationId;
  })();
  return deviceIdPromise;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await TokenService.getRefreshToken();
    if (!refreshToken) return null;

    const response = await fetch(`${getBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TaxBridge-Version': '13',
        'X-Device-ID': await getDeviceId(),
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      if ([400, 401, 403].includes(response.status)) return null;
      const payload = await readErrorPayload(response);
      throw new ApiError(response.status,
        typeof payload.code === 'string' ? payload.code : 'refresh_failed',
        typeof payload.message === 'string' ? payload.message : 'Token refresh failed',
        payload);
    }

    const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken) {
      return null;
    }

    await TokenService.setTokens(data.accessToken, data.refreshToken ?? refreshToken);
    return data.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function executeRequest(path: string, options: RequestInit = {}, accessToken?: string | null): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(`${getBaseUrl()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
        'X-TaxBridge-Version': '13',
        'X-Device-ID': await getDeviceId(),
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorPayload(response: Response): Promise<JsonRecord> {
  return (await response.json().catch(() => ({ message: response.statusText }))) as JsonRecord;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, hasRetried = false): Promise<T> {
  const accessToken = await TokenService.getAccessToken();
  const response = await executeRequest(path, options, accessToken);

  if (response.status === 401 && !hasRetried) {
    // Only definitive refresh-token rejection invalidates the local session.
    // Transient refresh and retried-request failures must preserve the session.
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      await TokenService.clearTokens();
      await useAuthStore.getState().logout();
      throw new ApiError(401, 'session_expired', 'Session expired');
    }
    const retryResponse = await executeRequest(path, options, newAccessToken);
    if (retryResponse.status === 401) {
      await TokenService.clearTokens();
      await useAuthStore.getState().logout();
      throw new ApiError(401, 'session_expired', 'Session expired');
    }
    if (!retryResponse.ok) {
      const retryPayload = await readErrorPayload(retryResponse);
      throw new ApiError(
        retryResponse.status,
        typeof retryPayload.code === 'string' ? retryPayload.code : 'api_error',
        typeof retryPayload.message === 'string' ? retryPayload.message : 'api_error',
        retryPayload,
      );
    }
    return retryResponse.json() as Promise<T>;
  }

  if (!response.ok) {
    const errorPayload = await readErrorPayload(response);
    throw new ApiError(
      response.status,
      typeof errorPayload.code === 'string' ? errorPayload.code : 'api_error',
      typeof errorPayload.message === 'string' ? errorPayload.message : 'api_error',
      errorPayload,
    );
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// --- Typed client methods ---

export interface BackendBusinessProfile {
  id: string;
  business_name: string;
  business_type: string;
  sector: string;
  annual_turnover: number;
  monthly_revenue: number;
  total_fixed_assets: number;
  has_valid_tin: boolean;
  is_vat_registered: boolean;
  tin?: string;
  updated_at: string;
}

export interface BusinessProfilePayload {
  businessName?: string;
  tradingName?: string;
  tin?: string;
  rcNumber?: string;
  sector?: string;
  businessType?: string;
  annualTurnover?: number | null;
  monthlyRevenue?: number | null;
  totalFixedAssets?: number | null;
  employeeCount?: number;
  isVatRegistered?: boolean;
  vatNumber?: string;
  lga?: string;
  state?: string;
  phone?: string;
  email?: string;
  hasValidTIN?: boolean;
}

export interface ComplianceEventPayload {
  event_type: string;
  business_id?: string;
  metadata?: Record<string, unknown>;
  client_timestamp?: string;
  idempotency_key?: string;
  source?: 'mobile' | 'admin' | 'firs' | 'system';
}

export interface InvoicePayload {
  buyer_tin: string;
  line_items: Array<{ description: string; quantity: number; unit_price: number; vat_rate: number }>;
  invoice_date: string;
  idempotency_key: string;
}

export interface PaymentPayload {
  amount: number;
  description: string;
  tax_type: string;
  period: string;
  idempotency_key: string;
}

export interface AdminAlert {
  id: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
  action_url?: string;
}

export interface ReceiptPayload {
  business_id: string;
  vendor_name: string;
  vendor_tin?: string | null;
  amount_ngn: number;
  vat_amount_ngn: number;
  date: string;
  category: string;
  raw_ocr_text?: string | null;
  image_hash?: string | null;
  client_receipt_id: string;
  /** Client-generated UUID used for server-side idempotent deduplication on retry. */
  idempotency_key: string;
}

export interface VatReturnPayload {
  business_id: string;
  period_month: number;
  period_year: number;
  output_vat_ngn: number;
  input_vat_credits_ngn: number;
  net_vat_payable_ngn: number;
  receipt_ids: string[];
}

export interface TaxCalculationRequest {
  business_id?: string;
  annual_turnover: number;
  monthly_sales?: number;
  vat_input_credits_ngn?: number;
  employee_count?: number;
  vat_registered?: boolean;
  tin_verified?: boolean;
}

/**
 * Partially update the authenticated user's business profile.
 * @param payload Partial profile fields to update.
 */
export async function patchBusinessProfile(
  payload: Partial<BusinessProfilePayload>,
): Promise<BackendBusinessProfile> {
  try {
    return await apiRequest<BackendBusinessProfile>('/api/v1/business-profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && error.details && typeof error.details === 'object') {
      Sentry.captureException(error);
      return error.details as BackendBusinessProfile;
    }
    throw error;
  }
}

/**
 * Log a compliance event (e.g. TIN verified, VAT registered).
 * @param event The compliance event payload including an idempotency_key.
 */
export async function postComplianceEvent(
  event: ComplianceEventPayload,
): Promise<{ id: string; logged_at: string }> {
  return apiRequest<{ id: string; logged_at: string }>('/api/v1/compliance-events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

/**
 * Submit a new e-invoice to FIRS via the backend proxy.
 * @param invoice Invoice payload including line items and idempotency_key.
 */
export async function postInvoice(
  invoice: InvoicePayload,
): Promise<{ id: string; firs_ref?: string; status: string }> {
  const response = await apiRequest<{ id: string; firs_ref?: string; status: string }>('/api/v1/invoices', {
    method: 'POST',
    body: JSON.stringify(invoice),
  });

  await postComplianceEvent({
    event_type: 'invoice_submitted',
    metadata: {
      invoice_id: response.id,
      firs_ref: response.firs_ref,
      status: response.status,
    },
    client_timestamp: new Date().toISOString(),
    idempotency_key: invoice.idempotency_key + ':event',
    source: 'mobile',
  }).catch(() => undefined);

  return response;
}

/**
 * Initiate a Remita payment for a tax obligation.
 * @param payload Payment payload including idempotency_key.
 */
export async function initiatePayment(
  payload: PaymentPayload,
): Promise<{ remita_rrr: string; checkout_url: string }> {
  try {
    const response = await apiRequest<{ remita_rrr: string; checkout_url: string }>('/api/v1/payments/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO tax_payments (provider, remita_rrr, amount, currency, status)
       VALUES ('remita', ?, ?, 'NGN', 'pending')`,
      [response.remita_rrr, payload.amount]
    );

    return response;
  } catch (error) {
    // Never queue payment initiation for offline replay. A timeout may occur
    // after provider acceptance; reconcile with the original idempotency key.
    if (!(error instanceof ApiError)) {
      Sentry.captureException(error, { tags: { operation: 'payment_initiation_outcome_unknown' } });
    }
    throw error;
  }
}

/**
 * Trigger asynchronous TIN verification via FIRS lookup.
 * @param tin 10-digit TIN string.
 */
export async function verifyTin(
  tin: string,
): Promise<{ status: 'pending' | 'verified' | 'failed'; message?: string }> {
  return apiRequest<{ status: 'pending' | 'verified' | 'failed'; message?: string }>('/api/v1/tin/verify', {
    method: 'POST',
    body: JSON.stringify({ tin }),
  });
}

/**
 * Fetch pending admin-broadcast alerts for the authenticated user.
 */
export async function getAlerts(): Promise<AdminAlert[]> {
  return apiRequest<AdminAlert[]>('/api/v1/alerts');
}

/**
 * Submit a scanned receipt for backend validation and VAT credit processing.
 */
export async function submitReceipt(
  payload: ReceiptPayload,
): Promise<{ id: string; vat_credit_ngn?: number; status: string }> {
  return apiRequest<{ id: string; vat_credit_ngn?: number; status: string }>('/api/v1/receipts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Submit a VAT return payload.
 */
export async function submitVatReturn(
  payload: VatReturnPayload,
): Promise<{ id: string; firs_ref: string; period: string }> {
  return apiRequest<{ id: string; firs_ref: string; period: string }>('/api/v1/vat-returns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Request a server-side tax calculation for validation.
 */
export async function calculateTax(
  payload: TaxCalculationRequest,
): Promise<TaxCalculationResult> {
  return apiRequest<TaxCalculationResult>('/api/v1/tax/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
