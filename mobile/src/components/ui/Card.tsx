import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, radii, spacing, shadows } from '../../theme/tokens';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'ntaExemption' | 'ntaAlert' | 'ntaCompliance';
type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	variant?: CardVariant;
	padding?: CardPadding;
	animated?: boolean;
	animationDelay?: number;
}

const paddingMap: Record<CardPadding, number> = {
	sm: spacing.md,
	md: spacing.lg,
	lg: spacing.xl,
};

export function Card({
	children,
	style,
	variant = 'default',
	padding = 'md',
	animated = false,
	animationDelay = 0,
}: CardProps) {
	const baseStyles = [
		styles.base,
		variant === 'elevated' && styles.elevated,
		variant === 'outlined' && styles.outlined,
		variant === 'ntaExemption' && styles.ntaExemption,
		variant === 'ntaAlert' && styles.ntaAlert,
		variant === 'ntaCompliance' && styles.ntaCompliance,
		{ padding: paddingMap[padding] },
		style,
	];

	if (animated) {
		return (
			<Animated.View entering={FadeInDown.duration(300).delay(animationDelay)} style={baseStyles}>
				{children}
			</Animated.View>
		);
	}

	return <View style={baseStyles}>{children}</View>;
}

const styles = StyleSheet.create({
	base: {
		backgroundColor: colors.surface,
		borderRadius: radii.lg,
	},
	elevated: {
		...shadows.sm,
	},
	outlined: {
		borderWidth: 1,
		borderColor: colors.borderSubtle,
	},
	ntaExemption: {
		backgroundColor: colors.ntaExemptionLight,
		borderLeftWidth: 4,
		borderLeftColor: colors.ntaExemption,
	},
	ntaAlert: {
		backgroundColor: colors.ntaAlertLight,
		borderLeftWidth: 4,
		borderLeftColor: colors.ntaAlert,
	},
	ntaCompliance: {
		backgroundColor: colors.ntaComplianceLight,
		borderLeftWidth: 4,
		borderLeftColor: colors.ntaCompliance,
	},
});
