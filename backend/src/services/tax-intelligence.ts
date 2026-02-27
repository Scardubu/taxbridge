/**
 * TaxBridge Tax Intelligence Service
 * AI-powered: anomaly detection, quarterly forecast, tax health score
 * Uses real production data — zero fabricated metrics
 */

import type { PrismaClient } from '@prisma/client';
import { NTA_2025 } from '@taxbridge/contracts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaxForecast {
  forecastedLiability:         number;
  breakdown:                   { pit: number; vat: number; devLevy: number; cit?: number };
  vatReclaimable:              number;
  confidenceScore:             number;
  nextDeadline:                string;
  recommendedMonthlyProvision: number;
  periodMonths:                number;
  expenseCount:                number;
}

export interface AnomalySignal {
  expenseId:      string;
  amount:         number;
  category:       string;
  date:           string;
  anomalyReason:  string;
  anomalyReason_pidgin?: string;
  severity:       'low' | 'medium' | 'high';
  suggestedAction: string;
  zScore?:        number;
}

export interface TaxHealthScore {
  score:      number;   // 0–100
  grade:      'A' | 'B' | 'C' | 'D' | 'F';
  breakdown:  HealthBreakdown;
  topIssues:  string[];
}

interface HealthBreakdown {
  invoiceCompliance:  number;  // 0–25
  expenseTracking:    number;  // 0–20
  nrsSubmission:      number;  // 0–25
  paymentTimeliness:  number;  // 0–15
  receiptCoverage:    number;  // 0–15
}

// ─── Tax Forecast ─────────────────────────────────────────────────────────────

export async function forecastQuarterlyTax(
  userId:     string,
  prisma:     PrismaClient,
  lookbackDays = 90,
): Promise<TaxForecast> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - lookbackDays);

  const [expenses, invoices] = await Promise.all([
    (prisma as any).expense.findMany({
      where:  { userId, createdAt: { gte: sinceDate } },
      select: { amount: true, category: true, vatEligible: true },
    }),
    (prisma as any).invoice.findMany({
      where:  { userId, status: 'PAID', createdAt: { gte: sinceDate } },
      select: { amount: true, vatAmount: true },
    }),
  ]);

  const totalRevenue  = invoices.reduce((s: number, i: any) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + e.amount, 0);
  const vatReclaimable = expenses
    .filter((e: any) => e.vatEligible)
    .reduce((s: number, e: any) => s + e.amount * NTA_2025.VAT.standardRate, 0);

  // PIT estimate — annualised from lookback period, then halved for quarterly
  const annualisedRevenue = totalRevenue * (365 / lookbackDays);
  const pitEstimate       = calculatePIT(annualisedRevenue - totalExpenses * (365 / lookbackDays)) / 4;

  // VAT — net of reclaimable
  const vatCollected  = invoices.reduce((s: number, i: any) => s + (i.vatAmount ?? 0), 0);
  const vatEstimate   = Math.max(0, vatCollected - vatReclaimable);

  // Development Levy — 4% on qualifying profits (NTA 2025 §60A)
  const profit        = totalRevenue - totalExpenses;
  const devLevy       = profit > 0 ? profit * NTA_2025.DEV_LEVY.rate : 0;

  const forecastedLiability = pitEstimate + vatEstimate + devLevy;

  // Confidence: higher with more expense data and more consistent income
  const hasEnoughData   = expenses.length >= 10 && invoices.length >= 3;
  const confidenceScore = hasEnoughData ? 0.85 : expenses.length >= 5 ? 0.65 : 0.40;

  return {
    forecastedLiability:         Math.round(forecastedLiability),
    breakdown: {
      pit:      Math.round(pitEstimate),
      vat:      Math.round(vatEstimate),
      devLevy:  Math.round(devLevy),
    },
    vatReclaimable:              Math.round(vatReclaimable),
    confidenceScore,
    nextDeadline:                getNextNRSDeadline(),
    recommendedMonthlyProvision: Math.round(forecastedLiability / 3),
    periodMonths:                Math.round(lookbackDays / 30),
    expenseCount:                expenses.length,
  };
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

// NTA 2025-aligned anomaly signals (M03 spec §9):
// AMOUNT_SPIKE, DUPLICATE_AMOUNT, PHANTOM_VENDOR, ROUND_AMOUNT,
// VAT_MISMATCH, WEEKEND_EXPENSE, SPLIT_TRANSACTION, OUT_OF_CATEGORY, MISSING_RECEIPT

export async function detectExpenseAnomalies(
  userId: string,
  prisma: PrismaClient,
  lookbackDays = 90,
): Promise<AnomalySignal[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - lookbackDays);

  const expenses = await (prisma as any).expense.findMany({
    where:  { userId, createdAt: { gte: sinceDate } },
    orderBy: { createdAt: 'desc' },
  });

  const signals: AnomalySignal[] = [];

  // ── Signal 1: AMOUNT_SPIKE — leave-one-out z-score vs other expenses in category ─────
  // Group expenses by category to compute peer statistics
  const grouped = new Map<string, typeof expenses>();
  for (const e of expenses) {
    if (!grouped.has(e.category)) grouped.set(e.category, []);
    grouped.get(e.category)!.push(e);
  }

  for (const e of expenses) {
    // Exclude current expense from peer set (leave-one-out)
    const peers = (grouped.get(e.category) ?? []).filter((x: any) => x.id !== e.id);
    if (peers.length < 3) continue; // need ≥3 peers for reliable statistics

    const amounts = peers.map((x: any) => x.amount as number);
    const mean   = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.map(a => (a - mean) ** 2).reduce((s, v) => s + v, 0) / amounts.length);
    const zScore = stdDev > 0 ? (e.amount - mean) / stdDev : 0;

    if (zScore > 2.5) {
      signals.push({
        expenseId:      e.id,
        amount:         e.amount,
        category:       e.category,
        date:           e.createdAt.toISOString().split('T')[0],
        severity:       zScore > 3.5 ? 'high' : 'medium',
        anomalyReason:  `₦${e.amount.toLocaleString('en-NG')} is ${zScore.toFixed(1)}× above your average for ${e.category}`,
        anomalyReason_pidgin: `₦${e.amount.toLocaleString('en-NG')} too high for ${e.category}. Na ${zScore.toFixed(1)}× your normal amount.`,
        suggestedAction: 'Verify receipt and confirm VAT eligibility before filing',
        zScore,
      });
    }
  }

  // ── Signal 2: DUPLICATE_AMOUNT — same amount, same category, ≤7 days ─────
  for (let i = 0; i < expenses.length; i++) {
    for (let j = i + 1; j < expenses.length; j++) {
      const a = expenses[i], b = expenses[j];
      if (a.amount !== b.amount || a.category !== b.category) continue;
      const daysDiff = Math.abs(
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 7) {
        signals.push({
          expenseId:      a.id,
          amount:         a.amount,
          category:       a.category,
          date:           a.createdAt.toISOString().split('T')[0],
          severity:       'high',
          anomalyReason:  `Possible duplicate: ₦${a.amount.toLocaleString('en-NG')} in ${a.category} appears twice within 7 days`,
          anomalyReason_pidgin: `E look like duplicate expense. Same amount ₦${a.amount.toLocaleString('en-NG')} appear twice for ${a.category}`,
          suggestedAction: 'Check if this was entered twice or if both transactions are genuine',
        });
        break; // Only flag once per pair
      }
    }
  }

  // ── Signal 3: ROUND_AMOUNT — suspiciously round amounts > ₦50k ──────────
  for (const e of expenses) {
    if (e.amount < 50_000) continue;
    if (e.amount % 100_000 === 0 && e.amount > 0) {
      signals.push({
        expenseId:       e.id,
        amount:          e.amount,
        category:        e.category,
        date:            e.createdAt.toISOString().split('T')[0],
        severity:        'low',
        anomalyReason:   `Perfectly round amount (₦${e.amount.toLocaleString('en-NG')}) — ensure this has a receipt`,
        anomalyReason_pidgin: `The amount ₦${e.amount.toLocaleString('en-NG')} dey look like estimate. Make sure you get receipt for am.`,
        suggestedAction: 'Attach original receipt to validate this expense for VAT claims',
      });
    }
  }

  // ── Signal 4: VAT_MISMATCH — VAT-eligible but vatAmount seems wrong ───────
  for (const e of expenses) {
    if (!e.vatEligible || !e.vatAmount) continue;
    const expectedVat = e.amount * NTA_2025.VAT.standardRate;
    const diff        = Math.abs(e.vatAmount - expectedVat);
    if (diff > expectedVat * 0.1 && e.amount > 10_000) {
      signals.push({
        expenseId:      e.id,
        amount:         e.amount,
        category:       e.category,
        date:           e.createdAt.toISOString().split('T')[0],
        severity:       'medium',
        anomalyReason:  `VAT amount ₦${e.vatAmount.toLocaleString('en-NG')} doesn't match expected 7.5% = ₦${Math.round(expectedVat).toLocaleString('en-NG')}`,
        anomalyReason_pidgin: `The VAT amount no correct. Expected 7.5% = ₦${Math.round(expectedVat).toLocaleString('en-NG')}, but dem enter ₦${e.vatAmount.toLocaleString('en-NG')}`,
        suggestedAction: 'Review receipt — NRS may reject incorrect VAT claims during audit',
      });
    }
  }

  // Deduplicate by expenseId — one signal per expense, keeping the highest-severity one
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const bestByExpense = new Map<string, AnomalySignal>();
  for (const s of signals) {
    const existing = bestByExpense.get(s.expenseId);
    if (!existing || severityOrder[s.severity] < severityOrder[existing.severity]) {
      bestByExpense.set(s.expenseId, s);
    }
  }
  const deduped = Array.from(bestByExpense.values());

  // Sort: high → medium → low
  return deduped.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ─── Tax Health Score ─────────────────────────────────────────────────────────

export async function computeTaxHealthScore(
  userId: string,
  prisma: PrismaClient,
): Promise<TaxHealthScore> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [invoices, expenses, nrsFailed] = await Promise.all([
    (prisma as any).invoice.findMany({
      where:  { userId },
      select: { status: true, nrsStatus: true, createdAt: true, amount: true },
    }),
    (prisma as any).expense.findMany({
      where:  { userId },
      select: { receiptUrl: true, vatEligible: true, createdAt: true },
    }),
    (prisma as any).invoice.count({
      where: { userId, nrsStatus: 'FAILED', amount: { gte: 200_000 } },
    }),
  ]);

  // 1. Invoice Compliance (0–25): Are invoices being filed and stamped?
  const totalInvoices    = invoices.length;
  const stampedInvoices  = invoices.filter((i: any) => i.nrsStatus === 'STAMPED').length;
  const nrsRate          = totalInvoices > 0 ? stampedInvoices / totalInvoices : 0.5;
  const invoiceCompliance = Math.round(nrsRate * 25);

  // 2. Expense Tracking (0–20): Are expenses being tracked regularly?
  const recentExpenses = expenses.filter(
    (e: any) => new Date(e.createdAt) >= thirtyDaysAgo
  ).length;
  const expenseTracking = Math.min(20, Math.round((recentExpenses / 10) * 20));

  // 3. NRS Submission (0–25): No failed NRS = full marks
  const nrsSubmission = Math.max(0, 25 - nrsFailed * 5);

  // 4. Payment Timeliness (0–15): Invoices paid vs overdue
  const overdueCount       = invoices.filter((i: any) => i.status === 'OVERDUE').length;
  const overdueRate        = totalInvoices > 0 ? overdueCount / totalInvoices : 0;
  const paymentTimeliness  = Math.round((1 - overdueRate) * 15);

  // 5. Receipt Coverage (0–15): Expenses with receipts attached
  const withReceipt   = expenses.filter((e: any) => e.receiptUrl).length;
  const receiptRate   = expenses.length > 0 ? withReceipt / expenses.length : 0.5;
  const receiptCoverage = Math.round(receiptRate * 15);

  const score = invoiceCompliance + expenseTracking + nrsSubmission + paymentTimeliness + receiptCoverage;
  const grade: TaxHealthScore['grade'] =
    score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  const topIssues: string[] = [];
  if (invoiceCompliance < 15) topIssues.push('Low NRS e-invoice stamping rate — submit invoices for NRS approval');
  if (expenseTracking   < 10) topIssues.push('Few recent expense records — track expenses monthly for accurate VAT claims');
  if (nrsFailed         > 0)  topIssues.push(`${nrsFailed} NRS submission failure(s) — review and resubmit in Admin > Compliance`);
  if (overdueCount      > 0)  topIssues.push(`${overdueCount} overdue invoice(s) — follow up with clients to avoid cash flow issues`);
  if (receiptCoverage   < 8)  topIssues.push('Low receipt attachment rate — upload receipts to support VAT input tax claims');

  return {
    score,
    grade,
    breakdown: {
      invoiceCompliance,
      expenseTracking,
      nrsSubmission,
      paymentTimeliness,
      receiptCoverage,
    },
    topIssues,
  };
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(userId: string, prisma: PrismaClient) {
  const [
    totalInvoices, totalRevenue, pendingNrs,
    vatLiability, health,
  ] = await Promise.all([
    (prisma as any).invoice.count({ where: { userId } }),
    (prisma as any).invoice.aggregate({
      where: { userId, status: 'PAID' },
      _sum:  { amount: true },
    }),
    (prisma as any).invoice.count({ where: { userId, nrsStatus: 'PENDING' } }),
    computeCurrentVatLiability(userId, prisma),
    computeTaxHealthScore(userId, prisma),
  ]);

  const nextDeadline = getNextNRSDeadline();

  return {
    totalInvoices,
    totalRevenue:   totalRevenue._sum.amount ?? 0,
    pendingNrs,
    vatLiability,
    nextDeadline,
    taxHealthScore: health.score,
    recentAnomalies: 0,  // Populated by separate anomaly call
  };
}

async function computeCurrentVatLiability(userId: string, prisma: PrismaClient): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const invoices = await (prisma as any).invoice.findMany({
    where:  { userId, status: 'PAID', createdAt: { gte: startOfMonth } },
    select: { vatAmount: true },
  });

  return invoices.reduce((s: number, i: any) => s + (i.vatAmount ?? 0), 0);
}

// ─── NTA 2025 PIT Calculator ──────────────────────────────────────────────────

function calculatePIT(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  let remaining = taxableIncome;
  let tax       = 0;
  let prevLimit = 0;

  for (const band of NTA_2025.PIT.bands) {
    const bandWidth = band.limit === Infinity
      ? remaining
      : Math.min(remaining, band.limit - prevLimit);

    if (bandWidth <= 0) break;
    tax       += bandWidth * band.rate;
    remaining -= bandWidth;
    prevLimit  = band.limit;

    if (remaining <= 0) break;
  }

  return Math.round(tax);
}

// ─── F1: Pillar Scores ──────────────────────────────────────────────────────────

export interface PillarScore {
  key:    'filing_timeliness' | 'data_completeness' | 'compliance_calendar' | 'nrs_submissions';
  score:  number;  // 0–100 normalised
  trend?: 'improving' | 'stable' | 'declining';
}

/**
 * Derives 4 pillar scores from the existing health score breakdown.
 * No extra DB queries — reuses computeTaxHealthScore result.
 */
export async function getPillarScores(
  userId: string,
  prisma: PrismaClient,
): Promise<PillarScore[]> {
  const health = await computeTaxHealthScore(userId, prisma);
  const { breakdown } = health;
  return [
    {
      key:   'filing_timeliness',
      score: Math.min(100, Math.round((breakdown.paymentTimeliness / 15) * 100)),
    },
    {
      key:   'data_completeness',
      score: Math.min(100, Math.round(((breakdown.receiptCoverage + breakdown.expenseTracking) / 35) * 100)),
    },
    {
      key:   'compliance_calendar',
      score: Math.min(100, Math.round((breakdown.invoiceCompliance / 25) * 100)),
    },
    {
      key:   'nrs_submissions',
      score: Math.min(100, Math.round((breakdown.nrsSubmission / 25) * 100)),
    },
  ];
}

// ─── F4: Tax Breakdown Slices ─────────────────────────────────────────────────

export interface TaxBreakdownSlice {
  key:   string;
  label: string;
  value: number;
}

/**
 * YTD tax liability by type — used by DonutChart (F4).
 * WHT constant: 5% of paid professional service invoices (NTA 2025).
 * Returns only slices with value > 0 to avoid empty donut segments.
 */
export async function getTaxBreakdownSlices(
  userId: string,
  prisma: PrismaClient,
): Promise<TaxBreakdownSlice[]> {
  const forecast = await forecastQuarterlyTax(userId, prisma);

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const paidInvoices = await (prisma as any).invoice.findMany({
    where:  { userId, status: 'PAID', createdAt: { gte: startOfYear } },
    select: { amount: true },
  });

  // WHT 5% on gross invoice amounts (conservative proxy — NTA 2025)
  const whtRate = (NTA_2025 as any).WHT?.services ?? 0.05;
  const wht = Math.round(
    paidInvoices.reduce((s: number, i: any) => s + i.amount * whtRate, 0),
  );

  const slices: TaxBreakdownSlice[] = [
    { key: 'vat',     label: 'VAT',      value: forecast.breakdown.vat                  },
    { key: 'paye',    label: 'PAYE',     value: forecast.breakdown.pit                  },
    { key: 'devLevy', label: 'Dev Levy', value: forecast.breakdown.devLevy              },
    { key: 'wht',     label: 'WHT',      value: wht                                     },
    { key: 'cit',     label: 'CIT',      value: forecast.breakdown.cit ?? 0            },
  ];

  return slices.filter(s => s.value > 0);
}

// ─── F2: Spark Data (last 12 months revenue) ─────────────────────────────────

export interface SparkDatum {
  value:   number;
  flagged: boolean;
  label:   string;
}

/**
 * Buckets invoice revenue by calendar month for the last 12 months.
 * A month is "flagged" if it falls > 1.5σ below the rolling mean.
 * No Math.random — all arithmetic deterministic (C-08).
 */
export async function getSparkData(
  userId: string,
  prisma: PrismaClient,
): Promise<SparkDatum[]> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const invoices = await (prisma as any).invoice.findMany({
    where:  { userId, createdAt: { gte: twelveMonthsAgo } },
    select: { amount: true, createdAt: true },
  });

  // Build ordered month keys (YYYY-MM) oldest → newest
  const months: string[] = [];
  const buckets: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d   = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(key);
    buckets[key] = 0;
  }

  for (const inv of invoices) {
    const d   = new Date(inv.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key in buckets) buckets[key] += inv.amount;
  }

  const values = months.map(k => buckets[k]);
  const mean   = values.reduce((s, v) => s + v, 0) / (values.length || 1);
  const stdDev = Math.sqrt(
    values.map(v => (v - mean) ** 2).reduce((s, v) => s + v, 0) / (values.length || 1),
  );

  return months.map((key, i) => {
    const d     = new Date(key + '-01');
    const label = d.toLocaleString('en-NG', { month: 'short' });
    const v     = values[i];
    return {
      value:   v,
      flagged: stdDev > 0 && (mean - v) / stdDev > 1.5,
      label,
    };
  });
}

// ─── Deadline Utility ─────────────────────────────────────────────────────────

function getNextNRSDeadline(): string {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  // VAT monthly — due 21st of following month
  const vatDeadline = new Date(year, month + 1, 21);

  // PAYE monthly — due 10th of following month
  const payeDeadline = new Date(year, month + 1, 10);

  // Return the soonest
  const next = payeDeadline < vatDeadline ? payeDeadline : vatDeadline;
  return next.toISOString().split('T')[0];
}
