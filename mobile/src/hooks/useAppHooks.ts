/**
 * Custom Hooks for TaxBridge Mobile App
 * Extracted reusable logic from screens for better testability and maintainability
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { getInvoices } from '../services/database';

// ============================================================================
// Types
// ============================================================================

interface Invoice {
  id: string;
  synced: 0 | 1;
  items: string;
  createdAt: string;
}

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceStats {
  count: number;
  pending: number;
  totalSales: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

export const parseInvoiceItems = (itemsJson: string): InvoiceItem[] => {
  try {
    const items = JSON.parse(itemsJson);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

export const calculateTotalFromInvoice = (invoice: Invoice): number => {
  const items = parseInvoiceItems(invoice.items);
  return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
};

// ============================================================================
// useInvoiceStats Hook
// ============================================================================

/**
 * Hook for loading and calculating invoice statistics
 * Replaces scattered state management in HomeScreen
 */
export const useInvoiceStats = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Calculate stats with memoization
  const stats = useMemo<InvoiceStats>(() => {
    const pending = invoices.filter(inv => inv.synced === 0).length;
    const totalSales = invoices.reduce((sum, inv) => {
      return sum + calculateTotalFromInvoice(inv);
    }, 0);

    return {
      count: invoices.length,
      pending,
      totalSales,
    };
  }, [invoices]);

  // Load invoices
  const loadStats = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const rows = await getInvoices();
      setInvoices(rows as Invoice[]);
    } catch (err) {
      if (__DEV__) console.error('Failed to load invoices:', err);
      setError(err as Error);
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    let mounted = true;
    
    loadStats().then(() => {
      if (!mounted) return;
    });

    return () => {
      mounted = false;
    };
  }, [loadStats]);

  return {
    invoices,
    stats,
    isLoading,
    error,
    reload: loadStats,
  };
};

// ============================================================================
// useContextualGreeting Hook
// ============================================================================

/**
 * Hook for generating contextual greetings based on time and day
 */
export const useContextualGreeting = (t: (key: string, options?: any) => string) => {
  return useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Weekend special greetings
    if (day === 0 || day === 6) {
      if (hour < 12) {
        return `🌅 ${t('home.weekendMorning', { defaultValue: t('home.goodMorning') })}`;
      }
      return `🎉 ${t('home.weekendVibes', { defaultValue: t('home.goodEvening') })}`;
    }
    
    // Weekday greetings with productivity context
    if (hour < 12) return `🌅 ${t('home.goodMorning')}`;
    if (hour < 14) return `☀️ ${t('home.lunchTime', { defaultValue: t('home.goodAfternoon') })}`;
    if (hour < 17) return `💼 ${t('home.afternoonHustle', { defaultValue: t('home.goodAfternoon') })}`;
    return `🌙 ${t('home.goodEvening')}`;
  }, [t]);
};

// ============================================================================
// useDebounce Hook
// ============================================================================

/**
 * Generic debounce hook for performance optimization
 */
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// ============================================================================
// useSmartSync Hook
// ============================================================================

/**
 * Hook for intelligent sync management
 * Auto-syncs when appropriate conditions are met
 */
interface UseSmartSyncOptions {
  isOnline: boolean;
  lastSyncAt: number | null;
  manualSync: () => Promise<void>;
  autoSyncEnabled?: boolean;
  autoSyncThresholdHours?: number;
}

export const useSmartSync = ({
  isOnline,
  lastSyncAt,
  manualSync,
  autoSyncEnabled = true,
  autoSyncThresholdHours = 2,
}: UseSmartSyncOptions) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const shouldAutoSync = useCallback(() => {
    if (!autoSyncEnabled || !isOnline || !lastSyncAt) return false;
    
    const hoursSinceLastSync = (Date.now() - lastSyncAt) / (1000 * 60 * 60);
    return hoursSinceLastSync > autoSyncThresholdHours;
  }, [autoSyncEnabled, isOnline, lastSyncAt, autoSyncThresholdHours]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (shouldAutoSync() && !isSyncing) {
      // Delay auto-sync to avoid blocking UI
      timeoutId = setTimeout(() => {
        setIsSyncing(true);
        manualSync()
          .catch(err => { if (__DEV__) console.error('Auto-sync failed:', err); })
          .finally(() => setIsSyncing(false));
      }, 3000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [shouldAutoSync, manualSync, isSyncing]);

  return { isSyncing, shouldAutoSync: shouldAutoSync() };
};

// ============================================================================
// useCurrencyFormatter Hook
// ============================================================================

/**
 * Hook for consistent currency formatting across the app
 */
export const useCurrencyFormatter = (locale: string = 'en-NG') => {
  return useCallback((amount: number, currency: string = '₦') => {
    return `${currency}${amount.toLocaleString(locale, { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [locale]);
};

// ============================================================================
// useStorageStats Hook
// ============================================================================

/**
 * Hook for managing storage statistics
 */
interface StorageStats {
  total: number;
  synced: number;
  pending: number;
}

export const useStorageStats = () => {
  const [stats, setStats] = useState<StorageStats>({ total: 0, synced: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const invoices = await getInvoices() as Invoice[];
      const synced = invoices.filter(inv => inv.synced === 1).length;
      const pending = invoices.filter(inv => inv.synced === 0).length;
      
      setStats({
        total: invoices.length,
        synced,
        pending,
      });
    } catch (error) {
      if (__DEV__) console.error('Failed to load storage stats:', error);
      setStats({ total: 0, synced: 0, pending: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    isLoading,
    reload: loadStats,
  };
};

// ============================================================================
// useFormFocus Hook
// ============================================================================

/**
 * Hook for managing form input focus based on validation errors
 */
export const useFormFocus = (
  errors: Record<string, string>,
  touched: Record<string, boolean>,
  refs: Record<string, React.RefObject<any>>
) => {
  useEffect(() => {
    // Find first error field and focus it
    const errorField = Object.keys(errors).find(key => touched[key] && errors[key]);
    
    if (errorField && refs[errorField]?.current) {
      refs[errorField].current.focus();
    }
  }, [errors, touched, refs]);
};

// ============================================================================
// useInvoiceExport Hook
// ============================================================================

/**
 * Hook for exporting invoice data to CSV
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { showToast } from '../components/ui/Toast';

export const useInvoiceExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = useCallback(async (t: (key: string, params?: Record<string, any>) => string) => {
    if (isExporting) return;
    
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const invoices = await getInvoices() as Invoice[];
      
      // Generate CSV
      const headers = 'Date,Amount,Status\n';
      const rows = invoices.map(inv => {
        const total = calculateTotalFromInvoice(inv);
        const date = new Date(inv.createdAt).toLocaleDateString();
        const status = inv.synced ? 'Synced' : 'Pending';
        return `${date},${total},${status}`;
      }).join('\n');
      
      const csv = headers + rows;
      
      // Save to file
      const fileName = `taxbridge_invoices_${Date.now()}.csv`;
      const baseDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const fileUri = `${baseDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      
      // Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: t('settings.exportInvoices'),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showToast({
          type: 'success',
          message: t('settings.exportCompleteMsg', { path: fileUri }),
          haptic: 'success',
          duration: 5000,
        });
      }
      
      return { success: true, fileUri };
    } catch (error) {
      if (__DEV__) console.error('Export failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  return {
    exportToCSV,
    isExporting,
  };
};

// ============================================================================
// useAchievements Hook
// ============================================================================

/**
 * Hook for calculating user achievements based on invoice count
 */
interface Achievement {
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export const useAchievements = (invoiceCount: number): Achievement[] => {
  return useMemo(() => {
    const achievements = [
      {
        icon: '🎯',
        title: 'First Invoice',
        description: 'Created your first invoice',
        threshold: 1,
      },
      {
        icon: '🚀',
        title: 'Rising Star',
        description: 'Created 10 invoices',
        threshold: 10,
      },
      {
        icon: '💎',
        title: 'Pro Trader',
        description: 'Created 50 invoices',
        threshold: 50,
      },
      {
        icon: '👑',
        title: 'Tax Champion',
        description: 'Created 100 invoices',
        threshold: 100,
      },
      {
        icon: '🏆',
        title: 'Invoice Master',
        description: 'Created 500 invoices',
        threshold: 500,
      },
    ];

    return achievements.map(achievement => ({
      ...achievement,
      unlocked: invoiceCount >= achievement.threshold,
    }));
  }, [invoiceCount]);
};

// ============================================================================
// useMonthlyRevenue Hook
// ============================================================================

/**
 * Hook for calculating monthly revenue trends
 */
interface MonthlyRevenue {
  month: string;
  revenue: number;
  invoiceCount: number;
}

export const useMonthlyRevenue = (invoices: Invoice[], monthsBack: number = 6): MonthlyRevenue[] => {
  return useMemo(() => {
    const now = new Date();
    const monthlyData: Record<string, MonthlyRevenue> = {};

    // Initialize last N months
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[monthKey] = {
        month: monthKey,
        revenue: 0,
        invoiceCount: 0,
      };
    }

    // Aggregate invoice data
    invoices.forEach(invoice => {
      const date = new Date(invoice.createdAt);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].revenue += calculateTotalFromInvoice(invoice);
        monthlyData[monthKey].invoiceCount += 1;
      }
    });

    return Object.values(monthlyData);
  }, [invoices, monthsBack]);
};