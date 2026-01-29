import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export type BadgeTone = 'green' | 'blue' | 'indigo' | 'yellow';

interface TrustBadgeProps {
  label: string;
  icon?: string;
  tone?: BadgeTone;
  compact?: boolean;
}

const toneStyles: Record<BadgeTone, { bg: string; text: string; border: string }> = {
  green: {
    bg: colors.successBg,
    text: colors.successDark,
    border: colors.successBorder,
  },
  blue: {
    bg: colors.primaryLight,
    text: colors.primary,
    border: colors.primaryBorder,
  },
  indigo: {
    bg: colors.brandIndigoBg,
    text: colors.brandIndigo,
    border: colors.brandIndigoBorder,
  },
  yellow: {
    bg: colors.warningBg,
    text: colors.warningDark,
    border: colors.warningBorder,
  },
};

const defaultIcons: Record<BadgeTone, string> = {
  green: '🛡️',
  blue: '🔁',
  indigo: '✓',
  yellow: '⏱️',
};

function TrustBadge({ label, icon, tone = 'blue', compact = false }: TrustBadgeProps) {
  const toneStyle = toneStyles[tone];
  const displayIcon = icon ?? defaultIcons[tone];

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        {
          backgroundColor: toneStyle.bg,
          borderColor: toneStyle.border,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${label} badge`}
    >
      <Text style={styles.badgeIcon} accessibilityElementsHidden>
        {displayIcon}
      </Text>
      <Text style={[styles.badgeText, { color: toneStyle.text }]}>{label}</Text>
    </View>
  );
}

export default memo(TrustBadge);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 1,
    borderRadius: radii.full,
    borderWidth: 1,
    gap: spacing.xs + 2,
  },
  badgeCompact: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  badgeIcon: {
    fontSize: 12,
  },
  badgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
