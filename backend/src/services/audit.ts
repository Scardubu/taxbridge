/**
 * Audit Service — TaxBridge V12
 *
 * Immutable audit event writer.
 * AuditEvent records are append-only; no updates or deletes (regulatory).
 *
 * C-01: Uses (prisma as any) pattern — no Prisma typed helpers.
 * C-07: Never throws — swallows all errors to prevent audit failures
 *        from crashing the application.
 */

import { createLogger } from '../lib/logger';
import { getPrismaClient } from '../lib/prisma';

const log = createLogger('audit');

/**
 * Extended audit event input — accepts both the canonical field names
 * and the legacy aliases used by filing / document routes.
 *
 * Canonical → DB mapping:
 *   actorId / actorId          → userId
 *   resource / targetType      → resource
 *   resourceId / targetId      → resourceId
 *   details / after / before   → metadata (merged)
 *   ipAddress / ip             → ipAddress
 *   userAgent                  → userAgent
 */
export interface AuditEventInput {
  orgId?:      string;
  actorId:     string;
  actorRole?:  string;                    // informational — stored in metadata
  action:      string;
  /** Canonical resource name (e.g. 'TaxReturn', 'Document') */
  resource?:   string;
  /** Alias for resource — preferred by filing/document routes */
  targetType?: string;
  /** Canonical resource record ID */
  resourceId?: string;
  /** Alias for resourceId — preferred by filing/document routes */
  targetId?:   string;
  /** Structured diff / contextual data */
  details?:    Record<string, unknown>;
  /** State after the action (merged into details) */
  after?:      Record<string, unknown>;
  /** State before the action (merged into details, for DELETE-style events) */
  before?:     Record<string, unknown>;
  /** Canonical IP field */
  ipAddress?:  string;
  /** Alias for ipAddress — preferred by filing/document routes */
  ip?:         string;
  userAgent?:  string | string[] | undefined;
}

/**
 * Write an immutable audit event. Fire-and-forget safe — never throws.
 *
 * Accepts both the old two-argument form (prismaClient second arg) and
 * the new single-argument form that uses the global Prisma singleton.
 *
 * @param input       Audit data (see AuditEventInput for field aliases)
 * @param _ignored    Ignored — kept for backwards-compat callers that pass prismaClient.
 *                    The global singleton is used instead.
 */
export async function writeAuditEvent(
  input: AuditEventInput,
  _ignored?: unknown,
): Promise<void> {
  try {
    const prisma = getPrismaClient();

    // Resolve canonical field names from either alias
    const resource   = input.resource   ?? input.targetType ?? null;
    const resourceId = input.resourceId ?? input.targetId   ?? null;
    const ipAddress  = input.ipAddress  ?? input.ip         ?? null;

    // Merge details / after / before into a single metadata object
    const metadata: Record<string, unknown> = {
      ...(input.details ?? {}),
      ...(input.after   ? { after:  input.after  } : {}),
      ...(input.before  ? { before: input.before } : {}),
      ...(input.actorRole ? { actorRole: input.actorRole } : {}),
    };

    await (prisma as any).auditEvent.create({
      data: {
        orgId:      input.orgId    ?? null,
        userId:     input.actorId,
        action:     input.action,
        resource:   resource,
        resourceId: resourceId,
        metadata,
        ipAddress:  ipAddress,
        userAgent:  Array.isArray(input.userAgent)
          ? input.userAgent.join(', ')
          : input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit failures must NEVER crash the application (C-07).
    log.error('writeAuditEvent failed', { err });
  }
}
