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
import { colors, radii, spacing, typography, shadows } from '../theme/tokens';

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
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
  safe: { flex: 1, backgroundColor: colors.surfaceSlate },
  scroll: { flex: 1 },
  container: { paddingBottom: spacing.xxl + spacing.sm },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  greeting: { 
    fontSize: typography.size.sm, 
    color: colors.textMuted,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  h1: { fontSize: typography.size.xxl, fontWeight: typography.weight.black, color: colors.textPrimary },
  headerBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryBorder,
  },
  headerBadgeIcon: {
    fontSize: 24,
  },
  
  // Stats
  statsRow: { 
    flexDirection: 'row', 
    gap: spacing.md, 
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.md,
  },
  statCardPrimary: {
    flex: 1.5,
    backgroundColor: colors.primaryDeep,
    borderColor: 'rgba(11, 95, 255, 0.12)',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statEmoji: {
    fontSize: 18,
  },
  statLabel: { 
    color: colors.textOnPrimarySubtle, 
    fontWeight: typography.weight.semibold, 
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  statValue: { 
    fontSize: typography.size.xxl, 
    fontWeight: typography.weight.black, 
    color: colors.textOnPrimary, 
  },
  statValueSmall: { 
    fontSize: typography.size.xxxl, 
    fontWeight: typography.weight.black, 
    color: colors.textPrimary, 
  },
  statMeta: { 
    marginTop: spacing.xs, 
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  statBadge: {
    marginTop: spacing.sm + 2,
    backgroundColor: colors.overlaySuccess,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  statBadgeText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: typography.weight.semibold,
  },
  
  // Tip Card
  tipCard: {
    backgroundColor: colors.tipBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.tipBorder,
    gap: spacing.md,
  },
  tipEmoji: {
    fontSize: 24,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extrabold,
    color: colors.tipText,
    marginBottom: spacing.xs,
  },
  tipText: {
    flex: 1,
    color: colors.tipText,
    fontSize: 13,
    lineHeight: 20,
  },

  // Trust Badges
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm - 2,
  },
  trustIcon: {
    fontSize: 14,
  },
  trustLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
});
