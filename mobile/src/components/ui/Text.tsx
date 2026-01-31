import React from 'react';
import { Text as RNText, StyleSheet, TextStyle } from 'react-native';
import { colors, typography } from '../../theme/tokens';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'pidgin' | 'currency';
export type TextWeight = keyof typeof typography.weight;

interface TextProps {
  variant?: TextVariant;
  weight?: TextWeight;
  color?: string;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
}

export function Text({
  variant = 'body',
  weight = 'regular',
  color = colors.textPrimary,
  align = 'left',
  children,
  style,
  numberOfLines,
}: TextProps) {
  return (
    <RNText
      style={[styles.base, styles[variant], { fontWeight: typography.weight[weight], color, textAlign: align }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: typography.size.md,
    lineHeight: typography.body.lineHeight,
  },
  h1: {
    fontSize: typography.size.h1,
    lineHeight: typography.size.h1 * typography.lineHeight.tight,
    fontWeight: typography.weight.bold,
  },
  h2: {
    fontSize: typography.size.h2,
    lineHeight: typography.size.h2 * typography.lineHeight.tight,
    fontWeight: typography.weight.bold,
  },
  h3: {
    fontSize: typography.size.h3,
    lineHeight: typography.size.h3 * typography.lineHeight.snug,
    fontWeight: typography.weight.semibold,
  },
  h4: {
    fontSize: typography.size.h4,
    lineHeight: typography.size.h4 * typography.lineHeight.snug,
    fontWeight: typography.weight.semibold,
  },
  body: {
    fontSize: typography.size.body,
    lineHeight: typography.body.lineHeight,
  },
  caption: {
    fontSize: typography.size.caption,
    lineHeight: typography.caption.lineHeight,
    color: colors.textMuted,
  },
  pidgin: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeight.relaxed,
  },
  currency: {
    fontSize: typography.size.xxl,
    lineHeight: typography.size.xxl * typography.lineHeight.tight,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
});
