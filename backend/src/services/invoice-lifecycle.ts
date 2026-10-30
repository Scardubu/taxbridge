import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { InvoiceDraftContentSchema } from '@taxbridge/contracts';
import type { z } from 'zod';

type Tx = Prisma.TransactionClient;
type Db = Prisma.TransactionClient | PrismaClient;
type DraftContent = z.infer<typeof InvoiceDraftContentSchema>;

export class InvoiceLifecycleError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'InvoiceLifecycleError';
  }
}

type RevisionSource = {
  id: string;
  version: number;
  approvalStatus: string;
  businessId: string | null;
  invoiceNumber: string | null;
  customerName: string | null;
  customerTIN: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  items: Prisma.JsonValue;
  subtotal: Prisma.Decimal;
  vat: Prisma.Decimal;
  total: Prisma.Decimal;
  dueDate: Date | null;
  template: string;
  notes: string | null;
  status: string;
};

type LifecycleEventInput = {
  invoiceId: string;
  organizationId: string;
  actorUserId: string;
  eventType: string;
  fromApprovalStatus: string | null;
  toApprovalStatus: string;
  revision: number;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
};

const EDITOR_ROLES = new Set(['owner', 'admin', 'accountant']);
const APPROVER_ROLES = new Set(['owner', 'admin']);

export async function appendInvoiceRevision(
  tx: Tx,
  invoice: RevisionSource,
  actorUserId: string,
): Promise<void> {
  const snapshot: Prisma.InputJsonObject = {
    invoiceId: invoice.id,
    version: invoice.version,
    approvalStatus: invoice.approvalStatus,
    businessId: invoice.businessId,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    customerTIN: invoice.customerTIN,
    customerEmail: invoice.customerEmail,
    customerPhone: invoice.customerPhone,
    customerAddress: invoice.customerAddress,
    items: invoice.items as Prisma.InputJsonValue,
    subtotal: invoice.subtotal.toFixed(2),
    vat: invoice.vat.toFixed(2),
    total: invoice.total.toFixed(2),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    template: invoice.template,
    notes: invoice.notes,
    invoiceStatus: invoice.status,
  };
  const contentHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  await tx.invoiceVersion.create({
    data: {
      invoiceId: invoice.id,
      version: invoice.version,
      data: snapshot,
      changedBy: actorUserId,
      contentHash,
    },
  });
}

export async function appendInvoiceLifecycleEvent(
  tx: Tx,
  event: LifecycleEventInput,
): Promise<void> {
  await tx.invoiceLifecycleEvent.create({
    data: {
      invoiceId: event.invoiceId,
      organizationId: event.organizationId,
      actorUserId: event.actorUserId,
      eventType: event.eventType,
      fromApprovalStatus: event.fromApprovalStatus,
      toApprovalStatus: event.toApprovalStatus,
      revision: event.revision,
      reason: event.reason ?? null,
      metadata: event.metadata ?? {},
    },
  });
}

async function requireMembership(tx: Db, organizationId: string, userId: string): Promise<string> {
  const member = await tx.orgMember.findFirst({
    where: {
      orgId: organizationId,
      userId,
      status: 'active',
      removedAt: null,
      org: { is: { status: 'active' } },
    },
    select: { role: true },
  });
  if (!member) {
    throw new InvoiceLifecycleError('Active organization membership is required', 'ORG_MEMBERSHIP_REVOKED', 403);
  }
  return member.role.trim().toLowerCase();
}

async function requireGovernedInvoice(
  tx: Db,
  invoiceId: string,
  organizationId: string,
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { business: { select: { organizationId: true } } },
  });
  if (!invoice || !invoice.businessId || invoice.business?.organizationId !== organizationId) {
    throw new InvoiceLifecycleError('Invoice not found in this organization', 'INVOICE_NOT_FOUND', 404);
  }
  return invoice;
}

function assertInternalDraft(invoice: Awaited<ReturnType<typeof requireGovernedInvoice>>): void {
  if (
    invoice.status !== 'draft' ||
    invoice.nrsCompliant ||
    invoice.nrsReference ||
    invoice.nrsCSID ||
    invoice.nrsIRN ||
    invoice.sentAt
  ) {
    throw new InvoiceLifecycleError(
      'Invoice is outside the internal draft lifecycle',
      'INVOICE_EXTERNAL_WORKFLOW_STARTED',
      409,
    );
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
  }
  return value;
}

function sameDraft(invoice: Awaited<ReturnType<typeof requireGovernedInvoice>>, draft: DraftContent): boolean {
  const canonical = {
    customerName: invoice.customerName ?? '',
    customerEmail: invoice.customerEmail,
    customerTIN: invoice.customerTIN,
    customerPhone: invoice.customerPhone,
    customerAddress: invoice.customerAddress,
    items: invoice.items,
    subtotal: Number(invoice.subtotal),
    vat: Number(invoice.vat),
    total: Number(invoice.total),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    template: invoice.template,
    notes: invoice.notes,
  };
  const candidate = {
    customerName: draft.customerName,
    customerEmail: draft.customerEmail ?? null,
    customerTIN: draft.customerTIN ?? null,
    customerPhone: draft.customerPhone ?? null,
    customerAddress: draft.customerAddress ?? null,
    items: draft.items,
    subtotal: draft.subtotal,
    vat: draft.vat,
    total: draft.total,
    dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : null,
    template: draft.template,
    notes: draft.notes ?? null,
  };
  return JSON.stringify(canonicalize(canonical)) === JSON.stringify(canonicalize(candidate));
}

export async function updateInvoiceDraft(input: {
  invoiceId: string;
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  draft: DraftContent;
}) {
  return prisma.$transaction(async (tx) => {
    const role = await requireMembership(tx, input.organizationId, input.actorUserId);
    if (!EDITOR_ROLES.has(role)) {
      throw new InvoiceLifecycleError('Invoice draft editing is not permitted for this organization role', 'INVOICE_EDIT_FORBIDDEN', 403);
    }
    const invoice = await requireGovernedInvoice(tx, input.invoiceId, input.organizationId);
    assertInternalDraft(invoice);
    if (invoice.userId !== input.actorUserId && !['owner', 'admin'].includes(role)) {
      throw new InvoiceLifecycleError('Only the draft creator or an organization owner/admin may edit this invoice', 'INVOICE_EDIT_FORBIDDEN', 403);
    }
    if (invoice.version !== input.expectedVersion) {
      throw new InvoiceLifecycleError('Invoice revision is stale; reload before editing', 'INVOICE_VERSION_CONFLICT', 409);
    }
    if (!['DRAFT', 'REJECTED'].includes(invoice.approvalStatus)) {
      throw new InvoiceLifecycleError('Only an unsubmitted or rejected invoice draft can be edited', 'INVOICE_NOT_EDITABLE', 409);
    }
    if (sameDraft(invoice, input.draft)) {
      const code = invoice.approvalStatus === 'REJECTED' ? 'INVOICE_REVISION_REQUIRED' : 'INVOICE_NO_CHANGES';
      const message = invoice.approvalStatus === 'REJECTED'
        ? 'A rejected invoice must be substantively revised before resubmission'
        : 'The submitted draft is identical to the current revision';
      throw new InvoiceLifecycleError(message, code, 409);
    }

    const changed = await tx.invoice.updateMany({
      where: {
        id: invoice.id,
        version: input.expectedVersion,
        approvalStatus: invoice.approvalStatus,
        status: 'draft',
      },
      data: {
        customerName: input.draft.customerName,
        customerEmail: input.draft.customerEmail ?? null,
        customerTIN: input.draft.customerTIN ?? null,
        customerPhone: input.draft.customerPhone ?? null,
        customerAddress: input.draft.customerAddress ?? null,
        items: input.draft.items as unknown as Prisma.InputJsonValue,
        subtotal: new Prisma.Decimal(input.draft.subtotal.toFixed(2)),
        vat: new Prisma.Decimal(input.draft.vat.toFixed(2)),
        total: new Prisma.Decimal(input.draft.total.toFixed(2)),
        dueDate: input.draft.dueDate ? new Date(input.draft.dueDate) : null,
        template: input.draft.template,
        notes: input.draft.notes ?? null,
        approvalStatus: 'DRAFT',
        submittedForApprovalAt: null,
        approvedBy: null,
        approvedAt: null,
        approvedVersion: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) {
      throw new InvoiceLifecycleError('Invoice changed concurrently; reload before editing', 'INVOICE_VERSION_CONFLICT', 409);
    }
    const updated = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    await appendInvoiceRevision(tx, updated, input.actorUserId);
    await appendInvoiceLifecycleEvent(tx, {
      invoiceId: updated.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: invoice.approvalStatus === 'REJECTED' ? 'DRAFT_REVISED_AFTER_REJECTION' : 'DRAFT_UPDATED',
      fromApprovalStatus: invoice.approvalStatus,
      toApprovalStatus: 'DRAFT',
      revision: updated.version,
    });
    return {
      invoiceId: updated.id,
      version: updated.version,
      approvalStatus: updated.approvalStatus,
      status: updated.status,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function submitInvoiceForApproval(input: {
  invoiceId: string;
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (tx) => {
    const role = await requireMembership(tx, input.organizationId, input.actorUserId);
    if (!EDITOR_ROLES.has(role)) {
      throw new InvoiceLifecycleError('Submitting invoices is not permitted for this organization role', 'INVOICE_SUBMIT_FOR_APPROVAL_FORBIDDEN', 403);
    }
    const invoice = await requireGovernedInvoice(tx, input.invoiceId, input.organizationId);
    assertInternalDraft(invoice);
    if (invoice.version !== input.expectedVersion) {
      throw new InvoiceLifecycleError('Invoice revision is stale; reload before submitting', 'INVOICE_VERSION_CONFLICT', 409);
    }
    if (invoice.approvalStatus !== 'DRAFT') {
      throw new InvoiceLifecycleError('Only a revised draft can be submitted for approval', 'INVOICE_NOT_SUBMITTABLE', 409);
    }
    const changed = await tx.invoice.updateMany({
      where: { id: invoice.id, version: input.expectedVersion, approvalStatus: 'DRAFT', status: 'draft' },
      data: { approvalStatus: 'PENDING_APPROVAL', submittedForApprovalAt: new Date() },
    });
    if (changed.count !== 1) {
      throw new InvoiceLifecycleError('Invoice changed concurrently; reload before submitting', 'INVOICE_VERSION_CONFLICT', 409);
    }
    await appendInvoiceLifecycleEvent(tx, {
      invoiceId: invoice.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: 'SUBMITTED_FOR_APPROVAL',
      fromApprovalStatus: 'DRAFT',
      toApprovalStatus: 'PENDING_APPROVAL',
      revision: invoice.version,
    });
    return { invoiceId: invoice.id, version: invoice.version, approvalStatus: 'PENDING_APPROVAL', nrsSubmission: 'not_submitted' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function approveInvoice(input: {
  invoiceId: string;
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (tx) => {
    const role = await requireMembership(tx, input.organizationId, input.actorUserId);
    if (!APPROVER_ROLES.has(role)) {
      throw new InvoiceLifecycleError('Only an organization owner or admin may approve invoices', 'INVOICE_APPROVAL_FORBIDDEN', 403);
    }
    const invoice = await requireGovernedInvoice(tx, input.invoiceId, input.organizationId);
    assertInternalDraft(invoice);
    if (invoice.userId === input.actorUserId) {
      throw new InvoiceLifecycleError('Maker-checker control prohibits self-approval', 'INVOICE_SELF_APPROVAL_FORBIDDEN', 403);
    }
    if (invoice.version !== input.expectedVersion) {
      throw new InvoiceLifecycleError('Invoice revision changed; reload before approving', 'INVOICE_VERSION_CONFLICT', 409);
    }
    if (invoice.approvalStatus !== 'PENDING_APPROVAL') {
      throw new InvoiceLifecycleError('Only a pending invoice revision can be approved', 'INVOICE_NOT_PENDING_APPROVAL', 409);
    }
    const changed = await tx.invoice.updateMany({
      where: {
        id: invoice.id,
        version: input.expectedVersion,
        approvalStatus: 'PENDING_APPROVAL',
        status: 'draft',
      },
      data: {
        approvalStatus: 'APPROVED',
        approvedBy: input.actorUserId,
        approvedAt: new Date(),
        approvedVersion: invoice.version,
      },
    });
    if (changed.count !== 1) {
      throw new InvoiceLifecycleError('Invoice changed concurrently; reload before approving', 'INVOICE_VERSION_CONFLICT', 409);
    }
    await appendInvoiceLifecycleEvent(tx, {
      invoiceId: invoice.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: 'APPROVED',
      fromApprovalStatus: 'PENDING_APPROVAL',
      toApprovalStatus: 'APPROVED',
      revision: invoice.version,
    });
    return {
      invoiceId: invoice.id,
      version: invoice.version,
      approvedVersion: invoice.version,
      approvalStatus: 'APPROVED',
      nrsSubmission: 'not_submitted',
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function rejectInvoice(input: {
  invoiceId: string;
  organizationId: string;
  actorUserId: string;
  expectedVersion: number;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const role = await requireMembership(tx, input.organizationId, input.actorUserId);
    if (!APPROVER_ROLES.has(role)) {
      throw new InvoiceLifecycleError('Only an organization owner or admin may reject invoices', 'INVOICE_REJECTION_FORBIDDEN', 403);
    }
    const invoice = await requireGovernedInvoice(tx, input.invoiceId, input.organizationId);
    assertInternalDraft(invoice);
    if (invoice.userId === input.actorUserId) {
      throw new InvoiceLifecycleError('Maker-checker control prohibits self-review', 'INVOICE_SELF_REVIEW_FORBIDDEN', 403);
    }
    if (invoice.version !== input.expectedVersion) {
      throw new InvoiceLifecycleError('Invoice revision changed; reload before rejecting', 'INVOICE_VERSION_CONFLICT', 409);
    }
    if (invoice.approvalStatus !== 'PENDING_APPROVAL') {
      throw new InvoiceLifecycleError('Only a pending invoice revision can be rejected', 'INVOICE_NOT_PENDING_APPROVAL', 409);
    }
    const changed = await tx.invoice.updateMany({
      where: {
        id: invoice.id,
        version: input.expectedVersion,
        approvalStatus: 'PENDING_APPROVAL',
        status: 'draft',
      },
      data: {
        approvalStatus: 'REJECTED',
        rejectedBy: input.actorUserId,
        rejectedAt: new Date(),
        rejectionReason: input.reason,
      },
    });
    if (changed.count !== 1) {
      throw new InvoiceLifecycleError('Invoice changed concurrently; reload before rejecting', 'INVOICE_VERSION_CONFLICT', 409);
    }
    await appendInvoiceLifecycleEvent(tx, {
      invoiceId: invoice.id,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: 'REJECTED',
      fromApprovalStatus: 'PENDING_APPROVAL',
      toApprovalStatus: 'REJECTED',
      revision: invoice.version,
      reason: input.reason,
    });
    return { invoiceId: invoice.id, version: invoice.version, approvalStatus: 'REJECTED', reason: input.reason };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getInvoiceLifecycle(input: {
  invoiceId: string;
  organizationId: string;
  actorUserId: string;
}) {
  const role = await requireMembership(prisma, input.organizationId, input.actorUserId);
  if (!role) throw new InvoiceLifecycleError('Organization membership is required', 'ORG_MEMBERSHIP_REVOKED', 403);
  const invoice = await requireGovernedInvoice(prisma, input.invoiceId, input.organizationId);
  const [revisions, events] = await Promise.all([
    prisma.invoiceVersion.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { version: 'asc' },
      select: { version: true, data: true, changedBy: true, contentHash: true, createdAt: true },
    }),
    prisma.invoiceLifecycleEvent.findMany({
      where: { invoiceId: invoice.id, organizationId: input.organizationId },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true, eventType: true, fromApprovalStatus: true, toApprovalStatus: true,
        revision: true, reason: true, metadata: true, actorUserId: true, occurredAt: true,
      },
    }),
  ]);
  return {
    invoiceId: invoice.id,
    version: invoice.version,
    approvalStatus: invoice.approvalStatus,
    submittedForApprovalAt: invoice.submittedForApprovalAt?.toISOString() ?? null,
    approvedAt: invoice.approvedAt?.toISOString() ?? null,
    approvedBy: invoice.approvedBy,
    approvedVersion: invoice.approvedVersion,
    rejectedAt: invoice.rejectedAt?.toISOString() ?? null,
    rejectedBy: invoice.rejectedBy,
    rejectionReason: invoice.rejectionReason,
    revisions: revisions.map((revision) => ({
      ...revision,
      createdAt: revision.createdAt.toISOString(),
    })),
    events: events.map((event) => ({
      ...event,
      occurredAt: event.occurredAt.toISOString(),
    })),
  };
}
