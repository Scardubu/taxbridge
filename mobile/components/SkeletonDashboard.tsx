import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radii, Spacing } from './design-system/tokens';

function SkeletonBox({
  width,
  height,
  borderRadius = Radii.sm,
  opacity,
}: {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  opacity: Animated.Value;
}) {
  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: Colors.ui.surface,
        opacity,
      }}
    />
  );
}

export function SkeletonDashboard() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.ui.bg }}
      edges={['top', 'bottom']}
      accessibilityLabel="Loading dashboard"
      accessibilityRole="progressbar"
    >
      <View
        style={{
          paddingHorizontal: Spacing.xxl,
          paddingTop: Spacing.xl,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ gap: Spacing.sm }}>
          <SkeletonBox width={80} height={12} opacity={pulse} />
          <SkeletonBox width={160} height={28} borderRadius={Radii.sm} opacity={pulse} />
        </View>
        <SkeletonBox width={88} height={88} borderRadius={44} opacity={pulse} />
      </View>

      <View style={{ marginHorizontal: Spacing.xxl, marginTop: Spacing.xl }}>
        <SkeletonBox width="100%" height={80} borderRadius={Radii.lg} opacity={pulse} />
      </View>

      <View style={{ paddingHorizontal: Spacing.xxl, marginTop: Spacing.section }}>
        <SkeletonBox width={120} height={14} opacity={pulse} />
        <View
          style={{
            marginTop: Spacing.md,
            flexDirection: 'row',
            gap: Spacing.md,
          }}
        >
          <SkeletonBox width="30%" height={90} borderRadius={Radii.lg} opacity={pulse} />
          <SkeletonBox width="30%" height={90} borderRadius={Radii.lg} opacity={pulse} />
          <SkeletonBox width="30%" height={90} borderRadius={Radii.lg} opacity={pulse} />
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: Spacing.xxl,
          marginTop: Spacing.section,
          flexDirection: 'row',
          gap: Spacing.md,
        }}
      >
        <View style={{ gap: Spacing.md, flex: 1 }}>
          <SkeletonBox width={140} height={14} opacity={pulse} />
          <SkeletonBox width="100%" height={72} borderRadius={Radii.lg} opacity={pulse} />
          <SkeletonBox width="100%" height={72} borderRadius={Radii.lg} opacity={pulse} />
        </View>
      </View>
    </SafeAreaView>
  );
}
