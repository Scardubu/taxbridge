/**
 * Crypto & Digital Asset Tax Service (Phase 6)
 *
 * Manages cryptocurrency transactions and calculates Capital Gains Tax (CGT)
 * per NTA 2025 at 10% on net gains.
 *
 * Features:
 * - Transaction CRUD (buy, sell, trade, transfer)
 * - FIFO cost basis tracking
 * - CGT calculation per tax year
 * - Tax report generation
 * - Portfolio summary
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { CGT_RATE } from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';

const log = createLogger('crypto-tax-service');

// =============================================================================
// Types
// =============================================================================

export type CryptoTxType = 'buy' | 'sell' | 'trade' | 'transfer';

export interface CreateCryptoTxInput {
  businessId: string;
  type: CryptoTxType;
  asset: string;
  amount: number;
  priceNGN: number;
  costBasis?: number;
  platform?: string;
  txHash?: string;
  date: string; // ISO date
}

export interface CryptoTaxReport {
  taxYear: number;
  totalBuys: number;
  totalSells: number;
  totalBuyValue: number;
  totalSellValue: number;
  totalCostBasis: number;
  netGain: number;
  isLoss: boolean;
  cgtRate: number;
  cgtAmount: number;
  transactions: Array<{
    id: string;
    type: string;
    asset: string;
    amount: number;
    priceNGN: number;
    totalNGN: number;
    costBasis: number | null;
    gain: number | null;
    date: string;
    platform: string | null;
  }>;
  byAsset: Array<{
    asset: string;
    totalBought: number;
    totalSold: number;
    buyValue: number;
    sellValue: number;
    netGain: number;
  }>;
}

export interface PortfolioSummary {
  assets: Array<{
    asset: string;
    totalHeld: number;
    averageCost: number;
    totalCost: number;
    transactionCount: number;
  }>;
  totalInvested: number;
  transactionCount: number;
}

// =============================================================================
// Helper
// =============================================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// =============================================================================
// Service Class
// =============================================================================

export class CryptoTaxService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record a crypto transaction
   */
  async createTransaction(userId: string, input: CreateCryptoTxInput) {
    const business = await this.prisma.business.findFirst({
      where: { id: input.businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const date = new Date(input.date);
    const totalNGN = round2(input.amount * input.priceNGN);
    const taxYear = date.getFullYear();

    // For sells, auto-calculate cost basis using FIFO if not provided
    let costBasis = input.costBasis ?? null;
    if (input.type === 'sell' && costBasis === null) {
      costBasis = await this.calculateFIFOCostBasis(input.businessId, input.asset, input.amount);
    }

    const tx = await this.prisma.cryptoTransaction.create({
      data: {
        businessId: input.businessId,
        type: input.type,
        asset: input.asset.toUpperCase(),
        amount: input.amount,
        priceNGN: input.priceNGN,
        totalNGN,
        costBasis,
        platform: input.platform || null,
        txHash: input.txHash || null,
        date,
        taxYear,
      },
    });

    log.info('Crypto transaction recorded', {
      txId: tx.id,
      type: input.type,
      asset: input.asset,
      amount: input.amount,
      totalNGN,
    });

    return tx;
  }

  /**
   * List transactions with filters
   */
  async listTransactions(
    userId: string,
    businessId: string,
    filters: {
      asset?: string;
      type?: string;
      taxYear?: number;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { businessId };
    if (filters.asset) where.asset = filters.asset.toUpperCase();
    if (filters.type) where.type = filters.type;
    if (filters.taxYear) where.taxYear = filters.taxYear;

    const [transactions, total] = await Promise.all([
      this.prisma.cryptoTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cryptoTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        asset: t.asset,
        amount: Number(t.amount),
        priceNGN: Number(t.priceNGN),
        totalNGN: Number(t.totalNGN),
        costBasis: t.costBasis ? Number(t.costBasis) : null,
        platform: t.platform,
        txHash: t.txHash,
        date: t.date.toISOString(),
        taxYear: t.taxYear,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single transaction
   */
  async getTransaction(userId: string, txId: string) {
    const tx = await this.prisma.cryptoTransaction.findUnique({ where: { id: txId } });
    if (!tx) return null;

    const business = await this.prisma.business.findFirst({
      where: { id: tx.businessId, ownerId: userId },
    });
    if (!business) return null;

    return {
      id: tx.id,
      type: tx.type,
      asset: tx.asset,
      amount: Number(tx.amount),
      priceNGN: Number(tx.priceNGN),
      totalNGN: Number(tx.totalNGN),
      costBasis: tx.costBasis ? Number(tx.costBasis) : null,
      platform: tx.platform,
      txHash: tx.txHash,
      date: tx.date.toISOString(),
      taxYear: tx.taxYear,
    };
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(userId: string, txId: string) {
    const tx = await this.getTransaction(userId, txId);
    if (!tx) throw new Error('Transaction not found or access denied');

    await this.prisma.cryptoTransaction.delete({ where: { id: txId } });
    log.info('Crypto transaction deleted', { txId });
    return { deleted: true };
  }

  /**
   * Generate CGT tax report for a given tax year
   */
  async generateTaxReport(userId: string, businessId: string, taxYear: number): Promise<CryptoTaxReport> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const transactions = await this.prisma.cryptoTransaction.findMany({
      where: { businessId, taxYear },
      orderBy: { date: 'asc' },
    });

    let totalBuyValue = 0;
    let totalSellValue = 0;
    let totalCostBasis = 0;
    let totalBuys = 0;
    let totalSells = 0;

    // Per-asset tracking
    const assetMap = new Map<string, {
      totalBought: number;
      totalSold: number;
      buyValue: number;
      sellValue: number;
    }>();

    const txSummaries = transactions.map((t) => {
      const totalNGN = Number(t.totalNGN);
      const costBasis = t.costBasis ? Number(t.costBasis) : null;

      // Track per-asset
      if (!assetMap.has(t.asset)) {
        assetMap.set(t.asset, { totalBought: 0, totalSold: 0, buyValue: 0, sellValue: 0 });
      }
      const assetData = assetMap.get(t.asset)!;

      let gain: number | null = null;

      if (t.type === 'buy') {
        totalBuys++;
        totalBuyValue += totalNGN;
        assetData.totalBought += Number(t.amount);
        assetData.buyValue += totalNGN;
      } else if (t.type === 'sell') {
        totalSells++;
        totalSellValue += totalNGN;
        assetData.totalSold += Number(t.amount);
        assetData.sellValue += totalNGN;
        if (costBasis !== null) {
          gain = round2(totalNGN - costBasis);
          totalCostBasis += costBasis;
        }
      } else if (t.type === 'trade') {
        // Trades are treated as sell + buy; the sell side is taxable
        totalSells++;
        totalSellValue += totalNGN;
        assetData.totalSold += Number(t.amount);
        assetData.sellValue += totalNGN;
        if (costBasis !== null) {
          gain = round2(totalNGN - costBasis);
          totalCostBasis += costBasis;
        }
      }

      return {
        id: t.id,
        type: t.type,
        asset: t.asset,
        amount: Number(t.amount),
        priceNGN: Number(t.priceNGN),
        totalNGN,
        costBasis,
        gain,
        date: t.date.toISOString(),
        platform: t.platform,
      };
    });

    const netGain = round2(totalSellValue - totalCostBasis);
    const isLoss = netGain <= 0;
    const cgtAmount = isLoss ? 0 : round2(netGain * CGT_RATE);

    const byAsset = Array.from(assetMap.entries()).map(([asset, data]) => ({
      asset,
      totalBought: round2(data.totalBought),
      totalSold: round2(data.totalSold),
      buyValue: round2(data.buyValue),
      sellValue: round2(data.sellValue),
      netGain: round2(data.sellValue - data.buyValue),
    }));

    return {
      taxYear,
      totalBuys,
      totalSells,
      totalBuyValue: round2(totalBuyValue),
      totalSellValue: round2(totalSellValue),
      totalCostBasis: round2(totalCostBasis),
      netGain,
      isLoss,
      cgtRate: CGT_RATE,
      cgtAmount,
      transactions: txSummaries,
      byAsset,
    };
  }

  /**
   * Get portfolio summary (current holdings based on all-time transactions)
   */
  async getPortfolio(userId: string, businessId: string): Promise<PortfolioSummary> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const transactions = await this.prisma.cryptoTransaction.findMany({
      where: { businessId },
      orderBy: { date: 'asc' },
    });

    const holdings = new Map<string, { held: number; totalCost: number; txCount: number }>();

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      const totalNGN = Number(tx.totalNGN);

      if (!holdings.has(tx.asset)) {
        holdings.set(tx.asset, { held: 0, totalCost: 0, txCount: 0 });
      }
      const h = holdings.get(tx.asset)!;
      h.txCount++;

      if (tx.type === 'buy') {
        h.held += amount;
        h.totalCost += totalNGN;
      } else if (tx.type === 'sell') {
        h.held -= amount;
        // Reduce cost proportionally
        if (h.held > 0) {
          const avgCost = h.totalCost / (h.held + amount);
          h.totalCost -= avgCost * amount;
        } else {
          h.totalCost = 0;
        }
      } else if (tx.type === 'trade') {
        h.held -= amount;
        if (h.held > 0) {
          const avgCost = h.totalCost / (h.held + amount);
          h.totalCost -= avgCost * amount;
        } else {
          h.totalCost = 0;
        }
      }
      // transfers don't change cost basis
    }

    let totalInvested = 0;
    let transactionCount = 0;

    const assets = Array.from(holdings.entries())
      .filter(([, h]) => h.held > 0.00000001) // Filter dust
      .map(([asset, h]) => {
        totalInvested += h.totalCost;
        transactionCount += h.txCount;
        return {
          asset,
          totalHeld: round2(h.held),
          averageCost: h.held > 0 ? round2(h.totalCost / h.held) : 0,
          totalCost: round2(h.totalCost),
          transactionCount: h.txCount,
        };
      });

    return {
      assets,
      totalInvested: round2(totalInvested),
      transactionCount,
    };
  }

  // ===========================================================================
  // FIFO Cost Basis
  // ===========================================================================

  /**
   * Calculate cost basis using FIFO (First In, First Out) method
   */
  async calculateFIFOCostBasis(businessId: string, asset: string, sellAmount: number): Promise<number> {
    // Get all buy transactions for this asset, ordered by date (FIFO)
    const buys = await this.prisma.cryptoTransaction.findMany({
      where: { businessId, asset: asset.toUpperCase(), type: 'buy' },
      orderBy: { date: 'asc' },
    });

    // Get all previous sells to determine remaining lots
    const previousSells = await this.prisma.cryptoTransaction.findMany({
      where: { businessId, asset: asset.toUpperCase(), type: { in: ['sell', 'trade'] } },
      orderBy: { date: 'asc' },
    });

    // Build remaining lots from buys
    const lots: Array<{ amount: number; pricePerUnit: number }> = buys.map((b) => ({
      amount: Number(b.amount),
      pricePerUnit: Number(b.priceNGN),
    }));

    // Consume lots for previous sells
    let totalPreviousSold = previousSells.reduce((sum, s) => sum + Number(s.amount), 0);
    for (const lot of lots) {
      if (totalPreviousSold <= 0) break;
      const consumed = Math.min(lot.amount, totalPreviousSold);
      lot.amount -= consumed;
      totalPreviousSold -= consumed;
    }

    // Calculate cost basis for current sell using remaining lots
    let remaining = sellAmount;
    let costBasis = 0;

    for (const lot of lots) {
      if (remaining <= 0 || lot.amount <= 0) break;
      const consumed = Math.min(lot.amount, remaining);
      costBasis += consumed * lot.pricePerUnit;
      remaining -= consumed;
    }

    return round2(costBasis);
  }
}
