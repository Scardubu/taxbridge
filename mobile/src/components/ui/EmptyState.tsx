import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, spacing, radii, typography } from '../../theme/tokens';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  illustration?: React.ReactNode;
}

/**
 * EmptyState Component
 * 
 * Unified empty state design across the app:
 * - Consistent visual language
 * - Clear messaging
 * - Optional CTA
 * - Supports custom illustrations
 */
export const EmptyState = memo<EmptyStateProps>(({
  icon,
  title,
  message,
  action,
  illustration,
}) => {
  return (
    <Animated.View 
      style={styles.container}
      entering={FadeIn}
      testID="empty-state"
      accessible
      accessibilityLabel={title}
      accessibilityHint={message}
    >
      {illustration || (
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={64} color={colors.textMuted} />
        </View>
      )}
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      
      {action && (
        <TouchableOpacity 
          style={styles.button}
          onPress={action.onPress}
          activeOpacity={0.8}
          testID="empty-state-action"
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

EmptyState.displayName = 'EmptyState';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: typography.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
  },
  buttonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.textOnPrimary,
  },
});
