/**
 * TaxBridge Dashboard Screen — V3.0 Production Build
 *
 * Fixes applied:
 *   C-13  SVG arc gauge via react-native-svg (no ProgressBar)
 *   C-14  Single useDashboard() composite hook (no waterfall)
 *   CF-02 TopAnomaliesSection rendered when anomalies exist
 *   CF-04 useTheme() for all colors — dark-mode safe
 *   CF-06 Multi-deadline ComplianceCalendar section
 *   CF-15 Severity indicators: color + shape icon + text label (WCAG 2.1 AA)
 */

import React, { useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  StyleSheet, Pressable, StatusBar,
} from 'react-native';
import TaxHealthGauge from '@components/TaxHealthGauge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';
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

  // C-14: single composite hook — replaces useDashboardStats + useTaxForecast + useNrsHealth
  const { data, isLoading, isRefetching, refetch, isError } = useDashboard();

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

  // Dynamic styles that depend on theme colors (CF-04)
  const d = useMemo(() => StyleSheet.create({
    root:          { flex: 1, backgroundColor: colors.background },
    scroll:        { paddingHorizontal: spacing.screenPadding, paddingTop: spacing[2] },
    offlineBanner: { backgroundColor: colors.accent[100], paddingHorizontal: spacing.md, paddingVertical: spacing[2] },
    offlineText:   { color: colors.accent[700], fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, textAlign: 'center' as const },
    nrsWarning:    { backgroundColor: colors.accent[100], borderRadius: radii.md, padding: spacing[3], marginBottom: spacing[3], borderWidth: 1, borderColor: colors.accent[300] },
    nrsWarningText:{ color: colors.accent[700], fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
    sectionTitle:  { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: spacing[2], marginTop: spacing[4] },
  }), [colors]);

  return (
    <View style={[d.root, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
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
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        {/* ── APEX: Header ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
          <View>
            <Text style={[s.greeting, { color: colors.textMuted }]}>{greeting},</Text>
            <Text style={[s.name,     { color: colors.textPrimary }]}>{firstName} 👋</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={s.avatarButton}
            accessibilityLabel={t('dashboard.profileButton')}
            accessibilityRole="button"
          >
            <View style={[s.avatar, { backgroundColor: colors.primary[500] }]}>
              <Text style={[s.avatarText, { color: colors.textInverse }]}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* NRS Circuit Breaker — CF-15: ▲ shape + color + text */}
        {nrsHealth?.circuitBreakerOpen && (
          <Animated.View entering={FadeIn} style={d.nrsWarning}>
            <Text style={d.nrsWarningText}>
              ▲ ⚠️ {t('dashboard.nrsCircuitOpen')} — {t('dashboard.nrsCircuitDetail')}
            </Text>
          </Animated.View>
        )}

        {/* ── APEX: Tax Health Gauge — C-13 SVG arc ────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          {isLoading
            ? <SkeletonCard />
            : <TaxHealthGauge score={stats?.taxHealthScore ?? 0} showLabel />
          }
        </Animated.View>

        {/* ── SIGNAL: Anomaly alerts — CF-02 ───────────────────────────── */}
        {anomalies.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <Text style={d.sectionTitle}>{t('dashboard.anomalyTitle')}</Text>
            <TopAnomaliesSection anomalies={anomalies} colors={colors} t={t} />
          </Animated.View>
        )}

        {/* ── SIGNAL: Key Metrics ──────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={s.metricsRow}>
          <MetricCard
            label={t('dashboard.totalInvoices')}
            value={stats?.totalInvoices}
            loading={isLoading}
            emoji="🧾"
            onPress={() => router.push('/(tabs)/invoices')}
            colors={colors}
          />
          <MetricCard
            label={t('dashboard.totalRevenue')}
            value={stats?.totalRevenue !== undefined
              ? `₦${(stats.totalRevenue / 1_000_000).toFixed(1)}M`
              : undefined}
            loading={isLoading}
            emoji="💰"
            onPress={() => router.push('/(tabs)/invoices')}
            colors={colors}
          />
          <MetricCard
            label={t('dashboard.pendingNrs')}
            value={stats?.pendingNrs}
            loading={isLoading}
            emoji="📤"
            accentColor={stats?.pendingNrs && stats.pendingNrs > 0 ? colors.accent[500] : undefined}
            onPress={() => router.push('/(tabs)/invoices?status=PENDING_NRS')}
            colors={colors}
          />
        </Animated.View>

        {/* ── CONTEXT: Upcoming deadlines — CF-06 multi-deadline ───────── */}
        {(isLoading || deadlines.length > 0) && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text style={d.sectionTitle}>{t('dashboard.upcomingDeadlines')}</Text>
            <ComplianceCalendar
              deadlines={deadlines}
              loading={isLoading}
              colors={colors}
              t={t}
            />
          </Animated.View>
        )}

        {/* ── ACTION: Quick Actions ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <Text style={d.sectionTitle}>{t('dashboard.quickActions')}</Text>
          <View style={s.actionsGrid}>
            <QuickAction emoji="🧾" label={t('dashboard.newInvoice')}    onPress={() => router.push('/invoices/create')}    accentColor={colors.primary[500]} colors={colors} />
            <QuickAction emoji="📷" label={t('dashboard.scanReceipt')}   onPress={() => router.push('/scan')}               accentColor={colors.accent[500]}  colors={colors} />
            <QuickAction emoji="🧮" label={t('dashboard.taxCalculator')} onPress={() => router.push('/(tabs)/tools')}       accentColor={colors.info}         colors={colors} />
            <QuickAction emoji="💳" label={t('dashboard.payTax')}        onPress={() => router.push('/payment')}            accentColor={colors.primary[700]} colors={colors} />
            <QuickAction emoji="📊" label={t('dashboard.expenses')}      onPress={() => router.push('/(tabs)/expenses')}    accentColor={colors.error}        colors={colors} />
            <QuickAction emoji="🎓" label={t('dashboard.learn')}         onPress={() => router.push('/(tabs)/learn')}       accentColor="#8B5CF6"             colors={colors} />
          </View>
        </Animated.View>

        {/* ── CONTEXT: AI Tax Forecast ──────────────────────────────────── */}
        {(isLoading || forecast) && (
          <Animated.View entering={FadeInDown.delay(280).duration(400)}>
            <TaxForecastCard forecast={forecast} loading={isLoading} colors={colors} t={t} />
          </Animated.View>
        )}

        {/* ── CONTEXT: VAT Liability ────────────────────────────────────── */}
        {stats?.vatLiability !== undefined && stats.vatLiability > 0 && (
          <Animated.View entering={FadeInDown.delay(320).duration(400)}>
            <Card variant="warning" style={s.vatCard}>
              <View style={s.vatRow}>
                <View>
                  <Text style={[s.vatLabel, { color: colors.textSecondary }]}>{t('dashboard.vatLiability')}</Text>
                  <Text style={[s.vatAmount, { color: colors.textPrimary }]}>
                    ₦{stats.vatLiability.toLocaleString('en-NG')}
                  </Text>
                </View>
                <Pressable
                  style={[s.vatAction, { backgroundColor: colors.primary[500] }]}
                  onPress={() => router.push('/filing/vat')}
                  accessibilityRole="button"
                >
                  <Text style={[s.vatActionText, { color: colors.textInverse }]}>{t('dashboard.fileNow')}</Text>
                </Pressable>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Error state */}
        {isError && !isLoading && !data && (
          <EmptyState
            emoji="⚠️"
            title={t('common.errorTitle')}
            body={t('common.errorSubtitle')}
            action={{ label: t('common.retry'), onPress: () => refetch() }}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ─── TopAnomaliesSection — CF-02 (visibility) + CF-15 (shape+color+text) ─────

type Anomaly = NonNullable<DashboardComposite['topAnomalies']>[number];

function TopAnomaliesSection({
  anomalies, colors, t,
}: { anomalies: Anomaly[]; colors: any; t: (k: string) => string }) {
  return (
    <View style={s.anomaliesList}>
      {anomalies.slice(0, 4).map((a, i) => {
        const sev      = (a.severity ?? 'low') as 'high' | 'medium' | 'low';
        // CF-15: severity expressed via shape glyph + color + text label — never color alone
        const sevColor = sev === 'high' ? colors.error : sev === 'medium' ? colors.accent[600] : colors.info;
        const glyph    = SEVERITY_GLYPH[sev];
        const sevLabel = sev === 'high'
          ? t('dashboard.severityHigh')
          : sev === 'medium'
          ? t('dashboard.severityMedium')
          : t('dashboard.severityLow');

        return (
          <Pressable
            key={a.expenseId ?? String(i)}
            style={[
              s.anomalyRow,
              { backgroundColor: colors.surface, borderColor: sevColor + '44' },
            ]}
            onPress={() => router.push('/(tabs)/insights')}
            accessibilityRole="button"
            accessibilityLabel={`${sevLabel}: ${a.anomalyReason}. ₦${a.amount}`}
          >
            <Text style={[s.anomalySevGlyph, { color: sevColor }]} accessibilityElementsHidden>
              {glyph}
            </Text>
            <View style={s.anomalyBody}>
              <Text style={[s.anomalyReason, { color: colors.textPrimary }]} numberOfLines={2}>
                {a.anomalyReason}
              </Text>
              {/* CF-15: text label always present alongside color */}
              <Text style={[s.anomalySevLabel, { color: sevColor }]}>
                {glyph} {sevLabel}
              </Text>
            </View>
            <Text style={[s.anomalyAmount, { color: colors.textPrimary }]}>
              ₦{a.amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── ComplianceCalendar — CF-06: multi-deadline list ─────────────────────────

type Deadline = NonNullable<DashboardComposite['upcomingDeadlines']>[number];

function ComplianceCalendar({
  deadlines, loading, colors, t,
}: { deadlines: Deadline[]; loading: boolean; colors: any; t: (k: string) => string }) {
  if (loading) return <Skeleton height={64} style={{ marginBottom: spacing[3] }} />;
  if (deadlines.length === 0) return null;

  return (
    <View style={s.deadlineList}>
      {deadlines.slice(0, 5).map((d) => {
        const isOverdue = d.status === 'overdue';
        const isUrgent  = !isOverdue && d.daysRemaining <= 7;

        // CF-15: shape (▲/■/●) + color + text — never color alone
        const glyph      = isOverdue ? '▲' : isUrgent ? '■' : '●';
        const badgeColor = isOverdue ? colors.error : isUrgent ? colors.accent[500] : colors.primary[500];
        const statusText = isOverdue
          ? t('dashboard.deadlineOverdue')
          : isUrgent
          ? t('common.urgent')
          : t('common.upcoming');

        return (
          <Pressable
            key={d.id}
            style={[
              s.deadlineRow,
              { backgroundColor: colors.surface, borderLeftColor: badgeColor },
            ]}
            onPress={() => router.push('/(tabs)/tools')}
            accessibilityRole="button"
            accessibilityLabel={`${d.type}, ${statusText}, ${d.daysRemaining} ${t('dashboard.daysRemaining')}`}
          >
            <View style={s.deadlineLeft}>
              <Text style={[s.deadlineGlyph, { color: badgeColor }]}>{glyph}</Text>
              <View>
                <Text style={[s.deadlineType, { color: colors.textPrimary }]}>{d.type}</Text>
                <Text style={[s.deadlineDue,  { color: colors.textMuted }]}>{d.dueDate}</Text>
              </View>
            </View>
            <View style={s.deadlineRight}>
              <Text style={[s.deadlineDays, { color: badgeColor }]}>
                {isOverdue ? t('common.overdue') : `${d.daysRemaining}d`}
              </Text>
              {/* CF-15: always show status text label */}
              <Text style={[s.deadlineStatus, { color: badgeColor }]}>{statusText}</Text>
            </View>
          </Pressable>
        );
      })}
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
  return (
    <Pressable
      onPress={onPress}
      style={[s.metricCard, { backgroundColor: colors.surface, ...shadows.sm }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'loading'}`}
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
  forecast, loading, colors, t,
}: { forecast?: any; loading: boolean; colors: any; t: (k: string) => string }) {
  if (loading) return <SkeletonCard />;
  if (!forecast) return null;

  return (
    <Card variant="elevated" style={s.forecastCard}>
      <View style={s.forecastHeader}>
        <Text style={[s.forecastTitle, { color: colors.textSecondary }]}>
          🤖 {t('dashboard.aiInsight')}
        </Text>
        <Badge
          label={`${Math.round(forecast.confidenceScore * 100)}% ${t('common.confidence')}`}
          variant={forecast.confidenceScore >= 0.8 ? 'success' : 'warning'}
          size="sm"
        />
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
      <View style={[s.forecastProvision, { backgroundColor: (colors.primary as any)[50] ?? colors.surface }]}>
        <Text style={[s.forecastProvisionLabel, { color: colors.textSecondary }]}>
          {t('dashboard.monthlyProvision')}:
        </Text>
        <Text style={[s.forecastProvisionValue, { color: colors.primary[600] }]}>
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
      onPress={onPress}
      style={({ pressed }) => [
        s.quickAction,
        { backgroundColor: colors.surface, ...shadows.sm },
        pressed && s.quickActionPressed,
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
    width: GAUGE_SIZE, height: GAUGE_SIZE,
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
