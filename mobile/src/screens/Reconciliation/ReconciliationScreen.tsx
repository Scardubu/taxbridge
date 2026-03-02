import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../constants/tokens';
import { useReconciliation } from '../../hooks/useReconciliation';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { ReconciliationMatch } from '../../services/reconciliationApi';

type FilterTab = 'matched' | 'unmatched-invoices' | 'unmatched-payments';

export default function ReconciliationScreen() {
  const { report, loading, error, run, reset } = useReconciliation();
  const [activeTab, setActiveTab] = useState<FilterTab>('matched');

  const handleRun = () => {
    // In production this would come from auth context
    run('current-business');
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 90) return tokens.colors.success;
    if (confidence >= 70) return tokens.colors.warning;
    return tokens.colors.danger;
  };

  const getMatchTypeLabel = (type: ReconciliationMatch['matchType']): string => {
    switch (type) {
      case 'exact': return 'Exact';
      case 'fuzzy': return 'Fuzzy';
      case 'partial': return 'Partial';
      default: return type;
    }
  };

  const getMatchTypeColor = (type: ReconciliationMatch['matchType']): string => {
    switch (type) {
      case 'exact': return tokens.colors.success;
      case 'fuzzy': return tokens.colors.warning;
      case 'partial': return tokens.colors.danger;
      default: return tokens.colors.neutral[500];
    }
  };

  // ---------- Summary card ----------
  const renderSummary = () => {
    if (!report) return null;
    const { summary } = report;
    return (
      <View style={[styles.summaryCard, tokens.shadows.md]}>
        <Text style={styles.summaryTitle}>Reconciliation Summary</Text>
        <Text style={styles.summaryDate}>
          Generated {formatDate(report.generatedAt)}
        </Text>

        <View style={styles.summaryGrid}>
          <SummaryItem label="Invoices" value={summary.totalInvoices} />
          <SummaryItem label="Payments" value={summary.totalPayments} />
          <SummaryItem label="Matched" value={summary.matchedCount} color={tokens.colors.success} />
          <SummaryItem
            label="Match Rate"
            value={`${(summary.matchRate * 100).toFixed(1)}%`}
            color={summary.matchRate >= 0.8 ? tokens.colors.success : tokens.colors.warning}
          />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Invoice Value</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalInvoiceValue)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Payment Value</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.totalPaymentValue)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowLast]}>
          <Text style={styles.summaryLabel}>Discrepancy</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: summary.discrepancy === 0 ? tokens.colors.success : tokens.colors.danger },
            ]}
          >
            {formatCurrency(summary.discrepancy)}
          </Text>
        </View>
      </View>
    );
  };

  // ---------- Matched item ----------
  const renderMatchedItem = ({ item }: { item: ReconciliationMatch }) => (
    <View style={[styles.card, tokens.shadows.sm]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.invoiceNumber || item.invoiceId.slice(0, 8)}</Text>
          <Text style={styles.cardSubtitle}>Ref: {item.paymentRef}</Text>
        </View>
        <View style={[styles.matchBadge, { backgroundColor: getMatchTypeColor(item.matchType) }]}>
          <Text style={styles.matchBadgeText}>{getMatchTypeLabel(item.matchType)}</Text>
        </View>
      </View>

      <View style={styles.matchDetails}>
        <View style={styles.matchRow}>
          <Text style={styles.matchLabel}>Invoice</Text>
          <Text style={styles.matchValue}>{formatCurrency(item.invoiceTotal)}</Text>
        </View>
        <View style={styles.matchRow}>
          <Text style={styles.matchLabel}>Payment</Text>
          <Text style={styles.matchValue}>{formatCurrency(item.paymentAmount)}</Text>
        </View>
        {item.difference !== 0 && (
          <View style={styles.matchRow}>
            <Text style={styles.matchLabel}>Difference</Text>
            <Text style={[styles.matchValue, { color: tokens.colors.danger }]}>
              {formatCurrency(item.difference)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.confidenceBar}>
        <View style={styles.confidenceTrack}>
          <View
            style={[
              styles.confidenceFill,
              {
                width: `${item.confidence}%`,
                backgroundColor: getConfidenceColor(item.confidence),
              },
            ]}
          />
        </View>
        <Text style={[styles.confidenceText, { color: getConfidenceColor(item.confidence) }]}>
          {item.confidence}%
        </Text>
      </View>
    </View>
  );

  // ---------- Unmatched invoice ----------
  const renderUnmatchedInvoice = ({ item }: { item: any }) => (
    <View style={[styles.card, styles.unmatchedCard, tokens.shadows.sm]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.invoiceNumber || item.id.slice(0, 8)}</Text>
          <Text style={styles.cardSubtitle}>{item.customerName || 'Unknown customer'}</Text>
        </View>
        <Ionicons name="alert-circle" size={24} color={tokens.colors.warning} />
      </View>
      <View style={styles.matchRow}>
        <Text style={styles.matchLabel}>Amount</Text>
        <Text style={styles.matchValue}>{formatCurrency(item.total)}</Text>
      </View>
      <View style={styles.matchRow}>
        <Text style={styles.matchLabel}>Status</Text>
        <Text style={[styles.matchValue, { textTransform: 'capitalize' }]}>{item.status}</Text>
      </View>
      <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
    </View>
  );

  // ---------- Unmatched payment ----------
  const renderUnmatchedPayment = ({ item }: { item: any }) => (
    <View style={[styles.card, styles.unmatchedCard, tokens.shadows.sm]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.reference}</Text>
          <Text style={styles.cardSubtitle}>{item.gateway}</Text>
        </View>
        <Ionicons name="alert-circle" size={24} color={tokens.colors.danger} />
      </View>
      <View style={styles.matchRow}>
        <Text style={styles.matchLabel}>Amount</Text>
        <Text style={styles.matchValue}>{formatCurrency(item.amount)}</Text>
      </View>
      <View style={styles.matchRow}>
        <Text style={styles.matchLabel}>Status</Text>
        <Text style={[styles.matchValue, { textTransform: 'capitalize' }]}>{item.status}</Text>
      </View>
      {item.paidAt && <Text style={styles.dateText}>{formatDate(item.paidAt)}</Text>}
    </View>
  );

  // ---------- Tab bar ----------
  const renderTabs = () => {
    if (!report) return null;
    const tabs: { key: FilterTab; label: string; count: number }[] = [
      { key: 'matched', label: 'Matched', count: report.summary.matchedCount },
      { key: 'unmatched-invoices', label: 'Invoices', count: report.summary.unmatchedInvoiceCount },
      { key: 'unmatched-payments', label: 'Payments', count: report.summary.unmatchedPaymentCount },
    ];
    return (
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ---------- List content ----------
  const renderList = () => {
    if (!report) return null;

    if (activeTab === 'matched') {
      return (
        <FlashList
          data={report.matched}
          renderItem={renderMatchedItem}
          keyExtractor={(item) => `${item.invoiceId}-${item.paymentId}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No matched records</Text>
          }
        />
      );
    }

    if (activeTab === 'unmatched-invoices') {
      return (
        <FlashList
          data={report.unmatchedInvoices}
          renderItem={renderUnmatchedInvoice}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>All invoices matched</Text>
          }
        />
      );
    }

    return (
      <FlashList
        data={report.unmatchedPayments}
        renderItem={renderUnmatchedPayment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>All payments matched</Text>
        }
      />
    );
  };

  // ---------- Initial / loading / error states ----------
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.loadingText}>Running reconciliation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color={tokens.colors.danger} />
        <Text style={styles.errorTitle}>Reconciliation Failed</Text>
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleRun}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reconciliation</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="git-compare-outline" size={64} color={tokens.colors.neutral[300]} />
          <Text style={styles.emptyTitle}>Match Invoices & Payments</Text>
          <Text style={styles.emptyDescription}>
            Automatically match your invoices with received payments using exact, fuzzy, and partial matching.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRun}>
            <Ionicons name="play" size={20} color={tokens.colors.white} />
            <Text style={styles.primaryButtonText}>Run Reconciliation</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Report view ----------
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reconciliation</Text>
        <TouchableOpacity style={styles.rerunButton} onPress={handleRun}>
          <Ionicons name="refresh" size={20} color={tokens.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} stickyHeaderIndices={[1]}>
        {renderSummary()}
        {renderTabs()}
        {renderList()}
      </ScrollView>
    </View>
  );
}

// ---------- Helper component ----------
function SummaryItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryItemValue, color ? { color } : undefined]}>
        {typeof value === 'number' ? value.toString() : value}
      </Text>
      <Text style={styles.summaryItemLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.neutral[50],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
    backgroundColor: tokens.colors.neutral[50],
  },
  scrollContainer: {
    flex: 1,
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
  rerunButton: {
    padding: tokens.spacing.sm,
  },
  listContainer: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },

  // Summary card
  summaryCard: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    margin: tokens.spacing.md,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
    marginBottom: 2,
  },
  summaryDate: {
    fontSize: 12,
    color: tokens.colors.neutral[500],
    marginBottom: tokens.spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.neutral[200],
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryItemValue: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  summaryItemLabel: {
    fontSize: 12,
    color: tokens.colors.neutral[500],
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.xs,
  },
  summaryRowLast: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.neutral[200],
    marginTop: tokens.spacing.xs,
    paddingTop: tokens.spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.white,
    paddingHorizontal: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.neutral[200],
  },
  tab: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: tokens.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: tokens.colors.neutral[500],
  },
  tabTextActive: {
    color: tokens.colors.primary,
    fontWeight: '600',
  },

  // Cards
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  unmatchedCard: {
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.warning,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
  },
  cardSubtitle: {
    fontSize: 12,
    color: tokens.colors.neutral[500],
    marginTop: 2,
  },
  matchBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.full,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.white,
  },
  matchDetails: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.neutral[200],
    paddingTop: tokens.spacing.sm,
  },
  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  matchLabel: {
    fontSize: 13,
    color: tokens.colors.neutral[600],
  },
  matchValue: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
  },
  dateText: {
    fontSize: 12,
    color: tokens.colors.neutral[400],
    marginTop: tokens.spacing.xs,
  },

  // Confidence bar
  confidenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
  },
  confidenceTrack: {
    flex: 1,
    height: 6,
    backgroundColor: tokens.colors.neutral[200],
    borderRadius: 3,
    marginRight: tokens.spacing.sm,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },

  // Empty / loading / error
  loadingText: {
    fontSize: 16,
    color: tokens.colors.neutral[600],
    marginTop: tokens.spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
  },
  emptyDescription: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 14,
    color: tokens.colors.neutral[500],
    textAlign: 'center',
    paddingVertical: tokens.spacing.xl,
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

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing.sm,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.white,
  },
});
