import { getDatabase } from './database';
import { offlineQueue } from './offlineQueue';
import { postComplianceEvent } from './api';

export type ComplianceEventType =
  | 'onboarding_complete'
  | 'tin_verified'
  | 'tin_failed'
  | 'receipt_scanned'
  | 'receipt_submitted'
  | 'vat_registration_attempted'
  | 'einvoice_submitted'
  | 'invoice_submitted'
  | 'invoice_overdue'
  | 'tax_payment_initiated'
  | 'tax_payment_successful'
  | 'tax_payment_failed'
  | 'deadline_approaching'
  | 'deadline_missed'
  | 'admin_alert_received'
  | 'obligation_override'
  | 'vat_return_submitted';

export interface ComplianceEventContext {
  source?: 'mobile' | 'admin' | 'firs' | 'system';
  businessId?: string;
  actionUrl?: string;
}

export async function logComplianceEvent(
  type: ComplianceEventType,
  description: string,
  severity: 'info' | 'warning' | 'critical',
  metadata?: Record<string, unknown>,
  context?: ComplianceEventContext,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO compliance_events (event_type, description, severity, source, business_id, metadata, action_url)
     VALUES (?,?,?,?,?,?,?)`,
    [
      type,
      description,
      severity,
      context?.source ?? 'mobile',
      context?.businessId ?? null,
      JSON.stringify(metadata ?? {}),
      context?.actionUrl ?? null,
    ]
  );

  try {
    await postComplianceEvent({
      event_type: type,
      business_id: context?.businessId,
      metadata: {
        description,
        severity,
        ...(metadata ?? {}),
      },
      client_timestamp: new Date().toISOString(),
      source: context?.source ?? 'mobile',
    });
  } catch {
    // postComplianceEvent already handles offline queue fallback for transport errors.
  }
}
