import { useEffect, useState, useCallback, memo } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View, RefreshControl, ScrollView, Dimensions } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { getInvoices } from '../services/database';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';
import SyncStatusBar from '../components/SyncStatusBar';
import QuickActionRail from '../components/QuickActionRail';
import InsightsCarousel from '../components/InsightsCarousel';

const { width } = Dimensions.get('window');

function HomeScreen(props: any) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { isOnline } = useNetwork();
  const { manualSync, lastSyncAt } = useSyncContext();

  const loadData = useCallback(async () => {
    try {
      const rows = await getInvoices();
      setCount(rows.length);
      // Calculate pending (unsynced) count
      const pending = rows.filter((inv: any) => inv.synced === 0).length;
      setPendingCount(pending);
      // Calculate total sales from invoices
      const total = rows.reduce((sum: number, inv: any) => {
        const items = inv.items ? JSON.parse(inv.items) : [];
        const invoiceTotal = items.reduce((s: number, item: any) => 
          s + (item.quantity * item.unitPrice), 0);
        return sum + invoiceTotal;
      }, 0);
      setTotalSales(total);
    } catch {
      setCount(0);
      setPendingCount(0);
      setTotalSales(0);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    loadData().then(() => {
      if (!mounted) return;
    });

    return () => {
      mounted = false;
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  const handleCreateInvoice = useCallback(() => {
    props.navigation.navigate('Create');
  }, [props.navigation]);

  const handleScanReceipt = useCallback(() => {
    props.navigation.navigate('Create', { openScan: true });
  }, [props.navigation]);

  const handleViewInvoices = useCallback(() => {
    props.navigation.navigate('Invoices');
  }, [props.navigation]);

  const handleTaxCalculator = useCallback(() => {
    // Navigate to settings where tax calculator info is shown
    props.navigation.navigate('Settings');
  }, [props.navigation]);

  const handleSync = useCallback(async () => {
    await manualSync();
    await loadData();
  }, [manualSync, loadData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Good Morning';
    if (hour < 17) return '☀️ Good Afternoon';
    return '🌙 Good Evening';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView 
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0B5FFF']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Header */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.h1}>{t('home.welcome')}</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeIcon}>🌉</Text>
          </View>
        </Animated.View>

        {/* Sync Status Bar */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <SyncStatusBar 
            pendingCount={pendingCount} 
            onSyncPress={handleSync}
          />
        </Animated.View>

        {/* Stats Cards */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <View style={styles.statHeader}>
              <Text style={styles.statEmoji}>💰</Text>
              <Text style={styles.statLabel}>{t('home.monthlySales')}</Text>
            </View>
            <Text style={styles.statValue}>{formatCurrency(totalSales)}</Text>
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>📈 This Month</Text>
            </View>
          </View>
          
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statEmoji}>📄</Text>
              <Text style={styles.statLabel}>Invoices</Text>
            </View>
            <Text style={styles.statValueSmall}>{count}</Text>
            <Text style={styles.statMeta}>
              {pendingCount > 0 ? `${pendingCount} pending` : 'All synced'}
            </Text>
          </View>
        </Animated.View>

        {/* Quick Action Rail */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <QuickActionRail
            onCreateInvoice={handleCreateInvoice}
            onScanReceipt={handleScanReceipt}
            onViewInvoices={handleViewInvoices}
            onTaxCalculator={handleTaxCalculator}
          />
        </Animated.View>

        {/* Insights Carousel */}
        <Animated.View entering={FadeInDown.duration(400).delay(500)}>
          <InsightsCarousel
            invoiceCount={count}
            pendingCount={pendingCount}
            totalSales={totalSales}
            onNavigate={(screen) => props.navigation.navigate(screen)}
          />
        </Animated.View>

        {/* Compliance Tip */}
        <Animated.View entering={FadeInDown.duration(400).delay(600)} style={styles.tipCard}>
          <Text style={styles.tipEmoji}>💡</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Tax Tip</Text>
            <Text style={styles.tipText}>
              {t('home.offlineNotice')}
            </Text>
          </View>
        </Animated.View>

        {/* Trust Badges */}
        <Animated.View entering={FadeInDown.duration(400).delay(700)} style={styles.trustBadges}>
          <View style={styles.trustBadge}>
            <Text style={styles.trustIcon}>✓</Text>
            <Text style={styles.trustLabel}>NRS Ready</Text>
          </View>
          <View style={styles.trustBadge}>
            <Text style={styles.trustIcon}>🔒</Text>
            <Text style={styles.trustLabel}>NDPR Safe</Text>
          </View>
          <View style={styles.trustBadge}>
            <Text style={styles.trustIcon}>📵</Text>
            <Text style={styles.trustLabel}>Offline First</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default memo(HomeScreen);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flex: 1 },
  container: { paddingBottom: 32 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: { 
    fontSize: 14, 
    color: '#667085',
    fontWeight: '600',
    marginBottom: 4,
  },
  h1: { fontSize: 26, fontWeight: '900', color: '#101828' },
  headerBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#93C5FD',
  },
  headerBadgeIcon: {
    fontSize: 24,
  },
  
  // Stats
  statsRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    // @ts-ignore - boxShadow for web compatibility
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
    elevation: 2,
  },
  statCardPrimary: {
    flex: 1.5,
    backgroundColor: '#052B52',
    borderColor: '#0B5FFF20',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statEmoji: {
    fontSize: 18,
  },
  statLabel: { 
    color: 'rgba(255, 255, 255, 0.8)', 
    fontWeight: '600', 
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: { 
    fontSize: 26, 
    fontWeight: '900', 
    color: '#FFFFFF', 
  },
  statValueSmall: { 
    fontSize: 32, 
    fontWeight: '900', 
    color: '#101828', 
  },
  statMeta: { 
    marginTop: 4, 
    color: '#667085',
    fontSize: 12,
    fontWeight: '500',
  },
  statBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statBadgeText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  
  // Tip Card
  tipCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 12,
  },
  tipEmoji: {
    fontSize: 24,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  tipText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    lineHeight: 20,
  },

  // Trust Badges
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    gap: 6,
  },
  trustIcon: {
    fontSize: 14,
  },
  trustLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#344054',
  },
});
