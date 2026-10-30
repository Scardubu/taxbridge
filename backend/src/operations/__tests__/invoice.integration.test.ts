import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { handleInvoiceCreateOperation } from '../handlers/invoice';
import { approveInvoice, getInvoiceLifecycle, rejectInvoice, submitInvoiceForApproval, updateInvoiceDraft } from '../../services/invoice-lifecycle';
import type { OperationContext } from '../registry';

const enabled = process.env.PHASE1C_DATABASE_TESTS === '1';
const describeDatabase = enabled ? describe : describe.skip;

describeDatabase('Phase 1C.2 and 1C.6 invoice lifecycle — PostgreSQL integration', () => {
  const suffix = randomUUID();
  let userId: string;
  let orgId: string;
  let businessId: string;
  let approverUserId: string;

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
    const approver = await prisma.user.create({
      data: { phone: `+phase1c2-approver-${suffix}`, name: 'Phase 1C.6 Approver' },
      select: { id: true },
    });
    approverUserId = approver.id;
    await prisma.orgMember.create({ data: { orgId, userId: approverUserId, role: 'owner', status: 'active' } });
    const business = await prisma.business.create({
      data: { ownerId: userId, organizationId: orgId, name: `Phase 1C.2 Business ${suffix}` },
      select: { id: true },
    });
    businessId = business.id;
  });

  afterAll(async () => {
    try {
      if (userId) {
        const invoiceRows = await prisma.invoice.findMany({ where: { userId }, select: { id: true } });
        const invoiceIds = invoiceRows.map((invoice) => invoice.id);
        if (invoiceIds.length) {
          // Keep trigger toggles and fixture cleanup in one transaction so other
          // integration suites never observe a globally disabled audit trigger.
          await prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe('ALTER TABLE "invoice_lifecycle_events" DISABLE TRIGGER "invoice_lifecycle_events_append_only"');
            await tx.$executeRawUnsafe('ALTER TABLE "invoice_versions" DISABLE TRIGGER "invoice_versions_append_only"');
            try {
              await tx.invoiceLifecycleEvent.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
              await tx.invoiceVersion.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
              await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
            } finally {
              await tx.$executeRawUnsafe('ALTER TABLE "invoice_versions" ENABLE TRIGGER "invoice_versions_append_only"');
              await tx.$executeRawUnsafe('ALTER TABLE "invoice_lifecycle_events" ENABLE TRIGGER "invoice_lifecycle_events_append_only"');
            }
          });
        }
        await prisma.operationEffect.deleteMany({ where: { userId } });
        await prisma.business.deleteMany({ where: { ownerId: userId } });
        await prisma.orgMember.deleteMany({ where: { orgId } });
        if (orgId) await prisma.org.deleteMany({ where: { id: orgId } });
        if (approverUserId) await prisma.user.deleteMany({ where: { id: approverUserId } });
        await prisma.user.deleteMany({ where: { id: userId } });
      }
    } finally {
      await prisma.$disconnect();
    }
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
    const revision = await prisma.invoiceVersion.findUnique({
      where: { invoiceId_version: { invoiceId: String(outcome.result.entityId), version: 1 } },
    });
    expect(revision?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    const canonicalHashRows = await prisma.$queryRaw<Array<{ contentHash: string }>>`
      SELECT encode(digest("data"::text, 'sha256'), 'hex') AS "contentHash"
      FROM "invoice_versions"
      WHERE "invoice_id" = ${String(outcome.result.entityId)}::uuid AND "version" = 1
    `;
    expect(revision?.contentHash).toBe(canonicalHashRows[0]?.contentHash);
    expect(await prisma.invoiceLifecycleEvent.count({
      where: { invoiceId: String(outcome.result.entityId), eventType: 'DRAFT_CREATED', toApprovalStatus: 'DRAFT' },
    })).toBe(1);
    const createdEvent = await prisma.invoiceLifecycleEvent.findFirstOrThrow({
      where: { invoiceId: String(outcome.result.entityId), eventType: 'DRAFT_CREATED' },
    });
    await expect(prisma.invoiceVersion.update({
      where: { invoiceId_version: { invoiceId: String(outcome.result.entityId), version: 1 } },
      data: { changedBy: 'tampered-actor' },
    })).rejects.toThrow(/append-only/i);
    await expect(prisma.invoiceLifecycleEvent.update({
      where: { id: createdEvent.id },
      data: { reason: 'tampered audit record' },
    })).rejects.toThrow(/append-only/i);
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

  const validDraft = (customerName = 'Integration Customer') => ({
    customerName,
    items: [{ description: 'Consulting', quantity: 2, unitPrice: 5000 }],
    subtotal: 10000,
    vat: 750,
    total: 10750,
    template: 'professional' as const,
  });

  const createDraft = async (): Promise<string> => {
    const outcome = await handleInvoiceCreateOperation(contextFor());
    return String(outcome.result.entityId);
  };

  it('enforces maker-checker, rejection/revision, optimistic locking and approval pinning', async () => {
    const invoiceId = await createDraft();
    await submitInvoiceForApproval({ invoiceId, organizationId: orgId, actorUserId: userId, expectedVersion: 1 });

    await expect(approveInvoice({
      invoiceId, organizationId: orgId, actorUserId: userId, expectedVersion: 1,
    })).rejects.toMatchObject({ code: 'INVOICE_SELF_APPROVAL_FORBIDDEN', statusCode: 403 });

    await rejectInvoice({
      invoiceId,
      organizationId: orgId,
      actorUserId: approverUserId,
      expectedVersion: 1,
      reason: 'Correct the customer details before approval.',
    });

    await expect(updateInvoiceDraft({
      invoiceId,
      organizationId: orgId,
      actorUserId: userId,
      expectedVersion: 1,
      draft: validDraft(),
    })).rejects.toMatchObject({ code: 'INVOICE_REVISION_REQUIRED', statusCode: 409 });

    await expect(updateInvoiceDraft({
      invoiceId,
      organizationId: orgId,
      actorUserId: userId,
      expectedVersion: 99,
      draft: validDraft('Corrected Customer'),
    })).rejects.toMatchObject({ code: 'INVOICE_VERSION_CONFLICT', statusCode: 409 });

    const revised = await updateInvoiceDraft({
      invoiceId,
      organizationId: orgId,
      actorUserId: userId,
      expectedVersion: 1,
      draft: validDraft('Corrected Customer'),
    });
    expect(revised).toMatchObject({ version: 2, approvalStatus: 'DRAFT', status: 'draft' });

    await submitInvoiceForApproval({
      invoiceId, organizationId: orgId, actorUserId: userId, expectedVersion: 2,
    });
    const approved = await approveInvoice({
      invoiceId, organizationId: orgId, actorUserId: approverUserId, expectedVersion: 2,
    });
    expect(approved).toMatchObject({
      version: 2, approvedVersion: 2, approvalStatus: 'APPROVED', nrsSubmission: 'not_submitted',
    });

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice).toMatchObject({
      status: 'draft',
      approvalStatus: 'APPROVED',
      approvedBy: approverUserId,
      approvedVersion: 2,
      nrsCompliant: false,
      nrsReference: null,
      nrsIRN: null,
    });
    const history = await getInvoiceLifecycle({
      invoiceId, organizationId: orgId, actorUserId: approverUserId,
    });
    expect(history.revisions).toHaveLength(2);
    expect(history.revisions.every((revision) => /^[a-f0-9]{64}$/.test(revision.contentHash ?? ''))).toBe(true);
    const hashMismatchRows = await prisma.$queryRaw<Array<{ mismatches: bigint }>>`
      SELECT COUNT(*)::bigint AS "mismatches"
      FROM "invoice_versions"
      WHERE "invoice_id" = ${invoiceId}::uuid
        AND "content_hash" IS DISTINCT FROM encode(digest("data"::text, 'sha256'), 'hex')
    `;
    expect(Number(hashMismatchRows[0]?.mismatches ?? -1n)).toBe(0);
    expect(history.events.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      'DRAFT_CREATED',
      'SUBMITTED_FOR_APPROVAL',
      'REJECTED',
      'DRAFT_REVISED_AFTER_REJECTION',
      'APPROVED',
    ]));
  });

  it('does not expose or mutate invoices across organization boundaries', async () => {
    const invoiceId = await createDraft();
    const outsider = await prisma.user.create({
      data: { phone: `+phase1c6-outsider-${suffix}`, name: 'Phase 1C.6 Outsider' },
      select: { id: true },
    });
    let outsiderOrgId: string | undefined;
    try {
      const outsiderOrg = await prisma.org.create({
        data: { name: `Phase 1C.6 Other Org ${suffix}` }, select: { id: true },
      });
      outsiderOrgId = outsiderOrg.id;
      await prisma.orgMember.create({
        data: { orgId: outsiderOrg.id, userId: outsider.id, role: 'owner', status: 'active' },
      });
      await expect(getInvoiceLifecycle({
        invoiceId, organizationId: outsiderOrg.id, actorUserId: outsider.id,
      })).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND', statusCode: 404 });
      await expect(approveInvoice({
        invoiceId, organizationId: outsiderOrg.id, actorUserId: outsider.id, expectedVersion: 1,
      })).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND', statusCode: 404 });
    } finally {
      if (outsiderOrgId) {
        await prisma.orgMember.deleteMany({ where: { orgId: outsiderOrgId } });
        await prisma.org.deleteMany({ where: { id: outsiderOrgId } });
      }
      await prisma.user.deleteMany({ where: { id: outsider.id } });
    }
  });

});
