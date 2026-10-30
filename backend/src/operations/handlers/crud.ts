import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { OperationContext, OperationFailure, OperationResult } from '../registry';

const ExpenseCreatePayloadSchema = z.object({
  action: z.literal('EXPENSE_CREATE'),
  data: z.object({
    businessId: z.string().uuid(),
    amount: z.number().finite().positive(),
    category: z.enum([
      'office-supplies', 'travel', 'meals', 'utilities', 'rent', 'fuel',
      'maintenance', 'professional-services', 'telecommunications',
      'insurance', 'marketing', 'equipment', 'other',
    ]),
    description: z.string().trim().min(1).max(500),
    date: z.string().datetime({ offset: true }),
    vatAmount: z.number().finite().min(0),
    vatEligible: z.boolean(),
  }).strict(),
}).strict();

/** First approved offline CRUD operation with tenant-bound, transactional idempotency. */
export async function handleCrudOperation(context: OperationContext): Promise<OperationResult> {
  if (context.schemaVersion !== 1) {
    throw new OperationFailure('Unsupported CRUD operation schema version', 'UNSUPPORTED_SCHEMA_VERSION', false);
  }
  const parsed = ExpenseCreatePayloadSchema.safeParse(context.payload);
  if (!parsed.success) {
    throw new OperationFailure('Unsupported or invalid CRUD operation payload', 'INVALID_CRUD_OPERATION', false);
  }
  const { data } = parsed.data;

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

      const business = await tx.business.findFirst({
        where: {
          id: data.businessId,
          ownerId: context.userId,
          organizationId: context.organizationId,
        },
        select: { id: true },
      });
      if (!business) {
        throw new OperationFailure('Business not found in this organization or access denied', 'BUSINESS_NOT_FOUND', false);
      }

      const expense = await tx.expense.create({
        data: {
          businessId: business.id,
          amount: new Prisma.Decimal(data.amount),
          category: data.category,
          description: data.description,
          date: new Date(data.date),
          vatAmount: new Prisma.Decimal(data.vatAmount),
          vatEligible: data.vatEligible,
          status: 'pending',
        },
        select: { id: true, businessId: true, amount: true, category: true, status: true, createdAt: true },
      });
      const result = {
        entity: 'expense',
        entityId: expense.id,
        businessId: expense.businessId,
        amount: expense.amount.toString(),
        category: expense.category,
        status: expense.status,
        createdAt: expense.createdAt.toISOString(),
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
      throw new OperationFailure('Concurrent operation execution; safe to retry', 'OPERATION_EXECUTION_RACE', true);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2028')) {
      throw new OperationFailure('Transient database transaction conflict', 'DATABASE_TRANSACTION_RETRY', true);
    }
    throw error;
  }
}
