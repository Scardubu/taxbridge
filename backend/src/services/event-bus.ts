/**
 * TaxBridge Event Bus — V11.0 P4
 *
 * Lightweight in-process event bus for domain events.
 * Integrates DLQ persistence for failed handlers.
 *
 * Events:
 *   transaction.created   — New invoice/payment created
 *   anomaly.detected      — Expense anomaly flagged
 *   filing.submitted      — Tax filing sent to NRS
 *   session.invalidated   — User session revoked (RBAC P3)
 *   dlq.threshold         — DLQ threshold exceeded
 *
 * DLQ Guard:
 *   - Every handler call is wrapped with try/catch
 *   - Failures are persisted to DLQJob model
 *   - Idempotency keys prevent duplicate processing
 *
 * Constraints:
 *   C-01  Prisma `any` types
 *   C-07  Graceful degradation — handler failure never propagates to caller
 */

import { createLogger } from '../lib/logger';
import { getPrismaClient } from '../lib/prisma';

const log = createLogger('event-bus');

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventName =
  | 'transaction.created'
  | 'anomaly.detected'
  | 'filing.submitted'
  | 'session.invalidated'
  | 'dlq.threshold'
  | 'invoice.stamped'
  | 'payment.confirmed'
  | 'expense.created'
  | 'onboarding.step_completed';

export interface DomainEvent<T = unknown> {
  name:           EventName;
  payload:        T;
  timestamp:      string;
  correlationId?: string;
  idempotencyKey?: string;
}

type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

// ─── Idempotency cache (in-memory LRU for speed, DB for durability) ──────────

const processedKeys = new Set<string>();
const MAX_CACHE_SIZE = 10_000;

function markProcessed(key: string): void {
  if (processedKeys.size >= MAX_CACHE_SIZE) {
    // Evict oldest entries (Set iteration order is insertion order)
    const first = processedKeys.values().next().value;
    if (first !== undefined) processedKeys.delete(first);
  }
  processedKeys.add(key);
}

function isProcessed(key: string): boolean {
  return processedKeys.has(key);
}

// ─── Event Bus singleton ──────────────────────────────────────────────────────

class EventBus {
  private handlers: Map<EventName, EventHandler[]> = new Map();

  /**
   * Register a handler for a specific event.
   * Handlers are executed in registration order.
   */
  on<T = unknown>(event: EventName, handler: EventHandler<T>): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler as EventHandler);
    this.handlers.set(event, existing);
    log.info('Handler registered', { event, handlerCount: existing.length });
  }

  /**
   * Emit a domain event. All registered handlers execute concurrently.
   * Individual handler failures are caught and persisted to DLQ — they
   * never propagate to the caller (C-07).
   */
  async emit<T = unknown>(event: DomainEvent<T>): Promise<void> {
    // Idempotency guard
    if (event.idempotencyKey && isProcessed(event.idempotencyKey)) {
      log.info('Duplicate event skipped', {
        event: event.name,
        idempotencyKey: event.idempotencyKey,
      });
      return;
    }

    const handlers = this.handlers.get(event.name) ?? [];
    if (handlers.length === 0) {
      log.info('No handlers for event', { event: event.name });
      return;
    }

    log.info('Emitting event', {
      event: event.name,
      handlerCount: handlers.length,
      correlationId: event.correlationId,
    });

    const results = await Promise.allSettled(
      handlers.map((handler) => handler(event))
    );

    // Mark as processed after all handlers complete
    if (event.idempotencyKey) {
      markProcessed(event.idempotencyKey);
    }

    // Persist failures to DLQ
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const reason = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);

        log.error('Event handler failed', {
          event: event.name,
          handlerIndex: i,
          error: reason,
        });

        await this.persistToDLQ(event, reason, i);
      }
    }
  }

  /**
   * Persist a failed event to the DLQJob table for later retry/inspection.
   */
  private async persistToDLQ<T>(
    event: DomainEvent<T>,
    failedReason: string,
    handlerIndex: number,
  ): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const idempotencyKey = event.idempotencyKey
        ? `${event.idempotencyKey}:handler:${handlerIndex}`
        : undefined;

      await (prisma as any).dLQJob.create({
        data: {
          queueName:      `event-bus:${event.name}`,
          jobId:          `${event.name}:${Date.now()}:${handlerIndex}`,
          payload:        event as any,
          failedReason,
          attemptsMade:   1,
          maxAttempts:    3,
          status:         'failed',
          idempotencyKey,
        },
      });
    } catch (dbError) {
      // DLQ persistence failure is logged but never crashes the process
      log.error('Failed to persist to DLQ', {
        event: event.name,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }
  }

  /**
   * Get count of registered handlers per event (for health checks).
   */
  getHandlerCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [event, handlers] of this.handlers) {
      counts[event] = handlers.length;
    }
    return counts;
  }
}

// Singleton instance
export const eventBus = new EventBus();

// ─── Convenience emitters (type-safe) ─────────────────────────────────────────

export function emitTransactionCreated(payload: {
  invoiceId?: string;
  paymentId?: string;
  userId:     string;
  amount:     number;
  type:       'invoice' | 'payment' | 'expense';
}): Promise<void> {
  return eventBus.emit({
    name:           'transaction.created',
    payload,
    timestamp:      new Date().toISOString(),
    idempotencyKey: `txn:${payload.type}:${payload.invoiceId ?? payload.paymentId}`,
  });
}

export function emitAnomalyDetected(payload: {
  userId:     string;
  expenseId:  string;
  severity:   'low' | 'medium' | 'high';
  signal:     string;
}): Promise<void> {
  return eventBus.emit({
    name:           'anomaly.detected',
    payload,
    timestamp:      new Date().toISOString(),
    idempotencyKey: `anomaly:${payload.expenseId}:${payload.signal}`,
  });
}

export function emitFilingSubmitted(payload: {
  userId:     string;
  invoiceId:  string;
  nrsReference?: string;
}): Promise<void> {
  return eventBus.emit({
    name:           'filing.submitted',
    payload,
    timestamp:      new Date().toISOString(),
    idempotencyKey: `filing:${payload.invoiceId}`,
  });
}

export function emitSessionInvalidated(payload: {
  actorId:       string;
  targetUserId:  string;
  reason:        string;
}): Promise<void> {
  return eventBus.emit({
    name:           'session.invalidated',
    payload,
    timestamp:      new Date().toISOString(),
  });
}
