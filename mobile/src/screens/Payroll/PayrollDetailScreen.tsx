import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getPayrollDetail, type PayrollDetail, type PayrollItem } from '../../services/payrollApi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { tokens } from '../../constants/tokens';

type PayrollDetailRouteParams = {
  PayrollDetail: {
    id?: string;
  };
};

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

function PayrollItemCard({ item }: { item: PayrollItem }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>{item.employeeName}</Text>
        <Text style={styles.itemNetPay}>{formatCurrency(item.netPay)}</Text>
      </View>

      <View style={styles.itemGrid}>
        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>Gross income</Text>
          <Text style={styles.itemValue}>{formatCurrency(item.grossIncome)}</Text>
        </View>
        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>PAYE</Text>
          <Text style={[styles.itemValue, { color: tokens.colors.danger }]}>{formatCurrency(item.payeTax)}</Text>
        </View>
        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>Pension</Text>
          <Text style={styles.itemValue}>{formatCurrency(item.pensionContribution)}</Text>
        </View>
        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>NHF</Text>
          <Text style={styles.itemValue}>{formatCurrency(item.nhfContribution)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function PayrollDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<PayrollDetailRouteParams, 'PayrollDetail'>>();
  const payrollId = route.params?.id;

  const [payroll, setPayroll] = useState<PayrollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPayroll = useCallback(async () => {
    if (!payrollId) {
      setError('Missing payroll ID.');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const detail = await getPayrollDetail(payrollId);
      setPayroll(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payroll details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [payrollId]);

  useEffect(() => {
    void loadPayroll();
  }, [loadPayroll]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  if (error || !payroll) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={56} color={tokens.colors.danger} />
        <Text style={styles.errorTitle}>Unable to open payroll</Text>
        <Text style={styles.errorText}>{error ?? 'Payroll record not found.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void loadPayroll()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => (navigation as any).goBack()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
        setRefreshing(true);
        void loadPayroll();
      }} tintColor={tokens.colors.primary} />}
    >
      <View style={styles.headerCard}>
        <Text style={styles.title}>{payroll.period}</Text>
        <Text style={styles.subtitle}>
          {payroll.processedAt ? `Processed ${formatDate(payroll.processedAt)}` : 'Pending processing'}
        </Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{payroll.status}</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <Metric label="Employees" value={String(payroll.employeeCount)} />
        <Metric label="Gross" value={formatCurrency(payroll.totalGross)} />
        <Metric label="Tax" value={formatCurrency(payroll.totalTax)} accent={tokens.colors.danger} />
        <Metric label="Net pay" value={formatCurrency(payroll.totalNet)} accent={tokens.colors.success} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Employee breakdown</Text>
        <Text style={styles.sectionSubtitle}>{payroll.items.length} record{payroll.items.length === 1 ? '' : 's'}</Text>
      </View>

      {payroll.items.map((item) => (
        <PayrollItemCard key={item.employeeId} item={item} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.neutral[50],
  },
  content: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    backgroundColor: tokens.colors.neutral[50],
  },
  headerCard: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
    ...tokens.shadows.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  subtitle: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.neutral[100],
    borderRadius: tokens.radius.full,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.neutral[700],
    textTransform: 'capitalize',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
  },
  metricCard: {
    width: '47%',
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    ...tokens.shadows.sm,
  },
  metricLabel: {
    fontSize: 13,
    color: tokens.colors.neutral[500],
    marginBottom: tokens.spacing.xs,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  sectionHeader: {
    marginTop: tokens.spacing.sm,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  sectionSubtitle: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
  },
  itemCard: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
    ...tokens.shadows.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  itemNetPay: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.success,
  },
  itemGrid: {
    gap: tokens.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  itemLabel: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
  },
  itemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
  },
  errorTitle: {
    marginTop: tokens.spacing.md,
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  errorText: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: tokens.colors.neutral[600],
  },
  retryButton: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  retryButtonText: {
    color: tokens.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  secondaryButtonText: {
    color: tokens.colors.neutral[700],
    fontSize: 15,
    fontWeight: '600',
  },
});
