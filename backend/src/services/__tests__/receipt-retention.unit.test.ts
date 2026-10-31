const mockS3Send = jest.fn();
const mockPrisma = {
  receiptEvidence: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  receiptOcrExtraction: {
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  GetObjectCommand: jest.fn(),
  CopyObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));
jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { purgeExpiredReceiptEvidence } from '../receipt-processing';

describe('receipt evidence retention purge', () => {
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.R2_ENDPOINT = 'https://r2.example.test';
    process.env.R2_ACCESS_KEY_ID = 'test-access';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    mockPrisma.receiptEvidence.findMany.mockResolvedValue([]);
    mockPrisma.receiptEvidence.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.receiptOcrExtraction.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.$transaction.mockImplementation(async (callback) => callback({
      receiptEvidence: mockPrisma.receiptEvidence,
      receiptOcrExtraction: mockPrisma.receiptOcrExtraction,
    }));
    mockS3Send.mockResolvedValue({});
  });

  afterAll(() => {
    process.env = env;
  });

  it('does no storage work when no evidence is eligible for expiry', async () => {
    await expect(purgeExpiredReceiptEvidence()).resolves.toBe(0);
    expect(mockPrisma.receiptEvidence.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        objectsPurgedAt: null,
        OR: expect.arrayContaining([
          expect.objectContaining({ status: 'PENDING_UPLOAD' }),
          expect.objectContaining({ retentionUntil: expect.any(Object) }),
        ]),
      }),
    }));
    const pendingUpload = (mockPrisma.receiptEvidence.findMany.mock.calls[0][0].where.OR as Array<Record<string, unknown>>)
      .find((condition) => (condition as { status?: string }).status === 'PENDING_UPLOAD');
    expect(pendingUpload).toEqual(expect.objectContaining({
      OR: [{ verificationStartedAt: null }, { verificationStartedAt: { lte: expect.any(Date) } }],
    }));
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  it('conditionally expires a pending upload after the signed-URL grace period and deletes all object variants', async () => {
    mockPrisma.receiptEvidence.findMany.mockResolvedValue([{
      id: 'receipt-1',
      status: 'PENDING_UPLOAD',
      uploadExpiresAt: new Date(Date.now() - 16 * 60_000),
      retentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60_000),
      storageKey: 'receipts/evidence/org-1/receipt-1',
      uploadKey: 'receipts/staging/org-1/receipt-1',
      cleanStorageKey: null,
    }]);

    await expect(purgeExpiredReceiptEvidence()).resolves.toBe(1);

    expect(mockPrisma.receiptEvidence.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'receipt-1',
        objectsPurgedAt: null,
        status: 'PENDING_UPLOAD',
        uploadExpiresAt: { lte: expect.any(Date) },
        OR: [{ verificationStartedAt: null }, { verificationStartedAt: { lte: expect.any(Date) } }],
      },
      data: { status: 'EXPIRED', verificationStartedAt: null },
    });
    expect(DeleteObjectCommand).toHaveBeenCalledTimes(2);
    expect(mockS3Send).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.receiptOcrExtraction.updateMany).toHaveBeenCalledWith({
      where: { receiptEvidenceId: 'receipt-1' },
      data: {
        status: 'FAILED',
        extractedText: null,
        meanConfidence: null,
        fieldCandidates: { retentionExpired: true },
      },
    });
    expect(mockPrisma.receiptEvidence.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'receipt-1', status: 'EXPIRED', objectsPurgedAt: null },
      data: {
        objectsPurgedAt: expect.any(Date),
        cleanStorageKey: null,
        originalFilename: '[retention-expired]',
      },
    });
  });

  it('purges clean evidence once the configured seven-year retention deadline has passed', async () => {
    mockPrisma.receiptEvidence.findMany.mockResolvedValue([{
      id: 'receipt-2',
      status: 'ATTACHED',
      uploadExpiresAt: new Date(Date.now() - 10 * 365 * 24 * 60 * 60_000),
      retentionUntil: new Date(Date.now() - 1),
      storageKey: 'receipts/evidence/org-1/receipt-2',
      uploadKey: 'receipts/staging/org-1/receipt-2',
      cleanStorageKey: 'receipts/clean/org-1/receipt-2',
    }]);

    await expect(purgeExpiredReceiptEvidence()).resolves.toBe(1);
    expect(mockPrisma.receiptEvidence.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'receipt-2',
        objectsPurgedAt: null,
        status: 'ATTACHED',
        retentionUntil: { lte: expect.any(Date) },
      },
      data: { status: 'EXPIRED', verificationStartedAt: null },
    });
    expect(mockS3Send).toHaveBeenCalledTimes(3);
    expect(mockPrisma.receiptEvidence.updateMany).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        where: { id: 'receipt-2', status: 'EXPIRED', objectsPurgedAt: null },
      }),
    );
  });

  it('does not delete objects if the conditional expiry claim loses a race', async () => {
    mockPrisma.receiptEvidence.findMany.mockResolvedValue([{
      id: 'receipt-3',
      status: 'PENDING_UPLOAD',
      uploadExpiresAt: new Date(Date.now() - 60 * 60_000),
      retentionUntil: new Date(Date.now() + 365 * 24 * 60 * 60_000),
      storageKey: 'evidence-key',
      uploadKey: 'staging-key',
      cleanStorageKey: null,
    }]);
    mockPrisma.receiptEvidence.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(purgeExpiredReceiptEvidence()).resolves.toBe(0);
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('leaves purge completion unset when any object delete fails so the next batch retries', async () => {
    mockPrisma.receiptEvidence.findMany.mockResolvedValue([{
      id: 'receipt-4',
      status: 'EXPIRED',
      uploadExpiresAt: new Date(Date.now() - 60 * 60_000),
      retentionUntil: new Date(Date.now() - 1),
      storageKey: 'evidence-key',
      uploadKey: 'staging-key',
      cleanStorageKey: 'clean-key',
    }]);
    mockS3Send.mockRejectedValueOnce(new Error('R2 unavailable'));

    await expect(purgeExpiredReceiptEvidence()).resolves.toBe(0);
    expect(mockPrisma.receiptEvidence.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('validates the batch size', async () => {
    await expect(purgeExpiredReceiptEvidence(0)).rejects.toThrow('Invalid receipt retention batch size');
    expect(mockPrisma.receiptEvidence.findMany).not.toHaveBeenCalled();
  });
});
