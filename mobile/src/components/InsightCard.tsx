import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { colors as themeColors, spacing, radii, typography, shadows } from '../theme/tokens';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;

export type InsightType = 
  | 'tax_tip' 
  | 'sync_status' 
  | 'compliance_reminder' 
  | 'achievement' 
  | 'community'
  | 'referral';

interface InsightCardProps {
  type: InsightType;
  title: string;
  description: string;
  icon: string;
  actionLabel?: string;
  onAction?: () => void;
  gradient?: 'blue' | 'green' | 'orange' | 'purple';
  metric?: string;
  metricLabel?: string;
}

const GRADIENT_COLORS = {
  blue: { bg: '#EBF4FF', accent: '#0B5FFF', border: '#93C5FD' },
  green: { bg: '#ECFDF5', accent: '#059669', border: '#6EE7B7' },
  orange: { bg: '#FFF7ED', accent: '#EA580C', border: '#FDBA74' },
  purple: { bg: '#F5F3FF', accent: '#7C3AED', border: '#C4B5FD' },
};

function InsightCard({
  type,
  title,
  description,
  icon,
  actionLabel,
  onAction,
  gradient = 'blue',
  metric,
  metricLabel,
}: InsightCardProps) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  const colors = GRADIENT_COLORS[gradient];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 300 }) }],
  }));

  const handlePressIn = () => {
    scale.value = 0.98;
    pressed.value = 1;
  };

  const handlePressOut = () => {
    scale.value = 1;
    pressed.value = 0;
  };

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pressed.value,
      [0, 1],
      [colors.bg, colors.bg + 'CC']
    ),
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onAction}
        style={{ flex: 1 }}
      >
        <Animated.View style={[styles.card, cardStyle, { borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
              <Text style={styles.icon}>{icon}</Text>
            </View>
            {metric && (
              <View style={styles.metricContainer}>
                <Text style={[styles.metric, { color: colors.accent }]}>{metric}</Text>
                {metricLabel && (
                  <Text style={styles.metricLabel}>{metricLabel}</Text>
                )}
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.accent }]}>{title}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          </View>

          {/* Action */}
          {actionLabel && (
            <View style={[styles.actionContainer, { backgroundColor: colors.accent }]}>
              <Text style={styles.actionText}>{actionLabel}</Text>
              <Text style={styles.actionArrow}>→</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default memo(InsightCard);

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginRight: spacing.md,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    minHeight: 160,
    justifyContent: 'space-between',
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 22,
  },
  metricContainer: {
    alignItems: 'flex-end',
  },
  metric: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
  },
  metricLabel: {
    fontSize: 11,
    color: themeColors.textMuted,
    fontWeight: typography.weight.medium,
  },
  content: {
    flex: 1,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.extrabold,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 13,
    color: themeColors.textSecondary,
    lineHeight: 18,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    gap: 6,
  },
  actionText: {
    color: themeColors.textOnPrimary,
    fontWeight: typography.weight.bold,
    fontSize: 13,
  },
  actionArrow: {
    color: themeColors.textOnPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
  },
});
