import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import InsightCard, { InsightType } from './InsightCard';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';
import { colors, spacing, typography } from '../theme/tokens';

const { width } = Dimensions.get('window');

interface InsightData {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  icon: string;
  gradient: 'blue' | 'green' | 'orange' | 'purple';
  actionLabel?: string;
  metric?: string;
  metricLabel?: string;
}

interface InsightsCarouselProps {
  invoiceCount?: number;
  pendingCount?: number;
  totalSales?: number;
  onNavigate?: (screen: string) => void;
}

function InsightsCarousel({
  invoiceCount = 0,
  pendingCount = 0,
  totalSales = 0,
  onNavigate,
}: InsightsCarouselProps) {
  const { t } = useTranslation();
  const { isOnline } = useNetwork();
  const { lastSyncAt, isSyncing } = useSyncContext();

  const insights = useMemo<InsightData[]>(() => {
    const cards: InsightData[] = [];

    // Sync Status Card
    if (pendingCount > 0) {
      cards.push({
        id: 'sync_status',
        type: 'sync_status',
        title: isOnline ? 'Ready to Sync' : 'Pending Sync',
        description: `${pendingCount} invoice${pendingCount > 1 ? 's' : ''} waiting to sync when ${isOnline ? 'you tap sync' : 'online'}`,
        icon: isOnline ? '🔄' : '📵',
        gradient: isOnline ? 'green' : 'orange',
        actionLabel: isOnline ? 'Sync Now' : 'View Pending',
        metric: pendingCount.toString(),
        metricLabel: 'pending',
      });
    }

    // Tax Tip of the Day
    cards.push({
      id: 'tax_tip_1',
      type: 'tax_tip',
      title: 'Tax Tip: ₦800K Exemption',
      description: 'Income below ₦800,000/year is tax-free under Nigeria Tax Act 2025. Know your thresholds!',
      icon: '💡',
      gradient: 'blue',
      actionLabel: 'Learn More',
    });

    // Compliance Reminder
    if (invoiceCount > 0) {
      cards.push({
        id: 'compliance',
        type: 'compliance_reminder',
        title: 'Stay Compliant',
        description: 'Your invoices are NRS-ready. Enable e-invoicing when turnover exceeds ₦100M.',
        icon: '✅',
        gradient: 'green',
        metric: invoiceCount.toString(),
        metricLabel: 'invoices',
      });
    }

    // Achievement/Progress Card
    cards.push({
      id: 'achievement',
      type: 'achievement',
      title: 'Your Progress',
      description: 'Complete the tax tutorial to unlock the Tax Pro badge and learn more savings tips!',
      icon: '🏆',
      gradient: 'purple',
      actionLabel: 'View Achievements',
    });

    // Community Card
    cards.push({
      id: 'community',
      type: 'community',
      title: 'Join 2,000+ SMEs',
      description: 'Connect with traders and business owners sharing tax tips in our WhatsApp community.',
      icon: '👥',
      gradient: 'green',
      actionLabel: 'Join Community',
    });

    // Referral Card
    cards.push({
      id: 'referral',
      type: 'referral',
      title: 'Refer & Earn',
      description: 'Invite 3 traders and earn ₦500 each. They get 1 free tax consultation!',
      icon: '🎁',
      gradient: 'orange',
      actionLabel: 'Share Code',
    });

    return cards;
  }, [invoiceCount, pendingCount, isOnline]);

  const handleAction = useCallback((card: InsightData) => {
    switch (card.type) {
      case 'sync_status':
        onNavigate?.('Invoices');
        break;
      case 'tax_tip':
        onNavigate?.('Settings'); // Could navigate to a tax education screen
        break;
      case 'achievement':
        onNavigate?.('Settings');
        break;
      case 'community':
        // Could open community links
        break;
      case 'referral':
        onNavigate?.('Settings');
        break;
      default:
        break;
    }
  }, [onNavigate]);

  const renderItem = useCallback(({ item }: { item: InsightData }) => (
    <InsightCard
      type={item.type}
      title={item.title}
      description={item.description}
      icon={item.icon}
      gradient={item.gradient}
      actionLabel={item.actionLabel}
      metric={item.metric}
      metricLabel={item.metricLabel}
      onAction={() => handleAction(item)}
    />
  ), [handleAction]);

  const keyExtractor = useCallback((item: InsightData) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Insights & Tips</Text>
        <Text style={styles.swipeHint}>Swipe →</Text>
      </View>
      <FlatList
        data={insights}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={width * 0.75 + 12}
        decelerationRate="fast"
      />
    </View>
  );
}

export default memo(InsightsCarousel);

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.extrabold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  swipeHint: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
  listContent: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
});
