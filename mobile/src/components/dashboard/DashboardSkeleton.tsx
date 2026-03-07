/**
 * DashboardSkeleton — TaxBridge V13 Sovereign
 *
 * Zero layout shift contract — exact geometry per §12 skeleton table.
 * shimmer: withRepeat(withTiming(1, { duration: DURATION.skeleton, easing: EASE.shimmer }), -1, true)
 * All blocks: accessibilityElementsHidden={true}
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, EASE } from '../../design-system/animation';

interface SkeletonBlockProps {
  width:    number | string;
  height:   number;
  radius?:  number;
  shimmer:  Animated.SharedValue<number>;
}

function SkeletonBlock({ width, height, radius = 8, shimmer }: SkeletonBlockProps) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + shimmer.value * 0.3,
  }));

  return (
    <Animated.View
      accessibilityElementsHidden={true}
      style={[
        styles.block,
        { width, height, borderRadius: radius },
        animStyle,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: DURATION.skeleton, easing: EASE.shimmer }),
      -1,
      true,
    );
  }, []);

  return (
    <View accessibilityElementsHidden={true} style={styles.container}>
      {/* APEX: Tax Health Gauge placeholder — 200×200 circle */}
      <View style={styles.apex}>
        <SkeletonBlock width={200} height={200} radius={100} shimmer={shimmer} />
        <SkeletonBlock width={80}  height={14}  radius={4}   shimmer={shimmer} />
      </View>

      {/* SIGNAL: Anomaly row placeholders — 3 rows × 56px */}
      <View style={styles.section}>
        <SkeletonBlock width="100%" height={56} shimmer={shimmer} />
        <View style={styles.gap} />
        <SkeletonBlock width="100%" height={56} shimmer={shimmer} />
        <View style={styles.gap} />
        <SkeletonBlock width="80%"  height={56} shimmer={shimmer} />
      </View>

      {/* ACTION: Quick Actions Grid — 2×2 tiles × 72px */}
      <View style={styles.grid}>
        <SkeletonBlock width="47%" height={72} shimmer={shimmer} />
        <SkeletonBlock width="47%" height={72} shimmer={shimmer} />
        <SkeletonBlock width="47%" height={72} shimmer={shimmer} />
        <SkeletonBlock width="47%" height={72} shimmer={shimmer} />
      </View>

      {/* CONTEXT: Compliance calendar bar */}
      <View style={styles.section}>
        <SkeletonBlock width="60%" height={14} radius={4} shimmer={shimmer} />
        <View style={styles.gap} />
        <SkeletonBlock width="100%" height={80} shimmer={shimmer} />
      </View>

      {/* AMBIENT: NRS status + offline sync */}
      <View style={styles.row}>
        <SkeletonBlock width="45%" height={32} shimmer={shimmer} />
        <SkeletonBlock width="45%" height={32} shimmer={shimmer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap:     16,
  },
  apex: {
    alignItems: 'center',
    gap:        12,
    paddingVertical: 8,
  },
  section: {
    gap: 8,
  },
  grid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'space-between',
    gap:            12,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    gap:            12,
  },
  gap: {
    height: 4,
  },
  block: {
    backgroundColor: '#D1D5DB',
  },
});
