import { useState, useEffect } from 'react';
import { payrollApi } from '../services/api/payroll';

interface PayrollItem {
  id: string;
  period: string;
  status: 'draft' | 'processing' | 'completed' | 'cancelled';
  totalGross: number;
  totalNet: number;
  totalTax: number;
  totalPension: number;
  totalNHF: number;
  employeeCount: number;
  processedAt?: string;
  createdAt: string;
}

interface UsePayrollReturn {
  payrolls: PayrollItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePayroll(): UsePayrollReturn {
  const [payrolls, setPayrolls] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await payrollApi.list();
      setPayrolls(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrolls();
  }, []);

  return {
    payrolls,
    loading,
    error,
    refetch: fetchPayrolls,
  };
}
