import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radii, spacing, shadows } from '../../theme/tokens';

type CardVariant = 'default' | 'elevated' | 'outlined';
type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	variant?: CardVariant;
	padding?: CardPadding;
}

const paddingMap: Record<CardPadding, number> = {
	sm: spacing.md,
	md: spacing.lg,
	lg: spacing.xl,
};

export function Card({ children, style, variant = 'default', padding = 'md' }: CardProps) {
	return (
		<View
			style={[
				styles.base,
				variant === 'elevated' && styles.elevated,
				variant === 'outlined' && styles.outlined,
				{ padding: paddingMap[padding] },
				style,
			]}
		>
			{children}
		</View>
	);
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
});
