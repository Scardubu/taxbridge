export class FetchError extends Error {
  status: number;
  url: string;
  body?: unknown;

  constructor(status: number, url: string, message: string, body?: unknown) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

function extractMessage(body: unknown): string | undefined {
  if (!body) return undefined;

  if (typeof body === 'string') {
    return body;
  }

  if (typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const maybeMessage = record.message;
    const maybeError = record.error;

    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError;
  }

  return undefined;
}

async function safeReadJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options?.headers || {}),
    },
  });

  const body = await safeReadJson(response);

  if (!response.ok) {
    const message = extractMessage(body) || `Request failed (${response.status})`;
    throw new FetchError(response.status, url, message, body);
  }

  return body as T;
}
