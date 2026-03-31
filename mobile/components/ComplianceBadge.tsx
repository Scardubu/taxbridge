import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette, radius, spacing, typography } from './design-system/tokens';

interface Props {
  score: number;
  titleKey?: string;
}

export function ComplianceBadge({ score, titleKey = 'dashboard.shield.excellent' }: Props) {
  const { t } = useTranslation();
  const backgroundColor =
    score >= 80 ? palette.shield : score >= 50 ? palette.warning : palette.danger;
  const shieldKey =
    score >= 80
      ? 'dashboard.shield.excellent'
      : score >= 50
        ? 'dashboard.shield.good'
        : 'dashboard.shield.needsWork';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${t(shieldKey)} ${score}%`}
      style={{ backgroundColor, borderRadius: radius.xl, padding: spacing.lg }}
    >
      <Text style={{ ...typography.label, color: palette.white, marginBottom: spacing.xs }}>
        {t(titleKey)}
      </Text>
      <Text style={{ ...typography.display, color: palette.white }}>{score}%</Text>
      <Text style={{ ...typography.caption, color: palette.white }}>
        {t(shieldKey)}
      </Text>
    </View>
  );
}
