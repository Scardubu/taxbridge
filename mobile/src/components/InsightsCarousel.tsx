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
        title: isOnline ? t('insights.readyToSync') : t('insights.pendingSync'),
        description: t('insights.syncDescription', {
          count: pendingCount,
          condition: isOnline ? t('insights.syncConditionTap') : t('insights.syncConditionOnline'),
        }),
        icon: isOnline ? '🔄' : '📵',
        gradient: isOnline ? 'green' : 'orange',
        actionLabel: isOnline ? t('insights.syncNow') : t('insights.viewPending'),
        metric: pendingCount.toString(),
        metricLabel: t('insights.pending'),
      });
    }

    // Tax Tip of the Day
    cards.push({
      id: 'tax_tip_1',
      type: 'tax_tip',
      title: t('insights.taxTipTitle'),
      description: t('insights.taxTipDesc'),
      icon: '💡',
      gradient: 'blue',
      actionLabel: t('insights.learnMore'),
    });

    // Compliance Reminder
    if (invoiceCount > 0) {
      cards.push({
        id: 'compliance',
        type: 'compliance_reminder',
        title: t('insights.stayCompliant'),
        description: t('insights.complianceDesc'),
        icon: '✅',
        gradient: 'green',
        metric: invoiceCount.toString(),
        metricLabel: t('insights.invoices'),
      });
    }

    // Achievement/Progress Card
    cards.push({
      id: 'achievement',
      type: 'achievement',
      title: t('insights.yourProgress'),
      description: t('insights.progressDesc'),
      icon: '🏆',
      gradient: 'purple',
      actionLabel: t('insights.viewAchievements'),
    });

    // Community Card
    cards.push({
      id: 'community',
      type: 'community',
      title: t('insights.joinSMEs'),
      description: t('insights.communityDesc'),
      icon: '👥',
      gradient: 'green',
      actionLabel: t('insights.joinCommunity'),
    });

    // Referral Card
    cards.push({
      id: 'referral',
      type: 'referral',
      title: t('insights.referEarn'),
      description: t('insights.referDesc'),
      icon: '🎁',
      gradient: 'orange',
      actionLabel: t('insights.shareCode'),
    });

    return cards;
  }, [invoiceCount, pendingCount, isOnline, t]);

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
        <Text style={styles.sectionTitle}>{t('insights.sectionTitle')}</Text>
        <Text style={styles.swipeHint}>{t('insights.swipeHint')}</Text>
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
