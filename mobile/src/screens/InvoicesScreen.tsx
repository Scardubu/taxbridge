import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import InvoiceCard from '../components/InvoiceCard';
import type { LocalInvoiceRow } from '../types/invoice';
import { getInvoices } from '../services/database';
import OfflineBadge from '../components/OfflineBadge';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';

export default function InvoicesScreen() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<LocalInvoiceRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // use centralized network & sync contexts
  const { isOnline } = useNetwork();
  const { isSyncing, manualSync } = useSyncContext();

  const load = useCallback(async () => {
    const data = await getInvoices();
    setRows(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const handleSync = useCallback(async () => {
    const res = await manualSync();
    // refresh list regardless
    await load();

    if (res.synced === 0 && res.failed === 0) {
      Alert.alert('Sync', 'No pending invoices to sync');
    }
  }, [manualSync, load]);

  const pendingCount = rows.filter(row => row.synced === 0).length;
  // online comes from NetworkContext
  const online = isOnline;
  return (
    <SafeAreaView style={styles.safe}>
      <OfflineBadge online={online} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.h1}>{t('invoices.title')}</Text>
          {pendingCount > 0 && (
            <Pressable 
              style={[styles.syncButton, (isSyncing || !online) && styles.syncButtonDisabled]} 
              onPress={handleSync}
              disabled={isSyncing || !online}
            >
              <Text style={styles.syncButtonText}>
                {isSyncing ? 'Syncing...' : `Sync (${pendingCount})`}
              </Text>
            </Pressable>
          )}
        </View>

        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InvoiceCard invoice={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('invoices.empty')}</Text>}
          contentContainerStyle={rows.length ? undefined : styles.emptyContainer}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  h1: { fontSize: 24, fontWeight: '800', color: '#101828' },
  syncButton: {
    backgroundColor: '#0B5FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  syncButtonDisabled: {
    backgroundColor: '#98A2B7'
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14
  },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#667085' }
});
