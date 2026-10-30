import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { handleCrudOperation } from '../handlers/crud';
import { OperationFailure } from '../registry';
import type { OperationContext } from '../registry';

const enabled = process.env.PHASE1C_DATABASE_TESTS === '1';
const describeDatabase = enabled ? describe : describe.skip;

describeDatabase('Phase 1C expense operation — PostgreSQL integration', () => {
  const suffix = randomUUID();
  let userA: string;
  let userB: string;
  let orgA: string;
  let orgB: string;
  let businessA: string;
  let businessB: string;

  const payloadFor = (businessId: string) => ({
    action: 'EXPENSE_CREATE',
    data: {
      businessId,
      amount: 1250.50,
      category: 'office-supplies',
      description: 'Phase 1C integration fixture',
      date: '2026-10-30T10:00:00.000Z',
      vatAmount: 0,
      vatEligible: false,
    },
  });

  const contextFor = (overrides: Partial<OperationContext> = {}): OperationContext => {
    const operationId = overrides.operationId ?? randomUUID();
    return {
      operationId,
      organizationId: orgA,
      userId: userA,
      operationType: 'crud',
      schemaVersion: 1,
      idempotencyKey: operationId,
      payloadFingerprint: 'phase1c-fingerprint-v1',
      payload: payloadFor(businessA),
      providerReference: null,
      ...overrides,
    };
  };

  beforeAll(async () => {
    await prisma.$connect();
    const [a, b] = await Promise.all([
      prisma.user.create({ data: { phone: `+phase1c-a-${suffix}`, name: 'Phase 1C User A' }, select: { id: true } }),
      prisma.user.create({ data: { phone: `+phase1c-b-${suffix}`, name: 'Phase 1C User B' }, select: { id: true } }),
    ]);
    userA = a.id;
    userB = b.id;
    const [oa, ob] = await Promise.all([
      prisma.org.create({ data: { name: `Phase 1C Org A ${suffix}` }, select: { id: true } }),
      prisma.org.create({ data: { name: `Phase 1C Org B ${suffix}` }, select: { id: true } }),
    ]);
    orgA = oa.id;
    orgB = ob.id;
    await prisma.orgMember.createMany({
      data: [
        { orgId: orgA, userId: userA, role: 'owner', status: 'active' },
        { orgId: orgB, userId: userB, role: 'owner', status: 'active' },
      ],
    });
    const [ba, bb] = await Promise.all([
      prisma.business.create({ data: { ownerId: userA, organizationId: orgA, name: `Business A ${suffix}` }, select: { id: true } }),
      prisma.business.create({ data: { ownerId: userB, organizationId: orgB, name: `Business B ${suffix}` }, select: { id: true } }),
    ]);
    businessA = ba.id;
    businessB = bb.id;
  });

  afterAll(async () => {
    if (userA && userB) {
      await prisma.operationEffect.deleteMany({ where: { userId: { in: [userA, userB] } } });
      await prisma.expense.deleteMany({ where: { businessId: { in: [businessA, businessB] } } });
      await prisma.business.deleteMany({ where: { id: { in: [businessA, businessB] } } });
      await prisma.orgMember.deleteMany({ where: { userId: { in: [userA, userB] } } });
      await prisma.org.deleteMany({ where: { id: { in: [orgA, orgB] } } });
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    }
    await prisma.$disconnect();
  });

  it('commits the expense and idempotency receipt atomically', async () => {
    const before = await prisma.expense.count({ where: { businessId: businessA } });
    const context = contextFor();
    const outcome = await handleCrudOperation(context);
    expect(outcome.result.entity).toBe('expense');
    expect(await prisma.expense.count({ where: { businessId: businessA } })).toBe(before + 1);
    const receipt = await prisma.operationEffect.findUnique({ where: { operationId: context.operationId } });
    expect(receipt?.payloadFingerprint).toBe(context.payloadFingerprint);
  });

  it('returns the committed result on exact redelivery without creating another expense', async () => {
    const before = await prisma.expense.count({ where: { businessId: businessA } });
    const context = contextFor();
    const first = await handleCrudOperation(context);
    const second = await handleCrudOperation(context);
    expect(second).toEqual(first);
    expect(await prisma.expense.count({ where: { businessId: businessA } })).toBe(before + 1);
    expect(await prisma.operationEffect.count({ where: { operationId: context.operationId } })).toBe(1);
  });

  it('rejects operation identity reuse with a different fingerprint', async () => {
    const context = contextFor();
    await handleCrudOperation(context);
    await expect(handleCrudOperation({
      ...context,
      payloadFingerprint: 'different-payload-fingerprint',
    })).rejects.toMatchObject({ code: 'OPERATION_EFFECT_CONFLICT', retryable: false });
  });

  it('does not allow a user to write to another organization business', async () => {
    const context = contextFor({ payload: payloadFor(businessB) });
    await expect(handleCrudOperation(context)).rejects.toMatchObject({
      code: 'BUSINESS_NOT_FOUND',
      retryable: false,
    });
    expect(await prisma.expense.count({ where: { businessId: businessB } })).toBe(0);
  });

  it('survives concurrent duplicate delivery with only one committed domain effect', async () => {
    const before = await prisma.expense.count({ where: { businessId: businessA } });
    const context = contextFor();
    const outcomes = await Promise.allSettled([
      handleCrudOperation(context),
      handleCrudOperation(context),
    ]);
    expect(outcomes.some((outcome) => outcome.status === 'fulfilled')).toBe(true);
    const rejected = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    for (const outcome of rejected) {
      expect(outcome.reason).toBeInstanceOf(OperationFailure);
      expect((outcome.reason as OperationFailure).retryable).toBe(true);
    }
    expect(await prisma.operationEffect.count({ where: { operationId: context.operationId } })).toBe(1);
    expect(await prisma.expense.count({ where: { businessId: businessA } })).toBe(before + 1);
  });

  it('rejects unsupported schema versions before any write', async () => {
    const context = contextFor({ schemaVersion: 2 });
    await expect(handleCrudOperation(context)).rejects.toMatchObject({
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      retryable: false,
    });
    expect(await prisma.operationEffect.count({ where: { operationId: context.operationId } })).toBe(0);
  });
});
