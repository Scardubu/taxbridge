import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../constants/tokens';
import { useCrypto } from '../../hooks/useCrypto';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { CryptoTransaction, CryptoTaxReport } from '../../services/cryptoApi';

export default function CryptoTaxScreen() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const { transactions, taxSummary, loading, error, refetch } = useCrypto(selectedYear);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getTypeColor = (type: CryptoTransaction['type']) => {
    switch (type) {
      case 'buy':
        return tokens.colors.success;
      case 'sell':
        return tokens.colors.danger;
      case 'trade':
        return tokens.colors.secondary;
      case 'transfer':
        return tokens.colors.neutral[400];
      default:
        return tokens.colors.neutral[500];
    }
  };

  const getTypeIcon = (type: CryptoTransaction['type']) => {
    switch (type) {
      case 'buy':
        return 'arrow-down-circle';
      case 'sell':
        return 'arrow-up-circle';
      case 'trade':
        return 'swap-horizontal';
      case 'transfer':
        return 'send';
      default:
        return 'help-circle';
    }
  };

  const renderTransactionCard = ({ item }: { item: CryptoTransaction }) => {
    const gainLoss = item.costBasis != null ? item.totalNGN - item.costBasis : 0;
    const hasGainLoss = item.type === 'sell' && item.costBasis != null;

    return (
      <View style={[styles.card, tokens.shadows.md]}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeIndicator, { backgroundColor: getTypeColor(item.type) }]}>
            <Ionicons name={getTypeIcon(item.type)} size={24} color={tokens.colors.white} />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <Text style={styles.asset}>{item.asset}</Text>
              <Text style={styles.type}>{item.type.toUpperCase()}</Text>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Amount:</Text>
              <Text style={styles.amount}>{item.amount.toFixed(8)} {item.asset}</Text>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Price:</Text>
              <Text style={styles.price}>{formatCurrency(item.priceNGN)}</Text>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Total:</Text>
              <Text style={styles.total}>{formatCurrency(item.totalNGN)}</Text>
            </View>

            {hasGainLoss && (
              <View style={[styles.gainLossRow, gainLoss >= 0 ? styles.gain : styles.loss]}>
                <Ionicons
                  name={gainLoss >= 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={gainLoss >= 0 ? tokens.colors.success : tokens.colors.danger}
                />
                <Text style={[styles.gainLossText, gainLoss >= 0 ? styles.gainText : styles.lossText]}>
                  {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}
                </Text>
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.date}>{formatDate(item.date)}</Text>
              {item.platform && (
                <Text style={styles.platform}>{item.platform}</Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderTaxSummary = () => {
    if (!taxSummary) return null;

    return (
      <View style={[styles.summaryCard, tokens.shadows.lg]}>
        <Text style={styles.summaryTitle}>Tax Summary {selectedYear}</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Sells</Text>
          <Text style={[styles.summaryValue, styles.gainText]}>
            {formatCurrency(taxSummary.totalSellValue)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Cost Basis</Text>
          <Text style={[styles.summaryValue, styles.lossText]}>
            {formatCurrency(taxSummary.totalCostBasis)}
          </Text>
        </View>

        <View style={[styles.summaryRow, styles.summaryDivider]}>
          <Text style={styles.summaryLabel}>Net {taxSummary.isLoss ? 'Loss' : 'Gain'}</Text>
          <Text style={[styles.summaryValue, styles.summaryBold]}>
            {formatCurrency(taxSummary.netGain)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>CGT Rate</Text>
          <Text style={[styles.summaryValue, styles.summaryBold]}>
            {(taxSummary.cgtRate * 100).toFixed(0)}%
          </Text>
        </View>

        <View style={[styles.summaryRow, styles.taxRow]}>
          <Text style={styles.taxLabel}>Estimated CGT</Text>
          <Text style={styles.taxValue}>{formatCurrency(taxSummary.cgtAmount)}</Text>
        </View>

        <Text style={styles.disclaimer}>
          * This is an estimate based on FIFO cost basis. Consult a tax professional for accurate filing.
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="wallet-outline" size={64} color={tokens.colors.neutral[300]} />
      <Text style={styles.emptyTitle}>No Crypto Transactions</Text>
      <Text style={styles.emptyText}>
        Add your crypto transactions to track tax obligations
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
          <Text style={styles.errorTitle}>Error Loading Crypto Data</Text>
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
        <Text style={styles.headerTitle}>Crypto Tax</Text>
      </View>

      <FlashList<CryptoTransaction>
        data={transactions}
        renderItem={renderTransactionCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderTaxSummary}
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
  listContainer: {
    padding: tokens.spacing.md,
  },
  summaryCard: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.lg,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.white,
    marginBottom: tokens.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
  },
  summaryDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.md,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.white,
  },
  summaryBold: {
    fontSize: 18,
    fontWeight: '700',
  },
  taxRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    marginTop: tokens.spacing.md,
  },
  taxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.white,
  },
  taxValue: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.white,
  },
  disclaimer: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: tokens.spacing.md,
    fontStyle: 'italic',
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
  typeIndicator: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.lg,
  },
  cardContent: {
    flex: 1,
    padding: tokens.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  asset: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  type: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.neutral[600],
    textTransform: 'uppercase',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
  },
  amountLabel: {
    fontSize: 14,
    color: tokens.colors.neutral[600],
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.neutral[900],
  },
  price: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.neutral[700],
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.neutral[900],
  },
  gainLossRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
  },
  gain: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  loss: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  gainLossText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gainText: {
    color: tokens.colors.success,
  },
  lossText: {
    color: tokens.colors.danger,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.neutral[200],
  },
  date: {
    fontSize: 12,
    color: tokens.colors.neutral[500],
  },
  platform: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.neutral[600],
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
