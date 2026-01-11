import crypto from 'crypto';

export class DigiTaxError extends Error {
  retriable: boolean;
  constructor(message: string, retriable = false) {
    super(message);
    this.retriable = retriable;
    this.name = 'DigiTaxError';
  }
}

interface SubmitArgs {
  invoiceId: string;
  ublXml: string;
}

interface SubmitConfig {
  apiUrl: string;
  apiKey: string;
  hmacSecret: string | undefined | null;
  mockMode?: boolean;
}

export async function submitToDigiTax(
  args: SubmitArgs,
  config: SubmitConfig
): Promise<{ nrsReference: string; csid?: string; irn?: string; qrCode?: string }>
{
  const { invoiceId, ublXml } = args;
  const { apiUrl, apiKey, hmacSecret, mockMode } = config;

  // Mock mode for local development / sandbox
  const useMock = mockMode ?? true;
  if (useMock) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      nrsReference: `NRS-MOCK-${Date.now()}`,
      csid: 'CSID-MOCK-123',
      irn: 'IRN-MOCK-456',
      qrCode: 'data:image/png;base64,MOCKQR=='
    };
  }

  if (!apiUrl || !apiKey) {
    throw new DigiTaxError('Missing DigiTax configuration (apiUrl/apiKey)', false);
  }

  const timestamp = Date.now().toString();
  const payload = JSON.stringify({ invoiceId, ublXml, timestamp });

  const signature = ((): string => {
    if (!hmacSecret) return '';
    return crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');
  })();

  try {
    const url = `${apiUrl.replace(/\/$/, '')}/v1/invoices/submit`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-Timestamp': timestamp
    };
    if (signature) headers['X-Signature'] = signature;

    // Use native fetch (Node 18+). Add timeout via AbortController.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ invoiceId, ublXml }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const statusCode = resp.status;
    let data: any = {};
    try {
      data = await resp.json();
    } catch {
      data = {};
    }

    if (resp.ok) {
      if (data.status === 'accepted' || data.status === 'success') {
        return {
          nrsReference: data.nrsReference || data.reference || '',
          csid: data.csid,
          irn: data.irn,
          qrCode: data.qrCodeData || data.qrCode
        };
      }

      // accepted HTTP but rejected by API business rules
      throw new DigiTaxError(data.message || 'Submission rejected by DigiTax', false);
    }

    // Non-2xx HTTP response
    const msg = data?.message || (await resp.text()).slice(0, 200) || resp.statusText;
    if (statusCode >= 400 && statusCode < 500) {
      throw new DigiTaxError(`Validation error: ${String(msg)}`, false);
    }
    if (statusCode >= 500) {
      throw new DigiTaxError(`DigiTax server error: ${String(msg)}`, true);
    }

    throw new DigiTaxError(`Unexpected response from DigiTax: ${String(msg)}`, true);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new DigiTaxError('DigiTax request timed out', true);
    }
    if (err instanceof DigiTaxError) throw err;
    throw new DigiTaxError(err?.message || 'Network error when contacting DigiTax', true);
  }
}

export default submitToDigiTax;
