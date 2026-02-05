import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useLoading } from '../contexts/LoadingContext';
import { colors, spacing, radii, typography, shadows } from '../theme/tokens';
import { SkeletonLoader } from './ui/SkeletonLoader';

export default function LoadingOverlay() {
  const { t } = useTranslation();
  const { isLoading, loadingMessage } = useLoading();
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withSpring(isLoading ? 1 : 0, {
        damping: 20,
        stiffness: 300,
      }),
      backgroundColor: interpolateColor(
        opacity.value,
        [0, 1],
        ['transparent', colors.overlayDark]
      ),
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(isLoading ? 1 : 0.8, {
            damping: 15,
            stiffness: 300,
          }),
        },
      ],
      opacity: withSpring(isLoading ? 1 : 0, {
        damping: 20,
        stiffness: 300,
      }),
    };
  });

  if (!isLoading) return null;

  return (
    <Animated.View style={[styles.overlay, animatedStyle]}>
      <Animated.View style={[styles.content, contentStyle]}>
        <SkeletonLoader type="inline-lg" count={1} />
        <Text style={styles.message}>
          {loadingMessage || t('common.loading')}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xxl + 8,
    borderRadius: radii.lg,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.lg,
  },
  message: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
