import type { InvoiceItem } from '../types/invoice';

import { ApiError, createInvoice } from './api';
import { getPendingInvoices, markInvoiceSynced, updateInvoiceStatus } from './database';
import { setInvoiceRetryMetadata } from './database';

function isRetryableStatus(status: number): boolean {
  // Retry server errors and explicit rate limiting/timeouts.
  if (status >= 500) return true;
  return status === 408 || status === 429;
}

function isNetworkError(err: unknown): boolean {
  // fetch() typically throws TypeError on network failures.
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /network\s?error|failed\s?to\s?fetch|timeout|timed\s?out/i.test(msg);
}

function computeBackoffMs(attempt: number, retryAfterMs?: number): number {
  // attempt is 1-based
  const base = Math.min(5 * 60_000, 1000 * Math.pow(2, Math.max(0, attempt - 1))); // cap at 5 minutes
  const jitter = Math.floor(Math.random() * 1000);
  const serverHint = retryAfterMs !== undefined ? Math.min(5 * 60_000, Math.max(0, retryAfterMs)) : undefined;
  return (serverHint ?? base) + jitter;
}

export async function syncPendingInvoices(): Promise<{ synced: number; failed: number; deferred: number }> {
  const pending = await getPendingInvoices();
  let synced = 0;
  let failed = 0;
  let deferred = 0;

  for (const inv of pending) {
    try {
      await updateInvoiceStatus(inv.id, 'processing');
      const items = JSON.parse(inv.items) as InvoiceItem[];
      const maxAttempts = 8;
      const nextAttempt = (inv.attempts ?? 0) + 1;

      try {
        const result = await createInvoice(
          { customerName: inv.customerName ?? undefined, items },
          { idempotencyKey: inv.id }
        );

        await markInvoiceSynced({
          id: inv.id,
          serverId: result.invoiceId,
          status: (result.status as any) || 'queued'
        });
        synced += 1;
      } catch (err) {
        const apiStatus = err instanceof ApiError ? err.status : null;
        const retryable =
          (apiStatus !== null && isRetryableStatus(apiStatus)) ||
          (apiStatus === null && isNetworkError(err));

        if (!retryable) {
          await updateInvoiceStatus(inv.id, 'failed');
          await setInvoiceRetryMetadata(inv.id, nextAttempt, null);
          failed += 1;
          continue;
        }

        if (nextAttempt >= maxAttempts) {
          await updateInvoiceStatus(inv.id, 'failed');
          await setInvoiceRetryMetadata(inv.id, nextAttempt, null);
          failed += 1;
          continue;
        }

        const backoffMs = computeBackoffMs(nextAttempt, err instanceof ApiError ? err.retryAfterMs : undefined);
        const nextRetry = new Date(Date.now() + backoffMs).toISOString();
        await updateInvoiceStatus(inv.id, 'queued');
        await setInvoiceRetryMetadata(inv.id, nextAttempt, nextRetry);
        deferred += 1;
      }
    } catch {
      // Unexpected failure (DB/JSON/etc). Mark failed so user can see it.
      await updateInvoiceStatus(inv.id, 'failed');
      failed += 1;
    }
  }

  return { synced, failed, deferred };
}
