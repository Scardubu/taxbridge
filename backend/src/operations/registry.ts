/**
 * Explicit allow-list of operation handlers.
 *
 * Do not register a handler until its domain service has been reviewed for
 * tenant scoping, transactional idempotency and provider reconciliation.
 */
export interface OperationContext {
  operationId: string;
  organizationId: string;
  userId: string;
  operationType: string;
  schemaVersion: number;
  idempotencyKey: string;
  payloadFingerprint: string;
  payload: unknown;
  providerReference: string | null;
}

export interface OperationResult {
  result: Record<string, unknown>;
  providerReference?: string;
}

export class OperationFailure extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly providerReference?: string,
  ) {
    super(message);
    this.name = 'OperationFailure';
  }
}

export type OperationHandler = (context: OperationContext) => Promise<OperationResult>;

const handlers = new Map<string, OperationHandler>();

export function registerOperationHandler(type: string, handler: OperationHandler): void {
  if (!/^[a-z][a-z0-9_.-]{1,99}$/.test(type)) {
    throw new Error(`Invalid operation type: ${type}`);
  }
  if (handlers.has(type)) throw new Error(`Duplicate operation handler: ${type}`);
  handlers.set(type, handler);
}

export function getOperationHandler(type: string): OperationHandler | undefined {
  return handlers.get(type);
}

/**
 * Payment and filing operations are sensitive. Their terminal failure must
 * never be automatically replayed. Automatic transient retries may occur
 * only while the operation remains non-terminal and within the global budget.
 */
export function isSensitiveOperation(type: string): boolean {
  return /(^|[._-])(payment|filing|tax_submission|tax_filing)([._-]|$)/i.test(type);
}
