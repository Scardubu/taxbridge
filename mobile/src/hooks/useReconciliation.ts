import { useState, useCallback } from 'react';
import {
  runReconciliation,
  type ReconciliationReport,
} from '../services/reconciliationApi';

interface UseReconciliationReturn {
  report: ReconciliationReport | null;
  loading: boolean;
  error: Error | null;
  run: (businessId: string, options?: { fromDate?: string; toDate?: string; fuzzyThreshold?: number }) => Promise<void>;
  reset: () => void;
}

export function useReconciliation(): UseReconciliationReturn {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async (
    businessId: string,
    options?: { fromDate?: string; toDate?: string; fuzzyThreshold?: number },
  ) => {
    try {
      setLoading(true);
      setError(null);
      const data = await runReconciliation(businessId, options);
      setReport(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return { report, loading, error, run, reset };
}
