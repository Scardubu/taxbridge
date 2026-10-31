const mockPrisma = {
  $transaction: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import { OperationFailure } from '../registry';
import { recordOperationFailure, calculateRetryDelay } from '../recovery';

type MockOperation = {
  operationId: string;
  status: string;
  attemptCount: number;
  deadlineAt: Date;
  organizationId: string;
  userId: string;
  deviceId: string;
  operationType: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  payload: Record<string, unknown>;
  providerReference: string | null;
};

function makeOperation(overrides: Partial<MockOperation> = {}): MockOperation {
  return {
    operationId: 'operation-1',
    status: 'processing',
    attemptCount: 0,
    deadlineAt: new Date(Date.now() + 60 * 60_000),
    organizationId: 'org-1',
    userId: 'user-1',
    deviceId: 'device-1',
    operationType: 'expense.create',
    idempotencyKey: 'idempotency-1',
    payloadFingerprint: 'a'.repeat(64),
    payload: { amount: 1250 },
    providerReference: null,
    ...overrides,
  };
}

function makeTransaction(operation: MockOperation, transitionCount = 1) {
  return {
    syncOperation: {
      findUnique: jest.fn().mockResolvedValue(operation),
      updateMany: jest.fn().mockResolvedValue({ count: transitionCount }),
    },
    operationOutbox: {
      create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
    },
    operationDeadLetter: {
      upsert: jest.fn().mockResolvedValue({ id: 'dead-letter-1' }),
    },
  };
}

describe('operation retry recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function runWithTransaction(tx: ReturnType<typeof makeTransaction>) {
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));
  }

  it('persists retry state and its outbox row in the same PostgreSQL transaction', async () => {
    const operation = makeOperation({ attemptCount: 1 });
    const tx = makeTransaction(operation);
    runWithTransaction(tx);

    await expect(recordOperationFailure(
      operation.operationId,
      new OperationFailure('Temporary provider timeout', 'PROVIDER_TIMEOUT', true, 'provider-ref-1'),
      { leaseToken: 'lease-1' },
    )).resolves.toBe('retry_scheduled');

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.syncOperation.updateMany).toHaveBeenCalledWith({
      where: {
        operationId: operation.operationId,
        status: 'processing',
        processingLeaseToken: 'lease-1',
      },
      data: expect.objectContaining({
        status: 'retry_scheduled',
        attemptCount: 2,
        nextAttemptAt: expect.any(Date),
        lastErrorCode: 'PROVIDER_TIMEOUT',
        lastErrorMessage: 'Temporary provider timeout',
        providerReference: 'provider-ref-1',
        processingLeaseToken: null,
        processingLeaseUntil: null,
      }),
    });

    const persisted = tx.syncOperation.updateMany.mock.calls[0][0].data;
    expect(persisted.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() - 1_000);
    expect(persisted.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
    expect(tx.operationOutbox.create).toHaveBeenCalledWith({
      data: {
        operationId: operation.operationId,
        topic: 'taxbridge.operation.retry.2',
        payload: { operationId: operation.operationId },
      },
    });
    expect(tx.operationDeadLetter.upsert).not.toHaveBeenCalled();
  });

  it('dead-letters a non-retryable failure and preserves the operation evidence', async () => {
    const operation = makeOperation();
    const tx = makeTransaction(operation);
    runWithTransaction(tx);

    await expect(recordOperationFailure(
      operation.operationId,
      new OperationFailure('Invalid operation contract', 'INVALID_CONTRACT', false),
      { leaseToken: 'lease-1' },
    )).resolves.toBe('dead_letter');

    expect(tx.syncOperation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'dead_letter',
        attemptCount: 1,
        nextAttemptAt: null,
      }),
    }));
    expect(tx.operationOutbox.create).not.toHaveBeenCalled();
    expect(tx.operationDeadLetter.upsert).toHaveBeenCalledWith({
      where: { operationId: operation.operationId },
      create: expect.objectContaining({
        operationId: operation.operationId,
        organizationId: operation.organizationId,
        userId: operation.userId,
        operationType: operation.operationType,
        idempotencyKey: operation.idempotencyKey,
        payloadFingerprint: operation.payloadFingerprint,
        payload: operation.payload,
        attemptCount: 1,
        failureCode: 'INVALID_CONTRACT',
        resolutionStatus: 'unresolved',
      }),
      update: expect.objectContaining({
        attemptCount: 1,
        failureCode: 'INVALID_CONTRACT',
      }),
    });
  });

  it('dead-letters at the configured eighth attempt', async () => {
    const operation = makeOperation({ attemptCount: 7 });
    const tx = makeTransaction(operation);
    runWithTransaction(tx);

    await expect(recordOperationFailure(
      operation.operationId,
      new OperationFailure('Provider still unavailable', 'PROVIDER_UNAVAILABLE', true),
      { leaseToken: 'lease-1' },
    )).resolves.toBe('dead_letter');

    expect(tx.syncOperation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'dead_letter', attemptCount: 8, nextAttemptAt: null }),
    }));
    expect(tx.operationDeadLetter.upsert).toHaveBeenCalled();
    expect(tx.operationOutbox.create).not.toHaveBeenCalled();
  });

  it('dead-letters failures after the operation deadline', async () => {
    const operation = makeOperation({ deadlineAt: new Date(Date.now() - 1) });
    const tx = makeTransaction(operation);
    runWithTransaction(tx);

    await expect(recordOperationFailure(
      operation.operationId,
      new OperationFailure('Deadline exceeded', 'OPERATION_DEADLINE_EXPIRED', true),
      { leaseToken: 'lease-1' },
    )).resolves.toBe('dead_letter');

    expect(tx.operationOutbox.create).not.toHaveBeenCalled();
    expect(tx.operationDeadLetter.upsert).toHaveBeenCalled();
  });

  it('does not let a stale worker overwrite a newer lease or create another retry', async () => {
    const operation = makeOperation();
    const tx = makeTransaction(operation, 0);
    runWithTransaction(tx);

    await expect(recordOperationFailure(
      operation.operationId,
      new OperationFailure('Stale worker failure', 'PROVIDER_TIMEOUT', true),
      { leaseToken: 'stale-lease' },
    )).resolves.toBe('lease_lost');

    expect(tx.operationOutbox.create).not.toHaveBeenCalled();
    expect(tx.operationDeadLetter.upsert).not.toHaveBeenCalled();
  });

  it('does not mutate already acknowledged or dead-lettered operations', async () => {
    for (const status of ['acknowledged', 'dead_letter']) {
      const tx = makeTransaction(makeOperation({ status }));
      runWithTransaction(tx);

      await expect(recordOperationFailure(
        'operation-1',
        new OperationFailure('Late duplicate failure', 'LATE_FAILURE', false),
      )).resolves.toBe('dead_letter');

      expect(tx.syncOperation.updateMany).not.toHaveBeenCalled();
      expect(tx.operationOutbox.create).not.toHaveBeenCalled();
      expect(tx.operationDeadLetter.upsert).not.toHaveBeenCalled();
    }
  });

  it('rejects unknown operations without writing recovery state', async () => {
    const tx = makeTransaction(makeOperation());
    tx.syncOperation.findUnique.mockResolvedValue(null);
    runWithTransaction(tx);

    await expect(recordOperationFailure(
      'missing-operation',
      new OperationFailure('Failure', 'FAILURE', true),
    )).rejects.toThrow('Operation not found: missing-operation');

    expect(tx.syncOperation.updateMany).not.toHaveBeenCalled();
    expect(tx.operationOutbox.create).not.toHaveBeenCalled();
  });

  it('bounds exponential retry jitter', () => {
    for (const attempt of [1, 2, 3, 8, 30]) {
      const delay = calculateRetryDelay(attempt);
      const ceiling = Math.min(15 * 60_000, 2_000 * (2 ** Math.max(0, attempt - 1)));
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(ceiling);
    }
  });
});
