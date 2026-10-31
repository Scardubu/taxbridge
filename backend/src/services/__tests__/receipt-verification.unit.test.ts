const mockUpdateMany = jest.fn();
const mockPrisma = { receiptEvidence: { updateMany: mockUpdateMany } };

jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import {
  claimReceiptVerificationLease,
  releaseReceiptVerificationLease,
  RECEIPT_VERIFICATION_LEASE_MS,
} from '../receipt-verification';

describe('receipt verification lease', () => {
  beforeEach(() => jest.clearAllMocks());

  it('claims an unleased, unexpired upload atomically for its owner and organization', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    const now = new Date('2026-10-31T00:00:00.000Z');

    await expect(claimReceiptVerificationLease({
      id: 'receipt-id', userId: 'user-id', organizationId: 'org-id',
    }, now)).resolves.toBe(now);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'receipt-id', userId: 'user-id', organizationId: 'org-id',
        status: 'PENDING_UPLOAD', uploadExpiresAt: { gt: now },
        OR: [
          { verificationStartedAt: null },
          { verificationStartedAt: { lte: new Date(now.getTime() - RECEIPT_VERIFICATION_LEASE_MS) } },
        ],
      },
      data: { verificationStartedAt: now },
    });
  });

  it('does not take a live lease held by another completion request', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    await expect(claimReceiptVerificationLease({
      id: 'receipt-id', userId: 'user-id', organizationId: 'org-id',
    }, new Date())).resolves.toBeNull();
  });

  it('releases only the exact lease owned by the failing request', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    const leaseStartedAt = new Date('2026-10-31T00:00:00.000Z');
    await expect(releaseReceiptVerificationLease({
      id: 'receipt-id', userId: 'user-id', organizationId: 'org-id', leaseStartedAt,
    })).resolves.toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'receipt-id', userId: 'user-id', organizationId: 'org-id',
        status: 'PENDING_UPLOAD', verificationStartedAt: leaseStartedAt,
      },
      data: { verificationStartedAt: null },
    });
  });
});
