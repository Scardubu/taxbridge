import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { InvoiceStatus } from '../types/invoice';
import { colors, radii, spacing, typography } from '../theme/tokens';

const StatusBadge = memo(function StatusBadge(props: { status: InvoiceStatus }) {
  const color =
    props.status === 'stamped'
      ? colors.successDark
      : props.status === 'processing'
        ? colors.warningDark
        : props.status === 'failed'
          ? colors.errorDark
          : colors.textSecondary;

  const bg =
    props.status === 'stamped'
      ? colors.successBg
      : props.status === 'processing'
        ? colors.warningBg
        : props.status === 'failed'
          ? colors.errorBg
          : colors.neutralBg;

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{props.status.toUpperCase()}</Text>
    </View>
  );
});

export default StatusBadge;

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.full,
    borderWidth: 1
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold
  }
});
