/**
 * TaxBridge Dashboard Screen
 * Elite Nigerian fintech home — Tax Health Score, AI insights, quick actions
 * Offline-aware, animated, accessible, NRS status visible
 */

import React, { useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  StyleSheet, Pressable, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown, FadeIn, SlideInRight,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import NetInfo from '@react-native-community/netinfo';
import { useCurrentUser } from '../store/authStore';
import { useDashboardStats, useTaxForecast, useNrsHealth } from '../store/queries';
import {
  Card, Badge, TrustBadge, Skeleton, SkeletonCard, EmptyState, ProgressBar,
} from '../design-system/components';
import { colors, typography, spacing, shadows, radii } from '../design-system/tokens';

// ─── Dashboard Screen ─────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const user = useCurrentUser();
  const network = NetInfo.useNetInfo();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats, isRefetching } =
    useDashboardStats();
  const { data: forecast, isLoading: forecastLoading } = useTaxForecast();
  const { data: nrsHealth } = useNrsHealth();

  const isOffline = !network.isConnected;

  const onRefresh = useCallback(async () => {
    await refetchStats();
  }, [refetchStats]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('dashboard.goodMorning') : hour < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.gray[50]} />

      {/* Offline Banner */}
      {isOffline && (
        <Animated.View entering={FadeIn} style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📡 {t('common.offlineMode')} — {t('common.cachedData')}
          </Text>
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.avatarButton}
            accessibilityLabel={t('dashboard.profileButton')}
            accessibilityRole="button"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* NRS Circuit Breaker Warning */}
        {nrsHealth?.circuitBreakerOpen && (
          <Animated.View entering={FadeIn} style={styles.nrsWarning}>
            <Text style={styles.nrsWarningText}>
              ⚠️ {t('dashboard.nrsCircuitOpen')} — {t('dashboard.nrsCircuitDetail')}
            </Text>
          </Animated.View>
        )}

        {/* Tax Health Score Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <TaxHealthCard score={stats?.taxHealthScore} loading={statsLoading} />
        </Animated.View>

        {/* Key Metrics Row */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.metricsRow}>
          <MetricCard
            label={t('dashboard.totalInvoices')}
            value={stats?.totalInvoices}
            loading={statsLoading}
            emoji="🧾"
            onPress={() => router.push('/(tabs)/invoices')}
          />
          <MetricCard
            label={t('dashboard.totalRevenue')}
            value={stats?.totalRevenue !== undefined
              ? `₦${(stats.totalRevenue / 1_000_000).toFixed(1)}M`
              : undefined}
            loading={statsLoading}
            emoji="💰"
            onPress={() => router.push('/(tabs)/invoices')}
          />
          <MetricCard
            label={t('dashboard.pendingNrs')}
            value={stats?.pendingNrs}
            loading={statsLoading}
            emoji="📤"
            accentColor={stats?.pendingNrs && stats.pendingNrs > 0 ? colors.accent[500] : undefined}
            onPress={() => router.push('/(tabs)/invoices?status=PENDING_NRS')}
          />
        </Animated.View>

        {/* Next Deadline Banner */}
        {stats?.nextDeadline && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <DeadlineBanner deadline={stats.nextDeadline} />
          </Animated.View>
        )}

        {/* AI Tax Forecast */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <TaxForecastCard forecast={forecast} loading={forecastLoading} />
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
          <View style={styles.actionsGrid}>
            <QuickAction
              emoji="🧾" label={t('dashboard.newInvoice')}
              onPress={() => router.push('/invoices/create')}
              accentColor={colors.primary[500]}
            />
            <QuickAction
              emoji="📷" label={t('dashboard.scanReceipt')}
              onPress={() => router.push('/scan')}
              accentColor={colors.accent[500]}
            />
            <QuickAction
              emoji="🧮" label={t('dashboard.taxCalculator')}
              onPress={() => router.push('/(tabs)/tools')}
              accentColor={colors.info}
            />
            <QuickAction
              emoji="💳" label={t('dashboard.payTax')}
              onPress={() => router.push('/payment')}
              accentColor={colors.primary[700]}
            />
            <QuickAction
              emoji="📊" label={t('dashboard.expenses')}
              onPress={() => router.push('/(tabs)/expenses')}
              accentColor={colors.error}
            />
            <QuickAction
              emoji="🎓" label={t('dashboard.learn')}
              onPress={() => router.push('/(tabs)/learn')}
              accentColor='#8B5CF6'
            />
          </View>
        </Animated.View>

        {/* VAT Liability */}
        {stats?.vatLiability !== undefined && stats.vatLiability > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(400)}>
            <Card variant="warning" style={styles.vatCard}>
              <View style={styles.vatRow}>
                <View>
                  <Text style={styles.vatLabel}>{t('dashboard.vatLiability')}</Text>
                  <Text style={styles.vatAmount}>
                    ₦{stats.vatLiability.toLocaleString('en-NG')}
                  </Text>
                </View>
                <Pressable
                  style={styles.vatAction}
                  onPress={() => router.push('/filing/vat')}
                  accessibilityRole="button"
                >
                  <Text style={styles.vatActionText}>{t('dashboard.fileNow')}</Text>
                </Pressable>
              </View>
            </Card>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaxHealthCard({ score, loading }: { score?: number; loading: boolean }) {
  const { t } = useTranslation();
  if (loading) return <SkeletonCard />;

  const pct   = score ?? 0;
  const color = pct >= 80 ? colors.primary[500] : pct >= 50 ? colors.accent[500] : colors.error;
  const label = pct >= 80
    ? t('dashboard.healthExcellent')
    : pct >= 50
    ? t('dashboard.healthGood')
    : t('dashboard.healthNeedsWork');

  return (
    <Card variant="elevated" style={styles.healthCard}>
      <View style={styles.healthTop}>
        <View>
          <Text style={styles.healthLabel}>{t('dashboard.taxHealthScore')}</Text>
          <Text style={[styles.healthScore, { color }]}>{pct}</Text>
          <Text style={styles.healthSublabel}>{label}</Text>
        </View>
        <View style={styles.healthBadges}>
          <TrustBadge type="encrypted" compact />
          <TrustBadge type="nrs_stamped" compact />
        </View>
      </View>
      <ProgressBar value={pct / 100} color={color} height={8} style={{ marginTop: spacing[3] }} />
      <Text style={styles.healthHint}>{t('dashboard.healthHint')}</Text>
    </Card>
  );
}

function MetricCard({
  label, value, loading, emoji, onPress, accentColor,
}: {
  label: string; value?: string | number; loading: boolean;
  emoji: string; onPress: () => void; accentColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.metricCard}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'loading'}`}
    >
      <Text style={styles.metricEmoji}>{emoji}</Text>
      {loading ? (
        <Skeleton height={22} width={50} />
      ) : (
        <Text style={[styles.metricValue, accentColor && { color: accentColor }]}>
          {value ?? '—'}
        </Text>
      )}
      <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

function DeadlineBanner({ deadline }: {
  deadline: { type: string; date: string; daysRemaining: number };
}) {
  const { t } = useTranslation();
  const isUrgent = deadline.daysRemaining <= 7;
  return (
    <Card
      variant={isUrgent ? 'error' : 'warning'}
      style={styles.deadlineBanner}
      onPress={() => router.push('/(tabs)/tools')}
    >
      <View style={styles.deadlineRow}>
        <Text style={styles.deadlineEmoji}>{isUrgent ? '🚨' : '📅'}</Text>
        <View style={styles.deadlineBody}>
          <Text style={[styles.deadlineLabel, isUrgent && { color: colors.red[700] }]}>
            {deadline.type} {t('dashboard.deadlineDue')} {deadline.date}
          </Text>
          <Text style={styles.deadlineDays}>
            {deadline.daysRemaining} {t('dashboard.daysRemaining')}
          </Text>
        </View>
        <Text style={styles.deadlineChevron}>›</Text>
      </View>
    </Card>
  );
}

function TaxForecastCard({ forecast, loading }: { forecast?: any; loading: boolean }) {
  const { t } = useTranslation();

  if (loading) return <SkeletonCard />;
  if (!forecast) return null;

  return (
    <Card variant="elevated" style={styles.forecastCard}>
      <View style={styles.forecastHeader}>
        <Text style={styles.forecastTitle}>🤖 {t('dashboard.aiInsight')}</Text>
        <Badge
          label={`${Math.round(forecast.confidenceScore * 100)}% ${t('common.confidence')}`}
          variant={forecast.confidenceScore >= 0.8 ? 'success' : 'warning'}
          size="sm"
        />
      </View>
      <Text style={styles.forecastAmount}>
        ₦{Math.round(forecast.forecastedLiability).toLocaleString('en-NG')}
      </Text>
      <Text style={styles.forecastLabel}>{t('dashboard.quarterlyTaxForecast')}</Text>
      <View style={styles.forecastBreakdown}>
        <ForecastRow label="PIT"       value={forecast.breakdown.pit} />
        <ForecastRow label="VAT"       value={forecast.breakdown.vat} />
        <ForecastRow label="Dev. Levy" value={forecast.breakdown.devLevy} />
      </View>
      <View style={styles.forecastProvision}>
        <Text style={styles.forecastProvisionLabel}>
          {t('dashboard.monthlyProvision')}:
        </Text>
        <Text style={styles.forecastProvisionValue}>
          ₦{Math.round(forecast.recommendedMonthlyProvision).toLocaleString('en-NG')}
        </Text>
      </View>
    </Card>
  );
}

function ForecastRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.forecastRow}>
      <Text style={styles.forecastRowLabel}>{label}</Text>
      <Text style={styles.forecastRowValue}>₦{Math.round(value).toLocaleString('en-NG')}</Text>
    </View>
  );
}

function QuickAction({
  emoji, label, onPress, accentColor,
}: {
  emoji: string; label: string; onPress: () => void; accentColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        pressed && styles.quickActionPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: accentColor + '18' }]}>
        <Text style={styles.quickActionEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.quickActionLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.gray[50] },
  scroll:         { paddingHorizontal: spacing.screenPadding, paddingTop: spacing[2] },

  offlineBanner: {
    backgroundColor: colors.accent[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing[2],
  },
  offlineBannerText: {
    color: colors.accent[700],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },

  // Header
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[4] },
  greeting:       { fontSize: typography.sizes.sm, color: colors.textMuted, fontWeight: typography.weights.medium },
  name:           { fontSize: typography.sizes['2xl'], fontWeight: typography.weights.bold, color: colors.textPrimary, marginTop: 2 },
  avatarButton:   { },
  avatar:         {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary[500],
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    color: colors.textInverse, fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },

  nrsWarning: {
    backgroundColor: colors.accent[100],
    borderRadius: radii.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.accent[300],
  },
  nrsWarningText: {
    color: colors.accent[700],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },

  // Health Card
  healthCard:     { marginBottom: spacing[4] },
  healthTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  healthLabel:    { fontSize: typography.sizes.xs, color: colors.textMuted, fontWeight: typography.weights.semibold, textTransform: 'uppercase', letterSpacing: 1 },
  healthScore:    { fontSize: typography.sizes['5xl'], fontWeight: typography.weights.extrabold, lineHeight: 52, marginTop: 2 },
  healthSublabel: { fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: 2 },
  healthBadges:   { gap: 4 },
  healthHint:     { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: spacing[2] },

  // Metrics
  metricsRow:     { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  metricCard: {
    flex: 1, backgroundColor: colors.surface,
    borderRadius: radii.md, padding: spacing[3],
    alignItems: 'center', gap: 4,
    ...shadows.sm,
  },
  metricEmoji:    { fontSize: 22 },
  metricValue: {
    fontSize: typography.sizes.xl, fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 11, color: colors.textMuted,
    fontWeight: typography.weights.medium, textAlign: 'center',
  },

  // Deadline
  deadlineBanner: { marginBottom: spacing[4] },
  deadlineRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  deadlineEmoji:  { fontSize: 24 },
  deadlineBody:   { flex: 1 },
  deadlineLabel:  { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textPrimary },
  deadlineDays:   { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
  deadlineChevron:{ fontSize: 20, color: colors.textMuted },

  // Forecast
  forecastCard:     { marginBottom: spacing[4] },
  forecastHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  forecastTitle:    { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textSecondary },
  forecastAmount: {
    fontSize: typography.sizes['4xl'], fontWeight: typography.weights.extrabold,
    color: colors.textPrimary, marginBottom: 2,
    fontFamily: 'monospace' as any,
  },
  forecastLabel:    { fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing[3] },
  forecastBreakdown:{ gap: 6, marginBottom: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.border },
  forecastRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  forecastRowLabel: { fontSize: typography.sizes.sm, color: colors.textMuted },
  forecastRowValue: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textPrimary },
  forecastProvision:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primary[50], borderRadius: radii.sm, padding: spacing[2.5] },
  forecastProvisionLabel: { fontSize: typography.sizes.sm, color: colors.primary[700] },
  forecastProvisionValue: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.primary[700] },

  // Section
  sectionTitle: {
    fontSize: typography.sizes.base, fontWeight: typography.weights.bold,
    color: colors.textPrimary, marginBottom: spacing[3], marginTop: spacing[2],
  },

  // Quick Actions
  actionsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  quickAction: {
    width: '31%', backgroundColor: colors.surface,
    borderRadius: radii.md, padding: spacing[3],
    alignItems: 'center', gap: spacing[1.5],
    ...shadows.xs,
  },
  quickActionPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  quickActionIcon:    { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  quickActionEmoji:   { fontSize: 22 },
  quickActionLabel:   { fontSize: 11.5, color: colors.textSecondary, fontWeight: typography.weights.medium, textAlign: 'center' },

  // VAT Card
  vatCard:       { marginBottom: spacing[4] },
  vatRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vatLabel:      { fontSize: typography.sizes.xs, color: colors.accent[700], fontWeight: typography.weights.semibold, textTransform: 'uppercase', letterSpacing: 1 },
  vatAmount:     { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.textPrimary, marginTop: 2 },
  vatAction: {
    backgroundColor: colors.primary[500], borderRadius: radii.button,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  vatActionText: { color: colors.textInverse, fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
});
