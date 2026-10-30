import { InvoiceCreateOperationPayloadSchema } from '@taxbridge/contracts';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { OperationContext, OperationFailure, OperationResult } from '../registry';

/** Persist an invoice draft only. This handler never queues NRS submission or payment. */
export async function handleInvoiceCreateOperation(context: OperationContext): Promise<OperationResult> {
  if (context.schemaVersion !== 1) {
    throw new OperationFailure('Unsupported invoice operation schema version', 'UNSUPPORTED_SCHEMA_VERSION', false);
  }
  const parsed = InvoiceCreateOperationPayloadSchema.safeParse(context.payload);
  if (!parsed.success) {
    throw new OperationFailure('Unsupported or invalid invoice creation payload', 'INVALID_INVOICE_CREATE', false);
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

      const membership = await tx.orgMember.findFirst({
        where: { orgId: context.organizationId, userId: context.userId, status: 'active' },
        select: { id: true },
      });
      if (!membership) {
        throw new OperationFailure('Active organization membership is required', 'ORG_MEMBERSHIP_REVOKED', false);
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

      const invoice = await tx.invoice.create({
        data: {
          userId: context.userId,
          businessId: business.id,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerTIN: data.customerTIN,
          customerPhone: data.customerPhone,
          customerAddress: data.customerAddress,
          subtotal: new Prisma.Decimal(data.subtotal.toFixed(2)),
          vat: new Prisma.Decimal(data.vat.toFixed(2)),
          total: new Prisma.Decimal(data.total.toFixed(2)),
          items: data.items as unknown as Prisma.InputJsonValue,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          template: data.template,
          notes: data.notes,
          status: 'draft',
          nrsCompliant: false,
        },
        select: { id: true, userId: true, businessId: true, subtotal: true, vat: true, total: true, status: true, createdAt: true },
      });

      const result = {
        entity: 'invoice',
        entityId: invoice.id,
        businessId: invoice.businessId,
        subtotal: invoice.subtotal.toString(),
        vat: invoice.vat.toString(),
        total: invoice.total.toString(),
        status: invoice.status,
        nrsSubmission: 'not_submitted',
        createdAt: invoice.createdAt.toISOString(),
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
