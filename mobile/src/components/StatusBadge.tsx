import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { InvoiceStatus } from '../types/invoice';
import { colors, radii, spacing, typography } from '../theme/tokens';

const statusI18nKeys: Record<InvoiceStatus, string> = {
  stamped: 'common.stamped',
  processing: 'common.processing',
  failed: 'common.failed',
  queued: 'common.queued',
};

const StatusBadge = memo(function StatusBadge(props: { status: InvoiceStatus }) {
  const { t } = useTranslation();
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
      <Text style={[styles.text, { color }]}>
        {(statusI18nKeys[props.status] ? t(statusI18nKeys[props.status]) : props.status).toUpperCase()}
      </Text>
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
