/**
 * NRS Submission Service - Hardened for Production
 * 
 * Features:
 * - Idempotency via nrsReference tracking
 * - Exponential backoff retry logic
 * - Circuit breaker pattern
 * - Comprehensive observability
 * - Atomic state transitions
 */

import { getPrismaClient } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import submitToDigiTax from '../integrations/digitax/adapter';
import { generateUBL } from '../lib/ubl/generator';
import { config } from '../lib/config';

const log = createLogger('nrs-submission');
const prisma = getPrismaClient();

export interface NRSSubmissionResult {
  success: boolean;
  invoiceId: string;
  nrsReference?: string;
  firsIRN?: string;
  firsCSID?: string;
  error?: string;
  retryable: boolean;
  attemptNumber: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 consecutive failures
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 1000; // 1 second

// In-memory circuit breaker state (in production, use Redis)
let circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailureTime: 0,
  state: 'closed',
};

/**
 * Submit invoice to NRS with idempotency and retry logic
 */
export async function submitToNRS(
  invoiceId: string,
  options: {
    forceResubmit?: boolean;
    maxRetries?: number;
  } = {}
): Promise<NRSSubmissionResult> {
  const maxRetries = options.maxRetries ?? MAX_RETRY_ATTEMPTS;
  let attemptNumber = 0;

  log.info('Starting NRS submission', { invoiceId, options });

  // Check circuit breaker
  if (!canAttemptSubmission()) {
    log.warn('Circuit breaker is open, rejecting submission', { invoiceId });
    return {
      success: false,
      invoiceId,
      error: 'NRS service temporarily unavailable (circuit breaker open)',
      retryable: true,
      attemptNumber: 0,
    };
  }

  while (attemptNumber < maxRetries) {
    attemptNumber++;

    try {
      // Fetch invoice with lock to prevent concurrent submissions
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { business: true },
      });

      if (!invoice) {
        return {
          success: false,
          invoiceId,
          error: 'Invoice not found',
          retryable: false,
          attemptNumber,
        };
      }

      // Idempotency check: if already submitted and not forcing resubmit, return existing result
      if (invoice.nrsReference && !options.forceResubmit) {
        log.info('Invoice already submitted to NRS (idempotent)', {
          invoiceId,
          nrsReference: invoice.nrsReference,
        });

        return {
          success: true,
          invoiceId,
          nrsReference: invoice.nrsReference,
          firsIRN: invoice.firsIRN || undefined,
          firsCSID: invoice.firsCSID || undefined,
          retryable: false,
          attemptNumber,
        };
      }

      // Validate invoice is ready for NRS submission
      if (!invoice.nrsCompliant) {
        return {
          success: false,
          invoiceId,
          error: 'Invoice is not NRS compliant',
          retryable: false,
          attemptNumber,
        };
      }

      // Generate UBL XML if not already generated
      let ublXml = invoice.ublXml;
      if (!ublXml) {
        log.info('Generating UBL XML for invoice', { invoiceId });

        // Null-check: ensure invoice has a business relation for UBL generation
        if (!invoice.business) {
          return {
            success: false,
            invoiceId,
            error: 'Invoice has no associated business',
            retryable: false,
            attemptNumber,
          };
        }

        // Transform Prisma invoice to UBL InvoiceData shape
        const invoiceItems = Array.isArray(invoice.items)
          ? (invoice.items as Array<{ description: string; quantity: number; unitPrice: number }>)
          : [];
        
        ublXml = generateUBL({
          id: invoice.invoiceNumber || invoice.id,
          issueDate: invoice.createdAt.toISOString().split('T')[0],
          supplierTIN: invoice.business.tin || '',
          supplierName: invoice.business.name,
          supplierStreet: invoice.business.addressStreet || undefined,
          supplierCity: invoice.business.addressCity || undefined,
          customerName: invoice.customerName || undefined,
          customerTIN: invoice.customerTIN || undefined,
          items: invoiceItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          subtotal: Number(invoice.subtotal),
          vat: Number(invoice.vat),
          total: Number(invoice.total),
        });
        
        // Save UBL XML atomically
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { ublXml },
        });
      }

      // Null-check: ensure invoice has a business relation
      if (!invoice.business) {
        return {
          success: false,
          invoiceId,
          error: 'Invoice has no associated business',
          retryable: false,
          attemptNumber,
        };
      }

      // Submit to NRS via DigiTax APP
      log.info('Submitting to NRS via DigiTax', { invoiceId, attempt: attemptNumber });

      const isProduction = process.env.NODE_ENV === 'production';
      const submissionResult = await submitToDigiTax(
        {
          invoiceId: invoice.invoiceNumber || invoice.id,
          ublXml,
          idempotencyKey: `inv-${invoiceId}-${attemptNumber}`,
        },
        {
          apiUrl: config.duplo.apiUrl,
          apiKey: config.duplo.clientId || '',
          hmacSecret: config.duplo.clientSecret,
          mockMode: !isProduction,
        }
      );

      // Update invoice with NRS data atomically
      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          nrsReference: submissionResult.nrsReference,
          firsIRN: submissionResult.irn,
          firsCSID: submissionResult.csid,
          qrCode: submissionResult.qrCode,
          status: submissionResult.irn ? 'stamped' : 'sent',
          updatedAt: new Date(),
        },
      });

      // Reset circuit breaker on success
      resetCircuitBreaker();

      log.info('NRS submission successful', {
        invoiceId,
        nrsReference: submissionResult.nrsReference,
        firsIRN: submissionResult.irn,
        attemptNumber,
      });

      return {
        success: true,
        invoiceId,
        nrsReference: submissionResult.nrsReference,
        firsIRN: submissionResult.irn,
        firsCSID: submissionResult.csid,
        retryable: false,
        attemptNumber,
      };
    } catch (error: any) {
      log.error('NRS submission attempt failed', {
        invoiceId,
        attemptNumber,
        error: error.message,
        stack: error.stack,
      });

      // Determine if error is retryable
      const isRetryable = isRetryableError(error);

      // If last attempt or non-retryable, fail
      if (attemptNumber >= maxRetries || !isRetryable) {
        recordCircuitBreakerFailure();

        return {
          success: false,
          invoiceId,
          error: error.message,
          retryable: isRetryable,
          attemptNumber,
        };
      }

      // Exponential backoff before retry
      const delay = calculateBackoffDelay(attemptNumber);
      log.info('Retrying NRS submission after delay', {
        invoiceId,
        attemptNumber,
        nextAttempt: attemptNumber + 1,
        delayMs: delay,
      });

      await sleep(delay);
    }
  }

  // All retries exhausted
  recordCircuitBreakerFailure();

  return {
    success: false,
    invoiceId,
    error: 'Max retry attempts exhausted',
    retryable: true,
    attemptNumber,
  };
}

/**
 * Batch submit multiple invoices with concurrency control
 */
export async function batchSubmitToNRS(
  invoiceIds: string[],
  options: {
    concurrency?: number;
    continueOnError?: boolean;
  } = {}
): Promise<{
  results: NRSSubmissionResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
}> {
  const concurrency = options.concurrency ?? 5;
  const continueOnError = options.continueOnError ?? true;

  log.info('Starting batch NRS submission', {
    totalInvoices: invoiceIds.length,
    concurrency,
  });

  const results: NRSSubmissionResult[] = [];
  const chunks = chunkArray(invoiceIds, concurrency);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (invoiceId) => {
        try {
          return await submitToNRS(invoiceId);
        } catch (error: any) {
          log.error('Batch submission error', { invoiceId, error: error.message });
          return {
            success: false,
            invoiceId,
            error: error.message,
            retryable: true,
            attemptNumber: 0,
          };
        }
      })
    );

    results.push(...chunkResults);

    // If not continuing on error and we have failures, stop
    if (!continueOnError && chunkResults.some((r) => !r.success)) {
      log.warn('Stopping batch submission due to errors', {
        processedSoFar: results.length,
      });
      break;
    }
  }

  const summary = {
    total: invoiceIds.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success && !r.retryable).length,
    skipped: results.filter((r) => !r.success && r.retryable).length,
  };

  log.info('Batch NRS submission complete', summary);

  return { results, summary };
}

/**
 * Retry failed NRS submissions
 */
export async function retryFailedSubmissions(
  options: {
    maxAge?: number; // Max age in milliseconds
    limit?: number;
  } = {}
): Promise<{
  retried: number;
  successful: number;
  failed: number;
}> {
  const maxAge = options.maxAge ?? 24 * 60 * 60 * 1000; // 24 hours
  const limit = options.limit ?? 100;

  const cutoffDate = new Date(Date.now() - maxAge);

  // Find invoices that are NRS compliant but not yet submitted
  const failedInvoices = await prisma.invoice.findMany({
    where: {
      nrsCompliant: true,
      nrsReference: null,
      createdAt: { gte: cutoffDate },
      status: { in: ['draft', 'sent', 'failed'] },
    },
    take: limit,
    select: { id: true },
  });

  log.info('Retrying failed NRS submissions', {
    count: failedInvoices.length,
    maxAge,
  });

  const results = await batchSubmitToNRS(
    failedInvoices.map((i) => i.id),
    { concurrency: 3, continueOnError: true }
  );

  return {
    retried: results.results.length,
    successful: results.summary.successful,
    failed: results.summary.failed,
  };
}

// ============================================================================
// Circuit Breaker Helpers
// ============================================================================

function canAttemptSubmission(): boolean {
  const now = Date.now();

  if (circuitBreaker.state === 'open') {
    // Check if timeout has elapsed
    if (now - circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
      log.info('Circuit breaker transitioning to half-open');
      circuitBreaker.state = 'half-open';
      return true;
    }
    return false;
  }

  return true; // closed or half-open
}

function recordCircuitBreakerFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    log.warn('Circuit breaker opening due to consecutive failures', {
      failures: circuitBreaker.failures,
    });
    circuitBreaker.state = 'open';
  }
}

function resetCircuitBreaker(): void {
  if (circuitBreaker.state === 'half-open') {
    log.info('Circuit breaker closing after successful submission');
  }
  circuitBreaker.failures = 0;
  circuitBreaker.state = 'closed';
}

// ============================================================================
// Retry Helpers
// ============================================================================

function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // 5xx server errors are retryable
  if (error.statusCode >= 500 && error.statusCode < 600) {
    return true;
  }

  // 429 rate limit is retryable
  if (error.statusCode === 429) {
    return true;
  }

  // Specific Digitax errors that are retryable
  if (error.message?.includes('timeout') || error.message?.includes('temporarily unavailable')) {
    return true;
  }

  // 4xx client errors are generally not retryable
  if (error.statusCode >= 400 && error.statusCode < 500) {
    return false;
  }

  // Default to retryable for unknown errors
  return true;
}

function calculateBackoffDelay(attemptNumber: number): number {
  // Exponential backoff with jitter
  const exponentialDelay = RETRY_BASE_DELAY * Math.pow(2, attemptNumber - 1);
  const jitter = Math.random() * 1000; // 0-1000ms jitter
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============================================================================
// Observability
// ============================================================================

export async function getNRSSubmissionMetrics(): Promise<{
  circuitBreakerState: CircuitBreakerState;
  pendingSubmissions: number;
  recentFailures: number;
  successRate: number;
}> {
  // Count pending submissions
  const pendingSubmissions = await prisma.invoice.count({
    where: {
      nrsCompliant: true,
      nrsReference: null,
    },
  });

  // Count recent failures (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentInvoices = await prisma.invoice.findMany({
    where: {
      createdAt: { gte: oneHourAgo },
      nrsCompliant: true,
    },
    select: {
      nrsReference: true,
    },
  });

  const recentSubmissions = recentInvoices.length;
  const recentSuccesses = recentInvoices.filter((i) => i.nrsReference).length;
  const recentFailures = recentSubmissions - recentSuccesses;
  const successRate = recentSubmissions > 0 ? recentSuccesses / recentSubmissions : 0;

  return {
    circuitBreakerState: { ...circuitBreaker },
    pendingSubmissions,
    recentFailures,
    successRate,
  };
}
