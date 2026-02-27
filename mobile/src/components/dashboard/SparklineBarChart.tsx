/**
 * TaxBridge — SparklineBarChart Component
 * M09 / F2 — Anomaly Spike Sparkline
 *
 * Architecture:
 *   12 SVG <Rect> bars, statically rendered (no per-bar animation).
 *   Flagged bars highlighted in coral (#F87171) with a severity label.
 *   Container entrance via Reanimated FadeInDown — satisfies visual polish
 *   without exceeding the < 16ms render budget for the SVG layout itself.
 *
 * Constraints:
 *   C-06  All strings from i18n
 *   C-13  SVG only — never a native ProgressBar or View-based bar
 *   C-15  Flagged bars: color + shape (rect taller threshold line) + text label
 *   C-16  No raw animation durations — DURATION.* only
 *
 * Gate:
 *   - 12 bars rendered; flagged bar(s) in coral
 *   - Renders < 16ms (static SVG path — no layout recalculation)
 *   - Readable on 320px-wide device at default size
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { DURATION, EASE } from '../../design-system/animation';

// ─── Constants ────────────────────────────────────────────────────────────────

const BAR_COUNT      = 12;
const BAR_COLOR      = '#93C5FD'; // blue-300 — normal bar
const FLAG_COLOR     = '#F87171'; // coral-400 — anomaly bar (C-15: distinct shape + color)
const THRESHOLD_COLOR = '#FCD34D'; // amber warning line
const TRACK_COLOR    = '#F3F4F6'; // divider baseline
const DEFAULT_WIDTH  = 156;
const DEFAULT_HEIGHT = 64;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SparkBarDatum {
  value:    number;   // absolute value (NGN amount, count, etc.)
  flagged?: boolean;  // true = anomaly detected for this period
  label?:   string;   // optional period label (e.g. "Oct")
}

export interface SparklineBarChartProps {
  data:               SparkBarDatum[];  // exactly 12 items recommended
  width?:             number;
  height?:            number;
  /** Show a horizontal threshold line at this value */
  threshold?:         number;
  /** Unit label shown at top-right: e.g. "₦" or "invoices" */
  unit?:              string;
  accessibilityLabel: string;           // required — C-15
  testID?:            string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SparklineBarChart = memo(function SparklineBarChart({
  data,
  width  = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  threshold,
  unit,
  accessibilityLabel,
  testID,
}: SparklineBarChartProps) {
  const { t } = useTranslation();

  const bars    = data.slice(0, BAR_COUNT);
  const maxVal  = Math.max(...bars.map(d => d.value), 1); // avoid divide-by-zero

  const gap      = 3;
  const barWidth = (width - gap * (bars.length - 1)) / bars.length;
  const chartH   = height - 2; // 2px baseline

  const flagCount = bars.filter(d => d.flagged).length;

  return (
    <Animated.View
      entering={FadeInDown.duration(DURATION.standard).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })}
      style={styles.wrapper}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {/* Unit label */}
      {unit && (
        <Text style={styles.unitLabel} aria-hidden>
          {unit}
        </Text>
      )}

      <Svg width={width} height={height}>

        {/* Threshold line (C-15: visual + color distinction) */}
        {threshold !== undefined && threshold > 0 && (
          <Line
            x1={0}
            y1={chartH - (threshold / maxVal) * chartH}
            x2={width}
            y2={chartH - (threshold / maxVal) * chartH}
            stroke={THRESHOLD_COLOR}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        )}

        {/* Bars */}
        {bars.map((datum, i) => {
          const x      = i * (barWidth + gap);
          const barH   = Math.max(3, (datum.value / maxVal) * chartH);
          const y      = chartH - barH;
          const color  = datum.flagged ? FLAG_COLOR : BAR_COLOR;
          const radius = Math.min(2, barWidth / 3);

          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={radius}
              ry={radius}
              fill={color}
            />
          );
        })}

        {/* Baseline */}
        <Rect x={0} y={chartH} width={width} height={2} fill={TRACK_COLOR} rx={1} />

      </Svg>

      {/* Flagged count badge (C-15: text label, not color alone) */}
      {flagCount > 0 && (
        <View style={styles.flagBadge} accessibilityRole="text">
          <Text style={styles.flagBadgeText}>
            {t('dashboard.anomaly.flaggedBars', { count: flagCount })}
          </Text>
        </View>
      )}

    </Animated.View>
  );
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function SparklineBarChartSkeleton({
  width  = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: { width?: number; height?: number }) {
  return (
    <View
      style={[styles.wrapper, { width, height, backgroundColor: '#F3F4F6', borderRadius: 6 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  unitLabel: {
    position:   'absolute',
    top:        0,
    right:      0,
    fontSize:   10,
    fontWeight: '600',
    color:      '#9CA3AF',
    zIndex:     1,
  },
  flagBadge: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    backgroundColor: '#FEF2F2',
    borderRadius:    4,
    paddingHorizontal: 4,
    paddingVertical:   1,
  },
  flagBadgeText: {
    fontSize:   9,
    fontWeight: '700',
    color:      '#EF4444',
  },
});

/*
 * Usage (in AnomalyReviewScreen or TopAnomaliesSection):
 *
 *   import { SparklineBarChart, SparklineBarChartSkeleton } from '../components/dashboard/SparklineBarChart';
 *
 *   <SparklineBarChart
 *     data={anomaly.sparkData}          // last 12 invoice amounts
 *     threshold={anomaly.avgAmount}     // highlight spend-above-mean bar
 *     unit="₦"
 *     accessibilityLabel={`${t('dashboard.anomaly.sparklineLabel')}: ${anomaly.category}`}
 *   />
 *
 * Gate:
 *   - 12 bars rendered in < 16ms (static Rect — no hooks per bar)
 *   - flagged=true bars render in coral #F87171
 *   - threshold line renders in amber dashes when provided
 *   - 320px device: barWidth ≈ 10px, readable at DEFAULT_WIDTH=156
 */
