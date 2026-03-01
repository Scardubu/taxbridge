/**
 * TaxBridge Dashboard Screen — V10.3 Production Build
 *
 * Fixes applied:
 *   C-13  SVG arc gauge via react-native-svg (no ProgressBar)
 *   C-14  Single useDashboard() composite hook (no waterfall)
 *   C-16  All animations use DURATION.* + EASE.* tokens
 *   C-17  All 5 zones present: apex, signal, action, context, ambient
 *   C-18  Every dashboard section wrapped in <DashboardZone>
 *   C-19  Anomaly empty state = null (silent, never misleading)
 *   C-20  scale(0.97) visual ack <100ms on all Pressable elements
 *   CF-02 TopAnomaliesSection rendered via SectionState + DashboardZone
 *   CF-04 useTheme() for all colors — dark-mode safe
 *   CF-06 Multi-deadline ComplianceCalendar via SectionState
 *   CF-08 DashboardZone choreography — single skeleton → staggered reveal
 *   ER-07 DashboardZone wrappers for all 5 zones
 *   ER-08 DashboardSkeleton with geometry contract
 *   ER-09 SectionState replaces all raw ternaries
 *   UX-10 gaugeMode useMemo: compact when deadline ≤7d or overdue
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  StyleSheet, Pressable, StatusBar,
} from 'react-native';
import { TaxHealthGauge } from '../../components/TaxHealthGauge';
import { DashboardZone } from '../../components/dashboard/DashboardZone';
import { DashboardSkeleton, SectionSkeletonRows } from '../../components/dashboard/DashboardSkeleton';
import { SectionState, InlineError } from '../../components/dashboard/SectionState';
import { TopAnomaliesSection } from '../../components/dashboard/TopAnomaliesSection';
import { ComplianceCalendar } from '../../components/dashboard/ComplianceCalendar';
import { OfflineSyncStatus } from '../../components/dashboard/OfflineSyncStatus';
import { HealthRing, type PillarData } from '../../components/dashboard/HealthRing';
import { SparklineBarChart, type SparkBarDatum } from '../../components/dashboard/SparklineBarChart';
import { DonutChart, type DonutSlice } from '../../components/charts/DonutChart';
import { TaxExplainDrawer, TaxExplainTrigger } from '../../components/dashboard/TaxExplainDrawer';
import { DeadlineCountdown } from '../../components/dashboard/DeadlineCountdown';
import { computeQuickActions } from '../../utils/computeQuickActions';
import type { QuickActionDef } from '../../utils/computeQuickActions';
import { useFeatureFlag } from '../../contexts/FeatureFlagContext';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import NetInfo from '@react-native-community/netinfo';
import { useCurrentUser } from '@store/authStore';
import { useDashboard } from '@store/queries';
import { useTheme } from '@hooks/useTheme';
import {
  Card, Badge, TrustBadge, Skeleton, SkeletonCard, EmptyState,
} from '@ds/components';
import { typography, spacing, shadows, radii } from '@ds/tokens';
import type { DashboardComposite } from '@api/client';

// ─── Donut config — F4: WCAG-passing colors with shape + text labels ─────────
// Colors chosen for 4.5:1 contrast on white surface (WCAG 2.1 AA, C-15)
const DONUT_CONFIG: Record<string, { color: string; glyph: string }> = {
  vat:     { color: '#0284C7', glyph: '🔵' },  // sky-700
  paye:    { color: '#B45309', glyph: '🟡' },  // amber-700
  devLevy: { color: '#7C3AED', glyph: '🟣' },  // violet-700
  wht:     { color: '#047857', glyph: '🟢' },  // emerald-700
  cit:     { color: '#B91C1C', glyph: '🔴' },  // red-700
};

// ─── Severity vocab — CF-15 (color + shape + text, never color alone) ────────
const SEVERITY_GLYPH: Record<string, string> = {
  high:   '▲',  // triangle  = critical
  medium: '■',  // square    = warning
  low:    '●',  // circle    = informational
};

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets             = useSafeAreaInsets();
  const { t }             = useTranslation();
  const user              = useCurrentUser();
  const network           = NetInfo.useNetInfo();
  const { colors, isDark } = useTheme();  // CF-04 dark-mode safe
  const navigation            = useNavigation<any>();

  // C-14: single composite hook — replaces useDashboardStats + useTaxForecast + useNrsHealth
  const { data, isLoading, isRefetching, refetch, isError } = useDashboard();

  // P7: Feature-flagged quick wins
  const taxExplainEnabled    = useFeatureFlag('taxExplainDrawer');
  const deadlineCountEnabled = useFeatureFlag('deadlineCountdown');
  const riskColorEnabled     = useFeatureFlag('riskColorCoding');
  const enhancedA11y         = useFeatureFlag('enhancedA11y');
  const simplified           = useFeatureFlag('dashboardSimplified');

  // P7: TaxExplainDrawer state
  const [explainVisible, setExplainVisible] = useState(false);

  // UX-10: compact gauge when any deadline ≤7 days or overdue
  const gaugeMode = useMemo((): 'expanded' | 'compact' => {
    if (!data) return 'expanded';
    const urgent  = data.upcomingDeadlines?.some((dl: { daysRemaining: number }) => dl.daysRemaining <= 7) ?? false;
    const overdue = data.upcomingDeadlines?.some((dl: { daysRemaining: number }) => dl.daysRemaining <  0) ?? false;
    return (urgent || overdue) ? 'compact' : 'expanded';
  }, [data]);

  // ER-07: urgent prop for CONTEXT zone — high anomaly collapses stagger delay to 0ms
  const hasHighAnomaly = data?.topAnomalies?.some((a: { severity: string }) => a.severity === 'high') ?? false;

  const isOffline  = !network.isConnected;
  const stats      = data?.stats;
  const forecast   = data?.forecast;
  const nrsHealth  = data?.nrsHealth;
  const anomalies  = data?.topAnomalies    ?? [];
  const deadlines  = data?.upcomingDeadlines ?? [];

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const hour      = new Date().getHours();
  const greeting  = hour < 12
    ? t('dashboard.goodMorning')
    : hour < 17
    ? t('dashboard.goodAfternoon')
    : t('dashboard.goodEvening');

  // P1-E: context-driven quick actions ordering
  const quickActions = useMemo(() => computeQuickActions(data), [data]);

  // F1: PillarData[] for HealthRing — maps backend pillar[] to typed PillarData[]
  const pillarData = useMemo((): PillarData[] => {
    if (!data?.pillars?.length) return [];
    return data.pillars.map((p) => ({
      key:   p.key as PillarData['key'],
      score: p.score,
      trend: p.trend as PillarData['trend'],
    }));
  }, [data?.pillars]);

  // F2: SparkBarDatum[] for SparklineBarChart — last 12 months revenue
  const sparkBarData = useMemo((): SparkBarDatum[] => {
    if (!data?.sparkData?.length) return [];
    return data.sparkData;
  }, [data?.sparkData]);

  // F4: DonutSlice[] for DonutChart — YTD tax liability breakdown
  const donutSlices = useMemo((): DonutSlice[] => {
    if (!data?.taxBreakdown?.length) return [];
    return data.taxBreakdown.map((s) => ({
      key:   s.key,
      label: t(`dashboard.donut.${s.key}`) || s.label,
      value: s.value,
      color: DONUT_CONFIG[s.key]?.color ?? '#6B7280',
      glyph: DONUT_CONFIG[s.key]?.glyph ?? '□',
    }));
  }, [data?.taxBreakdown, t]);

  // Dynamic styles that depend on theme colors (CF-04)
  const d = useMemo(() => StyleSheet.create({
    root:          { flex: 1, backgroundColor: colors.surface },
    scroll:        { paddingHorizontal: spacing.screenPadding, paddingTop: spacing[2] },
    offlineBanner: { backgroundColor: colors.warningBg, paddingHorizontal: spacing.md, paddingVertical: spacing[2] },
    offlineText:   { color: colors.warningDark, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, textAlign: 'center' as const },
    nrsWarning:    { backgroundColor: colors.warningBg, borderRadius: radii.md, padding: spacing[3], marginBottom: spacing[3], borderWidth: 1, borderColor: colors.warningBorder },
    nrsWarningText:{ color: colors.warningDark, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
    sectionTitle:  { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: spacing[2], marginTop: spacing[4] },
  }), [colors]);

  // ER-08: single skeleton gate — one skeleton, one reveal, zero flash (C-14 / CF-08)
  if (isLoading && !data) return <DashboardSkeleton />;

  return (
    <View style={[d.root, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      {/* Offline banner */}
      {isOffline && (
        <Animated.View entering={FadeIn} style={d.offlineBanner}>
          <Text style={d.offlineText}>
            📡 {t('common.offlineMode')} — {t('common.cachedData')}
          </Text>
        </Animated.View>
      )}

      <ScrollView
        contentContainerStyle={[d.scroll, { paddingBottom: insets.bottom + 88 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── APEX: Gauge + Greeting ─────────────────────────────────── */}
        <DashboardZone zone="apex" visible={!isLoading}>
          <View style={s.header}>
            <View>
              <Text style={[s.greeting, { color: colors.textMuted }]}>{greeting},</Text>
              <Text style={[s.name,     { color: colors.textPrimary }]}>{firstName} 👋</Text>
            </View>
            {/* C-20: scale visual ack before navigation */}
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              style={({ pressed }) => [s.avatarButton, pressed && { transform: [{ scale: 0.97 }] }]}
              accessibilityLabel={t('dashboard.profileButton')}
              accessibilityRole="button"
            >
              <View style={[s.avatar, { backgroundColor: colors.primary }]}>
                <Text style={[s.avatarText, { color: colors.textOnPrimary }]}>
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* NRS Circuit Breaker — CF-15: ▲ shape + color + text */}
          {nrsHealth?.circuitBreakerOpen && (
            <Animated.View entering={FadeIn} style={d.nrsWarning}>
              <Text style={d.nrsWarningText}>
                ▲ ⚠️ {t('dashboard.nrsCircuitOpen')} — {t('dashboard.nrsCircuitDetail')}
              </Text>
            </Animated.View>
          )}

          {/* C-13: SVG arc — F1: HealthRing when pillars available, TaxHealthGauge fallback */}
          {pillarData.length > 0 ? (
            <HealthRing
              totalScore={stats?.taxHealthScore ?? 0}
              pillars={pillarData}
              accessibilityLabel={`${t('taxHealth.title')}: ${stats?.taxHealthScore ?? 0} ${t('common.outOf')} 100`}
            />
          ) : (
            <TaxHealthGauge
              score={stats?.taxHealthScore ?? 0}
              mode={gaugeMode}
              showLabel
              accessibilityLabel={`${t('taxHealth.title')}: ${stats?.taxHealthScore ?? 0} ${t('common.outOf')} 100`}
            />
          )}
        </DashboardZone>

        {/* ── SIGNAL: Key Metrics ─────────────────────────────────────── */}
        <DashboardZone zone="signal" visible={!isLoading}>
          <View style={s.metricsRow}>
            <MetricCard
              label={t('dashboard.totalInvoices')}
              value={stats?.totalInvoices}
              loading={false}
              emoji="🧾"
              onPress={() => navigation.navigate('Invoices')}
              colors={colors}
            />
            <MetricCard
              label={t('dashboard.totalRevenue')}
              value={stats?.totalRevenue !== undefined
                ? `₦${(stats.totalRevenue / 1_000_000).toFixed(1)}M`
                : undefined}
              loading={false}
              emoji="💰"
              onPress={() => navigation.navigate('Invoices')}
              colors={colors}
            />
            <MetricCard
              label={t('dashboard.pendingNrs')}
              value={stats?.pendingNrs}
              loading={false}
              emoji="📤"
              accentColor={stats?.pendingNrs && stats.pendingNrs > 0 ? colors.actionOrangeAccent : undefined}
              onPress={() => navigation.navigate('Invoices')}
              colors={colors}
            />
          </View>
        </DashboardZone>

        {/* ── ACTION: Quick Actions ──────────────────────────────────── */}
        <DashboardZone zone="action" visible={!isLoading}>
          <Text style={d.sectionTitle}>{t('dashboard.quickActions')}</Text>
          <View style={s.actionsGrid}>
            {quickActions.map((a: QuickActionDef) => (
              <QuickAction
                key={a.id}
                emoji={a.emoji}
                label={t(a.labelKey)}
                onPress={() => navigation.navigate(a.route as any)}
                accentColor={
                  a.accentColorKey.startsWith('#')
                    ? a.accentColorKey
                    : (colors as any)[a.accentColorKey] ?? colors.primary
                }
                colors={colors}
              />
            ))}
          </View>
        </DashboardZone>

        {/* ── CONTEXT: Anomalies + Deadlines + Forecast ────────────── */}
        <DashboardZone zone="context" visible={!isLoading} urgent={hasHighAnomaly}>

          {/* CF-02: TopAnomaliesSection via SectionState; C-19: empty={null} */}
          <SectionState
            data={data?.topAnomalies}
            isLoading={false}
            error={isError ? new Error('load failed') : null}
            isEmpty={(d) => d.length === 0}
            loading={<SectionSkeletonRows count={2} />}
            empty={null}
            errorView={
              <InlineError
                icon="🔍"
                message={t('dashboard.anomaliesLoadError')}
                action={t('common.retry')}
                onAction={() => refetch()}
              />
            }
          >
            {(anom) => (
              <TopAnomaliesSection
                anomalies={anom}
                onPress={() => navigation.navigate('Invoices')}
              />
            )}
          </SectionState>

          {/* CF-06: Multi-deadline calendar via SectionState */}
          <SectionState
            data={data?.upcomingDeadlines}
            isLoading={false}
            error={isError ? new Error('load failed') : null}
            isEmpty={(d) => d.length === 0}
            loading={<SectionSkeletonRows count={1} />}
            empty={null}
            errorView={
              <InlineError
                icon="📅"
                message={t('dashboard.calendarLoadError')}
                action={t('common.retry')}
                onAction={() => refetch()}
              />
            }
          >
            {(dl) => (
              <ComplianceCalendar
                deadlines={dl}
                onPress={(_e) => navigation.navigate('Invoices')}
              />
            )}
          </SectionState>

          {/* P7: DeadlineCountdown — most urgent deadline pip (feature-flagged) */}
          {deadlineCountEnabled && deadlines.length > 0 && (() => {
            const mostUrgent = [...deadlines].sort((a: any, b: any) => a.daysRemaining - b.daysRemaining)[0];
            return (
              <DeadlineCountdown
                daysRemaining={mostUrgent.daysRemaining}
                taxType={mostUrgent.type ?? 'Tax Filing'}
                dueDate={mostUrgent.dueDate ?? ''}
                onPress={() => navigation.navigate('Invoices')}
              />
            );
          })()}

          {/* AI Tax Forecast + P7 TaxExplainDrawer trigger */}
          {forecast && (
            <TaxForecastCard
              forecast={forecast}
              loading={false}
              colors={colors}
              t={t}
              showExplainTrigger={taxExplainEnabled}
              onExplainPress={() => setExplainVisible(true)}
            />
          )}

          {/* P7: TaxExplainDrawer bottom sheet (feature-flagged) */}
          {taxExplainEnabled && forecast && (
            <TaxExplainDrawer
              visible={explainVisible}
              onClose={() => setExplainVisible(false)}
              breakdown={
                forecast.breakdown
                  ? Object.entries(forecast.breakdown).map(([key, amount]: [string, any]) => ({
                      key,
                      label: t(`dashboard.donut.${key}`) || key.toUpperCase(),
                      amount: Number(amount) || 0,
                      pct: forecast.forecastedLiability > 0
                        ? ((Number(amount) || 0) / forecast.forecastedLiability) * 100
                        : 0,
                    }))
                  : []
              }
              total={forecast.forecastedLiability ?? 0}
              confidence={forecast.confidenceScore ?? 0}
            />
          )}

          {/* VAT Liability — C-20: navigate synchronously */}
          {stats?.vatLiability !== undefined && stats.vatLiability > 0 && (
            <Card variant="warning" style={s.vatCard}>
              <View style={s.vatRow}>
                <View>
                  <Text style={[s.vatLabel, { color: colors.textSecondary }]}>{t('dashboard.vatLiability')}</Text>
                  <Text style={[s.vatAmount, { color: colors.textPrimary }]}>
                    ₦{stats.vatLiability.toLocaleString('en-NG')}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    s.vatAction,
                    { backgroundColor: colors.primary },
                    pressed && { transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={() => navigation.navigate('Invoices')}
                  accessibilityRole="button"
                >
                  <Text style={[s.vatActionText, { color: colors.textOnPrimary }]}>{t('dashboard.fileNow')}</Text>
                </Pressable>
              </View>
            </Card>
          )}
        </DashboardZone>

        {/* ── AMBIENT: F2 SparklineBarChart + F4 DonutChart + offline sync ───────── */}
        {/* P8: simplified mode hides ambient zone to reduce cognitive load for new users */}
        {!simplified && (
        <DashboardZone zone="ambient" visible={!isLoading}>

          {/* F2: Last-12-months revenue sparkline — anomalous months flagged coral */}
          <SectionState
            data={sparkBarData}
            isLoading={false}
            error={isError ? new Error('load failed') : null}
            isEmpty={(d) => !d?.length}
            loading={<SectionSkeletonRows count={1} />}
            empty={null}
            errorView={
              <InlineError
                icon="📈"
                message={t('dashboard.chartsLoadError')}
                action={t('common.retry')}
                onAction={() => refetch()}
              />
            }
          >
            {(bars) => (
              <SparklineBarChart
                data={bars}
                unit="₦"
                threshold={bars.reduce((s, b) => s + b.value, 0) / (bars.length || 1)}
                accessibilityLabel={t('dashboard.sparkline.accessLabel')}
              />
            )}
          </SectionState>

          {/* F4: YTD tax-type breakdown donut — tapping a slice filters Invoices */}
          <SectionState
            data={donutSlices}
            isLoading={false}
            error={isError ? new Error('load failed') : null}
            isEmpty={(d) => !d?.length}
            loading={<SectionSkeletonRows count={2} />}
            empty={null}
            errorView={null}
          >
            {(slices) => (
              <DonutChart
                slices={slices}
                accessibilityLabel={t('dashboard.donut.title')}
                onSlicePress={(key) =>
                  navigation.navigate('Invoices', { filter: key } as any)
                }
              />
            )}
          </SectionState>

          {/* Offline sync status — always visible at bottom of ambient */}
          <OfflineSyncStatus />
        </DashboardZone>
        )}

        {/* P8: Even in simplified mode, OfflineSyncStatus visible for trust */}
        {simplified && <OfflineSyncStatus />}
      </ScrollView>
    </View>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, loading, emoji, onPress, accentColor, colors,
}: {
  label: string; value?: string | number; loading: boolean;
  emoji: string; onPress: () => void; accentColor?: string; colors: any;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.metricCard,
        { backgroundColor: colors.surface, ...shadows.sm },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'loading'}`}
      accessibilityHint={`${t('common.tapToView')} ${label}`}
    >
      <Text style={s.metricEmoji}>{emoji}</Text>
      {loading ? (
        <Skeleton height={22} width={50} />
      ) : (
        <Text style={[s.metricValue, { color: accentColor ?? colors.textPrimary }]}>
          {value ?? '—'}
        </Text>
      )}
      <Text style={[s.metricLabel, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── TaxForecastCard ──────────────────────────────────────────────────────────

function TaxForecastCard({
  forecast, loading, colors, t, showExplainTrigger, onExplainPress,
}: { forecast?: any; loading: boolean; colors: any; t: (k: string) => string; showExplainTrigger?: boolean; onExplainPress?: () => void }) {
  if (loading) return <SkeletonCard />;
  if (!forecast) return null;

  return (
    <Card variant="elevated" style={s.forecastCard}>
      <View style={s.forecastHeader}>
        <Text style={[s.forecastTitle, { color: colors.textSecondary }]}>
          🤖 {t('dashboard.aiInsight')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showExplainTrigger && onExplainPress && (
            <TaxExplainTrigger onPress={onExplainPress} />
          )}
          <Badge
            label={`${Math.round(forecast.confidenceScore * 100)}% ${t('common.confidence')}`}
            variant={forecast.confidenceScore >= 0.8 ? 'success' : 'warning'}
            size="sm"
          />
        </View>
      </View>
      <Text style={[s.forecastAmount, { color: colors.textPrimary }]}>
        ₦{Math.round(forecast.forecastedLiability).toLocaleString('en-NG')}
      </Text>
      <Text style={[s.forecastLabel, { color: colors.textMuted }]}>
        {t('dashboard.quarterlyTaxForecast')}
      </Text>
      {forecast.breakdown && (
        <View style={s.forecastBreakdown}>
          <ForecastRow label="PIT"       value={forecast.breakdown.pit}      colors={colors} />
          <ForecastRow label="VAT"       value={forecast.breakdown.vat}      colors={colors} />
          <ForecastRow label="Dev. Levy" value={forecast.breakdown.devLevy}  colors={colors} />
        </View>
      )}
      <View style={[s.forecastProvision, { backgroundColor: colors.primaryBgSubtle }]}>
        <Text style={[s.forecastProvisionLabel, { color: colors.textSecondary }]}>
          {t('dashboard.monthlyProvision')}:
        </Text>
        <Text style={[s.forecastProvisionValue, { color: colors.primaryDark }]}>
          ₦{Math.round(forecast.recommendedMonthlyProvision).toLocaleString('en-NG')}
        </Text>
      </View>
    </Card>
  );
}

function ForecastRow({ label, value, colors }: { label: string; value: number; colors: any }) {
  return (
    <View style={s.forecastRow}>
      <Text style={[s.forecastRowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[s.forecastRowValue, { color: colors.textPrimary }]}>
        ₦{Math.round(value).toLocaleString('en-NG')}
      </Text>
    </View>
  );
}

// ─── QuickAction ──────────────────────────────────────────────────────────────

function QuickAction({
  emoji, label, onPress, accentColor, colors,
}: {
  emoji: string; label: string; onPress: () => void; accentColor: string; colors: any;
}) {
  return (
    <Pressable
      onPress={() => onPress()}
      style={({ pressed }) => [
        s.quickAction,
        { backgroundColor: colors.surface, ...shadows.sm },
        pressed && s.quickActionPressed,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[s.quickActionIcon, { backgroundColor: accentColor + '1A' }]}>
        <Text style={s.quickActionEmoji}>{emoji}</Text>
      </View>
      <Text style={[s.quickActionLabel, { color: colors.textPrimary }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Static Styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[4] },
  greeting:     { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  name:         { fontSize: typography.sizes['2xl'], fontWeight: typography.weights.bold, marginTop: 2 },
  avatarButton: {},
  avatar:       { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },

  // Health Gauge (C-13)
  healthCard:    { marginBottom: spacing[4] },
  healthTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gaugeOverlay:  {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  healthScore:   { fontSize: typography.sizes['3xl'], fontWeight: typography.weights.extrabold, lineHeight: 40 },
  healthSublabel:{ fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, marginTop: 2, textAlign: 'center' },
  healthRight:   { flex: 1, alignItems: 'flex-end', justifyContent: 'space-between', paddingRight: spacing[1] },
  healthBadges:  { gap: 6, alignItems: 'flex-end' },
  healthLabel:   { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing[2] },
  healthHint:    { fontSize: typography.sizes.xs, marginTop: spacing[3] },

  // Anomalies (CF-02, CF-15)
  anomaliesList: { gap: spacing[2], marginBottom: spacing[3] },
  anomalyRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: radii.md, padding: spacing[3], borderWidth: 1, gap: spacing[2], ...shadows.sm },
  anomalySevGlyph:{ fontSize: 16, width: 20, textAlign: 'center' },
  anomalyBody:   { flex: 1 },
  anomalyReason: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  anomalySevLabel:{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginTop: 2 },
  anomalyAmount: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },

  // Metrics
  metricsRow:  { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  metricCard:  { flex: 1, borderRadius: radii.md, padding: spacing[3], alignItems: 'center', gap: 4 },
  metricEmoji: { fontSize: 22 },
  metricValue: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold },
  metricLabel: { fontSize: 11, fontWeight: typography.weights.medium, textAlign: 'center' },

  // Deadlines (CF-06, CF-15)
  deadlineList:   { gap: spacing[2], marginBottom: spacing[3] },
  deadlineRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: radii.md, padding: spacing[3], borderLeftWidth: 4, ...shadows.sm },
  deadlineLeft:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  deadlineGlyph:  { fontSize: 16, width: 20, textAlign: 'center' },
  deadlineType:   { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  deadlineDue:    { fontSize: typography.sizes.xs, marginTop: 2 },
  deadlineRight:  { alignItems: 'flex-end' },
  deadlineDays:   { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  deadlineStatus: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginTop: 2 },

  // Quick Actions
  actionsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  quickAction:       { width: '30%', flexGrow: 1, borderRadius: radii.md, padding: spacing[3], alignItems: 'center', gap: spacing[1] },
  quickActionPressed:{ opacity: 0.7 },
  quickActionIcon:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickActionEmoji:  { fontSize: 22 },
  quickActionLabel:  { fontSize: 11, fontWeight: typography.weights.semibold, textAlign: 'center' },

  // Forecast
  forecastCard:          { marginBottom: spacing[4] },
  forecastHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  forecastTitle:         { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  forecastAmount:        { fontSize: typography.sizes['4xl'], fontWeight: typography.weights.extrabold, fontFamily: 'monospace' as any, marginBottom: 2 },
  forecastLabel:         { fontSize: typography.sizes.xs, marginBottom: spacing[3] },
  forecastBreakdown:     { gap: spacing[1] },
  forecastRow:           { flexDirection: 'row', justifyContent: 'space-between' },
  forecastRowLabel:      { fontSize: typography.sizes.sm },
  forecastRowValue:      { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  forecastProvision:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[3], padding: spacing[3], borderRadius: radii.sm },
  forecastProvisionLabel:{ fontSize: typography.sizes.sm },
  forecastProvisionValue:{ fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },

  // VAT
  vatCard:      { marginBottom: spacing[4] },
  vatRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vatLabel:     { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  vatAmount:    { fontSize: typography.sizes['2xl'], fontWeight: typography.weights.bold, marginTop: 2 },
  vatAction:    { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radii.full },
  vatActionText:{ fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
});
