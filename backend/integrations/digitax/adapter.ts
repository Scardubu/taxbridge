import crypto from 'crypto';

export type DigiTaxSubmitResult = {
  nrsReference: string;
  qrCode: string;
};

export type DigiTaxSubmitInput = {
  invoiceId: string;
  ublXml: string;
};

export type DigiTaxAdapterConfig = {
  apiUrl: string;
  apiKey?: string;
  hmacSecret?: string;
  mockMode: boolean;
};

export class DigiTaxError extends Error {
  public readonly retriable: boolean;

  constructor(message: string, opts?: { retriable?: boolean }) {
    super(message);
    this.name = 'DigiTaxError';
    this.retriable = Boolean(opts?.retriable);
  }
}

function mockSubmit(input: DigiTaxSubmitInput): DigiTaxSubmitResult {
  const nrsReference = `NRS-MOCK-${input.invoiceId.slice(0, 8)}`;
  const qrCode = `QR-MOCK-${input.invoiceId}`;
  return { nrsReference, qrCode };
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function submitToDigiTax(
  input: DigiTaxSubmitInput,
  config: DigiTaxAdapterConfig
): Promise<DigiTaxSubmitResult> {
  if (config.mockMode) return mockSubmit(input);

  if (!config.apiKey) throw new DigiTaxError('Missing DIGITAX_API_KEY', { retriable: false });

  const url = `${config.apiUrl.replace(/\/$/, '')}/v1/invoices/submit`;
  const payload = JSON.stringify({ invoiceId: input.invoiceId, ublXml: input.ublXml });

  const signature = config.hmacSecret ? signPayload(payload, config.hmacSecret) : '';
  const timestamp = Date.now().toString();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': config.apiKey,
    'X-Timestamp': timestamp
  };
  if (signature) headers['X-Signature'] = signature;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: payload,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const retriable = res.status >= 500 || res.status === 429;
    throw new DigiTaxError(`DigiTax error ${res.status}: ${text}`, { retriable });
  }

  const data = (await res.json()) as any;
  const nrsReference = String(data?.nrsReference || data?.nrs_reference || '');
  const qrCode = String(data?.qrCode || data?.qr_code || '');

  if (!nrsReference) throw new DigiTaxError('Missing nrsReference in DigiTax response', { retriable: false });

  return { nrsReference, qrCode };
}
