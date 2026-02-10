import { useState, useEffect } from 'react';
import { cryptoApi } from '../services/api/crypto';

interface CryptoTransaction {
  id: string;
  type: 'buy' | 'sell' | 'trade' | 'transfer';
  asset: string;
  amount: number;
  priceNGN: number;
  totalNGN: number;
  costBasis?: number;
  platform?: string;
  date: string;
  taxYear: number;
}

interface TaxSummary {
  totalGains: number;
  totalLosses: number;
  netGains: number;
  taxableGains: number;
  estimatedTax: number;
}

interface UseCryptoReturn {
  transactions: CryptoTransaction[];
  taxSummary: TaxSummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCrypto(taxYear: number): UseCryptoReturn {
  const [transactions, setTransactions] = useState<CryptoTransaction[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCryptoData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [transactionsData, summaryData] = await Promise.all([
        cryptoApi.listTransactions(taxYear),
        cryptoApi.getTaxSummary(taxYear),
      ]);
      
      setTransactions(transactionsData);
      setTaxSummary(summaryData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCryptoData();
  }, [taxYear]);

  return {
    transactions,
    taxSummary,
    loading,
    error,
    refetch: fetchCryptoData,
  };
}
