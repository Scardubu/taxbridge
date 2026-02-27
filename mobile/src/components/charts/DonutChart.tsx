/**
 * TaxBridge — DonutChart Component
 * M09 / F4 — Tax Breakdown Donut Chart
 *
 * Constraints:
 *   C-06  All strings from i18n (en + pidgin)
 *   C-08  No Math.random — all arc math is deterministic
 *   C-13  Pure SVG — no ProgressBar for data visualisation
 *   C-15  Color + shape glyph + text label on each legend row (not color alone)
 *   C-16  All durations use DURATION.* and EASE.* (no raw numeric durations)
 *
 * Dependencies: react-native-svg (Expo SDK 54 — no extra install required)
 *
 * Gate:
 *   Slices render proportional to values; all slices sum to 100% of total
 *   Tap-to-select highlights the pressed slice and updates center label
 *   noData state (slices=[] or total=0) renders gracefully without crash
 *   Renders ≤ 16ms (static SVG paths, no layout recalculation per frame)
 */

import React, { memo, useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { DURATION } from '../../design-system/animation';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DonutSlice {
  /** Stable identifier for React diffing and selection tracking */
  key:    string;
  /** Human-readable display label (i18n resolved by consumer) */
  label:  string;
  /** Absolute monetary value in ₦ */
  value:  number;
  /** Hex fill colour for this slice */
  color:  string;
  /**
   * CF-15 shape glyph — provided by consumer so the chart never invents
   * visual semantics itself. e.g. '■', '▲', '●', '◆'
   */
  glyph:  string;
}

export interface DonutChartProps {
  slices:              DonutSlice[];
  /** Outer diameter in px. Default: 200 */
  size?:               number;
  /** Called when a slice or legend row is tapped */
  onSlicePress?:       (slice: DonutSlice) => void;
  /** Required for accessibility (C-15) — describes the chart in words */
  accessibilityLabel:  string;
  style?:              ViewStyle;
  testID?:             string;
}

// ─── Arc Math (deterministic — C-08) ─────────────────────────────────────────

/** Visual gap in degrees between adjacent slices */
const GAP_DEG = 2;

function polarToXY(
  cx: number, cy: number, r: number, deg: number,
): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Builds an SVG path string for a donut arc segment.
 * Returns '' when the angle is too small to render (< 0.5°).
 */
function buildSlicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const s = startDeg + GAP_DEG / 2;
  const e = endDeg   - GAP_DEG / 2;
  if (e - s < 0.5) return '';

  const o1 = polarToXY(cx, cy, outerR, s);
  const o2 = polarToXY(cx, cy, outerR, e);
  const i1 = polarToXY(cx, cy, innerR, e);
  const i2 = polarToXY(cx, cy, innerR, s);
  const large = e - s > 180 ? 1 : 0;

  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// ─── Component ────────────────────────────────────────────────────────────────

const FALLBACK_SIZE = 200;

export const DonutChart = memo(function DonutChart({
  slices,
  size = FALLBACK_SIZE,
  onSlicePress,
  accessibilityLabel,
  style,
  testID,
}: DonutChartProps) {
  const { t }      = useTranslation();
  const { colors } = useTheme();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const cx     = size / 2;
  const cy     = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.26; // hole = ~62% of outer radius

  const total = slices.reduce((sum, sl) => sum + sl.value, 0);

  const handlePress = useCallback(
    (slice: DonutSlice) => {
      setSelectedKey(prev => (prev === slice.key ? null : slice.key));
      onSlicePress?.(slice);
    },
    [onSlicePress],
  );

  // ── Empty / no-data state ──────────────────────────────────────────────────
  if (slices.length === 0 || total === 0) {
    return (
      <View style={[s.container, style]} testID={testID}>
        <View
          style={[
            s.emptyCircle,
            { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Text style={[s.emptyText, { color: colors.textMuted }]}>
            {t('dashboard.donut.noData')}
          </Text>
        </View>
      </View>
    );
  }

  // ── Build arc paths (one pass, no random) ──────────────────────────────────
  let cursor = 0;
  const sliceData = slices.map(slice => {
    const sweep = (slice.value / total) * 360;
    const path  = buildSlicePath(cx, cy, outerR, innerR, cursor, cursor + sweep);
    cursor += sweep;
    return { ...slice, path };
  });

  const selected      = slices.find(sl => sl.key === selectedKey) ?? null;
  const centerLabel   = selected
    ? `₦${Number(selected.value).toLocaleString('en-NG')}`
    : t('dashboard.donut.total');
  const centerSublabel = selected
    ? selected.label
    : `₦${Number(total).toLocaleString('en-NG')}`;

  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.deliberate)}
      style={[s.container, style]}
      accessible
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {/* ── SVG donut + center overlay ── */}
      <View>
        <Svg width={size} height={size}>
          <G>
            {sliceData.map(slice => {
              if (!slice.path) return null;
              const isSelected = selectedKey === slice.key;
              return (
                <Path
                  key={slice.key}
                  d={slice.path}
                  fill={slice.color}
                  opacity={isSelected ? 1 : 0.82}
                  strokeWidth={isSelected ? 2.5 : 0}
                  stroke={isSelected ? '#FFFFFF' : 'transparent'}
                  onPress={() => handlePress(slice)}
                  accessibilityLabel={`${slice.label}: ₦${Number(slice.value).toLocaleString('en-NG')}`}
                />
              );
            })}
          </G>
        </Svg>

        {/* ── Center label (positioned over SVG hole) ── */}
        <View
          style={[
            s.centerOverlay,
            {
              width:  innerR * 2,
              height: innerR * 2,
              top:    cy - innerR,
              left:   cx - innerR,
            },
          ]}
          pointerEvents="none"
        >
          <Text
            style={[s.centerValue, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {centerLabel}
          </Text>
          <Text
            style={[s.centerSub, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {centerSublabel}
          </Text>
        </View>
      </View>

      {/* ── Tap hint ── */}
      <Text style={[s.hint, { color: colors.textTertiary }]}>
        {t('dashboard.donut.tapHint')}
      </Text>

      {/* ── Legend — CF-15: shape glyph + color swatch + text + percent ── */}
      <View style={s.legend}>
        {slices.map(slice => (
          <LegendRow
            key={slice.key}
            slice={slice}
            selected={selectedKey === slice.key}
            total={total}
            onPress={() => handlePress(slice)}
            colors={colors}
          />
        ))}
      </View>
    </Animated.View>
  );
});

// ─── LegendRow — CF-15: three-channel status (shape + color + text) ──────────

interface LegendRowProps {
  slice:    DonutSlice;
  selected: boolean;
  total:    number;
  onPress:  () => void;
  colors:   any;
}

function LegendRow({ slice, selected, total, onPress, colors }: LegendRowProps) {
  const pct = ((slice.value / total) * 100).toFixed(0);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.legendRow,
        selected && {
          backgroundColor: colors.primaryBgSubtle,
          borderRadius:    6,
        },
        pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }, // C-20
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${slice.glyph} ${slice.label} — ₦${Number(slice.value).toLocaleString('en-NG')} (${pct}%)`}
    >
      {/* CF-15 channel 1: shape glyph */}
      <Text style={[s.legendGlyph, { color: slice.color }]}>{slice.glyph}</Text>
      {/* CF-15 channel 2: color swatch */}
      <View style={[s.legendSwatch, { backgroundColor: slice.color }]} />
      {/* CF-15 channel 3: text label */}
      <Text style={[s.legendLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {slice.label}
      </Text>
      <Text style={[s.legendPct, { color: colors.textMuted }]}>{pct}%</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  emptyCircle: {
    width:          200,
    height:         200,
    borderRadius:   100,
    borderWidth:    1,
    borderStyle:    'dashed',
    alignItems:     'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize:  13,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  centerOverlay: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontSize:        15,
    fontWeight:      '700',
    textAlign:       'center',
    fontVariant:     ['tabular-nums'],
  },
  centerSub: {
    fontSize:   11,
    textAlign:  'center',
    marginTop:  2,
  },
  hint: {
    fontSize:  11,
    marginTop: 8,
    marginBottom: 12,
  },
  legend: {
    width: '100%',
    gap:   4,
  },
  legendRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    gap: 6,
  },
  legendGlyph: {
    fontSize:   13,
    width:      16,
    textAlign:  'center',
    fontWeight: '700',
  },
  legendSwatch: {
    width:        10,
    height:       10,
    borderRadius: 2,
  },
  legendLabel: {
    flex:     1,
    fontSize: 13,
  },
  legendPct: {
    fontSize:    12,
    fontVariant: ['tabular-nums'],
  },
});

/*
 * Usage (inside DashboardScreen CONTEXT zone via SectionState):
 *
 *   import { DonutChart, type DonutSlice } from '../components/charts/DonutChart';
 *
 *   const TAX_SLICES: DonutSlice[] = [
 *     { key: 'vat',      label: t('dashboard.donut.vat'),      value: 45000, color: '#3B82F6', glyph: '■' },
 *     { key: 'paye',     label: t('dashboard.donut.paye'),     value: 30000, color: '#10B981', glyph: '▲' },
 *     { key: 'cit',      label: t('dashboard.donut.cit'),      value: 20000, color: '#F59E0B', glyph: '●' },
 *     { key: 'wht',      label: t('dashboard.donut.wht'),      value: 10000, color: '#8B5CF6', glyph: '◆' },
 *     { key: 'devLevy',  label: t('dashboard.donut.devLevy'),  value:  5000, color: '#EF4444', glyph: '◇' },
 *   ];
 *
 *   <DonutChart
 *     slices={TAX_SLICES}
 *     size={220}
 *     onSlicePress={slice => router.push(`/breakdown/${slice.key}`)}
 *     accessibilityLabel={t('dashboard.donut.title')}
 *   />
 */
