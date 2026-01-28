// mobile/src/components/features/StatsCard.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { spacing, colors, typography } from '../../theme';

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
  style?: ViewStyle;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  label,
  value,
  badge,
  trend,
  backgroundColor = colors.neutral[0],
  textColor = colors.text.primary,
  style,
}) => {
  return (
    <Card
      variant="elevated"
      padding="lg"
      style={[styles.container, { backgroundColor }, style] as ViewStyle}
    >
      <Text style={styles.icon}>{icon}</Text>
      
      <Text style={[styles.label, { color: textColor === colors.neutral[0] ? colors.accent[500] : colors.text.tertiary }]}>
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
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.fontSize.xxxl * 1.2,
  },
  trend: {
    marginLeft: spacing.sm,
  },
  trendText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  trendPositive: {
    color: colors.success[500],
  },
  trendNegative: {
    color: colors.error[500],
  },
  badgeContainer: {
    marginTop: 'auto',
  },
});