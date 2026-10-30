import { ReceiptAttachOperationPayloadSchema } from '@taxbridge/contracts';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { OperationContext, OperationFailure, OperationResult } from '../registry';

/** Attach already-verified, tenant-owned object evidence to an existing expense. */
export async function handleReceiptAttachOperation(context: OperationContext): Promise<OperationResult> {
  if (context.schemaVersion !== 1) {
    throw new OperationFailure('Unsupported receipt operation schema version', 'UNSUPPORTED_SCHEMA_VERSION', false);
  }
  const parsed = ReceiptAttachOperationPayloadSchema.safeParse(context.payload);
  if (!parsed.success) {
    throw new OperationFailure('Invalid receipt attachment payload', 'INVALID_RECEIPT_ATTACH', false);
  }
  const { receiptEvidenceId, expenseId } = parsed.data.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const priorEffect = await tx.operationEffect.findUnique({ where: { operationId: context.operationId } });
      if (priorEffect) {
        if (priorEffect.organizationId !== context.organizationId ||
            priorEffect.userId !== context.userId ||
            priorEffect.payloadFingerprint !== context.payloadFingerprint) {
          throw new OperationFailure('Operation effect identity mismatch', 'OPERATION_EFFECT_CONFLICT', false);
        }
        return { result: priorEffect.result as Record<string, unknown> };
      }

      const membership = await tx.orgMember.findFirst({
        where: { orgId: context.organizationId, userId: context.userId, status: 'active', removedAt: null, org: { is: { status: 'active' } } },
        select: { id: true },
      });
      if (!membership) {
        throw new OperationFailure('Active organization membership is required', 'ORG_MEMBERSHIP_REVOKED', false);
      }

      const receipt = await tx.receiptEvidence.findFirst({
        where: {
          id: receiptEvidenceId,
          organizationId: context.organizationId,
          userId: context.userId,
          status: 'CLEAN',
          reviewStatus: 'ACCEPTED',
          verifiedAt: { not: null },
        },
        select: { id: true, businessId: true, expenseId: true, status: true },
      });
      if (!receipt) {
        throw new OperationFailure('Clean, malware-scanned receipt evidence not found', 'RECEIPT_NOT_CLEAN', false);
      }
      if (receipt.expenseId) {
        throw new OperationFailure('Receipt evidence is already attached', 'RECEIPT_ALREADY_ATTACHED', false);
      }

      const expense = await tx.expense.findFirst({
        where: {
          id: expenseId,
          businessId: receipt.businessId,
          business: { ownerId: context.userId, organizationId: context.organizationId },
        },
        select: { id: true, businessId: true },
      });
      if (!expense) {
        throw new OperationFailure('Expense not found for this receipt business', 'EXPENSE_NOT_FOUND', false);
      }

      const attached = await tx.receiptEvidence.updateMany({
        where: {
          id: receipt.id,
          organizationId: context.organizationId,
          userId: context.userId,
          status: 'CLEAN',
          reviewStatus: 'ACCEPTED',
          expenseId: null,
        },
        data: { status: 'ATTACHED', expenseId: expense.id },
      });
      if (attached.count !== 1) {
        throw new OperationFailure('Receipt attachment state changed concurrently', 'RECEIPT_STATE_CONFLICT', true);
      }

      await tx.auditEvent.create({
        data: {
          orgId: context.organizationId,
          userId: context.userId,
          action: 'RECEIPT_ATTACHED',
          resource: 'ReceiptEvidence',
          resourceId: receipt.id,
          metadata: { expenseId: expense.id, businessId: expense.businessId },
        },
      });

      const result = {
        entity: 'receipt_evidence',
        entityId: receipt.id,
        expenseId: expense.id,
        businessId: expense.businessId,
        status: 'ATTACHED',
      };
      await tx.operationEffect.create({
        data: {
          operationId: context.operationId,
          organizationId: context.organizationId,
          userId: context.userId,
          payloadFingerprint: context.payloadFingerprint,
          result: result as Prisma.InputJsonValue,
        },
      });
      return { result };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof OperationFailure) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new OperationFailure('Concurrent receipt attachment; safe to retry', 'OPERATION_EXECUTION_RACE', true);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2028')) {
      throw new OperationFailure('Transient receipt transaction conflict', 'DATABASE_TRANSACTION_RETRY', true);
    }
    throw error;
  }
}
