import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';

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
    marginRight: 12,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    minHeight: 160,
    justifyContent: 'space-between',
    // @ts-ignore - boxShadow for web compatibility
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
    fontSize: 24,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 11,
    color: '#667085',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#475467',
    lineHeight: 18,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  actionArrow: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
