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
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../constants/tokens';
import { useCompliance } from '../../hooks/useCompliance';
import { formatDate, formatCurrency } from '../../utils/formatters';

interface ComplianceReminder {
  id: string;
  taxType: string;
  dueDate: string;
  amount?: number;
  status: 'pending' | 'filed' | 'overdue' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export default function ComplianceRemindersScreen() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue'>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const { reminders, loading, error, refetch, markAsFiled } = useCompliance();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getPriorityColor = (priority: ComplianceReminder['priority']) => {
    switch (priority) {
      case 'critical':
        return tokens.colors.danger;
      case 'high':
        return tokens.colors.warning;
      case 'medium':
        return tokens.colors.secondary;
      case 'low':
        return tokens.colors.neutral[400];
      default:
        return tokens.colors.neutral[500];
    }
  };

  const getStatusIcon = (status: ComplianceReminder['status']) => {
    switch (status) {
      case 'filed':
        return 'checkmark-circle';
      case 'overdue':
        return 'alert-circle';
      case 'pending':
        return 'time-outline';
      case 'dismissed':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const getDaysUntilDue = (dueDate: string): number => {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const renderReminderCard = ({ item }: { item: ComplianceReminder }) => {
    const daysUntilDue = getDaysUntilDue(item.dueDate);
    const isOverdue = daysUntilDue < 0;
    const isUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;

    return (
      <View style={[styles.card, tokens.shadows.md]}>
        <View style={styles.cardHeader}>
          <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(item.priority) }]} />
          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <Text style={styles.taxType}>{item.taxType}</Text>
              <Ionicons
                name={getStatusIcon(item.status)}
                size={24}
                color={
                  item.status === 'filed'
                    ? tokens.colors.success
                    : isOverdue
                    ? tokens.colors.danger
                    : tokens.colors.neutral[400]
                }
              />
            </View>

            <Text style={styles.description}>{item.description}</Text>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Ionicons name="calendar-outline" size={16} color={tokens.colors.neutral[600]} />
                <Text style={[styles.dueDate, isOverdue && styles.overdue]}>
                  {isOverdue
                    ? `Overdue by ${Math.abs(daysUntilDue)} days`
                    : isUrgent
                    ? `Due in ${daysUntilDue} days`
                    : formatDate(item.dueDate)}
                </Text>
              </View>

              {item.amount && (
                <View style={styles.detailItem}>
                  <Ionicons name="cash-outline" size={16} color={tokens.colors.neutral[600]} />
                  <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                </View>
              )}
            </View>

            {item.status === 'pending' && (
              <TouchableOpacity
                style={styles.markFiledButton}
                onPress={() => markAsFiled(item.id)}
              >
                <Ionicons name="checkmark" size={20} color={tokens.colors.white} />
                <Text style={styles.markFiledText}>Mark as Filed</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const filteredReminders = reminders.filter((reminder) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return reminder.status === 'pending';
    if (filter === 'overdue') return getDaysUntilDue(reminder.dueDate) < 0;
    return true;
  });

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="checkmark-done-circle-outline" size={64} color={tokens.colors.success} />
      <Text style={styles.emptyTitle}>All Caught Up!</Text>
      <Text style={styles.emptyText}>
        No pending compliance deadlines. Keep up the good work!
      </Text>
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
          <Text style={styles.errorTitle}>Error Loading Reminders</Text>
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
        <Text style={styles.headerTitle}>Compliance Reminders</Text>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'pending' && styles.filterChipActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'overdue' && styles.filterChipActive]}
          onPress={() => setFilter('overdue')}
        >
          <Text style={[styles.filterText, filter === 'overdue' && styles.filterTextActive]}>
            Overdue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredReminders}
        renderItem={renderReminderCard}
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
  filterBar: {
    flexDirection: 'row',
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.full,
    backgroundColor: tokens.colors.neutral[100],
  },
  filterChipActive: {
    backgroundColor: tokens.colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.neutral[600],
  },
  filterTextActive: {
    color: tokens.colors.white,
  },
  listContainer: {
    padding: tokens.spacing.md,
  },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.lg,
    marginBottom: tokens.spacing.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
  },
  priorityIndicator: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: tokens.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  taxType: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
  },
  description: {
    fontSize: 14,
    color: tokens.colors.neutral[700],
    marginBottom: tokens.spacing.md,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  dueDate: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
  },
  overdue: {
    color: tokens.colors.danger,
    fontWeight: '600',
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
  },
  markFiledButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.success,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing.xs,
  },
  markFiledText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.white,
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
    paddingHorizontal: tokens.spacing.xl,
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
