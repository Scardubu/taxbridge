import { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import { 
  Pressable, 
  SafeAreaView, 
  StyleSheet, 
  Text, 
  View, 
  RefreshControl, 
  ScrollView, 
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';

const isWeb = Platform.OS === 'web';
import { useTranslation } from 'react-i18next';
import * as Haptics from '../utils/safeHaptics';

import { getInvoices } from '../services/database';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';
import { useFeatureFlag } from '../contexts/FeatureFlagContext';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import SyncStatusBar from '../components/SyncStatusBar';
import QuickActionRail from '../components/QuickActionRail';
import InsightsCarousel from '../components/InsightsCarousel';
import { LivingBridgeHeader } from '../components/header';
import FloatingActionButton from '../components/FloatingActionButton';
import GlobalSearch from '../components/GlobalSearch';
import SyncQueueViewer from '../components/SyncQueueViewer';
import { colors, radii, spacing, typography, shadows } from '../theme/tokens';

const { width } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

interface Invoice {
  id: string;
  synced: 0 | 1;
  items: string;
  createdAt: number;
  updatedAt: number;
}

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceStats {
  count: number;
  pendingCount: number;
  totalSales: number;
}

// ============================================================================
// Utilities
// ============================================================================

const parseInvoiceItems = (itemsJson: string): InvoiceItem[] => {
  try {
    const items = JSON.parse(itemsJson);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

const calculateInvoiceStats = (invoices: Invoice[]): InvoiceStats => {
  const pendingCount = invoices.filter(inv => inv.synced === 0).length;
  const totalSales = invoices.reduce((sum, inv) => {
    const items = parseInvoiceItems(inv.items);
    return sum + items.reduce((s, item) => s + (item.quantity * item.unitPrice), 0);
  }, 0);

  return {
    count: invoices.length,
    pendingCount,
    totalSales,
  };
};

// ============================================================================
// Empty State Component
// ============================================================================

const EmptyInvoicesState = memo(({ onCreateInvoice }: { onCreateInvoice: () => void }) => {
  const { t } = useTranslation();

  return (
    <Animated.View entering={isWeb ? undefined : FadeInDown.duration(400).delay(300)} style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📄</Text>
      <Text style={styles.emptyTitle}>{t('home.noInvoicesTitle')}</Text>
      <Text style={styles.emptyText}>{t('home.noInvoicesText')}</Text>
      <Pressable 
        style={styles.emptyButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onCreateInvoice();
        }}
        accessible={true}
        accessibilityLabel={t('home.createFirstInvoice')}
        accessibilityRole="button"
      >
        <Text style={styles.emptyButtonIcon}>➕</Text>
        <Text style={styles.emptyButtonText}>{t('home.createFirstInvoice')}</Text>
      </Pressable>
    </Animated.View>
  );
});

EmptyInvoicesState.displayName = 'EmptyInvoicesState';

// ============================================================================
// Loading Skeleton Component
// ============================================================================

const LoadingSkeleton = memo(() => (
  <>
    <Animated.View entering={isWeb ? undefined : FadeIn.duration(200)} style={styles.skeletonContainer}>
      {/* Stats Skeleton */}
      <View style={styles.statsRow}>
        <View style={[styles.skeletonCard, styles.skeletonCardLarge]}>
          <View style={styles.skeletonHeader} />
          <View style={styles.skeletonValue} />
          <View style={styles.skeletonBadge} />
        </View>
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonHeader} />
          <View style={styles.skeletonValue} />
          <View style={styles.skeletonMeta} />
        </View>
      </View>

      {/* Quick Actions Skeleton */}
      <View style={styles.skeletonActions}>
        <View style={styles.skeletonAction} />
        <View style={styles.skeletonAction} />
        <View style={styles.skeletonAction} />
      </View>

      <SkeletonLoader type="dashboard" count={1} />
    </Animated.View>
  </>
));

LoadingSkeleton.displayName = 'LoadingSkeleton';

// ============================================================================
// Stats Cards Component
// ============================================================================

interface StatsCardsProps {
  stats: InvoiceStats;
  formatCurrency: (amount: number) => string;
}

const StatsCards = memo(({ stats, formatCurrency }: StatsCardsProps) => {
  const { t } = useTranslation();

  return (
    <Animated.View entering={isWeb ? undefined : FadeInDown.duration(400).delay(300)} style={styles.statsRow}>
      <Pressable
        style={[styles.statCard, styles.statCardPrimary]}
        accessible={true}
        accessibilityLabel={`${t('home.monthlySales')}: ${formatCurrency(stats.totalSales)}`}
        accessibilityRole="button"
      >
        <View style={styles.statHeader}>
          <Text style={styles.statEmoji}>💰</Text>
          <Text style={styles.statLabel}>{t('home.monthlySales')}</Text>
        </View>
        <Text style={styles.statValue}>{formatCurrency(stats.totalSales)}</Text>
        <View style={styles.statBadge}>
          <Text style={styles.statBadgeText}>📈 {t('home.thisMonth')}</Text>
        </View>
      </Pressable>
      
      <View style={styles.statCard}>
        <View style={styles.statHeader}>
          <Text style={styles.statEmoji}>📄</Text>
          <Text style={styles.statLabel}>{t('home.invoicesLabel')}</Text>
        </View>
        <Text style={styles.statValueSmall}>{stats.count}</Text>
        <Text style={styles.statMeta}>
          {stats.pendingCount > 0 
            ? `${stats.pendingCount} ${t('home.pending')}` 
            : t('home.allSynced')}
        </Text>
      </View>
    </Animated.View>
  );
});

StatsCards.displayName = 'StatsCards';

// ============================================================================
// Main Component
// ============================================================================

function HomeScreen(props: any) {
  const { t } = useTranslation();
  const { isOnline } = useNetwork();
  const { manualSync, lastSyncAt } = useSyncContext();
  const receiptsScannerEnabled = useFeatureFlag('receiptsScanner');

  // State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isSyncQueueVisible, setIsSyncQueueVisible] = useState(false);

  // Refs for debouncing
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Memoized stats calculation
  const stats = useMemo(() => calculateInvoiceStats(invoices), [invoices]);

  // Load data function with error handling
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const rows = await getInvoices();
      setInvoices(rows as unknown as Invoice[]);
    } catch (err) {
      if (__DEV__) {
        console.error('Failed to load invoices:', err);
      }
      setError(err as Error);
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let mounted = true;
    
    loadData().then(() => {
      if (!mounted) return;
    });

    return () => {
      mounted = false;
    };
  }, [loadData]);

  // Pull-to-refresh handler with debounce
  const onRefresh = useCallback(async () => {
    // Clear any pending refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    await loadData();
    
    // Minimum refresh time for better UX
    refreshTimeoutRef.current = setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, [loadData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Currency formatter
  const formatCurrency = useCallback((amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  }, []);

  // Navigation handlers with haptic feedback
  const handleCreateInvoice = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    props.navigation.navigate('Create');
  }, [props.navigation]);

  const handleScanReceipt = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    props.navigation.navigate('Create', { openScan: true });
  }, [props.navigation]);

  const handleViewInvoices = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    props.navigation.navigate('Invoices');
  }, [props.navigation]);

  const handleTaxCalculator = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    props.navigation.navigate('TaxGuide');
  }, [props.navigation]);

  // Search handlers
  const handleOpenSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSearchVisible(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearchVisible(false);
  }, []);

  const handleSearchResult = useCallback((result: { type: string; id: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSearchVisible(false);
    // Navigate based on result type
    switch (result.type) {
      case 'invoice':
        props.navigation.navigate('Invoices', { highlightId: result.id });
        break;
      case 'customer':
        props.navigation.navigate('Invoices', { customerId: result.id });
        break;
      case 'transaction':
        props.navigation.navigate('Invoices', { transactionId: result.id });
        break;
      default:
        props.navigation.navigate('Invoices');
    }
  }, [props.navigation]);

  // Sync Queue handlers
  const handleOpenSyncQueue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSyncQueueVisible(true);
  }, []);

  const handleCloseSyncQueue = useCallback(() => {
    setIsSyncQueueVisible(false);
  }, []);

  const handleRetrySync = useCallback(async (itemId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await manualSync();
      await loadData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [manualSync, loadData]);

  const handleSync = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await manualSync();
      await loadData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (__DEV__) {
        console.error('Sync failed:', err);
      }
    }
  }, [manualSync, loadData]);

  // Contextual greeting
  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Weekend special greetings
    if (day === 0 || day === 6) {
      if (hour < 12) return `🌅 ${t('home.weekendMorning', { defaultValue: t('home.goodMorning') })}`;
      return `🎉 ${t('home.weekendVibes', { defaultValue: t('home.goodEvening') })}`;
    }
    
    // Weekday greetings
    if (hour < 12) return `🌅 ${t('home.goodMorning')}`;
    if (hour < 14) return `☀️ ${t('home.lunchTime', { defaultValue: t('home.goodAfternoon') })}`;
    if (hour < 17) return `💼 ${t('home.afternoonHustle', { defaultValue: t('home.goodAfternoon') })}`;
    return `🌙 ${t('home.goodEvening')}`;
  }, [t]);

  // Error state
  if (error && !isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LivingBridgeHeader
          variant="compact"
          title={t('home.welcome')}
          subtitle={getGreeting()}
          showNetworkStatus={true}
          isOnline={isOnline}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>{t('errors.loadFailed')}</Text>
          <Text style={styles.errorText}>{t('errors.tryAgain')}</Text>
          <Pressable style={styles.errorButton} onPress={loadData}>
            <Text style={styles.errorButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Living Bridge Header - Compact Home Variant */}
      <LivingBridgeHeader
        variant="compact"
        title={t('home.welcome')}
        subtitle={getGreeting()}
        showNetworkStatus={true}
        isOnline={isOnline}
        showTrustBadges={false}
        showProgress={false}
        showMetricChip={false}
      />

      {/* Search Bar Trigger */}
      <Animated.View entering={isWeb ? undefined : FadeInDown.duration(300).delay(100)}>
        <Pressable
          style={styles.searchTrigger}
          onPress={handleOpenSearch}
          accessibilityRole="button"
          accessibilityLabel={t('home.searchPlaceholder')}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>{t('home.searchPlaceholder')}</Text>
        </Pressable>
      </Animated.View>

      <ScrollView 
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        accessible={true}
        accessibilityLabel={t('home.mainContent')}
      >
        {/* Loading State */}
        {isLoading && <LoadingSkeleton />}

        {/* Content - Only show when not loading */}
        {!isLoading && (
          <>
            {/* Empty State */}
            {stats.count === 0 ? (
              <EmptyInvoicesState onCreateInvoice={handleCreateInvoice} />
            ) : (
              <>
                {/* Sync Status Bar */}
                <Animated.View entering={isWeb ? undefined : FadeInDown.duration(400).delay(200)}>
                  <SyncStatusBar 
                    pendingCount={stats.pendingCount} 
                    onSyncPress={handleSync}
                  />
                  {stats.pendingCount > 0 && (
                    <Pressable
                      style={styles.viewQueueButton}
                      onPress={handleOpenSyncQueue}
                      accessibilityRole="button"
                      accessibilityLabel={t('sync.viewQueue')}
                    >
                      <Text style={styles.viewQueueIcon}>📋</Text>
                      <Text style={styles.viewQueueText}>{t('sync.viewQueue')}</Text>
                    </Pressable>
                  )}
                </Animated.View>

                {/* Stats Cards */}
                <StatsCards stats={stats} formatCurrency={formatCurrency} />

                {/* Quick Action Rail */}
                <Animated.View entering={isWeb ? undefined : FadeInDown.duration(400).delay(400)}>
                  <QuickActionRail
                    onCreateInvoice={handleCreateInvoice}
                    onScanReceipt={handleScanReceipt}
                    onViewInvoices={handleViewInvoices}
                    onTaxCalculator={handleTaxCalculator}
                    showScanAction={receiptsScannerEnabled}
                  />
                </Animated.View>

                {/* Insights Carousel */}
                <Animated.View entering={isWeb ? undefined : FadeInDown.duration(400).delay(500)}>
                  <InsightsCarousel
                    invoiceCount={stats.count}
                    pendingCount={stats.pendingCount}
                    totalSales={stats.totalSales}
                    onNavigate={(screen) => props.navigation.navigate(screen)}
                  />
                </Animated.View>

                {/* Compliance Tip */}
                <Animated.View entering={isWeb ? undefined : FadeInDown.duration(400).delay(600)} style={styles.tipCard}>
                  <Text style={styles.tipEmoji}>💡</Text>
                  <View style={styles.tipContent}>
                    <Text style={styles.tipTitle}>{t('home.taxTip')}</Text>
                    <Text style={styles.tipText}>{t('home.offlineNotice')}</Text>
                  </View>
                </Animated.View>

                {/* Trust Badges */}
                <Animated.View entering={isWeb ? undefined : FadeInDown.duration(400).delay(700)} style={styles.trustBadges}>
                  <View style={styles.trustBadge}>
                    <Text style={styles.trustIcon}>✓</Text>
                    <Text style={styles.trustLabel}>{t('home.nrsReady')}</Text>
                  </View>
                  <View style={styles.trustBadge}>
                    <Text style={styles.trustIcon}>🔒</Text>
                    <Text style={styles.trustLabel}>{t('home.ndprSafe')}</Text>
                  </View>
                  <View style={styles.trustBadge}>
                    <Text style={styles.trustIcon}>📵</Text>
                    <Text style={styles.trustLabel}>{t('home.offlineFirst')}</Text>
                  </View>
                </Animated.View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Floating Action Button for quick actions */}
      <FloatingActionButton
        onCreateInvoice={handleCreateInvoice}
        onScanReceipt={receiptsScannerEnabled ? handleScanReceipt : undefined}
        onViewInvoices={handleViewInvoices}
        onTaxCalculator={handleTaxCalculator}
        showScanAction={receiptsScannerEnabled}
        position="bottom-right"
      />

      {/* Global Search Modal */}
      <Modal
        visible={isSearchVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseSearch}
      >
        <SafeAreaView style={styles.searchModalContainer}>
          <View style={styles.searchModalHeader}>
            <Pressable 
              onPress={handleCloseSearch}
              style={styles.searchCloseButton}
              accessibilityLabel={t('common.close')}
              accessibilityRole="button"
            >
              <Text style={styles.searchCloseText}>✕</Text>
            </Pressable>
            <Text style={styles.searchModalTitle}>{t('home.searchTitle')}</Text>
            <View style={styles.searchCloseButton} />
          </View>
          <GlobalSearch
            onSelectResult={handleSearchResult}
            autoFocus={true}
            showFilters={true}
            placeholder={t('home.searchPlaceholder')}
          />
        </SafeAreaView>
      </Modal>

      {/* Sync Queue Viewer Modal */}
      <SyncQueueViewer
        visible={isSyncQueueVisible}
        onClose={handleCloseSyncQueue}
        onRetryItem={handleRetrySync}
        onRetryAll={handleRetrySync}
      />
    </SafeAreaView>
  );
}

export default memo(HomeScreen);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceSlate },
  scroll: { flex: 1 },
  container: { paddingBottom: spacing.xxl + spacing.sm },

  // Search Trigger
  searchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  searchIcon: {
    fontSize: typography.size.md,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },

  // Search Modal
  searchModalContainer: {
    flex: 1,
    backgroundColor: colors.surfaceSlate,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  searchCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCloseText: {
    fontSize: typography.size.lg,
    color: colors.textSecondary,
    fontWeight: typography.weight.semibold,
  },
  searchModalTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },

  // View Queue Button
  viewQueueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  viewQueueIcon: {
    fontSize: typography.size.sm,
  },
  viewQueueText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
    textDecorationLine: 'underline',
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
    borderColor: colors.overlayLightSubtle,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statEmoji: {
    fontSize: typography.size.lg,
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
    marginTop: spacing.sm + spacing.xxs,
    backgroundColor: colors.overlaySuccess,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xs + spacing.xxs,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  statBadgeText: {
    fontSize: typography.size.xs,
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
    fontSize: typography.size.xl + spacing.xs,
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
    fontSize: typography.size.xs + spacing.xxs,
    lineHeight: spacing.xl,
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
    gap: spacing.xs,
  },
  trustIcon: {
    fontSize: typography.size.sm,
  },
  trustLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.sm,
  },
  emptyButtonIcon: {
    fontSize: typography.size.lg,
  },
  emptyButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },

  // Loading Skeleton
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
  },
  skeletonCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  skeletonCardLarge: {
    flex: 1.5,
  },
  skeletonHeader: {
    height: 16,
    backgroundColor: colors.borderSubtle,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    width: '60%',
  },
  skeletonValue: {
    height: 32,
    backgroundColor: colors.borderSubtle,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    width: '80%',
  },
  skeletonBadge: {
    height: 20,
    backgroundColor: colors.borderSubtle,
    borderRadius: radii.md,
    width: '50%',
  },
  skeletonMeta: {
    height: 14,
    backgroundColor: colors.borderSubtle,
    borderRadius: radii.sm,
    width: '40%',
  },
  skeletonActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  skeletonAction: {
    flex: 1,
    height: 80,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  loadingIndicator: {
    marginTop: spacing.xxl,
  },

  // Error State
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
  },
  errorButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
});