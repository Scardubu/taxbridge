import { useCallback, useEffect, useState, useRef, memo, useMemo } from 'react';
import { FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, View, Pressable, Alert, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import InvoiceCard from '../components/InvoiceCard';
import SwipeableInvoiceCard from '../components/SwipeableInvoiceCard';
import SyncStatusBar from '../components/SyncStatusBar';
import type { LocalInvoiceRow } from '../types/invoice';
import { colors, spacing, radii, typography, shadows } from '../theme/tokens';
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
    const res = await manualSync();
    // refresh list regardless
    await load();

    if (res.synced === 0 && res.failed === 0 && res.deferred === 0) {
      Alert.alert('Sync', 'No pending invoices to sync');
    }
  }, [manualSync, load]);

  const handleRetry = useCallback(async (id: string) => {
    Alert.alert('Retry Sync', `Retrying sync for invoice ${id.slice(-6).toUpperCase()}...`);

    // Clear backoff metadata so it retries immediately.
    await updateInvoiceStatus(id, 'queued');
    await setInvoiceRetryMetadata(id, 0, null);

    await manualSync();
    await load();
  }, [manualSync, load]);

  const handleShare = useCallback((invoice: LocalInvoiceRow) => {
    Alert.alert(
      'Share Invoice',
      `Share invoice #${invoice.id.slice(-6).toUpperCase()} for ${invoice.customerName || 'Walk-in'}\nTotal: ₦${Number(invoice.total).toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Copy Details', onPress: () => {/* Could use Clipboard */} },
      ]
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    // Implementation would call a delete function from database service
    Alert.alert('Deleted', `Invoice ${id.slice(-6).toUpperCase()} removed from local storage`);
    load();
  }, [load]);

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
    { key: 'all', label: 'All', count: stats.total },
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'synced', label: 'Synced', count: stats.synced },
    { key: 'failed', label: 'Failed', count: stats.failed },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
        {/* Sync Status Bar */}
        <SyncStatusBar />

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>{t('invoices.title')}</Text>
            <Text style={styles.subtitle}>
              {stats.total} {stats.total === 1 ? 'invoice' : 'invoices'} total
            </Text>
          </View>
          {pendingCount > 0 && (
            <Pressable 
              style={[styles.syncButton, (isSyncing || !online) && styles.syncButtonDisabled]} 
              onPress={handleSync}
              disabled={isSyncing || !online}
              accessibilityRole="button"
              accessibilityState={{ disabled: isSyncing || !online }}
            >
              <Text style={styles.syncButtonText}>
                {isSyncing ? t('invoices.syncing') + '...' : t('invoices.syncPending', { count: pendingCount })}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Filter Tabs */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.filterContainer}>
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
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeIn.delay(index * 50).duration(200)}>
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
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{activeFilter === 'failed' ? '✅' : '📄'}</Text>
              <Text style={styles.emptyTitle}>
                {activeFilter === 'all' 
                  ? t('invoices.empty')
                  : activeFilter === 'pending'
                  ? 'No pending invoices'
                  : activeFilter === 'synced'
                  ? 'No synced invoices yet'
                  : 'No failed invoices - great!'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'all'
                  ? 'Create your first invoice to get started'
                  : activeFilter === 'pending'
                  ? 'All invoices have been synced'
                  : ''}
              </Text>
            </View>
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
    shadowOpacity: 0,
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
    backgroundColor: 'rgba(255,255,255,0.3)',
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
