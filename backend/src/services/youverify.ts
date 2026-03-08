/**
 * Youverify Service — TaxBridge V13 Sovereign
 *
 * TIN validation + CAC/RC lookup wrapper.
 * Never stores credentials. YOUVERIFY_API_KEY from env only.
 */
import { logger } from '../lib/logger';

const YOUVERIFY_BASE = 'https://api.youverify.co/v2';

interface TINVerificationResult {
  valid:            boolean;
  entityName?:      string;
  entityType?:      string;
  registrationDate?: string;
  tin?:             string;
}

interface CACVerificationResult {
  valid:            boolean;
  entityName?:      string;
  rcNumber?:        string;
  directors?:       string[];
  status?:          string;
}

async function youverifyRequest(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${YOUVERIFY_BASE}${endpoint}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'token':        process.env.YOUVERIFY_API_KEY!,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Youverify API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<any>;
}

/**
 * Validate a Nigerian TIN via Youverify.
 * Returns structured result — never stores credentials.
 */
export async function validateTIN(tin: string): Promise<TINVerificationResult> {
  try {
    const data = await youverifyRequest('/identity/queries/tin', { id: tin, isSubjectConsent: true });
    return {
      valid:            data.data?.status === 'verified',
      entityName:       data.data?.businessName ?? data.data?.fullName,
      entityType:       data.data?.entityType,
      registrationDate: data.data?.registrationDate,
      tin,
    };
  } catch (err) {
    logger.warn({ err, tin: '[REDACTED]' }, 'Youverify TIN validation failed');
    return { valid: false };
  }
}

/**
 * Lookup a CAC RC number via Youverify.
 * Format: RC-NNNNNN
 */
export async function validateCAC(rcNumber: string): Promise<CACVerificationResult> {
  try {
    const cleanRc = rcNumber.replace(/^RC-?/i, '');
    const data    = await youverifyRequest('/identity/queries/cac', {
      id:               cleanRc,
      isSubjectConsent: true,
    });
    return {
      valid:      data.data?.status === 'verified',
      entityName: data.data?.companyName,
      rcNumber:   data.data?.rcNumber ?? cleanRc,
      directors:  data.data?.directors ?? [],
      status:     data.data?.companyStatus,
    };
  } catch (err) {
    logger.warn({ err }, 'Youverify CAC lookup failed');
    return { valid: false };
  }
}
