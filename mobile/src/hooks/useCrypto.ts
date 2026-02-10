import { useState, useEffect } from 'react';
import { listTransactions, getTaxReport, type CryptoTransaction, type CryptoTaxReport } from '../services/cryptoApi';
import { getBusinessProfile } from '../services/businessApi';

interface UseCryptoReturn {
  transactions: CryptoTransaction[];
  taxSummary: CryptoTaxReport | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCrypto(taxYear: number, businessId?: string): UseCryptoReturn {
  const [transactions, setTransactions] = useState<CryptoTransaction[]>([]);
  const [taxSummary, setTaxSummary] = useState<CryptoTaxReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [resolvedBusinessId, setResolvedBusinessId] = useState<string | null>(businessId || null);

  useEffect(() => {
    if (!businessId) {
      getBusinessProfile()
        .then((profile) => setResolvedBusinessId(profile.id))
        .catch((err) => setError(err as Error));
    }
  }, [businessId]);

  const fetchCryptoData = async () => {
    try {
      if (!resolvedBusinessId) return;
      setLoading(true);
      setError(null);
      
      const [{ transactions: transactionsData }, summaryData] = await Promise.all([
        listTransactions(resolvedBusinessId, { taxYear }),
        getTaxReport(resolvedBusinessId, taxYear),
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
    if (resolvedBusinessId) {
      fetchCryptoData();
    }
  }, [resolvedBusinessId, taxYear]);

  return {
    transactions,
    taxSummary,
    loading,
    error,
    refetch: fetchCryptoData,
  };
}
