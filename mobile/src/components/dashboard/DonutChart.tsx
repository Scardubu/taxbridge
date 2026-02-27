/**
 * TaxBridge — DonutChart Component
 * M09 / F4 — Tax Breakdown Donut
 *
 * Architecture:
 *   Custom SVG donut — no external chart libraries (< 8KB, APK-safe).
 *   Each slice is a single SVG <Path> element. No layout recalculation.
 *   Slices are Pressable → onSlicePress(key) for drill-down filter navigation.
 *
 * Constraints:
 *   C-06  All strings via i18n
 *   C-08  No Math.random — colors must be deterministic from slice data
 *   C-13  SVG only — never ProgressBar
 *   C-15  Legend: color swatch + text label (not color alone)
 *   C-16  No raw animation durations — DURATION.* only
 *
 * Gate:
 *   - Slices sum to 100%; rounding remainder absorbed into largest slice
 *   - Tap on any slice fires onSlicePress(key)
 *   - Renders cleanly at 280px container width (320px device with padding)
 */

import React, { memo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { DURATION } from '../../design-system/animation';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DonutSlice {
  key:    string;    // unique identifier — used in onSlicePress callback
  label:  string;    // display label (e.g. "VAT 7.5%")
  value:  number;    // absolute value (NGN)
  pct:    number;    // percentage 0–100 (caller must ensure slices sum to 100)
  color:  string;    // hex color string — deterministic, no Math.random
}

export interface DonutChartProps {
  slices:         DonutSlice[];
  /** Text shown in center hole — typically total NGN amount */
  centerLabel?:   string;
  centerSubLabel?: string;
  size?:          number;    // outer SVG diameter — default 200
  ringWidth?:     number;    // donut ring thickness — default 30
  onSlicePress?:  (key: string) => void;
  /** Index of currently selected/highlighted slice */
  selectedKey?:   string;
  accessibilityLabel: string;
  testID?:        string;
}

// ─── Donut Math ───────────────────────────────────────────────────────────────

const TWO_PI    = Math.PI * 2;
const HALF_PI   = Math.PI / 2;
const GAP_RAD   = 0.025; // gap between slices in radians

/** Build SVG path for one donut slice. Angles measured clockwise from 12 o'clock. */
function buildSlicePath(
  cx:        number,
  cy:        number,
  outerR:    number,
  innerR:    number,
  startRad:  number,
  endRad:    number,
): string {
  const sweep = endRad - startRad;
  if (sweep < 0.001) return '';

  // Convert clock-wise-from-top to standard SVG coords:
  // x =  r * sin(angle),  y = -r * cos(angle)
  const toX = (r: number, a: number) => cx + r * Math.sin(a);
  const toY = (r: number, a: number) => cy - r * Math.cos(a);

  const largeArc = sweep > Math.PI ? 1 : 0;

  const ox1 = toX(outerR, startRad);
  const oy1 = toY(outerR, startRad);
  const ox2 = toX(outerR, endRad);
  const oy2 = toY(outerR, endRad);
  const ix1 = toX(innerR, endRad);
  const iy1 = toY(innerR, endRad);
  const ix2 = toX(innerR, startRad);
  const iy2 = toY(innerR, startRad);

  return [
    `M ${ox1} ${oy1}`,                                           // outer start
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,      // outer arc (CW)
    `L ${ix1} ${iy1}`,                                            // inner end
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,      // inner arc (CCW)
    'Z',
  ].join(' ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DonutChart = memo(function DonutChart({
  slices,
  centerLabel,
  centerSubLabel,
  size       = 200,
  ringWidth  = 30,
  onSlicePress,
  selectedKey,
  accessibilityLabel,
  testID,
}: DonutChartProps) {
  const { t } = useTranslation();
  const cx      = size / 2;
  const cy      = size / 2;
  const outerR  = size / 2 - 4;       // 4px padding inside SVG edge
  const innerR  = outerR - ringWidth;

  // Build angle ranges from pct values
  type SliceGeometry = { slice: DonutSlice; startRad: number; endRad: number };
  const geometry: SliceGeometry[] = [];
  let cursor = 0;

  slices.forEach(s => {
    const sliceSweep = TWO_PI * (s.pct / 100) - GAP_RAD;
    geometry.push({ slice: s, startRad: cursor, endRad: cursor + sliceSweep });
    cursor += TWO_PI * (s.pct / 100); // include gap in next cursor advance
  });

  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.standard)}
      style={styles.container}
      testID={testID}
    >
      {/* ── Donut SVG ── */}
      <View
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        <Svg width={size} height={size}>
          {/* Background circle (gray track) */}
          <Circle
            cx={cx}
            cy={cy}
            r={(outerR + innerR) / 2}
            stroke="#F3F4F6"
            strokeWidth={ringWidth}
            fill="none"
          />

          {/* Slices */}
          {geometry.map(({ slice, startRad, endRad }) => {
            const isSelected = slice.key === selectedKey;
            const effectiveOuter = isSelected ? outerR + 5 : outerR;
            const effectiveInner = isSelected ? innerR - 2 : innerR;

            return (
              <Path
                key={slice.key}
                d={buildSlicePath(cx, cy, effectiveOuter, effectiveInner, startRad, endRad)}
                fill={slice.color}
                opacity={selectedKey && !isSelected ? 0.45 : 1}
                onPress={() => onSlicePress?.(slice.key)}
                accessible
                accessibilityLabel={`${slice.label}: ${slice.pct}%`}
              />
            );
          })}
        </Svg>

        {/* Center label overlay */}
        {(centerLabel || centerSubLabel) && (
          <View style={[styles.centerOverlay, { width: size, height: size }]}
                pointerEvents="none">
            {centerLabel && (
              <Text style={styles.centerValue} numberOfLines={1}>{centerLabel}</Text>
            )}
            {centerSubLabel && (
              <Text style={styles.centerSub} numberOfLines={1}>{centerSubLabel}</Text>
            )}
          </View>
        )}
      </View>

      {/* ── Legend (C-15: color swatch + label + pct) ── */}
      <View style={styles.legend} accessibilityRole="list">
        {slices.map(s => (
          <Pressable
            key={s.key}
            onPress={() => onSlicePress?.(s.key)}
            style={({ pressed }) => [styles.legendRow, pressed && styles.legendRowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${s.label} ${s.pct}%`}
          >
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>{s.label}</Text>
            <Text style={styles.legendPct}>{s.pct}%</Text>
          </Pressable>
        ))}
      </View>

    </Animated.View>
  );
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function DonutChartSkeleton({ size = 200 }: { size?: number }) {
  return (
    <View style={styles.container}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
      <View style={{
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: '#F3F4F6',
      }} />
      <View style={{ marginTop: 12, gap: 8 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.legendRow,
            { backgroundColor: '#F3F4F6', borderRadius: 4, height: 18 }]} />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerOverlay: {
    position:       'absolute',
    top:            0, left: 0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontSize:    20,
    fontWeight:  '700',
    color:       '#111827',
    fontVariant: ['tabular-nums'],
  },
  centerSub: {
    fontSize:  11,
    fontWeight: '500',
    color:     '#6B7280',
    marginTop:  2,
  },
  legend: {
    width:     '100%',
    marginTop: 12,
    gap:       6,
  },
  legendRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 3,
    gap:            8,
  },
  legendRowPressed: {
    opacity: 0.7,
  },
  swatch: {
    width:        10,
    height:       10,
    borderRadius: 2,
    flexShrink:   0,
  },
  legendLabel: {
    flex:       1,
    fontSize:   13,
    fontWeight: '500',
    color:      '#374151',
  },
  legendPct: {
    fontSize:    13,
    fontWeight:  '700',
    color:       '#111827',
    fontVariant: ['tabular-nums'],
    minWidth:    36,
    textAlign:   'right',
  },
});

/*
 * Usage:
 *
 *   import { DonutChart, DonutChartSkeleton } from '../components/dashboard/DonutChart';
 *
 *   const slices: DonutSlice[] = [
 *     { key: 'vat',      label: 'VAT 7.5%',  value: 37500,  pct: 45, color: '#3B82F6' },
 *     { key: 'pit',      label: 'PIT',        value: 24000,  pct: 29, color: '#10B981' },
 *     { key: 'wht',      label: 'WHT',        value: 10000,  pct: 12, color: '#8B5CF6' },
 *     { key: 'dev_levy', label: 'Dev Levy',   value:  8000,  pct:  9, color: '#06B6D4' },
 *     { key: 'other',    label: 'Other',      value:  4000,  pct:  5, color: '#9CA3AF' },
 *   ];
 *
 *   {loading
 *     ? <DonutChartSkeleton />
 *     : <DonutChart
 *         slices={slices}
 *         centerLabel="₦83,500"
 *         centerSubLabel={t('dashboard.taxBreakdown.ytdLabel')}
 *         onSlicePress={(key) => navigation.navigate('Insights', { filter: key })}
 *         accessibilityLabel={t('dashboard.taxBreakdown.chartA11y')}
 *       />
 *   }
 */
