/**
 * Audit Service — TaxBridge V12
 *
 * Immutable audit event writer.
 * AuditEvent records are append-only; no updates or deletes (regulatory).
 *
 * C-01: Uses (prisma as any) pattern — no Prisma typed helpers.
 */

import { createLogger } from '../lib/logger';

const log = createLogger('audit');

export interface AuditEventInput {
  orgId?:      string;
  actorId:     string;
  action:      string;
  resource?:   string;
  resourceId?: string;
  details?:    Record<string, unknown>;
  ipAddress?:  string;
  userAgent?:  string;
}

/**
 * Write an immutable audit event. Fire-and-forget safe — never throws.
 * @param input  Audit data
 * @param prismaClient  Prisma client instance (as any per C-01)
 */
export async function writeAuditEvent(
  input: AuditEventInput,
  prismaClient: any,
): Promise<void> {
  try {
    await (prismaClient as any).auditEvent.create({
      data: {
        orgId:      input.orgId ?? null,
        userId:     input.actorId,
        action:     input.action,
        resource:   input.resource ?? null,
        resourceId: input.resourceId ?? null,
        metadata:   input.details ?? {},
        ipAddress:  input.ipAddress ?? null,
        userAgent:  input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit failures must NEVER crash the application (C-07).
    // Log + Sentry but swallow.
    log.error('writeAuditEvent failed', { err });
  }
}
