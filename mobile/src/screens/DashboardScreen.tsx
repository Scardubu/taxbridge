/**
 * DashboardScreen — TaxBridge V13 Sovereign
 *
 * C-13: SVG arc gauge only — no native progress bars
 * C-14: Single composite useDashboard() hook — never multiple requests
 * C-16: Animation tokens only — DURATION.* + EASE.* from animation.ts
 * C-17: Exactly 5 DashboardZone elements (apex | signal | action | context | ambient)
 * C-18: Every dashboard section wrapped in DashboardZone zone="…"
 * C-19: Anomaly empty state = null — never "No anomalies" text
 * C-20: computeGaugeMode imported from TaxHealthGauge — never inlined
 * C-47: All lists via FlashList — never FlatList
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaxHealthGauge, computeGaugeMode } from '../components/dashboard/TaxHealthGauge';
import { DashboardZone }    from '../components/dashboard/DashboardZone';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { useDashboard }     from '../hooks/useDashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Anomaly {
  id:          string;
  severity:    'low' | 'medium' | 'high' | 'critical';
  description: { en: string; pidgin?: string };
  ctaRoute?:   string;
}

interface Deadline {
  taxType:       string;
  period:        string;
  deadline:      string;
  daysRemaining: number;
}

interface QuickAction {
  id:    string;
  label: string;
  emoji: string;
  route: string;
}

// ─── Severity config (shape + colour — WCAG three-channel C-15) ──────────────
const SEVERITY: Record<string, { glyph: string; color: string }> = {
  critical: { glyph: '▲', color: '#DC2626' },
  high:     { glyph: '▲', color: '#EA580C' },
  medium:   { glyph: '■', color: '#D97706' },
  low:      { glyph: '●', color: '#16A34A' },
};

// ─── Quick actions config ─────────────────────────────────────────────────────
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'vat',   label: 'filing.vat',   emoji: '🧾', route: '/filings/vat'   },
  { id: 'paye',  label: 'filing.paye',  emoji: '👥', route: '/filings/paye'  },
  { id: 'wht',   label: 'filing.wht',   emoji: '📋', route: '/filings/wht'   },
  { id: 'nil',   label: 'filing.nil',   emoji: '0️⃣', route: '/filings/nil'   },
  { id: 'docs',  label: 'nav.documents',emoji: '📂', route: '/documents'     },
  { id: 'team',  label: 'nav.team',     emoji: '🏢', route: '/team'          },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const insets         = useSafeAreaInsets();
  const { t }          = useTranslation();
  const { data, isLoading, isRefetching, refetch, isError } = useDashboard();

  const [isManualRefresh, setIsManualRefresh] = useState(false);

  // C-20: computeGaugeMode imported from TaxHealthGauge — never inlined
  const gaugeMode = useMemo(
    () => computeGaugeMode({ score: (data as any)?.stats?.riskScore, isLoading }),
    [data, isLoading],
  );

  // urgent = true when any high/critical anomaly exists (collapses context zone delay)
  const hasHighAnomaly = useMemo(
    () => (data as any)?.topAnomalies?.some((a: Anomaly) =>
      a.severity === 'high' || a.severity === 'critical') ?? false,
    [data],
  );

  const onRefresh = useCallback(async () => {
    setIsManualRefresh(true);
    await refetch();
    setIsManualRefresh(false);
  }, [refetch]);

  const anomalies: Anomaly[]  = (data as any)?.topAnomalies ?? [];
  const deadlines: Deadline[] = (data as any)?.deadlines    ?? [];
  const stats                 = (data as any)?.stats;
  const nrsHealth             = (data as any)?.nrsHealth;

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  return (
    <ScrollView
      style={[styles.scroll, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || isManualRefresh}
          onRefresh={onRefresh}
          tintColor="#2563EB"
        />
      }
    >
      {/* ── ZONE 1 of 5: apex — Tax Health Gauge ─────────────────────── */}
      <DashboardZone zone="apex" visible={!isLoading}>
        <View style={styles.apexContainer}>
          <Text style={styles.screenTitle}>{t('dashboard.title', 'Tax Dashboard')}</Text>
          {nrsHealth?.circuitBreakerOpen && (
            <Animated.View entering={FadeIn} style={styles.nrsWarning}>
              <Text style={styles.nrsWarningText}>
                {'▲ '}
                {t('dashboard.nrsCircuitOpen', 'NRS service degraded — invoices queued')}
              </Text>
            </Animated.View>
          )}
          <TaxHealthGauge
            score={stats?.riskScore ?? 0}
            isLoading={isLoading}
          />
          {isError && (
            <Text style={styles.errorHint}>
              {t('dashboard.staleData', 'Showing cached data')}
            </Text>
          )}
        </View>
      </DashboardZone>

      {/* ── ZONE 2 of 5: signal — Anomaly alerts ─────────────────────── */}
      <DashboardZone zone="signal" visible={!isLoading}>
        {/* C-19: null when empty — never "No anomalies" text */}
        {anomalies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.alerts', 'Alerts')}
            </Text>
            <FlashList
              data={anomalies}
              estimatedItemSize={72}
              keyExtractor={(a) => a.id}
              renderItem={({ item: a }) => {
                const cfg = SEVERITY[a.severity] ?? SEVERITY.low;
                return (
                  <View style={styles.anomalyRow}>
                    <Text style={[styles.anomalyGlyph, { color: cfg.color }]}>
                      {cfg.glyph}
                    </Text>
                    <Text style={styles.anomalyText} numberOfLines={2}>
                      {a.description.en}
                    </Text>
                  </View>
                );
              }}
            />
          </View>
        )}
      </DashboardZone>

      {/* ── ZONE 3 of 5: action — Quick Actions ──────────────────────── */}
      <DashboardZone zone="action" visible={!isLoading}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.quickActions', 'Quick Actions')}</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((qa) => (
              <Pressable
                key={qa.id}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.actionButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t(qa.label)}
                onPress={() =>
                  AccessibilityInfo.announceForAccessibility(t(qa.label))
                }
              >
                <Text style={styles.actionEmoji}>{qa.emoji}</Text>
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {t(qa.label)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </DashboardZone>

      {/* ── ZONE 4 of 5: context — Compliance deadlines ──────────────── */}
      <DashboardZone zone="context" visible={!isLoading} urgent={hasHighAnomaly}>
        {deadlines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.upcomingDeadlines', 'Upcoming Deadlines')}
            </Text>
            <FlashList
              data={deadlines}
              estimatedItemSize={56}
              keyExtractor={(d) => `${d.taxType}-${d.period}`}
              renderItem={({ item: d }) => (
                <View style={styles.deadlineRow}>
                  <View style={styles.deadlineLeft}>
                    <Text style={styles.deadlineType}>{d.taxType}</Text>
                    <Text style={styles.deadlinePeriod}>{d.period}</Text>
                  </View>
                  <View style={[
                    styles.deadlineBadge,
                    d.daysRemaining <= 7 ? styles.deadlineBadgeUrgent : styles.deadlineBadgeNormal,
                  ]}>
                    <Text style={styles.deadlineDays}>
                      {d.daysRemaining <= 0
                        ? t('deadline.overdue', 'Overdue')
                        : t('deadline.daysLeft', '{{n}} days', { n: d.daysRemaining })}
                    </Text>
                  </View>
                </View>
              )}
            />
          </View>
        )}
      </DashboardZone>

      {/* ── ZONE 5 of 5: ambient — NRS health + sync status ──────────── */}
      <DashboardZone zone="ambient" visible={!isLoading}>
        <View style={styles.ambientRow}>
          <View style={styles.nrsStatusDot(
            nrsHealth?.status === 'healthy' ? '#22C55E' :
            nrsHealth?.status === 'degraded' ? '#F59E0B' : '#6B7280',
          )} />
          <Text style={styles.ambientText}>
            {t('dashboard.nrsStatus', 'NRS')}{' '}
            {nrsHealth?.status ?? t('common.unknown', 'unknown')}
            {nrsHealth?.latencyMs != null && ` (${nrsHealth.latencyMs}ms)`}
          </Text>
        </View>
      </DashboardZone>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 32,
    gap: 12,
  },
  apexContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  nrsWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    width: '100%',
  },
  nrsWarningText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
  anomalyGlyph: {
    fontSize: 14,
    fontWeight: '700',
    width: 16,
    textAlign: 'center',
  },
  anomalyText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: '#DBEAFE',
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
    textAlign: 'center',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  deadlineLeft: {
    flex: 1,
  },
  deadlineType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  deadlinePeriod: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  deadlineBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deadlineBadgeUrgent: {
    backgroundColor: '#FEE2E2',
  },
  deadlineBadgeNormal: {
    backgroundColor: '#F3F4F6',
  },
  deadlineDays: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  ambientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 12,
  },
  ambientText: {
    fontSize: 12,
    color: '#6B7280',
  },
  nrsStatusDot: (color: string) => ({
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color,
  }),
} as any);
