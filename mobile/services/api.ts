import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Sentry from '@sentry/react-native';
import { TokenService } from './tokenService';
import { useAuthStore } from '../stores/authStore';
import { getDatabase } from './database';

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
        typeof payload.code === 'string' ? payload.code : typeof payload.error === 'string' ? payload.error : 'refresh_failed',
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
        typeof retryPayload.code === 'string' ? retryPayload.code : typeof retryPayload.error === 'string' ? retryPayload.error : 'api_error',
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
      typeof errorPayload.code === 'string' ? errorPayload.code : typeof errorPayload.error === 'string' ? errorPayload.error : 'api_error',
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
  name: string;
  businessName: string;
  tradingName: string | null;
  cacNumber: string | null;
  rcNumber: string | null;
  tin: string | null;
  sector: string | null;
  businessType: string;
  annualTurnover: number | null;
  monthlyRevenue: number | null;
  totalFixedAssets: number | null;
  employeeCount: number;
  isVatRegistered: boolean;
  vatNumber: string | null;
  lga: string | null;
  state: string | null;
  hasValidTIN: boolean;
  email: string | null;
  phone: string | null;
  updatedAt: string;
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
  client_timestamp: string;
  idempotency_key: string;
  source: 'mobile';
}

export interface InvoicePayload {
  customerName?: string;
  customerTIN?: string;
  customerEndpointId?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  idempotency_key: string;
}

export interface PaymentPayload {
  invoiceId: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  gateway?: 'paystack' | 'flutterwave' | 'remita';
  callbackUrl?: string;
  idempotency_key: string;
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

/**
 * Internal VAT return preparation input. This creates a TaxBridge filing
 * record; it is not an NRS submission and does not issue an NRS reference.
 * Receipt IDs are rejected until server-verified evidence can be linked to a
 * return without trusting client-side receipt identifiers.
 */
export interface VatReturnPayload {
  period_month: number;
  period_year: number;
  output_vat_ngn: number;
  input_vat_credits_ngn: number;
  receipt_ids: string[];
}

export type TaxCalculationRequest =
  | {
      taxType: 'PIT';
      grossIncome: number;
      reliefs?: {
        pension?: number;
        nhf?: number;
        lifeInsurance?: number;
        annualRent?: number;
      };
    }
  | { taxType: 'VAT'; amount: number; category?: string }
  | {
      taxType: 'CIT';
      revenue: number;
      expenses: number;
      employeeCount?: number;
      digitalIncome?: number;
    }
  | {
      taxType: 'CGT';
      proceeds: number;
      costBasis: number;
      assetType: 'shares' | 'property' | 'crypto' | 'other';
      holdingPeriodMonths?: number;
    }
  | {
      taxType: 'WHT';
      amount: number;
      type:
        | 'dividend' | 'interest' | 'rent' | 'royalty'
        | 'consultancy' | 'construction' | 'contractServices'
        | 'professionalFees';
    }
  | {
      taxType: 'PAYE';
      grossSalary: number;
      allowances?: {
        housing?: number;
        transport?: number;
        meal?: number;
        others?: number;
      };
    };

export interface ServerTaxCalculationResponse {
  success: true;
  data: Record<string, unknown>;
}

export interface PreparedVatReturnResponse {
  filingReference: string;
  period: string;
  taxType: 'VAT';
  netPayable: number;
  creditCarryover: number;
}

/**
 * Partially update the authenticated user's business profile.
 * @param payload Partial profile fields to update.
 */
export async function patchBusinessProfile(
  payload: Partial<BusinessProfilePayload>,
): Promise<BackendBusinessProfile> {
  const requestBody = {
    name: payload.businessName,
    tradingName: payload.tradingName,
    tin: payload.tin,
    rcNumber: payload.rcNumber,
    sector: payload.sector,
    businessType: payload.businessType,
    annualTurnover: payload.annualTurnover,
    monthlyRevenue: payload.monthlyRevenue,
    totalFixedAssets: payload.totalFixedAssets,
    employeeCount: payload.employeeCount,
    isVatRegistered: payload.isVatRegistered,
    vatNumber: payload.vatNumber,
    lga: payload.lga,
    state: payload.state,
    phone: payload.phone,
    email: payload.email,
    // hasValidTIN is deliberately omitted: only provider verification can
    // set the server-side tinVerified flag.
  };

  try {
    const response = await apiRequest<{
      success: true;
      data: BackendBusinessProfile;
    }>('/api/v1/business/profile', {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });

    if (!response || response.success !== true || !response.data?.id) {
      throw new ApiError(502, 'INVALID_BUSINESS_PROFILE_RESPONSE', 'The server returned an invalid business profile response.');
    }
    return response.data;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;

    const businessName = payload.businessName?.trim();
    if (!businessName) {
      throw new ApiError(400, 'BUSINESS_NAME_REQUIRED', 'Enter a business name before creating your business profile.');
    }

    const created = await apiRequest<{
      success: true;
      data: { business: BackendBusinessProfile };
    }>('/api/v1/business', {
      method: 'POST',
      body: JSON.stringify({
        name: businessName,
        cacNumber: payload.rcNumber,
        tin: payload.tin,
        email: payload.email,
        phone: payload.phone,
        tradingName: payload.tradingName,
        sector: payload.sector,
        annualTurnover: payload.annualTurnover,
        monthlyRevenue: payload.monthlyRevenue,
        totalFixedAssets: payload.totalFixedAssets,
        employeeCount: payload.employeeCount,
        isVatRegistered: payload.isVatRegistered,
        vatNumber: payload.vatNumber,
        businessType: payload.businessType,
        address: { state: payload.state, lga: payload.lga },
      }),
    });

    const business = created?.data?.business;
    if (!created || created.success !== true || !business?.id) {
      throw new ApiError(502, 'INVALID_BUSINESS_PROFILE_RESPONSE', 'The server did not create a valid business profile.');
    }
    return business;
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
    headers: { 'Idempotency-Key': event.idempotency_key },
    body: JSON.stringify(event),
  });
}

/**
 * Submit a new e-invoice to FIRS via the backend proxy.
 * @param invoice Invoice payload including line items and idempotency_key.
 */
export async function postInvoice(
  invoice: InvoicePayload,
): Promise<{ invoiceId: string; status: string }> {
  return apiRequest<{ invoiceId: string; status: string }>('/api/v1/invoices', {
    method: 'POST',
    headers: { 'Idempotency-Key': invoice.idempotency_key },
    body: JSON.stringify({
      customerName: invoice.customerName,
      customerTIN: invoice.customerTIN,
      customerEndpointId: invoice.customerEndpointId,
      items: invoice.items,
    }),
  });
}

/**
 * Initiate a Remita payment for a tax obligation.
 * @param payload Payment payload including idempotency_key.
 */
export async function initiatePayment(
  payload: PaymentPayload,
): Promise<{ rrr: string; paymentUrl: string | null; amount: number; gateway?: string }> {
  try {
    const response = await apiRequest<{ rrr: string; paymentUrl: string | null; amount: number; gateway?: string }>(
      '/api/v1/payments/generate',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': payload.idempotency_key },
        body: JSON.stringify({
          invoiceId: payload.invoiceId,
          payerName: payload.payerName,
          payerEmail: payload.payerEmail,
          payerPhone: payload.payerPhone,
          gateway: payload.gateway,
          callbackUrl: payload.callbackUrl,
        }),
      },
    );

    const db = await getDatabase();
    const provider = response.gateway ?? payload.gateway ?? 'remita';
    await db.runAsync(
      "INSERT INTO tax_payments (provider, provider_ref, remita_rrr, amount, currency, status) VALUES (?, ?, ?, ?, 'NGN', 'pending')",
      [provider, response.rrr, provider === 'remita' ? response.rrr : null, response.amount],
    );
    return response;
  } catch (error) {
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
): Promise<{ status: 'verified' | 'failed'; message?: string }> {
  const normalizedTin = tin.trim();
  if (!/^\d{8}$/.test(normalizedTin)) {
    throw new ApiError(400, 'INVALID_TIN_FORMAT', 'TIN must contain exactly 8 digits.');
  }

  try {
    const result = await apiRequest<{
      valid: true;
      entityName?: string;
      entityType?: string;
      registrationDate?: string;
    }>('/api/v1/onboarding/tin', {
      method: 'POST',
      body: JSON.stringify({ tin: normalizedTin }),
    });
    return {
      status: 'verified',
      message: result.entityName ? 'TIN verified for ' + result.entityName : 'TIN verified',
    };
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 422 &&
      (error.details as JsonRecord | undefined)?.error === 'TIN_INVALID'
    ) {
      return { status: 'failed', message: error.message };
    }
    throw error;
  }
}

/**
 * Fetch pending admin-broadcast alerts for the authenticated user.
 */
/**
 * Submit a scanned receipt for backend validation and VAT credit processing.
 */
/**
 * Legacy OCR-only receipt submission is intentionally disabled. Use
 * uploadReceiptEvidence() from receiptEvidence.ts to create a signed upload,
 * verify the uploaded bytes, scan for malware and complete human review.
 */
export async function submitReceipt(
  _payload: ReceiptPayload,
): Promise<never> {
  throw new ApiError(
    410,
    'RECEIPT_EVIDENCE_WORKFLOW_REQUIRED',
    'Legacy OCR-only receipt submission is disabled. Use the verified receipt-evidence upload workflow.',
  );
}

/**
 * Submit a VAT return payload.
 */
/**
 * Create an internal TaxBridge VAT return record. This does not file with NRS.
 */
export async function prepareVatReturn(
  payload: VatReturnPayload,
): Promise<PreparedVatReturnResponse> {
  if (payload.receipt_ids.length > 0) {
    throw new ApiError(
      422,
      'RECEIPT_EVIDENCE_LINKING_NOT_SUPPORTED',
      'Receipt attachments must be linked through server-verified evidence before they can support a VAT return.',
    );
  }
  if (
    !Number.isInteger(payload.period_month) ||
    payload.period_month < 1 ||
    payload.period_month > 12 ||
    !Number.isInteger(payload.period_year) ||
    payload.period_year < 2000 ||
    payload.period_year > 2200
  ) {
    throw new ApiError(400, 'INVALID_VAT_PERIOD', 'VAT period must contain a valid month and year.');
  }

  return apiRequest<PreparedVatReturnResponse>('/api/v1/filings/vat', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'vat-return:' + payload.period_year + '-' + String(payload.period_month).padStart(2, '0') },
    body: JSON.stringify({
      period: payload.period_year + '-' + String(payload.period_month).padStart(2, '0'),
      outputVAT: payload.output_vat_ngn,
      inputVAT: payload.input_vat_credits_ngn,
    }),
  });
}

/**
 * Request a server-side tax calculation for validation.
 */
/**
 * Run one of the server's explicit tax calculators. The taxType discriminator
 * is part of the request contract and selects the matching backend schema.
 */
export async function calculateTax(
  payload: TaxCalculationRequest,
): Promise<ServerTaxCalculationResponse> {
  const { taxType, ...body } = payload;
  return apiRequest<ServerTaxCalculationResponse>(
    '/api/v1/tax/calculate/' + taxType.toLowerCase(),
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}
