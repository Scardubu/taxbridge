/**
 * DashboardSkeleton — V10.3 Geometry Contract
 *
 * ER-08: Skeleton block dimensions must match real content ±0px.
 *        Layout shift on data arrival = 0px (measured via RN Profiler).
 *
 * Shimmer spec:
 *   DURATION.skeleton = 1200ms — DO NOT CHANGE (tuned for 2G user patience)
 *   Colors: light  ['#F3F4F6', '#E5E7EB']
 *           dark   ['#1F2937', '#374151']
 *
 * All SkeletonBlock: accessibilityElementsHidden={true}
 */

import React, { useEffect } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { spacing, radii } from '../../design-system/tokens';
import { DURATION, EASE } from '../../design-system/animation';

// ─── SkeletonBlock ────────────────────────────────────────────────────────────

interface SkeletonBlockProps {
  width:          number | string;
  height:         number;
  borderRadius?:  number;
  style?:         ViewStyle;
}

function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonBlockProps) {
  const { isDark } = useTheme();
  const shimmer    = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: DURATION.skeleton, easing: EASE.shimmer }),
      -1,
      true, // reverse — ping-pong
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      shimmer.value,
      [0, 1],
      isDark ? ['#1F2937', '#374151'] : ['#F3F4F6', '#E5E7EB'],
    ),
  }));

  // Separate layout style (View) from animated style (backgroundColor only)
  // This avoids the Animated.View string width type incompatibility
  return (
    <View
      style={[{ width: width as any, height, borderRadius, overflow: 'hidden' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[{ flex: 1 }, animStyle]} />
    </View>
  );
}

// ─── SectionSkeletonRows (used inside SectionState loading prop) ──────────────

interface SectionSkeletonRowsProps {
  count: number;
}

export function SectionSkeletonRows({ count }: SectionSkeletonRowsProps) {
  return (
    <View style={s.rowsContainer}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width="100%"
          height={52}
          borderRadius={8}
          style={i > 0 ? { marginTop: 8 } : undefined}
        />
      ))}
    </View>
  );
}

// ─── Full Dashboard Skeleton ──────────────────────────────────────────────────
// Geometry contract — each zone block exactly matches real rendered content.

export function DashboardSkeleton() {
  return (
    <View style={s.container}>

      {/* ── APEX: Semicircle gauge (200×110) + greeting line (100%×24) ── */}
      <View style={s.apex}>
        <SkeletonBlock
          width={200}
          height={110}
          borderRadius={100}     /* semicircle top */
        />
        <SkeletonBlock
          width="60%"
          height={24}
          borderRadius={6}
          style={{ marginTop: 10, alignSelf: 'center' }}
        />
      </View>

      {/* ── SIGNAL: 3 metric cards (31% × 72px, flex row, 8px gap) ── */}
      <View style={s.signalRow}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock
            key={i}
            width="31%"
            height={72}
            borderRadius={10}
          />
        ))}
      </View>

      {/* ── ACTION: 6 squares (30% × 64px, flex-wrap 3-col, 6px gap) ── */}
      <View style={s.actionGrid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonBlock
            key={i}
            width="30%"
            height={64}
            borderRadius={10}
          />
        ))}
      </View>

      {/* ── CONTEXT: Section header (40%×14) + 2 list rows (100%×52) ── */}
      <View style={s.contextSection}>
        <SkeletonBlock
          width="40%"
          height={14}
          borderRadius={4}
          style={{ marginBottom: 10 }}
        />
        <SkeletonBlock width="100%" height={52} borderRadius={8} />
        <SkeletonBlock width="100%" height={52} borderRadius={8} style={{ marginTop: 8 }} />
      </View>

      {/* ── AMBIENT: 2 sparkline outlines (48% × 80px, flex row) ── */}
      <View style={s.ambientRow}>
        <SkeletonBlock width="48%" height={80} borderRadius={10} />
        <SkeletonBlock width="48%" height={80} borderRadius={10} />
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex:             1,
    paddingHorizontal: spacing.md ?? 16,
    paddingTop:        spacing[4] ?? 16,
    gap:               spacing[4] ?? 16,
  },
  apex: {
    alignItems: 'center',
    gap:        spacing[2] ?? 8,
  },
  signalRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    rowGap:        6,
  },
  contextSection: {
    gap: 0,
  },
  ambientRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  rowsContainer: {
    gap: 0,
  },
});

export default DashboardSkeleton;
