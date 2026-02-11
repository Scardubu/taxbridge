import { useState, useEffect } from 'react';
import { listReminders, markFiled, type Reminder } from '../services/complianceApi';
import { getBusinessProfile } from '../services/businessApi';

interface UseComplianceReturn {
  reminders: Reminder[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  markAsFiled: (id: string) => Promise<void>;
}

export function useCompliance(businessId?: string): UseComplianceReturn {
  const [reminders, setReminders] = useState<Reminder[]>([]);
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

  const fetchReminders = async () => {
    try {
      if (!resolvedBusinessId) return;
      setLoading(true);
      setError(null);
      const { reminders: data } = await listReminders(resolvedBusinessId);
      setReminders(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const markAsFiledHandler = async (id: string) => {
    try {
      await markFiled(id);
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'filed' } : r))
      );
    } catch (err) {
      console.error('Failed to mark as filed:', err);
    }
  };

  useEffect(() => {
    if (resolvedBusinessId) {
      fetchReminders();
    }
  }, [resolvedBusinessId]);

  return {
    reminders,
    loading,
    error,
    refetch: fetchReminders,
    markAsFiled: markAsFiledHandler,
  };
}
