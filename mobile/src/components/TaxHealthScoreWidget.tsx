/**
 * TaxHealthScoreWidget — TaxBridge V3.0
 *
 * Animated SVG circular progress ring displaying the user's 0–100 Tax Health Score.
 *
 * Features:
 *  • Circular ring animates from 0 → score on mount (1.2 s ease-out)
 *  • Ring colour changes based on score band
 *  • Trend arrow + Δ vs 30 days ago
 *  • Grade label toggles between English and Nigerian Pidgin on tap
 *  • Skeleton placeholder while data is loading
 *  • Tapping the card invokes onPress (e.g. navigate to full breakdown)
 *  • Fully localised via react-i18next
 *  • Dark mode via useTheme()
 *
 * Design tokens: mobile/src/theme/tokens.ts
 * i18n namespace: taxHealth  (en.json lines 1495–1536)
 *
 * @see backend/src/services/tax-health-score.ts  — data shape source of truth
 */

import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { spacing, radii, typography } from '../theme/tokens';

// ─── Types (mirrored from backend service to avoid cross-boundary imports) ────

export type TaxHealthGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type TaxHealthTrend = 'improving' | 'stable' | 'declining';

export interface TaxHealthComponents {
  filingTimeliness:   number;   // max 30
  dataCompleteness:   number;   // max 25
  complianceCalendar: number;   // max 20
  nrsSubmissions:     number;   // max 15
  paymentHistory:     number;   // max 10
}

export interface TaxHealthScoreData {
  score:       number;
  grade:       TaxHealthGrade;
  trend:       TaxHealthTrend;
  trendDelta:  number;
  components?: TaxHealthComponents;
  topRecommendation?: { en: string; pidgin: string };
  computedAt?: string;
}

export interface TaxHealthScoreWidgetProps extends TaxHealthScoreData {
  /** Called when the user taps the widget (e.g. navigate to breakdown screen) */
  onPress?:  () => void;
  /** Display skeleton placeholder while fetching */
  isLoading?: boolean;
  /** Opt-out of the press animation for embedding inside lists */
  disablePressEffect?: boolean;
}

// ─── SVG constants ────────────────────────────────────────────────────────────

const RING_SIZE     = 140;
const STROKE_WIDTH  = 12;
const RADIUS        = (RING_SIZE - STROKE_WIDTH) / 2;   // 64
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;             // ≈ 402.1

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function gradeToColor(grade: TaxHealthGrade, darkMode: boolean): string {
  const palette: Record<TaxHealthGrade, string> = {
    excellent: '#22c55e',   // green-500
    good:      '#3b82f6',   // blue-500
    fair:      '#f59e0b',   // amber-500
    poor:      '#f97316',   // orange-500
    critical:  '#ef4444',   // red-500
  };
  // Slightly brighter in dark mode for contrast
  const darkPalette: Record<TaxHealthGrade, string> = {
    excellent: '#4ade80',
    good:      '#60a5fa',
    fair:      '#fbbf24',
    poor:      '#fb923c',
    critical:  '#f87171',
  };
  return darkMode ? darkPalette[grade] : palette[grade];
}

const GRADE_PIDGIN: Record<TaxHealthGrade, string> = {
  excellent: 'Tax Champion — You sabi am!',
  good:      'E good — small-small improve',
  fair:      'E dey go — do better',
  poor:      'E no good — fix am now',
  critical:  'WAHALA — do am now-now!',
};

const TREND_ARROW: Record<TaxHealthTrend, string> = {
  improving: '↑',
  stable:    '→',
  declining: '↓',
};

const TREND_COLOR = {
  improving: '#22c55e',
  stable:    '#6b7280',
  declining: '#ef4444',
} as const;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonWidget({ isDark }: { isDark: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });
  const base    = isDark ? '#374151' : '#e5e7eb';

  return (
    <Animated.View style={[styles.skeletonContainer, { opacity, backgroundColor: isDark ? '#1f2937' : '#f9fafb' }]}>
      <View style={[styles.skeletonRing, { borderColor: base }]} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { width: 80, backgroundColor: base }]} />
        <View style={[styles.skeletonLine, { width: 120, backgroundColor: base, marginTop: spacing.xs }]} />
        <View style={[styles.skeletonLine, { width: 60, backgroundColor: base, marginTop: spacing.xs }]} />
      </View>
    </Animated.View>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

function TaxHealthScoreWidget({
  score,
  grade,
  trend,
  trendDelta,
  components,
  topRecommendation,
  computedAt,
  onPress,
  isLoading    = false,
  disablePressEffect = false,
}: TaxHealthScoreWidgetProps) {
  const { t, i18n }    = useTranslation('translation');
  const { colors, isDark } = useTheme();

  // ── Pidgin toggle ──────────────────────────────────────────────────────────
  const [showPidgin, setShowPidgin] = useState(false);
  const togglePidgin = useCallback(() => setShowPidgin(p => !p), []);

  // ── SVG ring animation ─────────────────────────────────────────────────────
  const dashOffset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  useEffect(() => {
    if (isLoading) return;
    const targetOffset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, score)) / 100);
    Animated.timing(dashOffset, {
      toValue:         targetOffset,
      duration:        1200,
      useNativeDriver: false,   // SVG props are not supported by native driver
    }).start();
  }, [dashOffset, score, isLoading]);

  // ── Press scale (Reanimated for the card shell) ────────────────────────────
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // ── Derived values ─────────────────────────────────────────────────────────
  const ringColor     = gradeToColor(grade, isDark);
  const scoreLabel    = `${Math.round(score)}`;
  const gradeLabel    = showPidgin
    ? GRADE_PIDGIN[grade]
    : t(`taxHealth.grade.${grade}`, grade);
  const trendLabel    = t(`taxHealth.trend.${trend}`, trend);
  const trendArrow    = TREND_ARROW[trend];
  const trendColor    = TREND_COLOR[trend];
  const deltaText     = trendDelta >= 0 ? `+${trendDelta}` : `${trendDelta}`;
  const recommendation = showPidgin
    ? topRecommendation?.pidgin
    : topRecommendation?.en;

  // ── Accessibility ──────────────────────────────────────────────────────────
  const a11yLabel = `${t('taxHealth.title')}: ${scoreLabel} out of 100. Grade: ${grade}. Trend: ${trendLabel} ${deltaText} points.`;

  if (isLoading) {
    return <SkeletonWidget isDark={isDark} />;
  }

  return (
    <AnimatedPressable
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: isDark ? colors.border : '#e5e7eb' },
        !disablePressEffect && pressStyle,
      ]}
      onPress={onPress}
      onPressIn={() => {
        if (!disablePressEffect) pressScale.value = withSpring(0.97, { damping: 18 });
      }}
      onPressOut={() => {
        if (!disablePressEffect) pressScale.value = withSpring(1, { damping: 18 });
      }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={onPress ? t('taxHealth.viewBreakdown', 'View Breakdown') : undefined}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('taxHealth.title', 'Tax Health Score')}
        </Text>
        <Pressable
          onPress={togglePidgin}
          accessibilityRole="button"
          accessibilityLabel={showPidgin ? 'Switch to English' : 'Switch to Pidgin'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.langToggle, { color: colors.primary ?? '#2563eb' }]}>
            {showPidgin ? 'EN' : 'PID'}
          </Text>
        </Pressable>
      </View>

      {/* ── Body: ring + score details ─────────────────────────────────── */}
      <View style={styles.body}>
        {/* SVG Ring */}
        <View style={styles.ringWrapper}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <G rotation="-90" origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
              {/* Track circle */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={isDark ? '#374151' : '#e5e7eb'}
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              {/* Animated progress circle */}
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={ringColor}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            </G>
          </Svg>

          {/* Score label overlay */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <View style={styles.ringCenter}>
              <Text style={[styles.scoreNumber, { color: colors.textPrimary }]}>
                {scoreLabel}
              </Text>
              <Text style={[styles.scoreMax, { color: colors.textSecondary }]}>
                /100
              </Text>
            </View>
          </View>
        </View>

        {/* Score details */}
        <View style={styles.details}>
          {/* Grade with pidgin toggle */}
          <Pressable onPress={togglePidgin} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
            <Text style={[styles.grade, { color: ringColor }]}>{gradeLabel}</Text>
          </Pressable>

          {/* Trend row */}
          <View style={styles.trendRow}>
            <Text style={[styles.trendArrow, { color: trendColor }]}>{trendArrow}</Text>
            <Text style={[styles.trendText, { color: trendColor }]}>
              {' '}{trendLabel}{' '}
            </Text>
            <Text style={[styles.trendDelta, { color: trendColor }]}>({deltaText})</Text>
          </View>

          {/* Top recommendation */}
          {recommendation ? (
            <View style={[styles.tipBox, { backgroundColor: isDark ? '#1f2937' : '#f0f9ff', borderColor: isDark ? '#374151' : '#bfdbfe' }]}>
              <Text style={[styles.tipText, { color: colors.textSecondary }]} numberOfLines={3}>
                {recommendation}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Component breakdown bars ────────────────────────────────────── */}
      {components ? (
        <View style={styles.breakdown}>
          <BreakdownBar
            label={t('taxHealth.components.filingTimeliness', 'Filing Timeliness')}
            value={components.filingTimeliness}
            max={30}
            color={ringColor}
            isDark={isDark}
            textColor={colors.textSecondary}
          />
          <BreakdownBar
            label={t('taxHealth.components.dataCompleteness', 'Data Completeness')}
            value={components.dataCompleteness}
            max={25}
            color={ringColor}
            isDark={isDark}
            textColor={colors.textSecondary}
          />
          <BreakdownBar
            label={t('taxHealth.components.nrsSubmissions', 'NRS Submissions')}
            value={components.nrsSubmissions}
            max={15}
            color={ringColor}
            isDark={isDark}
            textColor={colors.textSecondary}
          />
          <BreakdownBar
            label={t('taxHealth.components.paymentHistory', 'Payment History')}
            value={components.paymentHistory}
            max={10}
            color={ringColor}
            isDark={isDark}
            textColor={colors.textSecondary}
          />
        </View>
      ) : null}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        {computedAt ? (
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {t('taxHealth.lastUpdated', 'Last updated')}{' '}
            {new Date(computedAt).toLocaleDateString(i18n.language, {
              day:   '2-digit',
              month: 'short',
              year:  'numeric',
            })}
          </Text>
        ) : null}
        {onPress ? (
          <Text style={[styles.viewBreakdown, { color: colors.primary ?? '#2563eb' }]}>
            {t('taxHealth.viewBreakdown', 'View Breakdown')} →
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

// ─── Sub-component: breakdown bar ─────────────────────────────────────────────

interface BreakdownBarProps {
  label:     string;
  value:     number;
  max:       number;
  color:     string;
  isDark:    boolean;
  textColor: string;
}

function BreakdownBar({ label, value, max, color, isDark, textColor }: BreakdownBarProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue:         pct,
      duration:        900,
      delay:           300,
      useNativeDriver: false,
    }).start();
  }, [width, pct]);

  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <Text style={[styles.barValue, { color: textColor }]}>
        {value}/{max}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Card
  card: {
    borderRadius: radii.lg ?? 16,
    borderWidth:  1,
    padding:      spacing.md ?? 16,
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius:  8,
      },
      android: { elevation: 3 },
    }),
  },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.sm ?? 8,
  },
  title: {
    fontSize:   typography.size.md,
    fontWeight: '700',
  },
  langToggle: {
    fontSize:   11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Body
  body: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md ?? 16,
  },
  ringWrapper: {
    width:  RING_SIZE,
    height: RING_SIZE,
    position: 'relative',
  },
  ringCenter: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'flex-end',
    justifyContent:  'center',
    paddingBottom:   spacing.sm ?? 8,
  },
  scoreNumber: {
    fontSize:   36,
    fontWeight: '800',
    lineHeight: 44,
  },
  scoreMax: {
    fontSize:    14,
    fontWeight:  '500',
    lineHeight:  22,
    paddingBottom: 4,
  },

  // Details
  details: {
    flex:           1,
    flexShrink:     1,
    gap:            spacing.xs ?? 4,
  },
  grade: {
    fontSize:   16,
    fontWeight: '700',
    flexWrap:   'wrap',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
  },
  trendArrow: {
    fontSize:   18,
    fontWeight: '700',
  },
  trendText: {
    fontSize:   13,
    fontWeight: '600',
  },
  trendDelta: {
    fontSize:   12,
    fontWeight: '500',
  },
  tipBox: {
    marginTop:    spacing.xs ?? 4,
    borderRadius: radii.sm ?? 8,
    borderWidth:  1,
    padding:      spacing.xs ?? 4,
  },
  tipText: {
    fontSize:   12,
    lineHeight: 16,
  },

  // Breakdown bars
  breakdown: {
    marginTop: spacing.md ?? 16,
    gap:       spacing.xs ?? 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs ?? 4,
  },
  barLabel: {
    fontSize: 11,
    width:    100,
    flexShrink: 0,
  },
  barTrack: {
    flex:         1,
    height:       6,
    borderRadius: 3,
    overflow:     'hidden',
  },
  barFill: {
    height:       6,
    borderRadius: 3,
  },
  barValue: {
    fontSize: 11,
    width:    36,
    textAlign: 'right',
  },

  // Footer
  footer: {
    marginTop:      spacing.sm ?? 8,
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  timestamp: {
    fontSize: 11,
  },
  viewBreakdown: {
    fontSize:   12,
    fontWeight: '600',
  },

  // Skeleton
  skeletonContainer: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   radii.lg ?? 16,
    padding:        spacing.md ?? 16,
    gap:            spacing.md ?? 16,
  },
  skeletonRing: {
    width:        RING_SIZE,
    height:       RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth:  STROKE_WIDTH,
  },
  skeletonBody: {
    flex: 1,
  },
  skeletonLine: {
    height:       14,
    borderRadius: 7,
  },
});

export default memo(TaxHealthScoreWidget);
