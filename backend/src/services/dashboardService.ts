/**
 * dashboardService — TaxBridge V12
 *
 * Builds the composite dashboard payload (G-SYN-01 / G-SYN-02).
 * Combines intelligence input assembly, anomaly detection, risk scoring,
 * NRS health, and compliance events into a single data structure.
 *
 * C-14: All home-screen data is fetched in ONE composite call.
 * C-07: Returns FALLBACK_* constants on any DB / external failure.
 */

import * as Sentry from '@sentry/node';
import { createLogger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { getRedisConnection } from '../queue/client';
import { computeAnomalies, type AnomalySignal } from './anomalyEngine';
import { computeRiskScore, type RiskScoreResult } from './riskScoring';
import { getNrsHealth, type NrsHealthResult } from './nrsService';
import type {
  IntelligenceInput,
  InvoiceSummary,
  PaymentSummary,
  FilingSummary,
} from '@taxbridge/contracts';

const log = createLogger('dashboard-service');

const CACHE_TTL_SECONDS = 120;

// ─── Output shape ─────────────────────────────────────────────────────────────

export interface DashboardComposite {
  orgId:       string;
  userId:      string;
  risk:        RiskScoreResult;
  anomalies:   AnomalySignal[];
  nrsHealth:   NrsHealthResult;
  filings: {
    upcoming: UpcomingFiling[];
    overdue:  OverdueFiling[];
  };
  summary: {
    totalRevenue:     number;
    totalVatOwed:     number;
    totalPaid:        number;
    invoiceCount:     number;
    unstampedCount:   number;
  };
  cacheHit:    boolean;
  computedAt:  string;
}

export interface UpcomingFiling {
  taxType:  string;
  period:   string;
  deadline: string;
  daysLeft: number;
}

export interface OverdueFiling {
  taxType:    string;
  period:     string;
  deadline:   string;
  daysOverdue: number;
}

// ─── Fallback constant (C-12) ─────────────────────────────────────────────────
const FALLBACK_DASHBOARD: Omit<DashboardComposite, 'orgId' | 'userId' | 'computedAt'> = {
  risk: {
    score: 0,
    band: 'low',
    subScores: { filingLatency: 0, paymentGap: 0, vatCompliance: 0, nrsStampRate: 0, nilOveruse: 0 },
    computedAt: new Date(0).toISOString(),
  },
  anomalies:   [],
  nrsHealth:   { status: 'unknown', latencyMs: null, lastChecked: new Date(0).toISOString() },
  filings:     { upcoming: [], overdue: [] },
  summary:     { totalRevenue: 0, totalVatOwed: 0, totalPaid: 0, invoiceCount: 0, unstampedCount: 0 },
  cacheHit:    false,
};

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Build or return cached dashboard composite.
 * Never throws — returns FALLBACK_DASHBOARD on any unrecoverable error.
 */
export async function getDashboardComposite(
  orgId: string,
  userId: string,
): Promise<DashboardComposite> {
  const cacheKey = `dashboard:${orgId}:${userId}`;

  // ─ Try Redis cache first ──────────────────────────────────────────────────
  try {
    const redis = getRedisConnection();
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as DashboardComposite;
        log.debug('dashboard cache HIT', { orgId, userId });
        return { ...parsed, cacheHit: true };
      }
    }
  } catch (cacheErr) {
    log.warn('Redis cache read failed — proceeding without cache', { err: cacheErr, orgId });
  }

  // ─ Build fresh ────────────────────────────────────────────────────────────
  try {
    const input = await buildIntelligenceInput(orgId, userId);

    // Run anomalies + risk + NRS health in parallel
    const [anomalies, risk, nrsHealth] = await Promise.all([
      Promise.resolve(computeAnomalies(input)),
      Promise.resolve(computeRiskScore(input)),
      getNrsHealth(),
    ]);

    const now = new Date();
    const filings = _classifyFilings(input.filingHistory, now);
    const summary = _buildSummary(input);

    const payload: DashboardComposite = {
      orgId,
      userId,
      risk,
      anomalies,
      nrsHealth,
      filings,
      summary,
      cacheHit:   false,
      computedAt: now.toISOString(),
    };

    // ─ Cache result ──────────────────────────────────────────────────────────
    try {
      const redis = getRedisConnection();
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
      }
    } catch (cacheWriteErr) {
      log.warn('Redis cache write failed — ignoring', { err: cacheWriteErr, orgId });
    }

    return payload;
  } catch (err) {
    Sentry.captureException(err, { extra: { orgId, userId } });
    log.error('getDashboardComposite failed — returning fallback', { err, orgId, userId });
    return {
      ...FALLBACK_DASHBOARD,
      orgId,
      userId,
      computedAt: new Date().toISOString(),
    };
  }
}

// ─── Intelligence input assembly (G-SYN-01) ───────────────────────────────────

/**
 * Query the database for all data needed by the anomaly and risk engines.
 * All Prisma calls use (prisma as any) per C-01.
 */
export async function buildIntelligenceInput(
  orgId: string,
  userId: string,
): Promise<IntelligenceInput> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo    = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const [invoicesRaw, paymentsRaw, filingsRaw] = await Promise.all([
    (prisma as any).invoice.findMany({
      where:  { orgId, createdAt: { gte: thirtyDaysAgo } },
      select: { id: true, totalAmount: true, vatAmount: true, status: true, createdAt: true, customerTin: true },
      take:   200,
    }),
    (prisma as any).payment.findMany({
      where:  { orgId, createdAt: { gte: oneYearAgo } },
      select: { id: true, amount: true, status: true, dueDate: true, paidAt: true, taxType: true },
      take:   200,
    }),
    (prisma as any).taxFiling.findMany({
      where:  { orgId, period: { gte: _periodKeyMonthsAgo(12) } },
      select: { id: true, taxType: true, period: true, filedAt: true, deadlineDate: true, status: true },
      take:   100,
    }),
  ]);

  const invoices: InvoiceSummary[] = invoicesRaw.map((inv: any) => ({
    id:          inv.id,
    amount:      Number(inv.totalAmount ?? 0),
    vatAmount:   Number(inv.vatAmount ?? 0),
    status:      inv.status,
    issuedAt:    inv.createdAt.toISOString(),
    customerTin: inv.customerTin ?? undefined,
  }));

  const payments: PaymentSummary[] = paymentsRaw.map((p: any) => ({
    id:       p.id,
    amount:   Number(p.amount ?? 0),
    status:   p.status,
    dueDate:  p.dueDate?.toISOString() ?? new Date(0).toISOString(),
    paidAt:   p.paidAt?.toISOString() ?? undefined,
    taxType:  p.taxType,
  }));

  const filingHistory: FilingSummary[] = filingsRaw.map((f: any) => ({
    id:       f.id,
    taxType:  f.taxType,
    period:   f.period,
    filedAt:  f.filedAt?.toISOString() ?? undefined,
    deadline: f.deadlineDate?.toISOString() ?? new Date(0).toISOString(),
    status:   f.status,
  }));

  return { orgId, userId, invoices, payments, filingHistory };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _classifyFilings(
  filings: FilingSummary[],
  now: Date,
): { upcoming: UpcomingFiling[]; overdue: OverdueFiling[] } {
  const upcoming: UpcomingFiling[] = [];
  const overdue: OverdueFiling[] = [];

  for (const f of filings) {
    if (f.status !== 'DRAFT') continue;
    const deadline = new Date(f.deadline);
    const diffDays = (deadline.getTime() - now.getTime()) / 86_400_000;
    if (diffDays >= 0) {
      upcoming.push({ taxType: f.taxType, period: f.period, deadline: f.deadline, daysLeft: Math.ceil(diffDays) });
    } else {
      overdue.push({ taxType: f.taxType, period: f.period, deadline: f.deadline, daysOverdue: Math.abs(Math.floor(diffDays)) });
    }
  }

  upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { upcoming, overdue };
}

function _buildSummary(input: IntelligenceInput) {
  return {
    totalRevenue:   input.invoices.reduce((s, inv) => s + inv.amount, 0),
    totalVatOwed:   input.invoices.reduce((s, inv) => s + inv.vatAmount, 0),
    totalPaid:      input.payments.filter((p) => p.paidAt).reduce((s, p) => s + p.amount, 0),
    invoiceCount:   input.invoices.length,
    unstampedCount: input.invoices.filter((inv) => inv.status === 'UNSTAMPED').length,
  };
}

/** Returns period key for N months ago: "YYYY-MM" */
function _periodKeyMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
