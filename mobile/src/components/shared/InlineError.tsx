/**
 * InlineError — V12 APEX
 * Human-readable, non-technical, actionable error message.
 * Rules: WCAG AA color contrast; color + icon + text (C-15); never raw exception text.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '../../design-system/tokens';

interface InlineErrorProps {
  /** Emoji or unicode icon (e.g. '⚠️', '🔌') shown for accessibility shape cue (C-15) */
  icon?: string;
  /** Human-readable error message — never raw stack traces or technical jargon */
  message: string;
  /** Retry / dismiss / action handler — always required */
  onAction: () => void;
  /** CTA label default "Try Again" */
  actionLabel?: string;
}

export function InlineError({
  icon = '⚠️',
  message,
  onAction,
  actionLabel = 'Try Again',
}: InlineErrorProps): React.ReactElement {
  return (
    <View style={styles.container} accessible accessibilityRole="alert">
      {/* Shape + icon — C-15: not color alone */}
      <View style={styles.iconWrap}>
        <Text style={styles.icon} accessibilityElementsHidden>
          {icon}
        </Text>
      </View>

      {/* Message */}
      <Text style={styles.message}>{message}</Text>

      {/* Action */}
      <TouchableOpacity
        style={styles.button}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.red[50],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.red[500],
    gap: spacing.xs,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.red[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
  },
  message: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.red[700],
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.red[600],
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  buttonText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[0],
    fontWeight: '600',
  },
});

export default InlineError;
