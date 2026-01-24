import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface MetricChipProps {
  value: string;
  label: string;
  tone?: 'primary' | 'indigo' | 'success';
}

function MetricChip({ value, label, tone = 'primary' }: MetricChipProps) {
  const toneColors = {
    primary: { bg: colors.primaryLight, text: colors.primary },
    indigo: { bg: colors.brandIndigoBg, text: colors.brandIndigo },
    success: { bg: colors.successBg, text: colors.successDark },
  };

  const { bg, text } = toneColors[tone];

  return (
    <View
      style={[styles.chip, { backgroundColor: bg }]}
      accessibilityRole="text"
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={[styles.chipValue, { color: text }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color: text }]}>{label}</Text>
    </View>
  );
}

export default memo(MetricChip);

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.lg,
    ...(isWeb
      ? { boxShadow: '0 6px 12px rgba(12, 34, 73, 0.06)' }
      : {
          shadowColor: colors.shadowChip,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }),
  },
  chipValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
