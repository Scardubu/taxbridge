import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { handleInvoiceCreateOperation } from '../handlers/invoice';
import type { OperationContext } from '../registry';

const enabled = process.env.PHASE1C_DATABASE_TESTS === '1';
const describeDatabase = enabled ? describe : describe.skip;

describeDatabase('Phase 1C.2 invoice draft — PostgreSQL integration', () => {
  const suffix = randomUUID();
  let userId: string;
  let orgId: string;
  let businessId: string;

  const payload = {
    action: 'INVOICE_CREATE',
    data: {
      businessId: '',
      customerName: 'Integration Customer',
      items: [{ description: 'Consulting', quantity: 2, unitPrice: 5000 }],
      subtotal: 10000,
      vat: 750,
      total: 10750,
      template: 'professional',
    },
  };

  const contextFor = (operationId = randomUUID()): OperationContext => ({
    operationId,
    organizationId: orgId,
    userId,
    operationType: 'crud',
    schemaVersion: 1,
    idempotencyKey: operationId,
    payloadFingerprint: 'phase1c2-invoice-fingerprint',
    payload: { ...payload, data: { ...payload.data, businessId } },
    providerReference: null,
  });

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: { phone: `+phase1c2-${suffix}`, name: 'Phase 1C.2 User' },
      select: { id: true },
    });
    userId = user.id;
    const org = await prisma.org.create({ data: { name: `Phase 1C.2 Org ${suffix}` }, select: { id: true } });
    orgId = org.id;
    await prisma.orgMember.create({ data: { orgId, userId, role: 'owner', status: 'active' } });
    const business = await prisma.business.create({
      data: { ownerId: userId, organizationId: orgId, name: `Phase 1C.2 Business ${suffix}` },
      select: { id: true },
    });
    businessId = business.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.operationEffect.deleteMany({ where: { userId } });
      await prisma.invoice.deleteMany({ where: { userId } });
      await prisma.business.deleteMany({ where: { ownerId: userId } });
      await prisma.orgMember.deleteMany({ where: { userId } });
      if (orgId) await prisma.org.deleteMany({ where: { id: orgId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it('creates a tenant-owned draft with no NRS submission and a durable effect receipt', async () => {
    const context = contextFor();
    const outcome = await handleInvoiceCreateOperation(context);
    expect(outcome.result).toMatchObject({ entity: 'invoice', status: 'draft', nrsSubmission: 'not_submitted' });
    const invoice = await prisma.invoice.findUnique({ where: { id: String(outcome.result.entityId) } });
    expect(invoice?.userId).toBe(userId);
    expect(invoice?.businessId).toBe(businessId);
    expect(invoice?.nrsCompliant).toBe(false);
    expect(invoice?.nrsIRN).toBeNull();
    expect(await prisma.operationEffect.count({ where: { operationId: context.operationId } })).toBe(1);
  });

  it('returns the same result on duplicate delivery without creating a second invoice', async () => {
    const context = contextFor();
    const before = await prisma.invoice.count({ where: { userId } });
    const first = await handleInvoiceCreateOperation(context);
    const second = await handleInvoiceCreateOperation(context);
    expect(second).toEqual(first);
    expect(await prisma.invoice.count({ where: { userId } })).toBe(before + 1);
  });

  it('rejects a business from another tenant', async () => {
    const otherUser = await prisma.user.create({
      data: { phone: `+phase1c2-other-${suffix}`, name: 'Other Tenant' },
      select: { id: true },
    });
    try {
      const otherOrg = await prisma.org.create({ data: { name: `Other Org ${suffix}` }, select: { id: true } });
      await prisma.orgMember.create({ data: { orgId: otherOrg.id, userId: otherUser.id, role: 'owner', status: 'active' } });
      const otherBusiness = await prisma.business.create({
        data: { ownerId: otherUser.id, organizationId: otherOrg.id, name: `Other Business ${suffix}` },
        select: { id: true },
      });
      const context = contextFor();
      context.payload = { ...payload, data: { ...payload.data, businessId: otherBusiness.id } };
      await expect(handleInvoiceCreateOperation(context)).rejects.toMatchObject({
        code: 'BUSINESS_NOT_FOUND', retryable: false,
      });
      await prisma.business.delete({ where: { id: otherBusiness.id } });
      await prisma.orgMember.deleteMany({ where: { orgId: otherOrg.id } });
      await prisma.org.delete({ where: { id: otherOrg.id } });
    } finally {
      await prisma.user.delete({ where: { id: otherUser.id } });
    }
  });
});
