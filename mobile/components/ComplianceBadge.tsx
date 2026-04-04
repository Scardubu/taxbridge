import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { palette, radius, shadows, spacing, typography } from './design-system/tokens';

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
  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    score >= 80 ? 'shield-checkmark' : score >= 50 ? 'shield-half' : 'warning';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${t(shieldKey)} ${score}%`}
      style={{ backgroundColor, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Ionicons name={iconName} size={20} color={palette.white} />
        <Text style={{ ...typography.label, color: palette.white + 'CC' }}>
          {t(titleKey)}
        </Text>
      </View>
      <Text style={{ ...typography.display, color: palette.white }}>{score}%</Text>
      <Text style={{ ...typography.caption, color: palette.white + 'CC', marginTop: spacing.xs }}>
        {t(shieldKey)}
      </Text>
    </View>
  );
}
