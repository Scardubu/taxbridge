import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isSensitiveOperation, OperationFailure } from './registry';

const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 15 * 60_000;
const DEADLINE_MS = 24 * 60 * 60_000;

export function calculateRetryDelay(attempt: number): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1)));
  // Full jitter: uniform integer in [0, ceiling].
  return randomInt(0, Math.max(1, ceiling + 1));
}

export async function recordOperationFailure(
  operationId: string,
  error: unknown,
): Promise<'retry_scheduled' | 'dead_letter'> {
  const failure = error instanceof OperationFailure
    ? error
    : new OperationFailure('Unexpected operation failure', 'UNEXPECTED_FAILURE', false);

  return prisma.$transaction(async (tx) => {
    const operation = await tx.syncOperation.findUnique({ where: { operationId } });
    if (!operation) throw new Error(`Operation not found: ${operationId}`);

    if (operation.status === 'acknowledged' || operation.status === 'dead_letter') {
      return 'dead_letter';
    }

    const attemptCount = operation.attemptCount + 1;
    const expired = Date.now() >= operation.deadlineAt.getTime();
    const terminal = !failure.retryable || expired || attemptCount >= MAX_ATTEMPTS;

    if (!terminal) {
      const delay = calculateRetryDelay(attemptCount);
      const nextAttemptAt = new Date(Date.now() + delay);
      await tx.syncOperation.update({
        where: { operationId },
        data: {
          status: 'retry_scheduled',
          attemptCount,
          nextAttemptAt,
          lastErrorCode: failure.code,
          lastErrorMessage: failure.message,
          providerReference: failure.providerReference ?? operation.providerReference,
        },
      });
      await tx.operationOutbox.create({
        data: {
          operationId,
          topic: `taxbridge.operation.retry.${attemptCount}`,
          payload: { operationId } as Prisma.InputJsonValue,
        },
      });
      return 'retry_scheduled';
    }

    await tx.syncOperation.update({
      where: { operationId },
      data: {
        status: 'dead_letter',
        attemptCount,
        nextAttemptAt: null,
        lastErrorCode: failure.code,
        lastErrorMessage: failure.message,
        providerReference: failure.providerReference ?? operation.providerReference,
      },
    });

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

    // Sensitive operations are deliberately not emitted to any replay queue.
    // This explicit branch documents and protects the no-auto-replay invariant.
    if (isSensitiveOperation(operation.operationType)) {
      return 'dead_letter';
    }
    return 'dead_letter';
  });
}
