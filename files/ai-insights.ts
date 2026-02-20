import type { PrismaClient } from '@prisma/client';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

interface Anomaly {
  type: string;
  severity: Severity;
  message: string;
  expenseId?: string;
}

interface TaxPrediction {
  revenue: number;
  predictions: {
    vat: { amount: number; dueDate: string; rate: number };
    cit: { amount: number; dueDate: string; rate: number };
    devLevy: { amount: number; dueDate: string; rate: number };
    total: number;
  };
  recommendations: string[];
}

interface CashFlowRisk {
  score: number;
  risk: Severity;
  factors: string[];
}

export class AIInsightsService {
  constructor(private prisma: PrismaClient) {}

  // ─── Anomaly Detection ──────────────────────────────────────────────────────

  async detectExpenseAnomalies(
    businessId: string,
    periodDays = 90
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const since = new Date(Date.now() - periodDays * 86_400_000);

    const expenses = await (this.prisma as any).expense.findMany({
      where: { businessId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' as const },
    });

    if (expenses.length < 3) return anomalies;

    // 1. Duplicate amount detection (same amount ≥3× in period)
    const amountMap = new Map<number, typeof expenses>();
    for (const exp of expenses) {
      const key = Math.round(exp.amount * 100);
      if (!amountMap.has(key)) amountMap.set(key, []);
      amountMap.get(key)!.push(exp);
    }
    for (const [, group] of amountMap) {
      if (group.length >= 3) {
        anomalies.push({
          type: 'DUPLICATE_AMOUNT',
          severity: group.length >= 5 ? 'HIGH' : 'MEDIUM',
          message: `₦${group[0].amount.toLocaleString('en-NG')} appears ${group.length}× — possible duplicate entries`,
          expenseId: group[0].id,
        });
      }
    }

    // 2. Z-score spike detection (threshold: 2.5σ)
    const amounts = expenses.map((e: any) => e.amount as number);
    const mean = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
    const variance =
      amounts.map((a: number) => (a - mean) ** 2).reduce((a: number, b: number) => a + b, 0) /
      amounts.length;
    const std = Math.sqrt(variance);

    for (const exp of expenses as any[]) {
      const z = std > 0 ? Math.abs((exp.amount - mean) / std) : 0;
      if (z > 2.5) {
        anomalies.push({
          type: 'UNUSUAL_SPIKE',
          severity: z > 3.5 ? 'HIGH' : 'MEDIUM',
          message: `₦${exp.amount.toLocaleString('en-NG')} is ${z.toFixed(1)}σ above your average spend`,
          expenseId: exp.id,
        });
      }
    }

    // 3. VAT mismatch detection (NTA 2025: 7.5%)
    for (const exp of expenses as any[]) {
      if (exp.vatAmount && exp.amount > 0) {
        const expectedVat = (exp.amount / 1.075) * 0.075;
        const diff = Math.abs((exp.vatAmount - expectedVat) / expectedVat);
        if (diff > 0.05) {
          anomalies.push({
            type: 'VAT_MISMATCH',
            severity: diff > 0.2 ? 'HIGH' : 'MEDIUM',
            message: `VAT ₦${exp.vatAmount.toLocaleString('en-NG')} doesn't match expected ₦${expectedVat.toFixed(2)} at 7.5% NTA rate`,
            expenseId: exp.id,
          });
        }
      }
    }

    // De-duplicate by expenseId — keep highest severity
    const severityRank: Record<Severity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const seen = new Map<string, Anomaly>();
    for (const a of anomalies) {
      const key = a.expenseId ?? a.type;
      const existing = seen.get(key);
      if (!existing || severityRank[a.severity] > severityRank[existing.severity]) {
        seen.set(key, a);
      }
    }

    return Array.from(seen.values()).sort(
      (a, b) => severityRank[b.severity] - severityRank[a.severity]
    );
  }

  // ─── Tax Prediction ─────────────────────────────────────────────────────────

  async predictTaxLiabilities(businessId: string): Promise<TaxPrediction> {
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const [income, expenses] = await Promise.all([
      (this.prisma as any).invoice.aggregate({
        where: { businessId, status: 'PAID', updatedAt: { gte: quarterStart } },
        _sum: { totalAmount: true },
      }),
      (this.prisma as any).expense.aggregate({
        where: { businessId, createdAt: { gte: quarterStart } },
        _sum: { amount: true },
      }),
    ]);

    const quarterlyRevenue = (income._sum?.totalAmount as number) ?? 0;
    const quarterlyExpenses = (expenses._sum?.amount as number) ?? 0;
    const annualizedRevenue = quarterlyRevenue * 4;
    const taxableProfit = Math.max(0, quarterlyRevenue - quarterlyExpenses);

    // NTA 2025 CIT tiers: 0% (<₦25M), 20% (₦25M–₦100M), 30% (>₦100M)
    const citRate =
      annualizedRevenue > 100_000_000 ? 0.3 : annualizedRevenue > 25_000_000 ? 0.2 : 0;

    const vatOwed = quarterlyRevenue * 0.075;
    const citOwed = taxableProfit * citRate;
    const devLevyOwed = quarterlyRevenue * 0.04; // Development Levy 4%

    // Due dates per NTA 2025
    const vatDue = new Date();
    vatDue.setDate(21);
    if (vatDue <= now) vatDue.setMonth(vatDue.getMonth() + 1);

    const citDue = new Date(now.getFullYear(), 5, 30); // June 30
    if (citDue <= now) citDue.setFullYear(citDue.getFullYear() + 1);

    const recommendations: string[] = [];

    if (citRate === 0) {
      recommendations.push(
        'SME CIT exemption applies (revenue <₦25M) — verify SMEDAN registration is current'
      );
    }
    if (annualizedRevenue > 25_000_000) {
      recommendations.push(
        'Digital income above ₦25M — Digital Services Tax (2% EDT) may apply on digital revenue'
      );
    }
    if (vatOwed > 500_000) {
      recommendations.push(
        'High VAT liability detected — file input VAT credits to offset output VAT and reduce cash outflow'
      );
    }
    if (quarterlyExpenses / quarterlyRevenue < 0.2 && quarterlyRevenue > 0) {
      recommendations.push(
        'Low expense ratio this quarter — ensure all deductible expenses are captured before filing'
      );
    }
    recommendations.push(
      'Retain all receipts for 6 years per FIRS requirements — OCR scans count as valid records'
    );

    return {
      revenue: quarterlyRevenue,
      predictions: {
        vat: { amount: vatOwed, dueDate: vatDue.toISOString(), rate: 0.075 },
        cit: { amount: citOwed, dueDate: citDue.toISOString(), rate: citRate },
        devLevy: { amount: devLevyOwed, dueDate: citDue.toISOString(), rate: 0.04 },
        total: vatOwed + citOwed + devLevyOwed,
      },
      recommendations,
    };
  }

  // ─── Cash Flow Risk ─────────────────────────────────────────────────────────

  async getCashFlowRiskScore(businessId: string): Promise<CashFlowRisk> {
    const { revenue, predictions } = await this.predictTaxLiabilities(businessId);
    const monthlyRevenue = revenue / 3;
    const ratio = monthlyRevenue > 0 ? predictions.total / monthlyRevenue : 1;
    const rawScore = Math.min(100, Math.round(ratio * 100));

    const factors: string[] = [];
    if (ratio > 0.5)
      factors.push('Total tax burden exceeds 50% of monthly revenue');
    if (predictions.vat.amount > monthlyRevenue * 0.25)
      factors.push(`VAT liability ₦${predictions.vat.amount.toLocaleString('en-NG')} is high relative to revenue`);
    if (predictions.cit.amount > 0)
      factors.push(`CIT liability ₦${predictions.cit.amount.toLocaleString('en-NG')} due ${new Date(predictions.cit.dueDate).toLocaleDateString('en-NG')}`);
    if (monthlyRevenue === 0)
      factors.push('No revenue recorded this quarter — verify invoices are marked as paid');

    return {
      score: rawScore,
      risk: rawScore < 30 ? 'LOW' : rawScore < 60 ? 'MEDIUM' : 'HIGH',
      factors,
    };
  }

  // ─── Platform-wide aggregate (admin) ────────────────────────────────────────

  async getAggregateAnomalies(): Promise<{
    total: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  }> {
    // Fetch top 50 businesses by invoice count and aggregate anomalies
    const businesses = await (this.prisma as any).business.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' as const },
      select: { id: true },
    });

    let HIGH = 0;
    let MEDIUM = 0;
    let LOW = 0;

    await Promise.allSettled(
      businesses.map(async (b: { id: string }) => {
        const anomalies = await this.detectExpenseAnomalies(b.id, 30);
        for (const a of anomalies) {
          if (a.severity === 'HIGH') HIGH++;
          else if (a.severity === 'MEDIUM') MEDIUM++;
          else LOW++;
        }
      })
    );

    return { total: HIGH + MEDIUM + LOW, HIGH, MEDIUM, LOW };
  }
}
