import { useCallback, useEffect, useState, useRef, memo, useMemo } from 'react';
import { FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, View, Pressable, Alert, Dimensions, Platform } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

const isWeb = Platform.OS === 'web';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Haptics from '../utils/safeHaptics';

import InvoiceCard from '../components/InvoiceCard';
import SwipeableInvoiceCard from '../components/SwipeableInvoiceCard';
import SyncStatusBar from '../components/SyncStatusBar';
import { showToast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import type { LocalInvoiceRow } from '../types/invoice';
import { colors, spacing, radii, typography, shadows } from '../theme/tokens';
import { DURATION } from '../design-system/animation';
import { getInvoices, setInvoiceRetryMetadata, updateInvoiceStatus } from '../services/database';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';

const { width } = Dimensions.get('window');

type FilterType = 'all' | 'pending' | 'synced' | 'failed';

function InvoicesScreen() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<LocalInvoiceRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const isMountedRef = useRef(true);
  // use centralized network & sync contexts
  const { isOnline } = useNetwork();
  const { isSyncing, manualSync, lastSyncAt } = useSyncContext();

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const data = await getInvoices();
    if (isMountedRef.current) {
      setRows(data);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    if (isMountedRef.current) setRefreshing(true);
    void load().finally(() => {
      if (isMountedRef.current) setRefreshing(false);
    });
  }, [load]);

  const handleSync = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await manualSync();
    // refresh list regardless
    await load();

    if (res.synced === 0 && res.failed === 0 && res.deferred === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast({
        type: 'info',
        message: t('invoices.noSyncPending')
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [manualSync, load, t]);

  const handleRetry = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast({
      type: 'info',
      message: `${t('invoices.retrySync')} #${id.slice(-6).toUpperCase()}...`
    });

    // Clear backoff metadata so it retries immediately.
    await updateInvoiceStatus(id, 'queued');
    await setInvoiceRetryMetadata(id, 0, null);

    await manualSync();
    await load();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [manualSync, load, t]);

  const handleShare = useCallback((invoice: LocalInvoiceRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t('invoices.shareInvoice'),
      `${t('invoices.shareInvoice')} #${invoice.id.slice(-6).toUpperCase()} - ${invoice.customerName || t('create.walkInCustomer')}\n${t('invoices.totalLabel')}: ₦${Number(invoice.total).toFixed(2)}`,
      [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: t('invoices.copyDetails'), onPress: () => {/* Could use Clipboard */} },
      ]
    );
  }, [t]);

  const handleDelete = useCallback((id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Implementation would call a delete function from database service
    showToast({
      type: 'success',
      message: t('invoices.removedFromLocal', { id: id.slice(-6).toUpperCase() }),
      haptic: 'success'
    });
    load();
  }, [load, t]);

  // Filter logic
  const filteredRows = useMemo(() => {
    switch (activeFilter) {
      case 'pending':
        return rows.filter(row => row.synced === 0 && row.status !== 'failed');
      case 'synced':
        return rows.filter(row => row.synced === 1);
      case 'failed':
        return rows.filter(row => row.status === 'failed');
      default:
        return rows;
    }
  }, [rows, activeFilter]);

  // Calculate stats
  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(r => r.synced === 0 && r.status !== 'failed').length,
    synced: rows.filter(r => r.synced === 1).length,
    failed: rows.filter(r => r.status === 'failed').length,
  }), [rows]);

  const pendingCount = stats.pending;
  // online comes from NetworkContext
  const online = isOnline;

  const filterOptions: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: t('invoices.filterAll'), count: stats.total },
    { key: 'pending', label: t('invoices.filterPending'), count: stats.pending },
    { key: 'synced', label: t('invoices.filterSynced'), count: stats.synced },
    { key: 'failed', label: t('invoices.filterFailed'), count: stats.failed },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View entering={isWeb ? undefined : FadeIn.duration(DURATION.transition)} style={styles.container}>
        {/* Sync Status Bar */}
        <SyncStatusBar />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>{t('invoices.title')}</Text>
            <Text style={styles.subtitle}>
              {t(stats.total === 1 ? 'invoices.total' : 'invoices.total_plural', { count: stats.total })} {t('invoices.totalLabel')}
            </Text>
          </View>
          {pendingCount > 0 && (
            <Pressable 
              style={[styles.syncButton, (isSyncing || !online) && styles.syncButtonDisabled]} 
              onPress={handleSync}
              disabled={isSyncing || !online}
              accessibilityRole="button"
              accessibilityLabel={t('invoices.sync')}
              accessibilityHint={isSyncing ? t('invoices.syncing') : !online ? t('alerts.offline') : `${pendingCount} ${t('invoices.filterPending')}`}
              accessibilityState={{ disabled: isSyncing || !online, busy: isSyncing }}
            >
              <Text style={styles.syncButtonText}>
                {isSyncing ? t('invoices.syncing') + '...' : t('invoices.syncPending', { count: pendingCount })}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Filter Tabs */}
        <Animated.View entering={isWeb ? undefined : FadeIn.delay(100).duration(DURATION.transition)} style={styles.filterContainer}>
          {filterOptions.map((filter) => (
            <Pressable
              key={filter.key}
              style={[
                styles.filterTab,
                activeFilter === filter.key && styles.filterTabActive,
                filter.key === 'failed' && filter.count > 0 && styles.filterTabError,
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === filter.key && styles.filterTabTextActive,
                  filter.key === 'failed' && filter.count > 0 && styles.filterTabTextError,
                ]}
              >
                {filter.label}
              </Text>
              {filter.count > 0 && (
                <View
                  style={[
                    styles.filterBadge,
                    activeFilter === filter.key && styles.filterBadgeActive,
                    filter.key === 'failed' && filter.count > 0 && styles.filterBadgeError,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBadgeText,
                      activeFilter === filter.key && styles.filterBadgeTextActive,
                    ]}
                  >
                    {filter.count}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </Animated.View>

        {/* Invoice List */}
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }: { item: LocalInvoiceRow; index: number }) => (
            <Animated.View entering={isWeb ? undefined : FadeIn.delay(index * 50).duration(200)}>
              <SwipeableInvoiceCard
                invoice={item}
                onRetry={handleRetry}
                onShare={handleShare}
                onDelete={handleDelete}
              />
            </Animated.View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState
              icon={activeFilter === 'failed' ? 'checkmark-circle-outline' : 'document-outline'}
              title={
                activeFilter === 'all' 
                  ? t('invoices.empty')
                  : activeFilter === 'pending'
                  ? t('invoices.noInvoicesPending')
                  : activeFilter === 'synced'
                  ? t('invoices.noInvoicesSynced')
                  : t('invoices.noInvoicesFailed')
              }
              message={
                activeFilter === 'all'
                  ? t('home.noInvoicesText')
                  : ''
              }
              action={
                activeFilter === 'all' ? {
                  label: t('home.createFirstInvoice'),
                  onPress: () => {/* Navigate to create invoice */}
                } : undefined
              }
            />
          }
          contentContainerStyle={filteredRows.length ? styles.listContent : styles.emptyContainer}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceSlate },
  container: { flex: 1, padding: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  h1: { fontSize: typography.size.xxl, fontWeight: typography.weight.extrabold, color: colors.textPrimary },
  subtitle: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: 2 },
  syncButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    alignItems: 'center',
    ...shadows.primary,
  },
  syncButtonDisabled: {
    backgroundColor: colors.disabled,
    boxShadow: 'none',
  },
  syncButtonText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
  },

  // Filter tabs
  filterContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.xs,
    ...shadows.sm,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabError: {
    borderColor: colors.error,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: colors.textOnPrimary,
  },
  filterTabTextError: {
    color: colors.error,
  },
  filterBadge: {
    backgroundColor: colors.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: colors.overlayLightStrong,
  },
  filterBadgeError: {
    backgroundColor: colors.errorBg,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
  },
  filterBadgeTextActive: {
    color: colors.textOnPrimary,
  },

  // List
  listContent: {
    paddingBottom: 100,
  },
  separator: {
    height: spacing.md,
  },

  // Empty state
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default memo(InvoicesScreen);
