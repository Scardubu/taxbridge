export type QueueFailureDisposition = 'retry' | 'terminal' | 'pause';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

/**
 * Network/5xx/429 failures may be retried with the same idempotency key.
 * A 401 pauses processing until the user signs in again. Definitive 4xx
 * responses are terminal and must not burn the retry budget or be replayed.
 */
export function classifyQueueFailure(error: unknown): QueueFailureDisposition {
  const record = asRecord(error);
  const status = typeof record?.status === 'number' ? record.status : undefined;
  if (status === 401) return 'pause';

  const details = asRecord(record?.details);
  if (details?.retryable === false) return 'terminal';
  if (details?.retryable === true) return 'retry';

  if (status === 408 || status === 429 || (status !== undefined && status >= 500)) {
    return 'retry';
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return 'terminal';
  }

  // Fetch/network failures have no HTTP status and remain retryable.
  return 'retry';
}


export type ServerOperationDisposition = 'complete' | 'terminal' | 'pending';

/** Only explicit acknowledgement/resolution completes a local operation. */
export function classifyServerOperationStatus(status: string): ServerOperationDisposition {
  if (status === 'acknowledged' || status === 'resolved') return 'complete';
  if (status === 'dead_letter') return 'terminal';
  return 'pending';
}
