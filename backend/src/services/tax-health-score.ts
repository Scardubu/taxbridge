/**
 * Tax Health Score Engine — TaxBridge V3.0
 *
 * Computes a deterministic 0–100 score derived from 5 weighted components:
 *   filingTimeliness (30) + dataCompleteness (25) + complianceCalendar (20)
 *   + nrsSubmissions (15) + paymentHistory (10)
 *
 * Results are cached in Redis for 1 hour.
 *
 * CONSTRAINT: Prisma where/input params typed as `any` — see commit 218972e.
 */

import { createLogger } from '../lib/logger';
import { getRedisConnection } from '../queue/client';

const log = createLogger('tax-health-score');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaxHealthComponents {
  filingTimeliness:   number;   // max 30
  dataCompleteness:   number;   // max 25
  complianceCalendar: number;   // max 20
  nrsSubmissions:     number;   // max 15
  paymentHistory:     number;   // max 10
}

export type TaxHealthGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type TaxHealthTrend = 'improving' | 'stable' | 'declining';

export interface TaxHealthScore {
  score:    number;
  grade:    TaxHealthGrade;
  components: TaxHealthComponents;
  trend:    TaxHealthTrend;
  trendDelta: number;         // Δ vs 30 days ago
  topRecommendation: {
    en:     string;
    pidgin: string;
  };
  computedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToGrade(score: number): TaxHealthGrade {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 25) return 'poor';
  return 'critical';
}

const GRADE_LABEL_PIDGIN: Record<TaxHealthGrade, string> = {
  excellent: 'Tax Champion — You sabi am!',
  good:      'E good — small-small improve',
  fair:      'E dey go — do better',
  poor:      'E no good — fix am now',
  critical:  'WAHALA — do am now-now!',
};

function buildTopRecommendation(
  components: TaxHealthComponents,
): TaxHealthScore['topRecommendation'] {
  const lowestKey = (
    Object.entries(components) as [keyof TaxHealthComponents, number][]
  ).sort((a, b) => a[1] / maxScore(a[0]) - b[1] / maxScore(b[0]))[0][0];

  const recs: Record<keyof TaxHealthComponents, { en: string; pidgin: string }> = {
    filingTimeliness: {
      en:     'File your outstanding tax returns on time to avoid penalties.',
      pidgin: 'Submit your tax returns quick-quick — late filing penalty no good.',
    },
    dataCompleteness: {
      en:     'Categorise all uncategorised expenses to improve your compliance profile.',
      pidgin: 'Tag all your expenses — NRS like complete records.',
    },
    complianceCalendar: {
      en:     'Review your upcoming tax deadlines and prepare the required documents.',
      pidgin: 'Check your tax calendar — prepare everything before deadline reach.',
    },
    nrsSubmissions: {
      en:     'Submit all pending invoices to NRS for stamping to stay compliant.',
      pidgin: 'Submit your invoices to NRS for stamp — no leave them pending.',
    },
    paymentHistory: {
      en:     'Clear any outstanding tax payments to maintain a strong payment record.',
      pidgin: 'Pay your outstanding taxes — on-time payment improve your score.',
    },
  };

  return recs[lowestKey];
}

function maxScore(component: keyof TaxHealthComponents): number {
  const maxes: Record<keyof TaxHealthComponents, number> = {
    filingTimeliness:   30,
    dataCompleteness:   25,
    complianceCalendar: 20,
    nrsSubmissions:     15,
    paymentHistory:     10,
  };
  return maxes[component];
}

// ─── Service ──────────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

export class TaxHealthScoreService {
  constructor(private readonly prisma: any) {}

  async compute(businessId: string): Promise<TaxHealthScore> {
    const cacheKey = `tax-health:${businessId}`;

    try {
      const redis = getRedisConnection();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as TaxHealthScore;
      }

      const [
        filingTimeliness,
        dataCompleteness,
        complianceCalendar,
        nrsSubmissions,
        paymentHistory,
      ] = await Promise.all([
        this.scoreFilingTimeliness(businessId),
        this.scoreDataCompleteness(businessId),
        this.scoreComplianceCalendar(businessId),
        this.scoreNRSSubmissions(businessId),
        this.scorePaymentHistory(businessId),
      ]);

      const components: TaxHealthComponents = {
        filingTimeliness,
        dataCompleteness,
        complianceCalendar,
        nrsSubmissions,
        paymentHistory,
      };

      const score = Object.values(components).reduce((s, v) => s + v, 0);
      const grade = scoreToGrade(score);

      // Trend — compare to snapshot from 30 days ago if available
      const { trend, trendDelta } = await this.computeTrend(businessId, score);

      const result: TaxHealthScore = {
        score,
        grade,
        components,
        trend,
        trendDelta,
        topRecommendation: buildTopRecommendation(components),
        computedAt: new Date().toISOString(),
      };

      if (redis) {
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
      }

      log.info('Tax health score computed', { businessId, score, grade });
      return result;
    } catch (err: any) {
      log.error('Tax health score computation failed', { businessId, error: err?.message });
      // Graceful fallback
      return {
        score: 50,
        grade: 'fair',
        components: { filingTimeliness: 15, dataCompleteness: 12, complianceCalendar: 10, nrsSubmissions: 8, paymentHistory: 5 },
        trend: 'stable',
        trendDelta: 0,
        topRecommendation: { en: 'Complete your tax profile for a personalised score.', pidgin: 'Fill your tax profile make we calculate your score.' },
        computedAt: new Date().toISOString(),
      };
    }
  }

  // ── Component scorers ────────────────────────────────────────────────────────

  /** Filing timeliness: max 30 pts */
  private async scoreFilingTimeliness(businessId: string): Promise<number> {
    try {
      const filings = await this.prisma.taxFiling?.findMany?.({
        where: { businessId } as any,
        orderBy: { dueDate: 'desc' } as any,
        take: 12,
      }) ?? [];

      if (filings.length === 0) return 22; // No history — assume on-time

      const lateCount = filings.filter((f: any) => {
        const filed = f.filedAt ? new Date(f.filedAt) : null;
        const due   = new Date(f.dueDate);
        return !filed || filed > due;
      }).length;

      const lateVatOrCit = filings.filter((f: any) => {
        const isImportant = ['VAT', 'CIT'].includes(f.taxType?.toUpperCase());
        const filed = f.filedAt ? new Date(f.filedAt) : null;
        const due   = new Date(f.dueDate);
        return isImportant && (!filed || filed > due);
      }).length;

      if (lateCount === 0) return 30;
      if (lateVatOrCit >= 2) return 5;
      if (lateVatOrCit === 1) return 15;
      if (lateCount === 1) return 22;
      return 5;
    } catch {
      return 15;
    }
  }

  /** Data completeness: max 25 pts — % of expenses categorised */
  private async scoreDataCompleteness(businessId: string): Promise<number> {
    try {
      const since90d = new Date(Date.now() - 90 * 86_400_000);
      const [total, categorised] = await Promise.all([
        this.prisma.expense.count({ where: { businessId, createdAt: { gte: since90d } } as any }),
        this.prisma.expense.count({ where: { businessId, createdAt: { gte: since90d }, category: { not: null } } as any }),
      ]);

      if (total === 0) return 25;
      const pct = categorised / total;

      if (pct >= 0.95) return 25;
      if (pct >= 0.80) return 20;
      if (pct >= 0.60) return 14;
      if (pct >= 0.40) return 8;
      return 4;
    } catch {
      return 15;
    }
  }

  /** Compliance calendar: max 20 pts — are upcoming deadlines prepared? */
  private async scoreComplianceCalendar(businessId: string): Promise<number> {
    try {
      const next30d = new Date(Date.now() + 30 * 86_400_000);
      const upcoming = await this.prisma.taxLiability?.findMany?.({
        where: { businessId, dueDate: { lte: next30d }, status: 'outstanding' } as any,
      }) ?? [];

      if (upcoming.length === 0) return 20; // No imminent deadlines
      if (upcoming.length === 1) return 14;
      if (upcoming.length === 2) return 8;
      return 4;
    } catch {
      return 15;
    }
  }

  /** NRS submissions: max 15 pts — invoice stamp rate */
  private async scoreNRSSubmissions(businessId: string): Promise<number> {
    try {
      const since90d = new Date(Date.now() - 90 * 86_400_000);
      const [total, stamped] = await Promise.all([
        this.prisma.invoice.count({ where: { businessId, createdAt: { gte: since90d } } as any }),
        this.prisma.invoice.count({ where: { businessId, createdAt: { gte: since90d }, status: 'stamped' } as any }),
      ]);

      if (total === 0) return 15;
      const pct = stamped / total;

      if (pct >= 0.97) return 15;
      if (pct >= 0.90) return 12;
      if (pct >= 0.75) return 8;
      if (pct >= 0.50) return 4;
      return 1;
    } catch {
      return 10;
    }
  }

  /** Payment history: max 10 pts — on-time tax payment rate */
  private async scorePaymentHistory(businessId: string): Promise<number> {
    try {
      const liabilities = await this.prisma.taxLiability?.findMany?.({
        where: { businessId, status: 'paid' } as any,
        take: 20,
        orderBy: { dueDate: 'desc' } as any,
      }) ?? [];

      if (liabilities.length === 0) return 10;

      const onTime = liabilities.filter((l: any) => {
        const paid = l.paidAt ? new Date(l.paidAt) : null;
        const due  = new Date(l.dueDate);
        return paid && paid <= due;
      }).length;

      const rate = onTime / liabilities.length;

      if (rate >= 0.95) return 10;
      if (rate >= 0.80) return 7;
      if (rate >= 0.60) return 4;
      return 1;
    } catch {
      return 7;
    }
  }

  private async computeTrend(
    businessId: string,
    currentScore: number,
  ): Promise<{ trend: TaxHealthTrend; trendDelta: number }> {
    try {
      const redis = getRedisConnection();
      const snapshotKey = `tax-health:snapshot:${businessId}`;

      if (!redis) return { trend: 'stable', trendDelta: 0 };

      const snapshot = await redis.get(snapshotKey);
      if (!snapshot) {
        // Store current score as baseline for next comparison
        await redis.setex(snapshotKey, 30 * 24 * 3600, String(currentScore));
        return { trend: 'stable', trendDelta: 0 };
      }

      const previousScore = Number(snapshot);
      const delta = currentScore - previousScore;

      let trend: TaxHealthTrend = 'stable';
      if (delta >= 3)  trend = 'improving';
      if (delta <= -3) trend = 'declining';

      return { trend, trendDelta: delta };
    } catch {
      return { trend: 'stable', trendDelta: 0 };
    }
  }
}
