import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../constants/tokens';
import { usePayroll } from '../../hooks/usePayroll';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { PayrollSummary } from '../../services/payrollApi';

export default function PayrollListScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const { payrolls, loading, error, refetch } = usePayroll();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return tokens.colors.success;
      case 'processing':
        return tokens.colors.warning;
      case 'draft':
        return tokens.colors.neutral[400];
      case 'cancelled':
        return tokens.colors.danger;
      default:
        return tokens.colors.neutral[500];
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing';
      case 'draft':
        return 'Draft';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const renderPayrollCard = ({ item }: { item: PayrollSummary }) => (
    <TouchableOpacity
      style={[styles.card, tokens.shadows.md]}
      onPress={() => (navigation as any).navigate('PayrollDetail', { id: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.period}>{item.period}</Text>
          <Text style={styles.employeeCount}>
            {item.employeeCount} employee{item.employeeCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <View style={styles.amountsContainer}>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Gross</Text>
          <Text style={styles.amountValue}>{formatCurrency(item.totalGross)}</Text>
        </View>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Tax</Text>
          <Text style={[styles.amountValue, { color: tokens.colors.danger }]}>
            {formatCurrency(item.totalTax)}
          </Text>
        </View>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Net Pay</Text>
          <Text style={[styles.amountValue, styles.netPay]}>
            {formatCurrency(item.totalNet)}
          </Text>
        </View>
      </View>

      {item.processedAt && (
        <Text style={styles.processedDate}>
          Processed on {formatDate(item.processedAt)}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="briefcase-outline" size={64} color={tokens.colors.neutral[300]} />
      <Text style={styles.emptyTitle}>No Payroll Records</Text>
      <Text style={styles.emptyText}>
        Create your first payroll to start paying employees
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => (navigation as any).navigate('CreatePayroll')}
      >
        <Text style={styles.createButtonText}>Create Payroll</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={tokens.colors.danger} />
          <Text style={styles.errorTitle}>Error Loading Payroll</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payroll</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (navigation as any).navigate('CreatePayroll')}
        >
          <Ionicons name="add-circle" size={32} color={tokens.colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList<PayrollSummary>
        data={payrolls}
        renderItem={renderPayrollCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.neutral[200],
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  addButton: {
    padding: tokens.spacing.sm,
  },
  listContainer: {
    padding: tokens.spacing.md,
  },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.md,
  },
  period: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing.xs,
  },
  employeeCount: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
  },
  statusBadge: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.white,
  },
  amountsContainer: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.neutral[200],
    paddingTop: tokens.spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  amountLabel: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
  },
  netPay: {
    fontSize: 18,
    color: tokens.colors.success,
  },
  processedDate: {
    fontSize: 12,
    color: tokens.colors.neutral[500],
    marginTop: tokens.spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xxxxl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
  },
  createButton: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.white,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
  },
  retryButton: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.white,
  },
});
