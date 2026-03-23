import React from 'react';
import { View, Text } from 'react-native';
import { palette, radius, spacing, typography } from './design-system/tokens';

interface Props {
  score: number;
  title?: string;
}

export function ComplianceBadge({ score, title = 'Compliance Badge' }: Props) {
  const backgroundColor = score >= 80 ? palette.shield : score >= 50 ? palette.warning : palette.danger;
  return (
    <View style={{ backgroundColor, borderRadius: radius.xl, padding: spacing.lg }}>
      <Text style={{ ...typography.label, color: palette.white, marginBottom: spacing.xs }}>{title}</Text>
      <Text style={{ ...typography.display, color: palette.white }}>{score}%</Text>
      <Text style={{ ...typography.caption, color: palette.white }}>Ready for NRS-aligned invoicing and tax workflows.</Text>
    </View>
  );
}
