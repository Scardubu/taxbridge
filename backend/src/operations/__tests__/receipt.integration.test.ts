import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { handleReceiptAttachOperation } from '../handlers/receipt';
import type { OperationContext } from '../registry';

const enabled = process.env.PHASE1C_DATABASE_TESTS === '1';
const describeDatabase = enabled ? describe : describe.skip;

describeDatabase('Phase 1C.4 clean receipt evidence attachment — PostgreSQL integration', () => {
  const suffix = randomUUID();
  let userId: string;
  let orgId: string;
  let businessId: string;
  let expenseId: string;
  let receiptId: string;

  const contextFor = (operationId = randomUUID(), receiptEvidenceId = receiptId): OperationContext => ({
    operationId,
    organizationId: orgId,
    userId,
    operationType: 'crud',
    schemaVersion: 1,
    idempotencyKey: operationId,
    payloadFingerprint: 'phase1c3-receipt-fingerprint',
    payload: { action: 'RECEIPT_ATTACH', data: { receiptEvidenceId, expenseId } },
    providerReference: null,
  });

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: { phone: `+phase1c3-${suffix}`, name: 'Phase 1C.3 User' },
      select: { id: true },
    });
    userId = user.id;
    const org = await prisma.org.create({ data: { name: `Phase 1C.3 Org ${suffix}` }, select: { id: true } });
    orgId = org.id;
    await prisma.orgMember.create({ data: { orgId, userId, role: 'owner', status: 'active' } });
    const business = await prisma.business.create({
      data: { ownerId: userId, organizationId: orgId, name: `Phase 1C.3 Business ${suffix}` },
      select: { id: true },
    });
    businessId = business.id;
    const expense = await prisma.expense.create({
      data: { businessId, amount: '100.00', category: 'other', description: 'Receipt test expense', date: new Date() },
      select: { id: true },
    });
    expenseId = expense.id;
    const receipt = await prisma.receiptEvidence.create({
      data: {
        organizationId: orgId,
        userId,
        businessId,
        storageKey: `receipts/${orgId}/${randomUUID()}`,
        uploadKey: `receipts/staging/${orgId}/${randomUUID()}`,
        originalFilename: 'receipt.pdf',
        contentType: 'application/pdf',
        byteSize: 1024,
        sha256: 'a'.repeat(64),
        status: 'CLEAN', reviewStatus: 'ACCEPTED',
        uploadExpiresAt: new Date(Date.now() + 300_000),
        verifiedAt: new Date(),
        retentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    receiptId = receipt.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.operationEffect.deleteMany({ where: { userId } });
      await prisma.receiptEvidence.deleteMany({ where: { userId } });
      await prisma.expense.deleteMany({ where: { businessId } });
      await prisma.business.deleteMany({ where: { ownerId: userId } });
      await prisma.orgMember.deleteMany({ where: { userId } });
      if (orgId) await prisma.org.deleteMany({ where: { id: orgId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it('attaches only verified evidence to its matching tenant expense', async () => {
    const context = contextFor();
    const outcome = await handleReceiptAttachOperation(context);
    expect(outcome.result).toMatchObject({
      entity: 'receipt_evidence',
      entityId: receiptId,
      expenseId,
      businessId,
      status: 'ATTACHED',
    });
    expect(await prisma.receiptEvidence.findUnique({ where: { id: receiptId } })).toMatchObject({
      status: 'ATTACHED',
      expenseId,
    });
    expect(await prisma.operationEffect.count({ where: { operationId: context.operationId } })).toBe(1);
  });

  it('returns the durable result on duplicate delivery', async () => {
    const secondReceipt = await prisma.receiptEvidence.create({
      data: {
        organizationId: orgId, userId, businessId,
        storageKey: `receipts/${orgId}/${randomUUID()}`,
        uploadKey: `receipts/staging/${orgId}/${randomUUID()}`,
        originalFilename: 'second.pdf', contentType: 'application/pdf', byteSize: 2048,
        sha256: 'b'.repeat(64), status: 'CLEAN', reviewStatus: 'ACCEPTED',
        uploadExpiresAt: new Date(Date.now() + 300_000), verifiedAt: new Date(),
        retentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
      }, select: { id: true },
    });
    const context = contextFor(randomUUID(), secondReceipt.id);
    const first = await handleReceiptAttachOperation(context);
    const second = await handleReceiptAttachOperation(context);
    expect(second).toEqual(first);
    expect(await prisma.operationEffect.count({ where: { operationId: context.operationId } })).toBe(1);
  });

  it('rejects quarantined evidence until malware scanning is clean', async () => {
    const quarantined = await prisma.receiptEvidence.create({
      data: { organizationId: orgId, userId, businessId, storageKey: `receipts/${orgId}/${randomUUID()}`, uploadKey: `receipts/staging/${orgId}/${randomUUID()}`, originalFilename: 'quarantined.pdf', contentType: 'application/pdf', byteSize: 512, sha256: 'd'.repeat(64), status: 'QUARANTINED', uploadExpiresAt: new Date(Date.now() + 300_000), verifiedAt: new Date(), retentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000) }, select: { id: true },
    });
    await expect(handleReceiptAttachOperation(contextFor(randomUUID(), quarantined.id))).rejects.toMatchObject({ code: 'RECEIPT_NOT_CLEAN', retryable: false });
  });

  it('rejects unverified upload intents', async () => {
    const pending = await prisma.receiptEvidence.create({
      data: {
        organizationId: orgId, userId, businessId,
        storageKey: `receipts/${orgId}/${randomUUID()}`,
        uploadKey: `receipts/staging/${orgId}/${randomUUID()}`,
        originalFilename: 'pending.pdf', contentType: 'application/pdf', byteSize: 512,
        sha256: 'c'.repeat(64), status: 'PENDING_UPLOAD',
        uploadExpiresAt: new Date(Date.now() + 300_000),
        retentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
      }, select: { id: true },
    });
    await expect(handleReceiptAttachOperation(contextFor(randomUUID(), pending.id))).rejects.toMatchObject({
      code: 'RECEIPT_NOT_VERIFIED',
      retryable: false,
    });
  });
});
