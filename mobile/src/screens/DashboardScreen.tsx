import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';
import { useFeatureFlag } from '../contexts/FeatureFlagContext';
import { getInvoices } from '../services/database';
import { calculatePIT, getTaxOptimization, formatNaira, formatPercentage } from '../services/tax/engine';
import { calculatePIT as calculateLegacyPIT } from '../services/taxCalculator';
import { colors, spacing, radii, typography, shadows } from '../theme/tokens';

const { width } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

interface Invoice {
  id: string;
  synced: 0 | 1;
  items: string;
  createdAt: number;
  total?: number;
  vat?: number;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface DashboardStats {
  totalInvoices: number;
  pendingSync: number;
  syncedInvoices: number;
  totalRevenue: number;
  thisMonthRevenue: number;
  totalVAT: number;
  averageInvoice: number;
}

// ============================================================================
// Utilities
// ============================================================================

const parseItems = (itemsJson: string): InvoiceItem[] => {
  try {
    const items = JSON.parse(itemsJson);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

const calculateStats = (invoices: Invoice[]): DashboardStats => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let totalRevenue = 0;
  let thisMonthRevenue = 0;
  let totalVAT = 0;

  invoices.forEach((inv) => {
    const items = parseItems(inv.items);
    const invoiceTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vat = inv.vat || invoiceTotal * 0.075;

    totalRevenue += invoiceTotal;
    totalVAT += vat;

    if (inv.createdAt >= thisMonthStart) {
      thisMonthRevenue += invoiceTotal;
    }
  });

  return {
    totalInvoices: invoices.length,
    pendingSync: invoices.filter((i) => i.synced === 0).length,
    syncedInvoices: invoices.filter((i) => i.synced === 1).length,
    totalRevenue,
    thisMonthRevenue,
    totalVAT,
    averageInvoice: invoices.length > 0 ? totalRevenue / invoices.length : 0,
  };
};

// ============================================================================
// Metric Card Component
// ============================================================================

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  sublabel?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  delay?: number;
}

const MetricCard = memo(({ icon, label, value, sublabel, variant = 'default', delay = 0 }: MetricCardProps) => (
  <Animated.View
    entering={FadeInDown.duration(300).delay(delay)}
    style={[
      styles.metricCard,
      variant === 'primary' && styles.metricCardPrimary,
      variant === 'success' && styles.metricCardSuccess,
      variant === 'warning' && styles.metricCardWarning,
    ]}
  >
    <Text style={styles.metricIcon}>{icon}</Text>
    <Text style={[styles.metricLabel, variant === 'primary' && styles.metricLabelPrimary]}>
      {label}
    </Text>
    <Text style={[styles.metricValue, variant === 'primary' && styles.metricValuePrimary]}>
      {value}
    </Text>
    {sublabel && (
      <Text style={[styles.metricSublabel, variant === 'primary' && styles.metricSublabelPrimary]}>
        {sublabel}
      </Text>
    )}
  </Animated.View>
));

MetricCard.displayName = 'MetricCard';

// ============================================================================
// Quick Action Button
// ============================================================================

interface QuickActionProps {
  icon: string;
  label: string;
  sublabel: string;
  onPress: () => void;
  delay?: number;
}

const QuickAction = memo(({ icon, label, sublabel, onPress, delay = 0 }: QuickActionProps) => (
  <Animated.View entering={FadeIn.duration(300).delay(delay)}>
    <Pressable
      style={styles.quickAction}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${sublabel}`}
    >
      <View style={styles.quickActionIcon}>
        <Text style={styles.quickActionEmoji}>{icon}</Text>
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
      <Text style={styles.quickActionSublabel}>{sublabel}</Text>
    </Pressable>
  </Animated.View>
));

QuickAction.displayName = 'QuickAction';

// ============================================================================
// Tax Insights Card
// ============================================================================

interface TaxInsightsCardProps {
  annualRevenue: number;
  onViewDetails: () => void;
}

const TaxInsightsCard = memo(({ annualRevenue, onViewDetails }: TaxInsightsCardProps) => {
  const { t } = useTranslation();
  const taxEngineV2Enabled = useFeatureFlag('taxEngineV2');

  const pitCalc = useMemo(() => {
    if (taxEngineV2Enabled) {
      return calculatePIT(annualRevenue);
    }

    const legacy = calculateLegacyPIT({
      annualGrossIncome: annualRevenue,
      annualRent: 0,
      pensionContributions: 0,
      nhfContributions: 0,
      nhisContributions: 0,
      lifeInsurance: 0,
      housingLoanInterest: 0,
    });

    return {
      totalTax: legacy.estimatedTax,
      effectiveRate: legacy.effectiveRate / 100,
      takeHome: legacy.grossIncome - legacy.estimatedTax,
    };
  }, [annualRevenue, taxEngineV2Enabled]);

  const optimization = useMemo(() => {
    if (!taxEngineV2Enabled) {
      return { currentTax: pitCalc.totalTax, potentialSavings: 0, recommendations: [] };
    }
    return getTaxOptimization(annualRevenue, 'sole-prop');
  }, [annualRevenue, pitCalc.totalTax, taxEngineV2Enabled]);

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(400)} style={styles.taxInsightsCard}>
      <View style={styles.taxInsightsHeader}>
        <View style={styles.taxInsightsTitleRow}>
          <Text style={styles.taxInsightsIcon}>📊</Text>
          <Text style={styles.taxInsightsTitle}>{t('dashboard.taxInsights')}</Text>
        </View>
        <View style={styles.taxInsightsBadge}>
          <Text style={styles.taxInsightsBadgeText}>{t('dashboard.estimatedPIT')}</Text>
        </View>
      </View>

      <View style={styles.taxInsightsContent}>
        <View style={styles.taxInsightsRow}>
          <Text style={styles.taxInsightsLabel}>{t('dashboard.estimatedTax')}</Text>
          <Text style={styles.taxInsightsValue}>{formatNaira(pitCalc.totalTax)}</Text>
        </View>
        <View style={styles.taxInsightsRow}>
          <Text style={styles.taxInsightsLabel}>{t('dashboard.effectiveRate')}</Text>
          <Text style={styles.taxInsightsValue}>{formatPercentage(pitCalc.effectiveRate)}</Text>
        </View>
        <View style={styles.taxInsightsRow}>
          <Text style={styles.taxInsightsLabel}>{t('dashboard.takeHome')}</Text>
          <Text style={[styles.taxInsightsValue, styles.taxInsightsValueSuccess]}>
            {formatNaira(pitCalc.takeHome)}
          </Text>
        </View>
      </View>

      {optimization.potentialSavings > 0 && (
        <View style={styles.taxOptimizationHint}>
          <Text style={styles.taxOptimizationIcon}>💡</Text>
          <View style={styles.taxOptimizationContent}>
            <Text style={styles.taxOptimizationText}>
              {t('dashboard.potentialSavings', { amount: formatNaira(optimization.potentialSavings, false) })}
            </Text>
            <Pressable onPress={onViewDetails}>
              <Text style={styles.taxOptimizationLink}>{t('dashboard.viewRecommendations')} →</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Animated.View>
  );
});

TaxInsightsCard.displayName = 'TaxInsightsCard';

// ============================================================================
// Compliance Status Card
// ============================================================================

const ComplianceCard = memo(() => {
  const { t } = useTranslation();
  const { isOnline } = useNetwork();

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(500)} style={styles.complianceCard}>
      <View style={styles.complianceHeader}>
        <Text style={styles.complianceIcon}>🏛️</Text>
        <Text style={styles.complianceTitle}>{t('dashboard.complianceStatus')}</Text>
      </View>

      <View style={styles.complianceItems}>
        <View style={styles.complianceItem}>
          <Text style={styles.complianceCheckIcon}>✓</Text>
          <Text style={styles.complianceItemText}>{t('dashboard.nrsReady')}</Text>
        </View>
        <View style={styles.complianceItem}>
          <Text style={styles.complianceCheckIcon}>✓</Text>
          <Text style={styles.complianceItemText}>{t('dashboard.ndprCompliant')}</Text>
        </View>
        <View style={styles.complianceItem}>
          <Text style={styles.complianceCheckIcon}>✓</Text>
          <Text style={styles.complianceItemText}>{t('dashboard.vatRegistered')}</Text>
        </View>
        <View style={styles.complianceItem}>
          <Text style={[styles.complianceCheckIcon, isOnline ? styles.complianceOnline : styles.complianceOffline]}>
            {isOnline ? '●' : '○'}
          </Text>
          <Text style={styles.complianceItemText}>
            {isOnline ? t('dashboard.syncActive') : t('dashboard.offlineMode')}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

ComplianceCard.displayName = 'ComplianceCard';

// ============================================================================
// Main Dashboard Component
// ============================================================================

function DashboardScreen(props: any) {
  const { t } = useTranslation();
  const { isOnline } = useNetwork();
  const { manualSync, lastSyncAt } = useSyncContext();
  const receiptsScannerEnabled = useFeatureFlag('receiptsScanner');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => calculateStats(invoices), [invoices]);

  // Estimate annual revenue (extrapolate from 30-day average)
  const annualRevenue = useMemo(() => {
    const daysSinceFirst = invoices.length > 0
      ? Math.max(1, (Date.now() - Math.min(...invoices.map(i => i.createdAt))) / (1000 * 60 * 60 * 24))
      : 1;
    const dailyAverage = stats.totalRevenue / daysSinceFirst;
    return dailyAverage * 365;
  }, [invoices, stats.totalRevenue]);

  const loadData = useCallback(async () => {
    try {
      const rows = await getInvoices();
      setInvoices(rows.map(row => ({
        ...row,
        createdAt: new Date(row.createdAt).getTime(),
      })) as Invoice[]);
    } catch (err) {
      if (__DEV__) console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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

  const handleViewTaxDetails = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    props.navigation.navigate('Settings');
  }, [props.navigation]);

  const handleSync = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await manualSync();
      await loadData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [manualSync, loadData]);

  // Format last sync time
  const formatLastSync = useCallback((timestamp: number | null) => {
    if (!timestamp) return t('sync.neverSynced');
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('sync.justNow');
    if (minutes < 60) return t('sync.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    return t('sync.hoursAgo', { count: hours });
  }, [t]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
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
        accessibilityLabel={t('dashboard.mainContent')}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{t('dashboard.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('dashboard.subtitle')}</Text>
          </View>
          <Pressable
            style={[styles.syncButton, !isOnline && styles.syncButtonDisabled]}
            onPress={handleSync}
            disabled={!isOnline}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.syncNow')}
          >
            <Text style={styles.syncButtonIcon}>🔄</Text>
            <Text style={styles.syncButtonText}>{t('dashboard.sync')}</Text>
          </Pressable>
        </Animated.View>

        {/* Network Status */}
        <Animated.View
          entering={FadeInDown.duration(300).delay(100)}
          style={[styles.networkBadge, isOnline ? styles.networkOnline : styles.networkOffline]}
        >
          <Text style={styles.networkIcon}>{isOnline ? '🟢' : '🔴'}</Text>
          <Text style={styles.networkText}>
            {isOnline ? t('dashboard.online') : t('dashboard.offline')}
          </Text>
          <Text style={styles.networkSync}>{t('sync.lastSync')}: {formatLastSync(lastSyncAt)}</Text>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction
              icon="➕"
              label={t('quickActions.create')}
              sublabel={t('quickActions.createSublabel')}
              onPress={handleCreateInvoice}
              delay={250}
            />
            {receiptsScannerEnabled && (
              <QuickAction
                icon="📷"
                label={t('quickActions.scan')}
                sublabel={t('quickActions.scanSublabel')}
                onPress={handleScanReceipt}
                delay={300}
              />
            )}
            <QuickAction
              icon="📋"
              label={t('quickActions.invoices')}
              sublabel={t('quickActions.invoicesSublabel')}
              onPress={handleViewInvoices}
              delay={350}
            />
            <QuickAction
              icon="🧮"
              label={t('quickActions.tax')}
              sublabel={t('quickActions.taxSublabel')}
              onPress={handleViewTaxDetails}
              delay={400}
            />
          </View>
        </Animated.View>

        {/* Metrics Grid */}
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>{t('dashboard.businessOverview')}</Text>
          <View style={styles.metricsGrid}>
            <MetricCard
              icon="💰"
              label={t('dashboard.thisMonth')}
              value={formatNaira(stats.thisMonthRevenue)}
              sublabel={t('dashboard.revenue')}
              variant="primary"
              delay={300}
            />
            <MetricCard
              icon="📄"
              label={t('dashboard.invoices')}
              value={stats.totalInvoices.toString()}
              sublabel={`${stats.syncedInvoices} ${t('dashboard.synced')}`}
              delay={350}
            />
            <MetricCard
              icon="🏛️"
              label={t('dashboard.vatCollected')}
              value={formatNaira(stats.totalVAT)}
              sublabel="7.5%"
              variant="success"
              delay={400}
            />
            <MetricCard
              icon="⏳"
              label={t('dashboard.pending')}
              value={stats.pendingSync.toString()}
              sublabel={t('dashboard.awaitingSync')}
              variant={stats.pendingSync > 0 ? 'warning' : 'default'}
              delay={450}
            />
          </View>
        </View>

        {/* Tax Insights */}
        {stats.totalRevenue > 0 && (
          <TaxInsightsCard annualRevenue={annualRevenue} onViewDetails={handleViewTaxDetails} />
        )}

        {/* Compliance Status */}
        <ComplianceCard />

        {/* App Version Footer */}
        <Animated.View entering={FadeIn.duration(300).delay(600)} style={styles.footer}>
          <Text style={styles.footerText}>TaxBridge V5.0.4</Text>
          <Text style={styles.footerSubtext}>{t('dashboard.footerTagline')}</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default memo(DashboardScreen);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surfaceSlate,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.size.md,
    color: colors.textMuted,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  syncButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  syncButtonIcon: {
    fontSize: typography.size.md,
  },
  syncButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },

  // Network Badge
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  networkOnline: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  networkOffline: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  networkIcon: {
    fontSize: typography.size.sm,
  },
  networkText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  networkSync: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },

  // Section
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Quick Actions
  quickActionsSection: {
    marginBottom: spacing.xl,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickAction: {
    width: (width - spacing.lg * 2 - spacing.md * 3) / 4,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  quickActionIcon: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickActionEmoji: {
    fontSize: typography.size.lg,
  },
  quickActionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  quickActionSublabel: {
    fontSize: typography.size.xxs || 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },

  // Metrics
  metricsSection: {
    marginBottom: spacing.xl,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    width: (width - spacing.lg * 2 - spacing.md) / 2,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.sm,
  },
  metricCardPrimary: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primary,
  },
  metricCardSuccess: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  metricCardWarning: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  metricIcon: {
    fontSize: typography.size.xl,
    marginBottom: spacing.sm,
  },
  metricLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  metricLabelPrimary: {
    color: colors.textOnPrimarySubtle,
  },
  metricValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    color: colors.textPrimary,
  },
  metricValuePrimary: {
    color: colors.textOnPrimary,
  },
  metricSublabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  metricSublabelPrimary: {
    color: colors.textOnPrimarySubtle,
  },

  // Tax Insights
  taxInsightsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.sm,
  },
  taxInsightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSlate,
  },
  taxInsightsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taxInsightsIcon: {
    fontSize: typography.size.xl,
  },
  taxInsightsTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  taxInsightsBadge: {
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  taxInsightsBadgeText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  taxInsightsContent: {
    gap: spacing.md,
  },
  taxInsightsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taxInsightsLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  taxInsightsValue: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  taxInsightsValueSuccess: {
    color: colors.success,
  },
  taxOptimizationHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningBg,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  taxOptimizationIcon: {
    fontSize: typography.size.lg,
  },
  taxOptimizationContent: {
    flex: 1,
  },
  taxOptimizationText: {
    fontSize: typography.size.sm,
    color: colors.warningDark,
    marginBottom: spacing.xs,
  },
  taxOptimizationLink: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },

  // Compliance
  complianceCard: {
    backgroundColor: colors.successBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  complianceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  complianceIcon: {
    fontSize: typography.size.xl,
  },
  complianceTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.successDark,
  },
  complianceItems: {
    gap: spacing.sm,
  },
  complianceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  complianceCheckIcon: {
    fontSize: typography.size.sm,
    color: colors.success,
    fontWeight: typography.weight.bold,
  },
  complianceOnline: {
    color: colors.success,
  },
  complianceOffline: {
    color: colors.warning,
  },
  complianceItemText: {
    fontSize: typography.size.sm,
    color: colors.successDark,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  footerText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  footerSubtext: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
