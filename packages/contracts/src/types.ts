/**
 * TaxBridge — Shared Type Contracts
 *
 * Single source of truth for types shared between backend, mobile, and admin.
 * All cross-layer interfaces live here — never define API shapes in consumer code.
 */

// ─── Pagination (cursor-based) ─────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    total: number | null;
    pageSize: number;
  };
}

/**
 * Encode a cursor from an ID + timestamp.
 * Uses base64 to keep it opaque to consumers.
 */
export function encodeCursor(id: string, createdAt: Date): string {
  const payload = JSON.stringify({ id, t: createdAt.toISOString() });
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decode a cursor string back to its components.
 * Throws with status 400 on malformed input (COMP-11).
 */
export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed.id || !parsed.t) {
      throw new Error('invalid cursor shape');
    }
    return { createdAt: new Date(parsed.t), id: parsed.id };
  } catch {
    throw Object.assign(new Error('INVALID_CURSOR'), { status: 400 });
  }
}

// ─── Intelligence Pipeline Types ────────────────────────────────────────────────

export interface IntelligenceInput {
  orgId: string;
  userId: string;
  invoices: InvoiceSummary[];
  payments: PaymentSummary[];
  filingHistory: FilingSummary[];
}

export interface InvoiceSummary {
  id: string;
  amount: number;
  vatAmount: number;
  status: string;
  issuedAt: string;
  customerTin?: string;
}

export interface PaymentSummary {
  id: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt?: string;
  taxType: string;
}

export interface FilingSummary {
  id: string;
  taxType: string;
  period: string;
  filedAt?: string;
  deadline: string;
  status: string;
}

// ─── Dashboard Composite ────────────────────────────────────────────────────────

export interface DashboardStats {
  taxHealth: TaxHealthData;
  anomalies: AnomalySignal[];
  compliance: ComplianceEvent[];
  nrsStatus: NrsHealth;
  revenue: RevenueSummary;
  riskScore: number;
}

export interface TaxHealthData {
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  breakdown: {
    filing: number;
    payment: number;
    accuracy: number;
    timeliness: number;
  };
}

export interface RevenueSummary {
  totalRevenue: number;
  totalTax: number;
  invoiceCount: number;
  period: string;
}

// ─── Anomaly Detection ──────────────────────────────────────────────────────────

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface AnomalySignal {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

export type AnomalyType =
  | 'duplicate_invoice'
  | 'vat_mismatch'
  | 'late_filing'
  | 'unusual_amount'
  | 'missing_tin'
  | 'threshold_breach'
  | 'payment_gap';

// ─── Compliance ─────────────────────────────────────────────────────────────────

export interface ComplianceEvent {
  id: string;
  taxType: string;
  deadline: string;
  status: 'upcoming' | 'due_soon' | 'overdue' | 'filed';
  daysRemaining: number;
  description: string;
}

// ─── NRS Health ─────────────────────────────────────────────────────────────────

export interface NrsHealth {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  lastChecked: string;
  circuitState: 'closed' | 'open' | 'half-open';
}

// ─── Risk Scoring ───────────────────────────────────────────────────────────────

export interface SMERiskRecord {
  orgId: string;
  overallScore: number;
  subScores: {
    filingCompliance: number;
    paymentHistory: number;
    invoiceAccuracy: number;
    vatCompliance: number;
    auditReadiness: number;
  };
  computedAt: string;
  factors: RiskFactor[];
}

export interface RiskFactor {
  name: string;
  impact: number;
  description: string;
}

// ─── Auth & Device ──────────────────────────────────────────────────────────────

export interface DeviceInfo {
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  pushToken?: string;
  appVersion: string;
  osVersion: string;
  lastActiveAt: string;
}

// ─── Tax Calculation Input/Output ───────────────────────────────────────────────

export interface CITInput {
  turnover: number;
  profit: number;
  devLevyApplies: boolean;
  taxLossCarryforward: number;
}

export interface CITResult {
  tier: 'small' | 'medium' | 'large';
  citRate: number;
  citAmount: number;
  devLevy: number;
  educationTax: number;
  taxLossApplied: number;
  total: number;
  exempt: boolean;
}
