import { prisma } from '../lib/prisma';

export const RECEIPT_VERIFICATION_LEASE_MS = 10 * 60_000;

interface ReceiptVerificationLeaseInput {
  id: string;
  userId: string;
  organizationId: string;
}

export async function claimReceiptVerificationLease(
  input: ReceiptVerificationLeaseInput,
  startedAt = new Date(),
): Promise<Date | null> {
  const staleBefore = new Date(startedAt.getTime() - RECEIPT_VERIFICATION_LEASE_MS);
  const result = await prisma.receiptEvidence.updateMany({
    where: {
      id: input.id,
      userId: input.userId,
      organizationId: input.organizationId,
      status: 'PENDING_UPLOAD',
      uploadExpiresAt: { gt: startedAt },
      OR: [
        { verificationStartedAt: null },
        { verificationStartedAt: { lte: staleBefore } },
      ],
    },
    data: { verificationStartedAt: startedAt },
  });
  return result.count === 1 ? startedAt : null;
}

export async function releaseReceiptVerificationLease(
  input: ReceiptVerificationLeaseInput & { leaseStartedAt: Date },
): Promise<boolean> {
  const result = await prisma.receiptEvidence.updateMany({
    where: {
      id: input.id,
      userId: input.userId,
      organizationId: input.organizationId,
      status: 'PENDING_UPLOAD',
      verificationStartedAt: input.leaseStartedAt,
    },
    data: { verificationStartedAt: null },
  });
  return result.count === 1;
}
