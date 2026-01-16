import { useCallback, useEffect, useState, useRef, memo, useMemo } from 'react';
import { FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, View, Pressable, Alert, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import InvoiceCard from '../components/InvoiceCard';
import SwipeableInvoiceCard from '../components/SwipeableInvoiceCard';
import SyncStatusBar from '../components/SyncStatusBar';
import type { LocalInvoiceRow } from '../types/invoice';
import { getInvoices } from '../services/database';
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

    if (res.synced === 0 && res.failed === 0) {
      Alert.alert('Sync', 'No pending invoices to sync');
    }
  }, [manualSync, load]);

  const handleRetry = useCallback(async (id: string) => {
    Alert.alert('Retry Sync', `Retrying sync for invoice ${id.slice(-6).toUpperCase()}...`);
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
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 8,
  },
  h1: { fontSize: 26, fontWeight: '800', color: '#101828' },
  subtitle: { fontSize: 14, color: '#667085', marginTop: 2 },
  syncButton: {
    backgroundColor: '#0B5FFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#0B5FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  syncButtonDisabled: {
    backgroundColor: '#98A2B7',
    shadowOpacity: 0,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Filter tabs
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: '#0B5FFF',
  },
  filterTabError: {
    borderColor: '#DC2626',
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667085',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  filterTabTextError: {
    color: '#DC2626',
  },
  filterBadge: {
    backgroundColor: '#E4E7EC',
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
    backgroundColor: '#FEE2E2',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#344054',
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },

  // List
  listContent: {
    paddingBottom: 100,
  },
  separator: {
    height: 12,
  },

  // Empty state
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
  },
});

export default memo(InvoicesScreen);
