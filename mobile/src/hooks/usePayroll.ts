import { useState, useEffect } from 'react';
import { listPayrolls, type PayrollSummary } from '../services/payrollApi';
import { getBusinessProfile } from '../services/businessApi';

interface UsePayrollReturn {
  payrolls: PayrollSummary[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePayroll(businessId?: string): UsePayrollReturn {
  const [payrolls, setPayrolls] = useState<PayrollSummary[]>([]);
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

  const fetchPayrolls = async () => {
    try {
      if (!resolvedBusinessId) return;
      setLoading(true);
      setError(null);
      const { payrolls: data } = await listPayrolls(resolvedBusinessId);
      setPayrolls(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resolvedBusinessId) {
      fetchPayrolls();
    }
  }, [resolvedBusinessId]);

  return {
    payrolls,
    loading,
    error,
    refetch: fetchPayrolls,
  };
}
