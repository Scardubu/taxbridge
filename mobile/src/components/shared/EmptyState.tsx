/**
 * EmptyState — V12 APEX
 * Zero-data state with icon, heading, body copy and a single CTA.
 * Designed for low-literacy users (C-02 UX rule): clear icon, short sentences, prominent button.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../../design-system/tokens';

interface EmptyStateProps {
  /** Large emoji or unicode symbol rendered as the visual anchor */
  icon: string;
  /** Short headline (≤ 40 chars recommended) */
  heading: string;
  /** Supporting body copy — one sentence, plain language */
  body: string;
  /** CTA button label */
  cta: string;
  /** CTA handler */
  onAction: () => void;
}

export function EmptyState({
  icon,
  heading,
  body,
  cta,
  onAction,
}: EmptyStateProps): React.ReactElement {
  return (
    <View style={styles.container} accessible accessibilityLiveRegion="polite">
      {/* Icon — shape + text (C-15: never color alone) */}
      <Text style={styles.icon} accessibilityRole="image" accessibilityLabel={icon}>
        {icon}
      </Text>

      {/* Heading */}
      <Text style={styles.heading}>{heading}</Text>

      {/* Body */}
      <Text style={styles.body}>{body}</Text>

      {/* Call to action */}
      <TouchableOpacity
        style={styles.button}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={cta}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
  },
  icon: {
    fontSize: 56,
    lineHeight: 68,
    marginBottom: spacing.sm,
  },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.gray[500],
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.md,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[500],
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  buttonText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[0],
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default EmptyState;
