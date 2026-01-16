import type { InvoiceItem } from '../types/invoice';

import { createInvoice } from './api';
import { getPendingInvoices, markInvoiceSynced, updateInvoiceStatus } from './database';
import { setInvoiceRetryMetadata } from './database';

function extractApiStatus(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const match = /API error\s+(\d{3})\b/.exec(msg);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRetryableStatus(status: number): boolean {
  // Retry server errors and explicit rate limiting/timeouts.
  if (status >= 500) return true;
  return status === 408 || status === 429;
}

export async function syncPendingInvoices(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingInvoices();
  let synced = 0;
  let failed = 0;

  for (const inv of pending) {
    try {
      await updateInvoiceStatus(inv.id, 'processing');
      const items = JSON.parse(inv.items) as InvoiceItem[];

      // Retry with exponential backoff for transient network errors and persist attempts
      const maxAttempts = 5;
      let attempt = inv.attempts ?? 0;
      let lastError: any = null;
      let successResult: any = null;

      while (attempt < maxAttempts) {
        try {
          const result = await createInvoice(
            { customerName: inv.customerName ?? undefined, items },
            { idempotencyKey: inv.id }
          );
          successResult = result;
          break;
        } catch (err) {
          lastError = err;

          const status = extractApiStatus(err);
          if (status !== null && !isRetryableStatus(status)) {
            // Non-retryable API error (e.g. auth/validation). Don't backoff-retry.
            break;
          }

          attempt += 1;
          const backoff = Math.min(30_000, 1000 * Math.pow(2, attempt - 1)); // cap at 30s
          const nextRetry = new Date(Date.now() + backoff).toISOString();
          // persist attempt count and nextRetry
          await setInvoiceRetryMetadata(inv.id, attempt, nextRetry);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }

      if (!successResult) throw lastError || new Error('Failed to create invoice after retries');

      await markInvoiceSynced({ id: inv.id, serverId: successResult.invoiceId, status: (successResult.status as any) || 'queued' });
      synced += 1;
    } catch {
      // mark as failed and leave retry metadata (nextRetry persisted earlier)
      await updateInvoiceStatus(inv.id, 'failed');
      failed += 1;
    }
  }

  return { synced, failed };
}
