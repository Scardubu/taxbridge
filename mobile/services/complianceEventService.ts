import { getDatabase } from './database';
import { offlineQueue } from './offlineQueue';

export type ComplianceEventType =
  | 'onboarding_complete'
  | 'tin_verified'
  | 'tin_failed'
  | 'vat_registration_attempted'
  | 'einvoice_submitted'
  | 'invoice_submitted'
  | 'invoice_overdue'
  | 'tax_payment_initiated'
  | 'tax_payment_successful'
  | 'tax_payment_failed'
  | 'deadline_approaching'
  | 'deadline_missed';

export async function logComplianceEvent(
  type: ComplianceEventType,
  description: string,
  severity: 'info' | 'warning' | 'critical',
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO compliance_events (event_type, description, severity) VALUES (?,?,?)',
    [type, description, severity]
  );

  await offlineQueue.enqueue('COMPLIANCE_EVENT', {
    eventType: type,
    description,
    severity,
    metadata: metadata ?? {},
  });
}
