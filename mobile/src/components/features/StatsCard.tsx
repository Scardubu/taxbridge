// mobile/src/components/features/StatsCard.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { spacing, colors, typography } from '../../theme/tokens';

interface StatsCardProps {
  icon: string;
  label: string;
  value: string | number;
  badge?: {
    text: string;
    icon?: string;
  };
  trend?: {
    value: number;
    isPositive: boolean;
  };
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  label,
  value,
  badge,
  trend,
  backgroundColor = colors.surfaceMuted,
  textColor = colors.textPrimary,
  style,
}) => {
  return (
    <Card
      variant="elevated"
      padding="lg"
      style={[styles.container, { backgroundColor }, style]}
    >
      <Text style={styles.icon}>{icon}</Text>
      
      <Text style={[styles.label, { color: textColor === colors.surfaceMuted ? colors.primary : colors.textMuted }]}>
        {label}
      </Text>
      
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: textColor }]}>
          {value}
        </Text>
        
        {trend && (
          <View style={styles.trend}>
            <Text style={[styles.trendText, trend.isPositive ? styles.trendPositive : styles.trendNegative]}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </Text>
          </View>
        )}
      </View>
      
      {badge && (
        <View style={styles.badgeContainer}>
          <Badge variant="success" size="sm" icon={badge.icon}>
            {badge.text}
          </Badge>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 140,
  },
  icon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.bold,
    lineHeight: typography.size.xxxl * 1.2,
  },
  trend: {
    marginLeft: spacing.sm,
  },
  trendText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  trendPositive: {
    color: colors.success,
  },
  trendNegative: {
    color: colors.error,
  },
  badgeContainer: {
    marginTop: 'auto',
  },
});