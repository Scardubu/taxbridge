import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as Sentry from '@sentry/react-native';
import { TokenService } from './tokenService';
import { useAuthStore } from '../stores/authStore';
import { getDatabase } from './database';
import type { TaxCalculationResult } from '../types/taxEngine';

type JsonRecord = Record<string, unknown>;

const DEVICE_ID_KEY = 'taxbridge:installation_device_id';
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function getDeviceId(): Promise<string> {
  deviceIdPromise ??= (async () => {
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored && DEVICE_ID_PATTERN.test(stored)) return stored;

    // Device model/build identifiers are shared by many installations. Use a
    // random per-install UUID persisted in SecureStore for stable sync identity.
    const generated = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
    return generated;
  })().catch((error) => {
    deviceIdPromise = null;
    throw error;
  });
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

    if (response.status === 401 || response.status === 403) {
      return null;
    }
    if (!response.ok) {
      const payload = await readErrorPayload(response);
      throw new ApiError(
        response.status,
        typeof payload.code === 'string' ? payload.code : 'refresh_failed',
        typeof payload.message === 'string' ? payload.message : 'Unable to refresh session',
        payload,
      );
    }

    const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken) {
      throw new ApiError(502, 'AUTH_REFRESH_INVALID_RESPONSE', 'Refresh response did not contain an access token');
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
    // Only a definitive refresh-token rejection expires the local session.
    // Network errors and 5xx responses are propagated without deleting tokens.
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      await TokenService.clearTokens();
      await useAuthStore.getState().logout();
      throw new ApiError(401, 'session_expired', 'Session expired');
    }

    const retryResponse = await executeRequest(path, options, newAccessToken);
    if (!retryResponse.ok) {
      const retryPayload = await readErrorPayload(retryResponse);
      if (retryResponse.status === 401) {
        await TokenService.clearTokens();
        await useAuthStore.getState().logout();
        throw new ApiError(401, 'session_expired', 'Session expired', retryPayload);
      }
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
  try {
    return await apiRequest<{ id: string; logged_at: string }>('/api/v1/compliance-events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      const { offlineQueue } = await import('./offlineQueue');
      await offlineQueue.enqueue('COMPLIANCE_EVENT', {
        event_type: event.event_type,
        business_id: event.business_id,
        metadata: event.metadata ?? {},
        client_timestamp: event.client_timestamp ?? new Date().toISOString(),
        source: event.source ?? 'mobile',
      });
    }
    throw error;
  }
}

/**
 * Submit a new e-invoice to FIRS via the backend proxy.
 * @param invoice Invoice payload including line items and idempotency_key.
 */
export async function postInvoice(
  invoice: InvoicePayload,
): Promise<{ id: string; firs_ref?: string; status: string }> {
  try {
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
      idempotency_key: `${invoice.idempotency_key}:event`,
      source: 'mobile',
    }).catch(() => undefined);

    return response;
  } catch (error) {
    if (!(error instanceof ApiError)) {
      const { offlineQueue } = await import('./offlineQueue');
      await offlineQueue.enqueue('INVOICE_SUBMIT', invoice as unknown as Record<string, unknown>);
    }
    throw error;
  }
}

/**
 * Initiate a Remita payment for a tax obligation.
 * @param payload Payment payload including idempotency_key.
 */
export async function initiatePayment(
  payload: PaymentPayload,
): Promise<{ remita_rrr: string; checkout_url: string }> {
  // Payment initiation has an external side effect. It must never be queued for
  // blind offline replay; the user must retry only after checking server status.
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
}

/**
 * Verify a TIN through the active onboarding API contract.
 * The API currently accepts the server-defined 8-digit format and returns
 * { valid, entityName, entityType, registrationDate }.
 */
export async function verifyTin(
  tin: string,
): Promise<{ status: 'pending' | 'verified' | 'failed'; message?: string }> {
  try {
    const result = await apiRequest<{
      valid: boolean;
      entityName?: string;
    }>('/api/v1/onboarding/tin', {
      method: 'POST',
      body: JSON.stringify({ tin }),
    });

    return {
      status: result.valid ? 'verified' : 'failed',
      ...(result.entityName ? { message: `Verified: ${result.entityName}` } : {}),
    };
  } catch (error) {
    const details = error instanceof ApiError && error.details && typeof error.details === 'object'
      ? error.details as JsonRecord
      : {};
    if (error instanceof ApiError && (error.code === 'TIN_INVALID' || details.error === 'TIN_INVALID')) {
      return { status: 'failed', message: error.message };
    }
    throw error;
  }
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
  try {
    return await apiRequest<{ id: string; vat_credit_ngn?: number; status: string }>('/api/v1/receipts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      const { offlineQueue } = await import('./offlineQueue');
      await offlineQueue.enqueue('RECEIPT_SUBMIT', payload as unknown as Record<string, unknown>);
    }
    throw error;
  }
}

/**
 * Submit a VAT return payload.
 */
export async function submitVatReturn(
  payload: VatReturnPayload,
): Promise<{ id: string; firs_ref: string; period: string }> {
  try {
    return await apiRequest<{ id: string; firs_ref: string; period: string }>('/api/v1/vat-returns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      const { offlineQueue } = await import('./offlineQueue');
      await offlineQueue.enqueue('VAT_RETURN', payload as unknown as Record<string, unknown>);
    }
    throw error;
  }
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
