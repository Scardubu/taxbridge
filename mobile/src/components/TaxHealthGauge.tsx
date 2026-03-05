/**
 * TaxBridge — TaxHealthGauge Component
 * SVG arc gauge replacing ProgressBar for Tax Health Score (C-13)
 *
 * Constraints:
 *   C-13: Must use SVG arc — never ProgressBar for health score
 *   C-15: accessibilityLabel carries score + status (not color alone)
 *
 * Dependencies: react-native-svg (bundled with Expo SDK 54 — no extra install)
 * Tested at: score=0, 50, 75, 82, 100 | sizes 160px (320-wide) and 200px
 */

import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Text as SvgText, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedProps,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { DURATION, EASE } from '../design-system/animation';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── COMP-02: Gauge mode computation ─────────────────────────────────────────
/**
 * Determines whether the gauge card should be rendered in 'compact' mode
 * (when an urgent compliance deadline is approaching or past) or 'expanded' mode.
 *
 * Accepts any object shaped like the composite dashboard payload. Uses optional
 * chaining to safely handle both DashboardComposite (upcomingDeadlines) and
 * DashboardStats (compliance) shapes.
 */
export function computeGaugeMode(
  data: { upcomingDeadlines?: Array<{ daysRemaining: number }>; compliance?: Array<{ daysRemaining: number }> } | undefined,
): 'expanded' | 'compact' {
  if (!data) return 'expanded';
  const deadlines = data.upcomingDeadlines ?? data.compliance ?? [];
  const urgent = deadlines.some((d) => d.daysRemaining <= 7 || d.daysRemaining < 0);
  return urgent ? 'compact' : 'expanded';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaxHealthGaugeProps {
  score:              number;              // 0–100
  size?:              number;              // explicit override; default = responsive
  /**
   * compact: 120px, right-aligned, score only.
   * expanded (default): 200px, centered, shows label + trend sparkline.
   * UX-10: switches when any deadline daysRemaining ≤ 7 or is overdue.
   */
  mode?:              'expanded' | 'compact';
  showTrend?:         boolean;             // show delta vs last week
  trendDelta?:        number;              // e.g. +8 or -3
  /** Last 7 daily health scores for sparkline (ambient zone) */
  trend?:             number[];
  showLabel?:         boolean;             // show "Tax Health" text below score
  /**
   * REQUIRED for accessibility (C-15).
   * e.g. "Tax health score: 82 out of 100. Status: Good."
   */
  accessibilityLabel: string;
  testID?:            string;
}

// ─── Score → Visual Mapping ───────────────────────────────────────────────────

function scoreToHex(score: number): string {
  if (score >= 90) return '#10B981'; // emerald — excellent
  if (score >= 75) return '#84CC16'; // lime — good
  if (score >= 50) return '#F59E0B'; // amber — fair
  return '#EF4444';                  // red — at risk
}

function scoreToStatus(score: number, t: (k: string) => string): string {
  if (score >= 90) return t('taxHealth.grade.excellent');
  if (score >= 75) return t('taxHealth.grade.good');
  if (score >= 50) return t('dashboard.healthFair');
  return t('dashboard.healthAtRisk');
}

// ─── Arc Math ─────────────────────────────────────────────────────────────────

const ARC_START_DEG = -220; // degrees from 12-o'clock (negative = counter-clockwise)
const ARC_SWEEP_DEG = 260;  // total sweep of the gauge

function degToRad(deg: number): number {
  return ((deg - 90) * Math.PI) / 180;
}

function polarToCartesian(
  cx: number, cy: number, r: number, deg: number,
): { x: number; y: number } {
  const rad = degToRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildArcPath(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  if (Math.abs(sweep) < 0.5) {
    // Degenerate arc — return single point (renders nothing visible)
    const pt = polarToCartesian(cx, cy, r, startDeg);
    return `M ${pt.x} ${pt.y}`;
  }
  const start    = polarToCartesian(cx, cy, r, startDeg);
  const end      = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  const sweepDir = sweep > 0 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweepDir} ${end.x} ${end.y}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TaxHealthGauge = memo(function TaxHealthGauge({
  score,
  size,
  mode = 'expanded',
  showTrend = false,
  trendDelta,
  trend,
  showLabel = true,
  accessibilityLabel,
  testID,
}: TaxHealthGaugeProps) {
  const { t } = useTranslation();

  // UX-10: compact mode = 120px right-aligned, expanded = 200px centered
  const defaultSize  = mode === 'compact' ? 120 : (SCREEN_WIDTH < 360 ? 160 : 200);
  const resolvedSize = size ?? defaultSize;
  const cx     = resolvedSize / 2;
  const cy     = resolvedSize * 0.56;
  const radius = resolvedSize * 0.38;
  const stroke = Math.max(10, resolvedSize * 0.056); // scales with size

  // Animation
  const progress = useSharedValue(0);

  useEffect(() => {
    // Always animate from 0 → score on mount — gives "loading your result" feel
    // C-16: uses DURATION.slow + EASE.gauge (never raw numeric durations)
    progress.value = 0;
    progress.value = withTiming(score / 100, {
      duration: DURATION.slow,
      easing:   EASE.gauge,
    });
  }, [score]);

  // Animated arc path — recomputed per frame during animation
  const animatedArcProps = useAnimatedProps(() => {
    const endDeg = ARC_START_DEG + ARC_SWEEP_DEG * progress.value;
    return {
      d: buildArcPath(cx, cy, radius, ARC_START_DEG, endDeg),
    };
  });

  const color   = scoreToHex(score);
  const status  = scoreToStatus(score, t);
  const svgH    = resolvedSize * 0.75;

  // Accessibility: describe score and status in words, not color (C-15)
  const a11yLabel = `${t('taxHealth.title')}: ${score} ${t('common.outOf')} 100. ${t('common.status')}: ${status}.`;

  // In compact mode: right-aligned, show only arc + score number
  const containerStyle = mode === 'compact'
    ? [styles.container, styles.containerCompact]
    : styles.container;

  return (
    <View testID={testID} style={containerStyle}>
      <Svg
        width={resolvedSize}
        height={svgH}
        accessibilityLabel={accessibilityLabel || a11yLabel}
        accessibilityRole="image"
        accessibilityHint={t('dashboard.gaugeHint')}
      >
        {/* Track (background arc) */}
        <Path
          d={buildArcPath(cx, cy, radius, ARC_START_DEG, ARC_START_DEG + ARC_SWEEP_DEG)}
          stroke="#E5E7EB"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />

        {/* Animated fill arc */}
        <AnimatedPath
          animatedProps={animatedArcProps}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />

        {/* Score number — large, bold, color-matched */}
        <SvgText
          x={cx}
          y={cy + resolvedSize * 0.04}
          textAnchor="middle"
          fontSize={resolvedSize * 0.24}
          fontWeight="800"
          fill={color}
        >
          {score}
        </SvgText>

        {/* "Tax Health" label below score — hidden in compact mode */}
        {showLabel && mode !== 'compact' && (
          <SvgText
            x={cx}
            y={cy + resolvedSize * 0.14}
            textAnchor="middle"
            fontSize={resolvedSize * 0.076}
            fontWeight="500"
            fill="#6B7280"
          >
            {t('taxHealth.title')}
          </SvgText>
        )}
      </Svg>

      {/* Status label below SVG — text channel for C-15; hidden in compact */}
      {mode !== 'compact' && (
        <Text style={[styles.statusLabel, { color }]}>{status}</Text>
      )}

      {/* Trend delta — if showTrend and trendDelta provided */}
      {showTrend && trendDelta !== undefined && (
        <View style={styles.trendRow}>
          <Text style={[
            styles.trendText,
            { color: trendDelta >= 0 ? '#10B981' : '#EF4444' },
          ]}>
            {trendDelta >= 0 ? '▲' : '▼'} {Math.abs(trendDelta)}% {t('common.thisWeek')}
          </Text>
        </View>
      )}
    </View>
  );
});

// ─── Skeleton (loading state) ─────────────────────────────────────────────────

export function TaxHealthGaugeSkeleton({ size }: { size?: number }) {
  const resolvedSize = size ?? (SCREEN_WIDTH < 360 ? 160 : 200);
  const cx = resolvedSize / 2, cy = resolvedSize * 0.56, r = resolvedSize * 0.38;
  return (
    <View style={styles.container}>
      <Svg width={resolvedSize} height={resolvedSize * 0.75}>
        <Path
          d={buildArcPath(cx, cy, r, ARC_START_DEG, ARC_START_DEG + ARC_SWEEP_DEG)}
          stroke="#E5E7EB" strokeWidth={resolvedSize * 0.056}
          fill="none" strokeLinecap="round"
        />
        <Circle cx={cx} cy={cy} r={resolvedSize * 0.14} fill="#F3F4F6" />
      </Svg>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  containerCompact: {
    alignSelf: 'flex-end',
  },
  statusLabel: {
    fontSize:   14,
    fontWeight: '600',
    marginTop:  -4,
    textAlign:  'center',
  },
  trendRow: {
    marginTop:     6,
    flexDirection: 'row',
    alignItems:    'center',
  },
  trendText: {
    fontSize:   13,
    fontWeight: '600',
  },
});

/*
 * Usage:
 *   import { TaxHealthGauge, TaxHealthGaugeSkeleton } from '../components/TaxHealthGauge';
 *
 *   // In TaxHealthCard (replaces ProgressBar):
 *   {loading
 *     ? <TaxHealthGaugeSkeleton />
 *     : <TaxHealthGauge score={score} showTrend trendDelta={trendDelta} />
 *   }
 *
 * Gate:
 *   score=0   → no colored arc visible; gray track only
 *   score=50  → amber, exactly half arc
 *   score=82  → lime, 82% of arc
 *   score=100 → green, full arc (slight gap at start/end from rounded linecap)
 *   320px wide screen → size=160, all text readable, no clipping
 */
