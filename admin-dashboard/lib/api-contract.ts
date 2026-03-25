export const TAXBRIDGE_API_VERSION = '13';

const DEVICE_STORAGE_KEY = 'tb-enterprise-v2:device-id';
const DEFAULT_ADMIN_DEVICE_ID = 'admin-dashboard';

function createBrowserDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `admin-${crypto.randomUUID()}`;
  }

  return `admin-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getStableAdminDeviceId(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_ADMIN_DEVICE_ID;
  }

  try {
    const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const nextId = createBrowserDeviceId();
    window.localStorage.setItem(DEVICE_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return DEFAULT_ADMIN_DEVICE_ID;
  }
}

export function withTaxBridgeHeaders(input?: HeadersInit): Headers {
  const headers = new Headers(input || {});

  if (!headers.has('X-TaxBridge-Version')) {
    headers.set('X-TaxBridge-Version', TAXBRIDGE_API_VERSION);
  }

  if (!headers.has('X-Device-ID')) {
    headers.set('X-Device-ID', getStableAdminDeviceId());
  }

  return headers;
}

export function getTaxBridgeSseUrl(): string | null {
  const explicitUrl = process.env.NEXT_PUBLIC_SSE_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!apiBase) {
    return null;
  }

  return `${apiBase.replace(/\/$/, '')}/api/v1/events/stream`;
}
