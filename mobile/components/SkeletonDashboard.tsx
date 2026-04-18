import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Radii, Spacing } from './design-system/tokens';

type SkeletonBoxProps = Readonly<{
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
}>;

function SkeletonBox(props: SkeletonBoxProps) {
  const {
    width,
    height,
    borderRadius = Radii.sm,
  } = props;

  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.4, { duration: 800 }),
      ),
      -1,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: Colors.ui.surface,
        },
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonDashboard() {
  const { t } = useTranslation();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.ui.bg }}
      edges={['top', 'bottom']}
      accessibilityLabel={t('accessibility.loadingDashboard')}
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
          <SkeletonBox width={80} height={12} />
          <SkeletonBox width={160} height={28} borderRadius={Radii.sm} />
        </View>
        <SkeletonBox width={88} height={88} borderRadius={44} />
      </View>

      <View style={{ marginHorizontal: Spacing.xxl, marginTop: Spacing.xl }}>
        <SkeletonBox width="100%" height={80} borderRadius={Radii.lg} />
      </View>

      <View style={{ marginHorizontal: Spacing.xxl, marginTop: Spacing.section }}>
        <SkeletonBox width={160} height={14} />
        <View style={{ marginTop: Spacing.md }}>
          <SkeletonBox width="100%" height={96} borderRadius={Radii.lg} />
        </View>
      </View>

      <View style={{ paddingHorizontal: Spacing.xxl, marginTop: Spacing.section }}>
        <SkeletonBox width={120} height={14} />
        <View
          style={{
            marginTop: Spacing.md,
            flexDirection: 'row',
            gap: Spacing.md,
          }}
        >
          <SkeletonBox width="30%" height={90} borderRadius={Radii.lg} />
          <SkeletonBox width="30%" height={90} borderRadius={Radii.lg} />
          <SkeletonBox width="30%" height={90} borderRadius={Radii.lg} />
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
          <SkeletonBox width={140} height={14} />
          <SkeletonBox width="100%" height={72} borderRadius={Radii.lg} />
          <SkeletonBox width="100%" height={72} borderRadius={Radii.lg} />
        </View>
      </View>
    </SafeAreaView>
  );
}
