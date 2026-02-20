type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

type Anomaly = {
  type: string;
  severity: Severity;
  message: string;
  expenseId?: string;
};

export class AIInsightsService {
  constructor(private prisma: any) {}

  async detectExpenseAnomalies(businessId: string, periodDays = 90): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const since = new Date(Date.now() - periodDays * 86400000);

    const expenses = await this.prisma.expense.findMany({
      where: { businessId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });

    if (expenses.length < 3) return anomalies;

    const amountMap = new Map<number, any[]>();
    for (const expense of expenses) {
      const key = Math.round(Number(expense.amount) * 100);
      if (!amountMap.has(key)) amountMap.set(key, []);
      amountMap.get(key)!.push(expense);
    }

    for (const [, group] of amountMap) {
      if (group.length >= 3) {
        anomalies.push({
          type: 'DUPLICATE_AMOUNT',
          severity: group.length >= 5 ? 'HIGH' : 'MEDIUM',
          message: `₦${Number(group[0].amount).toLocaleString('en-NG')} appears ${group.length}× — possible duplicate entries`,
          expenseId: group[0].id,
        });
      }
    }

    const amounts = expenses.map((e: any) => Number(e.amount));
    const mean = amounts.reduce((sum: number, value: number) => sum + value, 0) / amounts.length;
    const variance = amounts
      .map((value: number) => (value - mean) ** 2)
      .reduce((sum: number, value: number) => sum + value, 0) / amounts.length;
    const std = Math.sqrt(variance);

    for (const expense of expenses as any[]) {
      const amount = Number(expense.amount);
      const z = std > 0 ? Math.abs((amount - mean) / std) : 0;
      if (z > 2.5) {
        anomalies.push({
          type: 'UNUSUAL_SPIKE',
          severity: z > 3.5 ? 'HIGH' : 'MEDIUM',
          message: `₦${amount.toLocaleString('en-NG')} is ${z.toFixed(1)}σ above your average spend`,
          expenseId: expense.id,
        });
      }
    }

    for (const expense of expenses as any[]) {
      const amount = Number(expense.amount);
      const vatAmount = expense.vatAmount != null ? Number(expense.vatAmount) : null;
      if (vatAmount && amount > 0) {
        const expectedVat = (amount / 1.075) * 0.075;
        const diff = Math.abs((vatAmount - expectedVat) / expectedVat);
        if (diff > 0.05) {
          anomalies.push({
            type: 'VAT_MISMATCH',
            severity: diff > 0.2 ? 'HIGH' : 'MEDIUM',
            message: `VAT ₦${vatAmount.toLocaleString('en-NG')} doesn't match expected ₦${expectedVat.toFixed(2)} at 7.5% NTA rate`,
            expenseId: expense.id,
          });
        }
      }
    }

    const severityRank: Record<Severity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const deduped = new Map<string, Anomaly>();
    for (const anomaly of anomalies) {
      const key = anomaly.expenseId || anomaly.type;
      const existing = deduped.get(key);
      if (!existing || severityRank[anomaly.severity] > severityRank[existing.severity]) {
        deduped.set(key, anomaly);
      }
    }

    return Array.from(deduped.values()).sort(
      (a, b) => severityRank[b.severity] - severityRank[a.severity]
    );
  }

  async predictTaxLiabilities(businessId: string) {
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

    const [income, expenses] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { businessId, status: 'PAID', updatedAt: { gte: quarterStart } },
        _sum: { totalAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { businessId, createdAt: { gte: quarterStart } },
        _sum: { amount: true },
      }),
    ]);

    const quarterlyRevenue = Number(income._sum?.totalAmount || 0);
    const quarterlyExpenses = Number(expenses._sum?.amount || 0);
    const annualizedRevenue = quarterlyRevenue * 4;
    const taxableProfit = Math.max(0, quarterlyRevenue - quarterlyExpenses);

    const citRate = annualizedRevenue > 100_000_000 ? 0.3 : annualizedRevenue > 25_000_000 ? 0.2 : 0;

    const vatOwed = quarterlyRevenue * 0.075;
    const citOwed = taxableProfit * citRate;
    const devLevyOwed = quarterlyRevenue * 0.04;

    const vatDue = new Date();
    vatDue.setDate(21);
    if (vatDue <= now) vatDue.setMonth(vatDue.getMonth() + 1);

    const citDue = new Date(now.getFullYear(), 5, 30);
    if (citDue <= now) citDue.setFullYear(citDue.getFullYear() + 1);

    const recommendations: string[] = [];
    if (citRate === 0) {
      recommendations.push('SME CIT exemption applies (revenue <₦25M) — verify SMEDAN registration is current');
    }
    if (annualizedRevenue > 25_000_000) {
      recommendations.push('Digital income above ₦25M — Digital Services Tax (2% EDT) may apply on digital revenue');
    }
    if (vatOwed > 500_000) {
      recommendations.push('High VAT liability detected — file input VAT credits to offset output VAT and reduce cash outflow');
    }
    if (quarterlyRevenue > 0 && quarterlyExpenses / quarterlyRevenue < 0.2) {
      recommendations.push('Low expense ratio this quarter — ensure all deductible expenses are captured before filing');
    }
    recommendations.push('Retain receipts and invoice records for statutory compliance and audits.');

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

  async getCashFlowRiskScore(businessId: string) {
    const { revenue, predictions } = await this.predictTaxLiabilities(businessId);
    const monthlyRevenue = revenue / 3;
    const ratio = monthlyRevenue > 0 ? predictions.total / monthlyRevenue : 1;
    const score = Math.min(100, Math.round(ratio * 100));

    const factors = [
      ratio > 0.5 ? 'Total tax burden exceeds 50% of monthly revenue' : null,
      predictions.vat.amount > monthlyRevenue * 0.25 ? `VAT liability ₦${predictions.vat.amount.toLocaleString('en-NG')} is high relative to revenue` : null,
      predictions.cit.amount > 0 ? `CIT liability ₦${predictions.cit.amount.toLocaleString('en-NG')}` : null,
      monthlyRevenue === 0 ? 'No paid revenue recorded this quarter' : null,
    ].filter(Boolean) as string[];

    return {
      score,
      risk: (score < 30 ? 'LOW' : score < 60 ? 'MEDIUM' : 'HIGH') as Severity,
      factors,
    };
  }
}
