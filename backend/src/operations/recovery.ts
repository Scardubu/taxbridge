import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { OperationFailure } from './registry';

const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 15 * 60_000;

export function calculateRetryDelay(attempt: number): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1)));
  // Full jitter: uniform integer in [0, ceiling].
  return randomInt(0, Math.max(1, ceiling + 1));
}

export interface OperationFailureOptions {
  /** The worker lease that authorizes this failure transition, when applicable. */
  leaseToken?: string;
}

export type OperationFailureResult = 'retry_scheduled' | 'dead_letter' | 'lease_lost';

/**
 * Persist failure state and its retry outbox row in one PostgreSQL transaction.
 * This function never enqueues directly into BullMQ. The outbox dispatcher is
 * the only scheduler and derives its delay from SyncOperation.nextAttemptAt.
 */
export async function recordOperationFailure(
  operationId: string,
  error: unknown,
  options: OperationFailureOptions = {},
): Promise<OperationFailureResult> {
  const failure = error instanceof OperationFailure
    ? error
    : new OperationFailure('Unexpected operation failure', 'UNEXPECTED_FAILURE', false);

  return prisma.$transaction(async (tx) => {
    const operation = await tx.syncOperation.findUnique({ where: { operationId } });
    if (!operation) throw new Error('Operation not found: ' + operationId);

    if (operation.status === 'acknowledged' || operation.status === 'dead_letter') {
      return 'dead_letter';
    }

    const now = new Date();
    const ownsTransition: Prisma.SyncOperationWhereInput = options.leaseToken
      ? {
          operationId,
          status: 'processing',
          processingLeaseToken: options.leaseToken,
        }
      : {
          operationId,
          OR: [
            { status: { in: ['pending', 'retry_scheduled'] } },
            {
              status: 'processing',
              OR: [
                { processingLeaseUntil: null },
                { processingLeaseUntil: { lte: now } },
              ],
            },
          ],
        };

    const attemptCount = operation.attemptCount + 1;
    const expired = now.getTime() >= operation.deadlineAt.getTime();
    const terminal = !failure.retryable || expired || attemptCount >= MAX_ATTEMPTS;

    const transition = await tx.syncOperation.updateMany({
      where: ownsTransition,
      data: {
        status: terminal ? 'dead_letter' : 'retry_scheduled',
        attemptCount,
        nextAttemptAt: terminal
          ? null
          : new Date(now.getTime() + calculateRetryDelay(attemptCount)),
        lastErrorCode: failure.code,
        lastErrorMessage: failure.message,
        providerReference: failure.providerReference ?? operation.providerReference,
        processingLeaseToken: null,
        processingLeaseUntil: null,
      },
    });

    // A duplicate/stale worker must not overwrite the operation after another
    // worker has acquired a newer lease or already completed it.
    if (transition.count !== 1) return 'lease_lost';

    if (!terminal) {
      await tx.operationOutbox.create({
        data: {
          operationId,
          topic: 'taxbridge.operation.retry.' + attemptCount,
          payload: { operationId } as Prisma.InputJsonValue,
        },
      });
      return 'retry_scheduled';
    }

    await tx.operationDeadLetter.upsert({
      where: { operationId },
      create: {
        operationId,
        organizationId: operation.organizationId,
        userId: operation.userId,
        deviceId: operation.deviceId,
        operationType: operation.operationType,
        idempotencyKey: operation.idempotencyKey,
        payloadFingerprint: operation.payloadFingerprint,
        payload: operation.payload,
        attemptCount,
        failureCode: failure.code,
        failureReason: failure.message,
        providerReference: failure.providerReference ?? operation.providerReference,
        resolutionStatus: 'unresolved',
      },
      update: {
        attemptCount,
        failureCode: failure.code,
        failureReason: failure.message,
        providerReference: failure.providerReference ?? operation.providerReference,
      },
    });

    return 'dead_letter';
  });
}
