import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface InfoPillProps {
  icon: string;
  title: string;
  subtitle?: string;
  compact?: boolean;
}

function InfoPill({ icon, title, subtitle, compact = false }: InfoPillProps) {
  return (
    <View
      style={[styles.pill, compact && styles.pillCompact]}
      accessibilityRole="text"
      accessibilityLabel={`${title}${subtitle ? `: ${subtitle}` : ''}`}
    >
      <Text style={[styles.pillIcon, compact && styles.pillIconCompact]} accessibilityElementsHidden>
        {icon}
      </Text>
      <View style={styles.pillContent}>
        <Text style={[styles.pillTitle, compact && styles.pillTitleCompact]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && !compact && (
          <Text style={styles.pillSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

export default memo(InfoPill);

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md - 2,
    minWidth: 160,
    ...(isWeb
      ? { boxShadow: '0 6px 12px rgba(12, 34, 73, 0.06)' }
      : {
          shadowColor: colors.shadowChip,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
        }),
  },
  pillCompact: {
    padding: spacing.sm + 2,
    minWidth: 140,
  },
  pillIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  pillIconCompact: {
    fontSize: 18,
  },
  pillContent: {
    flex: 1,
  },
  pillTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.brandNavy900,
  },
  pillTitleCompact: {
    fontSize: typography.size.xs + 1,
  },
  pillSubtitle: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
});
