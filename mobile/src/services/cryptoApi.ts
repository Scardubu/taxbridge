/**
 * Crypto & Digital Asset Tax API Client (Phase 6)
 *
 * Mobile client for cryptocurrency transaction management and CGT calculation.
 */

import { api } from './api';

// =============================================================================
// Types
// =============================================================================

export type CryptoTxType = 'buy' | 'sell' | 'trade' | 'transfer';

export interface CryptoTransaction {
  id: string;
  type: CryptoTxType;
  asset: string;
  amount: number;
  priceNGN: number;
  totalNGN: number;
  costBasis: number | null;
  platform: string | null;
  txHash: string | null;
  date: string;
  taxYear: number;
}

export interface CreateCryptoTxInput {
  businessId: string;
  type: CryptoTxType;
  asset: string;
  amount: number;
  priceNGN: number;
  costBasis?: number;
  platform?: string;
  txHash?: string;
  date: string;
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

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// =============================================================================
// API Functions
// =============================================================================

export async function createTransaction(input: CreateCryptoTxInput): Promise<CryptoTransaction> {
  const res = await api.post('/crypto/transactions', input);
  return res.data.transaction;
}

export async function listTransactions(
  businessId: string,
  params?: { asset?: string; type?: string; taxYear?: number; page?: number; limit?: number }
): Promise<{ transactions: CryptoTransaction[]; pagination: Pagination }> {
  const query = new URLSearchParams({ businessId });
  if (params?.asset) query.set('asset', params.asset);
  if (params?.type) query.set('type', params.type);
  if (params?.taxYear) query.set('taxYear', String(params.taxYear));
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const res = await api.get(`/crypto/transactions?${query}`);
  return res.data;
}

export async function getTransaction(id: string): Promise<CryptoTransaction> {
  const res = await api.get(`/crypto/transactions/${id}`);
  return res.data.transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/crypto/transactions/${id}`);
}

export async function getTaxReport(
  businessId: string,
  taxYear?: number
): Promise<CryptoTaxReport> {
  const query = new URLSearchParams({ businessId });
  if (taxYear) query.set('taxYear', String(taxYear));
  const res = await api.get(`/crypto/tax-report?${query}`);
  return res.data.report;
}

export async function getPortfolio(businessId: string): Promise<PortfolioSummary> {
  const res = await api.get(`/crypto/portfolio?businessId=${businessId}`);
  return res.data.portfolio;
}
