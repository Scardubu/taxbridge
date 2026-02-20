/**
 * Anomaly Detection Service — TaxBridge V3.0
 *
 * 9-signal anomaly engine with severity scoring, bilingual explanations,
 * and Redis caching. Integrates with the /api/v1/insights/anomalies endpoints.
 *
 * CONSTRAINT: All Prisma where/input parameters are typed as `any`.
 * DO NOT use Prisma namespace types (Prisma.XxxWhereInput etc.).
 * Reference: DEPLOYMENT_v1.0.3_COMPLETE.md, commit 218972e.
 */

import { createLogger } from '../lib/logger';
import { getRedisConnection } from '../queue/client';

const log = createLogger('anomaly-detection');

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnomalySignal =
  | 'duplicate_amount'          // Same amount from same vendor < 48h
  | 'zscore_spike'              // Amount > 3 std-devs from user mean
  | 'vat_mismatch'              // VAT claimed but vendor not NRS-registered / wrong rate
  | 'round_number_clustering'   // >60% of last 30 expenses are round numbers
  | 'weekend_business_expense'  // Nigerian Sunday business expense
  | 'rapid_succession'          // Same vendor, same amount, < 48h apart
  | 'phantom_vendor'            // TIN not verifiable
  | 'cashflow_cliff'            // 30-day projection shows tax deadline shortfall
  | 'vat_threshold_approach';   // Revenue approaching ₦100M VAT registration threshold

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyResult {
  id:                  string;
  signal:              AnomalySignal;
  severity:            AnomalySeverity;
  affectedRecordId:    string;
  affectedRecordType:  'expense' | 'invoice' | 'payment' | 'tax_liability';
  explanation: {
    en:     string;   // Plain English, max 2 sentences
    pidgin: string;   // Nigerian Pidgin, culturally authentic
  };
  recommendedAction: {
    en:     string;
    pidgin: string;
  };
  regulatoryReference?: string;  // e.g. "NTA 2025 §47(2)(b)"
  confidence:  number;           // 0.0 – 1.0
  detectedAt:  Date;
  dismissed:   boolean;
  metadata:    Record<string, unknown>;
}

// ─── Severity Matrix ──────────────────────────────────────────────────────────
// Mirrors the table in the Master Prompt Module 1 spec exactly.

function scoreSeverity(
  signal:  AnomalySignal,
  amount:  number = 0,
  extra?:  { zScore?: number; percentage?: number; daysToDeadline?: number; revenue?: number },
): AnomalySeverity {
  switch (signal) {
    case 'duplicate_amount':
      if (amount > 5_000_000)  return 'critical';
      if (amount > 500_000)    return 'high';
      return 'low';

    case 'zscore_spike': {
      const z = extra?.zScore ?? 0;
      if (z > 6) return 'critical';
      if (z > 4) return 'high';
      return 'medium';
    }

    case 'vat_mismatch':
      if (amount > 1_000_000) return 'critical';
      return 'high';

    case 'round_number_clustering': {
      const pct = extra?.percentage ?? 0;
      if (pct > 0.75) return 'medium';
      return 'low';
    }

    case 'weekend_business_expense':
      if (amount > 200_000) return 'medium';
      return 'low';

    case 'rapid_succession':
      if (amount > 10_000_000) return 'critical';
      if (amount > 1_000_000)  return 'high';
      return 'medium';

    case 'phantom_vendor':
      if (amount > 500_000) return 'critical';
      return 'high';

    case 'cashflow_cliff': {
      const days = extra?.daysToDeadline ?? 30;
      if (days < 7)  return 'critical';
      return 'high';
    }

    case 'vat_threshold_approach': {
      const rev = extra?.revenue ?? 0;
      if (rev > 95_000_000) return 'critical';
      if (rev > 80_000_000) return 'medium';
      return 'low';
    }
  }
}

// ─── Explanation Templates ─────────────────────────────────────────────────────

function buildExplanation(
  signal:  AnomalySignal,
  meta:    Record<string, unknown>,
): AnomalyResult['explanation'] {
  const amt = meta.amount ? `₦${Number(meta.amount).toLocaleString('en-NG')}` : '';

  const map: Record<AnomalySignal, { en: string; pidgin: string }> = {
    duplicate_amount: {
      en:     `An expense of ${amt} appears to have been recorded more than once within 48 hours. Please verify this is not a duplicate entry.`,
      pidgin: `Abi you pay ${amt} twice? Check am — e dey appear more than once for 48 hours.`,
    },
    zscore_spike: {
      en:     `This expense of ${amt} is unusually high compared to your normal spending pattern. It may warrant a second review.`,
      pidgin: `This expense of ${amt} too much pass your normal spending — make you check am well-well.`,
    },
    vat_mismatch: {
      en:     `The VAT amount claimed does not match the expected 7.5% NRS rate. This may cause issues during a tax audit.`,
      pidgin: `Your VAT no correct — e no follow the 7.5% NRS rate. Fix am before NRS wahala reach you.`,
    },
    round_number_clustering: {
      en:     `More than 60% of your recent expenses are suspiciously round numbers. This pattern can flag your records for NRS scrutiny.`,
      pidgin: `Too many of your expenses na round number — e fit cause NRS to investigate your records.`,
    },
    weekend_business_expense: {
      en:     `A business expense of ${amt} was recorded on a Sunday. Nigerian tax authorities may question weekend business expenses.`,
      pidgin: `You record business expense of ${amt} on Sunday. NRS fit ask question — be careful.`,
    },
    rapid_succession: {
      en:     `Multiple expenses of similar amounts were made to the same vendor within 48 hours. This pattern may indicate duplicated billing.`,
      pidgin: `You pay the same vendor plenty times by ${amt} within 48 hours — double-check say e no be mistake.`,
    },
    phantom_vendor: {
      en:     `The TIN for this vendor could not be verified against the NRS registry. Expenses from unregistered vendors carry higher audit risk.`,
      pidgin: `We no fit find this vendor TIN for NRS registry — unregistered vendor dey risky for tax audit.`,
    },
    cashflow_cliff: {
      en:     `Your projected cash flow suggests you may not have sufficient funds to cover an upcoming tax deadline.`,
      pidgin: `Your money project show say you fit no get enough cash for the tax deadline wey dey come — plan ahead.`,
    },
    vat_threshold_approach: {
      en:     `Your revenue is approaching the ₦100M threshold above which VAT registration becomes mandatory under NTA 2025.`,
      pidgin: `Your revenue dey near ₦100M — once e cross am, you must register for VAT under NTA 2025.`,
    },
  };

  return map[signal];
}

function buildRecommendedAction(signal: AnomalySignal): AnomalyResult['recommendedAction'] {
  const map: Record<AnomalySignal, { en: string; pidgin: string }> = {
    duplicate_amount:          { en: 'Review the expense records and delete any duplicates.', pidgin: 'Check your expense list and remove the extra one.' },
    zscore_spike:              { en: 'Confirm this expense has a receipt and matches a legitimate business purpose.', pidgin: 'Make sure you get receipt for this expense and e dey valid.' },
    vat_mismatch:              { en: 'Recalculate VAT at 7.5% and issue a corrected invoice if necessary.', pidgin: 'Recalculate your VAT at 7.5% and correct the invoice.' },
    round_number_clustering:   { en: 'Ensure all expenses are recorded with exact amounts and proper receipts.', pidgin: 'Record exact amounts — no estimates — and get receipts for everything.' },
    weekend_business_expense:  { en: 'Attach supporting documentation confirming the business purpose of this expense.', pidgin: 'Get document to explain why this Sunday expense na for business.' },
    rapid_succession:          { en: 'Contact the vendor to confirm each transaction is for a distinct service or delivery.', pidgin: 'Contact the vendor confirm say each payment na for different thing.' },
    phantom_vendor:            { en: 'Verify the vendor\'s TIN on the NRS portal and request an updated invoice.', pidgin: 'Check vendor TIN for NRS portal and ask for correct invoice.' },
    cashflow_cliff:            { en: 'Set aside funds now or arrange a payment plan with NRS before the deadline.', pidgin: 'Save money now or arrange payment plan with NRS before deadline reach.' },
    vat_threshold_approach:    { en: 'Consult your accountant and prepare to register for VAT when revenue exceeds ₦100M.', pidgin: 'Talk to your accountant and prepare for VAT registration when revenue reach ₦100M.' },
  };

  return map[signal];
}

const REGULATORY_REFS: Partial<Record<AnomalySignal, string>> = {
  vat_mismatch:           'NTA 2025 §11(1)',
  phantom_vendor:         'NTA 2025 §47(2)(b)',
  vat_threshold_approach: 'NTA 2025 §5(1)',
  cashflow_cliff:         'NTA 2025 §11(1), §41',
};

// ─── Main Service ─────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

export class AnomalyDetectionService {
  constructor(private readonly prisma: any) {}

  // ── 1. Duplicate amount ──────────────────────────────────────────────────────

  private async detectDuplicateAmounts(
    businessId: string,
    expenses: any[],
  ): Promise<AnomalyResult[]> {
    const results: AnomalyResult[] = [];
    const window48h = 48 * 60 * 60 * 1000;

    const byVendorAmount = new Map<string, any[]>();
    for (const e of expenses) {
      const key = `${e.vendorName ?? 'unknown'}:${Math.round(Number(e.amount) * 100)}`;
      if (!byVendorAmount.has(key)) byVendorAmount.set(key, []);
      byVendorAmount.get(key)!.push(e);
    }

    for (const [, group] of byVendorAmount) {
      if (group.length < 2) continue;
      const sorted = group.sort((a: any, b: any) => +new Date(a.createdAt) - +new Date(b.createdAt));
      for (let i = 1; i < sorted.length; i++) {
        const diff = +new Date(sorted[i].createdAt) - +new Date(sorted[i - 1].createdAt);
        if (diff <= window48h) {
          const amount = Number(sorted[i].amount);
          results.push(this.buildResult('duplicate_amount', sorted[i].id, 'expense', amount, {
            vendorName: sorted[i].vendorName,
            previousId: sorted[i - 1].id,
            timeDiffHours: +(diff / 3_600_000).toFixed(1),
          }));
        }
      }
    }
    return results;
  }

  // ── 2. Z-score spike ─────────────────────────────────────────────────────────

  private detectZScoreSpikes(expenses: any[]): AnomalyResult[] {
    const results: AnomalyResult[] = [];
    if (expenses.length < 5) return results;

    const amounts = expenses.map(e => Number(e.amount));
    const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const std  = Math.sqrt(amounts.map(v => (v - mean) ** 2).reduce((s, v) => s + v, 0) / amounts.length);
    if (std === 0) return results;

    for (const e of expenses) {
      const amount = Number(e.amount);
      const z = Math.abs((amount - mean) / std);
      if (z > 3) {
        results.push(this.buildResult('zscore_spike', e.id, 'expense', amount, {
          zScore: +z.toFixed(2), mean: +mean.toFixed(2), std: +std.toFixed(2),
        }, z));
      }
    }
    return results;
  }

  // ── 3. VAT mismatch ──────────────────────────────────────────────────────────

  private detectVATMismatches(expenses: any[]): AnomalyResult[] {
    const results: AnomalyResult[] = [];
    const VAT_RATE = 0.075;

    for (const e of expenses) {
      const amount    = Number(e.amount);
      const vatAmount = e.vatAmount != null ? Number(e.vatAmount) : null;
      if (!vatAmount || amount <= 0) continue;

      const expectedVat = (amount / (1 + VAT_RATE)) * VAT_RATE;
      const diff = Math.abs((vatAmount - expectedVat) / expectedVat);
      if (diff > 0.05) {
        results.push(this.buildResult('vat_mismatch', e.id, 'expense', amount, {
          claimedVAT: vatAmount, expectedVAT: +expectedVat.toFixed(2), diffPct: +(diff * 100).toFixed(1),
        }));
      }
    }
    return results;
  }

  // ── 4. Round-number clustering ────────────────────────────────────────────────

  private detectRoundNumberClustering(businessId: string, expenses: any[]): AnomalyResult[] {
    const slice = expenses.slice(0, 30);
    if (slice.length < 10) return [];

    const roundCount = slice.filter(e => Number(e.amount) % 1000 === 0).length;
    const pct = roundCount / slice.length;
    if (pct <= 0.6) return [];

    // Return a single record-level anomaly attached to the business entity
    const severity = scoreSeverity('round_number_clustering', 0, { percentage: pct });
    const explanation = buildExplanation('round_number_clustering', { percentage: pct });
    const action = buildRecommendedAction('round_number_clustering');

    return [{
      id:                 `rn-${businessId}-${Date.now()}`,
      signal:             'round_number_clustering',
      severity,
      affectedRecordId:   businessId,
      affectedRecordType: 'expense',
      explanation,
      recommendedAction:  action,
      confidence:         Math.min(0.95, pct),
      detectedAt:         new Date(),
      dismissed:          false,
      metadata:           { roundPercentage: +(pct * 100).toFixed(1), out_of: slice.length },
    }];
  }

  // ── 5. Weekend business expense ───────────────────────────────────────────────

  private detectWeekendExpenses(expenses: any[]): AnomalyResult[] {
    const results: AnomalyResult[] = [];
    // Sunday = 0 in JS Date (Nigerian cultural context: Sunday is rest day)
    for (const e of expenses) {
      const day = new Date(e.createdAt).getDay();
      if (day === 0 && Number(e.amount) > 10_000) {
        const amount = Number(e.amount);
        results.push(this.buildResult('weekend_business_expense', e.id, 'expense', amount, {
          dayOfWeek: 'Sunday', expenseDate: e.createdAt,
        }));
      }
    }
    return results;
  }

  // ── 6. Rapid succession ───────────────────────────────────────────────────────

  private detectRapidSuccession(expenses: any[]): AnomalyResult[] {
    const results: AnomalyResult[] = [];
    const window48h = 48 * 60 * 60 * 1000;

    const byVendor = new Map<string, any[]>();
    for (const e of expenses) {
      const vendor = e.vendorName?.toLowerCase() ?? 'unknown';
      if (!byVendor.has(vendor)) byVendor.set(vendor, []);
      byVendor.get(vendor)!.push(e);
    }

    for (const [vendor, group] of byVendor) {
      if (group.length < 2) continue;
      const sorted = group.sort((a: any, b: any) => +new Date(a.createdAt) - +new Date(b.createdAt));
      const totalInWindow = sorted.filter((_: any, i: number) => {
        if (i === 0) return false;
        return +new Date(sorted[i].createdAt) - +new Date(sorted[i - 1].createdAt) <= window48h;
      });

      if (totalInWindow.length >= 2) {
        const total = totalInWindow.reduce((s: number, e: any) => s + Number(e.amount), 0);
        results.push(this.buildResult('rapid_succession', sorted[0].id, 'expense', total, {
          vendor, count: totalInWindow.length, totalAmount: total,
        }));
      }
    }
    return results;
  }

  // ── 7. Phantom vendor ─────────────────────────────────────────────────────────
  // NOTE: Youverify CAC lookup is async — we flag expenses where vendorTIN exists
  // but cannot be pattern-validated (basic TIN format check).

  private detectPhantomVendors(expenses: any[]): AnomalyResult[] {
    const results: AnomalyResult[] = [];
    const TIN_PATTERN = /^\d{8}-\d{4}$|^\d{10}$/;

    for (const e of expenses) {
      if (!e.vendorTIN) continue; // No TIN claimed — skip
      if (!TIN_PATTERN.test(e.vendorTIN)) {
        const amount = Number(e.amount);
        results.push(this.buildResult('phantom_vendor', e.id, 'expense', amount, {
          suppliedTIN: e.vendorTIN, vendorName: e.vendorName,
        }));
      }
    }
    return results;
  }

  // ── 8. Cashflow cliff ─────────────────────────────────────────────────────────

  private async detectCashflowCliff(businessId: string): Promise<AnomalyResult[]> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

      const [revenue, expenses, liabilities] = await Promise.all([
        this.prisma.invoice.aggregate({
          where: { businessId, status: 'PAID', updatedAt: { gte: thirtyDaysAgo } } as any,
          _sum: { totalAmount: true },
        }),
        this.prisma.expense.aggregate({
          where: { businessId, createdAt: { gte: thirtyDaysAgo } } as any,
          _sum: { amount: true },
        }),
        this.prisma.taxLiability?.findMany?.({
          where: { businessId, status: 'outstanding', dueDate: { lte: new Date(now.getTime() + 30 * 86_400_000) } } as any,
          orderBy: { dueDate: 'asc' } as any,
        }).catch(() => []),
      ]);

      const monthlyRevenue  = Number(revenue._sum?.totalAmount ?? 0);
      const monthlyExpenses = Number(expenses._sum?.amount ?? 0);
      const netCashflow     = monthlyRevenue - monthlyExpenses;

      if (!liabilities || liabilities.length === 0) return [];

      const upcomingLiability = liabilities[0];
      const liabilityAmount   = Number(upcomingLiability?.amount ?? 0);
      if (liabilityAmount === 0) return [];

      const daysToDeadline = Math.ceil(
        (new Date(upcomingLiability.dueDate).getTime() - now.getTime()) / 86_400_000,
      );

      if (netCashflow < liabilityAmount && daysToDeadline <= 30) {
        const severity = scoreSeverity('cashflow_cliff', liabilityAmount, { daysToDeadline });
        const explanation = buildExplanation('cashflow_cliff', { amount: liabilityAmount, daysToDeadline });
        const action = buildRecommendedAction('cashflow_cliff');

        return [{
          id:                 `cliff-${businessId}-${Date.now()}`,
          signal:             'cashflow_cliff',
          severity,
          affectedRecordId:   upcomingLiability.id ?? businessId,
          affectedRecordType: 'tax_liability',
          explanation,
          recommendedAction:  action,
          regulatoryReference: REGULATORY_REFS.cashflow_cliff,
          confidence:         0.8,
          detectedAt:         new Date(),
          dismissed:          false,
          metadata:           {
            daysToDeadline, liabilityAmount, netCashflow, projectedShortfall: liabilityAmount - netCashflow,
          },
        }];
      }
    } catch (err: any) {
      log.warn('Cashflow cliff detection failed', { error: err?.message });
    }
    return [];
  }

  // ── 9. VAT threshold approach ─────────────────────────────────────────────────

  private async detectVATThresholdApproach(businessId: string): Promise<AnomalyResult[]> {
    try {
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      const ytd = await this.prisma.invoice.aggregate({
        where: { businessId, status: 'PAID', updatedAt: { gte: yearStart } } as any,
        _sum: { totalAmount: true },
      });

      const annualRevenue = Number(ytd._sum?.totalAmount ?? 0);
      const VAT_THRESHOLD = 100_000_000;

      if (annualRevenue < 75_000_000) return []; // Not near threshold

      const severity    = scoreSeverity('vat_threshold_approach', 0, { revenue: annualRevenue });
      const explanation = buildExplanation('vat_threshold_approach', { revenue: annualRevenue });
      const action      = buildRecommendedAction('vat_threshold_approach');

      return [{
        id:                 `vat-thresh-${businessId}-${Date.now()}`,
        signal:             'vat_threshold_approach',
        severity,
        affectedRecordId:   businessId,
        affectedRecordType: 'tax_liability',
        explanation,
        recommendedAction:  action,
        regulatoryReference: REGULATORY_REFS.vat_threshold_approach,
        confidence:         0.95,
        detectedAt:         new Date(),
        dismissed:          false,
        metadata:           {
          ytdRevenue: annualRevenue, thresholdGap: VAT_THRESHOLD - annualRevenue,
          pctOfThreshold: +((annualRevenue / VAT_THRESHOLD) * 100).toFixed(1),
        },
      }];
    } catch (err: any) {
      log.warn('VAT threshold detection failed', { error: err?.message });
    }
    return [];
  }

  // ─── Orchestration ──────────────────────────────────────────────────────────

  /**
   * Run all 9 anomaly signals for the given businessId.
   * Results are cached in Redis for 15 minutes.
   * Always resolves — never throws.
   */
  async scanAll(businessId: string): Promise<AnomalyResult[]> {
    const cacheKey = `anomaly:scan:${businessId}`;

    try {
      const redis = getRedisConnection();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as AnomalyResult[];
      }

      const since90d = new Date(Date.now() - 90 * 86_400_000);
      const expenses: any[] = await this.prisma.expense.findMany({
        where:   { businessId, createdAt: { gte: since90d } } as any,
        orderBy: { createdAt: 'desc' } as any,
        take:    200,
      });

      const [
        cliffResults,
        vatThreshResults,
      ] = await Promise.all([
        this.detectCashflowCliff(businessId),
        this.detectVATThresholdApproach(businessId),
      ]);

      const syncResults: AnomalyResult[] = [
        ...(await this.detectDuplicateAmounts(businessId, expenses)),
        ...this.detectZScoreSpikes(expenses),
        ...this.detectVATMismatches(expenses),
        ...this.detectRoundNumberClustering(businessId, expenses),
        ...this.detectWeekendExpenses(expenses),
        ...this.detectRapidSuccession(expenses),
        ...this.detectPhantomVendors(expenses),
      ];

      // Deduplicate: keep highest-severity result per affected record
      const severityRank: Record<AnomalySeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      const deduped = new Map<string, AnomalyResult>();

      for (const r of [...syncResults, ...cliffResults, ...vatThreshResults]) {
        const key = `${r.signal}:${r.affectedRecordId}`;
        const existing = deduped.get(key);
        if (!existing || severityRank[r.severity] > severityRank[existing.severity]) {
          deduped.set(key, r);
        }
      }

      const sorted = [...deduped.values()].sort(
        (a, b) => severityRank[b.severity] - severityRank[a.severity],
      );

      if (redis) {
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(sorted));
      }

      log.info('Anomaly scan complete', { businessId, found: sorted.length });
      return sorted;
    } catch (err: any) {
      log.error('Anomaly scan failed', { businessId, error: err?.message });
      return [];
    }
  }

  /** Dismiss an anomaly result (mark as false positive). */
  async dismissAnomaly(anomalyId: string, businessId: string): Promise<boolean> {
    try {
      await this.prisma.anomalyRecord?.update?.({
        where: { id: anomalyId, businessId } as any,
        data:  { dismissed: true, dismissedAt: new Date() } as any,
      });
      // Invalidate cache
      const redis = getRedisConnection();
      if (redis) await redis.del(`anomaly:scan:${businessId}`);
      return true;
    } catch {
      return false;
    }
  }

  /** Summary counts by severity for dashboard widget. */
  async getSummary(businessId: string): Promise<Record<AnomalySeverity, number>> {
    const results = await this.scanAll(businessId);
    const active  = results.filter(r => !r.dismissed);
    return {
      critical: active.filter(r => r.severity === 'critical').length,
      high:     active.filter(r => r.severity === 'high').length,
      medium:   active.filter(r => r.severity === 'medium').length,
      low:      active.filter(r => r.severity === 'low').length,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private buildResult(
    signal:     AnomalySignal,
    recordId:   string,
    recordType: AnomalyResult['affectedRecordType'],
    amount:     number,
    metadata:   Record<string, unknown>,
    zScore?:    number,
  ): AnomalyResult {
    const severity    = scoreSeverity(signal, amount, { zScore });
    const explanation = buildExplanation(signal, { amount, ...metadata });
    const action      = buildRecommendedAction(signal);

    return {
      id:                 `${signal}-${recordId}-${Date.now()}`,
      signal,
      severity,
      affectedRecordId:   recordId,
      affectedRecordType: recordType,
      explanation,
      recommendedAction:  action,
      regulatoryReference: REGULATORY_REFS[signal],
      confidence:         severity === 'critical' ? 0.95 : severity === 'high' ? 0.85 : 0.70,
      detectedAt:         new Date(),
      dismissed:          false,
      metadata:           { amount, ...metadata },
    };
  }
}
