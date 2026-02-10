import { useState, useEffect } from 'react';
import { complianceApi } from '../services/api/compliance';

interface ComplianceReminder {
  id: string;
  taxType: string;
  dueDate: string;
  amount?: number;
  status: 'pending' | 'filed' | 'overdue' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface UseComplianceReturn {
  reminders: ComplianceReminder[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  markAsFiled: (id: string) => Promise<void>;
}

export function useCompliance(): UseComplianceReturn {
  const [reminders, setReminders] = useState<ComplianceReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await complianceApi.list();
      setReminders(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const markAsFiled = async (id: string) => {
    try {
      await complianceApi.markFiled(id);
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'filed' as const } : r))
      );
    } catch (err) {
      console.error('Failed to mark as filed:', err);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  return {
    reminders,
    loading,
    error,
    refetch: fetchReminders,
    markAsFiled,
  };
}
